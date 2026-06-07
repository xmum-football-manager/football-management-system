/**
 * Seeds example tournaments covering every format/status/lifecycle scenario.
 * DELETES ALL EXISTING TOURNAMENTS first (teams/players/matches cascade).
 *
 * Run: set -a && source .env.local && set +a && npx tsx scripts/seed-example-tournaments.ts
 *
 * All dates are relative to "today" so live/active tournaments always render
 * correctly no matter when the script is run.
 *
 * Scenarios:
 *  1. Spring Invitational    round_robin          finished  full league table
 *  2. Campus League          round_robin          active    finished + live + halftime + scheduled + unscheduled
 *  3. Freshers Cup           round_robin          setup     future, no fixtures, one under-roster team
 *  4. Knockout Masters       knockout             finished  QF→SF→Final, champion
 *  5. Lightning Cup          knockout             active    QFs done, one SF live, final TBD
 *  6. Inter-Faculty Champ.   round_robin_knockout active    4 groups × 4 (top_8), group stage in progress
 *  7. Uni Champions Trophy   round_robin_knockout active    groups done, qualifiers set, SFs done, final scheduled
 *  8. Founders Cup           round_robin_knockout finished  groups + knockout complete, champion
 *  9. Derby Showdown         round_robin_knockout active    knockout_start_round 'final', groups done, final tonight
 * 10. Legacy Cup 2025        round_robin          archived  old archived tournament
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date()

/** Date string (YYYY-MM-DD, UTC) offset by `days` from today. */
function d(days: number): string {
  const dt = new Date(NOW)
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().split('T')[0]
}

/** ISO timestamp at `days` offset from today, at hh:mm UTC. */
function ts(days: number, hour: number, minute = 0): string {
  return `${d(days)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`
}

/** Deterministic PRNG so reruns produce identical data. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(42)

const GOAL_WEIGHTS = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5]
function groupScore(): [number, number] {
  return [
    GOAL_WEIGHTS[Math.floor(rng() * GOAL_WEIGHTS.length)],
    GOAL_WEIGHTS[Math.floor(rng() * GOAL_WEIGHTS.length)],
  ]
}
/** Knockout matches need a winner — no draws. */
function koScore(): [number, number] {
  const [h, a] = groupScore()
  if (h !== a) return [h, a]
  return rng() < 0.5 ? [h + 1, a] : [h, a + 1]
}

const FIRST_NAMES = [
  'James', 'Wei', 'Ahmad', 'Daniel', 'Hao', 'Marcus', 'Arif', 'Ryan', 'Jun', 'Omar',
  'Lucas', 'Zhi', 'Hafiz', 'Ethan', 'Ming', 'Aiman', 'Noah', 'Kai', 'Farhan', 'Leo',
  'Adam', 'Yusuf', 'Chen', 'Dylan', 'Iqbal', 'Aaron', 'Feng', 'Zikri', 'Oscar', 'Tariq',
  'Ben', 'Xander', 'Imran', 'Felix', 'Joon', 'Amir', 'Caleb', 'Ren', 'Idris', 'Sam',
]
const LAST_NAMES = [
  'Tan', 'Lim', 'Lee', 'Wong', 'Ng', 'Rahman', 'Ismail', 'Chen', 'Khan', 'Yusof',
  'Ong', 'Goh', 'Abdullah', 'Teo', 'Chia', 'Hassan', 'Liu', 'Zhang', 'Aziz', 'Low',
  'Yap', 'Chong', 'Ali', 'Koh', 'Sim', 'Bakar', 'Wang', 'Hashim', 'Toh', 'Cheah',
  'Foo', 'Salleh', 'Gan', 'Omar', 'Chua', 'Kamal', 'Ho', 'Musa', 'Seah', 'Zain',
]
const POSITIONS = [
  'Goalkeeper',
  'Defender', 'Defender', 'Defender', 'Defender',
  'Midfielder', 'Midfielder', 'Midfielder', 'Midfielder',
  'Forward', 'Forward',
  'Defender', 'Midfielder', 'Forward', // extras for rosters > 11
]

let playerCounter = 0
function rosterFor(teamId: string, size: number) {
  return Array.from({ length: size }, (_, i) => {
    const n = playerCounter++
    return {
      team_id: teamId,
      name: `${FIRST_NAMES[(n * 7 + 3) % FIRST_NAMES.length]} ${LAST_NAMES[(n * 11 + 5) % LAST_NAMES.length]}`,
      jersey_number: i + 1,
      position: POSITIONS[i % POSITIONS.length],
    }
  })
}

