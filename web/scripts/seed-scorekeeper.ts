/**
 * One-off: create a dev scorekeeper account and assign it to all active tournaments.
 * Run: set -a && source .env.local && set +a && npx tsx scripts/seed-scorekeeper.ts
 */
import { createClient } from '@supabase/supabase-js'

const EMAIL = 'keeper@test.org'
const PASSWORD = 'footballclub'

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function main() {
  // Create the user (or reuse if it already exists)
  let userId: string
  const { data: created, error } = await svc.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    // must_change_password intentionally omitted: dev account, no forced reset
  })
  if (error) {
    if (!error.message.toLowerCase().includes('already')) throw error
    const { data: list } = await svc.auth.admin.listUsers()
    const existing = list.users.find((u) => u.email === EMAIL)
    if (!existing) throw new Error('user exists but not found via listUsers')
    userId = existing.id
    // make sure the password is what we say it is
    await svc.auth.admin.updateUserById(userId, { password: PASSWORD })
    console.log('user already existed — password reset to the one below')
  } else {
    userId = created.user!.id
    console.log('user created')
  }

  // Assign tournament-wide scorekeeper role on every active tournament
  const { data: tournaments, error: tErr } = await svc
    .from('tournaments')
    .select('id, name')
    .eq('status', 'active')
  if (tErr) throw tErr

  for (const t of tournaments ?? []) {
    const { data: dup } = await svc
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'scorekeeper')
      .eq('tournament_id', t.id)
      .maybeSingle()
    if (dup) {
      console.log(`already scorekeeper for: ${t.name}`)
      continue
    }
    const { error: rErr } = await svc
      .from('user_roles')
      .insert({ user_id: userId, role: 'scorekeeper', tournament_id: t.id, match_id: null })
    if (rErr) throw rErr
    console.log(`assigned scorekeeper for: ${t.name}`)
  }

  console.log(`\nlogin: ${EMAIL} / ${PASSWORD}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
