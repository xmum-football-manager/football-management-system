'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Minus, Play, Pause, CircleStop, FastForward, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatGoalClock } from '@/lib/format'
import { MY_TZ } from '@/lib/tz'
import { mediaUrl } from '@/lib/storage'
import { teamColor, teamCode } from '@/lib/team-style'
import type { MatchWithTeams, MatchStatus, Player, Goal, Card, Team } from '@/lib/supabase/types'

// One scoring panel, shared by the authenticated scorekeeper app and the
// public per-match link. Both pass the same action contract — the panel never
// knows whether it's talking to the token endpoints or the authed ones.
export interface ScoreActions {
  recordGoal(teamId: string, playerId: string): Promise<{ home_score: number; away_score: number } | { error: string }>
  deleteGoal(goalId: string): Promise<{ home_score: number; away_score: number } | { error: string }>
  addCard(playerId: string, cardType: 'yellow' | 'red'): Promise<{ autoRed?: boolean } | { error: string }>
  removeCard(cardId: string): Promise<{ ok: true } | { error: string }>
  transition(next: MatchStatus): Promise<{ ok: true } | { error: string }>
  setKnockoutWinner(teamId: string): Promise<{ ok: true } | { error: string }>
}

interface Props {
  match: MatchWithTeams
  actions: ScoreActions
  initialHomePlayers?: Player[]
  initialAwayPlayers?: Player[]
  initialGoals?: Goal[]
  initialCards?: Card[]
}

