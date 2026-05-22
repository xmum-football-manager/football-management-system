'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MatchStatusBadge } from '@/components/admin/MatchStatusBadge'
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
import { Loader2, Wand2, Plus, Trash2, Lock } from 'lucide-react'
import { generateRoundRobin } from '@/lib/round-robin'
import { addMatchAction, deleteMatchAction, bulkAddMatchesAction } from './actions'
import type { MatchStatus, TournamentFormat } from '@/lib/supabase/types'
import { formatClock } from '@/lib/format'

interface Team {
  id: string
  name: string
}

interface MatchLite {
  id: string
  match_time: string
  status: MatchStatus
  home_score: number
  away_score: number
  home_team: Team
  away_team: Team
}

interface Props {
  tournamentId: string
  tournamentStart: string
  tournamentFormat: TournamentFormat
  teams: Team[]
  matches: MatchLite[]
  canEdit: boolean
}

export function FixturesPanel({
  tournamentId,
  tournamentStart,
  tournamentFormat,
  teams,
  matches,
  canEdit,
}: Props) {
  const [view, setView] = useState<'list' | 'board'>('board')

  return (
    <div className="space-y-5">
      {!canEdit && (
        <div className="rounded-md border bg-amber-50 border-amber-200 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
          <Lock className="h-3 w-3" /> Fixtures are locked — the tournament is finished or archived.
        </div>
      )}

      {canEdit && (
        <div className="grid md:grid-cols-2 gap-4">
          <AddOneCard tournamentId={tournamentId} tournamentStart={tournamentStart} teams={teams} />
          {(tournamentFormat === 'round_robin' || tournamentFormat === 'round_robin_knockout') && (
            <AutoScheduleCard
              tournamentId={tournamentId}
              tournamentStart={tournamentStart}
              teams={teams}
              existingCount={matches.length}
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Fixtures ({matches.length})
        </h2>
        <div className="inline-flex rounded-md border bg-white p-0.5 text-xs">
          <button
            onClick={() => setView('board')}
            className={`px-2.5 py-1 rounded ${view === 'board' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}
          >
            Board
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-2.5 py-1 rounded ${view === 'list' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'}`}
          >
            List
          </button>
        </div>
      </div>

      {matches.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No fixtures yet. {teams.length >= 2 ? 'Add one above or auto-generate.' : 'Add at least 2 teams first.'}
          </CardContent>
        </Card>
      ) : view === 'board' ? (
        <FixturesBoard matches={matches} canEdit={canEdit} tournamentId={tournamentId} />
      ) : (
        <FixturesList matches={matches} canEdit={canEdit} tournamentId={tournamentId} />
      )}
    </div>
  )
}

function AddOneCard({
  tournamentId,
  tournamentStart,
  teams,
}: {
  tournamentId: string
  tournamentStart: string
  teams: Team[]
}) {
  const router = useRouter()
  const [home, setHome] = useState('')
  const [away, setAway] = useState('')
  const [time, setTime] = useState(() => defaultTime(tournamentStart))
  const [pending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!home || !away || home === away) {
      toast.error('Pick two different teams.')
      return
    }
    if (!time) {
      toast.error('Pick a match time.')
      return
    }
    startTransition(async () => {
      const r = await addMatchAction({
        tournament_id: tournamentId,
        home_team_id: home,
        away_team_id: away,
        match_time: new Date(time).toISOString(),
      })
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Fixture added.')
        setHome('')
        setAway('')
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">Schedule a match</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Home</Label>
              <Select value={home} onValueChange={setHome}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id} disabled={t.id === away}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Away</Label>
              <Select value={away} onValueChange={setAway}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id} disabled={t.id === home}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date &amp; time</Label>
            <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <Button type="submit" disabled={pending || teams.length < 2}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Schedule Match
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function AutoScheduleCard({
  tournamentId,
  tournamentStart,
  teams,
  existingCount,
}: {
  tournamentId: string
  tournamentStart: string
  teams: Team[]
  existingCount: number
}) {
  const router = useRouter()
  const [kickoff, setKickoff] = useState(() => defaultTime(tournamentStart, '15:00'))
  const [matchLength, setMatchLength] = useState(90)
  const [perDay, setPerDay] = useState(4)
  const [pending, startTransition] = useTransition()

  const rounds = useMemo(() => generateRoundRobin(teams.map((t) => t.id)), [teams])
  const totalMatches = rounds.reduce((n, r) => n + r.length, 0)

  async function handleGenerate() {
    if (teams.length < 2) {
      toast.error('Need at least 2 teams.')
      return
    }
    const start = new Date(kickoff)
    if (Number.isNaN(start.getTime())) {
      toast.error('Pick a valid kickoff time.')
      return
    }
    // Schedule: matchLength minutes per slot, perDay slots per day, then next day at the same kickoff.
    const inserts: { home_team_id: string; away_team_id: string; match_time: string }[] = []
    let dayIndex = 0
    let slotIndex = 0
    for (const round of rounds) {
      for (const m of round) {
        const t = new Date(start)
        t.setDate(t.getDate() + dayIndex)
        t.setMinutes(t.getMinutes() + matchLength * slotIndex)
        inserts.push({
          home_team_id: m.home,
          away_team_id: m.away,
          match_time: t.toISOString(),
        })
        slotIndex += 1
        if (slotIndex >= perDay) {
          slotIndex = 0
          dayIndex += 1
        }
      }
    }
    startTransition(async () => {
      const r = await bulkAddMatchesAction(tournamentId, inserts)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success(`Created ${r.created} fixtures.`)
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          <Wand2 className="h-4 w-4 text-emerald-600" /> Auto-generate round-robin
        </h3>
        <p className="text-xs text-muted-foreground">
          Generates every team-vs-team pairing. With {teams.length} team{teams.length === 1 ? '' : 's'}: {totalMatches} fixtures.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">First kickoff</Label>
            <Input
              type="datetime-local"
              value={kickoff}
              onChange={(e) => setKickoff(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Slot length (min)</Label>
            <Input
              type="number"
              min={30}
              max={240}
              value={matchLength}
              onChange={(e) => setMatchLength(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Matches per day</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={perDay}
              onChange={(e) => setPerDay(Number(e.target.value))}
            />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleGenerate}
          disabled={pending || teams.length < 2 || totalMatches === 0}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {existingCount > 0 ? `Append ${totalMatches} fixtures` : `Generate ${totalMatches} fixtures`}
        </Button>
        {existingCount > 0 && (
          <p className="text-[11px] text-amber-700">
            ⚠ {existingCount} fixture{existingCount === 1 ? '' : 's'} already exist. Auto-generate appends new ones; duplicates may occur.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function FixturesBoard({
  matches,
  canEdit,
  tournamentId,
}: {
  matches: MatchLite[]
  canEdit: boolean
  tournamentId: string
}) {
  const byDay = useMemo(() => groupByDay(matches), [matches])

  return (
    <div className="space-y-4">
      {byDay.map((day) => (
        <div key={day.key}>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {day.label}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {day.matches.map((m) => (
              <Card key={m.id} className="overflow-hidden">
                <div
                  className={
                    m.status === 'live'
                      ? 'h-1 w-full bg-emerald-500'
                      : m.status === 'halftime'
                        ? 'h-1 w-full bg-amber-400'
                        : m.status === 'finished'
                          ? 'h-1 w-full bg-slate-400'
                          : 'h-1 w-full bg-transparent'
                  }
                />
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span className="font-mono">{formatClock(m.match_time)}</span>
                    <span className="flex-1" />
                    <MatchStatusBadge status={m.status} />
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="text-right truncate font-medium text-sm">{m.home_team.name}</div>
                    <div className="px-2 py-1 bg-slate-100 rounded font-mono font-bold text-sm tabular-nums">
                      {m.home_score} : {m.away_score}
                    </div>
                    <div className="text-left truncate font-medium text-sm">{m.away_team.name}</div>
                  </div>
                  {canEdit && m.status === 'scheduled' && (
                    <div className="mt-2 flex justify-end">
                      <DeleteFixture matchId={m.id} tournamentId={tournamentId} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function FixturesList({
  matches,
  canEdit,
  tournamentId,
}: {
  matches: MatchLite[]
  canEdit: boolean
  tournamentId: string
}) {
  return (
    <Card>
      <CardContent className="p-0 divide-y">
        {matches.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-3">
            <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">
              {new Date(m.match_time).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
            <span className="flex-1 text-right truncate font-medium text-sm">{m.home_team.name}</span>
            <span className="px-2 py-0.5 bg-slate-100 rounded font-mono text-xs tabular-nums">
              {m.home_score} : {m.away_score}
            </span>
            <span className="flex-1 text-left truncate font-medium text-sm">{m.away_team.name}</span>
            <MatchStatusBadge status={m.status} />
            {canEdit && m.status === 'scheduled' && (
              <DeleteFixture matchId={m.id} tournamentId={tournamentId} />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function DeleteFixture({ matchId, tournamentId }: { matchId: string; tournamentId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" disabled={pending}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this fixture?</AlertDialogTitle>
          <AlertDialogDescription>
            The match will be removed. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() =>
              startTransition(async () => {
                const r = await deleteMatchAction(matchId, tournamentId)
                if ('error' in r) toast.error(r.error)
                else {
                  toast.success('Fixture deleted.')
                  router.refresh()
                }
              })
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function groupByDay(matches: MatchLite[]) {
  const map = new Map<string, MatchLite[]>()
  for (const m of matches) {
    const d = new Date(m.match_time)
    const key = d.toISOString().slice(0, 10)
    const arr = map.get(key) ?? []
    arr.push(m)
    map.set(key, arr)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ms]) => ({
      key,
      label: new Date(key).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
      matches: ms.sort((a, b) => a.match_time.localeCompare(b.match_time)),
    }))
}

function defaultTime(start: string, hhmm = '15:00'): string {
  // Returns local datetime string suitable for <input type="datetime-local">
  // Use the tournament start date with given time.
  const [yyyy, mm, dd] = start.split('-')
  return `${yyyy}-${mm}-${dd}T${hhmm}`
}
