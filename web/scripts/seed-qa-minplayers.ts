/**
 * Cleans up the old QA-flow tournaments and seeds 3 new ones that each exercise
 * an edge of the min_players_per_team HARD GATE. Run: npx tsx scripts/seed-qa-minplayers.ts
 * Idempotent — wipes prior "QA · ..." tournaments first.
 *
 * All 3 are SETUP Group->KO with teams already assigned to groups but NO fixtures,
 * so you can open each, go to Fixtures, click "Generate group fixtures", and watch
 * the gate fire (or pass). min_players_per_team uses the default (11).
 *
 *  T1 "QA · MP Under" — two teams BELOW 11 players. Generating fixtures must be
 *                       BLOCKED with an error naming "Short FC (7)" and "Thin FC (9)".
 *  T2 "QA · MP Exact" — every team has EXACTLY 11. Generating fixtures must SUCCEED
 *                       (boundary case passes).
 *  T3 "QA · MP Empty" — one team has 0 players. Generating fixtures must be BLOCKED
 *                       naming "Empty FC (0)".
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const START = '2026-06-01'
const END = '2026-06-30'

// Old disposable tournaments to remove, plus the 3 we (re)create here.
const TO_WIPE = [
  'QA · Edit Pairing', 'QA · Tie Break', 'QA · Reassign Warn',
  'QA · MP Under', 'QA · MP Exact', 'QA · MP Empty',
]

async function wipe(name: string) {
  const { data } = await sb.from('tournaments').select('id').eq('name', name)
  for (const row of data ?? []) await sb.from('tournaments').delete().eq('id', row.id)
}

async function makeTournament(name: string): Promise<string> {
  const { data, error } = await sb
    .from('tournaments')
    .insert({
      name, location: 'QA Pitch',
      start_date: START, end_date: END,
      format: 'round_robin_knockout',
      points_win: 3, points_draw: 1, points_loss: 0,
      minutes_per_half: 45, halftime_enabled: true, halftime_minutes: 15,
      num_groups: 2, teams_per_group: 4, advance_per_group: 2,
      knockout_start_round: 'semi', status: 'setup',
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error(`Failed to create ${name}:`, error)
    process.exit(1)
  }
  return data.id
}

// teamSpecs: [name, group_label, playerCount]
async function makeTeams(tournamentId: string, specs: Array<[string, string, number]>) {
  const { data, error } = await sb
    .from('teams')
    .insert(specs.map(([name, group_label]) => ({ name, group_label, tournament_id: tournamentId })))
    .select('id, name')
  if (error || !data) {
    console.error('Failed to create teams:', error)
    process.exit(1)
  }
  const countByName = new Map(specs.map(([name, , n]) => [name, n]))
  const players = data.flatMap((team) =>
    Array.from({ length: countByName.get(team.name) ?? 0 }, (_, i) => ({
      team_id: team.id, name: `${team.name} P${i + 1}`, jersey_number: i + 1,
    })),
  )
  if (players.length) {
    const { error: pErr } = await sb.from('players').insert(players)
    if (pErr) { console.error('Failed to create players:', pErr); process.exit(1) }
  }
}

async function run() {
  for (const n of TO_WIPE) await wipe(n)
  console.log('Wiped old QA tournaments.')

  // T1 — two under-strength teams -> generating fixtures must be BLOCKED
  {
    const id = await makeTournament('QA · MP Under')
    await makeTeams(id, [
      ['Alpha FC (11)', 'A', 11], ['Beta FC (11)', 'A', 11], ['Gamma FC (11)', 'A', 11], ['Short FC (7)', 'A', 7],
      ['Delta FC (11)', 'B', 11], ['Echo FC (11)', 'B', 11], ['Thin FC (9)', 'B', 9], ['Foxtrot FC (11)', 'B', 11],
    ])
    console.log(`T1 QA · MP Under  /admin/tournaments/${id}/rd-fixtures  (generate -> BLOCKED: Short FC (7), Thin FC (9))`)
  }

  // T2 — every team exactly 11 -> generating fixtures must SUCCEED
  {
    const id = await makeTournament('QA · MP Exact')
    await makeTeams(id, [
      ['Ace 11A', 'A', 11], ['Ace 11B', 'A', 11], ['Ace 11C', 'A', 11], ['Ace 11D', 'A', 11],
      ['Bee 11A', 'B', 11], ['Bee 11B', 'B', 11], ['Bee 11C', 'B', 11], ['Bee 11D', 'B', 11],
    ])
    console.log(`T2 QA · MP Exact  /admin/tournaments/${id}/rd-fixtures  (generate -> SUCCEEDS, boundary)`)
  }

  // T3 — one empty team (0 players) -> generating fixtures must be BLOCKED
  {
    const id = await makeTournament('QA · MP Empty')
    await makeTeams(id, [
      ['Red FC (11)', 'A', 11], ['Blue FC (11)', 'A', 11], ['Green FC (11)', 'A', 11], ['Empty FC (0)', 'A', 0],
      ['Cyan FC (11)', 'B', 11], ['Lime FC (11)', 'B', 11], ['Pink FC (11)', 'B', 11], ['Gold FC (11)', 'B', 11],
    ])
    console.log(`T3 QA · MP Empty  /admin/tournaments/${id}/rd-fixtures  (generate -> BLOCKED: Empty FC (0))`)
  }

  console.log('\n✅ Seeded 3 min-players edge-case tournaments.')
}

run().catch(console.error)
