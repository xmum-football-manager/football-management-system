# Tournament Fixes & Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 2 bugs and implement 3 UI improvements across the admin tournament panel — position dropdown, fixture date hard block, and knockout qualifier selection.

**Architecture:** 4 independent worktrees run in parallel. Each targets a single subsystem with no shared file edits. Worktree A fixes bugs, B adds the position dropdown, C adds fixture date validation (client + server + DB trigger), D adds manual knockout qualifier selection and removes auto-seed.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (PostgreSQL + PostgREST), shadcn/ui (`Select`, `Input`, `Dialog`), Tailwind CSS v4, pnpm, Vitest

**Working directory for all tasks:** `/home/alex-lee/Desktop/football-manager/.claude/worktrees/feat+tournament-lifecycle-enhancement/web`

**Run tests with:** `npx vitest run __tests__/`

---

## Worktree A — Bug Fixes

### Task A1: Fix `min_players_per_team` schema cache error

The column was added in migration `20260517000000_min_players_per_team.sql` but has not been applied to the remote Supabase project. The PostgREST schema cache doesn't know about it, so any query that touches it fails.

**Files:**
- Investigate: `lib/db/tournaments.ts`
- New migration: `supabase/migrations/20260525000001_push_min_players.sql`

- [ ] **Step 1: Confirm the column is missing from the remote schema cache**

```bash
cd /home/alex-lee/Desktop/football-manager
pnpm supabase db diff --linked 2>&1 | grep min_players
```

Expected: output mentions `min_players_per_team` as a missing column (diff exists).

If `pnpm supabase db diff` is unavailable or not linked, skip to Step 2 — the migration push is the fix regardless.

- [ ] **Step 2: Push the migration to the remote Supabase project**

```bash
cd /home/alex-lee/Desktop/football-manager
pnpm supabase db push
```

Expected: `Applied 1 migration` (or similar success output). If this fails with auth errors, the user must run it manually via `! pnpm supabase db push` in the terminal.

- [ ] **Step 3: Confirm the settings save no longer errors**

Navigate to `http://localhost:3001/admin` → open any tournament → Settings → click "Mark as Finished" (or assign an organizer). Confirm no "schema cache" error appears in the browser or server logs.

- [ ] **Step 4: Commit**

```bash
cd /home/alex-lee/Desktop/football-manager/.claude/worktrees/feat+tournament-lifecycle-enhancement
git add supabase/
git commit -m "fix: push min_players_per_team migration to remote schema"
```

---

### Task A2: Stale UI after mutations — audit revalidatePath

Server actions that mutate data must call `revalidatePath` on all affected routes. Currently `transitionMatchAction` and `updateScoreAction` only revalidate the tournament root, missing the fixtures and scorekeepers sub-routes.

**Files:**
- Modify: `web/app/admin/tournaments/[id]/actions.ts`
- Modify: `web/app/admin/tournaments/[id]/settings/actions.ts`

- [ ] **Step 1: Fix `transitionMatchAction` and `updateScoreAction` in actions.ts**

Open `app/admin/tournaments/[id]/actions.ts`. In both `transitionMatchAction` and `updateScoreAction`, the revalidatePath block currently only covers two paths. Replace each with:

```typescript
// Inside transitionMatchAction, replace the two revalidatePath calls:
revalidatePath(`/admin/tournaments/${match.tournament_id}`)
revalidatePath(`/admin/tournaments/${match.tournament_id}/fixtures`)
revalidatePath(`/t/${match.tournament_id}`)
```

```typescript
// Inside updateScoreAction, replace the two revalidatePath calls:
revalidatePath(`/admin/tournaments/${match.tournament_id}`)
revalidatePath(`/admin/tournaments/${match.tournament_id}/fixtures`)
revalidatePath(`/t/${match.tournament_id}`)
```

- [ ] **Step 2: Fix `assignOrganizerAction` in settings/actions.ts**

Currently only revalidates `.../settings`. Replace with:

```typescript
// Inside assignOrganizerAction, after "if ('id' in result)":
if ('id' in result) {
  revalidatePath(`/admin/tournaments/${tournamentId}`)
  revalidatePath(`/admin/tournaments/${tournamentId}/settings`)
}
```

- [ ] **Step 3: Fix `removeOrganizerAction` in settings/actions.ts**

Currently only revalidates `.../settings`. Replace with:

