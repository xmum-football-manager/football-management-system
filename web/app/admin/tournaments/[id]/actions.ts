'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { getMatch, setMatchSlotTeam, setMatchWinner, updateMatchScore, updateMatchStatus, updateMatchTime } from '@/lib/db/matches'
import { computeAutoWinner } from './advance'
import { logMatchRevert } from '@/lib/db/audit'
import { isValidTransition } from '@/lib/match-lifecycle'
import { createClient } from '@/lib/supabase/server'
import type { MatchStatus } from '@/lib/supabase/types'

async function ensureOrganizerOfMatch(matchId: string) {
  const user = await requireUser()
  const match = await getMatch(matchId)
  if (!match) throw new Error('Match not found.')
  const admin = await isAdmin(user.id)
  if (admin) return { user, match, admin: true as const }
  const org = await isOrganizer(user.id, match.tournament_id)
  if (!org) throw new Error('Not authorized.')
  return { user, match, admin: false as const }
}

export async function transitionMatchAction(
  matchId: string,
  next: MatchStatus,
  asAdmin: boolean,
): Promise<{ ok: true } | { error: string }> {
  try {
    const { user, match, admin } = await ensureOrganizerOfMatch(matchId)
    // Guard: cannot go live without a scheduled time
    if (next === 'live' && !match.match_time) {
      return { error: 'Set a match time before going live.' }
    }
    // 1-live guard: only one match may be live or at halftime at a time
    if (next === 'live') {
      const supabase = await createClient()
      const { count, error: countError } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', match.tournament_id)
        .neq('id', matchId)
        .in('status', ['live', 'halftime'])
      if (countError) return { error: 'Could not verify match status. Try again.' }
      if (count !== null && count > 0) {
        return { error: 'Another match is already live. Finish it first.' }
      }
    }
    const role: 'admin' | 'organizer' = admin && asAdmin ? 'admin' : 'organizer'
    if (!isValidTransition(match.status, next, role)) {
      return { error: `Cannot move from ${match.status} to ${next}.` }
    }
    const result = await updateMatchStatus(matchId, next)
    if (result.error) return { error: result.error }

    if (admin && asAdmin && match.status === 'finished' && next === 'live') {
      await logMatchRevert(user.id, matchId, match.tournament_id, 'finished')
    }

    // Auto-advance knockout bracket: flow this match's winner into the match it feeds.
    if (next === 'finished' && match.phase === 'knockout') {
      await advanceBracketIfReady(matchId)
    }

    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    revalidatePath(`/admin/tournaments/${match.tournament_id}/fixtures`)
    revalidatePath(`/admin/tournaments/${match.tournament_id}/ko-fixtures`)
    revalidatePath(`/t/${match.tournament_id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function updateScoreAction(
  matchId: string,
  home_score: number,
  away_score: number,
): Promise<{ ok: true } | { error: string }> {
  try {
    const { match } = await ensureOrganizerOfMatch(matchId)
    const result = await updateMatchScore(matchId, home_score, away_score)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    revalidatePath(`/admin/tournaments/${match.tournament_id}/fixtures`)
    revalidatePath(`/t/${match.tournament_id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function setMatchWinnerAction(
  matchId: string,
  winnerTeamId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const { match } = await ensureOrganizerOfMatch(matchId)
    if (match.phase !== 'knockout') return { error: 'Only knockout matches have a winner pick.' }
    if (winnerTeamId !== match.home_team_id && winnerTeamId !== match.away_team_id) {
      return { error: 'Winner must be one of the two teams.' }
    }
    const r = await setMatchWinner(matchId, winnerTeamId)
    if (r.error) return { error: r.error }
    // Now that a winner exists, flow it into the next round.
    if (match.status === 'finished') {
      await advanceBracketIfReady(matchId)
    }
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    revalidatePath(`/admin/tournaments/${match.tournament_id}/ko-fixtures`)
    revalidatePath(`/t/${match.tournament_id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function updateMatchTimeAction(
  matchId: string,
  match_time: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const { match } = await ensureOrganizerOfMatch(matchId)
    const result = await updateMatchTime(matchId, match_time)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

/**
 * Flow a finished knockout match's winner into the slot that references it.
 * Reads `winner_team_id` (auto-derived from score here if unset; a level match
 * with no admin pick is left for the draw UI and does NOT advance). Then finds
 * the match whose home_source_match_id or away_source_match_id equals this id
 * and fills that slot. No created_at pairing, no dedup heuristic.
 */
async function advanceBracketIfReady(matchId: string) {
  try {
    const finished = await getMatch(matchId)
    if (!finished || finished.phase !== 'knockout') return

    // Resolve the winner: prefer an explicit (admin-picked) winner, else auto from score.
    let winnerId = finished.winner_team_id
    if (!winnerId) {
      winnerId = computeAutoWinner(finished)
      if (!winnerId) return // level score, no admin pick yet — draw UI handles it
      await setMatchWinner(matchId, winnerId)
    }

    const supabase = await createClient()
    const { data: dependents } = await supabase
      .from('matches')
      .select('id, home_source_match_id, away_source_match_id')
      .eq('tournament_id', finished.tournament_id)
      .or(`home_source_match_id.eq.${matchId},away_source_match_id.eq.${matchId}`)

    for (const dep of dependents ?? []) {
      const slot: 'home' | 'away' = dep.home_source_match_id === matchId ? 'home' : 'away'
      await setMatchSlotTeam(dep.id, slot, winnerId)
    }
  } catch {
    // Auto-advance is best-effort — never fail the transition.
  }
}
