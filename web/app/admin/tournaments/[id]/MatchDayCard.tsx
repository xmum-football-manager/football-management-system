'use client'

import { useState, useTransition } from 'react'
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
} from '@/components/ui/alert-dialog'
import { Loader2, Pause, CircleStop, FastForward } from 'lucide-react'
import { transitionMatchAction, updateScoreAction } from './actions'
import type { MatchWithTeams, MatchStatus } from '@/lib/supabase/types'

interface LifecycleAction {
  next: MatchStatus
  label: string
  icon: React.ReactNode
  tone: 'primary' | 'amber' | 'destructive'
  confirmTitle: string
  confirmDescription: string
}

function lifecycleActions(status: MatchStatus, halftimeEnabled: boolean): LifecycleAction[] {
  if (status === 'live') {
    const actions: LifecycleAction[] = []
    if (halftimeEnabled) {
      actions.push({
        next: 'halftime',
        label: 'Half time',
        icon: <Pause className="h-3.5 w-3.5" />,
        tone: 'amber',
        confirmTitle: 'Mark half time?',
        confirmDescription: 'Pauses scoring until the second half starts.',
      })
    }
    actions.push({
      next: 'finished',
      label: 'Full time',
      icon: <CircleStop className="h-3.5 w-3.5" />,
      tone: 'destructive',
      confirmTitle: 'End the match?',
      confirmDescription: 'Result locks in and counts toward standings. Only an admin can revert it.',
    })
    return actions
  }
  if (status === 'halftime') {
    return [{
      next: 'live',
      label: '2nd half',
      icon: <FastForward className="h-3.5 w-3.5" />,
      tone: 'primary',
      confirmTitle: 'Start the second half?',
      confirmDescription: 'Resumes scoring immediately.',
    }]
  }
  return []
}

interface Props {
  match: MatchWithTeams
  isAdmin: boolean
  halftimeEnabled: boolean
}

export function MatchDayCard({ match, isAdmin, halftimeEnabled }: Props) {
  const [busy, startTransition] = useTransition()
  const [prompt, setPrompt] = useState<LifecycleAction | null>(null)
  const [scores, setScores] = useState({ home: match.home_score, away: match.away_score })

  const actions = lifecycleActions(match.status, halftimeEnabled)
  const isHalftime = match.status === 'halftime'

  function adjustScore(side: 'home' | 'away', delta: number) {
    const next = {
      home: side === 'home' ? Math.max(0, scores.home + delta) : scores.home,
      away: side === 'away' ? Math.max(0, scores.away + delta) : scores.away,
    }
    setScores(next)
    startTransition(async () => {
      const r = await updateScoreAction(match.id, next.home, next.away)
      if ('error' in r) {
        toast.error(r.error)
        setScores({ home: match.home_score, away: match.away_score })
      }
    })
  }

  function commit(action: LifecycleAction) {
    startTransition(async () => {
      const r = await transitionMatchAction(match.id, action.next, isAdmin)
      setPrompt(null)
      if ('error' in r) toast.error(r.error)
      else toast.success(action.label + (action.next === 'finished' ? '.' : ' started.'))
    })
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: 'color-mix(in srgb, #DC2626 8%, transparent)',
        borderColor: isHalftime ? '#B45309' : '#DC2626',
      }}
    >
      {/* Status label */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest"
          style={{ color: isHalftime ? '#B45309' : '#DC2626' }}
        >
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: isHalftime ? '#B45309' : '#DC2626' }}
          />
          {isHalftime ? 'HALF TIME' : 'LIVE'}
        </span>
        {match.home_team.group_label && (
          <span className="text-xs text-muted-foreground">· Group {match.home_team.group_label}</span>
        )}
      </div>

      {/* Score row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
        <div>
          <p className="mb-2 truncate font-semibold">{match.home_team.name}</p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-base" disabled={busy} onClick={() => adjustScore('home', -1)}>−</Button>
            <span className="admin-mono min-w-[2ch] text-center text-3xl font-bold tabular-nums">{scores.home}</span>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-base" disabled={busy} onClick={() => adjustScore('home', 1)}>+</Button>
          </div>
        </div>

        <span className="text-sm text-muted-foreground">vs</span>

        <div>
          <p className="mb-2 truncate font-semibold">{match.away_team.name}</p>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-base" disabled={busy} onClick={() => adjustScore('away', -1)}>−</Button>
            <span className="admin-mono min-w-[2ch] text-center text-3xl font-bold tabular-nums">{scores.away}</span>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-base" disabled={busy} onClick={() => adjustScore('away', 1)}>+</Button>
          </div>
        </div>
      </div>

      {/* Lifecycle buttons */}
      {actions.length > 0 && (
        <div className="mt-4 flex gap-2">
          {actions.map((action) => (
            <Button
              key={action.next}
              variant={action.tone === 'primary' ? 'default' : 'outline'}
              size="sm"
              disabled={busy}
              onClick={() => setPrompt(action)}
              className="flex-1 admin-tab tracking-wider text-[11px]"
              style={
                action.tone === 'amber'
                  ? { color: '#B45309', borderColor: 'rgba(180,83,9,0.4)' }
                  : action.tone === 'destructive'
                  ? { color: '#DC2626', borderColor: 'rgba(220,38,38,0.4)' }
                  : undefined
              }
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Confirmation dialog */}
      {prompt && (
        <AlertDialog open onOpenChange={(open) => !open && setPrompt(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{prompt.confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="mb-2 block font-medium text-foreground">
                  {match.home_team.name} {scores.home} : {scores.away} {match.away_team.name}
                </span>
                {prompt.confirmDescription}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => commit(prompt)}
                disabled={busy}
                className={
                  prompt.tone === 'destructive'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : undefined
                }
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
