import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Match, MatchStatus, MatchWithTeams } from '@/lib/supabase/types'

export async function listMatches(tournamentId: string): Promise<MatchWithTeams[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('tournament_id', tournamentId)
    .order('match_time', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as MatchWithTeams[]
}

export async function listMatchesAdmin(tournamentId: string): Promise<MatchWithTeams[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('tournament_id', tournamentId)
    .order('match_time', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as unknown as MatchWithTeams[]
}

export async function getMatch(id: string): Promise<Match | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('matches').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Match) ?? null
}

export interface CreateMatchInput {
  tournament_id: string
  home_team_id: string | null
  away_team_id: string | null
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
      home_team_id: input.home_team_id,
      away_team_id: input.away_team_id,
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
      home_team_id: input.home_team_id,
      away_team_id: input.away_team_id,
      match_time: input.match_time,
      ...(input.phase != null && { phase: input.phase }),
      ...(input.knockout_round != null && { knockout_round: input.knockout_round }),
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
  }
  if (status === 'finished') {
    patch.match_finished_at = new Date().toISOString()
  }
  const { error } = await supabase.from('matches').update(patch).eq('id', id)
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
  home_team_id: string,
  away_team_id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('matches')
    .update({ home_team_id, away_team_id })
    .eq('id', id)
  if (error) return { error: error.message }
  return {}
}

/**
 * Fill one team slot (home or away) of a knockout match with a concrete team.
 * Uses the service client so auto-advance works regardless of the actor's RLS.
 */
export async function setMatchSlotTeam(
  id: string,
  slot: 'home' | 'away',
  teamId: string,
): Promise<{ error?: string }> {
  const supabase = createServiceClient()
  const patch = slot === 'home' ? { home_team_id: teamId } : { away_team_id: teamId }
  const { error } = await supabase.from('matches').update(patch).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

/** Record who advances from a match (auto from score or admin-picked on a draw). */
export async function setMatchWinner(
  id: string,
  winnerTeamId: string,
): Promise<{ error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('matches').update({ winner_team_id: winnerTeamId }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

/**
 * Wire a later-round match to the two matches whose winners feed its slots.
 * Service client so skeleton wiring matches the service-client inserts (no RLS
 * UPDATE policy assumption).
 */
export async function setMatchFeeders(
  id: string,
  homeSourceMatchId: string | null,
  awaySourceMatchId: string | null,
): Promise<{ error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('matches')
    .update({ home_source_match_id: homeSourceMatchId, away_source_match_id: awaySourceMatchId })
    .eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function deleteMatch(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('matches').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}
