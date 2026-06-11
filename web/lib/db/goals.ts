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
  playerId: string,
): Promise<{ home_score: number; away_score: number } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_goal', {
    p_match_id: matchId,
    p_player_id: playerId,
  })
  if (error) return { error: error.message }
  const row = (data as { home_score: number; away_score: number }[])[0]
  return row
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
