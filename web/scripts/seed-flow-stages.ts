/**
 * Seeds one throwaway tournament per lifecycle stage so every screen in the
 * group -> knockout flow can be QA'd in its natural state.
 *
 * Run: npx tsx scripts/seed-flow-stages.ts
 * Idempotent — deletes any prior "Flow · ..." tournaments first.
 *
 * Each tournament is 2 groups of 4 (8 teams, 11 players each). Stages:
 *   01 Teams Added        — teams created, NOT assigned to groups, no fixtures
 *   02 Groups Assigned    — teams assigned A/B, no fixtures yet
 *   03 Group Fixtures      — group fixtures generated (all scheduled)
 *   04 Group Stage Live   — Group A finished, Group B part-played incl. a live match
 *   05 Group Stage Done   — all group matches finished, qualifiers NOT confirmed
 *   06 Qualifiers Set     — qualifiers confirmed, bracket NOT seeded
 *   07 Bracket Seeded     — semis + final created (all scheduled)
 *   08 Knockout Live      — one semi finished, one semi live, final awaiting
 *   09 Completed          — full bracket finished, champion decided
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
const MT = '2026-06-10T12:00:00Z' // within range, satisfies the match-time trigger

const GROUP_A = ['Red Lions FC', 'Blue Eagles', 'Green Tigers', 'Yellow Wolves']
const GROUP_B = ['Black Panthers', 'White Sharks', 'Orange Foxes', 'Purple Hawks']

type Team = { id: string; name: string; group_label: string | null }

// Clear ranking for a group of 4: team0 > team1 > team2 > team3 (top scorer is home, wins 1-0).
const CLEAR4: Record<string, [number, number]> = {
  '0-1': [1, 0], '0-2': [1, 0], '0-3': [1, 0], '1-2': [1, 0], '1-3': [1, 0], '2-3': [1, 0],
}

async function wipe(name: string) {
  const { data } = await sb.from('tournaments').select('id').eq('name', name)
  for (const row of data ?? []) await sb.from('tournaments').delete().eq('id', row.id)
}

async function makeTournament(name: string, status: 'setup' | 'active' | 'finished'): Promise<string> {
  const { data, error } = await sb
    .from('tournaments')
    .insert({
      name,
      location: 'Flow QA Pitch',
      start_date: START,
      end_date: END,
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
      status,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error(`Failed to create ${name}:`, error)
    process.exit(1)
  }
  return data.id
}

// assign=false -> teams created with no group_label (the "Teams Added" stage).
async function makeTeams(tournamentId: string, assign: boolean): Promise<Team[]> {
  const defs = [
    ...GROUP_A.map((name) => ({ name, group_label: assign ? 'A' : null, tournament_id: tournamentId })),
    ...GROUP_B.map((name) => ({ name, group_label: assign ? 'B' : null, tournament_id: tournamentId })),
  ]
  const { data, error } = await sb.from('teams').insert(defs).select('id, name, group_label')
  if (error || !data) {
    console.error('Failed to create teams:', error)
    process.exit(1)
  }
  const teams = data as Team[]
  // 11 players per team to satisfy min_players_per_team (default 11).
  const players = teams.flatMap((t) =>
    Array.from({ length: 11 }, (_, i) => ({ team_id: t.id, name: `${t.name} P${i + 1}`, jersey_number: i + 1 })),
  )
  const { error: pErr } = await sb.from('players').insert(players)
  if (pErr) {
    console.error('Failed to create players:', pErr)
    process.exit(1)
  }
  return teams
}

// Round-robin within one group. status decides scheduled vs finished;
// onlyFirst (live stage) leaves the trailing matches scheduled and marks one live.
async function groupMatches(
  tournamentId: string,
  teams: Team[],
  label: string,
  mode: 'finished' | 'scheduled' | 'live-mix',
) {
  const g = teams.filter((t) => t.group_label === label)
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) pairs.push([i, j])

  for (let p = 0; p < pairs.length; p++) {
    const [i, j] = pairs[p]
    const [hs, as_] = CLEAR4[`${i}-${j}`] ?? [0, 0]
    let status: string = mode === 'live-mix' ? 'scheduled' : mode
    let home = 0
    let away = 0
    let startedAt: string | null = null
    if (mode === 'finished') {
      home = hs; away = as_
      startedAt = '2026-06-15T09:00:00Z'
    } else if (mode === 'live-mix') {
      // First two pairs finished, third pair live, rest scheduled.
      if (p < 2) { status = 'finished'; home = hs; away = as_; startedAt = '2026-06-15T09:00:00Z' }
      else if (p === 2) { status = 'live'; home = 1; away = 1; startedAt = new Date(Date.now() - 30 * 60000).toISOString() }
    }
    const { error } = await sb.from('matches').insert({
      tournament_id: tournamentId,
      home_team_id: g[i].id,
      away_team_id: g[j].id,
      phase: 'group',
      status,
      home_score: home,
      away_score: away,
      // DB constraints matches_finished_requires_started / matches_active_requires_match_time
      // need match_time + match_started_at set for any non-scheduled match.
      match_time: status === 'scheduled' ? MT : startedAt,
      match_started_at: startedAt,
    })
    if (error) console.error(`  group ${g[i].name} v ${g[j].name}:`, error.message)
  }
  return g
}

// Insert a knockout match, return its id. Pass null team ids for TBD slots.
async function koMatch(fields: Record<string, unknown>): Promise<string> {
  // DB constraints matches_finished_requires_started / matches_active_requires_match_time
  // need both set for any non-scheduled match; default them, callers can still override.
  const status = fields.status as string | undefined
  const startedAt = status && status !== 'scheduled' ? '2026-06-15T09:00:00Z' : undefined
  const { data, error } = await sb
    .from('matches')
    .insert({
      phase: 'knockout',
      knockout_round: 'sf',
      ...(startedAt && { match_started_at: startedAt, match_time: startedAt }),
      ...fields,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('  knockout match failed:', error?.message)
    process.exit(1)
  }
  return data.id
}

const urls: string[] = []
function record(stage: string, id: string, note: string) {
  urls.push(`${stage.padEnd(20)} /admin/tournaments/${id}  — ${note}`)
}

// Confirmed top-2 per group, cross-paired for the semis: A0 vs B1, B0 vs A1.
function semiPairs(teams: Team[]) {
  const a = teams.filter((t) => t.group_label === 'A')
  const b = teams.filter((t) => t.group_label === 'B')
  return { a, b, qualifiers: [a[0].id, b[1].id, b[0].id, a[1].id] }
}

async function run() {
  for (let s = 1; s <= 9; s++) await wipe(`Flow · ${String(s).padStart(2, '0')} ${STAGE_NAMES[s - 1]}`)

  // 01 Teams Added
  {
    const name = 'Flow · 01 Teams Added'
    const id = await makeTournament(name, 'setup')
    await makeTeams(id, false)
    record(name, id, '8 teams, unassigned to groups')
  }

  // 02 Groups Assigned
  {
    const name = 'Flow · 02 Groups Assigned'
    const id = await makeTournament(name, 'setup')
    await makeTeams(id, true)
    record(name, id, 'teams in groups A/B, no fixtures')
  }

  // 03 Group Fixtures generated (all scheduled)
  {
    const name = 'Flow · 03 Group Fixtures'
    const id = await makeTournament(name, 'setup')
    const teams = await makeTeams(id, true)
    await groupMatches(id, teams, 'A', 'scheduled')
    await groupMatches(id, teams, 'B', 'scheduled')
    record(name, id, '12 group fixtures, all scheduled')
  }

  // 04 Group Stage Live
  {
    const name = 'Flow · 04 Group Stage Live'
    const id = await makeTournament(name, 'active')
    const teams = await makeTeams(id, true)
    await groupMatches(id, teams, 'A', 'finished')
    await groupMatches(id, teams, 'B', 'live-mix')
    record(name, id, 'Group A done, Group B has a live match')
  }

  // 05 Group Stage Done (qualifiers NOT confirmed)
  {
    const name = 'Flow · 05 Group Stage Done'
    const id = await makeTournament(name, 'active')
    const teams = await makeTeams(id, true)
    await groupMatches(id, teams, 'A', 'finished')
    await groupMatches(id, teams, 'B', 'finished')
    record(name, id, 'all group matches finished, qualifiers not yet confirmed')
  }

  // 06 Qualifiers Set (bracket NOT seeded)
  {
    const name = 'Flow · 06 Qualifiers Set'
    const id = await makeTournament(name, 'active')
    const teams = await makeTeams(id, true)
    await groupMatches(id, teams, 'A', 'finished')
    await groupMatches(id, teams, 'B', 'finished')
    const { qualifiers } = semiPairs(teams)
    await sb.from('tournaments').update({ knockout_qualifiers: qualifiers }).eq('id', id)
    record(name, id, '4 qualifiers confirmed, bracket not built')
  }

  // 07 Bracket Seeded (semis + final, all scheduled)
  {
    const name = 'Flow · 07 Bracket Seeded'
    const id = await makeTournament(name, 'active')
    const teams = await makeTeams(id, true)
    await groupMatches(id, teams, 'A', 'finished')
    await groupMatches(id, teams, 'B', 'finished')
    const { a, b, qualifiers } = semiPairs(teams)
    await sb.from('tournaments').update({ knockout_qualifiers: qualifiers }).eq('id', id)
    const sf1 = await koMatch({ tournament_id: id, home_team_id: a[0].id, away_team_id: b[1].id, status: 'scheduled', home_score: 0, away_score: 0, match_time: MT })
    const sf2 = await koMatch({ tournament_id: id, home_team_id: b[0].id, away_team_id: a[1].id, status: 'scheduled', home_score: 0, away_score: 0, match_time: MT })
    await koMatch({ tournament_id: id, knockout_round: 'final', home_team_id: null, away_team_id: null, status: 'scheduled', home_score: 0, away_score: 0, match_time: MT, home_source_match_id: sf1, away_source_match_id: sf2 })
    record(name, id, 'semis + final scheduled (final TBD)')
  }

  // 08 Knockout Live (one semi finished, one semi live)
  {
    const name = 'Flow · 08 Knockout Live'
    const id = await makeTournament(name, 'active')
    const teams = await makeTeams(id, true)
    await groupMatches(id, teams, 'A', 'finished')
    await groupMatches(id, teams, 'B', 'finished')
    const { a, b, qualifiers } = semiPairs(teams)
    await sb.from('tournaments').update({ knockout_qualifiers: qualifiers }).eq('id', id)
    // sf1 finished: a0 beats b1. sf2 live. final's home slot filled with sf1 winner.
    const sf1 = await koMatch({ tournament_id: id, home_team_id: a[0].id, away_team_id: b[1].id, status: 'finished', home_score: 2, away_score: 1, winner_team_id: a[0].id })
    const sf2 = await koMatch({ tournament_id: id, home_team_id: b[0].id, away_team_id: a[1].id, status: 'live', home_score: 1, away_score: 1, match_started_at: new Date(Date.now() - 25 * 60000).toISOString() })
    await koMatch({ tournament_id: id, knockout_round: 'final', home_team_id: a[0].id, away_team_id: null, status: 'scheduled', home_score: 0, away_score: 0, match_time: MT, home_source_match_id: sf1, away_source_match_id: sf2 })
    record(name, id, 'semi 1 finished, semi 2 live, final awaiting')
  }

  // 09 Completed (champion decided)
  {
    const name = 'Flow · 09 Completed'
    const id = await makeTournament(name, 'finished')
    const teams = await makeTeams(id, true)
    await groupMatches(id, teams, 'A', 'finished')
    await groupMatches(id, teams, 'B', 'finished')
    const { a, b, qualifiers } = semiPairs(teams)
    await sb.from('tournaments').update({ knockout_qualifiers: qualifiers }).eq('id', id)
    const sf1 = await koMatch({ tournament_id: id, home_team_id: a[0].id, away_team_id: b[1].id, status: 'finished', home_score: 2, away_score: 1, winner_team_id: a[0].id })
    const sf2 = await koMatch({ tournament_id: id, home_team_id: b[0].id, away_team_id: a[1].id, status: 'finished', home_score: 0, away_score: 1, winner_team_id: a[1].id })
    await koMatch({ tournament_id: id, knockout_round: 'final', home_team_id: a[0].id, away_team_id: a[1].id, status: 'finished', home_score: 3, away_score: 1, winner_team_id: a[0].id, home_source_match_id: sf1, away_source_match_id: sf2 })
    record(name, id, `champion: ${a[0].name}`)
  }

  console.log('\n✅ Seeded 9 flow-stage tournaments:\n')
  for (const u of urls) console.log('  ' + u)
  console.log('')
}

const STAGE_NAMES = [
  'Teams Added', 'Groups Assigned', 'Group Fixtures', 'Group Stage Live', 'Group Stage Done',
  'Qualifiers Set', 'Bracket Seeded', 'Knockout Live', 'Completed',
]

run().catch(console.error)
