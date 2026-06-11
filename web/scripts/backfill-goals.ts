/**
 * One-off backfill: create synthetic goal-scorer rows for existing live/finished
 * matches so the new Top Players feature shows data. For each such match we insert
 * `home_score` goals for random home-roster players and `away_score` for away.
 *
 * Idempotent: matches that already have goal rows are skipped. Teams with no
 * players are skipped (can't attribute a scorer).
 *
 * Run: npx tsx scripts/backfill-goals.ts
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// load .env.local manually (no dotenv dependency assumed)
const env: Record<string, string> = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1')
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function main() {
  const { data: matches, error: mErr } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, home_score, away_score, status')
    .in('status', ['live', 'finished'])
  if (mErr) throw mErr

  const { data: existing, error: gErr } = await supabase.from('goals').select('match_id')
  if (gErr) throw gErr
  const hasGoals = new Set((existing ?? []).map((g) => g.match_id))

  // roster map: team_id -> player ids
  const { data: players, error: pErr } = await supabase.from('players').select('id, team_id')
  if (pErr) throw pErr
  const roster = new Map<string, string[]>()
  for (const p of players ?? []) {
    if (!roster.has(p.team_id)) roster.set(p.team_id, [])
    roster.get(p.team_id)!.push(p.id)
  }

  const rows: { match_id: string; team_id: string; player_id: string }[] = []
  let skippedExisting = 0
  let skippedNoRoster = 0

  for (const m of matches ?? []) {
    if (hasGoals.has(m.id)) { skippedExisting++; continue }
    for (const side of [['home_team_id', 'home_score'], ['away_team_id', 'away_score']] as const) {
      const teamId = m[side[0]] as string
      const score = (m[side[1]] as number) ?? 0
      const squad = roster.get(teamId)
      if (score > 0 && (!squad || squad.length === 0)) { skippedNoRoster++; continue }
      for (let i = 0; i < score; i++) {
        rows.push({ match_id: m.id, team_id: teamId, player_id: pick(squad!) })
      }
    }
  }

  console.log(`matches scanned: ${matches?.length ?? 0}`)
  console.log(`skipped (already had goals): ${skippedExisting}`)
  console.log(`skipped sides (no roster): ${skippedNoRoster}`)
  console.log(`goal rows to insert: ${rows.length}`)

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await supabase.from('goals').insert(batch)
    if (error) throw error
    console.log(`  inserted ${Math.min(i + 500, rows.length)}/${rows.length}`)
  }
  console.log('✅ backfill complete')
}

main().catch((e) => { console.error(e); process.exit(1) })
