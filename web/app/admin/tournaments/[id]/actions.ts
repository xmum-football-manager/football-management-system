'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { getMatch, updateMatchScore, updateMatchStatus, updateMatchTime, updateMatchWinner, clearMatchWinner } from '@/lib/db/matches'
import { recordGoal, deleteGoal } from '@/lib/db/goals'
import { insertCard, deleteCard } from '@/lib/db/cards'
import { logMatchRevert } from '@/lib/db/audit'
import { isValidTransition, shouldClearKnockoutWinner } from '@/lib/match-lifecycle'
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
    // Guard: cannot go live until all matches in this phase have a scheduled time
    if (next === 'live') {
      const supabase = await createClient()
      const { count, error: countErr } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', match.tournament_id)
        .eq('phase', match.phase ?? '')
        .is('match_time', null)
      if (countErr) return { error: 'Could not verify schedule. Try again.' }
      if (count !== null && count > 0) {
        const label = match.phase === 'group' ? 'group' : 'knockout'
        return {
          error: `${count} ${label} match${count === 1 ? '' : 'es'} still need a scheduled time. Schedule all ${label} matches before starting play.`,
        }
      }
    }
    // Guard: knockout match cannot go live until both teams are determined
    if (next === 'live' && match.phase === 'knockout' && (!match.home_team_id || !match.away_team_id)) {
      return { error: 'Both teams must be determined before this knockout match can go live.' }
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
    // Knockout finish: auto-set winner for decisive result; block draw without winner
    if (next === 'finished' && match.phase === 'knockout' && !match.winner_team_id) {
      if (match.home_score > match.away_score) {
        const wr = await updateMatchWinner(matchId, match.home_team_id!)
        if (wr.error) return { error: wr.error }
      } else if (match.away_score > match.home_score) {
        const wr = await updateMatchWinner(matchId, match.away_team_id!)
        if (wr.error) return { error: wr.error }
      } else {
        return { error: 'This knockout match is level. Pick which team advances before ending the match.' }
      }
    }
    const role: 'admin' | 'organizer' = admin && asAdmin ? 'admin' : 'organizer'
    if (!isValidTransition(match.status, next, role)) {
      return { error: `Cannot move from ${match.status} to ${next}.` }
    }
    const result = await updateMatchStatus(matchId, next)
    if (result.error) return { error: result.error }

    if (shouldClearKnockoutWinner({ phase: match.phase, from: match.status, to: next })) {
      const wr = await clearMatchWinner(matchId)
      if (wr.error) return { error: wr.error }
    }

    if (admin && asAdmin && match.status === 'finished' && next === 'live') {
      await logMatchRevert(user.id, matchId, match.tournament_id, 'finished')
    }
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    revalidatePath(`/admin/tournaments/${match.tournament_id}/fixtures`)
    revalidatePath(`/t/${match.tournament_id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function setKnockoutWinnerAction(
  matchId: string,
  winnerTeamId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const { match } = await ensureOrganizerOfMatch(matchId)
    if (match.phase !== 'knockout') return { error: 'Only knockout matches need a manual winner.' }
    if (match.status !== 'live' && match.status !== 'halftime') {
      return { error: 'Match must be live to set a winner.' }
    }
    if (winnerTeamId !== match.home_team_id && winnerTeamId !== match.away_team_id) {
      return { error: 'Winner must be one of the two teams.' }
    }
    const result = await updateMatchWinner(matchId, winnerTeamId)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
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

export async function adminRecordGoalAction(
  matchId: string,
  teamId: string,
  playerId: string | null,
): Promise<{ home_score: number; away_score: number } | { error: string }> {
  try {
    const { match } = await ensureOrganizerOfMatch(matchId)
    if (match.status !== 'live') return { error: 'Match is not live.' }
    if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
      return { error: 'Team is not in this match.' }
    }
    const result = await recordGoal(matchId, teamId, playerId)
    if ('error' in result) return result
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    revalidatePath(`/t/${match.tournament_id}`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function adminDeleteGoalAction(
  matchId: string,
  goalId: string,
): Promise<{ home_score: number; away_score: number } | { error: string }> {
  try {
    const { match } = await ensureOrganizerOfMatch(matchId)
    if (match.status !== 'live') return { error: 'Match is not live.' }
    const result = await deleteGoal(matchId, goalId)
    if ('error' in result) return result
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    revalidatePath(`/t/${match.tournament_id}`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function adminAddCardAction(
  matchId: string,
  playerId: string,
  teamId: string,
  cardType: 'yellow' | 'red',
): Promise<{ id: string } | { error: string }> {
  try {
    const { match } = await ensureOrganizerOfMatch(matchId)
    if (match.status !== 'live') return { error: 'Match is not live.' }
    const result = await insertCard({ match_id: matchId, team_id: teamId, player_id: playerId, card_type: cardType })
    if ('error' in result) return result
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    revalidatePath(`/t/${match.tournament_id}`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function adminRemoveCardAction(
  cardId: string,
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requireUser()
    const admin = await isAdmin(user.id)
    if (!admin && !(await isOrganizer(user.id, tournamentId))) throw new Error('Not authorized.')
    const result = await deleteCard(cardId)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    revalidatePath(`/t/${tournamentId}`)
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
