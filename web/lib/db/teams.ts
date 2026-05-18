import { createClient } from '@/lib/supabase/client'
import type { TeamWithPlayers, TournamentStatus } from '@/lib/supabase/types'

export async function getTeams(tournamentId: string): Promise<TeamWithPlayers[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('teams')
    .select('*, players(*)')
    .eq('tournament_id', tournamentId)
    .order('name')
  if (error) throw error
  return (data as TeamWithPlayers[]) ?? []
}

export async function createTeam(tournamentId: string, name: string) {
  const supabase = createClient()
  return supabase.from('teams').insert({ tournament_id: tournamentId, name })
}

export async function createTeamsBatch(tournamentId: string, names: string[]) {
  const supabase = createClient()
  const inserts = names.map(name => ({ tournament_id: tournamentId, name }))
  return supabase.from('teams').insert(inserts).select('id, name')
}

export async function renameTeam(teamId: string, name: string) {
  const supabase = createClient()
  return supabase.from('teams').update({ name }).eq('id', teamId)
}

export async function deleteTeam(teamId: string) {
  const supabase = createClient()
  return supabase.from('teams').delete().eq('id', teamId)
}

export async function getTournamentStatus(tournamentId: string): Promise<TournamentStatus | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single()
  return (data?.status as TournamentStatus) ?? null
}
