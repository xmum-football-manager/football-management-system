'use server'

import { requireAdmin } from '@/lib/auth'
import { createTournament, type CreateTournamentInput } from '@/lib/db/tournaments'
import { revalidatePath } from 'next/cache'

export async function createTournamentAction(
  input: CreateTournamentInput,
): Promise<{ id: string } | { error: string }> {
  await requireAdmin()
  const result = await createTournament(input)
  if ('id' in result) revalidatePath('/admin')
  return result
}
