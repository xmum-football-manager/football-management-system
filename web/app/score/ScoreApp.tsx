'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, LogOut, Minus, Plus, RefreshCcw, Play, Pause, CircleStop, FastForward } from 'lucide-react'
import { scorekeeperTransitionMatch } from './actions'
import type { MatchStatus, MatchWithTeams } from '@/lib/supabase/types'

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
      setMatches(data as unknown as MatchWithTeams[])
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

function ScoreCard({ match, onChange }: { match: MatchWithTeams; onChange: () => void }) {
  const [home, setHome] = useState(match.home_score)
  const [away, setAway] = useState(match.away_score)
  const [saving, setSaving] = useState(false)
  const [prompt, setPrompt] = useState<LifecyclePrompt | null>(null)
  const [transitioning, setTransitioning] = useState(false)

  const canScore = match.status === 'live'

  async function bump(side: 'home' | 'away', delta: number) {
    if (!canScore) return
    const newHome = side === 'home' ? Math.max(0, home + delta) : home
    const newAway = side === 'away' ? Math.max(0, away + delta) : away
    setHome(newHome)
    setAway(newAway)
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('matches')
      .update({ home_score: newHome, away_score: newAway })
      .eq('id', match.id)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      setHome(match.home_score)
      setAway(match.away_score)
      return
    }
    onChange()
  }

  async function commitTransition() {
    if (!prompt) return
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

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-4">
        {match.status === 'live' ? (
          <span className="inline-flex items-center gap-2 text-emerald-300 text-sm font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            LIVE
          </span>
        ) : match.status === 'halftime' ? (
          <span className="text-amber-300 text-sm font-semibold">HALF TIME</span>
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
          onMinus={() => bump('home', -1)}
          onPlus={() => bump('home', 1)}
          disabled={!canScore || saving}
        />
        <SideColumn
          label={match.away_team.name}
          value={away}
          onMinus={() => bump('away', -1)}
          onPlus={() => bump('away', 1)}
          disabled={!canScore || saving}
        />
      </div>

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
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
