'use server'

import { revalidatePath } from 'next/cache'
import { requireScorekeeperUser } from '@/lib/auth'
import { listScorekeeperMatchesForUser } from '@/lib/db/roles'
import { getMatch, updateMatchStatus } from '@/lib/db/matches'
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
