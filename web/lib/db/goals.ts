import { createClient } from '@/lib/supabase/server'
import type { Goal, TopScorer } from '@/lib/supabase/types'

export type { Goal }

export async function listGoals(matchId: string): Promise<Goal[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Goal[]
}

export async function recordGoal(
  matchId: string,
  teamId: string,
  playerId: string | null,
): Promise<{ home_score: number; away_score: number } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_goal', {
    p_match_id: matchId,
    p_team_id: teamId,
    p_player_id: playerId,
  })
  if (error) return { error: error.message }
  const row = (data as { home_score: number; away_score: number }[])[0]
  return row
}

export interface MatchScorer {
  id: string
  team_id: string
  player_id: string | null
  player_name: string | null
  jersey_number: number | null
  created_at: string
}

/** Chronological goal log for a match, with scorer names resolved (null = unspecified). */
export async function listMatchScorers(matchId: string): Promise<MatchScorer[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('goals')
    .select('id, team_id, player_id, created_at, player:players(name, jersey_number)')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
  if (error) throw error
  type Row = {
    id: string
    team_id: string
    player_id: string | null
    created_at: string
    player: { name: string; jersey_number: number | null } | null
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    team_id: r.team_id,
    player_id: r.player_id,
    player_name: r.player?.name ?? null,
    jersey_number: r.player?.jersey_number ?? null,
    created_at: r.created_at,
  }))
}

export async function undoGoal(
  matchId: string,
  teamId: string,
): Promise<{ home_score: number; away_score: number } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('undo_goal', {
    p_match_id: matchId,
    p_team_id: teamId,
  })
  if (error) return { error: error.message }
  const row = (data as { home_score: number; away_score: number }[])[0]
  return row
}

export async function listTopScorers(tournamentId: string): Promise<TopScorer[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('top_scorers')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('goals', { ascending: false })
  if (error) throw error
  return (data ?? []) as TopScorer[]
}
