# Tournament Admin UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Knockout sub-stepper tab, redesign Overview as match-day command centre with live card + score entry, and enforce 1-live-match-at-a-time validation.

**Architecture:** Five independent tasks — pure-function logic first (testable), then UI components that consume them, then page wiring. All existing routes stay; only new files are added except for two targeted edits to existing files (`actions.ts` and `page.tsx`).

**Tech Stack:** Next.js 15 App Router, Supabase, Vitest (tests in `web/__tests__/`), server actions in `web/app/admin/tournaments/[id]/actions.ts`, shadcn/ui components, Tailwind, `useTransition` for optimistic updates.

---

## File map

| File | Status | Purpose |
|------|--------|---------|
| `web/lib/qualifiers.ts` | **Create** | Pure functions: compute group standings + qualifier seeds |
| `web/__tests__/qualifiers.test.ts` | **Create** | Vitest unit tests for above |
| `web/app/admin/tournaments/[id]/actions.ts` | **Modify** | Add 1-live-at-a-time guard to `transitionMatchAction` |
| `web/app/admin/tournaments/[id]/knockout/page.tsx` | **Create** | Server component — loads data for Knockout tab |
| `web/app/admin/tournaments/[id]/knockout/KnockoutStepper.tsx` | **Create** | Client sub-stepper: Qualifiers → Bracket |
| `web/app/admin/tournaments/[id]/knockout/QualifiersStep.tsx` | **Create** | Client: standings table + team toggle + save |
| `web/app/admin/tournaments/[id]/MatchDayCard.tsx` | **Create** | Client: live card with +/− score and lifecycle buttons |
| `web/app/admin/tournaments/[id]/page.tsx` | **Modify** | Add MatchDayCard + Up Next above existing MatchViews |

---

## Context you must read before starting

- `web/app/admin/tournaments/[id]/actions.ts` — `transitionMatchAction`, `updateScoreAction` (Task 1, 4)
- `web/app/admin/tournaments/[id]/MatchRow.tsx` — existing lifecycle button pattern to match (Task 4)
- `web/app/admin/tournaments/[id]/groups/GroupsStepper.tsx` — sub-stepper pattern to follow (Task 3)
- `web/app/admin/tournaments/[id]/fixtures/actions.ts` — `saveQualifiersAction`, `seedKnockoutBracketAction` (Task 3)
- `web/app/admin/tournaments/[id]/ko-fixtures/page.tsx` — existing knockout FixturesPanel usage (Task 3)
- `web/lib/supabase/types.ts` — `Match`, `MatchWithTeams`, `MatchStatus`, `TournamentStatus` types

---

## Task 1: 1-live guard in `transitionMatchAction`

**Files:**
- Modify: `web/app/admin/tournaments/[id]/actions.ts:22-50`

This is a surgical addition. When `next === 'live'`, query for other live/halftime matches in the same tournament and reject if any exist.

- [ ] **Step 1: Add the DB check**

Open `web/app/admin/tournaments/[id]/actions.ts`. Add `createClient` import at the top and insert the guard after the existing `match_time` check:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { getMatch, updateMatchScore, updateMatchStatus, updateMatchTime } from '@/lib/db/matches'
import { logMatchRevert } from '@/lib/db/audit'
import { isValidTransition } from '@/lib/match-lifecycle'
import { createClient } from '@/lib/supabase/server'
import type { MatchStatus } from '@/lib/supabase/types'

async function ensureOrganizerOfMatch(matchId: string) {
  const user = await requireUser()
  const match = await getMatch(matchId)
  if (!match) throw new Error('Match not found.')
  const admin = await isAdmin(user.id)
  if (admin) return { user, match, admin: true as const }
  const org = await isOrganizer(user.id, match.tournament_id)
  if (!org) throw new Error('Not authorized.')
  return { user, match, admin: false as const }
}

