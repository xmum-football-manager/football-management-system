import type { SupabaseClient } from '@supabase/supabase-js'
import type { MatchWithTeams, MatchStatus, Match } from '@/lib/supabase/types'

export async function getMatches(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<MatchWithTeams[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('tournament_id', tournamentId)
    .order('match_time', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as MatchWithTeams[]) ?? []
}

export async function createMatch(
  supabase: SupabaseClient,
  tournamentId: string,
  homeTeamId: string,
  awayTeamId: string,
  matchTime: string,
): Promise<void> {
  const { error } = await supabase.from('matches').insert({
    tournament_id: tournamentId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    match_time: matchTime,
  })
  if (error) throw new Error(error.message)
}

export async function deleteMatch(supabase: SupabaseClient, matchId: string): Promise<void> {
  const { error } = await supabase.from('matches').delete().eq('id', matchId)
  if (error) throw new Error(error.message)
}

export async function updateMatchTime(
  supabase: SupabaseClient,
  matchId: string,
  matchTime: string,
): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ match_time: matchTime })
    .eq('id', matchId)
  if (error) throw new Error(error.message)
}

export async function updateMatchScore(
  supabase: SupabaseClient,
  matchId: string,
  homeScore: number,
  awayScore: number,
): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ home_score: homeScore, away_score: awayScore })
    .eq('id', matchId)
    .eq('status', 'live')
  if (error) throw new Error(error.message)
}

export async function transitionMatchStatus(
  supabase: SupabaseClient,
  matchId: string,
  currentStatus: MatchStatus,
  nextStatus: MatchStatus,
  timestamps?: { match_started_at?: string | null; match_finished_at?: string | null },
): Promise<void> {
  const update: Partial<Match> = { status: nextStatus }
  if (timestamps) Object.assign(update, timestamps)
  const { error } = await supabase
    .from('matches')
    .update(update)
    .eq('id', matchId)
    .eq('status', currentStatus)
  if (error) throw new Error(error.message)
}

export async function getScoreableMatches(
  supabase: SupabaseClient,
  matchIds: string[],
  tournamentIds: string[],
): Promise<MatchWithTeams[]> {
  const filters: string[] = []
  if (matchIds.length > 0) filters.push(`id.in.(${matchIds.join(',')})`)
  if (tournamentIds.length > 0) filters.push(`tournament_id.in.(${tournamentIds.join(',')})`)
  if (filters.length === 0) return []
  const { data, error } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .in('status', ['scheduled', 'live', 'halftime'])
    .or(filters.join(','))
    .order('match_time', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as MatchWithTeams[]) ?? []
}

export async function logRevertAudit(
  supabase: SupabaseClient,
  matchId: string,
  tournamentId: string,
): Promise<void> {
  const { error } = await supabase.from('admin_audit_log').insert({
    action: 'revert_finished_to_live',
    match_id: matchId,
    tournament_id: tournamentId,
    previous_status: 'finished',
    new_status: 'live',
  })
  if (error) throw new Error(error.message)
}
