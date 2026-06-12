'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withTeamFallback } from '@/lib/match-teams'
import { formatGoalClock } from '@/lib/format'
import { toast } from 'sonner'
import { Loader2, LogOut, Minus, Plus, RefreshCcw, Play, Pause, CircleStop, FastForward, CreditCard } from 'lucide-react'
import { scorekeeperTransitionMatch, scorekeeperSetKnockoutWinnerAction, recordGoalAction, deleteGoalAction, addCardAction } from './actions'
import type { MatchStatus, MatchWithTeams, Player, Goal } from '@/lib/supabase/types'

interface Props {
  email: string
  initialMatches: MatchWithTeams[]
}

export function ScoreApp({ email, initialMatches }: Props) {
  const [matches, setMatches] = useState<MatchWithTeams[]>(initialMatches)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialMatches.find((m) => m.status === 'live')?.id ?? initialMatches[0]?.id ?? null,
  )
  const [refreshing, setRefreshing] = useState(false)
  const matchesRef = useRef(matches)
  useEffect(() => {
    matchesRef.current = matches
  }, [matches])

  const selected = useMemo(() => matches.find((m) => m.id === selectedId) ?? null, [matches, selectedId])

  async function refresh() {
    setRefreshing(true)
    const supabase = createClient()
    const ids = matchesRef.current.map((m) => m.id)
    if (ids.length === 0) {
      setRefreshing(false)
      return
    }
    const { data } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .in('id', ids)
    if (data) {
      setMatches(withTeamFallback(data as unknown as MatchWithTeams[]))
    }
    setRefreshing(false)
  }

  useEffect(() => {
    const t = setInterval(() => {
      refresh()
    }, 5000)
    return () => clearInterval(t)
  }, [])

  if (matches.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header email={email} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-slate-300 max-w-sm">
            <div className="text-5xl mb-3">🟢</div>
            <p className="text-lg font-medium">No matches assigned to you yet.</p>
            <p className="text-sm text-slate-400 mt-2">
              Ask the organizer to assign you to a match.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header email={email} onRefresh={refresh} refreshing={refreshing} />
      {matches.length > 1 && (
        <div className="px-4 pt-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {matches.map((m) => {
              const active = m.id === selectedId
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap border-2 ${
                    active
                      ? 'border-emerald-500 bg-emerald-500/20 text-white'
                      : 'border-slate-700 bg-slate-800/60 text-slate-300'
                  }`}
                >
                  {m.home_team.name} vs {m.away_team.name}{' '}
                  {m.status === 'live' ? (
                    <span className="ml-1 text-emerald-300">● LIVE</span>
                  ) : m.status === 'halftime' ? (
                    <span className="ml-1 text-amber-300">HT</span>
                  ) : m.status === 'finished' ? (
                    <span className="ml-1 text-slate-500">FT</span>
                  ) : (
                    <span className="ml-1 text-slate-400">{formatTime(m.match_time ?? '')}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="flex-1 flex items-center justify-center p-4">
        {selected && <ScoreCard key={selected.id} match={selected} onChange={refresh} />}
      </div>
    </div>
  )
}

function Header({ email, onRefresh, refreshing }: { email: string; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <header className="flex items-center gap-3 px-4 h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
      <span className="text-sm text-slate-300 truncate flex-1">{email}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-slate-800 text-slate-300"
          title="Refresh"
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
        </button>
      )}
      <form action="/score/auth/signout" method="post">
        <button
          type="submit"
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md hover:bg-slate-800 text-slate-300 text-sm"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </form>
    </header>
  )
}

interface LifecyclePrompt {
  next: MatchStatus
  label: string
  title: string
  description: string
  destructive: boolean
}

type PickerMode =
  | { type: 'goal'; side: 'home' | 'away' }
  | { type: 'remove-goal'; side: 'home' | 'away' }
  | { type: 'card' }
  | { type: 'card-player'; side: 'home' | 'away' }
  | { type: 'card-type'; side: 'home' | 'away'; playerId: string }
  | { type: 'knockout-draw-winner' }

function useMatchClock(match: MatchWithTeams) {
  const [now, setNow] = useState(() => Date.now())
  const isHalftime = match.status === 'halftime'

  useEffect(() => {
    if (isHalftime) return
    if (match.status !== 'live') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isHalftime, match.status])

  const elapsedSeconds = useMemo(() => {
    if (!match.match_started_at) return null
    const kickoff = new Date(match.match_started_at).getTime()
    if (match.status === 'halftime' && match.halftime_started_at) {
      const ht = new Date(match.halftime_started_at).getTime()
      return Math.floor((ht - kickoff) / 1000)
    }
    if (match.status === 'live' && match.halftime_started_at && match.second_half_started_at) {
      const ht = new Date(match.halftime_started_at).getTime()
      const sh = new Date(match.second_half_started_at).getTime()
      const firstHalf = ht - kickoff
      const secondHalf = now - sh
      return Math.floor((firstHalf + secondHalf) / 1000)
    }
    if (match.status === 'live') {
      return Math.floor((now - kickoff) / 1000)
    }
    return null
  }, [match, now])

  return elapsedSeconds
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function ScoreCard({ match, onChange }: { match: MatchWithTeams; onChange: () => void }) {
  const [home, setHome] = useState(match.home_score)
  const [away, setAway] = useState(match.away_score)
  const [saving, setSaving] = useState(false)
  const [prompt, setPrompt] = useState<LifecyclePrompt | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null)
  const [homePlayers, setHomePlayers] = useState<Player[] | null>(null)
  const [awayPlayers, setAwayPlayers] = useState<Player[] | null>(null)
  const [removeGoals, setRemoveGoals] = useState<Goal[]>([])

  const canScore = match.status === 'live'
  const elapsedSeconds = useMatchClock(match)

  // Load rosters once (always — needed for cards even at halftime)
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('players')
      .select('*')
      .eq('team_id', match.home_team_id)
      .order('jersey_number', { ascending: true, nullsFirst: false })
      .then(({ data }) => setHomePlayers((data ?? []) as Player[]))
    supabase
      .from('players')
      .select('*')
      .eq('team_id', match.away_team_id)
      .order('jersey_number', { ascending: true, nullsFirst: false })
      .then(({ data }) => setAwayPlayers((data ?? []) as Player[]))
  }, [match.id, match.home_team_id, match.away_team_id])

  function openGoalPicker(side: 'home' | 'away') {
    if (!canScore) return
    setPickerMode({ type: 'goal', side })
  }

  async function handleGoalPlayerPick(playerId: string, side: 'home' | 'away') {
    setPickerMode(null)
    setSaving(true)
    const teamId = (side === 'home' ? match.home_team_id : match.away_team_id) ?? ''
    const result = await recordGoalAction(match.id, teamId, playerId)
    setSaving(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setHome(result.home_score)
    setAway(result.away_score)
    onChange()
  }

  // Open the "remove a goal" picker: load this team's goals (most recent first)
  // so the scorekeeper can delete the exact one they mistyped, not just the last.
  async function openRemovePicker(side: 'home' | 'away') {
    if (!canScore) return
    const teamId = side === 'home' ? match.home_team_id : match.away_team_id
    const supabase = createClient()
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('match_id', match.id)
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
    setRemoveGoals((data ?? []) as Goal[])
    setPickerMode({ type: 'remove-goal', side })
  }

  async function handleDeleteGoal(goalId: string) {
    setPickerMode(null)
    setSaving(true)
    const result = await deleteGoalAction(match.id, goalId)
    setSaving(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setHome(result.home_score)
    setAway(result.away_score)
    toast.success('Goal removed.')
    onChange()
  }

  async function handleCardTypePick(cardType: 'yellow' | 'red', side: 'home' | 'away', playerId: string) {
    setPickerMode(null)
    setSaving(true)
    const result = await addCardAction(match.id, playerId, cardType)
    setSaving(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success(`${cardType === 'yellow' ? 'Yellow' : 'Red'} card recorded.`)
    onChange()
  }

  async function commitTransition() {
    if (!prompt) return
    // For knockout matches finishing level, show winner picker instead
    if (
      prompt.next === 'finished' &&
      match.phase === 'knockout' &&
      home === away &&
      !match.winner_team_id
    ) {
      setPrompt(null)
      setPickerMode({ type: 'knockout-draw-winner' })
      return
    }
    setTransitioning(true)
    const r = await scorekeeperTransitionMatch(match.id, prompt.next)
    setTransitioning(false)
    if ('error' in r) {
      toast.error(r.error)
      return
    }
    toast.success(prompt.label)
    setPrompt(null)
    onChange()
  }

  async function handleKnockoutWinnerPick(teamId: string) {
    setPickerMode(null)
    setTransitioning(true)
    const wr = await scorekeeperSetKnockoutWinnerAction(match.id, teamId)
    if ('error' in wr) {
      setTransitioning(false)
      toast.error(wr.error)
      return
    }
    const r = await scorekeeperTransitionMatch(match.id, 'finished')
    setTransitioning(false)
    if ('error' in r) {
      toast.error(r.error)
      return
    }
    toast.success('Full time. Result locked in.')
    onChange()
  }

  const lifecycleButtons: { prompt: LifecyclePrompt; icon: React.ReactNode; tone: 'primary' | 'amber' | 'destructive' }[] = []
  if (match.status === 'scheduled') {
    lifecycleButtons.push({
      prompt: {
        next: 'live',
        label: 'Match kicked off.',
        title: 'Start the match?',
        description: 'Records kickoff time and starts scoring. Make sure both teams are on the pitch.',
        destructive: false,
      },
      icon: <Play className="h-5 w-5" />,
      tone: 'primary',
    })
  } else if (match.status === 'live') {
    lifecycleButtons.push({
      prompt: {
        next: 'halftime',
        label: 'Half time.',
        title: 'Mark half time?',
        description: 'Scoring is paused until the second half starts.',
        destructive: false,
      },
      icon: <Pause className="h-5 w-5" />,
      tone: 'amber',
    })
    lifecycleButtons.push({
      prompt: {
        next: 'finished',
        label: 'Full time. Result locked in.',
        title: 'End the match?',
        description: 'The result will be finalised and counted in standings. Only an admin can revert it.',
        destructive: true,
      },
      icon: <CircleStop className="h-5 w-5" />,
      tone: 'destructive',
    })
  } else if (match.status === 'halftime') {
    lifecycleButtons.push({
      prompt: {
        next: 'live',
        label: 'Second half started.',
        title: 'Start the second half?',
        description: 'Scoring resumes immediately.',
        destructive: false,
      },
      icon: <FastForward className="h-5 w-5" />,
      tone: 'primary',
    })
  }

  const sideRoster = (side: 'home' | 'away') => side === 'home' ? (homePlayers ?? []) : (awayPlayers ?? [])

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-4">
        {match.status === 'live' ? (
          <div className="flex flex-col items-center gap-1">
            <span className="inline-flex items-center gap-2 text-emerald-300 text-sm font-semibold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              LIVE
            </span>
            {elapsedSeconds !== null && (
              <span className="text-slate-400 text-xs tabular-nums">{formatElapsed(elapsedSeconds)}</span>
            )}
          </div>
        ) : match.status === 'halftime' ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-amber-300 text-sm font-semibold">HALF TIME</span>
            {elapsedSeconds !== null && (
              <span className="text-slate-400 text-xs tabular-nums">{formatElapsed(elapsedSeconds)}</span>
            )}
          </div>
        ) : match.status === 'finished' ? (
          <span className="text-slate-400 text-sm font-semibold">FULL TIME</span>
        ) : (
          <span className="text-slate-400 text-sm">SCHEDULED · {formatTime(match.match_time ?? '')}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SideColumn
          label={match.home_team.name}
          value={home}
          onMinus={() => openRemovePicker('home')}
          onPlus={() => openGoalPicker('home')}
          disabled={!canScore || saving}
        />
        <SideColumn
          label={match.away_team.name}
          value={away}
          onMinus={() => openRemovePicker('away')}
          onPlus={() => openGoalPicker('away')}
          disabled={!canScore || saving}
        />
      </div>

      {canScore && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setPickerMode({ type: 'card' })}
            disabled={saving}
            className="w-full h-10 rounded-lg border-2 border-slate-700 bg-slate-800/40 text-slate-300 text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <CreditCard className="h-4 w-4" />
            Card
          </button>
        </div>
      )}

      {lifecycleButtons.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          {lifecycleButtons.map((btn) => (
            <LifecycleButton
              key={btn.prompt.next + btn.prompt.label}
              tone={btn.tone}
              icon={btn.icon}
              label={btn.prompt.label.replace(/\.$/, '')}
              onClick={() => setPrompt(btn.prompt)}
              disabled={transitioning}
            >
              {labelFor(match.status, btn.prompt.next)}
            </LifecycleButton>
          ))}
        </div>
      )}

      {match.status === 'finished' && (
        <p className="mt-5 text-center text-sm text-slate-400">
          Match is final. Contact the organizer for corrections.
        </p>
      )}

      {prompt && (
        <ConfirmOverlay
          prompt={prompt}
          match={match}
          onCancel={() => setPrompt(null)}
          onConfirm={commitTransition}
          pending={transitioning}
        />
      )}

      {/* Goal player picker */}
      {pickerMode?.type === 'goal' && (
        <PlayerPickerOverlay
          title={`Goal — ${pickerMode.side === 'home' ? match.home_team.name : match.away_team.name}`}
          players={sideRoster(pickerMode.side)}
          onPick={(pid) => handleGoalPlayerPick(pid, pickerMode.side)}
          onCancel={() => setPickerMode(null)}
        />
      )}

      {/* Remove a goal: pick which scorer/minute to delete (most recent first) */}
      {pickerMode?.type === 'remove-goal' && (
        <GoalRemoveOverlay
          title={`Remove goal — ${pickerMode.side === 'home' ? match.home_team.name : match.away_team.name}`}
          goals={removeGoals}
          players={sideRoster(pickerMode.side)}
          onDelete={(goalId) => handleDeleteGoal(goalId)}
          onCancel={() => setPickerMode(null)}
        />
      )}

      {/* Card: choose team */}
      {pickerMode?.type === 'card' && (
        <ChooseTeamOverlay
          homeTeamName={match.home_team.name}
          awayTeamName={match.away_team.name}
          onPick={(side) => setPickerMode({ type: 'card-player', side })}
          onCancel={() => setPickerMode(null)}
        />
      )}

      {/* Card: choose player */}
      {pickerMode?.type === 'card-player' && (
        <PlayerPickerOverlay
          title={`Card — ${pickerMode.side === 'home' ? match.home_team.name : match.away_team.name}`}
          players={sideRoster(pickerMode.side)}
          onPick={(pid) => setPickerMode({ type: 'card-type', side: pickerMode.side, playerId: pid })}
          onCancel={() => setPickerMode(null)}
        />
      )}

      {/* Card: choose type */}
      {pickerMode?.type === 'card-type' && (
        <CardTypeOverlay
          onPick={(ct) => handleCardTypePick(ct, pickerMode.side, pickerMode.playerId)}
          onCancel={() => setPickerMode(null)}
        />
      )}

      {/* Knockout draw: pick advancing team */}
      {pickerMode?.type === 'knockout-draw-winner' && (
        <ChooseTeamOverlay
          title="Knockout match — pick the advancing team"
          subtitle={`Match is level (${home}–${away}). Select which team advances.`}
          homeTeamName={match.home_team.name}
          awayTeamName={match.away_team.name}
          onPick={(side) => handleKnockoutWinnerPick(side === 'home' ? match.home_team_id! : match.away_team_id!)}
          onCancel={() => setPickerMode(null)}
        />
      )}
    </div>
  )
}

function PlayerPickerOverlay({
  title,
  players,
  onPick,
  onCancel,
}: {
  title: string
  players: Player[]
  onPick: (playerId: string) => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-3 max-h-[80vh] flex flex-col">
        <h2 className="text-base font-bold text-white shrink-0">{title}</h2>
        {players.length === 0 ? (
          <p className="text-slate-400 text-sm">No players found for this team.</p>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-1">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm flex items-center gap-3"
              >
                {p.jersey_number !== null && (
                  <span className="text-xs text-slate-400 w-6 text-right shrink-0">#{p.jersey_number}</span>
                )}
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="w-full h-10 rounded-lg border-2 border-slate-700 text-slate-200 font-semibold hover:bg-slate-800 text-sm shrink-0"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function GoalRemoveOverlay({
  title,
  goals,
  players,
  onDelete,
  onCancel,
}: {
  title: string
  goals: Goal[]
  players: Player[]
  onDelete: (goalId: string) => void
  onCancel: () => void
}) {
  const nameOf = (playerId: string | null) => {
    if (!playerId) return 'No scorer'
    return players.find((p) => p.id === playerId)?.name ?? 'Unknown player'
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-3 max-h-[80vh] flex flex-col">
        <h2 className="text-base font-bold text-white shrink-0">{title}</h2>
        {goals.length === 0 ? (
          <p className="text-slate-400 text-sm">No goals recorded for this team.</p>
        ) : (
          <div className="overflow-y-auto flex-1 space-y-1">
            {goals.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onDelete(g.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-red-900/40 text-white text-sm flex items-center justify-between gap-3"
              >
                <span>{nameOf(g.player_id)}</span>
                <span className="text-xs text-slate-400 tabular-nums shrink-0">{formatGoalClock(g.elapsed_seconds)}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="w-full h-10 rounded-lg border-2 border-slate-700 text-slate-200 font-semibold hover:bg-slate-800 text-sm shrink-0"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ChooseTeamOverlay({
  title = 'Card — Choose Team',
  subtitle,
  homeTeamName,
  awayTeamName,
  onPick,
  onCancel,
}: {
  title?: string
  subtitle?: string
  homeTeamName: string
  awayTeamName: string
  onPick: (side: 'home' | 'away') => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-3">
        <h2 className="text-base font-bold text-white">{title}</h2>
        {subtitle && <p className="text-slate-400 text-sm">{subtitle}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onPick('home')}
            className="flex-1 h-12 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm"
          >
            {homeTeamName}
          </button>
          <button
            type="button"
            onClick={() => onPick('away')}
            className="flex-1 h-12 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm"
          >
            {awayTeamName}
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-full h-10 rounded-lg border-2 border-slate-700 text-slate-200 font-semibold hover:bg-slate-800 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function CardTypeOverlay({
  onPick,
  onCancel,
}: {
  onPick: (cardType: 'yellow' | 'red') => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-3">
        <h2 className="text-base font-bold text-white">Card — Choose Type</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onPick('yellow')}
            className="flex-1 h-14 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm uppercase tracking-wide"
          >
            Yellow
          </button>
          <button
            type="button"
            onClick={() => onPick('red')}
            className="flex-1 h-14 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm uppercase tracking-wide"
          >
            Red
          </button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-full h-10 rounded-lg border-2 border-slate-700 text-slate-200 font-semibold hover:bg-slate-800 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function labelFor(from: MatchStatus, to: MatchStatus): string {
  if (from === 'scheduled' && to === 'live') return 'Kickoff'
  if (from === 'live' && to === 'halftime') return 'Half Time'
  if (from === 'live' && to === 'finished') return 'Full Time'
  if (from === 'halftime' && to === 'live') return 'Start 2nd Half'
  return 'Continue'
}

function LifecycleButton({
  tone,
  icon,
  onClick,
  disabled,
  children,
}: {
  tone: 'primary' | 'amber' | 'destructive'
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const palette =
    tone === 'primary'
      ? 'bg-emerald-600 hover:bg-emerald-500'
      : tone === 'amber'
        ? 'bg-amber-600 hover:bg-amber-500'
        : 'bg-red-700 hover:bg-red-600'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${palette} text-white font-bold h-14 rounded-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none transition-transform active:scale-[0.98]`}
    >
      {icon}
      <span className="uppercase tracking-wide">{children}</span>
    </button>
  )
}