interface TeamRow {
  id: string
  name: string
  group_label: string | null
}

/** Insert teams (+ rosters) and return rows keyed in input order. */
async function createTeams(
  tournamentId: string,
  defs: { name: string; group_label?: string }[],
  rosterSizes?: Record<string, number>,
): Promise<TeamRow[]> {
  const { data, error } = await supabase
    .from('teams')
    .insert(defs.map((t) => ({ tournament_id: tournamentId, name: t.name, group_label: t.group_label ?? null })))
    .select('id, name, group_label')
  if (error || !data) throw new Error(`teams: ${error?.message}`)
  const byName = new Map(data.map((t) => [t.name, t as TeamRow]))
  const ordered = defs.map((t) => byName.get(t.name)!)
  const players = ordered.flatMap((t) => rosterFor(t.id, rosterSizes?.[t.name] ?? 11 + (playerCounter % 3)))
  const { error: pErr } = await supabase.from('players').insert(players)
  if (pErr) throw new Error(`players: ${pErr.message}`)
  return ordered
}

interface MatchInsert {
  tournament_id: string
  home_team_id: string
  away_team_id: string
  match_time: string | null
  status: 'scheduled' | 'live' | 'halftime' | 'finished'
  home_score?: number
  away_score?: number
  phase?: 'group' | 'knockout'
  knockout_round?: 'r32' | 'r16' | 'qf' | 'sf' | 'final'
  match_started_at?: string
  match_finished_at?: string
}

function finished(base: Omit<MatchInsert, 'status'>, h: number, a: number): MatchInsert {
  const started = base.match_time
  const finishedAt = base.match_time
    ? new Date(new Date(base.match_time).getTime() + 105 * 60_000).toISOString()
    : undefined
  return {
    ...base,
    status: 'finished',
    home_score: h,
    away_score: a,
    ...(started && { match_started_at: started }),
    ...(finishedAt && { match_finished_at: finishedAt }),
  }
}

async function insertMatches(rows: MatchInsert[]): Promise<{ id: string }[]> {
  // Bulk inserts send null for keys missing on a row, so fill NOT NULL score defaults.
  const filled = rows.map((r) => ({ ...r, home_score: r.home_score ?? 0, away_score: r.away_score ?? 0 }))
  const { data, error } = await supabase.from('matches').insert(filled).select('id')
  if (error || !data) throw new Error(`matches: ${error?.message}`)
  return data
}

/** All unique pairings (single round robin), home/away alternating a bit. */
function roundRobinPairs(teams: TeamRow[]): [TeamRow, TeamRow][] {
  const pairs: [TeamRow, TeamRow][] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      pairs.push((i + j) % 2 === 0 ? [teams[i], teams[j]] : [teams[j], teams[i]])
    }
  }
  return pairs
}

/** Compute group standings from finished results to pick coherent qualifiers. */
function topOfGroup(
  teams: TeamRow[],
  results: { home: TeamRow; away: TeamRow; h: number; a: number }[],
  count: number,
): TeamRow[] {
  const table = new Map(teams.map((t) => [t.id, { team: t, pts: 0, gd: 0, gs: 0 }]))
  for (const r of results) {
    const home = table.get(r.home.id)!
    const away = table.get(r.away.id)!
    home.gd += r.h - r.a
    away.gd += r.a - r.h
    home.gs += r.h
    away.gs += r.a
    if (r.h > r.a) home.pts += 3
    else if (r.h < r.a) away.pts += 3
    else {
      home.pts += 1
      away.pts += 1
    }
  }
  return [...table.values()]
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gs - x.gs || x.team.name.localeCompare(y.team.name))
    .slice(0, count)
    .map((e) => e.team)
}

async function createTournament(row: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      points_win: 3,
      points_draw: 1,
      points_loss: 0,
      minutes_per_half: 45,
      halftime_enabled: true,
      halftime_minutes: 15,
      ...row,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`tournament "${row.name}": ${error?.message}`)
  return data.id
}

