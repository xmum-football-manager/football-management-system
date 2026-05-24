import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/db/roles'
import type { UserRole } from '@/lib/supabase/types'

export async function GET() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!(await isAdmin(auth.user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()
  const { data: list, error } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: roles } = await supabase.from('user_roles').select('*')
  const rolesByUser = new Map<string, UserRole[]>()
  for (const r of (roles ?? []) as UserRole[]) {
    const arr = rolesByUser.get(r.user_id) ?? []
    arr.push(r)
    rolesByUser.set(r.user_id, arr)
  }

  return NextResponse.json({
    users: list.users.map((u) => ({
      id: u.id,
      email: u.email,
      roles: (rolesByUser.get(u.id) ?? []).map((r) => ({
        role: r.role,
        tournament_id: r.tournament_id,
        match_id: r.match_id,
      })),
    })),
  })
}
