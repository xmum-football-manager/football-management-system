'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import { LiveBadge } from '@/components/LiveBadge'
import { canScorekeeper } from '@/lib/match-lifecycle'
import type { MatchWithTeams } from '@/lib/supabase/types'

interface ScoreEntryProps {
  matches: MatchWithTeams[]
  userEmail: string
}

export function ScoreEntry({ matches, userEmail }: ScoreEntryProps) {
  const [selectedMatch, setSelectedMatch] = useState<MatchWithTeams>(matches[0])

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      <header className="px-4 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between">
        <span className="text-slate-400 text-xs">{userEmail}</span>
        <form action="/score/auth/signout" method="POST">
          <button type="submit" className="text-slate-500 hover:text-slate-300 text-xs">Sign out</button>
        </form>
      </header>

      {matches.length > 1 && (
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-xs text-slate-400 mb-2">Your matches</p>
          <div className="flex flex-col gap-2">
            {matches.map(m => (
              <button key={m.id} onClick={() => setSelectedMatch(m)}
                className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  selectedMatch.id === m.id ? 'bg-green-800 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}>
                {m.home_team.name} vs {m.away_team.name}
                {m.status === 'live' && <span className="ml-2 text-green-400">● Live</span>}
                {m.status === 'halftime' && <span className="ml-2 text-amber-400">⏸ Half Time</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <MatchScorer key={selectedMatch.id} match={selectedMatch} />
      </div>
    </div>
  )
}

function MatchScorer({ match: initialMatch }: { match: MatchWithTeams }) {
  const [match, setMatch] = useState(initialMatch)
  const [isPending, startTransition] = useTransition()
  const [optimisticScore, setOptimistic] = useOptimistic(
    { home: match.home_score, away: match.away_score },
    (_: { home: number; away: number }, action: { home: number; away: number }) => action
  )

  if (match.status === 'scheduled') {
    return (
      <div className="text-center">
        <p className="text-slate-400 text-base mb-2">{match.home_team.name} vs {match.away_team.name}</p>
        <p className="text-slate-500 text-sm">This match hasn&apos;t started yet.</p>
        <p className="text-slate-600 text-xs mt-2">
          {new Date(match.match_time).toLocaleString('en-MY', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
        </p>
      </div>
    )
  }

  if (match.status === 'halftime') {
    return (
      <div className="text-center">
        <p className="text-4xl mb-4">⏸</p>
        <p className="text-white text-xl font-bold">Half Time</p>
        <p className="text-slate-400 mt-2 text-base">{match.home_team.name} {match.home_score} – {match.away_score} {match.away_team.name}</p>
        <p className="text-slate-500 text-sm mt-3">Waiting for 2nd half to start.</p>
      </div>
    )
  }

  if (match.status === 'finished') {
    return (
      <div className="text-center">
        <p className="text-4xl mb-4">🏁</p>
        <p className="text-white text-xl font-bold">Match Finished</p>
        <p className="text-slate-400 mt-2 text-base">{match.home_team.name} {match.home_score} – {match.away_score} {match.away_team.name}</p>
        <p className="text-slate-500 text-sm mt-3">Contact organizer if a correction is needed.</p>
      </div>
    )
  }

  if (!canScorekeeper(match.status)) {
    return null
  }

  function adjustScore(team: 'home' | 'away', delta: number) {
    const newHome = team === 'home' ? Math.max(0, optimisticScore.home + delta) : optimisticScore.home
    const newAway = team === 'away' ? Math.max(0, optimisticScore.away + delta) : optimisticScore.away

    startTransition(async () => {
      setOptimistic({ home: newHome, away: newAway })
      const supabase = createClient()
      const { error } = await supabase
        .from('matches')
        .update({ home_score: newHome, away_score: newAway })
        .eq('id', match.id).eq('status', 'live')

      if (error) {
        toast.error('Score not saved. Check connection.')
        setOptimistic({ home: match.home_score, away: match.away_score })
        return
      }
      setMatch(m => ({ ...m, home_score: newHome, away_score: newAway }))
      toast.success('✓ Saved')
    })
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-center mb-6"><LiveBadge /></div>

      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4">
          <div className="flex-1">
            <p className="text-white text-xl font-bold text-center leading-tight">{match.home_team.name}</p>
          </div>
          <div className="tabular-nums text-white font-extrabold shrink-0" style={{ fontSize: '72px', lineHeight: 1 }}>
            {optimisticScore.home}–{optimisticScore.away}
          </div>
          <div className="flex-1">
            <p className="text-white text-xl font-bold text-center leading-tight">{match.away_team.name}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button onClick={() => adjustScore('home', 1)} disabled={isPending}
          className="w-full h-16 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-opacity disabled:opacity-70"
          style={{ background: '#7f1d1d' }}>
          ⚽ + Goal {match.home_team.name}
        </button>
        <button onClick={() => adjustScore('away', 1)} disabled={isPending}
          className="w-full h-16 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-opacity disabled:opacity-70"
          style={{ background: '#1e3a5f' }}>
          ⚽ + Goal {match.away_team.name}
        </button>
      </div>

      <div className="mt-4 flex gap-3">
        <button onClick={() => adjustScore('home', -1)} disabled={isPending || optimisticScore.home === 0}
          className="flex-1 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-sm font-medium transition-colors">
          Undo {match.home_team.name}
        </button>
        <button onClick={() => adjustScore('away', -1)} disabled={isPending || optimisticScore.away === 0}
          className="flex-1 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-sm font-medium transition-colors">
          Undo {match.away_team.name}
        </button>
      </div>

      {isPending && <p className="text-center text-slate-500 text-xs mt-4">Saving…</p>}
    </div>
  )
}
