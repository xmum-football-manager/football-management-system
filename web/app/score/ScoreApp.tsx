'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withTeamFallback } from '@/lib/match-teams'
import { Loader2, LogOut, RefreshCcw } from 'lucide-react'
import {
  scorekeeperTransitionMatch,
  scorekeeperSetKnockoutWinnerAction,
  recordGoalAction,
  deleteGoalAction,
  addCardAction,
  removeCardAction,
} from './actions'
import { ScorePanel, type ScoreActions } from './ScorePanel'
import type { MatchWithTeams } from '@/lib/supabase/types'

interface Props {
  email: string
  initialMatches: MatchWithTeams[]
}

// Authenticated scorekeeper actions for one match, bound to the shared panel's
// action contract.
function authedActions(matchId: string): ScoreActions {
  return {
    recordGoal: (teamId, playerId) => recordGoalAction(matchId, teamId, playerId),
    deleteGoal: (goalId) => deleteGoalAction(matchId, goalId),
    addCard: async (playerId, cardType) => {
      const r = await addCardAction(matchId, playerId, cardType)
      return 'error' in r ? r : { autoRed: false }
    },
    removeCard: (cardId) => removeCardAction(matchId, cardId),
    transition: (next) => scorekeeperTransitionMatch(matchId, next),
    setKnockoutWinner: (teamId) => scorekeeperSetKnockoutWinnerAction(matchId, teamId),
  }
}

export function ScoreApp({ email, initialMatches }: Props) {
  const [matches, setMatches] = useState<MatchWithTeams[]>(initialMatches)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialMatches.find((m) => m.status === 'live')?.id ?? initialMatches[0]?.id ?? null,
  )
  const [refreshing, setRefreshing] = useState(false)
  const matchesRef = useRef(matches)
  useEffect(() => { matchesRef.current = matches }, [matches])

  const selected = useMemo(() => matches.find((m) => m.id === selectedId) ?? null, [matches, selectedId])

  async function refresh() {
    const ids = matchesRef.current.map((m) => m.id)
    if (ids.length === 0) return
    setRefreshing(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .in('id', ids)
    if (data) setMatches(withTeamFallback(data as unknown as MatchWithTeams[]))
    setRefreshing(false)
  }

  // Keep the match-switcher chips fresh; the panel refreshes its own match.
  useEffect(() => {
    const t = setInterval(() => { void refresh() }, 5000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header email={email} onRefresh={refresh} refreshing={refreshing} />

      {matches.length === 0 ? (
        <div className="flex min-h-[70vh] items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <div className="mb-3 text-5xl">🟢</div>
            <p className="text-lg font-bold text-slate-900">No matches assigned to you yet.</p>
            <p className="mt-2 text-base text-slate-500">Ask the organizer to assign you to a match.</p>
          </div>
        </div>
      ) : (
        <>
          {matches.length > 1 && (
            <div className="overflow-x-auto px-4 pt-3">
              <div className="flex min-w-max gap-2">
                {matches.map((m) => {
                  const active = m.id === selectedId
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={`whitespace-nowrap rounded-2xl border-2 px-4 py-2.5 text-sm font-bold active:scale-[0.98] ${
                        active ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {m.home_team.name} vs {m.away_team.name}
                      {m.status === 'live' ? <span className="ml-1.5 text-emerald-600">● LIVE</span>
                        : m.status === 'halftime' ? <span className="ml-1.5 text-amber-600">HT</span>
                        : m.status === 'finished' ? <span className="ml-1.5 text-slate-400">FT</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="p-4">
            {selected && <ScorePanel key={selected.id} match={selected} actions={authedActions(selected.id)} />}
          </div>
        </>
      )}
    </div>
  )
}

function Header({ email, onRefresh, refreshing }: { email: string; onRefresh: () => void; refreshing: boolean }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b-2 border-slate-200 bg-white/90 px-4 backdrop-blur">
      <span className="flex-1 truncate text-sm font-semibold text-slate-700">{email}</span>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
        title="Refresh"
      >
        {refreshing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCcw className="h-5 w-5" />}
      </button>
      <form action="/score/auth/signout" method="post">
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </form>
    </header>
  )
}
