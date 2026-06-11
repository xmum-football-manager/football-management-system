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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Pause, CircleStop, FastForward } from 'lucide-react'
import { transitionMatchAction, adminRecordGoalAction, adminUndoGoalAction, adminAddCardAction } from './actions'
import type { MatchWithTeams, MatchStatus, Player } from '@/lib/supabase/types'

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
  homePlayers: Player[]
  awayPlayers: Player[]
}

type GoalPickerState = { side: 'home' | 'away' } | null
type CardPickerState = { side: 'home' | 'away' } | null

export function MatchDayCard({ match, isAdmin, halftimeEnabled, homePlayers, awayPlayers }: Props) {
  const [busy, startTransition] = useTransition()
  const [prompt, setPrompt] = useState<LifecycleAction | null>(null)
  const [scores, setScores] = useState({ home: match.home_score, away: match.away_score })

  // Goal picker
  const [goalPicker, setGoalPicker] = useState<GoalPickerState>(null)
  const [goalPlayerId, setGoalPlayerId] = useState('')

  // Card picker
  const [cardPicker, setCardPicker] = useState<CardPickerState>(null)
  const [cardPlayerId, setCardPlayerId] = useState('')
  const [cardType, setCardType] = useState<'yellow' | 'red'>('yellow')

  const actions = lifecycleActions(match.status, halftimeEnabled)
  const isHalftime = match.status === 'halftime'
  const isLive = match.status === 'live'

  function commit(action: LifecycleAction) {
    startTransition(async () => {
      const r = await transitionMatchAction(match.id, action.next, isAdmin)
      setPrompt(null)
      if ('error' in r) toast.error(r.error)
      else toast.success(action.label + (action.next === 'finished' ? '.' : ' started.'))
    })
  }

  function openGoalPicker(side: 'home' | 'away') {
    setGoalPlayerId('')
    setGoalPicker({ side })
  }

  function confirmGoal() {
    if (!goalPicker || !goalPlayerId) return
    const side = goalPicker.side
    startTransition(async () => {
      const r = await adminRecordGoalAction(match.id, goalPlayerId)
      setGoalPicker(null)
      setGoalPlayerId('')
      if ('error' in r) {
        toast.error(r.error)
      } else {
        setScores({ home: r.home_score, away: r.away_score })
        toast.success(`Goal recorded for ${side === 'home' ? match.home_team.name : match.away_team.name}.`)
      }
    })
  }

  function undoGoal(side: 'home' | 'away') {
    const teamId = side === 'home' ? match.home_team_id : match.away_team_id
    startTransition(async () => {
      const r = await adminUndoGoalAction(match.id, teamId)
      if ('error' in r) {
        toast.error(r.error)
      } else {
        setScores({ home: r.home_score, away: r.away_score })
        toast.success('Goal removed.')
      }
    })
  }

  function openCardPicker(side: 'home' | 'away') {
    setCardPlayerId('')
    setCardType('yellow')
    setCardPicker({ side })
  }

  function confirmCard() {
    if (!cardPicker || !cardPlayerId) return
    const teamId = cardPicker.side === 'home' ? match.home_team_id : match.away_team_id
    startTransition(async () => {
      const r = await adminAddCardAction(match.id, cardPlayerId, teamId, cardType)
      setCardPicker(null)
      setCardPlayerId('')
      if ('error' in r) {
        toast.error(r.error)
      } else {
        toast.success(`${cardType === 'yellow' ? 'Yellow' : 'Red'} card recorded.`)
      }
    })
  }

  const goalPickerPlayers = goalPicker?.side === 'home' ? homePlayers : awayPlayers
  const cardPickerPlayers = cardPicker?.side === 'home' ? homePlayers : awayPlayers

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
        {match.phase !== 'knockout' && match.home_team.group_label && (
          <span className="text-xs text-muted-foreground">· Group {match.home_team.group_label}</span>
        )}
      </div>

      {/* Score row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
        <div>
          <p className="mb-2 truncate font-semibold">{match.home_team.name}</p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline" size="sm" className="h-8 w-8 p-0 text-base"
              disabled={busy || !isLive}
              title="Undo last goal"
              onClick={() => undoGoal('home')}
            >−</Button>
            <span className="admin-mono min-w-[2ch] text-center text-3xl font-bold tabular-nums">{scores.home}</span>
            <Button
              variant="outline" size="sm" className="h-8 w-8 p-0 text-base"
              disabled={busy || !isLive}
              title="Record goal"
              onClick={() => openGoalPicker('home')}
            >+</Button>
          </div>
          {isLive && (
            <Button
              variant="ghost" size="sm"
              className="mt-1 text-[11px] text-muted-foreground h-7 px-2"
              disabled={busy}
              onClick={() => openCardPicker('home')}
            >
              Card
            </Button>
          )}
        </div>

        <span className="text-sm text-muted-foreground">vs</span>

        <div>
          <p className="mb-2 truncate font-semibold">{match.away_team.name}</p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline" size="sm" className="h-8 w-8 p-0 text-base"
              disabled={busy || !isLive}
              title="Undo last goal"
              onClick={() => undoGoal('away')}
            >−</Button>
            <span className="admin-mono min-w-[2ch] text-center text-3xl font-bold tabular-nums">{scores.away}</span>
            <Button
              variant="outline" size="sm" className="h-8 w-8 p-0 text-base"
              disabled={busy || !isLive}
              title="Record goal"
              onClick={() => openGoalPicker('away')}
            >+</Button>
          </div>
          {isLive && (
            <Button
              variant="ghost" size="sm"
              className="mt-1 text-[11px] text-muted-foreground h-7 px-2"
              disabled={busy}
              onClick={() => openCardPicker('away')}
            >
              Card
            </Button>
          )}
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

      {/* Lifecycle confirmation dialog */}
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

      {/* Goal picker dialog */}
      {goalPicker && (
        <AlertDialog open onOpenChange={(open) => !open && setGoalPicker(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Record goal — {goalPicker.side === 'home' ? match.home_team.name : match.away_team.name}
              </AlertDialogTitle>
              <AlertDialogDescription>Select the scorer (required).</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-6 pb-2">
              <Select value={goalPlayerId} onValueChange={setGoalPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scorer…" />
                </SelectTrigger>
                <SelectContent>
                  {goalPickerPlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.jersey_number != null ? `#${p.jersey_number} ` : ''}{p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmGoal}
                disabled={busy || !goalPlayerId}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Goal
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Card picker dialog */}
      {cardPicker && (
        <AlertDialog open onOpenChange={(open) => !open && setCardPicker(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Record card — {cardPicker.side === 'home' ? match.home_team.name : match.away_team.name}
              </AlertDialogTitle>
              <AlertDialogDescription>Select the player and card type.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-6 pb-2 space-y-3">
              <Select value={cardPlayerId} onValueChange={setCardPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player…" />
                </SelectTrigger>
                <SelectContent>
                  {cardPickerPlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.jersey_number != null ? `#${p.jersey_number} ` : ''}{p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={cardType === 'yellow' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setCardType('yellow')}
                >
                  Yellow
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={cardType === 'red' ? 'default' : 'outline'}
                  className="flex-1"
                  style={cardType === 'red' ? { background: '#DC2626' } : { color: '#DC2626', borderColor: 'rgba(220,38,38,0.4)' }}
                  onClick={() => setCardType('red')}
                >
                  Red
                </Button>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmCard}
                disabled={busy || !cardPlayerId}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Issue Card
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
