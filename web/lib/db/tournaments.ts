import { createClient } from '@/lib/supabase/server'
import type {
  Tournament,
  TournamentFormat,
  TournamentStatus,
} from '@/lib/supabase/types'

export async function listTournaments(): Promise<Tournament[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as Tournament[]
}

export async function listTournamentsForUser(
  userId: string,
  isAdmin?: boolean,
): Promise<Tournament[]> {
  const supabase = await createClient()

  let adminResult = isAdmin
  if (adminResult === undefined) {
    const { data: admin } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle()
    adminResult = !!admin
  }

  if (adminResult) {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending: false })
    if (error) throw error
    return (data ?? []) as Tournament[]
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('tournament_id')
    .eq('user_id', userId)
    .eq('role', 'organizer')

  const ids = (roles ?? []).map((r) => r.tournament_id).filter(Boolean) as string[]
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .in('id', ids)
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as Tournament[]
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Tournament) ?? null
}

export interface CreateTournamentInput {
  name: string
  description?: string | null
  location?: string | null
  start_date: string
  end_date: string
  format: TournamentFormat
  points_win: number
  points_draw: number
  points_loss: number
  minutes_per_half: number
  halftime_enabled: boolean
  halftime_minutes: number | null
  num_groups?: number | null
  teams_per_group?: number | null
  advance_per_group?: number | null
}

export async function createTournament(
  input: CreateTournamentInput,
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const isGroupFormat = input.format === 'round_robin_knockout'
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name: input.name,
      description: input.description ?? null,
      location: input.location ?? null,
      start_date: input.start_date,
      end_date: input.end_date,
      format: input.format,
      points_win: input.points_win,
      points_draw: input.points_draw,
      points_loss: input.points_loss,
      minutes_per_half: input.minutes_per_half,
      halftime_enabled: input.halftime_enabled,
      halftime_minutes: input.halftime_enabled ? input.halftime_minutes : null,
      num_groups: isGroupFormat ? (input.num_groups ?? null) : null,
      teams_per_group: isGroupFormat ? (input.teams_per_group ?? null) : null,
      advance_per_group: isGroupFormat ? (input.advance_per_group ?? null) : null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function updateTournamentStatus(
  id: string,
  status: TournamentStatus,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('tournaments').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function deleteTournament(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('tournaments').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function updateKnockoutQualifiers(
  tournamentId: string,
  teamIds: string[],
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tournaments')
    .update({ knockout_qualifiers: teamIds })
    .eq('id', tournamentId)
  if (error) return { error: error.message }
  return {}
}
