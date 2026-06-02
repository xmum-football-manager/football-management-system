/**
 * Seeds a reusable admin login for local/dev + automated agents.
 *   Email:    admin@admin.org
 *   Password: admin123
 *
 * Idempotent: creates the auth user if missing (or resets its password if it
 * exists), then ensures a global `admin` row in public.user_roles.
 *
 * Run: pnpm tsx --env-file=.env.local scripts/seed-admin-user.ts
 *
 * DEV ONLY — weak password by design for test convenience. Do not run against
 * a production database.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const EMAIL = 'admin@admin.org'
const PASSWORD = 'admin123'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

async function run() {
  // 1. Find existing user by email (page through the admin list).
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) {
    console.error('listUsers failed:', listErr.message)
    process.exit(1)
  }
  const existing = list.users.find((u) => u.email?.toLowerCase() === EMAIL)

  let userId: string
  if (existing) {
    console.log(`User ${EMAIL} already exists (${existing.id}) — resetting password.`)
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) {
      console.error('updateUserById failed:', error.message)
      process.exit(1)
    }
    userId = existing.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error || !data.user) {
      console.error('createUser failed:', error?.message)
      process.exit(1)
    }
    userId = data.user.id
    console.log(`Created user ${EMAIL} (${userId}).`)
  }

  // 2. Ensure a global admin role row (tournament_id + match_id null).
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .is('tournament_id', null)
    .is('match_id', null)
    .maybeSingle()

  if (roleRow) {
    console.log('Admin role already assigned.')
  } else {
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin', tournament_id: null, match_id: null })
    if (error) {
      console.error('assign admin role failed:', error.message)
      process.exit(1)
    }
    console.log('Assigned global admin role.')
  }

  console.log(`\n✅ Admin login ready:\n   ${EMAIL} / ${PASSWORD}`)
}

run().catch(console.error)
