'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { createTeam, deleteTeam, setTeamGroup } from '@/lib/db/teams'
import { createPlayer, deletePlayer } from '@/lib/db/players'
import { listMatches } from '@/lib/db/matches'

async function ensureOrganizer(tournamentId: string) {
  const user = await requireUser()
  if (await isAdmin(user.id)) return
  if (!(await isOrganizer(user.id, tournamentId))) throw new Error('Not authorized.')
}

export async function addTeamAction(
  tournamentId: string,
  name: string,
): Promise<{ id: string } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const result = await createTeam(tournamentId, name)
    if ('id' in result) revalidatePath(`/admin/tournaments/${tournamentId}/teams`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function setTeamGroupAction(
  teamId: string,
  tournamentId: string,
  groupLabel: string | null,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    if (groupLabel !== null && !/^[A-Z]$/.test(groupLabel)) {
      return { error: 'Group label must be a single uppercase letter.' }
    }
    const matches = await listMatches(tournamentId)
    if (matches.some((m) => m.status !== 'scheduled')) {
      return { error: 'Group assignment is locked — a match has already gone live.' }
    }
    const result = await setTeamGroup(teamId, groupLabel)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/teams`)
    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function deleteTeamAction(
  teamId: string,
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const result = await deleteTeam(teamId)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/teams`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function addPlayerAction(input: {
  team_id: string
  name: string
  jersey_number: number | null
  position: string | null
  tournamentId: string
}): Promise<{ id: string } | { error: string }> {
  try {
    await ensureOrganizer(input.tournamentId)
    const result = await createPlayer({
      team_id: input.team_id,
      name: input.name,
      jersey_number: input.jersey_number,
      position: input.position,
    })
    if ('id' in result) revalidatePath(`/admin/tournaments/${input.tournamentId}/teams`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function deletePlayerAction(
  playerId: string,
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const result = await deletePlayer(playerId)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/teams`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
