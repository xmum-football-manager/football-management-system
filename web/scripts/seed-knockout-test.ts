/**
 * Seeds a complete round_robin_knockout tournament with all group matches finished.
 * Run: npx tsx scripts/seed-knockout-test.ts
 *
 * Reads teams + players from ../../players.csv (project root).
 * First 4 teams → Group A, next 4 → Group B.
 * All group matches created and set to finished.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

const TOURNAMENT_NAME = 'KO Test Runners'

function parseCsv(csv: string) {
  const [header, ...lines] = csv.trim().split('\n')
  const keys = header.split(',').map((k) => k.trim())
  return lines
    .filter((l) => l.trim())
    .map((line) => {
      const vals = line.split(',').map((v) => v.trim())
      return Object.fromEntries(keys.map((k, i) => [k, vals[i] ?? ''])) as Record<string, string>
    })
}

// Scores per group: each pair (i,j) plays once, [home, away]
const GROUP_SCORES: Record<string, [number, number]> = {
  '0-1': [3, 1],
  '0-2': [2, 0],
  '0-3': [1, 1],
  '1-2': [2, 2],
  '1-3': [4, 0],
  '2-3': [1, 2],
}

async function run() {
  // Load players.csv from project root
  const csvPath = resolve(__dirname, '../../players.csv')
  const rows = parseCsv(readFileSync(csvPath, 'utf-8'))

  // Group rows by team name (preserving order)
  const teamNames: string[] = []
  const playersByTeam: Record<string, typeof rows> = {}
  for (const row of rows) {
    const t = row.team
    if (!teamNames.includes(t)) teamNames.push(t)
    if (!playersByTeam[t]) playersByTeam[t] = []
    playersByTeam[t].push(row)
  }

  if (teamNames.length < 8) {
    console.error(`Need at least 8 teams in players.csv, found ${teamNames.length}`)
    process.exit(1)
  }

  const groupANames = teamNames.slice(0, 4)
  const groupBNames = teamNames.slice(4, 8)

  // Clean up previous run
  const { data: existing } = await supabase
    .from('tournaments')
    .select('id')
    .eq('name', TOURNAMENT_NAME)
    .maybeSingle()

  if (existing) {
    console.log(`Deleting existing "${TOURNAMENT_NAME}" tournament…`)
    await supabase.from('tournaments').delete().eq('id', existing.id)
  }

  // 1. Create tournament
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .insert({
      name: TOURNAMENT_NAME,
      start_date: '2026-01-01',
      end_date: '2026-01-31',
      format: 'round_robin_knockout',
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      minutes_per_half: 45,
      halftime_enabled: true,
      halftime_minutes: 15,
      num_groups: 2,
      teams_per_group: 4,
      advance_per_group: 2,
      knockout_start_round: 'semi',
      status: 'active',
    })
    .select('id')
    .single()

  if (tErr || !tournament) {
    console.error('Failed to create tournament:', tErr)
    process.exit(1)
  }
  const tournamentId = tournament!.id
  console.log(`Created tournament: ${TOURNAMENT_NAME} (${tournamentId})`)

  // 2. Create teams
  const teamDefs = [
    ...groupANames.map((name) => ({ name, group_label: 'A', tournament_id: tournamentId })),
    ...groupBNames.map((name) => ({ name, group_label: 'B', tournament_id: tournamentId })),
  ]

  const { data: teams, error: teamErr } = await supabase
    .from('teams')
    .insert(teamDefs)
    .select('id, name, group_label')

  if (teamErr || !teams) {
    console.error('Failed to create teams:', teamErr)
    process.exit(1)
  }
  console.log(`Created ${teams.length} teams`)

  // 3. Seed players from CSV
  const playerInserts = teams.flatMap((team) =>
    (playersByTeam[team.name] ?? []).map((p) => ({
      team_id: team.id,
      name: p.player_name,
      jersey_number: p.jersey_number ? Number(p.jersey_number) : null,
      position: p.position || null,
    })),
  )

  const { error: playerErr } = await supabase.from('players').insert(playerInserts)
  if (playerErr) {
    console.error('Failed to create players:', playerErr)
    process.exit(1)
  }
  console.log(`Created ${playerInserts.length} players`)

  // 4. Create and finish all group matches
  const groupA = teams.filter((t) => t.group_label === 'A')
  const groupB = teams.filter((t) => t.group_label === 'B')

  async function createGroupMatches(groupTeams: NonNullable<typeof teams>) {
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        const [homeGoals, awayGoals] = GROUP_SCORES[`${i}-${j}`] ?? [0, 0]
        const { error } = await supabase.from('matches').insert({
          tournament_id: tournamentId,
          home_team_id: groupTeams[i].id,
          away_team_id: groupTeams[j].id,
          phase: 'group',
          status: 'finished',
          home_score: homeGoals,
          away_score: awayGoals,
          match_time: null,
        })
        if (error) console.error(`Match error (${groupTeams[i].name} vs ${groupTeams[j].name}):`, error.message)
      }
    }
  }

  await createGroupMatches(groupA)
  await createGroupMatches(groupB)
  console.log('Created & finished all group matches')

  console.log('\n✅ Done! Tournament is ready.')
  console.log(`   Name: ${TOURNAMENT_NAME}`)
  console.log(`   ID:   ${tournamentId}`)
  console.log(`   URL:  /admin/tournaments/${tournamentId}/knockout`)
  console.log('\n   Group A:', groupANames.join(', '))
  console.log('   Group B:', groupBNames.join(', '))
  console.log('\n   Next: visit the Knockout tab, confirm 2 qualifiers per group (4 total), then build the bracket.')
}

run().catch(console.error)
