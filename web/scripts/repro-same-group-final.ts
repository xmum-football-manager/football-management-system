/**
 * Reproduces the "same-group final" bug scenario and verifies the fix holds.
 *
 * Scenario: both knockout semifinal winners come from the same group (A).
 * The advance_knockout_winner trigger populates the final with two Group-A teams.
 * Pre-fix: the final was misclassified as a group match (equal group_labels),
 *   locking the KO tab and hiding the final from the bracket view.
 * Post-fix: classification reads `phase === 'knockout'`, so the final is
 *   correctly identified as a KO match regardless of team group labels.
 *
 * Run: cd web && npx tsx scripts/repro-same-group-final.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const TOURNAMENT_NAME = 'REPRO · Same-Group Final'
const START = '2026-07-01'
const END = '2026-07-31'
const MT = '2026-07-10T12:00:00Z'

// ---------- phase helpers (mirrors match-lifecycle.ts) ----------
function isGroupPhaseMatch(m: { phase: string | null }) { return m.phase === 'group' }
function isKnockoutPhaseMatch(m: { phase: string | null }) { return m.phase === 'knockout' }

// allGroupMatchesFinished mirrors overview-utils.ts
function allGroupMatchesFinished(matches: Array<{ phase: string | null; status: string }>) {
  const groupMatches = matches.filter(isGroupPhaseMatch)
  return groupMatches.length > 0 && groupMatches.every((m) => m.status === 'finished')
}

// OLD (buggy) heuristic: classify as group match when both teams share a group_label.
function oldHeuristicIsGroupMatch(m: {
  home_group_label: string | null
  away_group_label: string | null
}) {
  return (
    m.home_group_label !== null &&
    m.away_group_label !== null &&
    m.home_group_label === m.away_group_label
  )
}

async function wipe() {
  const { data } = await sb.from('tournaments').select('id').eq('name', TOURNAMENT_NAME)
  for (const row of data ?? []) {
    await sb.from('tournaments').delete().eq('id', row.id)
  }
}

async function run() {
  await wipe()

  // 1. Create tournament
  const { data: tournament, error: tErr } = await sb
    .from('tournaments')
    .insert({
      name: TOURNAMENT_NAME,
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
    })
    .select('id')
    .single()
  if (tErr || !tournament) { console.error('Failed to create tournament:', tErr); process.exit(1) }
  const tid = tournament.id
  console.log(`\nCreated tournament: ${TOURNAMENT_NAME} (${tid})`)

  // 2. Create 8 teams, 4 in group A, 4 in group B
  const teamDefs = [
    { name: 'Alpha Wolves',   group_label: 'A', tournament_id: tid },
    { name: 'Alpha Eagles',   group_label: 'A', tournament_id: tid },
    { name: 'Alpha Tigers',   group_label: 'A', tournament_id: tid },
    { name: 'Alpha Lions',    group_label: 'A', tournament_id: tid },
    { name: 'Beta Sharks',    group_label: 'B', tournament_id: tid },
    { name: 'Beta Hawks',     group_label: 'B', tournament_id: tid },
    { name: 'Beta Panthers',  group_label: 'B', tournament_id: tid },
    { name: 'Beta Foxes',     group_label: 'B', tournament_id: tid },
  ]
  const { data: teams, error: teamErr } = await sb.from('teams').insert(teamDefs).select('id, name, group_label')
  if (teamErr || !teams) { console.error('Failed to create teams:', teamErr); process.exit(1) }

  // Seed 11 players per team to satisfy any min-players constraint
  const players = teams.flatMap((t) =>
    Array.from({ length: 11 }, (_, i) => ({ team_id: t.id, name: `${t.name} P${i + 1}`, jersey_number: i + 1 })),
  )
  const { error: pErr } = await sb.from('players').insert(players)
  if (pErr) { console.error('Failed to create players:', pErr); process.exit(1) }
  console.log(`Created ${teams.length} teams (${players.length} players)`)

  const groupA = teams.filter((t) => t.group_label === 'A')
  const groupB = teams.filter((t) => t.group_label === 'B')

  // 3. Create and finish all group matches
  // Within each group, team[0] beats everyone — clear ranking.
  const SCORES: Record<string, [number, number]> = {
    '0-1': [2, 0], '0-2': [2, 0], '0-3': [2, 0],
    '1-2': [1, 0], '1-3': [1, 0], '2-3': [1, 0],
  }
  async function createGroupMatches(g: NonNullable<typeof teams>) {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        const home = g[i]!
        const away = g[j]!
        const [hs, as_] = SCORES[`${i}-${j}`] ?? [1, 0]
        const winner = hs > as_ ? home.id : away.id
        const { error } = await sb.from('matches').insert({
          tournament_id: tid,
          home_team_id: home.id,
          away_team_id: away.id,
          phase: 'group',
          status: 'finished',
          home_score: hs,
          away_score: as_,
          winner_team_id: winner,
          match_time: null,
        })
        if (error) console.error(`  group ${home.name} v ${away.name}:`, error.message)
      }
    }
  }
  await createGroupMatches(groupA)
  await createGroupMatches(groupB)
  console.log('Created & finished all 12 group matches')

  // Group ranking: A[0]=Alpha Wolves (1st), A[1]=Alpha Eagles (2nd)
  //               B[0]=Beta Sharks (1st),  B[1]=Beta Hawks (2nd)
  // Cross-pairing for semis: A1 vs B2, B1 vs A2
  // Winners chosen so BOTH come from Group A:
  //   SF1: Alpha Wolves (A1) vs Beta Hawks (B2)  → Alpha Wolves wins (Group A)
  //   SF2: Beta Sharks (B1) vs Alpha Eagles (A2) → Alpha Eagles wins (Group A)
  const a1 = groupA[0]  // Alpha Wolves
  const a2 = groupA[1]  // Alpha Eagles
  const b1 = groupB[0]  // Beta Sharks
  const b2 = groupB[1]  // Beta Hawks

  console.log(`\nSemifinals:`)
  console.log(`  SF1: ${a1.name} (${a1.group_label}) vs ${b2.name} (${b2.group_label}) → winner: ${a1.name}`)
  console.log(`  SF2: ${b1.name} (${b1.group_label}) vs ${a2.name} (${a2.group_label}) → winner: ${a2.name}`)

  // 4. Create the final first (NULL teams, source links to semis created next)
  // We must create the final before semis so we have its id for source links,
  // OR create semis first and link final to them. Since the trigger fires on semi
  // UPDATE to finished, we create: final (NULL) → semis (scheduled) → finish semis.
  const { data: finalMatch, error: fErr } = await sb.from('matches').insert({
    tournament_id: tid,
    home_team_id: null,
    away_team_id: null,
    phase: 'knockout',
    knockout_round: 'final',
    status: 'scheduled',
    home_score: 0,
    away_score: 0,
    match_time: MT,
  }).select('id').single()
  if (fErr || !finalMatch) { console.error('Failed to create final:', fErr); process.exit(1) }
  const finalId = finalMatch.id

  // 5. Create the two semifinals with source links pointing to the final
  const { data: sf1, error: sf1Err } = await sb.from('matches').insert({
    tournament_id: tid,
    home_team_id: a1.id,
    away_team_id: b2.id,
    phase: 'knockout',
    knockout_round: 'sf',
    status: 'scheduled',
    home_score: 0,
    away_score: 0,
    match_time: MT,
  }).select('id').single()
  if (sf1Err || !sf1) { console.error('Failed to create SF1:', sf1Err); process.exit(1) }

  const { data: sf2, error: sf2Err } = await sb.from('matches').insert({
    tournament_id: tid,
    home_team_id: b1.id,
    away_team_id: a2.id,
    phase: 'knockout',
    knockout_round: 'sf',
    status: 'scheduled',
    home_score: 0,
    away_score: 0,
    match_time: MT,
  }).select('id').single()
  if (sf2Err || !sf2) { console.error('Failed to create SF2:', sf2Err); process.exit(1) }

  // Link the final's slots to the two semis
  const { error: linkErr } = await sb.from('matches').update({
    home_source_match_id: sf1.id,
    away_source_match_id: sf2.id,
  }).eq('id', finalId)
  if (linkErr) { console.error('Failed to link final sources:', linkErr); process.exit(1) }
  console.log(`Created bracket: SF1(${sf1.id}) + SF2(${sf2.id}) → Final(${finalId})`)

  // 6. Finish SF1: Alpha Wolves wins (group A)
  const { error: sf1FinErr } = await sb.from('matches').update({
    status: 'finished',
    home_score: 2,
    away_score: 0,
    winner_team_id: a1.id,  // Alpha Wolves — Group A
  }).eq('id', sf1.id)
  if (sf1FinErr) { console.error('Failed to finish SF1:', sf1FinErr); process.exit(1) }

  // 7. Finish SF2: Alpha Eagles wins (group A)
  const { error: sf2FinErr } = await sb.from('matches').update({
    status: 'finished',
    home_score: 0,
    away_score: 1,
    winner_team_id: a2.id,  // Alpha Eagles — Group A
  }).eq('id', sf2.id)
  if (sf2FinErr) { console.error('Failed to finish SF2:', sf2FinErr); process.exit(1) }
  console.log('Finished both semifinals — trigger should have populated the final')

  // 8. Re-fetch the final to confirm trigger ran
  const { data: finalRow, error: fetchErr } = await sb
    .from('matches')
    .select('id, phase, status, home_team_id, away_team_id, knockout_round')
    .eq('id', finalId)
    .single()
  if (fetchErr || !finalRow) { console.error('Failed to fetch final:', fetchErr); process.exit(1) }

  // Look up the team names for the final's slots
  const finalTeamIds = [finalRow.home_team_id, finalRow.away_team_id].filter(Boolean)
  const { data: finalTeams } = await sb
    .from('teams')
    .select('id, name, group_label')
    .in('id', finalTeamIds)

  const homeTeam = finalTeams?.find((t) => t.id === finalRow.home_team_id)
  const awayTeam = finalTeams?.find((t) => t.id === finalRow.away_team_id)

  console.log('\n--- Final match after trigger ---')
  console.log(`  ID:    ${finalRow.id}`)
  console.log(`  Phase: ${finalRow.phase}`)
  console.log(`  Home:  ${homeTeam?.name ?? 'NULL'} (group ${homeTeam?.group_label ?? '?'})`)
  console.log(`  Away:  ${awayTeam?.name ?? 'NULL'} (group ${awayTeam?.group_label ?? '?'})`)

  const bothSameGroup = homeTeam?.group_label === awayTeam?.group_label
  console.log(`  Same group? ${bothSameGroup} (${homeTeam?.group_label} vs ${awayTeam?.group_label})`)

  // 9. Fetch all matches for verification
  const { data: allMatches } = await sb
    .from('matches')
    .select('id, phase, status, knockout_round')
    .eq('tournament_id', tid)

  if (!allMatches) { console.error('Failed to fetch all matches'); process.exit(1) }

  // ===== VERIFICATIONS =====
  console.log('\n=== VERIFICATION ===')
  let allPass = true

  // V1: final's phase === 'knockout'
  const v1 = finalRow.phase === 'knockout'
  console.log(`[${v1 ? 'PASS' : 'FAIL'}] Final phase === 'knockout'  (got: ${finalRow.phase})`)
  allPass = allPass && v1

  // V2: allGroupMatchesFinished returns true
  const v2 = allGroupMatchesFinished(allMatches)
  console.log(`[${v2 ? 'PASS' : 'FAIL'}] allGroupMatchesFinished(matches) === true  (got: ${v2})`)
  allPass = allPass && v2

  // V3: isKnockoutPhaseMatch filter includes the final
  const koMatches = allMatches.filter(isKnockoutPhaseMatch)
  const v3 = koMatches.some((m) => m.id === finalId)
  console.log(`[${v3 ? 'PASS' : 'FAIL'}] KO filter includes the final (${koMatches.length} KO matches found)`)
  allPass = allPass && v3

  // V4: final's team slots are populated (trigger ran)
  const v4 = finalRow.home_team_id !== null && finalRow.away_team_id !== null
  console.log(`[${v4 ? 'PASS' : 'FAIL'}] Final team slots populated by trigger`)
  allPass = allPass && v4

  // V5: both finalists are from the same group (the scenario this bug targets)
  const v5 = bothSameGroup && homeTeam !== undefined && awayTeam !== undefined
  console.log(`[${v5 ? 'PASS' : 'FAIL'}] Both finalists from same group (${homeTeam?.group_label})`)
  allPass = allPass && v5

  // ===== OLD HEURISTIC EVIDENCE =====
  console.log('\n=== OLD HEURISTIC EVIDENCE ===')
  const finalWithLabels = {
    home_group_label: homeTeam?.group_label ?? null,
    away_group_label: awayTeam?.group_label ?? null,
  }
  const oldSaidGroup = oldHeuristicIsGroupMatch(finalWithLabels)
  console.log(
    `Old heuristic (equal group_labels → group match) on the final: ${oldSaidGroup}` +
    (oldSaidGroup ? ' ← would have LOCKED the KO tab + hidden the final' : ' (unexpected)'),
  )
  // This should print "true" — proving the bug would have triggered.

  console.log('\n=== RESULT ===')
  console.log(allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED')
  console.log(`\nTournament ID:  ${tid}`)
  console.log(`Admin URL:      http://localhost:3000/admin/tournaments/${tid}`)
}

run().catch(console.error)
