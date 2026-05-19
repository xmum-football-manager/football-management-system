import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser, getUserRoles } from '@/lib/db/tournaments'
import { createUserRole } from '@/lib/db/roles'

const DEFAULT_PASSWORD = 'footballclub'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roles = await getUserRoles(supabase, user.id)
  if (!roles.some(r => r.role === 'admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const { email, role } = body

  if (!email || !['organizer', 'scorekeeper'].includes(role)) {
    return NextResponse.json({ error: 'Invalid email or role' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: created, error } = await service.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await createUserRole(service, created.user.id, role, null)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to assign role' }, { status: 500 })
  }

  return NextResponse.json({ success: true, userId: created.user.id })
}
