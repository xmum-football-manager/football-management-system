import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/db/roles'

const DEFAULT_PASSWORD = 'footballclub'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!(await isAdmin(auth.user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { email?: string; role?: 'organizer' | 'scorekeeper' }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const role = body.role
  if (!email || !role || (role !== 'organizer' && role !== 'scorekeeper')) {
    return NextResponse.json({ error: 'email and role required' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: created, error } = await svc.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  })

  if (error || !created.user) {
    return NextResponse.json({ error: error?.message ?? 'failed to create user' }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId: created.user.id })
}
