/**
 * One-off backfill: create synthetic yellow/red card rows for existing
 * live/finished matches so the new card-count columns show data. Only
 * tournaments that currently have ZERO cards are touched.
 *
 * Idempotent: matches that already have card rows are skipped. Teams with
 * no players are skipped (can't attribute a card).
 *
 * Run: npx tsx scripts/backfill-cards.ts
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
    .select('id, tournament_id, home_team_id, away_team_id, status')
    .in('status', ['live', 'finished'])
  if (mErr) throw mErr

  // tournaments that already have ANY card → leave untouched
  const { data: existingCards, error: cErr } = await supabase
    .from('cards')
    .select('match_id')
  if (cErr) throw cErr
  const matchesWithCards = new Set((existingCards ?? []).map((c) => c.match_id))

  // tournament_id of every match that already has a card
  const matchTournament = new Map((matches ?? []).map((m) => [m.id, m.tournament_id]))
  const tournamentsWithCards = new Set(
    [...matchesWithCards].map((mid) => matchTournament.get(mid)).filter(Boolean),
  )

  // roster map: team_id -> player ids
  const { data: players, error: pErr } = await supabase.from('players').select('id, team_id')
  if (pErr) throw pErr
  const roster = new Map<string, string[]>()
  for (const p of players ?? []) {
    if (!roster.has(p.team_id)) roster.set(p.team_id, [])
    roster.get(p.team_id)!.push(p.id)
  }

  const rows: { match_id: string; team_id: string; player_id: string; card_type: string }[] = []
  let skippedTournament = 0

  for (const m of matches ?? []) {
    if (tournamentsWithCards.has(m.tournament_id)) { skippedTournament++; continue }
    for (const teamId of [m.home_team_id, m.away_team_id] as string[]) {
      const squad = roster.get(teamId)
      if (!squad || squad.length === 0) continue
      // 0-2 yellows + occasional red per team per match
      const yellows = Math.floor(Math.random() * 3)
      for (let i = 0; i < yellows; i++) {
        rows.push({ match_id: m.id, team_id: teamId, player_id: pick(squad), card_type: 'yellow' })
      }
      if (Math.random() < 0.12) {
        rows.push({ match_id: m.id, team_id: teamId, player_id: pick(squad), card_type: 'red' })
      }
    }
  }

  console.log(`matches scanned: ${matches?.length ?? 0}`)
  console.log(`skipped (tournament already has cards): ${skippedTournament}`)
  console.log(`card rows to insert: ${rows.length}`)

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await supabase.from('cards').insert(batch)
    if (error) throw error
    console.log(`  inserted ${Math.min(i + 500, rows.length)}/${rows.length}`)
  }
  console.log('✅ card backfill complete')
}

main().catch((e) => { console.error(e); process.exit(1) })