const created: { name: string; id: string; note: string }[] = []

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function springInvitational() {
  const id = await createTournament({
    name: 'Spring Invitational 2026',
    description: 'Six-team invitational league. Every team plays each other once.',
    location: 'XMUM Main Field',
    start_date: d(-34),
    end_date: d(-20),
    format: 'round_robin',
    status: 'finished',
  })
  const teams = await createTeams(id, [
    { name: 'Red Dragons' }, { name: 'Harbour City FC' }, { name: 'Northside United' },
    { name: 'Lakeside Rovers' }, { name: 'Golden Eagles' }, { name: 'Thunder FC' },
  ])
  const pairs = roundRobinPairs(teams)
  const rows = pairs.map(([home, away], i) => {
    // Force some notable results: a 0-0 stalemate and a 7-1 thrashing.
    const [h, a] = i === 2 ? [0, 0] : i === 5 ? [7, 1] : groupScore()
    return finished(
      {
        tournament_id: id,
        home_team_id: home.id,
        away_team_id: away.id,
        match_time: ts(-33 + Math.floor(i / 2), i % 2 === 0 ? 16 : 18),
      },
      h, a,
    )
  })
  await insertMatches(rows)
  created.push({ name: 'Spring Invitational 2026', id, note: 'round_robin · finished · full table' })
}

async function campusLeague() {
  const id = await createTournament({
    name: 'Campus League 2026',
    description: 'The flagship campus league — live matchdays every week.',
    location: 'XMUM Stadium',
    start_date: d(-6),
    end_date: d(7),
    format: 'round_robin',
    status: 'active',
  })
  const teams = await createTeams(id, [
    { name: 'Coastal Athletic' }, { name: 'Iron Wolves' }, { name: 'Crimson Tide FC' },
    { name: 'Silver Hawks' }, { name: 'Royal Falcons' }, { name: 'Storm Riders' },
  ])
  const pairs = roundRobinPairs(teams) // 15 matches
  const rows: MatchInsert[] = []
  pairs.forEach(([home, away], i) => {
    const base = { tournament_id: id, home_team_id: home.id, away_team_id: away.id }
    if (i < 7) {
      // Played over the past week.
      const [h, a] = groupScore()
      rows.push(finished({ ...base, match_time: ts(-6 + i, i % 2 === 0 ? 17 : 19) }, h, a))
    } else if (i === 7) {
      // Live right now, kicked off 25 minutes ago.
      rows.push({
        ...base,
        match_time: ts(0, NOW.getUTCHours(), NOW.getUTCMinutes()),
        status: 'live',
        home_score: 1,
        away_score: 0,
        match_started_at: new Date(NOW.getTime() - 25 * 60_000).toISOString(),
      })
    } else if (i === 8) {
      // At halftime, kicked off ~50 minutes ago.
      rows.push({
        ...base,
        match_time: ts(0, NOW.getUTCHours(), NOW.getUTCMinutes()),
        status: 'halftime',
        home_score: 1,
        away_score: 1,
        match_started_at: new Date(NOW.getTime() - 50 * 60_000).toISOString(),
      })
    } else if (i < 13) {
      // Scheduled over the coming days.
      rows.push({ ...base, match_time: ts(i - 8, i % 2 === 0 ? 17 : 19, 30), status: 'scheduled' })
    } else {
      // Not yet scheduled.
      rows.push({ ...base, match_time: null, status: 'scheduled' })
    }
  })
  await insertMatches(rows)
  created.push({ name: 'Campus League 2026', id, note: 'round_robin · active · live + halftime + unscheduled' })
}

async function freshersCup() {
  const id = await createTournament({
    name: 'Freshers Cup 2026',
    description: 'Intake-week tournament for new students. Fixtures to be drawn.',
    location: 'Training Pitch 2',
    start_date: d(20),
    end_date: d(31),
    format: 'round_robin',
    status: 'setup',
  })
  await createTeams(
    id,
    [{ name: 'Freshers United' }, { name: 'Hall A Hotshots' }, { name: 'Hall B Strikers' }, { name: 'Newbies XI' }],
    { 'Newbies XI': 5 }, // under the 11-player minimum — tests roster warnings
  )
  created.push({ name: 'Freshers Cup 2026', id, note: 'round_robin · setup · no fixtures, one short roster' })
}

