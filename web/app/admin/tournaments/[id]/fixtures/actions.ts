'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import {
  createMatch,
  createMatchAdmin,
  deleteMatch,
  updateMatchTime,
  updateMatchTeams,
  getMatch,
  listMatches,
} from '@/lib/db/matches'
import type { CreateMatchInput } from '@/lib/db/matches'
import { listTeams } from '@/lib/db/teams'
import { getTournament, updateKnockoutQualifiers } from '@/lib/db/tournaments'
import { generateRoundRobin } from '@/lib/round-robin'
import { groupStageComplete, expectedBracketSize } from '@/lib/qualifiers'

async function ensureOrganizer(tournamentId: string) {
  const user = await requireUser()
  if (await isAdmin(user.id)) return
  if (!(await isOrganizer(user.id, tournamentId))) throw new Error('Not authorized.')
}

function revalidateFixtures(tournamentId: string) {
  revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
  revalidatePath(`/admin/tournaments/${tournamentId}/rd-fixtures`)
  revalidatePath(`/admin/tournaments/${tournamentId}/ko-fixtures`)
  revalidatePath(`/admin/tournaments/${tournamentId}`)
  revalidatePath(`/t/${tournamentId}`)
}

export async function addMatchAction(input: {
  tournament_id: string
  home_team_id: string
  away_team_id: string
  match_time: string
}): Promise<{ id: string } | { error: string }> {
  try {
    if (input.home_team_id === input.away_team_id) {
      return { error: 'Home and away must be different teams.' }
    }
    await ensureOrganizer(input.tournament_id)
    const existing = await listMatches(input.tournament_id)
    if (existing.some((m) => m.status !== 'scheduled')) {
      return {
        error:
          'A match has already gone live — new fixtures are locked so standings stay consistent.',
      }
    }
    const tournament = await getTournament(input.tournament_id)
    if (!tournament) return { error: 'Tournament not found.' }
    const matchDay = new Date(input.match_time).toISOString().split('T')[0]
    if (matchDay < tournament.start_date || matchDay > tournament.end_date) {
      return {
        error: `Match must be scheduled within the tournament period (${tournament.start_date} – ${tournament.end_date}).`,
      }
    }
    const result = await createMatch(input)
    if ('id' in result) {
      revalidateFixtures(input.tournament_id)
    }
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function bulkAddMatchesAction(
  tournamentId: string,
  fixtures: { home_team_id: string; away_team_id: string; match_time: string }[],
): Promise<{ created: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const existing = await listMatches(tournamentId)
    if (existing.some((m) => m.status !== 'scheduled')) {
      return {
        error:
          'A match has already gone live — fixture generation is locked. Create a new tournament if you need a fresh draw.',
      }
    }
    const tournament = await getTournament(tournamentId)
    if (!tournament) return { error: 'Tournament not found.' }
    let created = 0
    for (const f of fixtures) {
      if (f.home_team_id === f.away_team_id) continue
      const matchDay = new Date(f.match_time).toISOString().split('T')[0]
      if (matchDay < tournament.start_date || matchDay > tournament.end_date) {
        return {
          error: `Match must be scheduled within the tournament period (${tournament.start_date} – ${tournament.end_date}).`,
        }
      }
      const r = await createMatch({ tournament_id: tournamentId, ...f })
      if ('id' in r) created++
    }
    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    revalidatePath(`/t/${tournamentId}`)
    return { created }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function rescheduleMatchAction(
  matchId: string,
  tournamentId: string,
  newTime: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const existing = await getMatch(matchId)
    if (!existing) return { error: 'Match not found.' }
    if (existing.status !== 'scheduled') {
      return { error: 'Only scheduled matches can be rescheduled.' }
    }
    const tournament = await getTournament(tournamentId)
    if (!tournament) return { error: 'Tournament not found.' }
    const matchDay = new Date(newTime).toISOString().split('T')[0]
    if (matchDay < tournament.start_date || matchDay > tournament.end_date) {
      return {
        error: `Match must be scheduled within the tournament period (${tournament.start_date} – ${tournament.end_date}).`,
      }
    }
    const result = await updateMatchTime(matchId, newTime)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    revalidatePath(`/t/${tournamentId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function swapTeamSlotsAction(
  tournamentId: string,
  source: { matchId: string; slot: 'home' | 'away' },
  target: { matchId: string; slot: 'home' | 'away' },
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    if (source.matchId === target.matchId && source.slot === target.slot) {
      return { error: 'Pick a different slot to swap with.' }
    }
    const [srcMatch, tgtMatch] = await Promise.all([
      getMatch(source.matchId),
      getMatch(target.matchId),
    ])
    if (!srcMatch || !tgtMatch) return { error: 'Match not found.' }
    if (srcMatch.status !== 'scheduled' || tgtMatch.status !== 'scheduled') {
      return { error: 'Both matches must be scheduled to swap teams.' }
    }
    const srcTeam = source.slot === 'home' ? srcMatch.home_team_id : srcMatch.away_team_id
    const tgtTeam = target.slot === 'home' ? tgtMatch.home_team_id : tgtMatch.away_team_id

    if (source.matchId === target.matchId) {
      // Same match: swap home and away
      const r = await updateMatchTeams(srcMatch.id, srcMatch.away_team_id, srcMatch.home_team_id)
      if (r.error) return { error: r.error }
    } else {
      const newSrcHome = source.slot === 'home' ? tgtTeam : srcMatch.home_team_id
      const newSrcAway = source.slot === 'away' ? tgtTeam : srcMatch.away_team_id
      const newTgtHome = target.slot === 'home' ? srcTeam : tgtMatch.home_team_id
      const newTgtAway = target.slot === 'away' ? srcTeam : tgtMatch.away_team_id
      if (newSrcHome === newSrcAway || newTgtHome === newTgtAway) {
        return { error: 'That swap would put a team against itself.' }
      }
      const [r1, r2] = await Promise.all([
        updateMatchTeams(srcMatch.id, newSrcHome, newSrcAway),
        updateMatchTeams(tgtMatch.id, newTgtHome, newTgtAway),
      ])
      if (r1.error) return { error: r1.error }
      if (r2.error) return { error: r2.error }
    }
    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    revalidatePath(`/t/${tournamentId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

const KO_LADDER = ['r32', 'r16', 'qf', 'sf', 'final'] as const
type KoRound = (typeof KO_LADDER)[number]

/** Advance one step up the knockout ladder (r32 → r16 → qf → sf → final). */
function nextKoRound(current: KoRound): KoRound {
  const idx = KO_LADDER.indexOf(current)
  return KO_LADDER[Math.min(idx + 1, KO_LADDER.length - 1)]
}

function knockoutRoundLabel(tournament: { knockout_start_round: string | null }, qualifierCount: number): string {
  switch (tournament.knockout_start_round) {
    case 'final':  return 'final'
    case 'semi':   return 'sf'
    case 'top_8':  return 'qf'
    case 'top_16': return 'r16'
    case 'top_32': return 'r32'
  }
  // fallback for tournaments created before this field existed
  if (qualifierCount <= 2)  return 'final'
  if (qualifierCount <= 4)  return 'sf'
  if (qualifierCount <= 8)  return 'qf'
  if (qualifierCount <= 16) return 'r16'
  return 'r32'
}

export async function seedKnockoutBracketAction(
  tournamentId: string,
): Promise<{ seeded: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)

    const tournament = await getTournament(tournamentId)
    if (!tournament) return { error: 'Tournament not found.' }
    if (tournament.format !== 'round_robin_knockout') {
      return { error: 'Bracket seeding is only available for Group → Knockout tournaments.' }
    }

    const qualifiers = tournament.knockout_qualifiers
    if (!qualifiers || qualifiers.length === 0) {
      return {
        error:
          'No qualifiers assigned yet. Use the Qualifiers section above the bracket to select which teams advance.',
      }
    }

    if (qualifiers.length % 2 !== 0) {
      return { error: `Cannot seed bracket: ${qualifiers.length} qualifiers is odd. Select an even number of teams.` }
    }

    const expected = expectedBracketSize(tournament.knockout_start_round)
    if (expected !== null && qualifiers.length !== expected) {
      return { error: `Bracket needs exactly ${expected} qualifiers for the chosen round, but ${qualifiers.length} are selected.` }
    }

    const existingMatches = await listMatches(tournamentId)
    const knockoutMatches = existingMatches.filter((m) => m.phase === 'knockout')
    if (knockoutMatches.some((m) => m.status !== 'scheduled')) {
      return { error: 'Knockout matches are already in progress — cannot re-seed.' }
    }

    const knockoutRound = knockoutRoundLabel(tournament, qualifiers.length)

    // Pair qualifiers into first-round matches: slot[0] vs slot[1], slot[2] vs slot[3], etc.
    let seeded = 0
    for (let i = 0; i < qualifiers.length; i += 2) {
      const r = await createMatch({
        tournament_id: tournamentId,
        home_team_id: qualifiers[i],
        away_team_id: qualifiers[i + 1],
        match_time: tournament.start_date + 'T12:00:00Z',
        phase: 'knockout',
        knockout_round: knockoutRound,
      })
      if ('id' in r) seeded++
    }

    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    return { seeded }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function seedDirectKnockoutAction(
  tournamentId: string,
  opts: { kickoff: string; slotLength: number; perDay: number },
): Promise<{ created: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const [tournament, teams, matches] = await Promise.all([
      getTournament(tournamentId),
      listTeams(tournamentId),
      listMatches(tournamentId),
    ])
    if (!tournament) return { error: 'Tournament not found.' }
    if (tournament.format !== 'knockout') {
      return { error: 'Direct seeding is only available for pure knockout tournaments.' }
    }
    if (matches.length > 0) return { error: 'Knockout fixtures already exist.' }
    const n = teams.length
    if (n < 2) return { error: 'Need at least 2 teams to seed a bracket.' }
    if ((n & (n - 1)) !== 0) {
      return {
        error: `Team count must be a power of 2 (2, 4, 8, 16…). You have ${n} team${n === 1 ? '' : 's'}.`,
      }
    }
    const kickoffDay = new Date(opts.kickoff).toISOString().split('T')[0]
    if (kickoffDay < tournament.start_date || kickoffDay > tournament.end_date) {
      return {
        error: `Kickoff must be within the tournament period (${tournament.start_date} – ${tournament.end_date}).`,
      }
    }
    const start = new Date(opts.kickoff)
    if (Number.isNaN(start.getTime())) return { error: 'Invalid kickoff date.' }
    const ordered = [...teams].sort((a, b) => a.name.localeCompare(b.name))
    const inserts: { home_team_id: string; away_team_id: string; match_time: string }[] = []
    for (let i = 0; i < ordered.length; i += 2) {
      const matchIndex = i / 2
      const dayIndex = Math.floor(matchIndex / opts.perDay)
      const slotIndex = matchIndex % opts.perDay
      const t = new Date(start)
      t.setDate(t.getDate() + dayIndex)
      t.setMinutes(t.getMinutes() + opts.slotLength * slotIndex)
      inserts.push({
        home_team_id: ordered[i].id,
        away_team_id: ordered[i + 1].id,
        match_time: t.toISOString(),
      })
    }
    let created = 0
    for (const f of inserts) {
      const r = await createMatch({ tournament_id: tournamentId, ...f })
      if ('id' in r) created++
    }
    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    revalidatePath(`/t/${tournamentId}`)
    return { created }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

/**
 * Creates ALL knockout matches (all rounds) up front.
 *
 * - Round 0: real team pairings with times.
 * - Subsequent rounds: TBD slots (null team ids) with scheduled times and
 *   home_source_match_id / away_source_match_id pointing to their feeders.
 *   When a feeder match finishes, the DB trigger fills in the winner.
 *
 * RENDER TARGETS — the matches this writes (phase='knockout', knockout_round set) drive
 * BOTH bracket views, so a successful create here shows up in:
 *   • Admin:  components/admin/AdminBracketView.tsx  (Knockout tab + overview "structure" view)
 *   • Public: components/BracketView.tsx             (spectator tournament page, Bracket tab)
 * Both bucket by `knockout_round`. The `revalidatePath` calls below refresh those pages.
 */
export async function createManualKnockoutAction(
  tournamentId: string,
  pairings: Array<{ home_team_id: string; away_team_id: string; match_time: string | null }>,
  laterRoundTimes: Array<Array<string | null>>,  // laterRoundTimes[r][i] = ISO time for later round r, match i
): Promise<{ created: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const tournament = await getTournament(tournamentId)
    if (!tournament) return { error: 'Tournament not found.' }
    if (tournament.format !== 'round_robin_knockout') {
      return { error: 'Manual bracket is only available for Group → Knockout tournaments.' }
    }
    if (pairings.length === 0) return { error: 'No pairings provided.' }
    if (pairings.some((p) => p.home_team_id === p.away_team_id)) {
      return { error: 'A team cannot play itself.' }
    }
    const allIds = pairings.flatMap((p) => [p.home_team_id, p.away_team_id])
    if (new Set(allIds).size !== allIds.length) {
      return { error: 'Each team can only appear once in the bracket.' }
    }
    const existingMatches = await listMatches(tournamentId)
    if (existingMatches.some((m) => m.phase === 'knockout')) {
      return { error: 'Knockout matches already exist.' }
    }

    let round = knockoutRoundLabel(tournament, pairings.length * 2) as KoRound
    let created = 0

    // Insert round 0 (real teams), collect ids in order
    const round0Ids: string[] = []
    for (const p of pairings) {
      const r = await createMatch({
        tournament_id: tournamentId,
        home_team_id: p.home_team_id,
        away_team_id: p.away_team_id,
        match_time: p.match_time ?? null,
        phase: 'knockout',
        knockout_round: round,
      })
      if ('error' in r) return { error: r.error }
      round0Ids.push(r.id)
      created++
    }

    // Insert later rounds
    let prevIds = round0Ids
    for (let ri = 0; ri < laterRoundTimes.length; ri++) {
      const times = laterRoundTimes[ri]
      round = nextKoRound(round)
      const newIds: string[] = []
      for (let i = 0; i < times.length; i++) {
        const homeSourceId = prevIds[i * 2]
        const awaySourceId = prevIds[i * 2 + 1]
        const input: CreateMatchInput = {
          tournament_id: tournamentId,
          home_team_id: null,
          away_team_id: null,
          match_time: times[i] ?? null,
          phase: 'knockout',
          knockout_round: round,
          home_source_match_id: homeSourceId,
          away_source_match_id: awaySourceId,
        }
        const r = await createMatch(input)
        if ('error' in r) return { error: r.error }
        newIds.push(r.id)
        created++
      }
      prevIds = newIds
    }

    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    revalidatePath(`/admin/tournaments/${tournamentId}/knockout`)
    revalidatePath(`/t/${tournamentId}`)
    return { created }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function resetKnockoutAction(
  tournamentId: string,
): Promise<{ deleted: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const matches = await listMatches(tournamentId)
    const knockoutMatches = matches.filter((m) => m.phase === 'knockout')
    let deleted = 0
    for (const m of knockoutMatches) {
      const r = await deleteMatch(m.id)
      if (!r.error) deleted++
    }
    revalidatePath(`/admin/tournaments/${tournamentId}/knockout`)
    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    revalidatePath(`/t/${tournamentId}`)
    return { deleted }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function saveQualifiersAction(
  tournamentId: string,
  teamIds: string[],
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const matches = await listMatches(tournamentId)
    if (!groupStageComplete(matches)) {
      return { error: 'Finish all group matches before confirming qualifiers.' }
    }
    const result = await updateKnockoutQualifiers(tournamentId, teamIds)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function generateGroupFixturesAction(
  tournamentId: string,
): Promise<{ created: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const [tournament, teams, existing] = await Promise.all([
      getTournament(tournamentId),
      listTeams(tournamentId),
      listMatches(tournamentId),
    ])
    if (!tournament) return { error: 'Tournament not found.' }
    if (!tournament.num_groups) return { error: 'No groups configured.' }
    if (existing.length > 0) return { error: 'Fixtures already exist for this tournament.' }

    const validLabels = Array.from(
      { length: tournament.num_groups },
      (_, i) => String.fromCharCode(65 + i),
    )
    let created = 0
    for (const label of validLabels) {
      const groupTeams = teams.filter((t) => t.group_label === label)
      const rounds = generateRoundRobin(groupTeams)
      for (const round of rounds) {
        for (const { home, away } of round) {
          const r = await createMatchAdmin({
            tournament_id: tournamentId,
            home_team_id: home.id,
            away_team_id: away.id,
            match_time: null,
            phase: 'group',
          })
          if ('error' in r) return { error: r.error }
          created++
        }
      }
    }
    revalidateFixtures(tournamentId)
    return { created }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function scheduleMatchAction(
  matchId: string,
  tournamentId: string,
  matchTime: string | null,
): Promise<{ ok: true } | { error: string }> {
  try {
    const [, existing, tournament] = await Promise.all([
      ensureOrganizer(tournamentId),
      getMatch(matchId),
      matchTime !== null ? getTournament(tournamentId) : Promise.resolve(null),
    ])
    if (!existing) return { error: 'Match not found.' }
    if (existing.status !== 'scheduled') {
      return { error: 'Only scheduled matches can be rescheduled.' }
    }
    if (matchTime !== null) {
      if (!tournament) return { error: 'Tournament not found.' }
      const matchDay = new Date(matchTime).toISOString().split('T')[0]
      if (matchDay < tournament.start_date || matchDay > tournament.end_date) {
        return {
          error: `Match must be within the tournament period (${tournament.start_date} – ${tournament.end_date}).`,
        }
      }
    }
    const result = await updateMatchTime(matchId, matchTime)
    if (result.error) return { error: result.error }
    revalidateFixtures(tournamentId)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function deleteMatchAction(
  matchId: string,
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const existing = await getMatch(matchId)
    if (!existing) return { error: 'Match not found.' }
    if (existing.status !== 'scheduled') {
      return { error: 'Only scheduled matches can be deleted.' }
    }
    const result = await deleteMatch(matchId)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    revalidatePath(`/t/${tournamentId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
