# Group-Stage Fixture Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate group-stage round-robin fixtures in one click and let organizers schedule each match to a day/time slot via a column-card UI.

**Architecture:** Nullable `match_time` in the DB enables two-phase workflow: generate all matchups instantly (null time), then schedule them one-by-one. A `FixtureSchedulerPanel` mirrors the RD-Groups column-card pattern — unscheduled pool at top, day cards below. Two new server actions handle generation and scheduling. Pure utility functions handle end-time calculation and day-label generation.

**Tech Stack:** Next.js 15 App Router, Supabase, Vitest, shadcn/ui (Card, Select, Button, Badge), `lucide-react`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `web/lib/supabase/types.ts` | Modify | `Match.match_time: string → string \| null` |
| `web/lib/db/matches.ts` | Modify | `CreateMatchInput.match_time?: string \| null`, `updateMatchTime` accepts `string \| null` |
| `web/lib/fixture-scheduling.ts` | Create | Pure utils: `computeEndTime`, `getTournamentDays` |
| `web/__tests__/fixture-scheduling.test.ts` | Create | Vitest tests for those utils |
| `web/app/admin/tournaments/[id]/fixtures/actions.ts` | Modify | Add `generateGroupFixturesAction`, `scheduleMatchAction` |
| `web/app/admin/tournaments/[id]/rd-fixtures/GenerateGroupFixturesButton.tsx` | Create | Client button that calls `generateGroupFixturesAction` |
| `web/app/admin/tournaments/[id]/rd-fixtures/FixtureSchedulerPanel.tsx` | Create | Scheduling UI: unscheduled pool + day cards + inline form |
| `web/app/admin/tournaments/[id]/rd-fixtures/page.tsx` | Modify | Restore readiness check; pass tournament settings; show new components |
| `web/app/t/[id]/TournamentView.tsx` | Modify | Filter `matches` to hide null-time entries in public view |
| `web/app/admin/tournaments/[id]/actions.ts` | Modify | Scorekeeper guard: block go-live if `match_time` is null |

---

## Task 1: DB Migration + TypeScript Types

**Files:**
- Modify: `web/lib/supabase/types.ts:58-73`
- Modify: `web/lib/db/matches.ts:22-47`

- [ ] **Step 1: Run SQL migration in Supabase dashboard**

Open your Supabase project → SQL Editor and run:
```sql
ALTER TABLE matches ALTER COLUMN match_time DROP NOT NULL;
```

- [ ] **Step 2: Update `Match.match_time` to nullable**

In `web/lib/supabase/types.ts`, change line 63:
```typescript
// Before
match_time: string

// After
match_time: string | null
```

- [ ] **Step 3: Update `CreateMatchInput.match_time` to nullable**

In `web/lib/db/matches.ts`, change `CreateMatchInput`:
```typescript
export interface CreateMatchInput {
  tournament_id: string
  home_team_id: string
  away_team_id: string
  match_time: string | null
  phase?: string
  knockout_round?: string
}
```

- [ ] **Step 4: Update `updateMatchTime` to accept `string | null`**

In `web/lib/db/matches.ts`, change:
```typescript
export async function updateMatchTime(id: string, match_time: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('matches').update({ match_time }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}
```

- [ ] **Step 5: Verify typecheck passes**

```bash
cd web && tsc --noEmit
```
Expected: 0 errors (some callsites that pass `string` will still satisfy `string | null`).

- [ ] **Step 6: Commit**

```bash
git add web/lib/supabase/types.ts web/lib/db/matches.ts
git commit -m "feat: make match_time nullable for unscheduled group fixtures"
```

---

## Task 2: Scheduling Utility Functions (TDD)

**Files:**
- Create: `web/lib/fixture-scheduling.ts`
- Create: `web/__tests__/fixture-scheduling.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `web/__tests__/fixture-scheduling.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeEndTime, getTournamentDays } from '@/lib/fixture-scheduling'

describe('computeEndTime', () => {
  it('returns start + 2x minutesPerHalf when halftime is disabled', () => {
    expect(computeEndTime('09:00', 45, false, null)).toBe('10:30')
  })

  it('adds halftime_minutes when halftime is enabled', () => {
    expect(computeEndTime('09:00', 45, true, 15)).toBe('10:45')
  })

  it('treats null halftime_minutes as 0 when halftime is enabled', () => {
    expect(computeEndTime('09:00', 45, true, null)).toBe('10:30')
  })

  it('handles wrap past midnight', () => {
    expect(computeEndTime('23:00', 45, false, null)).toBe('00:30')
  })

  it('works with 30-minute halves', () => {
    expect(computeEndTime('14:00', 30, true, 10)).toBe('15:10')
  })
})