/** Builds a full single-elimination bracket from `teams` (8), finishing rounds up to `playedRounds`. */
async function knockoutMasters() {
  const id = await createTournament({
    name: 'Knockout Masters',
    description: 'Straight knockout — lose and you are out.',
    location: 'XMUM Main Field',
    start_date: d(-27),
    end_date: d(-21),
    format: 'knockout',
    status: 'finished',
    penalty_shootout_enabled: true,
  })
  const teams = await createTeams(id, [
    { name: 'Blaze FC' }, { name: 'Viper SC' }, { name: 'Granite United' }, { name: 'Phoenix Rising' },
    { name: 'Wolfpack FC' }, { name: 'Titan Athletic' }, { name: 'Comet Rangers' }, { name: 'Avalanche XI' },
  ])
  // Quarterfinals
  const qfResults: { winner: TeamRow; row: MatchInsert }[] = []
  for (let i = 0; i < 4; i++) {
    const home = teams[i * 2]
    const away = teams[i * 2 + 1]
    const [h, a] = koScore()
    qfResults.push({
      winner: h > a ? home : away,
      row: finished(
        {
          tournament_id: id, home_team_id: home.id, away_team_id: away.id,
          match_time: ts(-27 + Math.floor(i / 2), i % 2 === 0 ? 16 : 18, 30),
          phase: 'knockout', knockout_round: 'qf',
        },
        h, a,
      ),
    })
  }
  // Semifinals from QF winners
  const sfResults: { winner: TeamRow; row: MatchInsert }[] = []
  for (let i = 0; i < 2; i++) {
    const home = qfResults[i * 2].winner
    const away = qfResults[i * 2 + 1].winner
    const [h, a] = koScore()
    sfResults.push({
      winner: h > a ? home : away,
      row: finished(
        {
          tournament_id: id, home_team_id: home.id, away_team_id: away.id,
          match_time: ts(-24, i === 0 ? 16 : 18, 30),
          phase: 'knockout', knockout_round: 'sf',
        },
        h, a,
      ),
    })
  }
  // Final
  const [h, a] = koScore()
  const finalRow = finished(
    {
      tournament_id: id, home_team_id: sfResults[0].winner.id, away_team_id: sfResults[1].winner.id,
      match_time: ts(-21, 19),
      phase: 'knockout', knockout_round: 'final',
    },
    h, a,
  )
  await insertMatches([...qfResults.map((r) => r.row), ...sfResults.map((r) => r.row), finalRow])
  const champion = h > a ? sfResults[0].winner.name : sfResults[1].winner.name
  created.push({ name: 'Knockout Masters', id, note: `knockout · finished · champion: ${champion}` })
}

async function lightningCup() {
  const id = await createTournament({
    name: 'Lightning Cup',
    description: 'Rapid-fire knockout weekend. Semifinals under way.',
    location: 'XMUM Stadium',
    start_date: d(-2),
    end_date: d(2),
    format: 'knockout',
    status: 'active',
  })
  const teams = await createTeams(id, [
    { name: 'Volt FC' }, { name: 'Tempest United' }, { name: 'Rapid SC' }, { name: 'Cyclone XI' },
    { name: 'Bolt Rangers' }, { name: 'Surge Athletic' }, { name: 'Flash Rovers' }, { name: 'Static FC' },
  ])
  // QFs all finished over the past two days.
  const qfWinners: TeamRow[] = []
  const rows: MatchInsert[] = []
  for (let i = 0; i < 4; i++) {
    const home = teams[i * 2]
    const away = teams[i * 2 + 1]
    const [h, a] = koScore()
    qfWinners.push(h > a ? home : away)
    rows.push(
      finished(
        {
          tournament_id: id, home_team_id: home.id, away_team_id: away.id,
          match_time: ts(-2 + Math.floor(i / 2), i % 2 === 0 ? 15 : 17, 30),
          phase: 'knockout', knockout_round: 'qf',
        },
        h, a,
      ),
    )
  }
  // SF1 finished this morning; SF2 live right now. Final not created yet (TBD).
  const [h1, a1] = koScore()
  rows.push(
    finished(
      {
        tournament_id: id, home_team_id: qfWinners[0].id, away_team_id: qfWinners[1].id,
        match_time: ts(0, 10),
        phase: 'knockout', knockout_round: 'sf',
      },
      h1, a1,
    ),
  )
  rows.push({
    tournament_id: id,
    home_team_id: qfWinners[2].id,
    away_team_id: qfWinners[3].id,
    match_time: ts(0, NOW.getUTCHours(), NOW.getUTCMinutes()),
    status: 'live',
    home_score: 0,
    away_score: 0,
    match_started_at: new Date(NOW.getTime() - 15 * 60_000).toISOString(),
    phase: 'knockout',
    knockout_round: 'sf',
  })
  await insertMatches(rows)
  created.push({ name: 'Lightning Cup', id, note: 'knockout · active · SF live, final TBD' })
}