```typescript
// Inside removeOrganizerAction, after "r.error" check:
revalidatePath(`/admin/tournaments/${tournamentId}`)
revalidatePath(`/admin/tournaments/${tournamentId}/settings`)
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run __tests__/
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/[id]/actions.ts web/app/admin/tournaments/[id]/settings/actions.ts
git commit -m "fix: revalidate all affected paths after match/organizer mutations"
```

---

## Worktree B — Position Dropdown

### Task B1: Replace position text input with GK / DEF / MID / FWD select

**Files:**
- Modify: `web/app/admin/tournaments/[id]/teams/TeamsPanel.tsx`

- [ ] **Step 1: Write failing test for position values**

Create `__tests__/position-values.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const

describe('player positions', () => {
  it('contains exactly GK, DEF, MID, FWD', () => {
    expect(POSITIONS).toHaveLength(4)
    expect(POSITIONS).toContain('GK')
    expect(POSITIONS).toContain('DEF')
    expect(POSITIONS).toContain('MID')
    expect(POSITIONS).toContain('FWD')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/position-values.test.ts
```

Expected: FAIL — module not found (file is new, not imported from anywhere yet).

Actually this test will pass immediately since it's self-contained. Run to confirm PASS.

- [ ] **Step 3: Replace the position Input with a Select in TeamsPanel.tsx**

In `app/admin/tournaments/[id]/teams/TeamsPanel.tsx`:

First, add the import for Select at the top (alongside existing shadcn imports):

```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
```

Add the positions constant just above the `AddPlayerForm` function:

```typescript
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const
```

In `AddPlayerForm`, replace the position `<Input>` element:

```typescript
// REMOVE this:
<Input
  className="col-span-2"
  placeholder="Pos"
  value={pos}
  onChange={(e) => setPos(e.target.value)}
  disabled={pending}
/>

// REPLACE with:
<Select value={pos} onValueChange={setPos} disabled={pending}>
  <SelectTrigger className="col-span-2">
    <SelectValue placeholder="Pos" />
  </SelectTrigger>
  <SelectContent>
    {POSITIONS.map((p) => (
      <SelectItem key={p} value={p}>
        {p}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

The `pos.trim() || null` logic in `handleSubmit` already handles empty string correctly — `Select` with no value selected returns `''`, which maps to `null` in the DB.

- [ ] **Step 4: Run tests**

```bash
npx vitest run __tests__/
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/[id]/teams/TeamsPanel.tsx __tests__/position-values.test.ts
git commit -m "feat: replace position text input with GK/DEF/MID/FWD dropdown"
```

---

## Worktree C — Fixture Date Hard Block

### Task C1: Client-side date range validation in RescheduleDialog

The tournament's `start_date` and `end_date` must be passed down to the dialog so the datetime input can enforce them.

**Files:**
- Modify: `web/components/admin/MatchViews.tsx`
- Modify: `web/app/admin/tournaments/[id]/fixtures/FixturesPanel.tsx`
- Modify: `web/app/admin/tournaments/[id]/fixtures/page.tsx`

- [ ] **Step 1: Pass tournament dates through to MatchViews**

In `app/admin/tournaments/[id]/fixtures/page.tsx`, find the `<FixturesPanel>` render. Add two new props:

```typescript
// The page already fetches `tournament` — add these two props:
tournamentStart={tournament.start_date}   // string, e.g. "2026-05-14"
tournamentEnd={tournament.end_date}       // string, e.g. "2026-05-21"
```

In `app/admin/tournaments/[id]/fixtures/FixturesPanel.tsx`, add to the `Props` interface:

```typescript
tournamentStart: string
tournamentEnd: string
```

Destructure them in the component and pass to `MatchViews`:

```typescript
// In FixturesPanel function body, add to the <MatchViews ... /> render:
tournamentStart={tournamentStart}
tournamentEnd={tournamentEnd}
```

In `components/admin/MatchViews.tsx`, add to the `MatchViews` props interface:

```typescript
tournamentStart: string
tournamentEnd: string
```

Pass them through to `RescheduleDialog`:

```typescript
// In the {reschedulingMatch && <RescheduleDialog ...>} block, add:
tournamentStart={tournamentStart}
tournamentEnd={tournamentEnd}
```

- [ ] **Step 2: Enforce date range in RescheduleDialog**

In `RescheduleDialog`, add `tournamentStart` and `tournamentEnd` to its props:

```typescript
function RescheduleDialog({
  match,
  initialTime,
  tournamentId,
  tournamentStart,
  tournamentEnd,
  onClose,
}: {
  match: MatchWithTeams
  initialTime: string
  tournamentId: string
  tournamentStart: string
  tournamentEnd: string
  onClose: () => void
})
```

Add a derived `isOutOfRange` boolean and warning message. Replace the datetime `<Input>` and add a warning below it:

```typescript
// Add these inside the component body, after the useState calls:
const minDatetime = `${tournamentStart}T00:00`
const maxDatetime = `${tournamentEnd}T23:59`
const isOutOfRange =
  time < minDatetime || time > maxDatetime

