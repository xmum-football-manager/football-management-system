'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import {
  createMatch,
  deleteMatch,
  updateMatchTime,
  updateMatchTeams,
  getMatch,
  listMatches,
} from '@/lib/db/matches'
import { listTeams } from '@/lib/db/teams'
import { getTournament } from '@/lib/db/tournaments'

async function ensureOrganizer(tournamentId: string) {
  const user = await requireUser()
  if (await isAdmin(user.id)) return
  if (!(await isOrganizer(user.id, tournamentId))) throw new Error('Not authorized.')
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
    const result = await createMatch(input)
    if ('id' in result) {
      revalidatePath(`/admin/tournaments/${input.tournament_id}/fixtures`)
      revalidatePath(`/admin/tournaments/${input.tournament_id}`)
      revalidatePath(`/t/${input.tournament_id}`)
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
    let created = 0
    for (const f of fixtures) {
      if (f.home_team_id === f.away_team_id) continue
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

interface GroupStanding {
  team_id: string
  played: number
  wins: number
  draws: number
  losses: number
  gf: number
  ga: number
  gd: number
  pts: number
}

function computeStandings(
  groupLabel: string,
  teamsInGroup: string[],
  matches: { home_team_id: string; away_team_id: string; home_score: number; away_score: number; status: string }[],
  pointsWin: number,
  pointsDraw: number,
  pointsLoss: number,
): GroupStanding[] {
  const acc = new Map<string, GroupStanding>()
  for (const id of teamsInGroup) {
    acc.set(id, {
      team_id: id,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    })
  }
  for (const m of matches) {
    if (m.status !== 'finished') continue
    const home = acc.get(m.home_team_id)
    const away = acc.get(m.away_team_id)
    if (!home || !away) continue
    home.played++
    away.played++
    home.gf += m.home_score
    home.ga += m.away_score
    away.gf += m.away_score
    away.ga += m.home_score
    if (m.home_score > m.away_score) {
      home.wins++
      away.losses++
      home.pts += pointsWin
      away.pts += pointsLoss
    } else if (m.home_score < m.away_score) {
      away.wins++
      home.losses++
      away.pts += pointsWin
      home.pts += pointsLoss
    } else {
      home.draws++
      away.draws++
      home.pts += pointsDraw
      away.pts += pointsDraw
    }
  }
  for (const s of acc.values()) s.gd = s.gf - s.ga
  void groupLabel
  return [...acc.values()].sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team_id.localeCompare(b.team_id),
  )
}

export async function seedKnockoutBracketAction(
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
    if (tournament.format !== 'round_robin_knockout') {
      return { error: 'Bracket seeding is only available for Group → Knockout tournaments.' }
    }

    // Bucket teams by group
    const groupLabels = new Set<string>()
    const teamsByGroup = new Map<string, string[]>()
    for (const t of teams) {
      if (!t.group_label) continue
      groupLabels.add(t.group_label)
      const arr = teamsByGroup.get(t.group_label) ?? []
      arr.push(t.id)
      teamsByGroup.set(t.group_label, arr)
    }
    const sortedLabels = [...groupLabels].sort()
    if (sortedLabels.length === 0) {
      return { error: 'No groups assigned. Assign teams to groups first.' }
    }

    // Verify all group-stage matches finished
    const groupMatches = matches.filter((m) => {
      const hg = teams.find((t) => t.id === m.home_team_id)?.group_label
      const ag = teams.find((t) => t.id === m.away_team_id)?.group_label
      return hg && ag && hg === ag
    })
    if (groupMatches.length === 0) {
      return { error: 'No group-stage matches found. Generate them first.' }
    }
    if (groupMatches.some((m) => m.status !== 'finished')) {
      return { error: 'All group-stage matches must finish before seeding the bracket.' }
    }

    // Verify no knockout already
    const knockoutExists = matches.some((m) => {
      const hg = teams.find((t) => t.id === m.home_team_id)?.group_label
      const ag = teams.find((t) => t.id === m.away_team_id)?.group_label
      return !(hg && ag && hg === ag)
    })
    if (knockoutExists) {
      return { error: 'Knockout matches already exist.' }
    }

    const advance = Math.max(1, tournament.advance_per_group ?? 2)
    // Compute standings per group and pick top N
    const seedsByGroup = new Map<string, string[]>() // label → ordered team_ids
    for (const label of sortedLabels) {
      const teamIds = teamsByGroup.get(label) ?? []
      if (teamIds.length < advance) {
        return {
          error: `Group ${label} has only ${teamIds.length} team${teamIds.length === 1 ? '' : 's'} but needs ${advance} to advance.`,
        }
      }
      const standings = computeStandings(
        label,
        teamIds,
        groupMatches.map((m) => ({
          home_team_id: m.home_team_id,
          away_team_id: m.away_team_id,
          home_score: m.home_score,
          away_score: m.away_score,
          status: m.status,
        })),
        Number(tournament.points_win),
        Number(tournament.points_draw),
        Number(tournament.points_loss),
      )
      seedsByGroup.set(label, standings.slice(0, advance).map((s) => s.team_id))
    }

    // Pair teams using cross-pool seeding
    const pairings = buildCrossPoolPairings(sortedLabels, seedsByGroup, advance)
    if (pairings.length === 0) {
      return { error: 'Could not build bracket pairings with the current group configuration.' }
    }

    // Schedule and insert
    const start = new Date(opts.kickoff)
    if (Number.isNaN(start.getTime())) return { error: 'Invalid kickoff date.' }
    const inserts: { home_team_id: string; away_team_id: string; match_time: string }[] = []
    pairings.forEach((p, i) => {
      const dayIndex = Math.floor(i / opts.perDay)
      const slotIndex = i % opts.perDay
      const t = new Date(start)
      t.setDate(t.getDate() + dayIndex)
      t.setMinutes(t.getMinutes() + opts.slotLength * slotIndex)
      inserts.push({
        home_team_id: p.home,
        away_team_id: p.away,
        match_time: t.toISOString(),
      })
    })

    let created = 0
    for (const f of inserts) {
      if (f.home_team_id === f.away_team_id) continue
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

function buildCrossPoolPairings(
  groupLabels: string[],
  seedsByGroup: Map<string, string[]>,
  advance: number,
): { home: string; away: string }[] {
  const pairings: { home: string; away: string }[] = []
  if (advance === 2 && groupLabels.length % 2 === 0) {
    // FIFA cross-pool: for each (G1, G2) pair → (1G1 v 2G2), (2G1 v 1G2)
    for (let i = 0; i < groupLabels.length; i += 2) {
      const g1 = seedsByGroup.get(groupLabels[i])!
      const g2 = seedsByGroup.get(groupLabels[i + 1])!
      pairings.push({ home: g1[0], away: g2[1] })
      pairings.push({ home: g2[0], away: g1[1] })
    }
    return pairings
  }
  // Fallback: flatten in [1A, 2A, 1B, 2B, ...] order and pair adjacents
  const flat: string[] = []
  for (const label of groupLabels) {
    const seeds = seedsByGroup.get(label) ?? []
    for (let p = 0; p < advance; p++) {
      if (seeds[p]) flat.push(seeds[p])
    }
  }
  for (let i = 0; i + 1 < flat.length; i += 2) {
    pairings.push({ home: flat[i], away: flat[i + 1] })
  }
  return pairings
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
