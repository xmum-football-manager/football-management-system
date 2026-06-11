'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Scorer {
  id: string
  team_id: string
  player_id: string | null
  player_name: string | null
  jersey_number: number | null
  created_at: string
}

type GoalRow = {
  id: string
  team_id: string
  player_id: string | null
  created_at: string
  player: { name: string; jersey_number: number | null } | null
}

// Distinguishes channels when several hooks watch the same match (e.g. hero + modal).
let channelSeq = 0

/**
 * Chronological scorers for a match (player resolved; null = unspecified),
 * kept live via a realtime subscription on the goals table. Pass null/disabled
 * to skip (e.g. for matches that haven't kicked off).
 */
export function useMatchScorers(matchId: string | null, enabled = true): Scorer[] {
  const [scorers, setScorers] = useState<Scorer[]>([])

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const load = async () => {
      if (!matchId || !enabled) {
        if (active) setScorers([])
        return
      }
      const { data } = await supabase
        .from('goals')
        .select('id, team_id, player_id, created_at, player:players(name, jersey_number)')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })
      if (!active || !data) return
      setScorers(
        (data as unknown as GoalRow[]).map((r) => ({
          id: r.id,
          team_id: r.team_id,
          player_id: r.player_id,
          created_at: r.created_at,
          player_name: r.player?.name ?? null,
          jersey_number: r.player?.jersey_number ?? null,
        })),
      )
    }

    load()

    if (!matchId || !enabled) return

    const channel = supabase
      .channel(`goals-${matchId}-${++channelSeq}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `match_id=eq.${matchId}` },
        () => load(),
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [matchId, enabled])

  return scorers
}