async function interFacultyChampionship() {
  const id = await createTournament({
    name: 'Inter-Faculty Championship',
    description: '16 faculties, 4 groups, top two advance to the quarterfinals.',
    location: 'XMUM Sports Complex',
    start_date: d(-5),
    end_date: d(14),
    format: 'round_robin_knockout',
    status: 'active',
    num_groups: 4,
    teams_per_group: 4,
    advance_per_group: 2,
    knockout_start_round: 'top_8',
  })
  const facultyNames = [
    'Engineering FC', 'Computer Science FC', 'Business United', 'Medics FC',
    'Law Lions', 'Economics XI', 'Architecture FC', 'Mathematics United',
    'Physics Rangers', 'Chemistry City', 'Biology Rovers', 'Arts & Design FC',
    'Psychology Athletic', 'Education Town', 'Music Wanderers', 'Philosophy County',
  ]
  const teams = await createTeams(
    id,
    facultyNames.map((name, i) => ({ name, group_label: String.fromCharCode(65 + Math.floor(i / 4)) })),
  )
  const rows: MatchInsert[] = []
  for (let g = 0; g < 4; g++) {
    const group = teams.slice(g * 4, g * 4 + 4)
    const pairs = roundRobinPairs(group) // 6 per group
    pairs.forEach(([home, away], i) => {
      const base = { tournament_id: id, home_team_id: home.id, away_team_id: away.id, phase: 'group' as const }
      if (i < 3) {
        const [h, a] = groupScore()
        rows.push(finished({ ...base, match_time: ts(-5 + i, 16 + g) }, h, a))
      } else if (i < 5) {
        rows.push({ ...base, match_time: ts(i - 2, 16 + g), status: 'scheduled' })
      } else {
        rows.push({ ...base, match_time: null, status: 'scheduled' })
      }
    })
  }
  await insertMatches(rows)
  created.push({ name: 'Inter-Faculty Championship', id, note: '4 groups × 4 · group stage in progress' })
}

async function championsTrophy() {
  const id = await createTournament({
    name: 'University Champions Trophy',
    description: 'Two groups of four, semifinals decided — the final awaits.',
    location: 'XMUM Stadium',
    start_date: d(-6),
    end_date: d(3),
    format: 'round_robin_knockout',
    status: 'active',
    num_groups: 2,
    teams_per_group: 4,
    advance_per_group: 2,
    knockout_start_round: 'semi',
  })
  const teams = await createTeams(id, [
    { name: 'Summit FC', group_label: 'A' }, { name: 'Ridgeline United', group_label: 'A' },
    { name: 'Cascade Rovers', group_label: 'A' }, { name: 'Pinnacle SC', group_label: 'A' },
    { name: 'Horizon Athletic', group_label: 'B' }, { name: 'Meridian FC', group_label: 'B' },
    { name: 'Equator XI', group_label: 'B' }, { name: 'Zenith Town', group_label: 'B' },
  ])
  const groupA = teams.slice(0, 4)
  const groupB = teams.slice(4, 8)

  const rows: MatchInsert[] = []
  const results: Record<'A' | 'B', { home: TeamRow; away: TeamRow; h: number; a: number }[]> = { A: [], B: [] }
  const groups: Array<['A' | 'B', TeamRow[]]> = [['A', groupA], ['B', groupB]]
  for (const [label, group] of groups) {
    roundRobinPairs(group).forEach(([home, away], i) => {
      const [h, a] = groupScore()
      results[label].push({ home, away, h, a })
      rows.push(
        finished(
          {
            tournament_id: id, home_team_id: home.id, away_team_id: away.id,
            match_time: ts(-6 + i, label === 'A' ? 16 : 18),
            phase: 'group',
          },
          h, a,
        ),
      )
    })
  }
  const [a1, a2] = topOfGroup(groupA, results.A, 2)
  const [b1, b2] = topOfGroup(groupB, results.B, 2)

  // Semifinals finished yesterday: A1 vs B2, B1 vs A2 (matches qualifier slot order).
  const sfWinners: TeamRow[] = []
  for (const [i, [home, away]] of ([[a1, b2], [b1, a2]] as const).entries()) {
    const [h, a] = koScore()
    sfWinners.push(h > a ? home : away)
    rows.push(
      finished(
        {
          tournament_id: id, home_team_id: home.id, away_team_id: away.id,
          match_time: ts(-1, i === 0 ? 16 : 18, 30),
          phase: 'knockout', knockout_round: 'sf',
        },
        h, a,
      ),
    )
  }
  // Final scheduled tomorrow evening.
  rows.push({
    tournament_id: id,
    home_team_id: sfWinners[0].id,
    away_team_id: sfWinners[1].id,
    match_time: ts(1, 19),
    status: 'scheduled',
    phase: 'knockout',
    knockout_round: 'final',
  })
  await insertMatches(rows)
  await supabase.from('tournaments').update({ knockout_qualifiers: [a1.id, b2.id, b1.id, a2.id] }).eq('id', id)
  created.push({ name: 'University Champions Trophy', id, note: 'groups done · SFs done · final scheduled' })
}

