import { createClient } from '@/lib/supabase/server'
import type { Player } from '@/lib/supabase/types'

export async function listPlayers(teamId: string): Promise<Player[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', teamId)
    .order('jersey_number', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as Player[]
}

export interface CreatePlayerInput {
  team_id: string
  name: string
  jersey_number?: number | null
}

export async function createPlayer(input: CreatePlayerInput): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('players')
    .insert({
      team_id: input.team_id,
      name: input.name,
      jersey_number: input.jersey_number ?? null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function setPlayerPhoto(
  id: string,
  photo_path: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('players').update({ photo_path }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function deletePlayer(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}