describe('getTournamentDays', () => {
  it('returns one day when start equals end', () => {
    const days = getTournamentDays('2026-01-15', '2026-01-15')
    expect(days).toHaveLength(1)
    expect(days[0]).toEqual({ label: 'Day 1 (15 Jan)', date: '2026-01-15' })
  })

  it('returns correct range for multi-day tournament', () => {
    const days = getTournamentDays('2026-01-15', '2026-01-17')
    expect(days).toHaveLength(3)
    expect(days[0]).toEqual({ label: 'Day 1 (15 Jan)', date: '2026-01-15' })
    expect(days[1]).toEqual({ label: 'Day 2 (16 Jan)', date: '2026-01-16' })
    expect(days[2]).toEqual({ label: 'Day 3 (17 Jan)', date: '2026-01-17' })
  })

  it('formats the date label with abbreviated month', () => {
    const days = getTournamentDays('2026-12-31', '2026-12-31')
    expect(days[0].label).toBe('Day 1 (31 Dec)')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd web && pnpm test fixture-scheduling
```
Expected: FAIL — `Cannot find module '@/lib/fixture-scheduling'`

- [ ] **Step 3: Implement the utility functions**

Create `web/lib/fixture-scheduling.ts`:

```typescript
export function computeEndTime(
  startTime: string,
  minutesPerHalf: number,
  halftimeEnabled: boolean,
  halftimeMinutes: number | null,
): string {
  const [h, m] = startTime.split(':').map(Number)
  const duration = 2 * minutesPerHalf + (halftimeEnabled ? (halftimeMinutes ?? 0) : 0)
  const totalMinutes = (h * 60 + m + duration) % (24 * 60)
  const endH = Math.floor(totalMinutes / 60)
  const endM = totalMinutes % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

export function getTournamentDays(
  startDate: string,
  endDate: string,
): Array<{ label: string; date: string }> {
  const days: Array<{ label: string; date: string }> = []
  const current = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')
  let dayNumber = 1
  while (current <= end) {
    const isoDate = current.toISOString().split('T')[0]
    const day = current.getUTCDate()
    const month = current.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
    days.push({ label: `Day ${dayNumber} (${day} ${month})`, date: isoDate })
    current.setUTCDate(current.getUTCDate() + 1)
    dayNumber++
  }
  return days
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd web && pnpm test fixture-scheduling
```
Expected: PASS — all 8 tests green

- [ ] **Step 5: Commit**

```bash
git add web/lib/fixture-scheduling.ts web/__tests__/fixture-scheduling.test.ts
git commit -m "feat: add computeEndTime and getTournamentDays utilities"
```

---

## Task 3: Server Actions — `generateGroupFixturesAction` and `scheduleMatchAction`

**Files:**
- Modify: `web/app/admin/tournaments/[id]/fixtures/actions.ts`

- [ ] **Step 1: Add imports at top of actions.ts**

At the top of `web/app/admin/tournaments/[id]/fixtures/actions.ts`, add to existing imports:
```typescript
import { generateRoundRobin } from '@/lib/round-robin'
```

(All other needed imports — `createMatch`, `getMatch`, `listMatches`, `listTeams`, `getTournament`, `ensureOrganizer`, `revalidateFixtures` — are already in the file.)

- [ ] **Step 2: Add `generateGroupFixturesAction`**

Append to `web/app/admin/tournaments/[id]/fixtures/actions.ts`:

```typescript
export async function generateGroupFixturesAction(
  tournamentId: string,
): Promise<{ created: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const [tournament, teams, existing] = await Promise.all([
      getTournament(tournamentId),
      listTeams(tournamentId),
      listMatches(tournamentId),
    ])
    if (!tournament) return { error: 'Tournament not found.' }
    if (!tournament.num_groups) return { error: 'No groups configured.' }
    if (existing.length > 0) return { error: 'Fixtures already exist for this tournament.' }

    const validLabels = Array.from(
      { length: tournament.num_groups },
      (_, i) => String.fromCharCode(65 + i),
    )
    let created = 0
    for (const label of validLabels) {
      const groupTeams = teams.filter((t) => t.group_label === label)
      const rounds = generateRoundRobin(groupTeams)
      for (const round of rounds) {
        for (const { home, away } of round) {
          const r = await createMatch({
            tournament_id: tournamentId,
            home_team_id: home.id,
            away_team_id: away.id,
            match_time: null,
            phase: 'group',
          })
          if ('id' in r) created++
        }
      }
    }
    revalidateFixtures(tournamentId)
    return { created }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
```

- [ ] **Step 3: Add `scheduleMatchAction`**

Append to `web/app/admin/tournaments/[id]/fixtures/actions.ts`:

```typescript
export async function scheduleMatchAction(
  matchId: string,
  tournamentId: string,
  matchTime: string | null,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const existing = await getMatch(matchId)
    if (!existing) return { error: 'Match not found.' }
    if (existing.status !== 'scheduled') {
      return { error: 'Only scheduled matches can be rescheduled.' }
    }
    if (matchTime !== null) {
      const tournament = await getTournament(tournamentId)
      if (!tournament) return { error: 'Tournament not found.' }
      const matchDay = new Date(matchTime).toISOString().split('T')[0]
      if (matchDay < tournament.start_date || matchDay > tournament.end_date) {
        return {
          error: `Match must be within the tournament period (${tournament.start_date} – ${tournament.end_date}).`,
        }
      }
    }
    const result = await updateMatchTime(matchId, matchTime)
    if (result.error) return { error: result.error }
    revalidateFixtures(tournamentId)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
```

- [ ] **Step 4: Verify typecheck**

```bash
cd web && tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/[id]/fixtures/actions.ts
git commit -m "feat: add generateGroupFixturesAction and scheduleMatchAction"
```

---

## Task 4: `GenerateGroupFixturesButton` Client Component

**Files:**
- Create: `web/app/admin/tournaments/[id]/rd-fixtures/GenerateGroupFixturesButton.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Wand2 } from 'lucide-react'
import { generateGroupFixturesAction } from '../fixtures/actions'

interface Props {
  tournamentId: string
}

export function GenerateGroupFixturesButton({ tournamentId }: Props) {
  const [pending, startTransition] = useTransition()

  function handleGenerate() {
    startTransition(async () => {
      const r = await generateGroupFixturesAction(tournamentId)
      if ('error' in r) {
        toast.error(r.error)
      } else {
        toast.success(`${r.created} fixture${r.created === 1 ? '' : 's'} generated.`)
      }
    })
  }

  return (
    <Button onClick={handleGenerate} disabled={pending} size="sm">
      <Wand2 className="h-4 w-4 mr-2" />
      {pending ? 'Generating…' : 'Generate fixtures'}
    </Button>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/[id]/rd-fixtures/GenerateGroupFixturesButton.tsx
git commit -m "feat: add GenerateGroupFixturesButton component"
```

---

## Task 5: `FixtureSchedulerPanel` Client Component

**Files:**
- Create: `web/app/admin/tournaments/[id]/rd-fixtures/FixtureSchedulerPanel.tsx`

This is the largest component. It shows:
- **Unscheduled pool**: all matches with `match_time === null`
- **Day cards**: one per day that has ≥1 scheduled match, sorted by day, matches within sorted earliest first
- **Inline schedule form**: shown on the editing row, has Day select + time input + computed end time + Confirm + Cancel

- [ ] **Step 1: Create the component**

Create `web/app/admin/tournaments/[id]/rd-fixtures/FixtureSchedulerPanel.tsx`:

```typescript
'use client'

import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, Clock, X } from 'lucide-react'
import type { MatchWithTeams } from '@/lib/supabase/types'
import { computeEndTime, getTournamentDays } from '@/lib/fixture-scheduling'
import { scheduleMatchAction } from '../fixtures/actions'

interface Props {
  tournamentId: string
  initialMatches: MatchWithTeams[]
  startDate: string
  endDate: string
  minutesPerHalf: number
  halftimeEnabled: boolean
  halftimeMinutes: number | null
}

function matchLabel(m: MatchWithTeams): string {
  const group = m.home_team.group_label
  const prefix = group ? `Group ${group}: ` : ''
  return `${prefix}${m.home_team.name} vs ${m.away_team.name}`
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function isoDateOf(isoString: string): string {
  return new Date(isoString).toISOString().split('T')[0]
}

export function FixtureSchedulerPanel({
  tournamentId,
  initialMatches,
  startDate,
  endDate,
  minutesPerHalf,
  halftimeEnabled,
  halftimeMinutes,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [matches, setMatches] = useState<MatchWithTeams[]>(initialMatches)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formDay, setFormDay] = useState('')
  const [formTime, setFormTime] = useState('')

  const days = getTournamentDays(startDate, endDate)

  const unscheduled = matches.filter((m) => m.match_time === null)
  const scheduled = matches.filter((m) => m.match_time !== null)

  // Group scheduled matches by date, sorted earliest first within each day
  const dayMap = new Map<string, MatchWithTeams[]>()
  for (const m of scheduled) {
    const date = isoDateOf(m.match_time!)
    if (!dayMap.has(date)) dayMap.set(date, [])
    dayMap.get(date)!.push(m)
  }
  for (const group of dayMap.values()) {
    group.sort((a, b) => a.match_time!.localeCompare(b.match_time!))
  }

  // Only show days that have scheduled matches
  const activeDays = days.filter((d) => dayMap.has(d.date))

  const endTime = formDay && formTime
    ? computeEndTime(formTime, minutesPerHalf, halftimeEnabled, halftimeMinutes)
    : null

  function openForm(matchId: string) {
    setEditingId(matchId)
    setFormDay(days[0]?.date ?? '')
    setFormTime('09:00')
  }

  function closeForm() {
    setEditingId(null)
    setFormDay('')
    setFormTime('')
  }

  function submitSchedule(matchId: string) {
    if (!formDay || !formTime) return
    const matchTime = `${formDay}T${formTime}:00`
    const prev = matches
    setMatches((ms) =>
      ms.map((m) => (m.id === matchId ? { ...m, match_time: matchTime } : m)),
    )
    closeForm()
    startTransition(async () => {
      const r = await scheduleMatchAction(matchId, tournamentId, matchTime)
      if ('error' in r) {
        toast.error(r.error)
        setMatches(prev)
      }
    })
  }

  function unscheduleMatch(matchId: string) {
    const prev = matches
    setMatches((ms) =>
      ms.map((m) => (m.id === matchId ? { ...m, match_time: null } : m)),
    )
    startTransition(async () => {
      const r = await scheduleMatchAction(matchId, tournamentId, null)
      if ('error' in r) {
        toast.error(r.error)
        setMatches(prev)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Unscheduled pool */}
      {unscheduled.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Unscheduled</span>
              <Badge variant="secondary">{unscheduled.length}</Badge>
            </div>
            {unscheduled.map((m) => (
              <div key={m.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{matchLabel(m)}</span>
                  {editingId !== m.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={pending}
                      onClick={() => openForm(m.id)}
                    >
                      <Calendar className="h-3 w-3 mr-1" /> Schedule
                    </Button>
                  )}
                </div>
                {editingId === m.id && (
                  <ScheduleForm
                    days={days}
                    formDay={formDay}
                    formTime={formTime}
                    endTime={endTime}
                    pending={pending}
                    onDayChange={setFormDay}
                    onTimeChange={setFormTime}
                    onConfirm={() => submitSchedule(m.id)}
                    onCancel={closeForm}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Day cards */}
      {activeDays.map((day) => {
        const dayMatches = dayMap.get(day.date) ?? []
        return (
          <Card key={day.date}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{day.label}</span>
                <Badge variant="secondary">{dayMatches.length}</Badge>
              </div>
              {dayMatches.map((m) => (
                <div key={m.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">
                      {matchLabel(m)}{' '}
                      <span className="text-muted-foreground">
                        · {formatTime(m.match_time!)} – {computeEndTime(
                          formatTime(m.match_time!),
                          minutesPerHalf,
                          halftimeEnabled,
                          halftimeMinutes,
                        )}
                      </span>
                    </span>
                    {editingId !== m.id && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={pending}
                          onClick={() => openForm(m.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={pending}
                          onClick={() => unscheduleMatch(m.id)}
                          aria-label={`Unschedule ${m.home_team.name} vs ${m.away_team.name}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {editingId === m.id && (
                    <ScheduleForm
                      days={days}
                      formDay={formDay}
                      formTime={formTime}
                      endTime={endTime}
                      pending={pending}
                      onDayChange={setFormDay}
                      onTimeChange={setFormTime}
                      onConfirm={() => submitSchedule(m.id)}
                      onCancel={closeForm}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}

      {unscheduled.length === 0 && scheduled.length > 0 && (
        <p className="text-xs text-emerald-700 font-medium">All fixtures scheduled.</p>
      )}
    </div>
  )
}

interface ScheduleFormProps {
  days: Array<{ label: string; date: string }>
  formDay: string
  formTime: string
  endTime: string | null
  pending: boolean
  onDayChange: (v: string) => void
  onTimeChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}

function ScheduleForm({
  days,
  formDay,
  formTime,
  endTime,
  pending,
  onDayChange,
  onTimeChange,
  onConfirm,
  onCancel,
}: ScheduleFormProps) {
  return (
    <div className="ml-0 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
      <Select value={formDay} onValueChange={onDayChange} disabled={pending}>
        <SelectTrigger className="w-40 h-7 text-xs">
          <SelectValue placeholder="Day…" />
        </SelectTrigger>
        <SelectContent>
          {days.map((d) => (
            <SelectItem key={d.date} value={d.date}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        type="time"
        value={formTime}
        onChange={(e) => onTimeChange(e.target.value)}
        disabled={pending}
        className="h-7 rounded-md border bg-background px-2 text-xs"
      />
      {endTime && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> ends {endTime}
        </span>
      )}
      <Button size="sm" className="h-7 text-xs" disabled={pending || !formDay || !formTime} onClick={onConfirm}>
        Confirm
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/[id]/rd-fixtures/FixtureSchedulerPanel.tsx
git commit -m "feat: add FixtureSchedulerPanel with unscheduled pool and day cards"
```

---

## Task 6: Wire Up `rd-fixtures/page.tsx`

**Files:**
- Modify: `web/app/admin/tournaments/[id]/rd-fixtures/page.tsx`

The page needs to:
1. Restore `checkTournamentReadiness` to compute `canGenerate`
2. Pass tournament settings (dates, match timing) to `FixtureSchedulerPanel`
3. Show `GenerateGroupFixturesButton` when `canGenerate` is true
4. Show `FixtureSchedulerPanel` when fixtures exist

- [ ] **Step 1: Rewrite `rd-fixtures/page.tsx`**

Replace the entire file content with:

```typescript
import { getTournament } from '@/lib/db/tournaments'
import { listTeams, listPlayerCounts } from '@/lib/db/teams'
import { listMatches } from '@/lib/db/matches'
import { canAddFixture, canManageTeams } from '@/lib/lock-rules'
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { checkTournamentReadiness } from '@/lib/tournament-readiness'
import { FixturesPanel } from '../fixtures/FixturesPanel'
import { GenerateGroupFixturesButton } from './GenerateGroupFixturesButton'
import { FixtureSchedulerPanel } from './FixtureSchedulerPanel'

interface Props {
  params: Promise<{ id: string }>
}

function isGroupStageMatch(m: { home_team: { group_label: string | null }; away_team: { group_label: string | null } }): boolean {
  const h = m.home_team.group_label
  const a = m.away_team.group_label
  return !!h && !!a && h === a
}

export default async function RDFixturesPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null
  const [teams, matches, playerCounts, admin] = await Promise.all([
    listTeams(id),
    listMatches(id),
    listPlayerCounts(id),
    isAdmin(user.id),
  ])

  // For round_robin_knockout, only show group matches
  const displayMatches = tournament.format === 'round_robin_knockout'
    ? matches.filter(isGroupStageMatch)
    : matches

  const canEdit = canAddFixture(tournament.status)
  const anyMatchActive = displayMatches.some((m) => m.status !== 'scheduled')
  const canAssignGroups = canManageTeams(tournament.status) && !anyMatchActive

  // Readiness check — only used to gate the generate button
  const readiness = checkTournamentReadiness(
    teams,
    playerCounts,
    tournament.min_players_per_team,
    tournament.format,
    tournament.num_groups,
    tournament.teams_per_group,
  )
  const canGenerate = canEdit && displayMatches.length === 0 && readiness.canGenerateFixtures

  // For round_robin_knockout, treat as round_robin for MatchViews rendering
  const effectiveFormat = tournament.format === 'round_robin_knockout'
    ? 'round_robin' as const
    : tournament.format

  const showScheduler =
    tournament.format === 'round_robin_knockout' &&
    canEdit &&
    displayMatches.length > 0

  return (
    <div className="space-y-5">
      {tournament.format === 'round_robin_knockout' && canGenerate && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            All groups are ready. Generate the round-robin fixtures for each group.
          </p>
          <GenerateGroupFixturesButton tournamentId={id} />
        </div>
      )}

      {showScheduler && (
        <FixtureSchedulerPanel
          tournamentId={id}
          initialMatches={displayMatches}
          startDate={tournament.start_date}
          endDate={tournament.end_date}
          minutesPerHalf={tournament.minutes_per_half}
          halftimeEnabled={tournament.halftime_enabled}
          halftimeMinutes={tournament.halftime_minutes}
        />
      )}

      <FixturesPanel
        tournamentId={id}
        tournamentStart={tournament.start_date}
        tournamentEnd={tournament.end_date}
        tournamentFormat={effectiveFormat}
        tournamentStatus={tournament.status}
        isAdmin={admin}
        teams={teams.map((t) => ({ id: t.id, name: t.name, group_label: t.group_label }))}
        matches={displayMatches}
        canEdit={canEdit}
        canAssignGroups={canAssignGroups}
        numGroups={tournament.num_groups}
        advancePerGroup={tournament.advance_per_group}
        knockoutQualifiers={tournament.knockout_qualifiers ?? null}
        knockoutSlots={0}
      />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/[id]/rd-fixtures/page.tsx
git commit -m "feat: wire GenerateGroupFixturesButton and FixtureSchedulerPanel into rd-fixtures page"
```

---

## Task 7: Public View Filter + Scorekeeper Guard

**Files:**
- Modify: `web/app/t/[id]/TournamentView.tsx:257-261` (match filtering)
- Modify: `web/app/admin/tournaments/[id]/actions.ts` (go-live guard)

### 7a: Public View

- [ ] **Step 1: Filter null-time matches in TournamentView**

In `web/app/t/[id]/TournamentView.tsx`, find the lines that compute `liveMatches`, `upcomingMatches`, `finishedMatches`, and `filteredFixtures` (around line 257). Add a filter to hide null-time matches before those computations:

```typescript
// Filter out unscheduled (null match_time) matches — they are not yet public
const scheduledMatches = matches.filter((m) => m.match_time !== null)

const liveMatches     = scheduledMatches.filter(m => m.status === 'live')
const upcomingMatches = scheduledMatches.filter(m => m.status === 'scheduled')
const finishedMatches = scheduledMatches.filter(m => m.status === 'finished')

const filteredFixtures = fixtureFilter === 'all' ? scheduledMatches : scheduledMatches.filter(m => m.status === fixtureFilter)
```

Also update the Supabase realtime subscription at line ~229 to apply the same filter after it sets matches:
```typescript
// After the supabase subscription sets matches, existing line:
if (m) setMatches((m as MatchWithTeams[]).filter(x => x.match_time !== null))
```

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit
```
Expected: 0 errors

### 7b: Scorekeeper Guard

- [ ] **Step 3: Add null match_time guard in `transitionMatchAction`**

In `web/app/admin/tournaments/[id]/actions.ts`, in `transitionMatchAction`, add this check right after `ensureOrganizerOfMatch`:

```typescript
export async function transitionMatchAction(
  matchId: string,
  next: MatchStatus,
  asAdmin: boolean,
): Promise<{ ok: true } | { error: string }> {
  try {
    const { user, match, admin } = await ensureOrganizerOfMatch(matchId)
    // Guard: cannot go live without a scheduled time
    if (next === 'live' && !match.match_time) {
      return { error: 'Set a match time before going live.' }
    }
    const role: 'admin' | 'organizer' = admin && asAdmin ? 'admin' : 'organizer'
    // ... rest unchanged
```

- [ ] **Step 4: Typecheck**

```bash
cd web && tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Commit both changes**

```bash
git add web/app/t/[id]/TournamentView.tsx web/app/admin/tournaments/[id]/actions.ts
git commit -m "feat: hide unscheduled matches from public view; block go-live without match time"
```

---

## Task 8: Full Validation Pass

- [ ] **Step 1: Run all tests**

```bash
cd web && pnpm test
```
Expected: all tests pass, including the 8 new `fixture-scheduling` tests

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Lint**

```bash
cd web && pnpm lint
```
Expected: 0 errors

- [ ] **Step 4: Manual smoke test**

Start dev server (`pnpm dev`) and verify:
1. For a `round_robin_knockout` tournament with all groups full → RD-Fixtures shows "Generate fixtures" button
2. Click generate → fixtures appear in the unscheduled pool
3. Click Schedule on a match → inline form appears with Day select + time input + read-only end time
4. Confirm → match moves to the correct day card
5. Edit button on scheduled match → form reopens pre-filled
6. Unschedule (×) button → match returns to unscheduled pool
7. Public view `/t/[id]` → no unscheduled matches visible
8. Trying to go live on a match without a time → error toast

- [ ] **Step 5: Push to main**

```bash
git push
```
