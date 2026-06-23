'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { isValidTransition } from '@/lib/match-lifecycle'
import { withTeamFallback } from '@/lib/match-teams'
import { groupStageComplete } from '@/lib/group-stage-gate'
import type { MatchStatus, MatchWithTeams } from '@/lib/supabase/types'

export async function getMatchByToken(token: string): Promise<MatchWithTeams | null> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('scorekeeper_token', token)
    .maybeSingle()
  return data ? withTeamFallback([data as unknown as MatchWithTeams])[0] : null
}

export async function tokenRecordGoal(
  token: string,
  teamId: string,
  playerId: string | null,
): Promise<{ home_score: number; away_score: number } | { error: string }> {
  try {
    const match = await getMatchByToken(token)
    if (!match) return { error: 'Match not found.' }
    if (match.status !== 'live') return { error: 'Match is not live.' }
    if (teamId !== match.home_team_id && teamId !== match.away_team_id) {
      return { error: 'Team is not in this match.' }
    }
    const svc = createServiceClient()
    const { data, error } = await svc.rpc('record_goal', {
      p_match_id: match.id,
      p_team_id: teamId,
      p_player_id: playerId,
    })
    if (error) return { error: error.message }
    const row = (data as { home_score: number; away_score: number }[])[0]
    revalidatePath(`/score/m/${token}`)
    revalidatePath(`/t/${match.tournament_id}`)
    return row
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function tokenDeleteGoal(
  token: string,
  goalId: string,
): Promise<{ home_score: number; away_score: number } | { error: string }> {
  try {
    const match = await getMatchByToken(token)
    if (!match) return { error: 'Match not found.' }
    if (match.status !== 'live') return { error: 'Match is not live.' }
    const svc = createServiceClient()
    const { data, error } = await svc.rpc('delete_goal', {
      p_match_id: match.id,
      p_goal_id: goalId,
    })
    if (error) return { error: error.message }
    const row = (data as { home_score: number; away_score: number }[])[0]
    revalidatePath(`/score/m/${token}`)
    revalidatePath(`/t/${match.tournament_id}`)
    return row
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function tokenAddCard(
  token: string,
  playerId: string,
  cardType: 'yellow' | 'red',
): Promise<{ id: string; autoRed: boolean } | { error: string }> {
  try {
    const match = await getMatchByToken(token)
    if (!match) return { error: 'Match not found.' }
    if (match.status !== 'live') return { error: 'Match is not live.' }
    const svc = createServiceClient()
    const { data: player, error: pErr } = await svc
      .from('players')
      .select('team_id')
      .eq('id', playerId)
      .single()
    if (pErr || !player) return { error: 'Player not found.' }
    const { data, error } = await svc
      .from('cards')
      .insert({
        match_id: match.id,
        team_id: player.team_id,
        player_id: playerId,
        card_type: cardType,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }

    // Two yellows in a match = an automatic red. When this yellow is the
    // player's second, issue the red card alongside it.
    let autoRed = false
    if (cardType === 'yellow') {
      const { count } = await svc
        .from('cards')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .eq('player_id', playerId)
        .eq('card_type', 'yellow')
      if ((count ?? 0) >= 2) {
        const { error: redErr } = await svc.from('cards').insert({
          match_id: match.id,
          team_id: player.team_id,
          player_id: playerId,
          card_type: 'red',
        })
        if (!redErr) autoRed = true
      }
    }

    revalidatePath(`/score/m/${token}`)
    revalidatePath(`/t/${match.tournament_id}`)
    return { id: data.id, autoRed }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function tokenRemoveCard(
  token: string,
  cardId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const match = await getMatchByToken(token)
    if (!match) return { error: 'Match not found.' }
    if (match.status !== 'live') return { error: 'Match is not live.' }
    const svc = createServiceClient()
    const { error } = await svc.from('cards').delete().eq('id', cardId).eq('match_id', match.id)
    if (error) return { error: error.message }
    revalidatePath(`/score/m/${token}`)
    revalidatePath(`/t/${match.tournament_id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function tokenSetKnockoutWinner(
  token: string,
  winnerTeamId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const match = await getMatchByToken(token)
    if (!match) return { error: 'Match not found.' }
    if (match.phase !== 'knockout') return { error: 'Only knockout matches need a manual winner.' }
    if (winnerTeamId !== match.home_team_id && winnerTeamId !== match.away_team_id) {
      return { error: 'Winner must be one of the two teams.' }
    }
    const svc = createServiceClient()
    const { error } = await svc.from('matches').update({ winner_team_id: winnerTeamId }).eq('id', match.id)
    if (error) return { error: error.message }
    revalidatePath(`/score/m/${token}`)
    revalidatePath(`/t/${match.tournament_id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function tokenTransitionMatch(
  token: string,
  next: MatchStatus,
): Promise<{ ok: true } | { error: string }> {
  try {
    const match = await getMatchByToken(token)
    if (!match) return { error: 'Match not found.' }

    // Guard: knockout match cannot go live until both teams are determined
    if (next === 'live' && match.phase === 'knockout' && (!match.home_team_id || !match.away_team_id)) {
      return { error: 'Both teams must be determined before this knockout match can go live.' }
    }

    // Guard: knockout match cannot kick off while the group stage is unfinished.
    // Determined teams alone are not enough — a reverted group result leaves
    // stale seeding, so re-check the live group-stage state at kickoff.
    if (next === 'live' && match.phase === 'knockout') {
      const svc = createServiceClient()
      const { data: phaseRows, error: gateError } = await svc
        .from('matches')
        .select('phase, status')
        .eq('tournament_id', match.tournament_id)
      if (gateError) return { error: 'Could not verify the group stage. Try again.' }
      if (!groupStageComplete(phaseRows ?? [])) {
        return { error: 'All group-stage matches must be finished before knockout play can begin.' }
      }
    }

    // Knockout finish: auto-set winner for decisive result; block draw without winner
    if (next === 'finished' && match.phase === 'knockout' && !match.winner_team_id) {
      const svc = createServiceClient()
      if (match.home_score > match.away_score) {
        const { error } = await svc
          .from('matches')
          .update({ winner_team_id: match.home_team_id })
          .eq('id', match.id)
        if (error) return { error: error.message }
      } else if (match.away_score > match.home_score) {
        const { error } = await svc
          .from('matches')
          .update({ winner_team_id: match.away_team_id })
          .eq('id', match.id)
        if (error) return { error: error.message }
      } else {
        return { error: 'This knockout match is level. The organizer must pick the advancing team before ending the match.' }
      }
    }

    if (!isValidTransition(match.status, next, 'organizer')) {
      return { error: `Cannot move from ${match.status} to ${next}.` }
    }

    const svc = createServiceClient()
    const patch: Record<string, unknown> = { status: next }
    if (next === 'live') {
      if (!match.match_started_at) patch.match_started_at = new Date().toISOString()
      if (match.status === 'halftime' && !match.second_half_started_at) {
        patch.second_half_started_at = new Date().toISOString()
      }
    }
    if (next === 'halftime' && !match.halftime_started_at) {
      patch.halftime_started_at = new Date().toISOString()
    }
    if (next === 'finished') {
      patch.match_finished_at = new Date().toISOString()
    }

    const { error } = await svc.from('matches').update(patch).eq('id', match.id)
    if (error) return { error: error.message }

    revalidatePath(`/score/m/${token}`)
    revalidatePath(`/t/${match.tournament_id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