async function foundersCup() {
  const id = await createTournament({
    name: 'Founders Cup',
    description: 'The traditional season opener — groups into semifinals.',
    location: 'XMUM Main Field',
    start_date: d(-34),
    end_date: d(-22),
    format: 'round_robin_knockout',
    status: 'finished',
    num_groups: 2,
    teams_per_group: 4,
    advance_per_group: 2,
    knockout_start_round: 'semi',
  })
  const teams = await createTeams(id, [
    { name: 'Heritage FC', group_label: 'A' }, { name: 'Pioneer United', group_label: 'A' },
    { name: 'Founders XI', group_label: 'A' }, { name: 'Legacy Rovers', group_label: 'A' },
    { name: 'Tradition SC', group_label: 'B' }, { name: 'Vanguard FC', group_label: 'B' },
    { name: 'Charter Athletic', group_label: 'B' }, { name: 'Crest Rangers', group_label: 'B' },
  ])
  const groupA = teams.slice(0, 4)
  const groupB = teams.slice(4, 8)

  const rows: MatchInsert[] = []
  const results: Record<'A' | 'B', { home: TeamRow; away: TeamRow; h: number; a: number }[]> = { A: [], B: [] }
  const groups: Array<['A' | 'B', TeamRow[]]> = [['A', groupA], ['B', groupB]]
  for (const [label, group] of groups) {
    roundRobinPairs(group).forEach(([home, away], i) => {
      const [h, a] = groupScore()
      results[label].push({ home, away, h, a })
      rows.push(
        finished(
          {
            tournament_id: id, home_team_id: home.id, away_team_id: away.id,
            match_time: ts(-34 + i, label === 'A' ? 16 : 18),
            phase: 'group',
          },
          h, a,
        ),
      )
    })
  }
  const [a1, a2] = topOfGroup(groupA, results.A, 2)
  const [b1, b2] = topOfGroup(groupB, results.B, 2)

  const sfWinners: TeamRow[] = []
  for (const [i, [home, away]] of ([[a1, b2], [b1, a2]] as const).entries()) {
    const [h, a] = koScore()
    sfWinners.push(h > a ? home : away)
    rows.push(
      finished(
        {
          tournament_id: id, home_team_id: home.id, away_team_id: away.id,
          match_time: ts(-25, i === 0 ? 16 : 18, 30),
          phase: 'knockout', knockout_round: 'sf',
        },
        h, a,
      ),
    )
  }
  const [h, a] = koScore()
  rows.push(
    finished(
      {
        tournament_id: id, home_team_id: sfWinners[0].id, away_team_id: sfWinners[1].id,
        match_time: ts(-22, 19),
        phase: 'knockout', knockout_round: 'final',
      },
      h, a,
    ),
  )
  await insertMatches(rows)
  await supabase.from('tournaments').update({ knockout_qualifiers: [a1.id, b2.id, b1.id, a2.id] }).eq('id', id)
  const champion = h > a ? sfWinners[0].name : sfWinners[1].name
  created.push({ name: 'Founders Cup', id, note: `groups + knockout complete · champion: ${champion}` })
}

