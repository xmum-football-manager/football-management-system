import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/db/roles'

export async function requireUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/admin/login')
  return data.user
}

export async function requireScorekeeperUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/score/login')
  return data.user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (!(await isAdmin(user.id))) redirect('/admin')
  return user
}

export function mustChangePassword(user: { user_metadata?: Record<string, unknown> | null }) {
  return Boolean(user.user_metadata?.must_change_password)
}
