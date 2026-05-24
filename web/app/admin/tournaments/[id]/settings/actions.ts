'use server'

import { revalidatePath } from 'next/cache'
import { requireUser, requireAdmin } from '@/lib/auth'
import {
  assignRole,
  findUserIdByEmail,
  isAdmin,
  isOrganizer,
  removeRole,
} from '@/lib/db/roles'
import { deleteTournament, updateTournamentStatus } from '@/lib/db/tournaments'

async function ensureOrganizer(tournamentId: string) {
  const user = await requireUser()
  if (await isAdmin(user.id)) return
  if (!(await isOrganizer(user.id, tournamentId))) throw new Error('Not authorized.')
}

export async function finishTournamentAction(
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const r = await updateTournamentStatus(tournamentId, 'finished')
    if (r.error) return { error: r.error }
    revalidatePath('/admin')
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    revalidatePath(`/t/${tournamentId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function archiveTournamentAction(
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireAdmin()
    const r = await updateTournamentStatus(tournamentId, 'archived')
    if (r.error) return { error: r.error }
    revalidatePath('/admin')
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function deleteTournamentAction(
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireAdmin()
    const r = await deleteTournament(tournamentId)
    if (r.error) return { error: r.error }
    revalidatePath('/admin')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
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
    if ('id' in result) revalidatePath(`/admin/tournaments/${tournamentId}/settings`)
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
    revalidatePath(`/admin/tournaments/${tournamentId}/settings`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
