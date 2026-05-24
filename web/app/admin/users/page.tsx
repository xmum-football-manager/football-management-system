import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/supabase/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, ShieldCheck } from 'lucide-react'

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

  const users = (list?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? '(no email)',
    must_change_password: Boolean(u.user_metadata?.must_change_password),
    roles: rolesByUser.get(u.id) ?? [],
  }))

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
                {u.must_change_password && (
                  <div className="text-xs text-amber-700 mt-0.5">Default password — must be changed on first login.</div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {u.roles.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No roles</span>
                ) : (
                  dedupRoleBadges(u.roles).map((b, i) => (
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

function dedupRoleBadges(
  roles: UserRole[],
): { label: string; variant: 'purple' | 'info' | 'success' }[] {
  const set = new Set<string>()
  const out: { label: string; variant: 'purple' | 'info' | 'success' }[] = []
  for (const r of roles) {
    if (set.has(r.role)) continue
    set.add(r.role)
    if (r.role === 'admin') out.push({ label: 'Admin', variant: 'purple' })
    else if (r.role === 'organizer') out.push({ label: 'Organizer', variant: 'info' })
    else if (r.role === 'scorekeeper') out.push({ label: 'Scorekeeper', variant: 'success' })
  }
  return out
}
