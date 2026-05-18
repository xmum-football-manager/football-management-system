import { createClient } from '@/lib/supabase/client'

export async function assignScorekeeper(email: string, tournamentId: string, matchId: string | null) {
  const supabase = createClient()
  const { data: userId, error: userErr } = await supabase
    .rpc('get_user_id_by_email', { email_input: email.trim().toLowerCase() })
  if (userErr || !userId) return { error: new Error('User not found. Make sure they have an account.') }

  return supabase.from('user_roles').insert({
    user_id: userId, role: 'scorekeeper', tournament_id: tournamentId, match_id: matchId,
  })
}

export async function removeScorekeeper(userId: string, tournamentId: string, matchId: string | null) {
  const supabase = createClient()
  let q = supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'scorekeeper').eq('tournament_id', tournamentId)
  q = matchId ? q.eq('match_id', matchId) : q.is('match_id', null)
  return q
}

export async function assignOrganizer(email: string, tournamentId: string) {
  const supabase = createClient()
  const { data: userId, error: userErr } = await supabase
    .rpc('get_user_id_by_email', { email_input: email.trim().toLowerCase() })
  if (userErr || !userId) return { error: new Error('User not found.') }

  return supabase.from('user_roles').upsert(
    { user_id: userId, role: 'organizer', tournament_id: tournamentId },
    { onConflict: 'user_id,role,tournament_id' }
  )
}

export async function removeOrganizer(userId: string, tournamentId: string) {
  const supabase = createClient()
  return supabase.from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role', 'organizer')
    .eq('tournament_id', tournamentId)
}
