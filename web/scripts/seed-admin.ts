import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const EMAIL = 'admin@admin.org'
const PASSWORD = 'footballclub1234'

async function main() {
  const svc = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Find or create the auth user
  let userId: string | null = null
  const { data: list, error: listErr } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) throw listErr
  const existing = list.users.find((u) => u.email?.toLowerCase() === EMAIL)

  if (existing) {
    userId = existing.id
    console.log(`auth user already exists: ${userId} — updating password`)
    const { error } = await svc.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) throw error
  } else {
    const { data, error } = await svc.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) throw error
    userId = data.user!.id
    console.log(`created auth user: ${userId}`)
  }

  // 2. Ensure admin role row exists
  const { data: roleRow, error: roleSelErr } = await svc
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  if (roleSelErr) throw roleSelErr

  if (roleRow) {
    console.log('admin role already assigned — nothing to do')
  } else {
    const { error: insErr } = await svc
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin', tournament_id: null, match_id: null })
    if (insErr) throw insErr
    console.log('admin role assigned')
  }

  console.log(`\nDONE — login with ${EMAIL} / ${PASSWORD}`)
}

main().catch((e) => {
  console.error('FAILED:', e.message ?? e)
  process.exit(1)
})
