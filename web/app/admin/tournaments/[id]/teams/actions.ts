'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { createTeam, deleteTeam, setTeamGroup, setTeamLogo, listTeams } from '@/lib/db/teams'
import { createPlayer, deletePlayer, setPlayerPhoto, updatePlayer } from '@/lib/db/players'
import { listMatches } from '@/lib/db/matches'
import { getTournament } from '@/lib/db/tournaments'
import { canAddPlayers } from '@/lib/lock-rules'

async function ensureOrganizer(tournamentId: string) {
  const user = await requireUser()
  if (await isAdmin(user.id)) return
  if (!(await isOrganizer(user.id, tournamentId))) throw new Error('Not authorized.')
}

function revalidateTeams(tournamentId: string) {
  revalidatePath(`/admin/tournaments/${tournamentId}/teams`)
  revalidatePath(`/admin/tournaments/${tournamentId}/rd-teams`)
  revalidatePath(`/admin/tournaments/${tournamentId}/ko-teams`)
  revalidatePath(`/admin/tournaments/${tournamentId}`)
}

export async function addTeamAction(
  tournamentId: string,
  name: string,
): Promise<{ id: string } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const result = await createTeam(tournamentId, name)
    if ('id' in result) revalidateTeams(tournamentId)
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
    revalidateTeams(tournamentId)
    revalidatePath(`/admin/tournaments/${tournamentId}/rd-fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}/ko-fixtures`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function setTeamLogoAction(
  teamId: string,
  tournamentId: string,
  logoPath: string | null,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const result = await setTeamLogo(teamId, logoPath)
    if (result.error) return { error: result.error }
    revalidateTeams(tournamentId)
    revalidatePath(`/t/${tournamentId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function setPlayerPhotoAction(
  playerId: string,
  tournamentId: string,
  photoPath: string | null,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const result = await setPlayerPhoto(playerId, photoPath)
    if (result.error) return { error: result.error }
    revalidateTeams(tournamentId)
    revalidatePath(`/t/${tournamentId}`)
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
    revalidateTeams(tournamentId)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function addPlayerAction(input: {
  team_id: string
  name: string
  jersey_number: number | null
  tournamentId: string
}): Promise<{ id: string } | { error: string }> {
  try {
    await ensureOrganizer(input.tournamentId)
    const tournament = await getTournament(input.tournamentId)
    if (!tournament) return { error: 'Tournament not found.' }
    if (!canAddPlayers(tournament.status)) {
      return { error: 'This tournament is locked — players can no longer be edited.' }
    }
    const result = await createPlayer({
      team_id: input.team_id,
      name: input.name,
      jersey_number: input.jersey_number,
    })
    if ('id' in result) revalidateTeams(input.tournamentId)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function updatePlayerAction(input: {
  playerId: string
  name: string
  jersey_number: number | null
  tournamentId: string
}): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(input.tournamentId)
    // Renaming is always safe — it's the same player row, so recorded goals and
    // cards (which reference player_id) are preserved. Allowed even after kickoff
    // so a typo'd name can be corrected; only finished/archived tournaments lock.
    const tournament = await getTournament(input.tournamentId)
    if (!tournament) return { error: 'Tournament not found.' }
    if (!canAddPlayers(tournament.status)) {
      return { error: 'This tournament is locked — players can no longer be edited.' }
    }
    const name = input.name.trim()
    if (!name) return { error: 'Player name is required.' }
    const result = await updatePlayer(input.playerId, { name, jersey_number: input.jersey_number })
    if (result.error) return { error: result.error }
    revalidateTeams(input.tournamentId)
    return { ok: true }
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
    // Adding players stays open once play begins, but deleting is locked — a
    // removed player could already have goals/cards recorded against them.
    const matches = await listMatches(tournamentId)
    if (matches.some((m) => m.status !== 'scheduled')) {
      return { error: 'Cannot delete players — a match has already gone live.' }
    }
    const result = await deletePlayer(playerId)
    if (result.error) return { error: result.error }
    revalidateTeams(tournamentId)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export interface ImportPlayerInput {
  name: string
  jersey_number: number | null
}

export interface ImportTeamInput {
  name: string
  players: ImportPlayerInput[]
}

export async function importTeamsAction(
  tournamentId: string,
  teams: ImportTeamInput[],
): Promise<{ ok: true; teamCount: number; playerCount: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const existing = await listTeams(tournamentId)
    if (existing.length > 0) {
      return { error: 'Teams already exist. Import is only available when the tournament has no teams.' }
    }
    let playerCount = 0
    // No transaction: partial failure leaves orphan teams (Supabase JS has no transaction API here).
    // Recovery: organizer must delete teams manually or via future delete-all action.
    for (const team of teams) {
      const teamResult = await createTeam(tournamentId, team.name)
      if ('error' in teamResult) return { error: `Failed to create team "${team.name}": ${teamResult.error}` }
      for (const player of team.players) {
        const playerResult = await createPlayer({
          team_id: teamResult.id,
          name: player.name,
          jersey_number: player.jersey_number,
        })
        if ('error' in playerResult) return { error: `Failed to add player "${player.name}": ${playerResult.error}` }
        playerCount++
      }
    }
    revalidateTeams(tournamentId)
    return { ok: true, teamCount: teams.length, playerCount }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Import failed.' }
  }
}
