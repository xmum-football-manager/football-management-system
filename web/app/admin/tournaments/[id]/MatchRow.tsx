'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { MatchStateStepper } from '@/components/admin/MatchStateStepper'
import { transitionMatchAction } from './actions'
import { formatClock } from '@/lib/format'
import { Loader2, RotateCcw } from 'lucide-react'
import type { MatchWithTeams, TournamentStatus } from '@/lib/supabase/types'

interface Props {
  match: MatchWithTeams
  tournamentStatus: TournamentStatus
  isAdmin: boolean
  onMatchClick?: (m: MatchWithTeams) => void
}

export function MatchRow({ match, tournamentStatus, isAdmin, onMatchClick }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const live = match.status === 'live'
  const halftime = match.status === 'halftime'
  const finished = match.status === 'finished'
  const scheduled = match.status === 'scheduled'
  const tournamentLocked = tournamentStatus === 'finished' || tournamentStatus === 'archived'
  const clickable = scheduled && !!onMatchClick && !tournamentLocked

  async function revertToLive() {
    setBusy(true)
    const r = await transitionMatchAction(match.id, 'live', isAdmin)
    setBusy(false)
    if ('error' in r) {
      toast.error(r.error)
      return
    }
    toast.success('Reverted to live.')
    router.refresh()
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-4 px-5 py-3.5 ${
        clickable ? 'hover:bg-accent/40 transition-colors' : ''
      }`}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      onClick={(e) => {
        if (!clickable) return
        const tgt = e.target as HTMLElement
        if (tgt.closest('[data-no-row-click]')) return
        onMatchClick?.(match)
      }}
      title={clickable ? 'Click to reschedule' : undefined}
    >
      <div className="admin-mono w-14 shrink-0 text-[11px] text-muted-foreground">
        {live || halftime ? (
          <span
            className="admin-tab text-[10px] tracking-[0.12em]"
            style={{ color: live ? 'var(--admin-lime)' : '#B45309' }}
          >
            {live ? 'LIVE' : 'HT'}
          </span>
        ) : (
          formatClock(match.match_time)
        )}
      </div>

      <div className="flex min-w-[220px] flex-1 items-center gap-3">
        <div className="flex-1 truncate text-right font-semibold">{match.home_team.name}</div>
        <div
          className="admin-mono inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-base font-bold tabular-nums"
          style={{
            background: live ? 'var(--admin-lime-wash)' : 'var(--admin-surface-2)',
            border: live
              ? '1px solid color-mix(in srgb, var(--admin-lime) 35%, transparent)'
              : '1px solid var(--admin-rule)',
            color: live ? 'var(--admin-lime)' : 'var(--foreground)',
            minWidth: 84,
            justifyContent: 'center',
          }}
        >
          <span>{match.status === 'scheduled' ? '—' : match.home_score}</span>
          <span style={{ color: 'var(--muted-foreground)' }}>:</span>
          <span>{match.status === 'scheduled' ? '—' : match.away_score}</span>
        </div>
        <div className="flex-1 truncate text-left font-semibold">{match.away_team.name}</div>
      </div>

      <MatchStateStepper status={match.status} />

      <div
        data-no-row-click
        className="flex flex-wrap items-center justify-end gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {isAdmin && finished && !tournamentLocked && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="admin-tab tracking-wider text-[11px]"
                style={{ color: '#DC2626', borderColor: 'rgba(220,38,38,0.4)' }}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                Revert
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revert match to live?</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="block mb-2 text-foreground font-medium">
                    {match.home_team.name} {match.home_score} : {match.away_score}{' '}
                    {match.away_team.name}
                  </span>
                  Unlocks the result and lets scorekeepers update the score again. Standings will
                  recalculate.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={revertToLive}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Revert
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
}
