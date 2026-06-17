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
import { Loader2, RotateCcw, Play, Pause, CircleStop, FastForward, Link } from 'lucide-react'
import type { MatchStatus, MatchWithTeams, TournamentStatus } from '@/lib/supabase/types'

interface Props {
  match: MatchWithTeams
  tournamentStatus: TournamentStatus
  isAdmin: boolean
  onMatchClick?: (m: MatchWithTeams) => void
  kickoffBlocked?: boolean
  revertBlocked?: boolean
  revertBlockedReason?: string
}

interface LifecycleAction {
  next: MatchStatus
  label: string
  icon: React.ReactNode
  tone: 'primary' | 'amber' | 'destructive'
  confirmTitle: string
  confirmDescription: string
}

function lifecycleActionsFor(status: MatchStatus): LifecycleAction[] {
  if (status === 'scheduled') {
    return [
      {
        next: 'live',
        label: 'Kickoff',
        icon: <Play className="h-3.5 w-3.5" />,
        tone: 'primary',
        confirmTitle: 'Start the match?',
        confirmDescription: 'Records kickoff time and locks teams. Scorekeepers can now update the score.',
      },
    ]
  }
  if (status === 'live') {
    return [
      {
        next: 'halftime',
        label: 'Half time',
        icon: <Pause className="h-3.5 w-3.5" />,
        tone: 'amber',
        confirmTitle: 'Mark half time?',
        confirmDescription: 'Pauses scoring until the second half starts.',
      },
      {
        next: 'finished',
        label: 'Full time',
        icon: <CircleStop className="h-3.5 w-3.5" />,
        tone: 'destructive',
        confirmTitle: 'End the match?',
        confirmDescription: 'Result locks in and counts toward standings. Only an admin can revert it.',
      },
    ]
  }
  if (status === 'halftime') {
    return [
      {
        next: 'live',
        label: '2nd half',
        icon: <FastForward className="h-3.5 w-3.5" />,
        tone: 'primary',
        confirmTitle: 'Start the second half?',
        confirmDescription: 'Resumes scoring immediately.',
      },
    ]
  }
  return []
}

