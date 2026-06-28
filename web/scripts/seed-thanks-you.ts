/**
 * Reseed the "thanks you" tournament to the exact snapshot captured on 2026-06-23.
 *
 * State: round_robin_knockout, 2 groups of 4, all 12 GROUP matches finished,
 * knockout NOT yet seeded, qualifiers NOT yet confirmed ("GP Done" stage).
 *
 * Run against PROD (or any env) with the matching service-role credentials:
 *   cd web && npx tsx --env-file=.env.prod scripts/seed-thanks-you.ts
 *
 * Idempotent: deletes every tournament named "thanks you" (and its children)
 * before inserting a fresh copy. Data lives in scripts/seed-thanks-you.data.json.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const __dirname = dirname(fileURLToPath(import.meta.url))
type State = {
  config: Record<string, unknown> & { name: string }
  groups: Record<string, string[]>
  rosters: Record<string, { name: string; jersey_number: number }[]>
  matches: {
    home: string; away: string; phase: string; knockout_round: string | null
    status: string; home_score: number; away_score: number; winner: string | null
  }[]
  goals: { match: string; team: string; player: string; elapsed_seconds: number }[]
  cards: { match: string; team: string; player: string; card_type: string }[]
}
const state: State = JSON.parse(
  readFileSync(join(__dirname, 'seed-thanks-you.data.json'), 'utf8'),
)

// Fixed timestamps so every finished match satisfies the DB constraints
// (matches_finished_requires_started / matches_active_requires_match_time).
const MATCH_TIME = '2026-06-24T09:00:00+00:00'
const STARTED_AT = '2026-06-24T09:00:00+00:00'
const FINISHED_AT = '2026-06-24T10:00:00+00:00'

function die(label: string, error: unknown): never {
  console.error(`${label}:`, error)
  process.exit(1)
}

async function wipeExisting() {
  const { data: existing, error } = await sb
    .from('tournaments')
    .select('id')
    .eq('name', state.config.name)
  if (error) die('lookup existing', error)
  const ids = (existing ?? []).map((t) => t.id)
  if (!ids.length) return
  console.log(`Removing ${ids.length} existing "${state.config.name}" tournament(s)…`)

  for (const tid of ids) {
    const matchIds = ((await sb.from('matches').select('id').eq('tournament_id', tid)).data ?? []).map((m) => m.id)
    const teamIds = ((await sb.from('teams').select('id').eq('tournament_id', tid)).data ?? []).map((t) => t.id)
    if (matchIds.length) {
      await sb.from('goals').delete().in('match_id', matchIds)
      await sb.from('cards').delete().in('match_id', matchIds)
      await sb.from('admin_audit_log').delete().in('match_id', matchIds)
    }
    await sb.from('admin_audit_log').delete().eq('tournament_id', tid)
    await sb.from('matches').delete().eq('tournament_id', tid)
    if (teamIds.length) await sb.from('players').delete().in('team_id', teamIds)
    await sb.from('teams').delete().eq('tournament_id', tid)
    await sb.from('tournaments').delete().eq('id', tid)
  }
}

async function seed() {
  // 1. Tournament
  const { data: t, error: te } = await sb
    .from('tournaments')
    .insert(state.config)
    .select('id')
    .single()
  if (te || !t) die('insert tournament', te)
  const tid = t.id
  console.log(`Created tournament ${state.config.name} → ${tid}`)

  // 2. Teams (name → id)
  const teamRows = Object.entries(state.groups).flatMap(([group_label, names]) =>
    names.map((name) => ({ name, group_label, tournament_id: tid })),
  )
  const { data: teams, error: tme } = await sb.from('teams').insert(teamRows).select('id, name')
  if (tme || !teams) die('insert teams', tme)
  const teamId = new Map(teams.map((t) => [t.name, t.id]))

  // 3. Players (per-team name → id)
  const playerId = new Map<string, string>() // key: `${team} ${playerName}`
  for (const [team, roster] of Object.entries(state.rosters)) {
    const rows = roster.map((p) => ({ team_id: teamId.get(team), name: p.name, jersey_number: p.jersey_number }))
    const { data: pl, error: pe } = await sb.from('players').insert(rows).select('id, name')
    if (pe || !pl) die(`insert players for ${team}`, pe)
    for (const p of pl) playerId.set(`${team} ${p.name}`, p.id)
  }

  // 4. Matches (key "Home vs Away" → id)
  const matchId = new Map<string, string>()
  for (const m of state.matches) {
    const finished = m.status === 'finished'
    const row = {
      tournament_id: tid,
      home_team_id: teamId.get(m.home) ?? null,
      away_team_id: teamId.get(m.away) ?? null,
      phase: m.phase,
      knockout_round: m.knockout_round,
      status: m.status,
      home_score: m.home_score,
      away_score: m.away_score,
      winner_team_id: m.winner ? teamId.get(m.winner) ?? null : null,
      match_time: MATCH_TIME,
      match_started_at: finished ? STARTED_AT : null,
      match_finished_at: finished ? FINISHED_AT : null,
    }
    const { data: mr, error: me } = await sb.from('matches').insert(row).select('id').single()
    if (me || !mr) die(`insert match ${m.home} vs ${m.away}`, me)
    matchId.set(`${m.home} vs ${m.away}`, mr.id)
  }

  // 5. Goals
  if (state.goals.length) {
    const rows = state.goals.map((g) => ({
      match_id: matchId.get(g.match),
      team_id: teamId.get(g.team),
      player_id: playerId.get(`${g.team} ${g.player}`) ?? null,
      elapsed_seconds: g.elapsed_seconds,
    }))
    const { error } = await sb.from('goals').insert(rows)
    if (error) die('insert goals', error)
  }

  // 6. Cards
  if (state.cards.length) {
    const rows = state.cards.map((c) => ({
      match_id: matchId.get(c.match),
      team_id: teamId.get(c.team),
      player_id: playerId.get(`${c.team} ${c.player}`) ?? null,
      card_type: c.card_type,
    }))
    const { error } = await sb.from('cards').insert(rows)
    if (error) die('insert cards', error)
  }

  console.log(
    `Done. ${teams.length} teams, ${Object.values(state.rosters).flat().length} players, ` +
      `${state.matches.length} matches, ${state.goals.length} goals, ${state.cards.length} cards.`,
  )
  console.log(`Admin: /admin/tournaments/${tid}`)
}

async function main() {
  await wipeExisting()
  await seed()
}
main()
