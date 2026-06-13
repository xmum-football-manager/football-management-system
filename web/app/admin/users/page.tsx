import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/supabase/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, ShieldCheck } from 'lucide-react'
import { PasswordCell } from './PasswordCell'

export const metadata = { title: 'Users' }

export default async function UsersPage() {
  await requireAdmin()

  const svc = createServiceClient()
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })

  const supabase = await createClient()
  const { data: roles } = await supabase.from('user_roles').select('*')
  const rolesByUser = new Map<string, UserRole[]>()
  for (const r of (roles ?? []) as UserRole[]) {
    const arr = rolesByUser.get(r.user_id) ?? []
    arr.push(r)
    rolesByUser.set(r.user_id, arr)
  }

  // Resolve tournament names for scorekeeper badges (tournament-scoped directly,
  // match-scoped via the match's tournament).
  const { data: tournaments } = await supabase.from('tournaments').select('id, name')
  const tournamentName = new Map((tournaments ?? []).map((t) => [t.id as string, t.name as string]))

  const matchIds = [...new Set((roles ?? []).filter((r) => r.match_id).map((r) => r.match_id as string))]
  const matchToTournament = new Map<string, string>()
  if (matchIds.length > 0) {
    const { data: matches } = await supabase.from('matches').select('id, tournament_id').in('id', matchIds)
    for (const m of matches ?? []) matchToTournament.set(m.id as string, m.tournament_id as string)
  }

  const users = (list?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? '(no email)',
    must_change_password: Boolean(u.user_metadata?.must_change_password),
    roles: rolesByUser.get(u.id) ?? [],
  }))

  // admin → organizer → scorekeeper → no role; email as a stable tiebreak.
  users.sort((a, b) => roleRank(a.roles) - roleRank(b.roles) || a.email.localeCompare(b.email))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground gap-1 mb-1">
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">{users.length} accounts.</p>
        </div>
        <Link href="/admin/users/invite">
          <Button>
            <Plus className="h-4 w-4" /> Add User
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-4">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{u.email}</div>
                <div className="mt-1">
                  <PasswordCell userId={u.id} mustChangePassword={u.must_change_password} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {u.roles.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No roles</span>
                ) : (
                  roleBadges(u.roles, tournamentName, matchToTournament).map((b, i) => (
                    <Badge key={i} variant={b.variant}>
                      {b.label}
                    </Badge>
                  ))
                )}
              </div>
              {u.roles.some((r) => r.role === 'admin') && (
                <ShieldCheck className="h-4 w-4 text-purple-600" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function roleRank(roles: UserRole[]): number {
  if (roles.some((r) => r.role === 'admin')) return 0
  if (roles.some((r) => r.role === 'organizer')) return 1
  if (roles.some((r) => r.role === 'scorekeeper')) return 2
  return 3
}

function roleBadges(
  roles: UserRole[],
  tournamentName: Map<string, string>,
  matchToTournament: Map<string, string>,
): { label: string; variant: 'purple' | 'info' | 'success' }[] {
  const out: { label: string; variant: 'purple' | 'info' | 'success' }[] = []
  if (roles.some((r) => r.role === 'admin')) out.push({ label: 'Admin', variant: 'purple' })
  if (roles.some((r) => r.role === 'organizer')) out.push({ label: 'Organizer', variant: 'info' })

  // One badge per distinct tournament a scorekeeper is linked to (normally one).
  const skTournaments = new Set<string>()
  let skUnscoped = false
  for (const r of roles) {
    if (r.role !== 'scorekeeper') continue
    const tid = r.tournament_id ?? (r.match_id ? matchToTournament.get(r.match_id) : null)
    if (tid) skTournaments.add(tid)
    else skUnscoped = true
  }
  for (const tid of skTournaments) {
    out.push({ label: `Scorekeeper · ${tournamentName.get(tid) ?? 'Unknown'}`, variant: 'success' })
  }
  if (skUnscoped || (roles.some((r) => r.role === 'scorekeeper') && skTournaments.size === 0)) {
    out.push({ label: 'Scorekeeper', variant: 'success' })
  }
  return out
}