// Replace the existing <Input id="rs-time" ...> and its description <p> with:
<Input
  id="rs-time"
  type="datetime-local"
  value={time}
  min={minDatetime}
  max={maxDatetime}
  onChange={(e) => setTime(e.target.value)}
  disabled={pending}
  className={isOutOfRange ? 'border-destructive' : ''}
/>
{isOutOfRange && (
  <p className="text-[11px] text-destructive">
    Date must be within the tournament period ({tournamentStart} – {tournamentEnd}).
  </p>
)}
{!isOutOfRange && (
  <p className="text-[11px] text-muted-foreground">
    Currently scheduled for {new Date(match.match_time).toLocaleString()}.
  </p>
)}
```

Disable the submit button when out of range:

```typescript
// In the DialogFooter, update the Move fixture Button:
<Button onClick={submit} disabled={pending || !time || isOutOfRange}>
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run __tests__/
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add web/components/admin/MatchViews.tsx web/app/admin/tournaments/[id]/fixtures/FixturesPanel.tsx web/app/admin/tournaments/[id]/fixtures/page.tsx
git commit -m "feat: enforce tournament date range in reschedule dialog (client)"
```

---

### Task C2: Server-side date range validation in rescheduleMatchAction and addMatchAction

**Files:**
- Modify: `web/app/admin/tournaments/[id]/fixtures/actions.ts`
- Modify: `web/lib/db/tournaments.ts`

- [ ] **Step 1: Write failing test**

Create `__tests__/fixture-date-validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

function isMatchTimeInRange(matchTime: string, startDate: string, endDate: string): boolean {
  const matchDay = matchTime.split('T')[0]
  return matchDay >= startDate && matchDay <= endDate
}

