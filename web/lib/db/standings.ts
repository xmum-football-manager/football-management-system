import type { SupabaseClient } from '@supabase/supabase-js'
import type { Standing } from '@/lib/supabase/types'

export async function getTournamentStandings(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<Standing[]> {
  const { data, error } = await supabase
    .from('standings')
    .select('*')
    .eq('tournament_id', tournamentId)
  if (error) throw new Error(error.message)
  return (data as Standing[]) ?? []
}

export async function getTeamStanding(
  supabase: SupabaseClient,
  teamId: string,
  tournamentId: string,
): Promise<Standing | null> {
  const { data, error } = await supabase
    .from('standings')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('team_id', teamId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(error.message)
  }
  return data as Standing
}
