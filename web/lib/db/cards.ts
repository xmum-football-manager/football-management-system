import { createClient } from '@/lib/supabase/server'
import type { Card, TeamCardCount } from '@/lib/supabase/types'

export type { Card }

export interface InsertCardInput {
  match_id: string
  team_id: string
  player_id: string
  card_type: 'yellow' | 'red'
}

export async function listCards(matchId: string): Promise<Card[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Card[]
}

export async function insertCard(input: InsertCardInput): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cards')
    .insert(input)
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function deleteCard(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function listTeamCardCounts(teamId: string): Promise<TeamCardCount | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('team_card_counts')
    .select('*')
    .eq('team_id', teamId)
    .maybeSingle()
  if (error) throw error
  return (data as TeamCardCount) ?? null
}

export async function listTeamCardCountsByTournament(tournamentId: string): Promise<TeamCardCount[]> {
  const supabase = await createClient()
  // Join via teams to filter by tournament
  const { data, error } = await supabase
    .from('team_card_counts')
    .select('*, teams!inner(tournament_id)')
    .eq('teams.tournament_id', tournamentId)
  if (error) throw error
  return (data ?? []) as TeamCardCount[]
}
