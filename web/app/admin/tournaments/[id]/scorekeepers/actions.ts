'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { assignRole, findUserIdByEmail, getScorekeeperTournamentIds, isAdmin, isOrganizer, removeRole } from '@/lib/db/roles'
import { createClubUser } from '@/lib/users'

async function ensureOrganizer(tournamentId: string) {
  const user = await requireUser()
  if (await isAdmin(user.id)) return
  if (!(await isOrganizer(user.id, tournamentId))) throw new Error('Not authorized.')
}

async function checkSingleTournament(userId: string, tournamentId: string): Promise<{ error: string } | null> {
  const others = (await getScorekeeperTournamentIds(userId)).filter((t) => t !== tournamentId)
  if (others.length > 0) {
    return { error: 'This account already keeps score for another tournament. A scorekeeper can only belong to one tournament.' }
  }
  return null
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
    if (!userId) {
      return { error: `No account with email "${input.email}".` }
    }
    const guard = await checkSingleTournament(userId, input.tournamentId)
    if (guard) return guard
    const result = await assignRole({
      user_id: userId,
      role: 'scorekeeper',
      tournament_id: input.scope === 'tournament' ? input.tournamentId : null,
      match_id: input.scope === 'match' ? input.matchId : null,
    })
    if ('id' in result) revalidatePath(`/admin/tournaments/${input.tournamentId}/scorekeepers`)
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
    const result = await removeRole(roleId)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/scorekeepers`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function createAndAssignScorekeeperAction(input: {
  tournamentId: string
  email: string
  password: string
  scope: 'tournament' | 'match'
  matchId: string | null
}): Promise<{ id: string; alreadyExisted?: boolean } | { error: string }> {
  try {
    await ensureOrganizer(input.tournamentId)

    const trimmedEmail = input.email.trim().toLowerCase()
    if (!trimmedEmail) return { error: 'Email is required.' }
    if (input.scope === 'match' && !input.matchId) return { error: 'A match is required for match-scoped assignment.' }
    if (input.password.length < 6) return { error: 'Password must be at least 6 characters.' }

    let userId: string
    let alreadyExisted = false

    const created = await createClubUser({ email: trimmedEmail, password: input.password })
    if ('error' in created) return { error: created.error }

    if ('alreadyExists' in created) {
      alreadyExisted = true
      const found = await findUserIdByEmail(trimmedEmail)
      if (!found) return { error: `No account with email "${trimmedEmail}".` }
      userId = found
    } else {
      userId = created.userId
    }

    const guard = await checkSingleTournament(userId, input.tournamentId)
    if (guard) return guard

    const result = await assignRole({
      user_id: userId,
      role: 'scorekeeper',
      tournament_id: input.scope === 'tournament' ? input.tournamentId : null,
      match_id: input.scope === 'match' ? input.matchId : null,
    })
    if ('error' in result) return result

    revalidatePath(`/admin/tournaments/${input.tournamentId}/scorekeepers`)
    return { id: result.id, alreadyExisted }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
