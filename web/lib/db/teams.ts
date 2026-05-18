import type { SupabaseClient } from '@supabase/supabase-js'
import type { TeamWithPlayers, TournamentStatus } from '@/lib/supabase/types'

export async function getTeams(supabase: SupabaseClient, tournamentId: string): Promise<TeamWithPlayers[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*, players(*)')
    .eq('tournament_id', tournamentId)
    .order('name')
  if (error) throw new Error(error.message)
  return (data as TeamWithPlayers[]) ?? []
}

export async function createTeam(supabase: SupabaseClient, tournamentId: string, name: string): Promise<void> {
  const { error } = await supabase.from('teams').insert({ tournament_id: tournamentId, name })
  if (error) throw new Error(error.message)
}

export async function createTeamsBatch(
  supabase: SupabaseClient,
  tournamentId: string,
  names: string[],
): Promise<{ id: string; name: string }[]> {
  const inserts = names.map(name => ({ tournament_id: tournamentId, name }))
  const { data, error } = await supabase.from('teams').insert(inserts).select('id, name')
  if (error) throw new Error(error.message)
  return (data as { id: string; name: string }[]) ?? []
}

export async function renameTeam(supabase: SupabaseClient, teamId: string, name: string): Promise<void> {
  const { error } = await supabase.from('teams').update({ name }).eq('id', teamId)
  if (error) throw new Error(error.message)
}

export async function deleteTeam(supabase: SupabaseClient, teamId: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) throw new Error(error.message)
}

export async function getTournamentStatus(supabase: SupabaseClient, tournamentId: string): Promise<TournamentStatus | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return (data?.status as TournamentStatus) ?? null
}
