# RD-Groups Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an RD-Groups admin tab for `round_robin_knockout` tournaments where organisers assign teams to groups, with RD-Fixtures unlocking only when every group is exactly full.

**Architecture:** Extend `checkTournamentReadiness` to verify per-group team counts, add a new `/rd-groups` route with a client-side `RDGroupsPanel`, and wire the existing `setTeamGroupAction` to that UI. The nav and layout gain a single new prop to show the attention indicator.

**Tech Stack:** Next.js 15 App Router (server + client components), Vitest, shadcn/ui (`Card`, `Select`, `Badge`), `sonner` toasts, existing `setTeamGroupAction` server action.

---

## File Map

| File | Change |
|---|---|
| `lib/tournament-readiness.ts` | Add `allGroupsFull` field; update `canGenerateFixtures` |
| `web/__tests__/tournament-readiness.test.ts` | New — unit tests for readiness logic |
| `app/admin/tournaments/[id]/rd-groups/page.tsx` | New — server component |
| `app/admin/tournaments/[id]/rd-groups/RDGroupsPanel.tsx` | New — client component |
| `app/admin/tournaments/[id]/TournamentNav.tsx` | Add `RD-Groups` tab + `rdGroupsProgress` prop |
| `app/admin/tournaments/[id]/layout.tsx` | Compute + pass `rdGroupsProgress` |

---

## Task 1: Extend `checkTournamentReadiness` with `allGroupsFull`

**Files:**
- Modify: `web/lib/tournament-readiness.ts`
- Create: `web/__tests__/tournament-readiness.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/__tests__/tournament-readiness.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { checkTournamentReadiness } from '@/lib/tournament-readiness'

const team = (id: string, name: string, group_label: string | null) => ({ id, name, group_label })

describe('checkTournamentReadiness — allGroupsFull', () => {
  it('is true when teams_per_group is null (no size constraint)', () => {
    const teams = [team('1', 'A', 'A'), team('2', 'B', 'A')]
    const counts = { '1': 5, '2': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin_knockout', 1, null)
    expect(r.allGroupsFull).toBe(true)
  })

  it('is true when every group has exactly teamsPerGroup teams', () => {
    const teams = [
      team('1', 'T1', 'A'), team('2', 'T2', 'A'),
      team('3', 'T3', 'B'), team('4', 'T4', 'B'),
    ]
    const counts = { '1': 5, '2': 5, '3': 5, '4': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin_knockout', 2, 2)
    expect(r.allGroupsFull).toBe(true)
    expect(r.canGenerateFixtures).toBe(true)
  })

  it('is false when a group has fewer than teamsPerGroup teams', () => {
    const teams = [
      team('1', 'T1', 'A'), team('2', 'T2', 'A'),
      team('3', 'T3', 'B'),
    ]
    const counts = { '1': 5, '2': 5, '3': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin_knockout', 2, 2)
    expect(r.allGroupsFull).toBe(false)
    expect(r.canGenerateFixtures).toBe(false)
    expect(r.blockingIssues.some(i => i.includes('Group B'))).toBe(true)
  })

  it('is false when a group has more than teamsPerGroup teams', () => {
    const teams = [
      team('1', 'T1', 'A'), team('2', 'T2', 'A'), team('3', 'T3', 'A'),
      team('4', 'T4', 'B'), team('5', 'T5', 'B'),
    ]
    const counts = { '1': 5, '2': 5, '3': 5, '4': 5, '5': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin_knockout', 2, 2)
    expect(r.allGroupsFull).toBe(false)
  })

  it('is true for non-group formats regardless of group_label', () => {
    const teams = [team('1', 'T1', null), team('2', 'T2', null)]
    const counts = { '1': 5, '2': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin', null, null)
    expect(r.allGroupsFull).toBe(true)
  })

  it('blocks canGenerateFixtures when players ready but groups not full', () => {
    const teams = [team('1', 'T1', 'A')]
    const counts = { '1': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin_knockout', 2, 2)
    expect(r.allPlayersReady).toBe(true)
    expect(r.allGroupsFull).toBe(false)
    expect(r.canGenerateFixtures).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && pnpm test -- tournament-readiness
```

Expected: tests fail — `checkTournamentReadiness` doesn't accept a 6th argument and has no `allGroupsFull` field.

