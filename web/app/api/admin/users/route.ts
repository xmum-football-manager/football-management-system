import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerRoles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  if (!callerRoles?.some(r => r.role === 'admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const service = createServiceClient()

  const [{ data: authUsers, error: authErr }, { data: roles, error: rolesErr }] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 1000 }),
    service.from('user_roles').select('user_id, role, tournament_id'),
  ])

  if (authErr || rolesErr) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  const users = authUsers.users.map(u => ({
    id: u.id,
    email: u.email,
    roles: roles?.filter(r => r.user_id === u.id).map(r => ({ role: r.role, tournament_id: r.tournament_id })) ?? [],
  }))

  return NextResponse.json({ users })
}
