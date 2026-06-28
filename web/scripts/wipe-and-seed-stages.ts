/**
 * Wipes ALL tournament data then seeds 6 progressive GP→KO stage snapshots.
 * Run: npx tsx scripts/wipe-and-seed-stages.ts
 *
 * Stages:
 *  S1 "Stage · GP Started"      — group stage active, first round of matches playing
 *  S2 "Stage · GP Midway"       — group stage, half the matches finished
 *  S3 "Stage · GP Done"         — all group matches finished, qualifiers NOT yet confirmed
 *  S4 "Stage · KO Seeded"       — qualifiers confirmed, QF bracket seeded (scheduled)
 *  S5 "Stage · KO In Progress"  — QF done, SF in progress (1 live, 1 scheduled)
 *  S6 "Stage · Champion"        — all KO done, champion set
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const STAGE_NAMES = [
  'Stage · GP Started',
  'Stage · GP Midway',
  'Stage · GP Done',
  'Stage · KO Seeded',
  'Stage · KO In Progress',
  'Stage · Champion',
]

const START = '2026-06-01'
const END = '2026-06-30'
const SCHED_TIME = '2026-06-10T10:00:00Z'
const LIVE_START = new Date(Date.now() - 20 * 60 * 1000).toISOString() // 20 min ago
const FINISHED_START = '2026-06-15T09:00:00Z'

// ── helpers ──────────────────────────────────────────────────────────────────

async function wipeAll() {
  console.log('Wiping all tournament data…')
  // Delete in FK order — admin_audit_log references matches+tournaments, must go first
  const tables = ['admin_audit_log', 'goals', 'cards', 'matches', 'players', 'teams', 'tournaments']
  for (const t of tables) {
    const { error } = await sb.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error && !error.message.includes('does not exist')) {
      console.warn(`  wipe ${t}: ${error.message}`)
    }
  }
  console.log('  done.\n')
}

async function makeTournament(opts: Record<string, unknown>): Promise<string> {
  const { data, error } = await sb
    .from('tournaments')
    .insert({
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
      status: 'active',
      ...opts,
    })
    .select('id')
    .single()
  if (error || !data) { console.error('makeTournament:', error); process.exit(1) }
  return data.id
}

type Team = { id: string; name: string; group_label: string }

const TEAM_GROUPS = {
  A: ['Lions', 'Tigers', 'Bears', 'Wolves'],
  B: ['Eagles', 'Hawks', 'Falcons', 'Owls'],
}

async function makeTeams(tournamentId: string): Promise<Team[]> {
  const defs = Object.entries(TEAM_GROUPS).flatMap(([label, names]) =>
    names.map((name) => ({ name, group_label: label, tournament_id: tournamentId })),
  )
  const { data, error } = await sb.from('teams').insert(defs).select('id, name, group_label')
  if (error || !data) { console.error('makeTeams:', error); process.exit(1) }
  const teams = data as Team[]

  // 11 players per team
  const players = teams.flatMap((t) =>
    Array.from({ length: 11 }, (_, i) => ({
      team_id: t.id,
      name: `${t.name} P${i + 1}`,
      jersey_number: i + 1,
    })),
  )
  const { error: pe } = await sb.from('players').insert(players)
  if (pe) { console.error('players:', pe); process.exit(1) }
  return teams
}

// All possible match pairs within a group of 4 (6 matches)
function pairs(g: Team[]): [Team, Team][] {
  const out: [Team, Team][] = []
  for (let i = 0; i < g.length; i++)
    for (let j = i + 1; j < g.length; j++)
      out.push([g[i], g[j]])
  return out
}

// Clear standings: 0 wins all, 3 loses all, 1 beats 2&3, 2 beats 3
const GP_SCORES: [number, number][] = [
  [2, 0], // 0v1
  [2, 0], // 0v2
  [2, 0], // 0v3
  [1, 0], // 1v2
  [1, 0], // 1v3
  [1, 0], // 2v3
]

async function insertGroupMatch(
  tournamentId: string,
  home: Team,
  away: Team,
  score: [number, number] | null,
  opts: Record<string, unknown> = {},
) {
  const finished = score !== null
  const { error } = await sb.from('matches').insert({
    tournament_id: tournamentId,
    home_team_id: home.id,
    away_team_id: away.id,
    phase: 'group',
    status: finished ? 'finished' : 'scheduled',
    home_score: finished ? score![0] : 0,
    away_score: finished ? score![1] : 0,
    // DB constraints matches_finished_requires_started / matches_active_requires_match_time
    // need both set on a finished match.
    match_time: finished ? FINISHED_START : SCHED_TIME,
    ...(finished && { match_started_at: FINISHED_START }),
    ...opts,
  })
  if (error) console.warn(`  group match ${home.name} v ${away.name}: ${error.message}`)
}


async function insertKoMatch(
  tournamentId: string,
  home: Team | null,
  away: Team | null,
  round: string,
  status: 'scheduled' | 'live' | 'finished',
  score?: [number, number],
  winnerId?: string,
) {
  const { error } = await sb.from('matches').insert({
    tournament_id: tournamentId,
    home_team_id: home?.id ?? null,
    away_team_id: away?.id ?? null,
    phase: 'knockout',
    knockout_round: round,
    status,
    home_score: score?.[0] ?? 0,
    away_score: score?.[1] ?? 0,
    // DB constraints matches_finished_requires_started / matches_active_requires_match_time
    // need match_time + match_started_at set for any non-scheduled match.
    match_time: status === 'scheduled' ? SCHED_TIME : status === 'live' ? LIVE_START : FINISHED_START,
    match_started_at: status === 'live' ? LIVE_START : status === 'finished' ? FINISHED_START : null,
    second_half_started_at: status === 'live' ? null : status === 'finished' ? '2026-06-15T10:00:00Z' : null,
    winner_team_id: winnerId ?? null,
  })
  if (error) console.warn(`  ko ${round} ${home?.name ?? 'TBD'} v ${away?.name ?? 'TBD'}: ${error.message}`)
}

// ── stage builders ────────────────────────────────────────────────────────────

async function seedS1() {
  const id = await makeTournament({ name: 'Stage · GP Started' })
  const teams = await makeTeams(id)
  const gA = teams.filter((t) => t.group_label === 'A')
  const gB = teams.filter((t) => t.group_label === 'B')

  // First match in each group is live, rest scheduled
  const pA = pairs(gA)
  const pB = pairs(gB)
  await insertGroupMatch(id, pA[0][0], pA[0][1], null, { status: 'live', match_started_at: LIVE_START })
  for (const [h, a] of pA.slice(1)) await insertGroupMatch(id, h, a, null)
  await insertGroupMatch(id, pB[0][0], pB[0][1], null, { status: 'live', match_started_at: LIVE_START })
  for (const [h, a] of pB.slice(1)) await insertGroupMatch(id, h, a, null)

  console.log(`S1 Stage · GP Started      /admin/tournaments/${id}`)
}

async function seedS2() {
  const id = await makeTournament({ name: 'Stage · GP Midway' })
  const teams = await makeTeams(id)
  const gA = teams.filter((t) => t.group_label === 'A')
  const gB = teams.filter((t) => t.group_label === 'B')

  // First 3 matches finished, rest scheduled
  const pA = pairs(gA)
  const pB = pairs(gB)
  for (let i = 0; i < pA.length; i++) {
    const [h, a] = pA[i]
    await insertGroupMatch(id, h, a, i < 3 ? GP_SCORES[i] : null)
  }
  for (let i = 0; i < pB.length; i++) {
    const [h, a] = pB[i]
    await insertGroupMatch(id, h, a, i < 3 ? GP_SCORES[i] : null)
  }

  console.log(`S2 Stage · GP Midway       /admin/tournaments/${id}`)
}

async function seedS3() {
  const id = await makeTournament({ name: 'Stage · GP Done' })
  const teams = await makeTeams(id)
  const gA = teams.filter((t) => t.group_label === 'A')
  const gB = teams.filter((t) => t.group_label === 'B')

  for (let i = 0; i < 6; i++) {
    const [hA, aA] = pairs(gA)[i]
    const [hB, aB] = pairs(gB)[i]
    await insertGroupMatch(id, hA, aA, GP_SCORES[i])
    await insertGroupMatch(id, hB, aB, GP_SCORES[i])
  }

  console.log(`S3 Stage · GP Done         /admin/tournaments/${id}/knockout  (confirm qualifiers next)`)
}

async function seedS4() {
  const id = await makeTournament({ name: 'Stage · KO Seeded' })
  const teams = await makeTeams(id)
  const gA = teams.filter((t) => t.group_label === 'A')
  const gB = teams.filter((t) => t.group_label === 'B')

  for (let i = 0; i < 6; i++) {
    const [hA, aA] = pairs(gA)[i]
    const [hB, aB] = pairs(gB)[i]
    await insertGroupMatch(id, hA, aA, GP_SCORES[i])
    await insertGroupMatch(id, hB, aB, GP_SCORES[i])
  }

  // Qualifiers: top 2 per group (clear ranking: index 0 & 1)
  const quals = [gA[0].id, gA[1].id, gB[0].id, gB[1].id]
  await sb.from('tournaments').update({ knockout_qualifiers: quals }).eq('id', id)

  // Seed SF bracket: A1 v B2, A2 v B1
  await insertKoMatch(id, gA[0], gB[1], 'sf', 'scheduled')
  await insertKoMatch(id, gA[1], gB[0], 'sf', 'scheduled')

  console.log(`S4 Stage · KO Seeded       /admin/tournaments/${id}/knockout  (QF bracket set, matches scheduled)`)
}

async function seedS5() {
  const id = await makeTournament({ name: 'Stage · KO In Progress' })
  const teams = await makeTeams(id)
  const gA = teams.filter((t) => t.group_label === 'A')
  const gB = teams.filter((t) => t.group_label === 'B')

  for (let i = 0; i < 6; i++) {
    const [hA, aA] = pairs(gA)[i]
    const [hB, aB] = pairs(gB)[i]
    await insertGroupMatch(id, hA, aA, GP_SCORES[i])
    await insertGroupMatch(id, hB, aB, GP_SCORES[i])
  }

  const quals = [gA[0].id, gA[1].id, gB[0].id, gB[1].id]
  await sb.from('tournaments').update({ knockout_qualifiers: quals }).eq('id', id)

  // SF1 finished: gA[0] wins 2-1 over gB[1]
  await insertKoMatch(id, gA[0], gB[1], 'sf', 'finished', [2, 1], gA[0].id)
  // SF2 live: gA[1] vs gB[0], first half in progress
  await insertKoMatch(id, gA[1], gB[0], 'sf', 'live', undefined, undefined)

  console.log(`S5 Stage · KO In Progress  /admin/tournaments/${id}/knockout  (SF1 done, SF2 live)`)
}

async function seedS6() {
  const id = await makeTournament({ name: 'Stage · Champion' })
  const teams = await makeTeams(id)
  const gA = teams.filter((t) => t.group_label === 'A')
  const gB = teams.filter((t) => t.group_label === 'B')

  for (let i = 0; i < 6; i++) {
    const [hA, aA] = pairs(gA)[i]
    const [hB, aB] = pairs(gB)[i]
    await insertGroupMatch(id, hA, aA, GP_SCORES[i])
    await insertGroupMatch(id, hB, aB, GP_SCORES[i])
  }

  const quals = [gA[0].id, gA[1].id, gB[0].id, gB[1].id]
  await sb.from('tournaments').update({ knockout_qualifiers: quals }).eq('id', id)

  // Both SFs finished
  await insertKoMatch(id, gA[0], gB[1], 'sf', 'finished', [2, 1], gA[0].id)
  await insertKoMatch(id, gA[1], gB[0], 'sf', 'finished', [1, 3], gB[0].id)

  // Final: gA[0] vs gB[0], gA[0] wins
  await insertKoMatch(id, gA[0], gB[0], 'final', 'finished', [2, 0], gA[0].id)

  // Set champion on tournament
  await sb.from('tournaments').update({ champion_team_id: gA[0].id, status: 'completed' }).eq('id', id)

  console.log(`S6 Stage · Champion        /admin/tournaments/${id}  (${gA[0].name} is champion)`)
}

// ── main ──────────────────────────────────────────────────────────────────────

async function run() {
  await wipeAll()

  console.log('Seeding 6 stages…\n')
  await seedS1()
  await seedS2()
  await seedS3()
  await seedS4()
  await seedS5()
  await seedS6()

  console.log('\n✅ All 6 stages seeded.')
  console.log('   Visit /admin to see them in the tournament list.')
}

run().catch((e) => { console.error(e); process.exit(1) })
