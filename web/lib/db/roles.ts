import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { Role, UserRole } from '@/lib/supabase/types'

export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('user_roles').select('*').eq('user_id', userId)
  if (error) throw error
  return (data ?? []) as UserRole[]
}

export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle()
  return !!data
}

export async function isOrganizer(userId: string, tournamentId: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', userId)
    .eq('role', 'organizer')
    .eq('tournament_id', tournamentId)
    .maybeSingle()
  return !!data
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const svc = createServiceClient()
  const trimmed = email.trim().toLowerCase()
  // Page through admin list — small org, single page is fine
  const { data, error } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) return null
  const found = data.users.find((u) => u.email?.toLowerCase() === trimmed)
  return found?.id ?? null
}

export interface AssignRoleInput {
  user_id: string
  role: Role
  tournament_id?: string | null
  match_id?: string | null
}

export async function assignRole(input: AssignRoleInput): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_roles')
    .insert({
      user_id: input.user_id,
      role: input.role,
      tournament_id: input.tournament_id ?? null,
      match_id: input.match_id ?? null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function removeRole(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('user_roles').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function listOrganizerRoles(tournamentId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('role', 'organizer')
    .eq('tournament_id', tournamentId)
  if (error) throw error
  return data ?? []
}

export async function listScorekeeperRoles(tournamentId: string) {
  const supabase = await createClient()
  // tournament-wide (tournament_id set) + per-match (match_id set, match belongs to tournament)
  const { data: tournamentWide, error: err1 } = await supabase
    .from('user_roles')
    .select('*')
    .eq('role', 'scorekeeper')
    .eq('tournament_id', tournamentId)
  if (err1) throw err1

  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId)
  const matchIds = (matches ?? []).map((m) => m.id)

  let perMatch: UserRole[] = []
  if (matchIds.length > 0) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('role', 'scorekeeper')
      .in('match_id', matchIds)
    if (error) throw error
    perMatch = (data ?? []) as UserRole[]
  }
  return [...((tournamentWide ?? []) as UserRole[]), ...perMatch]
}

export async function listScorekeeperMatchesForUser(userId: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_roles')
    .select('tournament_id, match_id')
    .eq('user_id', userId)
    .eq('role', 'scorekeeper')

  const matchIds = new Set<string>()
  const tournamentIds: string[] = []
  for (const r of data ?? []) {
    if (r.match_id) matchIds.add(r.match_id as string)
    if (r.tournament_id) tournamentIds.push(r.tournament_id as string)
  }

  if (tournamentIds.length > 0) {
    const { data: m } = await supabase
      .from('matches')
      .select('id')
      .in('tournament_id', tournamentIds)
    for (const row of m ?? []) matchIds.add(row.id as string)
  }
  return [...matchIds]
}
