import { createClient } from '@/lib/supabase/client'
import type { MatchWithTeams, MatchStatus } from '@/lib/supabase/types'

export async function getMatches(tournamentId: string): Promise<MatchWithTeams[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('tournament_id', tournamentId)
    .order('match_time', { ascending: true })
  if (error) throw error
  return (data as MatchWithTeams[]) ?? []
}

export async function createMatch(tournamentId: string, homeTeamId: string, awayTeamId: string, matchTime: string) {
  const supabase = createClient()
  return supabase.from('matches').insert({
    tournament_id: tournamentId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    match_time: matchTime,
  })
}

export async function deleteMatch(matchId: string) {
  const supabase = createClient()
  return supabase.from('matches').delete().eq('id', matchId)
}

export async function updateMatchTime(matchId: string, matchTime: string) {
  const supabase = createClient()
  return supabase.from('matches').update({ match_time: matchTime }).eq('id', matchId)
}

export async function updateMatchScore(matchId: string, homeScore: number, awayScore: number) {
  const supabase = createClient()
  return supabase
    .from('matches')
    .update({ home_score: homeScore, away_score: awayScore })
    .eq('id', matchId)
    .eq('status', 'live')
}

export async function transitionMatchStatus(
  matchId: string,
  currentStatus: MatchStatus,
  nextStatus: MatchStatus,
  timestamps?: { match_started_at?: string | null; match_finished_at?: string | null }
) {
  const supabase = createClient()
  const update: Record<string, string | null> = { status: nextStatus }
  if (timestamps) Object.assign(update, timestamps)
  return supabase
    .from('matches')
    .update(update)
    .eq('id', matchId)
    .eq('status', currentStatus)
}

export async function logRevertAudit(matchId: string, tournamentId: string) {
  const supabase = createClient()
  return supabase.from('admin_audit_log').insert({
    action: 'revert_finished_to_live',
    match_id: matchId,
    tournament_id: tournamentId,
    previous_status: 'finished',
    new_status: 'live',
  })
}
