import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/db/roles'
import { DEFAULT_PASSWORD } from '@/lib/users'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!(await isAdmin(auth.user.id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const svc = createServiceClient()
  const { error } = await svc.auth.admin.updateUserById(id, {
    password: DEFAULT_PASSWORD,
    user_metadata: { must_change_password: true },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
