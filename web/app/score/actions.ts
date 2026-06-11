'use server'

import { revalidatePath } from 'next/cache'
import { requireScorekeeperUser } from '@/lib/auth'
import { listScorekeeperMatchesForUser } from '@/lib/db/roles'
import { getMatch, updateMatchStatus } from '@/lib/db/matches'
import { recordGoal, undoGoal } from '@/lib/db/goals'
import { insertCard, deleteCard } from '@/lib/db/cards'
import { isValidTransition } from '@/lib/match-lifecycle'
import type { MatchStatus } from '@/lib/supabase/types'

async function ensureScorekeeperForMatch(matchId: string) {
  const user = await requireScorekeeperUser()
  const matchIds = await listScorekeeperMatchesForUser(user.id)
  if (!matchIds.includes(matchId)) throw new Error('Not assigned to this match.')
  const match = await getMatch(matchId)
  if (!match) throw new Error('Match not found.')
  return { match }
}

export async function recordGoalAction(
  matchId: string,
  teamId: string,
  playerId: string | null,
): Promise<{ home_score: number; away_score: number } | { error: string }> {
  try {
    const { match } = await ensureScorekeeperForMatch(matchId)
    if (match.status !== 'live') return { error: 'Match is not live.' }
    if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
      return { error: 'Team is not in this match.' }
    }
    const result = await recordGoal(matchId, teamId, playerId)
    if ('error' in result) return result
    revalidatePath('/score')
    revalidatePath(`/t/${match.tournament_id}`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function undoGoalAction(
  matchId: string,
  teamId: string,
): Promise<{ home_score: number; away_score: number } | { error: string }> {
  try {
    const { match } = await ensureScorekeeperForMatch(matchId)
    if (match.status !== 'live') return { error: 'Match is not live.' }
    const result = await undoGoal(matchId, teamId)
    if ('error' in result) return result
    revalidatePath('/score')
    revalidatePath(`/t/${match.tournament_id}`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function addCardAction(
  matchId: string,
  playerId: string,
  cardType: 'yellow' | 'red',
): Promise<{ id: string } | { error: string }> {
  try {
    const { match } = await ensureScorekeeperForMatch(matchId)
    if (match.status !== 'live') return { error: 'Match is not live.' }
    // resolve team_id from player via match — caller supplies playerId, we need team_id
    // insertCard requires team_id; caller must pass it — keep action minimal, let caller resolve
    // Actually we need to look it up; import listPlayers or query directly
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: player, error: pErr } = await supabase
      .from('players')
      .select('team_id')
      .eq('id', playerId)
      .single()
    if (pErr || !player) return { error: 'Player not found.' }
    const result = await insertCard({
      match_id: matchId,
      team_id: player.team_id,
      player_id: playerId,
      card_type: cardType,
    })
    if ('error' in result) return result
    revalidatePath('/score')
    revalidatePath(`/t/${match.tournament_id}`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function removeCardAction(
  cardId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireScorekeeperUser()
    const result = await deleteCard(cardId)
    if (result.error) return { error: result.error }
    revalidatePath('/score')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function scorekeeperTransitionMatch(
  matchId: string,
  next: MatchStatus,
): Promise<{ ok: true } | { error: string }> {
  try {
    const { match } = await ensureScorekeeperForMatch(matchId)
    if (!isValidTransition(match.status, next, 'organizer')) {
      return { error: `Cannot move from ${match.status} to ${next}.` }
    }
    const result = await updateMatchStatus(matchId, next)
    if (result.error) return { error: result.error }
    revalidatePath('/score')
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    revalidatePath(`/t/${match.tournament_id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
