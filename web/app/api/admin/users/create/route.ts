import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const DEFAULT_PASSWORD = 'footballclub'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
  if (!roles?.some(r => r.role === 'admin')) {
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

  const { error: roleError } = await service
    .from('user_roles')
    .insert({ user_id: created.user.id, role, tournament_id: null })

  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 })

  return NextResponse.json({ success: true, userId: created.user.id })
}
