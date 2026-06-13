/**
 * READ-ONLY audit: find scorekeepers assigned to more than one tournament.
 * Run: set -a && source .env.local && set +a && npx tsx scripts/audit-scorekeeper-tournaments.ts
 */
import { createClient } from '@supabase/supabase-js'

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function main() {
  const { data: roles, error } = await svc
    .from('user_roles')
    .select('id, user_id, tournament_id, match_id, created_at')
    .eq('role', 'scorekeeper')
  if (error) throw error

  // Resolve tournament for match-scoped rows
  const matchIds = [...new Set((roles ?? []).filter((r) => r.match_id).map((r) => r.match_id))]
  const matchToTournament = new Map<string, string>()
  if (matchIds.length > 0) {
    const { data: matches } = await svc.from('matches').select('id, tournament_id').in('id', matchIds as string[])
    for (const m of matches ?? []) matchToTournament.set(m.id, m.tournament_id)
  }

  // user -> tournament -> role rows
  const byUser = new Map<string, Map<string, { id: string; scope: string; created_at: string }[]>>()
  const unscoped: typeof roles = []
  for (const r of roles ?? []) {
    const tid = r.tournament_id ?? (r.match_id ? matchToTournament.get(r.match_id) : null)
    if (!tid) {
      unscoped.push(r)
      continue
    }
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Map())
    const perT = byUser.get(r.user_id)!
    if (!perT.has(tid)) perT.set(tid, [])
    perT.get(tid)!.push({ id: r.id, scope: r.tournament_id ? 'tournament' : 'match', created_at: r.created_at })
  }

  // Tournament names + user emails for readable output
  const { data: tournaments } = await svc.from('tournaments').select('id, name')
  const tName = new Map((tournaments ?? []).map((t) => [t.id, t.name]))
  const { data: userList } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
  const email = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? '(no email)']))

  console.log(`\nTotal scorekeeper role rows: ${(roles ?? []).length}`)
  if (unscoped.length > 0) {
    console.log(`\n⚠️  ${unscoped.length} UNSCOPED scorekeeper rows (no tournament_id and no resolvable match):`)
    for (const r of unscoped) console.log(`   role_id=${r.id} user=${email.get(r.user_id)}`)
  }

  const violators = [...byUser.entries()].filter(([, perT]) => perT.size > 1)
  if (violators.length === 0) {
    console.log('\n✅ No scorekeeper is assigned to more than one tournament.\n')
    return
  }

  console.log(`\n❌ ${violators.length} scorekeeper(s) assigned to MULTIPLE tournaments:\n`)
  for (const [userId, perT] of violators) {
    console.log(`• ${email.get(userId)}  (user_id=${userId}) — ${perT.size} tournaments:`)
    const entries = [...perT.entries()].sort((a, b) => {
      const aMin = Math.min(...a[1].map((x) => +new Date(x.created_at)))
      const bMin = Math.min(...b[1].map((x) => +new Date(x.created_at)))
      return aMin - bMin
    })
    for (const [tid, rows] of entries) {
      console.log(`    - ${tName.get(tid) ?? tid}  (tournament_id=${tid})`)
      for (const row of rows) console.log(`        role_id=${row.id} scope=${row.scope} created=${row.created_at}`)
    }
  }
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
