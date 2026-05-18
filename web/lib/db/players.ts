import { createClient } from '@/lib/supabase/client'

export interface CreatePlayerData {
  team_id: string
  name: string
  jersey_number: number | null
  position: string | null
}

export async function createPlayer(data: CreatePlayerData) {
  const supabase = createClient()
  return supabase.from('players').insert(data)
}

export async function updatePlayer(playerId: string, data: { name: string; jersey_number: number | null; position: string | null }) {
  const supabase = createClient()
  return supabase.from('players').update(data).eq('id', playerId)
}

export async function deletePlayer(playerId: string) {
  const supabase = createClient()
  return supabase.from('players').delete().eq('id', playerId)
}

export async function createPlayersBatch(players: CreatePlayerData[]) {
  const supabase = createClient()
  return supabase.from('players').insert(players)
}