// ---- Match clock -----------------------------------------------------------
// Counts up while live, freezes at the halftime split, resumes from the
// second-half kickoff.
function useMatchClock(match: MatchWithTeams): number | null {
  // `null` until mounted so the server HTML and the first client render agree —
  // the live clock reads the wall clock, which differs between the two otherwise.
  const [now, setNow] = useState<number | null>(null)
  const isHalftime = match.status === 'halftime'

  useEffect(() => {
    if (isHalftime || match.status !== 'live') return
    const t0 = setTimeout(() => setNow(Date.now()), 0)
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearTimeout(t0); clearInterval(t) }
  }, [isHalftime, match.status])

  return useMemo(() => {
    if (!match.match_started_at) return null
    const kickoff = new Date(match.match_started_at).getTime()
    if (match.status === 'halftime' && match.halftime_started_at) {
      return Math.floor((new Date(match.halftime_started_at).getTime() - kickoff) / 1000)
    }
    if (now === null) return null
    if (match.status === 'live' && match.halftime_started_at && match.second_half_started_at) {
      const ht = new Date(match.halftime_started_at).getTime()
      const sh = new Date(match.second_half_started_at).getTime()
      return Math.floor(((ht - kickoff) + (now - sh)) / 1000)
    }
    if (match.status === 'live') return Math.floor((now - kickoff) / 1000)
    return null
  }, [match, now])
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function formatStartDay(iso: string | null): string {
  if (!iso) return 'Time TBD'
  return new Date(iso).toLocaleString('en-US', {
    timeZone: MY_TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

// ---- Status palette --------------------------------------------------------
type Tone = { label: string; fg: string; bg: string; ring: string }
function statusTone(status: MatchStatus): Tone {
  switch (status) {
    case 'live': return { label: 'LIVE', fg: '#FFFFFF', bg: '#16A34A', ring: '#16A34A' }
    case 'halftime': return { label: 'HALF TIME', fg: '#FFFFFF', bg: '#D97706', ring: '#D97706' }
    case 'finished': return { label: 'FULL TIME', fg: '#FFFFFF', bg: '#475569', ring: '#475569' }
    default: return { label: 'SCHEDULED', fg: '#0F172A', bg: '#E2E8F0', ring: '#94A3B8' }
  }
}

// ---- Crest -----------------------------------------------------------------
function TeamCrest({ team, size = 56 }: { team: Team; size?: number }) {
  const logo = mediaUrl(team.logo_path)
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-black text-white"
      style={{
        height: size, width: size, fontSize: size * 0.3,
        ...(logo
          ? { backgroundImage: `url(${logo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: teamColor(team.id), boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.18)' }),
      }}
    >
      {logo ? null : teamCode(team.name)}
    </span>
  )
}

// ---- Bottom sheet ----------------------------------------------------------
// The single overlay style used for every picker and confirmation, so the
// surface reads as one design instead of mismatched dialogs.
function Sheet({
  title, subtitle, onClose, children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-md flex-col gap-4 rounded-t-3xl border-t-2 border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl sm:border-2"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))', animation: 'slideUp 220ms cubic-bezier(0.22,1,0.36,1)' }}
      >
        <div className="mx-auto -mt-1 h-1.5 w-12 shrink-0 rounded-full bg-slate-300 sm:hidden" />
        <div className="shrink-0">
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-1 text-base text-slate-600">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

function SheetCancel({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-14 w-full shrink-0 rounded-2xl border-2 border-slate-300 text-base font-bold text-slate-700 active:scale-[0.99] disabled:opacity-40"
    >
      Cancel
    </button>
  )
}

// Big tappable list row used inside sheets (player / goal selection).
function SheetRow({ onClick, disabled, children, danger }: {
  onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[3.5rem] w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 text-left text-lg font-semibold text-slate-900 active:scale-[0.99] disabled:opacity-40 ${
        danger ? 'border-red-200 hover:bg-red-50' : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

// ---- Trackers --------------------------------------------------------------
function GoalTracker({ team, players, goals }: { team: Team; players: Player[]; goals: Goal[] }) {
  const teamGoals = goals.filter((g) => g.team_id === team.id)
  const nameOf = (id: string | null) =>
    !id ? 'No scorer' : players.find((p) => p.id === id)?.name ?? 'Unknown'
  return (
    <div>
      <p className="mb-2 truncate text-base font-bold text-slate-900">{team.name}</p>
      {teamGoals.length === 0 ? (
        <p className="text-sm text-slate-500">No goals.</p>
      ) : (
        <ul className="space-y-1.5">
          {teamGoals.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 text-base text-slate-800">
              <span className="truncate font-medium">{nameOf(g.player_id)}</span>
              <span className="shrink-0 font-bold tabular-nums text-slate-500">{formatGoalClock(g.elapsed_seconds)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CardTracker({ team, players, cards }: { team: Team; players: Player[]; cards: Card[] }) {
  const counts = new Map<string, { yellow: number; red: number }>()
  for (const c of cards) {
    if (c.team_id !== team.id) continue
    const entry = counts.get(c.player_id) ?? { yellow: 0, red: 0 }
    if (c.card_type === 'yellow') entry.yellow += 1
    else entry.red += 1
    counts.set(c.player_id, entry)
  }
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? 'Unknown'
  const rows = [...counts.entries()]
  return (
    <div>
      <p className="mb-2 truncate text-base font-bold text-slate-900">{team.name}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No cards.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(([playerId, { yellow, red }]) => (
            <li key={playerId} className="flex items-center justify-between gap-2 text-base text-slate-800">
              <span className="truncate font-medium">{nameOf(playerId)}</span>
              <span className="flex shrink-0 items-center gap-2 font-bold tabular-nums">
                {yellow > 0 && <span className="inline-flex items-center gap-1"><i className="inline-block h-4 w-3 rounded-sm bg-amber-400" />{yellow}</span>}
                {red > 0 && <span className="inline-flex items-center gap-1"><i className="inline-block h-4 w-3 rounded-sm bg-red-600" />{red}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---- Lifecycle definitions -------------------------------------------------
interface LifecycleAction {
  next: MatchStatus
  label: string
  icon: React.ReactNode
  bg: string
  confirmTitle: string
  confirmBody: string
}
function lifecycleActions(status: MatchStatus): LifecycleAction[] {
  if (status === 'scheduled') return [{
    next: 'live', label: 'Kick Off', icon: <Play className="h-6 w-6" />, bg: '#16A34A',
    confirmTitle: 'Start the match?', confirmBody: 'Records kickoff time and starts scoring.',
  }]
  if (status === 'live') return [
    { next: 'halftime', label: 'Half Time', icon: <Pause className="h-6 w-6" />, bg: '#D97706',
      confirmTitle: 'Mark half time?', confirmBody: 'Pauses scoring until the second half starts.' },
    { next: 'finished', label: 'Full Time', icon: <CircleStop className="h-6 w-6" />, bg: '#DC2626',
      confirmTitle: 'End the match?', confirmBody: 'The result locks in and counts toward standings. Only an admin can revert it.' },
  ]
  if (status === 'halftime') return [{
    next: 'live', label: '2nd Half', icon: <FastForward className="h-6 w-6" />, bg: '#16A34A',
    confirmTitle: 'Start the second half?', confirmBody: 'Scoring resumes immediately.',
  }]
  return []
}

type Side = 'home' | 'away'
type Picker =
  | { type: 'goal'; side: Side }
  | { type: 'remove'; side: Side }
  | { type: 'card-team' }
  | { type: 'card-player'; side: Side }
  | { type: 'card-remove-team' }
  | { type: 'card-remove'; side: Side }
  | { type: 'confirm'; action: LifecycleAction }
  | { type: 'knockout' }
  | null

export function ScorePanel({
  match: initialMatch, actions,
  initialHomePlayers = [], initialAwayPlayers = [], initialGoals = [], initialCards = [],
}: Props) {
  const [match, setMatch] = useState<MatchWithTeams>(initialMatch)
  const [scores, setScores] = useState({ home: initialMatch.home_score, away: initialMatch.away_score })
  const [homePlayers, setHomePlayers] = useState<Player[]>(initialHomePlayers)
  const [awayPlayers, setAwayPlayers] = useState<Player[]>(initialAwayPlayers)
  const [goals, setGoals] = useState<Goal[]>(initialGoals)
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [removeGoals, setRemoveGoals] = useState<Goal[]>([])
  const [removeCards, setRemoveCards] = useState<Card[]>([])

  const [picker, setPicker] = useState<Picker>(null)
  const [busy, setBusy] = useState(false)
  const [pop, setPop] = useState<Side | null>(null)

  const elapsed = useMatchClock(match)
  const tone = statusTone(match.status)
  const isLive = match.status === 'live'

  // Rosters change rarely — load once per match.
  useEffect(() => {
    const supabase = createClient()
    void supabase.from('players').select('*').eq('team_id', match.home_team_id ?? '')
      .order('jersey_number', { ascending: true, nullsFirst: false })
      .then(({ data }) => { if (data?.length) setHomePlayers(data as Player[]) })
    void supabase.from('players').select('*').eq('team_id', match.away_team_id ?? '')
      .order('jersey_number', { ascending: true, nullsFirst: false })
      .then(({ data }) => { if (data?.length) setAwayPlayers(data as Player[]) })
  }, [match.home_team_id, match.away_team_id])

  // Initial goals + cards for the trackers (.then form keeps setState out of the
  // synchronous effect body; realtime + polling take over from here).
  useEffect(() => {
    const supabase = createClient()
    void supabase.from('goals').select('*').eq('match_id', match.id).order('created_at', { ascending: false })
      .then(({ data }) => setGoals((data ?? []) as Goal[]))
    void supabase.from('cards').select('*').eq('match_id', match.id).order('created_at', { ascending: false })
      .then(({ data }) => setCards((data ?? []) as Card[]))
  }, [match.id])

  const refreshEvents = useCallback(async () => {
    const supabase = createClient()
    const [{ data: g }, { data: c }] = await Promise.all([
      supabase.from('goals').select('*').eq('match_id', match.id).order('created_at', { ascending: false }),
      supabase.from('cards').select('*').eq('match_id', match.id).order('created_at', { ascending: false }),
    ])
    setGoals((g ?? []) as Goal[])
    setCards((c ?? []) as Card[])
  }, [match.id])

  const refreshMatch = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .eq('id', match.id)
      .maybeSingle()
    if (data) {
      const updated = data as unknown as MatchWithTeams
      setMatch(updated)
      setScores({ home: updated.home_score, away: updated.away_score })
    }
  }, [match.id])

  // Realtime match updates + a polling fallback that also keeps events fresh.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`score-panel-${match.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` },
        (payload) => {
          const updated = payload.new as MatchWithTeams
          setMatch((prev) => ({ ...prev, ...updated }))
          setScores({ home: updated.home_score, away: updated.away_score })
        })
      .subscribe()
    const interval = setInterval(() => { void refreshMatch(); void refreshEvents() }, 5000)
    return () => { void supabase.removeChannel(channel); clearInterval(interval) }
  }, [match.id, refreshEvents, refreshMatch])

  const rosterFor = (side: Side) => (side === 'home' ? homePlayers : awayPlayers)
  const teamFor = (side: Side) => (side === 'home' ? match.home_team : match.away_team)
  const teamIdFor = (side: Side) => (side === 'home' ? match.home_team_id : match.away_team_id) ?? ''

  function bumpScore(side: Side) {
    setPop(side)
    setTimeout(() => setPop(null), 300)
  }

  async function recordGoal(side: Side, playerId: string) {
    setPicker(null); setBusy(true)
    const r = await actions.recordGoal(teamIdFor(side), playerId)
    setBusy(false)
    if ('error' in r) return toast.error(r.error)
    setScores({ home: r.home_score, away: r.away_score })
    bumpScore(side)
    toast.success(`Goal — ${teamFor(side).name}`)
    void refreshEvents()
  }

  async function openRemove(side: Side) {
    if (!isLive) return
    const supabase = createClient()
    const { data } = await supabase.from('goals').select('*')
      .eq('match_id', match.id).eq('team_id', teamIdFor(side)).order('created_at', { ascending: false })
    setRemoveGoals((data ?? []) as Goal[])
    setPicker({ type: 'remove', side })
  }

  async function deleteGoal(side: Side, goalId: string) {
    setPicker(null); setBusy(true)
    const r = await actions.deleteGoal(goalId)
    setBusy(false)
    if ('error' in r) return toast.error(r.error)
    setScores({ home: r.home_score, away: r.away_score })
    toast.success('Goal removed.')
    void refreshEvents()
  }

  async function addCard(side: Side, playerId: string, cardType: 'yellow' | 'red') {
    setPicker(null); setBusy(true)
    const r = await actions.addCard(playerId, cardType)
    setBusy(false)
    if ('error' in r) return toast.error(r.error)
    toast.success(`${cardType === 'yellow' ? 'Yellow' : 'Red'} card — ${teamFor(side).name}`)
    if ('autoRed' in r && r.autoRed) toast.warning('Second yellow — automatic red issued.')
    void refreshEvents()
  }

  async function openRemoveCards(side: Side) {
    if (!isLive) return
    const supabase = createClient()
    const { data } = await supabase.from('cards').select('*')
      .eq('match_id', match.id).eq('team_id', teamIdFor(side)).order('created_at', { ascending: false })
    setRemoveCards((data ?? []) as Card[])
    setPicker({ type: 'card-remove', side })
  }

  async function removeCard(cardId: string) {
    setPicker(null); setBusy(true)
    const r = await actions.removeCard(cardId)
    setBusy(false)
    if ('error' in r) return toast.error(r.error)
    toast.success('Card removed.')
    void refreshEvents()
  }

  function requestTransition(action: LifecycleAction) {
    setPicker({ type: 'confirm', action })
  }

  async function commitTransition(action: LifecycleAction) {
    // Level knockout match needs the advancing team picked first.
    if (action.next === 'finished' && match.phase === 'knockout' && scores.home === scores.away && !match.winner_team_id) {
      setPicker({ type: 'knockout' })
      return
    }
    setBusy(true)
    const r = await actions.transition(action.next)
    setBusy(false)
    setPicker(null)
    if ('error' in r) return toast.error(r.error)
    toast.success(action.label)
    void refreshMatch()
  }

  async function pickKnockoutWinner(side: Side) {
    setBusy(true)
    const w = await actions.setKnockoutWinner(teamIdFor(side))
    if ('error' in w) { setBusy(false); return toast.error(w.error) }
    const r = await actions.transition('finished')
    setBusy(false)
    setPicker(null)
    if ('error' in r) return toast.error(r.error)
    toast.success('Full time. Result locked in.')
    void refreshMatch()
  }

  const actionsForStatus = lifecycleActions(match.status)

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-4">
          <TeamCrest team={match.home_team} />
          <span className="text-sm font-bold text-slate-400">VS</span>
          <TeamCrest team={match.away_team} />
        </div>
        <span
          className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-extrabold tracking-widest"
          style={{ background: tone.bg, color: tone.fg }}
        >
          {(isLive || match.status === 'halftime') && (
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-current opacity-90" />
          )}
          {tone.label}
          {elapsed !== null && <span className="tabular-nums">· {formatElapsed(elapsed)}</span>}
        </span>
        <p className="mt-2 text-sm font-medium text-slate-500" suppressHydrationWarning>{formatStartDay(match.match_time)}</p>
      </div>

      {/* Scoreboard */}
      <div className="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          {(['home', 'away'] as Side[]).map((side) => {
            const team = teamFor(side)
            return (
              <div key={side} className="flex flex-col items-center gap-3">
                <p className="line-clamp-2 min-h-[2.75rem] text-center text-base font-bold text-slate-900">{team.name}</p>
                <div
                  className="text-7xl font-black leading-none tabular-nums text-slate-900"
                  style={pop === side ? { animation: 'sk-pop 260ms cubic-bezier(0.34,1.56,0.64,1)' } : undefined}
                >
                  {scores[side]}
                </div>
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={() => openRemove(side)}
                    disabled={busy || !isLive || scores[side] === 0}
                    aria-label={`Remove goal for ${team.name}`}
                    className="flex h-16 flex-1 items-center justify-center rounded-2xl border-2 border-slate-300 text-slate-700 active:scale-[0.97] disabled:opacity-30"
                  >
                    <Minus className="h-7 w-7" strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (isLive) setPicker({ type: 'goal', side }) }}
                    disabled={busy || !isLive}
                    aria-label={`Add goal for ${team.name}`}
                    className="flex h-16 flex-1 items-center justify-center rounded-2xl text-white shadow-sm active:scale-[0.97] disabled:opacity-30"
                    style={{ background: '#16A34A' }}
                  >
                    <Plus className="h-8 w-8" strokeWidth={3} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {isLive && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setPicker({ type: 'card-team' })}
              disabled={busy}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 text-base font-bold text-slate-800 active:scale-[0.99] disabled:opacity-40"
            >
              <CreditCard className="h-5 w-5" /> Add Card
            </button>
            <button
              type="button"
              onClick={() => setPicker({ type: 'card-remove-team' })}
              disabled={busy || cards.length === 0}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 text-base font-bold text-slate-800 active:scale-[0.99] disabled:opacity-30"
            >
              <Minus className="h-5 w-5" strokeWidth={3} /> Remove Card
            </button>
          </div>
        )}
      </div>

      {/* Lifecycle */}
      {actionsForStatus.length > 0 && (
        <div className="flex flex-col gap-3">
          {actionsForStatus.map((a) => (
            <button
              key={a.next + a.label}
              type="button"
              onClick={() => requestTransition(a)}
              disabled={busy}
              className="flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl text-lg font-extrabold uppercase tracking-wide text-white shadow-sm active:scale-[0.98] disabled:opacity-40"
              style={{ background: a.bg }}
            >
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}

      {match.status === 'finished' && (
        <p className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-center text-base font-medium text-slate-600">
          Match is final. Contact the organizer for corrections.
        </p>
      )}

      {/* Goals */}
      <div className="rounded-3xl border-2 border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-extrabold tracking-widest text-slate-400">GOALS</p>
        <div className="grid grid-cols-2 gap-4">
          <GoalTracker team={match.home_team} players={homePlayers} goals={goals} />
          <GoalTracker team={match.away_team} players={awayPlayers} goals={goals} />
        </div>
      </div>

      {/* Cards */}
      <div className="rounded-3xl border-2 border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-extrabold tracking-widest text-slate-400">CARDS</p>
        <div className="grid grid-cols-2 gap-4">
          <CardTracker team={match.home_team} players={homePlayers} cards={cards} />
          <CardTracker team={match.away_team} players={awayPlayers} cards={cards} />
        </div>
      </div>

      {/* ---- Sheets ---- */}
      {picker?.type === 'goal' && (
        <Sheet
          title={`Goal — ${teamFor(picker.side).name}`}
          subtitle="Who scored?"
          onClose={() => setPicker(null)}
        >
          <PlayerList players={rosterFor(picker.side)} disabled={busy} onPick={(pid) => recordGoal(picker.side, pid)} />
          <SheetCancel onClick={() => setPicker(null)} disabled={busy} />
        </Sheet>
      )}

      {picker?.type === 'remove' && (
        <Sheet
          title={`Remove goal — ${teamFor(picker.side).name}`}
          subtitle={removeGoals.length === 0 ? 'No goals recorded for this team.' : 'Tap the goal to remove.'}
          onClose={() => setPicker(null)}
        >
          {removeGoals.length > 0 && (
            <div className="flex-1 space-y-2 overflow-y-auto">
              {removeGoals.map((g) => {
                const name = rosterFor(picker.side).find((p) => p.id === g.player_id)?.name ?? 'No scorer'
                return (
                  <SheetRow key={g.id} danger disabled={busy} onClick={() => deleteGoal(picker.side, g.id)}>
                    <span className="truncate">{name}</span>
                    <span className="shrink-0 font-bold tabular-nums text-slate-500">{formatGoalClock(g.elapsed_seconds)}</span>
                  </SheetRow>
                )
              })}
            </div>
          )}
          <SheetCancel onClick={() => setPicker(null)} disabled={busy} />
        </Sheet>
      )}

      {picker?.type === 'card-team' && (
        <Sheet title="Add card" subtitle="Which team?" onClose={() => setPicker(null)}>
          <div className="flex flex-col gap-2">
            <SheetRow disabled={busy} onClick={() => setPicker({ type: 'card-player', side: 'home' })}>{match.home_team.name}</SheetRow>
            <SheetRow disabled={busy} onClick={() => setPicker({ type: 'card-player', side: 'away' })}>{match.away_team.name}</SheetRow>
          </div>
          <SheetCancel onClick={() => setPicker(null)} disabled={busy} />
        </Sheet>
      )}

      {picker?.type === 'card-player' && (
        <Sheet title={`Card — ${teamFor(picker.side).name}`} subtitle="Pick player, then card colour." onClose={() => setPicker(null)}>
          <CardPlayerList
            players={rosterFor(picker.side)}
            disabled={busy}
            onPick={(pid, type) => addCard(picker.side, pid, type)}
          />
          <SheetCancel onClick={() => setPicker(null)} disabled={busy} />
        </Sheet>
      )}

      {picker?.type === 'card-remove-team' && (
        <Sheet title="Remove card" subtitle="Which team?" onClose={() => setPicker(null)}>
          <div className="flex flex-col gap-2">
            <SheetRow disabled={busy} onClick={() => openRemoveCards('home')}>{match.home_team.name}</SheetRow>
            <SheetRow disabled={busy} onClick={() => openRemoveCards('away')}>{match.away_team.name}</SheetRow>
          </div>
          <SheetCancel onClick={() => setPicker(null)} disabled={busy} />
        </Sheet>
      )}

      {picker?.type === 'card-remove' && (
        <Sheet
          title={`Remove card — ${teamFor(picker.side).name}`}
          subtitle={removeCards.length === 0 ? 'No cards recorded for this team.' : 'Tap the card to remove.'}
          onClose={() => setPicker(null)}
        >
          {removeCards.length > 0 && (
            <div className="flex-1 space-y-2 overflow-y-auto">
              {removeCards.map((c) => {
                const name = rosterFor(picker.side).find((p) => p.id === c.player_id)?.name ?? 'Unknown'
                return (
                  <SheetRow key={c.id} danger disabled={busy} onClick={() => removeCard(c.id)}>
                    <span className="truncate">{name}</span>
                    <span className="flex shrink-0 items-center gap-2 font-bold uppercase tracking-wide text-slate-500">
                      <i className={`inline-block h-4 w-3 rounded-sm ${c.card_type === 'yellow' ? 'bg-amber-400' : 'bg-red-600'}`} />
                      {c.card_type}
                    </span>
                  </SheetRow>
                )
              })}
            </div>
          )}
          <SheetCancel onClick={() => setPicker(null)} disabled={busy} />
        </Sheet>
      )}

      {picker?.type === 'confirm' && (
        <Sheet title={picker.action.confirmTitle} onClose={() => !busy && setPicker(null)}>
          <p className="text-lg font-bold text-slate-900">
            {match.home_team.name} {scores.home} : {scores.away} {match.away_team.name}
          </p>
          <p className="text-base text-slate-600">{picker.action.confirmBody}</p>
          <button
            type="button"
            onClick={() => commitTransition(picker.action)}
            disabled={busy}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold uppercase tracking-wide text-white active:scale-[0.99] disabled:opacity-40"
            style={{ background: picker.action.bg }}
          >
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            Confirm
          </button>
          <SheetCancel onClick={() => setPicker(null)} disabled={busy} />
        </Sheet>
      )}

      {picker?.type === 'knockout' && (
        <Sheet
          title="Pick the advancing team"
          subtitle={`Knockout match is level (${scores.home}–${scores.away}). Who goes through?`}
          onClose={() => !busy && setPicker(null)}
        >
          <div className="flex flex-col gap-2">
            <SheetRow disabled={busy} onClick={() => pickKnockoutWinner('home')}>{match.home_team.name}</SheetRow>
            <SheetRow disabled={busy} onClick={() => pickKnockoutWinner('away')}>{match.away_team.name}</SheetRow>
          </div>
          <SheetCancel onClick={() => setPicker(null)} disabled={busy} />
        </Sheet>
      )}
    </div>
  )
}

// Player list for a goal pick.
function PlayerList({ players, onPick, disabled }: {
  players: Player[]; onPick: (playerId: string) => void; disabled?: boolean
}) {
  if (players.length === 0) return <p className="text-base text-slate-500">No players found for this team.</p>
  return (
    <div className="flex-1 space-y-2 overflow-y-auto">
      {players.map((p) => (
        <SheetRow key={p.id} disabled={disabled} onClick={() => onPick(p.id)}>
          <span className="flex items-center gap-3">
            {p.jersey_number != null && <span className="w-7 shrink-0 text-right font-bold tabular-nums text-slate-400">#{p.jersey_number}</span>}
            <span className="truncate">{p.name}</span>
          </span>
        </SheetRow>
      ))}
    </div>
  )
}

// Player list where each row expands to a yellow/red choice on tap.
function CardPlayerList({ players, onPick, disabled }: {
  players: Player[]; onPick: (playerId: string, type: 'yellow' | 'red') => void; disabled?: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  if (players.length === 0) return <p className="text-base text-slate-500">No players found for this team.</p>
  return (
    <div className="flex-1 space-y-2 overflow-y-auto">
      {players.map((p) => (
        <div key={p.id} className="space-y-2">
          <SheetRow disabled={disabled} onClick={() => setSelected(selected === p.id ? null : p.id)}>
            <span className="flex items-center gap-3">
              {p.jersey_number != null && <span className="w-7 shrink-0 text-right font-bold tabular-nums text-slate-400">#{p.jersey_number}</span>}
              <span className="truncate">{p.name}</span>
            </span>
          </SheetRow>
          {selected === p.id && (
            <div className="flex gap-2 pl-2">
              <button
                type="button" disabled={disabled} onClick={() => onPick(p.id, 'yellow')}
                className="h-14 flex-1 rounded-2xl text-base font-extrabold uppercase tracking-wide text-white active:scale-[0.98] disabled:opacity-40"
                style={{ background: '#F59E0B' }}
              >
                Yellow
              </button>
              <button
                type="button" disabled={disabled} onClick={() => onPick(p.id, 'red')}
                className="h-14 flex-1 rounded-2xl text-base font-extrabold uppercase tracking-wide text-white active:scale-[0.98] disabled:opacity-40"
                style={{ background: '#DC2626' }}
              >
                Red
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