- [ ] **Step 3: Update `checkTournamentReadiness`**

Replace the full contents of `web/lib/tournament-readiness.ts`:

```typescript
import type { TournamentFormat, Team } from '@/lib/supabase/types'

export interface TournamentReadiness {
  totalTeams: number
  teamsWithEnoughPlayers: number
  allPlayersReady: boolean
  allGroupsAssigned: boolean
  allGroupsFull: boolean
  canGenerateFixtures: boolean
  blockingIssues: string[]
}

export function checkTournamentReadiness(
  teams: Pick<Team, 'id' | 'name' | 'group_label'>[],
  playerCounts: Record<string, number>,
  minPlayersPerTeam: number,
  format: TournamentFormat,
  numGroups: number | null,
  teamsPerGroup: number | null,
): TournamentReadiness {
  const totalTeams = teams.length
  let teamsWithEnoughPlayers = 0
  const teamsWithoutPlayers: string[] = []

  for (const t of teams) {
    const count = playerCounts[t.id] ?? 0
    if (count >= minPlayersPerTeam) {
      teamsWithEnoughPlayers++
    } else {
      teamsWithoutPlayers.push(t.name)
    }
  }

  const allPlayersReady = teamsWithoutPlayers.length === 0

  const isGroupFormat = format === 'round_robin_knockout'
  let allGroupsAssigned = true
  let allGroupsFull = true
  const unassignedTeams: string[] = []
  const groupIssues: string[] = []

  if (isGroupFormat && numGroups != null) {
    const validLabels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))

    // Check every team has a valid label
    for (const t of teams) {
      if (!t.group_label || !validLabels.includes(t.group_label)) {
        allGroupsAssigned = false
        unassignedTeams.push(t.name)
      }
    }

    // Check per-group counts when teamsPerGroup is set
    if (teamsPerGroup != null) {
      const countByLabel = new Map<string, number>()
      for (const l of validLabels) countByLabel.set(l, 0)
      for (const t of teams) {
        if (t.group_label && validLabels.includes(t.group_label)) {
          countByLabel.set(t.group_label, (countByLabel.get(t.group_label) ?? 0) + 1)
        }
      }
      for (const label of validLabels) {
        const n = countByLabel.get(label) ?? 0
        if (n !== teamsPerGroup) {
          allGroupsFull = false
          groupIssues.push(`Group ${label} has ${n} team${n === 1 ? '' : 's'}, expected ${teamsPerGroup}.`)
        }
      }
    }
  }

  const blockingIssues: string[] = []
  if (!allPlayersReady) {
    const shown = teamsWithoutPlayers.slice(0, 3).join(', ')
    const more = teamsWithoutPlayers.length > 3 ? ` +${teamsWithoutPlayers.length - 3} more` : ''
    blockingIssues.push(
      `${teamsWithoutPlayers.length} team${teamsWithoutPlayers.length === 1 ? '' : 's'} need at least ${minPlayersPerTeam} players: ${shown}${more}.`
    )
  }
  if (!allGroupsAssigned) {
    const shown = unassignedTeams.slice(0, 3).join(', ')
    const more = unassignedTeams.length > 3 ? ` +${unassignedTeams.length - 3} more` : ''
    blockingIssues.push(
      `${unassignedTeams.length} team${unassignedTeams.length === 1 ? '' : 's'} not assigned to a group: ${shown}${more}.`
    )
  }
  blockingIssues.push(...groupIssues)

  return {
    totalTeams,
    teamsWithEnoughPlayers,
    allPlayersReady,
    allGroupsAssigned,
    allGroupsFull,
    canGenerateFixtures: allPlayersReady && allGroupsAssigned && allGroupsFull,
    blockingIssues,
  }
}
```

- [ ] **Step 4: Fix all call sites** — `checkTournamentReadiness` now takes a 6th argument `teamsPerGroup`. Update every call:

`web/app/admin/tournaments/[id]/layout.tsx` line ~45:
```typescript
const readiness = checkTournamentReadiness(
  teams,
  playerCounts,
  tournament.min_players_per_team,
  tournament.format,
  tournament.num_groups,
  tournament.teams_per_group,   // add this
)
```