async function derbyShowdown() {
  const id = await createTournament({
    name: 'Derby Showdown',
    description: 'Two groups of three — group winners meet in a one-off final.',
    location: 'Training Pitch 1',
    start_date: d(-4),
    end_date: d(1),
    format: 'round_robin_knockout',
    status: 'active',
    num_groups: 2,
    teams_per_group: 3,
    advance_per_group: 1,
    knockout_start_round: 'final',
  })
  const teams = await createTeams(id, [
    { name: 'East Quarter FC', group_label: 'A' }, { name: 'West End United', group_label: 'A' },
    { name: 'Old Town SC', group_label: 'A' },
    { name: 'North Bridge XI', group_label: 'B' }, { name: 'South Gate Rovers', group_label: 'B' },
    { name: 'Riverside Athletic', group_label: 'B' },
  ])
  const groupA = teams.slice(0, 3)
  const groupB = teams.slice(3, 6)

  const rows: MatchInsert[] = []
  const results: Record<'A' | 'B', { home: TeamRow; away: TeamRow; h: number; a: number }[]> = { A: [], B: [] }
  const groups: Array<['A' | 'B', TeamRow[]]> = [['A', groupA], ['B', groupB]]
  for (const [label, group] of groups) {
    roundRobinPairs(group).forEach(([home, away], i) => {
      const [h, a] = groupScore()
      results[label].push({ home, away, h, a })
      rows.push(
        finished(
          {
            tournament_id: id, home_team_id: home.id, away_team_id: away.id,
            match_time: ts(-4 + i, label === 'A' ? 17 : 19),
            phase: 'group',
          },
          h, a,
        ),
      )
    })
  }
  const [a1] = topOfGroup(groupA, results.A, 1)
  const [b1] = topOfGroup(groupB, results.B, 1)

  // The one-off final, tonight.
  rows.push({
    tournament_id: id,
    home_team_id: a1.id,
    away_team_id: b1.id,
    match_time: ts(0, 20),
    status: 'scheduled',
    phase: 'knockout',
    knockout_round: 'final',
  })
  await insertMatches(rows)
  await supabase.from('tournaments').update({ knockout_qualifiers: [a1.id, b1.id] }).eq('id', id)
  created.push({ name: 'Derby Showdown', id, note: `'final' start round · ${a1.name} vs ${b1.name} tonight` })
}

async function legacyCup() {
  const id = await createTournament({
    name: 'Legacy Cup 2025',
    description: 'Last season’s cup, kept for the archives.',
    location: 'Old Campus Field',
    start_date: d(-200),
    end_date: d(-190),
    format: 'round_robin',
    status: 'archived',
  })
  const teams = await createTeams(id, [
    { name: 'Alumni FC' }, { name: 'Class of 2025' }, { name: 'Emeritus XI' }, { name: 'Reunion Rovers' },
  ])
  const rows = roundRobinPairs(teams).map(([home, away], i) => {
    const [h, a] = groupScore()
    return finished(
      {
        tournament_id: id, home_team_id: home.id, away_team_id: away.id,
        match_time: ts(-199 + i, 16),
      },
      h, a,
    )
  })
  await insertMatches(rows)
  created.push({ name: 'Legacy Cup 2025', id, note: 'round_robin · archived' })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  // Wipe: audit log rows reference matches/tournaments without cascade, so they go first.
  const { error: auditErr } = await supabase
    .from('admin_audit_log')
    .delete()
    .gte('created_at', '1970-01-01')
  if (auditErr) throw new Error(`audit log wipe: ${auditErr.message}`)

  const { data: existing } = await supabase.from('tournaments').select('id, name')
  for (const t of existing ?? []) {
    const { error } = await supabase.from('tournaments').delete().eq('id', t.id)
    if (error) throw new Error(`delete "${t.name}": ${error.message}`)
  }
  console.log(`Deleted ${existing?.length ?? 0} existing tournaments\n`)

  await springInvitational()
  await campusLeague()
  await freshersCup()
  await knockoutMasters()
  await lightningCup()
  await interFacultyChampionship()
  await championsTrophy()
  await foundersCup()
  await derbyShowdown()
  await legacyCup()

  console.log('✅ Seeded tournaments:\n')
  for (const t of created) {
    console.log(`  ${t.name}`)
    console.log(`    ${t.note}`)
    console.log(`    /t/${t.id}\n`)
  }
}

run().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})
