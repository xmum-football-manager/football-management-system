import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser, getUserRoles, getAllUserRoles } from '@/lib/db/tournaments'

export async function GET() {
  const supabase = await createClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerRoles = await getUserRoles(supabase, user.id)
  if (!callerRoles.some(r => r.role === 'admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const service = createServiceClient()

  try {
    const [{ data: authUsers, error: authErr }, roles] = await Promise.all([
      service.auth.admin.listUsers({ perPage: 1000 }),
      getAllUserRoles(service),
    ])

    if (authErr) {
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    const users = authUsers.users.map(u => ({
      id: u.id,
      email: u.email,
      roles: roles.filter(r => r.user_id === u.id).map(r => ({ role: r.role, tournament_id: r.tournament_id })),
    }))

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
