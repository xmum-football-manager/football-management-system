import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser, getUserRoles, getAllUserRoles } from '@/lib/db/tournaments'

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  organizer: 'bg-blue-100 text-blue-700',
  scorekeeper: 'bg-green-100 text-green-700',
}

export default async function UsersPage() {
  const supabase = await createClient()
  const user = await getCurrentUser(supabase)
  if (!user) redirect('/login')

  const callerRoles = await getUserRoles(supabase, user.id)
  if (!callerRoles.some(r => r.role === 'admin')) redirect('/admin')

  const service = createServiceClient()
  const [{ data: authUsers }, roles] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 1000 }),
    getAllUserRoles(service),
  ])

  const users = (authUsers?.users ?? []).map(u => ({
    id: u.id,
    email: u.email ?? '—',
    roles: roles.filter(r => r.user_id === u.id),
  }))

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="font-bold text-slate-900">User Management</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-bold text-slate-900 mb-2">Add User</h2>
          <p className="text-sm text-slate-500 mb-4">Create an account with the default password. Share credentials with the user directly.</p>
          <Link href="/admin/users/invite"
            className="inline-block bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
            + Add User
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">All Users ({users.length})</h2>
          </div>
          {users.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">No users yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {users.map(u => (
                <li key={u.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {u.roles.length === 0 ? (
                      <span className="text-xs text-slate-400">No roles</span>
                    ) : (
                      u.roles.map((r, i) => (
                        <span key={i} className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_BADGE[r.role] ?? 'bg-slate-100 text-slate-600'}`}>
                          {r.role}
                        </span>
                      ))
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
