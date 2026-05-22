'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MatchStatusBadge } from '@/components/admin/MatchStatusBadge'
import { getAvailableTransitions } from '@/lib/match-lifecycle'
import { transitionMatchAction, updateScoreAction } from './actions'
import { formatClock } from '@/lib/format'
import { Loader2, Plus, Minus, RotateCcw } from 'lucide-react'
import type { MatchStatus, MatchWithTeams, TournamentStatus } from '@/lib/supabase/types'

interface Props {
  match: MatchWithTeams
  tournamentStatus: TournamentStatus
  isAdmin: boolean
}

export function MatchRow({ match, tournamentStatus, isAdmin }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [home, setHome] = useState(match.home_score)
  const [away, setAway] = useState(match.away_score)

  const transitions = getAvailableTransitions(match.status, isAdmin ? 'admin' : 'organizer')
  const live = match.status === 'live'
  const finished = match.status === 'finished'

  async function transition(next: MatchStatus, label: string) {
    setBusy(true)
    const r = await transitionMatchAction(match.id, next, isAdmin)
    setBusy(false)
    if ('error' in r) {
      toast.error(r.error)
      return
    }
    toast.success(label)
    router.refresh()
  }

  async function bumpScore(side: 'home' | 'away', delta: number) {
    if (!live) return
    const newHome = side === 'home' ? Math.max(0, home + delta) : home
    const newAway = side === 'away' ? Math.max(0, away + delta) : away
    setHome(newHome)
    setAway(newAway)
    const r = await updateScoreAction(match.id, newHome, newAway)
    if ('error' in r) {
      toast.error(r.error)
      setHome(match.home_score)
      setAway(match.away_score)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="text-xs text-muted-foreground font-mono w-12 shrink-0">
          {live ? <span className="text-emerald-600 font-semibold">LIVE</span> : formatClock(match.match_time)}
        </div>

        <div className="flex-1 min-w-[200px] flex items-center gap-3">
          <div className="flex-1 text-right truncate font-medium">{match.home_team.name}</div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded font-mono font-bold text-lg tabular-nums">
            <span>{home}</span>
            <span className="text-muted-foreground">:</span>
            <span>{away}</span>
          </div>
          <div className="flex-1 text-left truncate font-medium">{match.away_team.name}</div>
        </div>

        <MatchStatusBadge status={match.status} />

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {live && (
            <div className="flex items-center gap-1">
              <ScoreButton onClick={() => bumpScore('home', -1)} disabled={busy || home === 0}>
                <Minus className="h-3 w-3" /> H
              </ScoreButton>
              <ScoreButton onClick={() => bumpScore('home', 1)} disabled={busy}>
                <Plus className="h-3 w-3" /> H
              </ScoreButton>
              <ScoreButton onClick={() => bumpScore('away', -1)} disabled={busy || away === 0}>
                <Minus className="h-3 w-3" /> A
              </ScoreButton>
              <ScoreButton onClick={() => bumpScore('away', 1)} disabled={busy}>
                <Plus className="h-3 w-3" /> A
              </ScoreButton>
            </div>
          )}

          {transitions.map((t) =>
            t.action === 'Revert to Live' ? null : (
              <Button
                key={t.action}
                size="sm"
                variant={t.action === 'Full Time' ? 'destructive' : 'default'}
                onClick={() => transition(t.nextStatus, t.action)}
                disabled={busy || tournamentStatus === 'finished' || tournamentStatus === 'archived'}
              >
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                {t.action}
              </Button>
            ),
          )}

          {isAdmin && finished && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-700 border-red-200 hover:bg-red-50"
              onClick={() => transition('live', 'Reverted to Live')}
              disabled={busy}
            >
              <RotateCcw className="h-3 w-3" /> Revert
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function ScoreButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-0.5 h-7 px-2 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  )
}
