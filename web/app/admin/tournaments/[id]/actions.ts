'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { createMatchAdmin, getMatch, updateMatchScore, updateMatchStatus, updateMatchTime } from '@/lib/db/matches'
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

    // Auto-advance knockout bracket when both matches in a pair finish
    if (next === 'finished' && match.phase === 'knockout' && match.knockout_round) {
      await advanceBracketIfReady({ ...match, knockout_round: match.knockout_round }, matchId)
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

// Round progression for auto-advance
const ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'final'] as const
type KnockoutRound = (typeof ROUND_ORDER)[number]

function nextKnockoutRound(current: string): string | null {
  const idx = ROUND_ORDER.indexOf(current as KnockoutRound)
  if (idx < 0 || idx >= ROUND_ORDER.length - 1) return null
  return ROUND_ORDER[idx + 1]
}

async function advanceBracketIfReady(
  finishedMatch: {
    id: string
    tournament_id: string
    knockout_round: string
    home_team_id: string
    away_team_id: string
    home_score: number
    away_score: number
  },
  matchId: string,
) {
  try {
    const supabase = await createClient()
    const { data: roundMatches } = await supabase
      .from('matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, status, created_at')
      .eq('tournament_id', finishedMatch.tournament_id)
      .eq('phase', 'knockout')
      .eq('knockout_round', finishedMatch.knockout_round)
      .order('created_at', { ascending: true })

    if (!roundMatches || roundMatches.length < 2) return

    const idx = roundMatches.findIndex((m) => m.id === matchId)
    if (idx < 0) return

    const partnerIdx = idx % 2 === 0 ? idx + 1 : idx - 1
    const partner = roundMatches[partnerIdx]
    if (!partner || partner.status !== 'finished') return

    // Skip if either match is a draw (no clear winner)
    const thisWinner =
      finishedMatch.home_score > finishedMatch.away_score
        ? finishedMatch.home_team_id
        : finishedMatch.away_score > finishedMatch.home_score
          ? finishedMatch.away_team_id
          : null
    const partnerWinner =
      partner.home_score > partner.away_score
        ? partner.home_team_id
        : partner.away_score > partner.home_score
          ? partner.away_team_id
          : null
    if (!thisWinner || !partnerWinner) return

    const nextRound = nextKnockoutRound(finishedMatch.knockout_round)
    if (!nextRound) return

    // Lower-indexed match's winner is home
    const homeId = idx < partnerIdx ? thisWinner : partnerWinner
    const awayId = idx < partnerIdx ? partnerWinner : thisWinner

    // Don't create if a match involving these teams in this round already exists
    const { count } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', finishedMatch.tournament_id)
      .eq('phase', 'knockout')
      .eq('knockout_round', nextRound)
      .or(`home_team_id.eq.${homeId},away_team_id.eq.${homeId}`)
    if (count && count > 0) return

    await createMatchAdmin({
      tournament_id: finishedMatch.tournament_id,
      home_team_id: homeId,
      away_team_id: awayId,
      match_time: null,
      phase: 'knockout',
      knockout_round: nextRound,
    })
  } catch {
    // Auto-advance is best-effort — don't fail the transition
  }
}