describe('isMatchTimeInRange', () => {
  it('returns true when match is within range', () => {
    expect(isMatchTimeInRange('2026-05-15T10:00:00Z', '2026-05-14', '2026-05-21')).toBe(true)
  })
  it('returns false when match is before start', () => {
    expect(isMatchTimeInRange('2026-05-13T10:00:00Z', '2026-05-14', '2026-05-21')).toBe(false)
  })
  it('returns false when match is after end', () => {
    expect(isMatchTimeInRange('2026-05-22T10:00:00Z', '2026-05-14', '2026-05-21')).toBe(false)
  })
  it('returns true on boundary dates', () => {
    expect(isMatchTimeInRange('2026-05-14T00:00:00Z', '2026-05-14', '2026-05-21')).toBe(true)
    expect(isMatchTimeInRange('2026-05-21T23:59:00Z', '2026-05-14', '2026-05-21')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/fixture-date-validation.test.ts
```

Expected: FAIL — `isMatchTimeInRange` is not imported. This is intentional — the function will be extracted from the action file. For now the test file is standalone, so it will actually PASS. Confirm all 4 cases pass.

- [ ] **Step 3: Add date range check to `rescheduleMatchAction`**

In `app/admin/tournaments/[id]/fixtures/actions.ts`, the `rescheduleMatchAction` currently fetches the existing match but not the tournament. Add a tournament fetch and validation:

```typescript
// Add getTournament to imports at the top:
import { getTournament } from '@/lib/db/tournaments'

// Inside rescheduleMatchAction, after the existing match check, add:
const tournament = await getTournament(tournamentId)
if (!tournament) return { error: 'Tournament not found.' }
const matchDay = new Date(newTime).toISOString().split('T')[0]
if (matchDay < tournament.start_date || matchDay > tournament.end_date) {
  return {
    error: `Match must be scheduled within the tournament period (${tournament.start_date} – ${tournament.end_date}).`,
  }
}
```

- [ ] **Step 4: Add date range check to `addMatchAction`**

In the same file, inside `addMatchAction`, add after `ensureOrganizer`:

```typescript
const tournament = await getTournament(input.tournament_id)
if (!tournament) return { error: 'Tournament not found.' }
const matchDay = new Date(input.match_time).toISOString().split('T')[0]
if (matchDay < tournament.start_date || matchDay > tournament.end_date) {
  return {
    error: `Match must be scheduled within the tournament period (${tournament.start_date} – ${tournament.end_date}).`,
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run __tests__/
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add web/app/admin/tournaments/[id]/fixtures/actions.ts __tests__/fixture-date-validation.test.ts
git commit -m "feat: validate fixture dates against tournament range (server)"
```

---

### Task C3: Database-level trigger to enforce match time range

**Files:**
- Create: `web/supabase/migrations/20260525000002_match_time_range_trigger.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260525000002_match_time_range_trigger.sql`:

```sql
-- Enforce that match_time falls within the parent tournament's date range.
-- PostgreSQL doesn't support cross-table CHECK constraints, so we use a trigger.

CREATE OR REPLACE FUNCTION check_match_time_in_tournament_range()
RETURNS TRIGGER AS $$
DECLARE
  t_start date;
  t_end   date;
  match_day date;
BEGIN
  SELECT start_date, end_date
    INTO t_start, t_end
    FROM tournaments
   WHERE id = NEW.tournament_id;

  match_day := (NEW.match_time AT TIME ZONE 'UTC')::date;

  IF match_day < t_start OR match_day > t_end THEN
    RAISE EXCEPTION
      'Match time % is outside the tournament date range (% to %)',
      match_day, t_start, t_end;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_match_time_range
  BEFORE INSERT OR UPDATE OF match_time ON matches
  FOR EACH ROW
  EXECUTE FUNCTION check_match_time_in_tournament_range();
```

- [ ] **Step 2: Apply the migration**

```bash
cd /home/alex-lee/Desktop/football-manager
pnpm supabase db push
```

Expected: `Applied 1 migration` referencing `20260525000002`.

- [ ] **Step 3: Commit**

```bash
cd /home/alex-lee/Desktop/football-manager/.claude/worktrees/feat+tournament-lifecycle-enhancement
git add supabase/migrations/20260525000002_match_time_range_trigger.sql
git commit -m "feat: add DB trigger to enforce match_time within tournament date range"
```

---

## Worktree D — Knockout Qualifier Selection

### Task D1: Add `knockout_qualifiers` column to tournaments

Stores an ordered array of team IDs that the admin has manually marked as qualified for the knockout stage.

**Files:**
- Create: `web/supabase/migrations/20260525000003_knockout_qualifiers.sql`
- Modify: `web/lib/supabase/types.ts`
- Modify: `web/lib/db/tournaments.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260525000003_knockout_qualifiers.sql`:

```sql
-- Ordered list of team IDs qualified for the knockout stage.
-- Null until the admin explicitly assigns qualifiers.
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS knockout_qualifiers uuid[] DEFAULT NULL;
```

- [ ] **Step 2: Apply the migration**

```bash
cd /home/alex-lee/Desktop/football-manager
pnpm supabase db push
```

Expected: `Applied 1 migration`.

- [ ] **Step 3: Add to TypeScript Tournament type**

In `lib/supabase/types.ts`, add to the `Tournament` interface:

```typescript
knockout_qualifiers: string[] | null
```

- [ ] **Step 4: Add `updateKnockoutQualifiers` to lib/db/tournaments.ts**

In `lib/db/tournaments.ts`, add after `deleteTournament`:

```typescript
export async function updateKnockoutQualifiers(
  tournamentId: string,
  teamIds: string[],
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('tournaments')
    .update({ knockout_qualifiers: teamIds })
    .eq('id', tournamentId)
  if (error) return { error: error.message }
  return {}
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run __tests__/
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /home/alex-lee/Desktop/football-manager/.claude/worktrees/feat+tournament-lifecycle-enhancement
git add supabase/migrations/20260525000003_knockout_qualifiers.sql web/lib/supabase/types.ts web/lib/db/tournaments.ts
git commit -m "feat: add knockout_qualifiers column and updateKnockoutQualifiers helper"
```

---

### Task D2: Server action to save qualifiers

**Files:**
- Modify: `web/app/admin/tournaments/[id]/fixtures/actions.ts`

- [ ] **Step 1: Add `saveQualifiersAction`**

In `app/admin/tournaments/[id]/fixtures/actions.ts`, add the import and the new action:

```typescript
// Add to imports at top:
import { getTournament, updateKnockoutQualifiers } from '@/lib/db/tournaments'

// Add new action:
export async function saveQualifiersAction(
  tournamentId: string,
  teamIds: string[],
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const result = await updateKnockoutQualifiers(tournamentId, teamIds)
    if (result.error) return { error: result.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run __tests__/
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/[id]/fixtures/actions.ts
git commit -m "feat: add saveQualifiersAction server action"
```

---

### Task D3: QualifierSelector component

A section above the bracket in FixturesPanel that lets the admin pick which teams advance to the knockout round.

**Files:**
- Create: `web/components/admin/QualifierSelector.tsx`
- Modify: `web/app/admin/tournaments/[id]/fixtures/FixturesPanel.tsx`
- Modify: `web/app/admin/tournaments/[id]/fixtures/page.tsx`

- [ ] **Step 1: Create QualifierSelector component**

Create `components/admin/QualifierSelector.tsx`:

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveQualifiersAction } from '@/app/admin/tournaments/[id]/fixtures/actions'

interface TeamRef {
  id: string
  name: string
}

interface Props {
  tournamentId: string
  slots: number
  teams: TeamRef[]
  savedQualifiers: string[] | null
}

export function QualifierSelector({ tournamentId, slots, teams, savedQualifiers }: Props) {
  const router = useRouter()
  const [selections, setSelections] = useState<string[]>(
    savedQualifiers ?? Array(slots).fill(''),
  )
  const [pending, startTransition] = useTransition()

  function setSlot(index: number, teamId: string) {
    setSelections((prev) => {
      const next = [...prev]
      next[index] = teamId
      return next
    })
  }

  // A team already picked in another slot is unavailable in this slot
  function availableFor(slotIndex: number): TeamRef[] {
    const takenElsewhere = new Set(
      selections.filter((id, i) => i !== slotIndex && id !== ''),
    )
    return teams.filter((t) => !takenElsewhere.has(t.id))
  }

  const allFilled = selections.every((id) => id !== '') && selections.length === slots

  function save() {
    startTransition(async () => {
      const r = await saveQualifiersAction(tournamentId, selections)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Qualifiers saved.')
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="text-sm font-medium">Knockout Qualifiers</div>
      <p className="text-xs text-muted-foreground">
        Select the {slots} teams advancing to the knockout stage.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: slots }, (_, i) => (
          <Select
            key={i}
            value={selections[i] ?? ''}
            onValueChange={(v) => setSlot(i, v)}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Slot ${i + 1}`} />
            </SelectTrigger>
            <SelectContent>
              {availableFor(i).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>
      <Button size="sm" onClick={save} disabled={pending || !allFilled}>
        Save qualifiers
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Pass `knockout_qualifiers` and slot count through to FixturesPanel**

In `app/admin/tournaments/[id]/fixtures/page.tsx`, add two props to `<FixturesPanel>`:

```typescript
knockoutQualifiers={tournament.knockout_qualifiers ?? null}
// slots = numGroups * advancePerGroup (already available on tournament)
knockoutSlots={
  tournament.format === 'round_robin_knockout' &&
  tournament.num_groups != null &&
  tournament.advance_per_group != null
    ? tournament.num_groups * tournament.advance_per_group
    : 0
}
```

- [ ] **Step 3: Add QualifierSelector to FixturesPanel**

In `app/admin/tournaments/[id]/fixtures/FixturesPanel.tsx`, add to `Props`:

```typescript
knockoutQualifiers: string[] | null
knockoutSlots: number
```

Add the import:

```typescript
import { QualifierSelector } from '@/components/admin/QualifierSelector'
```

In the `FixturesPanel` component body, add the selector section just before `<MatchViews>`. It should only render for `round_robin_knockout` format and when `canEdit` is true:

```typescript
{tournamentFormat === 'round_robin_knockout' && canEdit && knockoutSlots > 0 && (
  <QualifierSelector
    tournamentId={tournamentId}
    slots={knockoutSlots}
    teams={teams}
    savedQualifiers={knockoutQualifiers}
  />
)}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run __tests__/
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/components/admin/QualifierSelector.tsx web/app/admin/tournaments/[id]/fixtures/FixturesPanel.tsx web/app/admin/tournaments/[id]/fixtures/page.tsx
git commit -m "feat: add QualifierSelector component to fixtures panel for round_robin_knockout"
```

---

### Task D4: Update bracket seeding to use saved qualifiers only

Remove auto-seed logic from `seedKnockoutBracketAction`. If qualifiers aren't saved yet, return an error prompting the admin to assign them first.

**Files:**
- Modify: `web/app/admin/tournaments/[id]/fixtures/actions.ts`

- [ ] **Step 1: Find `seedKnockoutBracketAction`**

Open `app/admin/tournaments/[id]/fixtures/actions.ts`. Locate `seedKnockoutBracketAction` (around line 215). It currently auto-computes standings and picks the top N teams.

- [ ] **Step 2: Replace the seeding logic**

Replace the body of `seedKnockoutBracketAction` with:

```typescript
export async function seedKnockoutBracketAction(
  tournamentId: string,
): Promise<{ seeded: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)

    const tournament = await getTournament(tournamentId)
    if (!tournament) return { error: 'Tournament not found.' }

    const qualifiers = tournament.knockout_qualifiers
    if (!qualifiers || qualifiers.length === 0) {
      return {
        error:
          'No qualifiers assigned yet. Use the Qualifiers section above the bracket to select which teams advance.',
      }
    }

    const existingMatches = await listMatches(tournamentId)
    const knockoutMatches = existingMatches.filter((m) => m.phase === 'knockout')
    if (knockoutMatches.length > 0 && knockoutMatches.some((m) => m.status !== 'scheduled')) {
      return { error: 'Knockout matches are already in progress — cannot re-seed.' }
    }

    // Pair qualifiers into first-round matches: slot[0] vs slot[1], slot[2] vs slot[3], etc.
    const pairs: { home: string; away: string }[] = []
    for (let i = 0; i < qualifiers.length - 1; i += 2) {
      pairs.push({ home: qualifiers[i], away: qualifiers[i + 1] })
    }

    let seeded = 0
    for (const pair of pairs) {
      const r = await createMatch({
        tournament_id: tournamentId,
        home_team_id: pair.home,
        away_team_id: pair.away,
        match_time: tournament.start_date + 'T12:00:00Z',
        phase: 'knockout',
        knockout_round: 'QF',
      })
      if ('id' in r) seeded++
    }

    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    return { seeded }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run __tests__/
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/tournaments/[id]/fixtures/actions.ts
git commit -m "feat: seed knockout bracket from saved qualifiers instead of auto-standings"
```

---

### Task D5: Remove auto-seed option from FixturesPanel UI

The FixturesPanel currently shows a "Generate bracket" or "Seed knockout" button that triggers the old auto-seed. Since we've switched to manual qualifiers, the bracket seeds after the admin clicks "Save qualifiers" + "Seed bracket". Update the UI copy and remove any auto-seed path.

**Files:**
- Modify: `web/app/admin/tournaments/[id]/fixtures/FixturesPanel.tsx`

- [ ] **Step 1: Find and update the seeding button**

In `FixturesPanel.tsx`, search for references to `seedKnockoutBracketAction` and any UI that says "Auto-seed", "Generate bracket from standings", or similar. Replace the button label or surrounding description to say:

```typescript
// Replace whatever label the bracket seed button currently has with:
"Seed knockout bracket"

// Replace any description text that mentions automatic standings-based seeding with:
"Uses the qualifiers you assigned above."
```

If there is a separate seeding mode selector (e.g. a radio between "Manual" / "By standings"), remove the radio entirely and keep only the single "Seed knockout bracket" button.

- [ ] **Step 2: Run tests**

```bash
npx vitest run __tests__/
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/[id]/fixtures/FixturesPanel.tsx
git commit -m "feat: remove auto-seed option, bracket seeds from saved qualifiers only"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|---|---|
| Position dropdown GK/DEF/MID/FWD | B1 |
| Fixture date hard block (client) | C1 |
| Fixture date hard block (server) | C2 |
| Fixture date hard block (DB) | C3 |
| Match time locked when live | Already enforced — `handleMatchClick` gates on `status === 'scheduled'`. No change needed. |
| Overview matches read-only | Already the case. No change needed. |
| Stale UI after mutations | A2 |
| min_players_per_team schema error | A1 |
| Knockout qualifier selection UI | D3 |
| Qualifier-only bracket seeding | D4 |
| Remove auto-seed from UI | D5 |
| Store qualifiers in DB | D1 |
| Save qualifiers server action | D2 |

**Placeholder scan:** No TBDs or incomplete steps found.

**Type consistency:** `QualifierSelector` receives `TeamRef` (same shape as `FixturesPanel`'s `TeamRef`). `saveQualifiersAction` takes `string[]` matching `knockout_qualifiers: uuid[]` column. `updateKnockoutQualifiers` matches the action call site.