export async function transitionMatchAction(
  matchId: string,
  next: MatchStatus,
  asAdmin: boolean,
): Promise<{ ok: true } | { error: string }> {
  try {
    const { user, match, admin } = await ensureOrganizerOfMatch(matchId)
    if (next === 'live' && !match.match_time) {
      return { error: 'Set a match time before going live.' }
    }
    // 1-live guard: only one match may be live or at halftime at a time
    if (next === 'live' && match.status === 'scheduled') {
      const supabase = await createClient()
      const { count } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', match.tournament_id)
        .in('status', ['live', 'halftime'])
      if (count && count > 0) {
        return { error: 'Another match is already live. Finish it first.' }
      }
    }
    const role: 'admin' | 'organizer' = admin && asAdmin ? 'admin' : 'organizer'
    if (!isValidTransition(match.status, next, role)) {
      return { error: `Cannot move from ${match.status} to ${next}.` }
    }
    const result = await updateMatchStatus(matchId, next)
    if (result.error) return { error: result.error }

    if (admin && asAdmin && match.status === 'finished' && next === 'live') {
      await logMatchRevert(user.id, matchId, match.tournament_id, 'finished')
    }
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    revalidatePath(`/admin/tournaments/${match.tournament_id}/fixtures`)
    revalidatePath(`/t/${match.tournament_id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/actions.ts
git commit -m "feat: enforce 1-live-match-at-a-time in transitionMatchAction"
```

---

## Task 2: `computeGroupStandings` pure function + tests

**Files:**
- Create: `web/lib/qualifiers.ts`
- Create: `web/__tests__/qualifiers.test.ts`

This pure function drives the QualifiersStep UI (Task 3). Test-first.

- [ ] **Step 1: Write the failing tests**

Create `web/__tests__/qualifiers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeGroupStandings } from '@/lib/qualifiers'

const team = (id: string, name: string, group_label: string) => ({ id, name, group_label })

const match = (
  homeId: string,
  awayId: string,
  hs: number,
  as_: number,
  status = 'finished',
) => ({
  status,
  home_team_id: homeId,
  away_team_id: awayId,
  home_score: hs,
  away_score: as_,
})

describe('computeGroupStandings', () => {
  it('awards 3 pts for a win, 0 for a loss', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 2, 0)]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    const alpha = standings.find(s => s.teamId === 'a')!
    const beta = standings.find(s => s.teamId === 'b')!
    expect(alpha.points).toBe(3)
    expect(beta.points).toBe(0)
  })

  it('awards 1 pt each for a draw', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 1, 1)]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.points).toBe(1)
    expect(standings.find(s => s.teamId === 'b')!.points).toBe(1)
  })

  it('ignores non-finished matches', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 3, 0, 'live')]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.points).toBe(0)
  })

  it('computes goal difference correctly', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 3, 1)]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.gd).toBe(2)
    expect(standings.find(s => s.teamId === 'b')!.gd).toBe(-2)
  })

  it('marks top advancePerGroup teams as qualified per group', () => {
    const teams = [
      team('a', 'Alpha', 'A'), team('b', 'Beta', 'A'), team('c', 'Gamma', 'A'),
    ]
    const matches = [
      match('a', 'b', 3, 0), // a=3pts, b=0pts
      match('a', 'c', 2, 0), // a=6pts, c=0pts
      match('b', 'c', 1, 0), // b=3pts, c=0pts
    ]
    const standings = computeGroupStandings(teams, matches, 1, 2)
    expect(standings.find(s => s.teamId === 'a')!.qualified).toBe(true)
    expect(standings.find(s => s.teamId === 'b')!.qualified).toBe(true)
    expect(standings.find(s => s.teamId === 'c')!.qualified).toBe(false)
  })

  it('breaks ties by goal difference then alphabetical', () => {
    const teams = [
      team('a', 'Alpha', 'A'), // tied on pts, better GD
      team('b', 'Beta', 'A'),  // tied on pts, worse GD
      team('c', 'Gamma', 'A'),
    ]
    const matches = [
      match('a', 'c', 2, 0), // a wins by 2
      match('b', 'c', 1, 0), // b wins by 1
      match('a', 'b', 0, 0), // draw — both 4pts, a GD+2 b GD+0
    ]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.qualified).toBe(true)
    expect(standings.find(s => s.teamId === 'b')!.qualified).toBe(false)
  })

  it('returns qualifiers() helper returning IDs of qualified teams in group order', () => {
    const teams = [
      team('a', 'Alpha', 'A'), team('b', 'Beta', 'A'),
      team('c', 'Gamma', 'B'), team('d', 'Delta', 'B'),
    ]
    const matches = [
      match('a', 'b', 1, 0),
      match('c', 'd', 1, 0),
    ]
    const standings = computeGroupStandings(teams, matches, 2, 1)
    const ids = standings.filter(s => s.qualified).map(s => s.teamId)
    expect(ids).toContain('a')
    expect(ids).toContain('c')
    expect(ids).not.toContain('b')
    expect(ids).not.toContain('d')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd web && pnpm test -- --reporter=verbose __tests__/qualifiers.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/qualifiers'`

- [ ] **Step 3: Implement `computeGroupStandings`**

Create `web/lib/qualifiers.ts`:

```typescript
export interface TeamStanding {
  teamId: string
  teamName: string
  groupLabel: string
  points: number
  gd: number
  qualified: boolean
}

export function computeGroupStandings(
  teams: Array<{ id: string; name: string; group_label: string | null }>,
  matches: Array<{
    status: string
    home_team_id: string
    away_team_id: string
    home_score: number
    away_score: number
  }>,
  numGroups: number,
  advancePerGroup: number,
): TeamStanding[] {
  const labels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))

  const map = new Map<string, { points: number; gd: number; name: string; groupLabel: string }>()
  for (const t of teams) {
    if (t.group_label && labels.includes(t.group_label)) {
      map.set(t.id, { points: 0, gd: 0, name: t.name, groupLabel: t.group_label })
    }
  }

  for (const m of matches) {
    if (m.status !== 'finished') continue
    const home = map.get(m.home_team_id)
    const away = map.get(m.away_team_id)
    if (!home || !away) continue
    const h = m.home_score
    const a = m.away_score
    if (h > a) { home.points += 3 }
    else if (h < a) { away.points += 3 }
    else { home.points += 1; away.points += 1 }
    home.gd += h - a
    away.gd += a - h
  }

  const qualifiedIds = new Set<string>()
  for (const label of labels) {
    const groupEntries = [...map.entries()]
      .filter(([, s]) => s.groupLabel === label)
      .sort(([idA, a], [idB, b]) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.gd !== a.gd) return b.gd - a.gd
        return a.name.localeCompare(b.name)
      })
    groupEntries.slice(0, advancePerGroup).forEach(([id]) => qualifiedIds.add(id))
  }

  return [...map.entries()].map(([teamId, s]) => ({
    teamId,
    teamName: s.name,
    groupLabel: s.groupLabel,
    points: s.points,
    gd: s.gd,
    qualified: qualifiedIds.has(teamId),
  }))
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd web && pnpm test -- --reporter=verbose __tests__/qualifiers.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/qualifiers.ts web/__tests__/qualifiers.test.ts
git commit -m "feat: add computeGroupStandings pure function with tests"
```

---

## Task 3: Knockout tab — server page + stepper + qualifiers step

**Files:**
- Create: `web/app/admin/tournaments/[id]/knockout/page.tsx`
- Create: `web/app/admin/tournaments/[id]/knockout/KnockoutStepper.tsx`
- Create: `web/app/admin/tournaments/[id]/knockout/QualifiersStep.tsx`

Read `web/app/admin/tournaments/[id]/groups/GroupsStepper.tsx` first — `KnockoutStepper` follows the same sub-stepper pattern.

Read `web/app/admin/tournaments/[id]/fixtures/actions.ts` — you will call `saveQualifiersAction` and `seedKnockoutBracketAction` from `QualifiersStep` and `KnockoutStepper` respectively.

Read `web/app/admin/tournaments/[id]/ko-fixtures/page.tsx` — the Bracket step renders the same `FixturesPanel` that page renders.

- [ ] **Step 1: Create the server page**

Create `web/app/admin/tournaments/[id]/knockout/page.tsx`:

```typescript
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { getTournament } from '@/lib/db/tournaments'
import { listTeams } from '@/lib/db/teams'
import { listMatchesAdmin } from '@/lib/db/matches'
import { canAddFixture } from '@/lib/lock-rules'
import { computeGroupStandings } from '@/lib/qualifiers'
import { notFound } from 'next/navigation'
import { KnockoutStepper } from './KnockoutStepper'

interface Props {
  params: Promise<{ id: string }>
}

function isGroupMatch(m: { home_team: { group_label: string | null }; away_team: { group_label: string | null } }) {
  return !!m.home_team.group_label && m.home_team.group_label === m.away_team.group_label
}

export default async function KnockoutPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) notFound()
  if (tournament.format !== 'round_robin_knockout') notFound()

  const [teams, matches, admin] = await Promise.all([
    listTeams(id),
    listMatchesAdmin(id),
    isAdmin(user.id),
  ])

  const groupMatches = matches.filter(isGroupMatch)
  const knockoutMatches = matches.filter((m) => !isGroupMatch(m) && m.phase === 'knockout')

  const standings = tournament.num_groups && tournament.advance_per_group
    ? computeGroupStandings(
        teams,
        groupMatches,
        tournament.num_groups,
        tournament.advance_per_group,
      )
    : []

  const canEdit = canAddFixture(tournament.status)
  const knockoutSlots =
    tournament.num_groups != null && tournament.advance_per_group != null
      ? tournament.num_groups * tournament.advance_per_group
      : 0

  return (
    <KnockoutStepper
      tournamentId={id}
      standings={standings}
      savedQualifiers={tournament.knockout_qualifiers ?? null}
      advancePerGroup={tournament.advance_per_group ?? 1}
      numGroups={tournament.num_groups ?? 1}
      knockoutMatches={knockoutMatches}
      teams={teams.map((t) => ({ id: t.id, name: t.name, group_label: t.group_label }))}
      tournamentStart={tournament.start_date}
      tournamentEnd={tournament.end_date}
      tournamentStatus={tournament.status}
      isAdmin={admin}
      canEdit={canEdit}
      knockoutSlots={knockoutSlots}
      advancePerGroupForPanel={tournament.advance_per_group}
      knockoutQualifiers={tournament.knockout_qualifiers ?? null}
      numGroupsForPanel={tournament.num_groups}
    />
  )
}
```

- [ ] **Step 2: Create `QualifiersStep`**

Create `web/app/admin/tournaments/[id]/knockout/QualifiersStep.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'
import { saveQualifiersAction } from '../fixtures/actions'
import type { TeamStanding } from '@/lib/qualifiers'

interface Props {
  tournamentId: string
  standings: TeamStanding[]
  savedQualifiers: string[] | null
  advancePerGroup: number
  numGroups: number
  onSaved: () => void
}

export function QualifiersStep({
  tournamentId,
  standings,
  savedQualifiers,
  advancePerGroup,
  numGroups,
  onSaved,
}: Props) {
  const [pending, startTransition] = useTransition()
  const computedIds = standings.filter((s) => s.qualified).map((s) => s.teamId)
  const [selected, setSelected] = useState<string[]>(savedQualifiers ?? computedIds)

  const labels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))
  const totalSlots = numGroups * advancePerGroup

  function toggle(teamId: string) {
    setSelected((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    )
  }

  function save() {
    startTransition(async () => {
      const r = await saveQualifiersAction(tournamentId, selected)
      if ('error' in r) {
        toast.error(r.error)
      } else {
        toast.success('Qualifiers saved.')
        onSaved()
      }
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select {totalSlots} teams advancing to knockout.{' '}
        <span className="font-medium text-foreground">{selected.length} / {totalSlots} selected.</span>
      </p>

      {labels.map((label) => {
        const group = standings
          .filter((s) => s.groupLabel === label)
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points
            if (b.gd !== a.gd) return b.gd - a.gd
            return a.teamName.localeCompare(b.teamName)
          })
        return (
          <div key={label}>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Group {label} · top {advancePerGroup}
            </p>
            <div className="space-y-1">
              {group.map((s) => {
                const isSelected = selected.includes(s.teamId)
                return (
                  <button
                    key={s.teamId}
                    onClick={() => toggle(s.teamId)}
                    disabled={pending}
                    className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors"
                    style={{
                      background: isSelected
                        ? 'color-mix(in srgb, var(--admin-lime) 10%, transparent)'
                        : 'transparent',
                      borderColor: isSelected
                        ? 'color-mix(in srgb, var(--admin-lime) 40%, transparent)'
                        : 'var(--border)',
                    }}
                  >
                    <span className="font-medium">{s.teamName}</span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{s.points} pts</span>
                      <span>GD {s.gd >= 0 ? '+' : ''}{s.gd}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <Button
        onClick={save}
        disabled={pending || selected.length !== totalSlots}
        className="w-full"
        size="sm"
      >
        {selected.length !== totalSlots
          ? `Select ${totalSlots - selected.length} more team${totalSlots - selected.length === 1 ? '' : 's'}`
          : 'Save qualifiers →'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Create `KnockoutStepper`**

Create `web/app/admin/tournaments/[id]/knockout/KnockoutStepper.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QualifiersStep } from './QualifiersStep'
import { FixturesPanel } from '../fixtures/FixturesPanel'
import { seedKnockoutBracketAction } from '../fixtures/actions'
import type { MatchWithTeams, TournamentStatus } from '@/lib/supabase/types'
import type { TeamStanding } from '@/lib/qualifiers'

type Step = 'qualifiers' | 'bracket'

interface Props {
  tournamentId: string
  standings: TeamStanding[]
  savedQualifiers: string[] | null
  advancePerGroup: number
  numGroups: number
  knockoutMatches: MatchWithTeams[]
  teams: Array<{ id: string; name: string; group_label: string | null }>
  tournamentStart: string
  tournamentEnd: string
  tournamentStatus: TournamentStatus
  isAdmin: boolean
  canEdit: boolean
  knockoutSlots: number
  advancePerGroupForPanel: number | null
  knockoutQualifiers: string[] | null
  numGroupsForPanel: number | null
}

type StepStatus = 'done' | 'current' | 'upcoming' | 'locked'

export function KnockoutStepper({
  tournamentId,
  standings,
  savedQualifiers,
  advancePerGroup,
  numGroups,
  knockoutMatches,
  teams,
  tournamentStart,
  tournamentEnd,
  tournamentStatus,
  isAdmin,
  canEdit,
  knockoutSlots,
  advancePerGroupForPanel,
  knockoutQualifiers,
  numGroupsForPanel,
}: Props) {
  const [pending, startTransition] = useTransition()
  const qualifiersDone = (savedQualifiers?.length ?? 0) > 0
  const bracketExists = knockoutMatches.length > 0

  const initialStep: Step = qualifiersDone ? 'bracket' : 'qualifiers'
  const [activeStep, setActiveStep] = useState<Step>(initialStep)

  const steps: Array<{ id: Step; label: string; status: StepStatus; lockReason?: string }> = [
    {
      id: 'qualifiers',
      label: 'Qualifiers',
      status: qualifiersDone
        ? 'done'
        : activeStep === 'qualifiers'
        ? 'current'
        : 'upcoming',
    },
    {
      id: 'bracket',
      label: 'Bracket',
      status: !qualifiersDone
        ? 'locked'
        : bracketExists
        ? 'done'
        : activeStep === 'bracket'
        ? 'current'
        : 'upcoming',
      lockReason: !qualifiersDone ? 'Save qualifiers first.' : undefined,
    },
  ]

  function seedBracket() {
    startTransition(async () => {
      const r = await seedKnockoutBracketAction(tournamentId)
      if ('error' in r) toast.error(r.error)
      else toast.success(`${r.seeded} knockout matches created.`)
    })
  }

  return (
    <div className="space-y-4">
      {/* Sub-stepper header */}
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const canNav = step.status !== 'locked'
          return (
            <div key={step.id} className="flex items-center gap-1">
              <button
                onClick={() => canNav && setActiveStep(step.id)}
                disabled={!canNav}
                title={step.lockReason}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  color: step.status === 'locked' ? 'var(--muted-foreground)' : activeStep === step.id ? 'var(--admin-lime)' : 'var(--muted-foreground)',
                  background: activeStep === step.id ? 'color-mix(in srgb, var(--admin-lime) 10%, transparent)' : 'transparent',
                  opacity: step.status === 'locked' ? 0.5 : 1,
                  cursor: canNav ? 'pointer' : 'not-allowed',
                }}
              >
                {step.status === 'done' ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : step.status === 'locked' ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <span
                    className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{
                      background: activeStep === step.id ? 'var(--admin-lime)' : 'var(--muted-foreground)',
                      color: activeStep === step.id ? 'black' : 'var(--background)',
                    }}
                  >
                    {i + 1}
                  </span>
                )}
                {step.label}
              </button>
              {i < steps.length - 1 && (
                <span className="text-xs text-muted-foreground/40">──</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      {activeStep === 'qualifiers' && (
        <QualifiersStep
          tournamentId={tournamentId}
          standings={standings}
          savedQualifiers={savedQualifiers}
          advancePerGroup={advancePerGroup}
          numGroups={numGroups}
          onSaved={() => setActiveStep('bracket')}
        />
      )}

      {activeStep === 'bracket' && (
        <div className="space-y-4">
          {!bracketExists && canEdit && (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {knockoutSlots} qualifiers saved. Seed the bracket to generate first-round matches.
              </p>
              <Button size="sm" disabled={pending} onClick={seedBracket}>
                Seed bracket
              </Button>
            </div>
          )}
          <FixturesPanel
            tournamentId={tournamentId}
            tournamentStart={tournamentStart}
            tournamentEnd={tournamentEnd}
            tournamentFormat="knockout"
            tournamentStatus={tournamentStatus}
            isAdmin={isAdmin}
            teams={teams}
            matches={knockoutMatches}
            canEdit={canEdit}
            canAssignGroups={false}
            numGroups={numGroupsForPanel}
            advancePerGroup={advancePerGroupForPanel}
            knockoutQualifiers={knockoutQualifiers}
            knockoutSlots={knockoutSlots}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/knockout/
git commit -m "feat: add Knockout tab with Qualifiers→Bracket sub-stepper"
```

---

## Task 4: `MatchDayCard` component

**Files:**
- Create: `web/app/admin/tournaments/[id]/MatchDayCard.tsx`

Read `web/app/admin/tournaments/[id]/MatchRow.tsx` first — the confirmation dialog pattern and `transitionMatchAction` call style to follow exactly. The card is a visually prominent version of MatchRow's lifecycle controls plus new +/− score buttons.

- [ ] **Step 1: Create the component**

Create `web/app/admin/tournaments/[id]/MatchDayCard.tsx`:

```typescript
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

  async function commit(action: LifecycleAction) {
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
        {/* Home team */}
        <div>
          <p className="mb-2 truncate font-semibold">{match.home_team.name}</p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-base"
              disabled={busy}
              onClick={() => adjustScore('home', -1)}
            >
              −
            </Button>
            <span className="admin-mono min-w-[2ch] text-center text-3xl font-bold tabular-nums">
              {scores.home}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-base"
              disabled={busy}
              onClick={() => adjustScore('home', 1)}
            >
              +
            </Button>
          </div>
        </div>

        <span className="text-sm text-muted-foreground">vs</span>

        {/* Away team */}
        <div>
          <p className="mb-2 truncate font-semibold">{match.away_team.name}</p>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-base"
              disabled={busy}
              onClick={() => adjustScore('away', -1)}
            >
              −
            </Button>
            <span className="admin-mono min-w-[2ch] text-center text-3xl font-bold tabular-nums">
              {scores.away}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-base"
              disabled={busy}
              onClick={() => adjustScore('away', 1)}
            >
              +
            </Button>
          </div>
        </div>
      </div>

      {/* Lifecycle buttons */}
      {actions.length > 0 && (
        <div className="mt-4 flex gap-2">
          {actions.map((action) => (
            <Button
              key={action.next}
              variant="outline"
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
```

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/MatchDayCard.tsx
git commit -m "feat: add MatchDayCard with inline score entry and lifecycle buttons"
```

---

## Task 5: Wire Overview page — live card + Up Next

**Files:**
- Modify: `web/app/admin/tournaments/[id]/page.tsx`

Read the current `page.tsx` first. You are adding two sections between the stats grid and the existing `<MatchViews>` component:
1. `<MatchDayCard>` — only rendered when a match is `live` or `halftime`
2. "Up next" row — the next scheduled match with a Kickoff button (disabled when any match is live)

The Kickoff button on the "Up next" row uses `transitionMatchAction` inline — import and use `useTransition` by extracting a small `UpNextRow` client component.

- [ ] **Step 1: Create `UpNextRow` client component inline in the same file (or as a separate file)**

Add this as a new file `web/app/admin/tournaments/[id]/UpNextRow.tsx`:

```typescript
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Play, Loader2 } from 'lucide-react'
import { transitionMatchAction } from './actions'
import type { MatchWithTeams } from '@/lib/supabase/types'

interface Props {
  match: MatchWithTeams
  isAdmin: boolean
  hasLiveMatch: boolean
}

export function UpNextRow({ match, isAdmin, hasLiveMatch }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function kickoff() {
    startTransition(async () => {
      const r = await transitionMatchAction(match.id, 'live', isAdmin)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Kickoff started.')
        router.refresh()
      }
    })
  }

  const time = match.match_time
    ? new Date(match.match_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null

  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div>
        <p className="font-semibold text-sm">
          {match.home_team.name} vs {match.away_team.name}
        </p>
        {time && <p className="text-xs text-muted-foreground mt-0.5">{time}</p>}
      </div>
      <Button
        size="sm"
        disabled={pending || hasLiveMatch}
        onClick={kickoff}
        title={hasLiveMatch ? 'Finish the current match first' : undefined}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Kickoff
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Update `page.tsx`**

Open `web/app/admin/tournaments/[id]/page.tsx`. Replace the full file with:

```typescript
import { listMatches } from '@/lib/db/matches'
import { listTeams } from '@/lib/db/teams'
import { getTournament } from '@/lib/db/tournaments'
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { canAddFixture } from '@/lib/lock-rules'
import { MatchViews } from '@/components/admin/MatchViews'
import { MatchDayCard } from './MatchDayCard'
import { UpNextRow } from './UpNextRow'

interface Props {
  params: Promise<{ id: string }>
}

export default async function OverviewPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null
  const admin = await isAdmin(user.id)

  const [matches, teams] = await Promise.all([listMatches(id), listTeams(id)])

  const played = matches.filter((m) => m.status === 'finished').length
  const liveMatch = matches.find((m) => m.status === 'live' || m.status === 'halftime') ?? null
  const hasLiveMatch = liveMatch !== null
  const remaining = matches.length - played
  const canManageFixtures = canAddFixture(tournament.status)

  const upNext = matches
    .filter((m) => m.status === 'scheduled' && m.match_time !== null)
    .sort((a, b) => a.match_time!.localeCompare(b.match_time!))
    .at(0) ?? null

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Teams" value={teams.length} />
        <StatTile label="Matches" value={matches.length} />
        <StatTile label="Played" value={played} />
        <StatTile label="Live now" value={hasLiveMatch ? 1 : 0} live={hasLiveMatch} />
      </div>

      {liveMatch && (
        <MatchDayCard
          match={liveMatch}
          isAdmin={admin}
          halftimeEnabled={tournament.halftime_enabled}
        />
      )}

      {upNext && canManageFixtures && (
        <div>
          <p className="admin-eyebrow mb-2">{hasLiveMatch ? 'Up next' : 'Next up'}</p>
          <UpNextRow match={upNext} isAdmin={admin} hasLiveMatch={hasLiveMatch} />
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="admin-eyebrow">Matches</p>
          <span className="admin-mono text-[11px] text-muted-foreground">
            {matches.length} total · {remaining} remaining
          </span>
        </div>
        <MatchViews
          tournamentId={id}
          tournamentFormat={tournament.format}
          tournamentStatus={tournament.status}
          isAdmin={admin}
          canManageFixtures={canManageFixtures}
          numGroups={tournament.num_groups}
          advancePerGroup={tournament.advance_per_group}
          teams={teams.map((t) => ({ id: t.id, name: t.name, group_label: t.group_label }))}
          matches={matches}
          tournamentStart={tournament.start_date}
          tournamentEnd={tournament.end_date}
        />
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  live,
}: {
  label: string
  value: number
  live?: boolean
}) {
  return (
    <div
      className="rounded-xl border bg-card p-4"
      style={{ borderColor: live ? '#DC2626' : 'var(--admin-rule)', background: live ? 'color-mix(in srgb, #DC2626 8%, transparent)' : undefined }}
    >
      <div className="admin-eyebrow">{label}</div>
      <div
        className="admin-display admin-mono mt-2 flex items-center gap-2.5"
        style={{
          fontSize: 36,
          lineHeight: 1,
          color: live ? '#DC2626' : 'var(--foreground)',
        }}
      >
        {value}
        {live ? (
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-[#DC2626]"
            style={{ boxShadow: '0 0 0 4px rgba(220,38,38,0.18)' }}
          />
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run full test suite**

```bash
cd web && pnpm test
```

Expected: all existing tests pass + new qualifiers tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/page.tsx web/app/admin/tournaments/\[id\]/UpNextRow.tsx
git commit -m "feat: add match-day live card and up-next row to Overview tab"
```