`web/app/admin/tournaments/[id]/rd-teams/page.tsx` line ~24:
```typescript
const readiness = checkTournamentReadiness(
  teams,
  playerCounts,
  tournament.min_players_per_team,
  tournament.format,
  tournament.num_groups,
  tournament.teams_per_group,   // add this
)
```

`web/app/admin/tournaments/[id]/ko-teams/page.tsx` — grep for the call and add `tournament.teams_per_group` as 6th arg similarly.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd web && pnpm test -- tournament-readiness
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Type-check**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web/lib/tournament-readiness.ts web/__tests__/tournament-readiness.test.ts web/app/admin/tournaments/\[id\]/layout.tsx web/app/admin/tournaments/\[id\]/rd-teams/page.tsx web/app/admin/tournaments/\[id\]/ko-teams/page.tsx
git commit -m "feat: add allGroupsFull check to tournament readiness"
```

---

## Task 2: Create `RDGroupsPanel` client component

**Files:**
- Create: `web/app/admin/tournaments/[id]/rd-groups/RDGroupsPanel.tsx`

- [ ] **Step 1: Create the file**

```typescript
'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { setTeamGroupAction } from '../teams/actions'

interface TeamData {
  id: string
  name: string
  group_label: string | null
}

interface Props {
  tournamentId: string
  initialTeams: TeamData[]
  numGroups: number
  teamsPerGroup: number | null
  canEdit: boolean
}

