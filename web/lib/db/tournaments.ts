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

export async function endGroupStage(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'bracket_setup' })
    .eq('id', tournamentId)
  if (error) throw new Error(error.message)
}

export async function startKnockoutPhase(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'knockout' })
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

export async function getAllUserRoles(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, role, tournament_id')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getLiveTournaments(supabase: SupabaseClient): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['active', 'bracket_setup', 'knockout'])
    .order('start_date', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as Tournament[]) ?? []
}

export async function getAllTournaments(supabase: SupabaseClient): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Tournament[]) ?? []
}

export async function getTournamentsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Tournament[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .in('id', ids)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Tournament[]) ?? []
}

export async function pingTournaments(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.from('tournaments').select('id').limit(1)
  if (error) throw new Error(error.message)
}

export async function createTournament(
  supabase: SupabaseClient,
  fields: Partial<Tournament>,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert(fields)
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}
