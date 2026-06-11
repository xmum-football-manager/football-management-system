'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { withTeamFallback } from '@/lib/match-teams'
import { teamColor, teamCode } from '@/lib/team-style'
import { toast } from 'sonner'
import { Loader2, LogOut, Minus, Plus, RefreshCcw, Play, Pause, CircleStop, FastForward, CreditCard } from 'lucide-react'
import { scorekeeperTransitionMatch, recordGoalAction, undoGoalAction, addCardAction } from './actions'
import type { MatchStatus, MatchWithTeams, Player } from '@/lib/supabase/types'

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

  const liveCount = useMemo(
    () => matches.filter((m) => m.status === 'live' || m.status === 'halftime').length,
    [matches],
  )
  // Surface live/halftime matches first so a scorekeeper covering several pitches
  // can jump to whichever is in play.
  const orderedMatches = useMemo(() => {
    const rank = (s: MatchStatus) => (s === 'live' ? 0 : s === 'halftime' ? 1 : s === 'scheduled' ? 2 : 3)
    return [...matches].sort((a, b) => rank(a.status) - rank(b.status))
  }, [matches])

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
          <div className="text-center text-slate-500 max-w-sm">
            <div className="text-5xl mb-3">🟢</div>
            <p className="text-lg font-semibold text-slate-800">No matches assigned to you yet.</p>
            <p className="text-sm text-slate-500 mt-2">
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
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Your matches · tap to switch</span>
            {liveCount > 0 && (
              <span className="text-[11px] font-bold uppercase tracking-wide text-red-600">{liveCount} live</span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {orderedMatches.map((m) => {
              const active = m.id === selectedId
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`shrink-0 px-3 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap border-2 ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {m.home_team.name} vs {m.away_team.name}{' '}
                  {m.status === 'live' ? (
                    <span className={active ? 'ml-1 text-white' : 'ml-1 text-red-600'}>● LIVE</span>
                  ) : m.status === 'halftime' ? (
                    <span className={active ? 'ml-1 text-white' : 'ml-1 text-amber-600'}>HT</span>
                  ) : m.status === 'finished' ? (
                    <span className={active ? 'ml-1 text-white/80' : 'ml-1 text-slate-400'}>FT</span>
                  ) : (
                    <span suppressHydrationWarning className={active ? 'ml-1 text-white/80' : 'ml-1 text-slate-400'}>{formatTime(m.match_time ?? '')}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="flex-1 flex items-start justify-center p-4">
        {selected && <ScoreCard key={selected.id} match={selected} onChange={refresh} />}
      </div>
    </div>
  )
}

function Header({ email, onRefresh, refreshing }: { email: string; onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <header className="flex items-center gap-3 px-4 h-14 border-b-2 border-slate-200 bg-white sticky top-0 z-10">
      <span className="text-sm font-medium text-slate-500 truncate flex-1">{email}</span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="h-10 w-10 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 active:scale-95"
          title="Refresh"
        >
          {refreshing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCcw className="h-5 w-5" />}
        </button>
      )}
      <form action="/score/auth/signout" method="post">
        <button
          type="submit"
          className="h-10 px-3 inline-flex items-center gap-1.5 rounded-lg hover:bg-slate-100 text-slate-600 text-sm font-semibold"
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
  | { type: 'card' }
  | { type: 'card-player'; side: 'home' | 'away' }
  | { type: 'card-type'; side: 'home' | 'away'; playerId: string }

// A guarded action: shown in a confirm dialog with an auto-cancel countdown.
interface PendingConfirm {
  title: string
  detail?: React.ReactNode
  confirmLabel: string
  tone: 'primary' | 'amber' | 'red'
  run: () => Promise<void>
}

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
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null)
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null)
  const [confirmPending, setConfirmPending] = useState(false)
  const [homePlayers, setHomePlayers] = useState<Player[] | null>(null)
  const [awayPlayers, setAwayPlayers] = useState<Player[] | null>(null)

  const canScore = match.status === 'live'
  const elapsedSeconds = useMatchClock(match)

  // Reconcile the optimistic local score with the latest fetched match. Done at
  // render time (not in an effect) so an external change — admin edit, the 5s
  // poll — flows through without a setState-in-effect cascade.
  const [syncedScore, setSyncedScore] = useState({ h: match.home_score, a: match.away_score })
  if (syncedScore.h !== match.home_score || syncedScore.a !== match.away_score) {
    setSyncedScore({ h: match.home_score, a: match.away_score })
    setHome(match.home_score)
    setAway(match.away_score)
  }

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

  const closeConfirm = useCallback(() => setConfirm(null), [])

  async function runConfirm() {
    if (!confirm) return
    setConfirmPending(true)
    await confirm.run()
    setConfirmPending(false)
    setConfirm(null)
  }

  const sideRoster = (side: 'home' | 'away') => (side === 'home' ? homePlayers ?? [] : awayPlayers ?? [])
  const sideTeam = (side: 'home' | 'away') => (side === 'home' ? match.home_team : match.away_team)
  const sideTeamId = (side: 'home' | 'away') => (side === 'home' ? match.home_team_id : match.away_team_id)

  function openGoalPicker(side: 'home' | 'away') {
    if (!canScore) return
    setPickerMode({ type: 'goal', side })
  }

  // Player picked for a goal (null = unspecified) → ask to confirm
  function confirmGoal(side: 'home' | 'away', player: Player | null) {
    setPickerMode(null)
    const team = sideTeam(side)
    setConfirm({
      title: `Goal — ${team.name}`,
      detail: <ScorerLabel player={player} />,
      confirmLabel: 'Confirm goal',
      tone: 'primary',
      run: async () => {
        const result = await recordGoalAction(match.id, sideTeamId(side), player?.id ?? null)
        if ('error' in result) {
          toast.error(result.error)
          return
        }
        setHome(result.home_score)
        setAway(result.away_score)
        toast.success('Goal recorded.')
        onChange()
      },
    })
  }

  async function handleUndo(side: 'home' | 'away') {
    if (!canScore) return
    const teamId = sideTeamId(side)
    setSaving(true)
    const result = await undoGoalAction(match.id, teamId)
    setSaving(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setHome(result.home_score)
    setAway(result.away_score)
    onChange()
  }

  // Card type chosen → ask to confirm
  function confirmCard(side: 'home' | 'away', playerId: string, cardType: 'yellow' | 'red') {
    setPickerMode(null)
    const team = sideTeam(side)
    const player = sideRoster(side).find((p) => p.id === playerId) ?? null
    setConfirm({
      title: `${cardType === 'yellow' ? 'Yellow' : 'Red'} card — ${team.name}`,
      detail: <ScorerLabel player={player} />,
      confirmLabel: `Confirm ${cardType} card`,
      tone: cardType === 'yellow' ? 'amber' : 'red',
      run: async () => {
        const result = await addCardAction(match.id, playerId, cardType)
        if ('error' in result) {
          toast.error(result.error)
          return
        }
        toast.success(`${cardType === 'yellow' ? 'Yellow' : 'Red'} card recorded.`)
        onChange()
      },
    })
  }

  function confirmTransition(prompt: LifecyclePrompt) {
    setConfirm({
      title: prompt.title,
      detail: (
        <span className="text-slate-600">
          {match.home_team.name} {home} : {away} {match.away_team.name}
          <br />
          {prompt.description}
        </span>
      ),
      confirmLabel: prompt.label.replace(/\.$/, ''),
      tone: prompt.destructive ? 'red' : 'primary',
      run: async () => {
        const r = await scorekeeperTransitionMatch(match.id, prompt.next)
        if ('error' in r) {
          toast.error(r.error)
          return
        }
        toast.success(prompt.label)
        onChange()
      },
    })
  }

  const lifecycleButtons: { prompt: LifecyclePrompt; icon: React.ReactNode; tone: 'primary' | 'amber' | 'red' }[] = []
  if (match.status === 'scheduled') {
    lifecycleButtons.push({
      prompt: {
        next: 'live',
        label: 'Match kicked off.',
        title: 'Start the match?',
        description: 'Records kickoff time and starts scoring. Make sure both teams are on the pitch.',
        destructive: false,
      },
      icon: <Play className="h-6 w-6" />,
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
      icon: <Pause className="h-6 w-6" />,
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
      icon: <CircleStop className="h-6 w-6" />,
      tone: 'red',
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
      icon: <FastForward className="h-6 w-6" />,
      tone: 'primary',
    })
  }

  return (
    <div className="w-full max-w-md">
      <StatusBanner match={match} elapsedSeconds={elapsedSeconds} />

      <div className="grid grid-cols-2 gap-3 mt-4">
        <SideColumn
          team={match.home_team}
          teamId={match.home_team_id}
          value={home}
          onMinus={() => handleUndo('home')}
          onPlus={() => openGoalPicker('home')}
          disabled={!canScore || saving}
        />
        <SideColumn
          team={match.away_team}
          teamId={match.away_team_id}
          value={away}
          onMinus={() => handleUndo('away')}
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
            className="w-full h-14 rounded-xl border-2 border-slate-300 bg-white text-slate-800 text-base font-bold hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <CreditCard className="h-5 w-5" />
            Card
            <span className="ml-1 inline-block h-4 w-3 rounded-sm bg-amber-400 align-middle" />
            <span className="inline-block h-4 w-3 rounded-sm bg-red-600 align-middle" />
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
              onClick={() => confirmTransition(btn.prompt)}
              disabled={confirmPending}
            >
              {labelFor(match.status, btn.prompt.next)}
            </LifecycleButton>
          ))}
        </div>
      )}

      {match.status === 'finished' && (
        <p className="mt-5 text-center text-sm text-slate-500">
          Match is final. Contact the organizer for corrections.
        </p>
      )}

      {/* Goal player picker */}
      {pickerMode?.type === 'goal' && (
        <PlayerPickerOverlay
          title={`Goal — ${sideTeam(pickerMode.side).name}`}
          players={sideRoster(pickerMode.side)}
          allowUnspecified
          onPick={(player) => confirmGoal(pickerMode.side, player)}
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
          title={`Card — ${sideTeam(pickerMode.side).name}`}
          players={sideRoster(pickerMode.side)}
          onPick={(player) => player && setPickerMode({ type: 'card-type', side: pickerMode.side, playerId: player.id })}
          onCancel={() => setPickerMode(null)}
        />
      )}

      {/* Card: choose type */}
      {pickerMode?.type === 'card-type' && (
        <CardTypeOverlay
          onPick={(ct) => confirmCard(pickerMode.side, pickerMode.playerId, ct)}
          onCancel={() => setPickerMode(null)}
        />
      )}

      {/* Confirm + auto-cancel countdown */}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          detail={confirm.detail}
          confirmLabel={confirm.confirmLabel}
          tone={confirm.tone}
          pending={confirmPending}
          onConfirm={runConfirm}
          onCancel={closeConfirm}
        />
      )}
    </div>
  )
}

function ScorerLabel({ player }: { player: Player | null }) {
  if (!player) return <span className="font-semibold text-slate-500">Scorer not specified</span>
  return (
    <span className="font-bold text-slate-900">
      {player.jersey_number !== null && <span className="text-slate-400">#{player.jersey_number} </span>}
      {player.name}
    </span>
  )
}

function StatusBanner({ match, elapsedSeconds }: { match: MatchWithTeams; elapsedSeconds: number | null }) {
  if (match.status === 'live') {
    return (
      <div className="flex items-center justify-center gap-3 h-12 rounded-xl bg-red-600 text-white">
        <span className="inline-flex items-center gap-2 text-base font-extrabold tracking-wide">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          LIVE
        </span>
        {elapsedSeconds !== null && (
          <span suppressHydrationWarning className="text-base font-bold tabular-nums">{formatElapsed(elapsedSeconds)}</span>
        )}
      </div>
    )
  }
  if (match.status === 'halftime') {
    return (
      <div className="flex items-center justify-center gap-3 h-12 rounded-xl bg-amber-500 text-white">
        <span className="text-base font-extrabold tracking-wide">HALF TIME</span>
        {elapsedSeconds !== null && (
          <span suppressHydrationWarning className="text-base font-bold tabular-nums">{formatElapsed(elapsedSeconds)}</span>
        )}
      </div>
    )
  }
  if (match.status === 'finished') {
    return (
      <div className="flex items-center justify-center h-12 rounded-xl bg-slate-800 text-white">
        <span className="text-base font-extrabold tracking-wide">FULL TIME</span>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center gap-2 h-12 rounded-xl bg-slate-100 text-slate-600 border-2 border-slate-200">
      <span className="text-sm font-bold tracking-wide">SCHEDULED</span>
      <span suppressHydrationWarning className="text-sm font-semibold">· {formatTime(match.match_time ?? '')}</span>
    </div>
  )
}

function PlayerPickerOverlay({
  title,
  players,
  allowUnspecified,
  onPick,
  onCancel,
}: {
  title: string
  players: Player[]
  allowUnspecified?: boolean
  onPick: (player: Player | null) => void
  onCancel: () => void
}) {
  return (
    <Overlay onCancel={onCancel}>
      <h2 className="text-lg font-extrabold text-slate-900 shrink-0">{title}</h2>
      <div className="overflow-y-auto flex-1 space-y-2">
        {allowUnspecified && (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="w-full text-left px-4 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-base font-semibold border-2 border-dashed border-slate-300"
          >
            Don&apos;t specify
          </button>
        )}
        {players.length === 0 ? (
          <p className="text-slate-500 text-sm py-2">No players found for this team.</p>
        ) : (
          players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className="w-full text-left px-4 py-3.5 rounded-xl bg-white hover:bg-blue-50 text-slate-900 text-base font-semibold border-2 border-slate-200 flex items-center gap-3 active:scale-[0.99]"
            >
              {p.jersey_number !== null && (
                <span className="text-sm font-bold text-slate-400 w-7 text-right shrink-0">#{p.jersey_number}</span>
              )}
              <span>{p.name}</span>
            </button>
          ))
        )}
      </div>
      <CancelButton onClick={onCancel} />
    </Overlay>
  )
}

function ChooseTeamOverlay({
  homeTeamName,
  awayTeamName,
  onPick,
  onCancel,
}: {
  homeTeamName: string
  awayTeamName: string
  onPick: (side: 'home' | 'away') => void
  onCancel: () => void
}) {
  return (
    <Overlay onCancel={onCancel}>
      <h2 className="text-lg font-extrabold text-slate-900">Card — Choose Team</h2>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onPick('home')}
          className="flex-1 h-16 rounded-xl bg-white border-2 border-slate-200 hover:bg-blue-50 text-slate-900 font-bold text-base active:scale-[0.99]"
        >
          {homeTeamName}
        </button>
        <button
          type="button"
          onClick={() => onPick('away')}
          className="flex-1 h-16 rounded-xl bg-white border-2 border-slate-200 hover:bg-blue-50 text-slate-900 font-bold text-base active:scale-[0.99]"
        >
          {awayTeamName}
        </button>
      </div>
      <CancelButton onClick={onCancel} />
    </Overlay>
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
    <Overlay onCancel={onCancel}>
      <h2 className="text-lg font-extrabold text-slate-900">Card — Choose Type</h2>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onPick('yellow')}
          className="flex-1 h-20 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-base uppercase tracking-wide active:scale-[0.99]"
        >
          Yellow
        </button>
        <button
          type="button"
          onClick={() => onPick('red')}
          className="flex-1 h-20 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-base uppercase tracking-wide active:scale-[0.99]"
        >
          Red
        </button>
      </div>
      <CancelButton onClick={onCancel} />
    </Overlay>
  )
}

function ConfirmDialog({
  title,
  detail,
  confirmLabel,
  tone,
  pending,
  onConfirm,
  onCancel,
  seconds = 5,
}: {
  title: string
  detail?: React.ReactNode
  confirmLabel: string
  tone: 'primary' | 'amber' | 'red'
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
  seconds?: number
}) {
  const [left, setLeft] = useState(seconds)

  // Auto-cancel countdown. Paused while the action is running so a slow network
  // can't make the dialog vanish mid-commit.
  useEffect(() => {
    if (pending) return
    if (left <= 0) {
      onCancel()
      return
    }
    const id = setTimeout(() => setLeft((l) => l - 1), 1000)
    return () => clearTimeout(id)
  }, [left, pending, onCancel])

  const confirmPalette =
    tone === 'primary'
      ? 'bg-blue-600 hover:bg-blue-500'
      : tone === 'amber'
        ? 'bg-amber-500 hover:bg-amber-400'
        : 'bg-red-600 hover:bg-red-500'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border-2 border-slate-200 shadow-2xl p-5 space-y-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
          {detail && <div className="mt-2 text-base">{detail}</div>}
        </div>

        {!pending && (
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-400">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 tabular-nums text-slate-500">
              {left}
            </span>
            Auto-cancels in {left}s
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="flex-1 h-14 rounded-xl border-2 border-slate-300 text-slate-800 font-bold text-base hover:bg-slate-50 disabled:opacity-40 active:scale-[0.99]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`flex-1 h-14 rounded-xl font-extrabold text-white text-base inline-flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99] ${confirmPalette}`}
          >
            {pending && <Loader2 className="h-5 w-5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function Overlay({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white border-2 border-slate-200 shadow-2xl p-5 space-y-3 max-h-[82vh] flex flex-col">
        {children}
      </div>
    </div>
  )
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-12 rounded-xl border-2 border-slate-300 text-slate-800 font-bold text-base hover:bg-slate-50 shrink-0 active:scale-[0.99]"
    >
      Cancel
    </button>
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
  tone: 'primary' | 'amber' | 'red'
  icon: React.ReactNode
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const palette =
    tone === 'primary'
      ? 'bg-blue-600 hover:bg-blue-500'
      : tone === 'amber'
        ? 'bg-amber-500 hover:bg-amber-400'
        : 'bg-red-600 hover:bg-red-500'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${palette} text-white font-extrabold h-16 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none transition-transform active:scale-[0.98] text-lg`}
    >
      {icon}
      <span className="uppercase tracking-wide">{children}</span>
    </button>
  )
}

function SideColumn({
  team,
  teamId,
  value,
  onMinus,
  onPlus,
  disabled,
}: {
  team: { name: string }
  teamId: string
  value: number
  onMinus: () => void
  onPlus: () => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 min-h-[2.75rem]">
        <span
          className="inline-flex h-6 items-center rounded-md px-1.5 text-[11px] font-extrabold text-white shrink-0"
          style={{ background: teamColor(teamId) }}
        >
          {teamCode(team.name)}
        </span>
        <span className="text-sm text-slate-800 font-bold uppercase tracking-wide text-center leading-tight">
          {team.name}
        </span>
      </div>
      <div key={value} className="sk-pop text-7xl font-black tabular-nums text-slate-900">{value}</div>
      <div className="flex gap-2 w-full">
        <BigButton onClick={onMinus} disabled={disabled || value === 0}>
          <Minus className="h-7 w-7" />
        </BigButton>
        <BigButton onClick={onPlus} disabled={disabled} variant="primary">
          <Plus className="h-8 w-8" />
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
    'flex-1 h-20 rounded-xl flex items-center justify-center font-bold disabled:opacity-30 disabled:pointer-events-none transition-transform active:scale-[0.96]'
  const styles =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
      : 'bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-100'
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
