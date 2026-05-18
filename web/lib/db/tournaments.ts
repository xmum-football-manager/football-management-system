import { createClient } from '@/lib/supabase/client'
import type { Tournament } from '@/lib/supabase/types'

export async function getTournament(tournamentId: string): Promise<Tournament | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()
  if (error) return null
  return data as Tournament
}

export async function updateTournament(tournamentId: string, patch: Record<string, unknown>) {
  const supabase = createClient()
  return supabase.from('tournaments').update(patch).eq('id', tournamentId)
}

export async function goLive(tournamentId: string) {
  const supabase = createClient()
  return supabase.from('tournaments').update({ status: 'active' }).eq('id', tournamentId)
}

export async function finishTournament(tournamentId: string) {
  const supabase = createClient()
  return supabase.from('tournaments').update({ status: 'finished' }).eq('id', tournamentId)
}

export async function getCurrentUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getUserRoles(userId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('user_roles')
    .select('role, tournament_id')
    .eq('user_id', userId)
  return data ?? []
}
