'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'

interface Props {
  matchId: string
  homeScore: number
  awayScore: number
  homeName: string
  awayName: string
}

export function ScoreEditor({ matchId, homeScore, awayScore, homeName, awayName }: Props) {
  const [base, setBase] = useState({ home: homeScore, away: awayScore })
  const [isPending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(
    base,
    (_: { home: number; away: number }, next: { home: number; away: number }) => next
  )

  function adjust(team: 'home' | 'away', delta: number) {
    const next = {
      home: team === 'home' ? Math.max(0, optimistic.home + delta) : optimistic.home,
      away: team === 'away' ? Math.max(0, optimistic.away + delta) : optimistic.away,
    }
    startTransition(async () => {
      setOptimistic(next)
      const supabase = createClient()
      const { error } = await supabase
        .from('matches')
        .update({ home_score: next.home, away_score: next.away })
        .eq('id', matchId)
        .eq('status', 'live')
      if (error) {
        toast.error('Score not saved.')
        setOptimistic(base)
        return
      }
      setBase(next)
    })
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <div className="flex items-center gap-1">
        <button
          onClick={() => adjust('home', -1)}
          disabled={isPending || optimistic.home === 0}
          className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-bold text-sm leading-none"
          title={`-1 ${homeName}`}
        >−</button>
        <span className="tabular-nums font-bold text-base w-6 text-center">{optimistic.home}</span>
        <button
          onClick={() => adjust('home', 1)}
          disabled={isPending}
          className="w-7 h-7 rounded bg-green-100 hover:bg-green-200 disabled:opacity-30 text-green-700 font-bold text-sm leading-none"
          title={`+1 ${homeName}`}
        >+</button>
      </div>

      <span className="text-slate-300 mx-1">–</span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => adjust('away', -1)}
          disabled={isPending || optimistic.away === 0}
          className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 font-bold text-sm leading-none"
          title={`-1 ${awayName}`}
        >−</button>
        <span className="tabular-nums font-bold text-base w-6 text-center">{optimistic.away}</span>
        <button
          onClick={() => adjust('away', 1)}
          disabled={isPending}
          className="w-7 h-7 rounded bg-green-100 hover:bg-green-200 disabled:opacity-30 text-green-700 font-bold text-sm leading-none"
          title={`+1 ${awayName}`}
        >+</button>
      </div>
    </div>
  )
}
