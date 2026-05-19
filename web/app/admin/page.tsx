import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Tournament } from '@/lib/supabase/types'
import { getCurrentUser, getUserRoles, getAllTournaments, getTournamentsByIds } from '@/lib/db/tournaments'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const user = await getCurrentUser(supabase)
  if (!user) redirect('/login')

  const roles = await getUserRoles(supabase, user.id)
  const isAdmin = roles.some(r => r.role === 'admin')

  let tournaments: Tournament[]
  if (isAdmin) {
    tournaments = await getAllTournaments(supabase)
  } else {
    const orgTournamentIds = roles
      .filter(r => r.role === 'organizer')
      .map(r => r.tournament_id)
      .filter((id): id is string => Boolean(id))
    if (orgTournamentIds.length === 0) {
      return (
        <AdminShell user={user} isAdmin={isAdmin}>
          <EmptyState />
        </AdminShell>
      )
    }
    tournaments = await getTournamentsByIds(supabase, orgTournamentIds)
  }

  const activeCount = tournaments.filter(t => t.status === 'active').length

  return (
    <AdminShell user={user} isAdmin={isAdmin}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Tournaments</h2>
            <p className="text-sm text-slate-500">{activeCount} active</p>
          </div>
          {isAdmin && (
            <Link
              href="/admin/tournaments/new"
              className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              + New Tournament
            </Link>
          )}
        </div>

        {tournaments.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-3">
            {tournaments.map(t => (
              <TournamentRow key={t.id} tournament={t} />
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="pt-4 border-t border-slate-200">
            <Link href="/admin/users" className="text-sm text-slate-500 hover:text-slate-700 font-medium">
              Manage Users →
            </Link>
          </div>
        )}
      </div>
    </AdminShell>
  )
}

function AdminShell({
  user,
  isAdmin,
  children,
}: {
  user: { email?: string }
  isAdmin: boolean
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="font-bold text-slate-900">⚽ Tournament Admin</span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500">{user.email}</span>
            {isAdmin && (
              <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                Admin
              </span>
            )}
            <form action="/admin/auth/signout" method="POST">
              <button type="submit" className="text-slate-500 hover:text-slate-700">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}

function TournamentRow({ tournament: t }: { tournament: Tournament }) {
  const statusColors: Record<string, string> = {
    setup: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    finished: 'bg-slate-100 text-slate-500',
    archived: 'bg-slate-100 text-slate-400',
  }
  return (
    <Link
      href={`/admin/tournaments/${t.id}`}
      className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between hover:border-green-500 transition-colors"
    >
      <div>
        <p className="font-semibold text-slate-900">{t.name}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-xs text-slate-400">
            📅 {new Date(t.start_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })} - {new Date(t.end_date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          {t.location && <p className="text-xs text-slate-400">📍 {t.location}</p>}
        </div>
      </div>
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusColors[t.status] ?? ''}`}>
        {t.status}
      </span>
    </Link>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
      <p className="text-4xl mb-3">🏆</p>
      <p className="text-slate-600 font-medium">No tournaments yet.</p>
      <p className="text-slate-400 text-sm mt-1">Create one to get started.</p>
    </div>
  )
}
