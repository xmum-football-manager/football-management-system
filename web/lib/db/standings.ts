import { createClient } from '@/lib/supabase/server'
import type { Standing } from '@/lib/supabase/types'

export async function getStandings(tournamentId: string): Promise<Standing[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('standings')
    .select('*')
    .eq('tournament_id', tournamentId)
  if (error) throw error
  return (data ?? []) as Standing[]
}
