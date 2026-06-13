import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/db/roles'
import { createClubUser } from '@/lib/users'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!(await isAdmin(auth.user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  const result = await createClubUser({ email })
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  if ('alreadyExists' in result) {
    return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId: result.userId })
}
