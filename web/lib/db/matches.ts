import { createClient, createServiceClient } from '@/lib/supabase/server'
import { withTeamFallback } from '@/lib/match-teams'
import type { Match, MatchStatus, MatchWithTeams } from '@/lib/supabase/types'

export async function listMatches(tournamentId: string): Promise<MatchWithTeams[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('tournament_id', tournamentId)
    .order('match_time', { ascending: true })
  if (error) throw error
  return withTeamFallback((data ?? []) as unknown as MatchWithTeams[])
}

export async function listMatchesAdmin(tournamentId: string): Promise<MatchWithTeams[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('tournament_id', tournamentId)
    .order('phase', { ascending: true })
    .order('match_time', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return withTeamFallback((data ?? []) as unknown as MatchWithTeams[])
}

export async function getMatch(id: string): Promise<Match | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('matches').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Match) ?? null
}

export interface CreateMatchInput {
  tournament_id: string
  home_team_id?: string | null
  away_team_id?: string | null
  match_time: string | null
  phase?: string
  knockout_round?: string
  home_source_match_id?: string | null
  away_source_match_id?: string | null
}

export async function createMatchAdmin(input: CreateMatchInput): Promise<{ id: string } | { error: string }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('matches')
    .insert({
      tournament_id: input.tournament_id,
      home_team_id: input.home_team_id ?? null,
      away_team_id: input.away_team_id ?? null,
      match_time: input.match_time,
      ...(input.phase != null && { phase: input.phase }),
      ...(input.knockout_round != null && { knockout_round: input.knockout_round }),
      ...(input.home_source_match_id != null && { home_source_match_id: input.home_source_match_id }),
      ...(input.away_source_match_id != null && { away_source_match_id: input.away_source_match_id }),
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function createMatch(input: CreateMatchInput): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('matches')
    .insert({
      tournament_id: input.tournament_id,
      home_team_id: input.home_team_id ?? null,
      away_team_id: input.away_team_id ?? null,
      match_time: input.match_time,
      ...(input.phase != null && { phase: input.phase }),
      ...(input.knockout_round != null && { knockout_round: input.knockout_round }),
      ...(input.home_source_match_id != null && { home_source_match_id: input.home_source_match_id }),
      ...(input.away_source_match_id != null && { away_source_match_id: input.away_source_match_id }),
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function updateMatchScore(
  id: string,
  home_score: number,
  away_score: number,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('matches').update({ home_score, away_score }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function updateMatchStatus(
  id: string,
  status: MatchStatus,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'live') {
    const existing = await getMatch(id)
    if (existing && !existing.match_started_at) {
      patch.match_started_at = new Date().toISOString()
    }
    if (existing?.status === 'halftime' && !existing.second_half_started_at) {
      patch.second_half_started_at = new Date().toISOString()
    }
  }
  if (status === 'halftime') {
    const existing = await getMatch(id)
    if (existing && !existing.halftime_started_at) {
      patch.halftime_started_at = new Date().toISOString()
    }
  }
  if (status === 'finished') {
    patch.match_finished_at = new Date().toISOString()
  }
  const { error } = await supabase.from('matches').update(patch).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

// Admin-only "Revert" of a finished match: resets score, lifecycle
// timestamps, and goal/card history so the match restarts clean on the next
// kickoff, rather than resuming on top of the previous result.
export async function revertMatchToScheduled(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('revert_match_to_scheduled', { p_match_id: id })
  if (error) return { error: error.message }
  return {}
}

export async function updateMatchTime(id: string, match_time: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('matches').update({ match_time }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function updateMatchTeams(
  id: string,
  home_team_id: string | null,
  away_team_id: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('matches')
    .update({ home_team_id, away_team_id })
    .eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function updateMatchWinner(id: string, winner_team_id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('matches').update({ winner_team_id }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function clearMatchWinner(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('matches').update({ winner_team_id: null }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function deleteMatch(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('matches').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}