export function MatchRow({
  match,
  tournamentStatus,
  isAdmin,
  onMatchClick,
  kickoffBlocked = false,
  revertBlocked = false,
  revertBlockedReason = 'The knockout stage has already started. Revert the knockout matches first.',
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<LifecycleAction | null>(null)

  const finished = match.status === 'finished'
  const scheduled = match.status === 'scheduled'
  const tournamentLocked = tournamentStatus === 'finished' || tournamentStatus === 'archived'
  const clickable = scheduled && !!onMatchClick && !tournamentLocked
  const lifecycleActions = tournamentLocked ? [] : lifecycleActionsFor(match.status)

  async function commit(action: LifecycleAction) {
    setBusy(action.next)
    const r = await transitionMatchAction(match.id, action.next, isAdmin)
    setBusy(null)
    setPrompt(null)
    if ('error' in r) {
      toast.error(r.error)
      return
    }
    toast.success(action.label + (action.next === 'finished' ? '.' : ' started.'))
    router.refresh()
  }

  async function revertMatch() {
    setBusy('scheduled')
    const r = await transitionMatchAction(match.id, 'scheduled', isAdmin)
    setBusy(null)
    if ('error' in r) {
      toast.error(r.error)
      return
    }
    toast.success('Reverted. Kick off again to restart the match.')
    router.refresh()
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-4 px-5 py-3.5 ${
        clickable ? 'hover:bg-accent/40 transition-colors' : ''
      }`}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      onClick={(e) => {
        if (!clickable || prompt) return
        const tgt = e.target as HTMLElement
        if (tgt.closest('[data-no-row-click]')) return
        if (tgt.closest('[role="alertdialog"], [role="dialog"]')) return
        onMatchClick?.(match)
      }}
      title={clickable ? 'Click to reschedule' : undefined}
    >
      <div className="admin-mono w-14 shrink-0 text-[11px] text-muted-foreground">
        {match.status === 'live' || match.status === 'halftime' ? (
          <span
            className="admin-tab text-[10px] tracking-[0.12em]"
            style={{ color: match.status === 'live' ? 'var(--admin-lime)' : '#B45309' }}
          >
            {match.status === 'live' ? 'LIVE' : 'HT'}
          </span>
        ) : (
          formatClock(match.match_time ?? '')
        )}
      </div>

      <span
        className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
        style={{
          background: match.phase === 'knockout' ? 'var(--admin-lime-wash)' : 'var(--admin-surface-2)',
          color: match.phase === 'knockout' ? 'var(--admin-lime)' : 'var(--muted-foreground)',
          border: '1px solid var(--admin-rule)',
        }}
      >
        {match.phase === 'knockout' ? 'Knockout' : 'Group'}
      </span>

      <div className="flex min-w-[220px] flex-1 items-center gap-3">
        <div className="flex-1 truncate text-right font-semibold">{match.home_team.name}</div>
        <div
          className="admin-mono inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-base font-bold tabular-nums"
          style={{
            background: match.status === 'live' ? 'var(--admin-lime-wash)' : 'var(--admin-surface-2)',
            border:
              match.status === 'live'
                ? '1px solid color-mix(in srgb, var(--admin-lime) 35%, transparent)'
                : '1px solid var(--admin-rule)',
            color: match.status === 'live' ? 'var(--admin-lime)' : 'var(--foreground)',
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
        {!finished && match.scorekeeper_token && (
          <Button
            size="sm"
            variant="outline"
            className="admin-tab h-7 w-7 p-0"
            title="Copy scorekeeper link"
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/score/m/${match.scorekeeper_token}`
              )
              toast.success('Scorekeeper link copied.')
            }}
          >
            <Link className="h-3 w-3" />
          </Button>
        )}

        {lifecycleActions.map((action) => (
          <Button
            key={action.next + action.label}
            size="sm"
            variant={action.tone === 'primary' ? 'default' : 'outline'}
            className="admin-tab tracking-wider text-[11px]"
            style={
              action.tone === 'amber'
                ? { color: '#B45309', borderColor: 'rgba(180,83,9,0.4)' }
                : action.tone === 'destructive'
                  ? { color: '#DC2626', borderColor: 'rgba(220,38,38,0.4)' }
                  : undefined
            }
            disabled={busy !== null || (action.next === 'live' && kickoffBlocked)}
            title={action.next === 'live' && kickoffBlocked ? 'Schedule all matches in this phase first' : undefined}
            onClick={() => setPrompt(action)}
          >
            {busy === action.next ? <Loader2 className="h-3 w-3 animate-spin" /> : action.icon}
            {action.label}
          </Button>
        ))}

        {scheduled && kickoffBlocked && (
          <p className="text-[11px] text-muted-foreground">
            Schedule all {match.phase} matches first
          </p>
        )}

        {isAdmin && finished && !tournamentLocked && revertBlocked && (
          <Button
            size="sm"
            variant="outline"
            className="admin-tab tracking-wider text-[11px] opacity-50 cursor-not-allowed"
            style={{ color: '#DC2626', borderColor: 'rgba(220,38,38,0.4)' }}
            onClick={() => toast.error(revertBlockedReason)}
          >
            <RotateCcw className="h-3 w-3" />
            Revert
          </Button>
        )}

        {isAdmin && finished && !tournamentLocked && !revertBlocked && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="admin-tab tracking-wider text-[11px]"
                style={{ color: '#DC2626', borderColor: 'rgba(220,38,38,0.4)' }}
                disabled={busy !== null}
              >
                {busy === 'scheduled' ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                Revert
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revert match?</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="block mb-2 text-foreground font-medium">
                    {match.home_team.name} {match.home_score} : {match.away_score}{' '}
                    {match.away_team.name}
                  </span>
                  Unlocks the result and sends the match back to scheduled. Kick off again to
                  restart play. Standings will recalculate.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={revertMatch}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Revert
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {prompt && (
        <AlertDialog open onOpenChange={(open) => !open && setPrompt(null)}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>{prompt.confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="block mb-2 text-foreground font-medium">
                  {match.home_team.name} {match.status === 'scheduled' ? '—' : match.home_score} :{' '}
                  {match.status === 'scheduled' ? '—' : match.away_score} {match.away_team.name}
                </span>
                {prompt.confirmDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => commit(prompt)}
                disabled={busy !== null}
                className={
                  prompt.tone === 'destructive'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : undefined
                }
              >
                {busy !== null && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
