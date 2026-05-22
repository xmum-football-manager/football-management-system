'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { createMatch, deleteMatch } from '@/lib/db/matches'

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

export async function deleteMatchAction(
  matchId: string,
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
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
