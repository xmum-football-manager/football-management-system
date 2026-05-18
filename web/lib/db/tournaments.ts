import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tournament } from '@/lib/supabase/types'

export async function getTournament(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null // not found
    throw new Error(error.message)
  }
  return data as Tournament
}

export async function updateTournament(
  supabase: SupabaseClient,
  tournamentId: string,
  patch: Partial<Tournament>,
): Promise<void> {
  const { error } = await supabase.from('tournaments').update(patch).eq('id', tournamentId)
  if (error) throw new Error(error.message)
}

export async function goLive(supabase: SupabaseClient, tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', tournamentId)
  if (error) throw new Error(error.message)
}

export async function finishTournament(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'finished' })
    .eq('id', tournamentId)
  if (error) throw new Error(error.message)
}

export async function getCurrentUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getUserRoles(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, tournament_id')
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  return data ?? []
}
