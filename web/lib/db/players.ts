import type { SupabaseClient } from '@supabase/supabase-js'

export interface CreatePlayerData {
  team_id: string
  name: string
  jersey_number: number | null
  position: string | null
}

export async function createPlayer(supabase: SupabaseClient, data: CreatePlayerData): Promise<void> {
  const { error } = await supabase.from('players').insert(data)
  if (error) throw new Error(error.message)
}

export async function updatePlayer(supabase: SupabaseClient, playerId: string, data: { name: string; jersey_number: number | null; position: string | null }): Promise<void> {
  const { error } = await supabase.from('players').update(data).eq('id', playerId)
  if (error) throw new Error(error.message)
}

export async function deletePlayer(supabase: SupabaseClient, playerId: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) throw new Error(error.message)
}

export async function createPlayersBatch(supabase: SupabaseClient, players: CreatePlayerData[]): Promise<void> {
  const { error } = await supabase.from('players').insert(players)
  if (error) throw new Error(error.message)
}
