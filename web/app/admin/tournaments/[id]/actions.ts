'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { getMatch, updateMatchScore, updateMatchStatus, updateMatchTime } from '@/lib/db/matches'
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
    // 1-live guard: only one match may be live or at halftime at a time.
    // Exclude the current match so halftime → live (2nd half) is not blocked by itself.
    if (next === 'live') {
      const supabase = await createClient()
      const { count, error: countError } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', match.tournament_id)
        .in('status', ['live', 'halftime'])
        .neq('id', matchId)
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
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    revalidatePath(`/admin/tournaments/${match.tournament_id}/fixtures`)
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
