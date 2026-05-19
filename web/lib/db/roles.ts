import type { SupabaseClient } from '@supabase/supabase-js'

export async function assignScorekeeper(supabase: SupabaseClient, email: string, tournamentId: string, matchId: string | null) {
  const { data: userId, error: userErr } = await supabase
    .rpc('get_user_id_by_email', { email_input: email.trim().toLowerCase() })
  if (userErr || !userId) throw new Error('User not found. Make sure they have an account.')

  const { error } = await supabase.from('user_roles').insert({
    user_id: userId, role: 'scorekeeper', tournament_id: tournamentId, match_id: matchId,
  })
  if (error) throw new Error(error.message)
}

export async function removeScorekeeper(supabase: SupabaseClient, userId: string, tournamentId: string, matchId: string | null) {
  let q = supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'scorekeeper').eq('tournament_id', tournamentId)
  q = matchId ? q.eq('match_id', matchId) : q.is('match_id', null)
  const { error } = await q
  if (error) throw new Error(error.message)
}

export async function assignOrganizer(supabase: SupabaseClient, email: string, tournamentId: string) {
  const { data: userId, error: userErr } = await supabase
    .rpc('get_user_id_by_email', { email_input: email.trim().toLowerCase() })
  if (userErr || !userId) throw new Error('User not found.')

  const { error } = await supabase.from('user_roles').upsert(
    { user_id: userId, role: 'organizer', tournament_id: tournamentId },
    { onConflict: 'user_id,role,tournament_id' }
  )
  if (error) throw new Error(error.message)
}

export async function removeOrganizer(supabase: SupabaseClient, userId: string, tournamentId: string) {
  const { error } = await supabase.from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role', 'organizer')
    .eq('tournament_id', tournamentId)
  if (error) throw new Error(error.message)
}

export async function getScorekeepersForTournament(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<Array<{ user_id: string; match_id: string | null }>> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, match_id')
    .eq('role', 'scorekeeper')
    .eq('tournament_id', tournamentId)
  if (error) throw new Error(error.message)
  return (data as Array<{ user_id: string; match_id: string | null }>) ?? []
}

export async function getOrganizersForTournament(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<Array<{ user_id: string }>> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'organizer')
    .eq('tournament_id', tournamentId)
  if (error) throw new Error(error.message)
  return (data as Array<{ user_id: string }>) ?? []
}

export async function getScorekeeperAssignments(
  supabase: SupabaseClient,
  userId: string,
): Promise<Array<{ tournament_id: string | null; match_id: string | null }>> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('tournament_id, match_id')
    .eq('user_id', userId)
    .eq('role', 'scorekeeper')
  if (error) throw new Error(error.message)
  return (data as Array<{ tournament_id: string | null; match_id: string | null }>) ?? []
}

export async function createUserRole(
  supabase: SupabaseClient,
  userId: string,
  role: string,
  tournamentId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role, tournament_id: tournamentId })
  if (error) throw new Error(error.message)
}