export function RDGroupsPanel({ tournamentId, initialTeams, numGroups, teamsPerGroup, canEdit }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [teams, setTeams] = useState<TeamData[]>(initialTeams)

  const groupLabels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))

  const unassigned = teams.filter(t => !t.group_label || !groupLabels.includes(t.group_label))
  const byGroup = new Map<string, TeamData[]>()
  for (const l of groupLabels) byGroup.set(l, [])
  for (const t of teams) {
    if (t.group_label && groupLabels.includes(t.group_label)) {
      byGroup.get(t.group_label)!.push(t)
    }
  }

  const groupsFull = teamsPerGroup != null
    ? groupLabels.every(l => (byGroup.get(l)?.length ?? 0) === teamsPerGroup)
    : unassigned.length === 0

  function assign(teamId: string, label: string | null) {
    // Optimistic update
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, group_label: label } : t))
    startTransition(async () => {
      const r = await setTeamGroupAction(teamId, tournamentId, label)
      if ('error' in r) {
        toast.error(r.error)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {groupsFull ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2 text-xs text-emerald-900">
          <CheckCircle2 className="h-3.5 w-3.5" />
          All groups complete — RD-Fixtures is now unlocked.
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2 text-xs text-amber-900">
          <AlertCircle className="h-3.5 w-3.5" />
          {teamsPerGroup != null
            ? `Each group needs exactly ${teamsPerGroup} teams. Assign all teams to unlock RD-Fixtures.`
            : 'Assign all teams to a group to unlock RD-Fixtures.'}
        </div>
      )}

      {/* Unassigned pool */}
      {(unassigned.length > 0 || !canEdit) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Unassigned</span>
              <Badge variant="secondary">{unassigned.length}</Badge>
            </div>
            {unassigned.length === 0 && (
              <p className="text-xs text-muted-foreground">All teams assigned.</p>
            )}
            {unassigned.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">{t.name}</span>
                {canEdit && (
                  <Select
                    value=""
                    onValueChange={label => assign(t.id, label)}
                    disabled={pending}
                  >
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="Assign…" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupLabels.map(l => (
                        <SelectItem key={l} value={l}>Group {l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Group cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groupLabels.map(label => {
          const groupTeams = byGroup.get(label) ?? []
          const full = teamsPerGroup != null && groupTeams.length === teamsPerGroup
          const over = teamsPerGroup != null && groupTeams.length > teamsPerGroup
          return (
            <Card key={label}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Group {label}</span>
                  <Badge
                    variant="secondary"
                    className={
                      over ? 'bg-red-100 text-red-800'
                      : full ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                    }
                  >
                    {teamsPerGroup != null ? `${groupTeams.length}/${teamsPerGroup}` : groupTeams.length}
                  </Badge>
                </div>
                {groupTeams.length === 0 && (
                  <p className="text-xs text-muted-foreground">No teams yet.</p>
                )}
                {groupTeams.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm">{t.name}</span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={pending}
                        onClick={() => assign(t.id, null)}
                        title="Remove from group"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/rd-groups/RDGroupsPanel.tsx
git commit -m "feat: add RDGroupsPanel client component"
```

---

## Task 3: Create `rd-groups/page.tsx` server component

**Files:**
- Create: `web/app/admin/tournaments/[id]/rd-groups/page.tsx`

- [ ] **Step 1: Create the file**

```typescript
import { listTeamsWithPlayers } from '@/lib/db/teams'
import { getTournament } from '@/lib/db/tournaments'
import { listMatches } from '@/lib/db/matches'
import { canManageTeams } from '@/lib/lock-rules'
import { notFound } from 'next/navigation'
import { RDGroupsPanel } from './RDGroupsPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RDGroupsPage({ params }: Props) {
  const { id } = await params
  const tournament = await getTournament(id)
  if (!tournament) notFound()
  if (tournament.format !== 'round_robin_knockout') notFound()
  if (!tournament.num_groups) notFound()

  const [teams, matches] = await Promise.all([listTeamsWithPlayers(id), listMatches(id)])
  const anyMatchActive = matches.some(m => m.status !== 'scheduled')
  const canEdit = canManageTeams(tournament.status) && !anyMatchActive

  return (
    <RDGroupsPanel
      tournamentId={id}
      initialTeams={teams.map(t => ({
        id: t.id,
        name: t.name,
        group_label: t.group_label,
      }))}
      numGroups={tournament.num_groups}
      teamsPerGroup={tournament.teams_per_group}
      canEdit={canEdit}
    />
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/rd-groups/page.tsx
git commit -m "feat: add rd-groups page server component"
```

---

## Task 4: Add RD-Groups tab to `TournamentNav`

**Files:**
- Modify: `web/app/admin/tournaments/[id]/TournamentNav.tsx`

- [ ] **Step 1: Add `rdGroupsProgress` prop and tab**

In `TournamentNav.tsx`, add `rdGroupsProgress` to the `Props` interface and the destructured params, then insert the tab in the `round_robin_knockout` branch:

```typescript
// Add to Props interface:
rdGroupsProgress?: string | null

// Add to destructured params (with default null):
rdGroupsProgress = null,

// In the round_robin_knockout branch, insert between rd-teams and rd-fixtures:
{ href: `${base}/rd-groups`, label: 'RD-Groups', needsAttention: !!rdGroupsProgress },
```

The full `round_robin_knockout` branch becomes:
```typescript
} else {
  // round_robin_knockout
  tabs.push(
    { href: `${base}/rd-teams`, label: 'RD-Teams', needsAttention: !!rdTeamsProgress },
    { href: `${base}/rd-groups`, label: 'RD-Groups', needsAttention: !!rdGroupsProgress },
    { href: `${base}/rd-fixtures`, label: 'RD-Fixtures', locked: rdFixturesLocked, lockReason: rdFixturesLockReason },
    { href: `${base}/ko-teams`, label: 'KO-Teams', needsAttention: !koTeamsLocked && !!koTeamsProgress, locked: koTeamsLocked, lockReason: koTeamsLockReason },
    { href: `${base}/ko-fixtures`, label: 'KO-Fixtures', locked: koFixturesLocked, lockReason: koFixturesLockReason },
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors (layout.tsx doesn't pass the prop yet, but it's optional with a default).

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/TournamentNav.tsx
git commit -m "feat: add RD-Groups tab to tournament nav"
```

---

## Task 5: Wire `rdGroupsProgress` in `layout.tsx`

**Files:**
- Modify: `web/app/admin/tournaments/[id]/layout.tsx`

- [ ] **Step 1: Compute and pass `rdGroupsProgress`**

After the existing `readiness` computation, add:

```typescript
const rdGroupsProgress = (
  tournament.format === 'round_robin_knockout' &&
  (!readiness.allGroupsAssigned || !readiness.allGroupsFull)
)
  ? 'Groups incomplete'
  : null
```

Then add it to the `<TournamentNav>` JSX:

```typescript
rdGroupsProgress={rdGroupsProgress}
```

- [ ] **Step 2: Run full test suite**

```bash
cd web && pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Type-check**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/layout.tsx
git commit -m "feat: wire rdGroupsProgress into tournament layout"
```
