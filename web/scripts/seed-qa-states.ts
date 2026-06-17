/**
 * Seeds 3 throwaway tournaments in the exact states needed to QA the new
 * gp->ko UI flows. Run: npx tsx scripts/seed-qa-states.ts
 * Idempotent — deletes any prior "QA · ..." tournaments first.
 *
 *  T1  "QA · Edit Pairing"  — top_8, group stage finished, qualifiers confirmed,
 *                             bracket NOT seeded. QA: seed bracket (4 QF first-round
 *                             matches), edit a pairing, exercise the cross-match
 *                             duplicate guard.
 *  T2  "QA · Tie Break"     — semi (4 qualifiers), group stage finished, Group A has
 *                             two teams level on points AND GD for the last slot.
 *                             QA: open Qualifiers step, see the contested toggles.
 *  T3  "QA · Reassign Warn" — setup, teams assigned to groups, group fixtures
 *                             generated (scheduled). QA: reassign a team -> warn dialog.
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

type Team = { id: string; name: string; group_label: string }
// score map keyed by "i-j" (i<j) within a group: [homeGoals, awayGoals]
type Scores = Record<string, [number, number]>

async function wipe(name: string) {
  const { data } = await sb.from('tournaments').select('id').eq('name', name)
  for (const row of data ?? []) await sb.from('tournaments').delete().eq('id', row.id)
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
      ...opts,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error(`Failed to create ${opts.name}:`, error)
    process.exit(1)
  }
  return data.id
}

async function makeTeams(
  tournamentId: string,
  groups: Record<string, string[]>,
): Promise<Team[]> {
  const defs = Object.entries(groups).flatMap(([label, names]) =>
    names.map((name) => ({ name, group_label: label, tournament_id: tournamentId })),
  )
  const { data, error } = await sb.from('teams').insert(defs).select('id, name, group_label')
  if (error || !data) {
    console.error('Failed to create teams:', error)
    process.exit(1)
  }
  const teams = data as Team[]

  // Insert 11 players per team so the min_players_per_team trigger is satisfied.
  const players = teams.flatMap((t) =>
    Array.from({ length: 11 }, (_, i) => ({
      team_id: t.id,
      name: `${t.name} P${i + 1}`,
      jersey_number: i + 1,
    })),
  )
  const { error: playerError } = await sb.from('players').insert(players)
  if (playerError) {
    console.error('Failed to create players:', playerError)
    process.exit(1)
  }

  return teams
}

async function groupMatches(
  tournamentId: string,
  teams: Team[],
  label: string,
  scores: Scores,
  status: 'finished' | 'scheduled',
) {
  const g = teams.filter((t) => t.group_label === label)
  for (let i = 0; i < g.length; i++) {
    for (let j = i + 1; j < g.length; j++) {
      const [hs, as_] = scores[`${i}-${j}`] ?? [0, 0]
      // DB constraints matches_finished_requires_started / matches_active_requires_match_time
      // need both set on a finished match.
      const startedAt = status === 'finished' ? '2026-06-15T09:00:00Z' : null
      const { error } = await sb.from('matches').insert({
        tournament_id: tournamentId,
        home_team_id: g[i].id,
        away_team_id: g[j].id,
        phase: 'group',
        status,
        home_score: status === 'finished' ? hs : 0,
        away_score: status === 'finished' ? as_ : 0,
        match_time: status === 'scheduled' ? MT : startedAt,
        match_started_at: startedAt,
      })
      if (error) console.error(`  match ${g[i].name} v ${g[j].name}:`, error.message)
    }
  }
  return g
}

// Clear ranking for a group of 3: team0 > team1 > team2
const CLEAR3: Scores = { '0-1': [2, 0], '0-2': [2, 0], '1-2': [1, 0] }
// Clear ranking for a group of 4: team0 > team1 > team2 > team3
const CLEAR4: Scores = {
  '0-1': [1, 0], '0-2': [1, 0], '0-3': [1, 0], '1-2': [1, 0], '1-3': [1, 0], '2-3': [1, 0],
}
// Group of 4 where team1 & team2 end LEVEL on points AND GD, fighting for slot 2.
// team0 wins all; t1/t2 draw, each beats t3; t3 loses all.
const TIE4: Scores = {
  '0-1': [1, 0], '0-2': [1, 0], '0-3': [1, 0], '1-2': [1, 1], '1-3': [2, 1], '2-3': [2, 1],
}

async function run() {
  for (const n of ['QA · Edit Pairing', 'QA · Tie Break', 'QA · Reassign Warn']) await wipe(n)

  // ---- T1: top_8, qualifiers confirmed, bracket not seeded ----
  {
    const id = await makeTournament({
      name: 'QA · Edit Pairing', location: 'QA Pitch',
      num_groups: 4, teams_per_group: 3, advance_per_group: 2,
      knockout_start_round: 'top_8', status: 'active',
    })
    const groups = {
      A: ['Alpha A1', 'Alpha A2', 'Alpha A3'],
      B: ['Bravo B1', 'Bravo B2', 'Bravo B3'],
      C: ['Charlie C1', 'Charlie C2', 'Charlie C3'],
      D: ['Delta D1', 'Delta D2', 'Delta D3'],
    }
    const teams = await makeTeams(id, groups)
    const quals: string[] = []
    for (const label of ['A', 'B', 'C', 'D']) {
      const g = await groupMatches(id, teams, label, CLEAR3, 'finished')
      quals.push(g[0].id, g[1].id) // clear top 2
    }
    await sb.from('tournaments').update({ knockout_qualifiers: quals }).eq('id', id)
    console.log(`T1 QA · Edit Pairing  /admin/tournaments/${id}/knockout  (8 qualifiers, seed the bracket then edit a pairing)`)
  }

  // ---- T2: semi, Group A has a points+GD tie at the cutoff ----
  {
    const id = await makeTournament({
      name: 'QA · Tie Break', location: 'QA Pitch',
      num_groups: 2, teams_per_group: 4, advance_per_group: 2,
      knockout_start_round: 'semi', status: 'active',
    })
    const teams = await makeTeams(id, {
      A: ['Aces A1', 'Aces A2', 'Aces A3', 'Aces A4'],
      B: ['Bears B1', 'Bears B2', 'Bears B3', 'Bears B4'],
    })
    await groupMatches(id, teams, 'A', TIE4, 'finished') // A2 & A3 tie for slot 2
    await groupMatches(id, teams, 'B', CLEAR4, 'finished')
    console.log(`T2 QA · Tie Break     /admin/tournaments/${id}/knockout  (Group A: Aces A2 vs Aces A3 tied 4pts GD0 for last slot)`)
  }

  // ---- T3: setup, teams in groups, group fixtures generated (scheduled) ----
  {
    const id = await makeTournament({
      name: 'QA · Reassign Warn', location: 'QA Pitch',
      num_groups: 2, teams_per_group: 4, advance_per_group: 2,
      knockout_start_round: 'semi', status: 'setup',
    })
    const teams = await makeTeams(id, {
      A: ['Red A1', 'Red A2', 'Red A3', 'Red A4'],
      B: ['Blue B1', 'Blue B2', 'Blue B3', 'Blue B4'],
    })
    await groupMatches(id, teams, 'A', {}, 'scheduled')
    await groupMatches(id, teams, 'B', {}, 'scheduled')
    console.log(`T3 QA · Reassign Warn /admin/tournaments/${id}/rd-groups  (reassign a team -> expect wipe-warning dialog)`)
  }

  console.log('\n✅ Seeded 3 QA tournaments.')
}

run().catch(console.error)
