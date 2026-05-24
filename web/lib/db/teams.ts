import { createClient } from '@/lib/supabase/server'
import type { Team, TeamWithPlayers, Player } from '@/lib/supabase/types'

export async function listTeams(tournamentId: string): Promise<Team[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Team[]
}

export async function listTeamsWithPlayers(tournamentId: string): Promise<TeamWithPlayers[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teams')
    .select('*, players(*)')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true })
  if (error) throw error
  return ((data ?? []) as (Team & { players: Player[] })[]).map((t) => ({
    ...t,
    players: (t.players ?? []).sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999)),
  }))
}

export async function createTeam(
  tournamentId: string,
  name: string,
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('teams')
    .insert({ tournament_id: tournamentId, name })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function deleteTeam(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('teams').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function renameTeam(id: string, name: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('teams').update({ name }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function setTeamGroup(
  id: string,
  group_label: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('teams').update({ group_label }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}
