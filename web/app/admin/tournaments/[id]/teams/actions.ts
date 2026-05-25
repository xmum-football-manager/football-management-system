'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { createTeam, deleteTeam, listTeams, setTeamGroup } from '@/lib/db/teams'
import { createPlayer, deletePlayer } from '@/lib/db/players'
import { listMatches } from '@/lib/db/matches'
import type { CsvRow } from '@/lib/csv'

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

export async function importTeamsCsvAction(
  tournamentId: string,
  rows: CsvRow[],
): Promise<{ teamsCreated: number; playersAdded: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)

    const existing = await listTeams(tournamentId)
    const teamIdByName = new Map<string, string>(existing.map((t) => [t.name.toLowerCase(), t.id]))

    let teamsCreated = 0
    let playersAdded = 0

    const grouped = new Map<string, CsvRow[]>()
    for (const row of rows) {
      const key = row.team
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(row)
    }

    for (const [teamName, teamRows] of grouped) {
      let teamId = teamIdByName.get(teamName.toLowerCase())
      if (!teamId) {
        const result = await createTeam(tournamentId, teamName)
        if ('error' in result) return { error: `Creating team "${teamName}": ${result.error}` }
        teamId = result.id
        teamIdByName.set(teamName.toLowerCase(), teamId)
        teamsCreated++
      }

      for (const row of teamRows) {
        const result = await createPlayer({
          team_id: teamId,
          name: row.player_name,
          jersey_number: row.jersey_number,
          position: row.position,
        })
        if ('id' in result) playersAdded++
      }
    }

    revalidatePath(`/admin/tournaments/${tournamentId}/teams`)
    return { teamsCreated, playersAdded }
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