function ConfirmOverlay({
  prompt,
  match,
  onCancel,
  onConfirm,
  pending,
}: {
  prompt: LifecyclePrompt
  match: MatchWithTeams
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">{prompt.title}</h2>
          <p className="mt-2 text-slate-300 text-sm">
            {match.home_team.name} {match.home_score} : {match.away_score} {match.away_team.name}
          </p>
          <p className="mt-1 text-slate-400 text-sm">{prompt.description}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 h-12 rounded-lg border-2 border-slate-700 text-slate-200 font-semibold hover:bg-slate-800 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`flex-1 h-12 rounded-lg font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-40 ${
              prompt.destructive
                ? 'bg-red-700 hover:bg-red-600'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

function SideColumn({
  label,
  value,
  onMinus,
  onPlus,
  disabled,
}: {
  label: string
  value: number
  onMinus: () => void
  onPlus: () => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-slate-700 bg-slate-800/40 p-4">
      <div className="text-sm text-slate-300 font-semibold uppercase tracking-wide text-center min-h-[2.5rem] flex items-center">
        {label}
      </div>
      <div className="text-7xl font-bold tabular-nums text-white">{value}</div>
      <div className="flex gap-3 w-full">
        <BigButton onClick={onMinus} disabled={disabled || value === 0}>
          <Minus className="h-7 w-7" />
        </BigButton>
        <BigButton onClick={onPlus} disabled={disabled} variant="primary">
          <Plus className="h-7 w-7" />
        </BigButton>
      </div>
    </div>
  )
}

function BigButton({
  onClick,
  disabled,
  variant,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  variant?: 'primary'
  children: React.ReactNode
}) {
  const base =
    'flex-1 h-16 rounded-lg flex items-center justify-center text-white font-bold disabled:opacity-30 disabled:pointer-events-none transition-transform active:scale-[0.97]'
  const styles =
    variant === 'primary'
      ? 'bg-emerald-600 hover:bg-emerald-500'
      : 'bg-slate-700 hover:bg-slate-600'
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  )
}

function formatTime(iso: string): string {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
