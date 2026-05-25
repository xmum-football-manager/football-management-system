'use server'

import { revalidatePath } from 'next/cache'
import { requireUser, requireAdmin } from '@/lib/auth'
import { assignRole, findUserIdByEmail, isAdmin, isOrganizer, removeRole } from '@/lib/db/roles'

async function ensureOrganizer(tournamentId: string) {
  const user = await requireUser()
  if (await isAdmin(user.id)) return
  if (!(await isOrganizer(user.id, tournamentId))) throw new Error('Not authorized.')
}

export async function assignOrganizerAction(
  tournamentId: string,
  email: string,
): Promise<{ id: string } | { error: string }> {
  try {
    await requireAdmin()
    const userId = await findUserIdByEmail(email)
    if (!userId) return { error: `No account with email "${email}".` }
    const result = await assignRole({
      user_id: userId,
      role: 'organizer',
      tournament_id: tournamentId,
    })
    if ('id' in result) revalidatePath(`/admin/tournaments/${tournamentId}/users`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function removeOrganizerAction(
  roleId: string,
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireAdmin()
    const r = await removeRole(roleId)
    if (r.error) return { error: r.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/users`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function assignScorekeeperAction(input: {
  tournamentId: string
  email: string
  scope: 'tournament' | 'match'
  matchId: string | null
}): Promise<{ id: string } | { error: string }> {
  try {
    await ensureOrganizer(input.tournamentId)
    const userId = await findUserIdByEmail(input.email)
    if (!userId) return { error: `No account with email "${input.email}".` }
    const result = await assignRole({
      user_id: userId,
      role: 'scorekeeper',
      tournament_id: input.scope === 'tournament' ? input.tournamentId : null,
      match_id: input.scope === 'match' ? input.matchId : null,
    })
    if ('id' in result) revalidatePath(`/admin/tournaments/${input.tournamentId}/users`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function removeScorekeeperAction(
  roleId: string,
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const r = await removeRole(roleId)
    if (r.error) return { error: r.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/users`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
