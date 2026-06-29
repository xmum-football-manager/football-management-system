import { createClient } from '@/lib/supabase/server'
import type { Card, TeamCardCount, PlayerCardCount } from '@/lib/supabase/types'

export type { Card }

export interface InsertCardInput {
  match_id: string
  team_id: string
  player_id: string
  card_type: 'yellow' | 'red'
}

export async function listCards(matchId: string): Promise<Card[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Card[]
}

export async function insertCard(input: InsertCardInput): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cards')
    .insert(input)
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: data.id }
}

export async function deleteCard(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}

export async function listTeamCardCounts(teamId: string): Promise<TeamCardCount | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('team_card_counts')
    .select('*')
    .eq('team_id', teamId)
    .maybeSingle()
  if (error) throw error
  return (data as TeamCardCount) ?? null
}

export async function listTeamCardCountsByTournament(tournamentId: string): Promise<TeamCardCount[]> {
  const supabase = await createClient()
  // Join via teams to filter by tournament
  const { data, error } = await supabase
    .from('team_card_counts')
    .select('*, teams!inner(tournament_id)')
    .eq('teams.tournament_id', tournamentId)
  if (error) throw error
  return (data ?? []) as TeamCardCount[]
}

/**
 * Per-player yellow/red totals across every match in a tournament. Aggregated
 * in app code from the raw cards table (joined to players + teams) so no extra
 * DB view is required. Players with no cards are omitted.
 */
export async function listPlayerCardCountsByTournament(
  tournamentId: string,
): Promise<PlayerCardCount[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cards')
    .select('player_id, card_type, players!inner(name), teams!inner(id, name, tournament_id)')
    .eq('teams.tournament_id', tournamentId)
  if (error) throw error

  type Row = {
    player_id: string
    card_type: 'yellow' | 'red'
    players: { name: string } | null
    teams: { id: string; name: string } | null
  }

  const byPlayer = new Map<string, PlayerCardCount>()
  for (const r of (data ?? []) as unknown as Row[]) {
    let entry = byPlayer.get(r.player_id)
    if (!entry) {
      entry = {
        player_id: r.player_id,
        player_name: r.players?.name ?? 'Unknown',
        team_id: r.teams?.id ?? '',
        team_name: r.teams?.name ?? '',
        yellow: 0,
        red: 0,
      }
      byPlayer.set(r.player_id, entry)
    }
    if (r.card_type === 'yellow') entry.yellow += 1
    else if (r.card_type === 'red') entry.red += 1
  }

  return [...byPlayer.values()].sort(
    (a, b) =>
      b.red - a.red ||
      b.yellow - a.yellow ||
      a.player_name.localeCompare(b.player_name),
  )
}
