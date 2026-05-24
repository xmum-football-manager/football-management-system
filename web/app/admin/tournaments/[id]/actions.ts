'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { getMatch, updateMatchScore, updateMatchStatus, updateMatchTime } from '@/lib/db/matches'
import { logMatchRevert } from '@/lib/db/audit'
import { isValidTransition } from '@/lib/match-lifecycle'
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
    const role: 'admin' | 'organizer' = admin && asAdmin ? 'admin' : 'organizer'
    if (!isValidTransition(match.status, next, role)) {
      return { error: `Cannot move from ${match.status} to ${next}.` }
    }
    const result = await updateMatchStatus(matchId, next)
    if (result.error) return { error: result.error }

    if (admin && asAdmin && match.status === 'finished' && next === 'live') {
      await logMatchRevert(user.id, matchId, match.tournament_id, 'finished')
    }
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
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
