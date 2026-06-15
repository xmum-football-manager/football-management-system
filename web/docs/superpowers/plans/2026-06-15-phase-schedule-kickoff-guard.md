# Phase-Schedule Kickoff Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block any match from going live until every match in the same phase (group or knockout) has a scheduled time; once all are scheduled, early or late kickoff is allowed.

**Architecture:** A pure helper derives per-phase scheduling status from the match list (testable in unit tests). The server action replaces its per-match `match_time` guard with a phase-wide DB count query. Both `MatchRow` and `UpNextRow` receive a `kickoffBlocked` prop computed from the helper, disable the Kickoff button, and show an inline note explaining why.

**Tech Stack:** Next.js 16 server actions, Supabase JS client, React, Vitest

---

## File Map

| Action | File |
|--------|------|
| Create | `web/lib/phase-schedule-guard.ts` |
| Create | `web/__tests__/phase-schedule-guard.test.ts` |
| Modify | `web/app/admin/tournaments/[id]/actions.ts` (lines 33–35) |
| Modify | `web/components/admin/MatchViews.tsx` (ListView props + call sites) |
| Modify | `web/app/admin/tournaments/[id]/MatchRow.tsx` (Props + kickoff button) |
| Modify | `web/app/admin/tournaments/[id]/page.tsx` (UpNextRow call) |
| Modify | `web/app/admin/tournaments/[id]/UpNextRow.tsx` (Props + kickoff button) |

---

## Task 1: Pure helper + unit tests

**Files:**
- Create: `web/lib/phase-schedule-guard.ts`
- Create: `web/__tests__/phase-schedule-guard.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/__tests__/phase-schedule-guard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { phaseSchedulingStatus } from '@/lib/phase-schedule-guard'

type M = { phase: string | null; match_time: string | null }

const gSched = (match_time: string | null): M => ({ phase: 'group', match_time })
const koSched = (match_time: string | null): M => ({ phase: 'knockout', match_time })

describe('phaseSchedulingStatus', () => {
  it('returns true for both phases when no matches exist', () => {
    expect(phaseSchedulingStatus([])).toEqual({ group: true, knockout: true })
  })

  it('returns group:false when any group match has no time', () => {
    const matches = [gSched('2026-06-10T10:00:00Z'), gSched(null)]
    expect(phaseSchedulingStatus(matches).group).toBe(false)
  })

  it('returns group:true when all group matches have a time', () => {
    const matches = [gSched('2026-06-10T10:00:00Z'), gSched('2026-06-10T12:00:00Z')]
    expect(phaseSchedulingStatus(matches).group).toBe(true)
  })

  it('returns knockout:false when any ko match has no time', () => {
    const matches = [koSched('2026-06-10T10:00:00Z'), koSched(null)]
    expect(phaseSchedulingStatus(matches).knockout).toBe(false)
  })

  it('returns knockout:true when all ko matches have a time', () => {
    const matches = [koSched('2026-06-10T10:00:00Z')]
    expect(phaseSchedulingStatus(matches).knockout).toBe(true)
  })

  it('evaluates phases independently', () => {
    const matches = [gSched(null), koSched('2026-06-10T10:00:00Z')]
    expect(phaseSchedulingStatus(matches)).toEqual({ group: false, knockout: true })
  })

  it('ignores matches with null phase', () => {
    const matches = [{ phase: null, match_time: null }]
    expect(phaseSchedulingStatus(matches)).toEqual({ group: true, knockout: true })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd web && pnpm test -- --run __tests__/phase-schedule-guard.test.ts
```

Expected: `Cannot find module '@/lib/phase-schedule-guard'`

- [ ] **Step 3: Implement the helper**

Create `web/lib/phase-schedule-guard.ts`:

```typescript
type ScheduleInput = { phase: string | null; match_time: string | null }

export function phaseSchedulingStatus(matches: ScheduleInput[]): {
  group: boolean
  knockout: boolean
} {
  const group = matches.filter((m) => m.phase === 'group')
  const knockout = matches.filter((m) => m.phase === 'knockout')
  return {
    group: group.length === 0 || group.every((m) => m.match_time !== null),
    knockout: knockout.length === 0 || knockout.every((m) => m.match_time !== null),
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd web && pnpm test -- --run __tests__/phase-schedule-guard.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/lib/phase-schedule-guard.ts web/__tests__/phase-schedule-guard.test.ts
git commit -m "feat: add phaseSchedulingStatus helper with tests"
```

---

## Task 2: Update the server action guard

**Files:**
- Modify: `web/app/admin/tournaments/[id]/actions.ts` (lines 33–35)

The existing guard at line 33 blocks a single match with no `match_time`. Replace it with a phase-wide DB count so the rule applies to the whole phase.

- [ ] **Step 1: Replace the per-match guard in `actions.ts`**

Find and replace lines 33–35:

```typescript
// REMOVE these 3 lines:
    if (next === 'live' && !match.match_time) {
      return { error: 'Set a match time before going live.' }
    }
```

Replace with:

```typescript
    if (next === 'live') {
      const supabase = await createClient()
      const { count, error: countErr } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('tournament_id', match.tournament_id)
        .eq('phase', match.phase ?? '')
        .is('match_time', null)
      if (countErr) return { error: 'Could not verify schedule. Try again.' }
      if (count !== null && count > 0) {
        const label = match.phase === 'group' ? 'group' : 'knockout'
        return {
          error: `${count} ${label} match${count === 1 ? '' : 'es'} still need a scheduled time. Schedule all ${label} matches before starting play.`,
        }
      }
    }
```

> Note: the existing `createClient()` call at line 42 (the 1-live guard) already uses the same client. The new block goes *before* line 37 (the KO teams guard), replacing the old lines 33-35. The order of guards after the change is:
> 1. Phase-wide schedule check (new)
> 2. KO teams-not-determined check (existing line 37)
> 3. 1-live guard (existing line 41)
> 4. KO finish / winner check (existing line 55)

- [ ] **Step 2: TypeCheck**

```bash
cd web && tsc --noEmit 2>&1 | grep actions
```

Expected: no errors from actions.ts.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/[id]/actions.ts
git commit -m "fix: replace per-match schedule guard with phase-wide check"
```

---

## Task 3: Thread `kickoffBlocked` into `MatchRow`

**Files:**
- Modify: `web/app/admin/tournaments/[id]/MatchRow.tsx`
- Modify: `web/components/admin/MatchViews.tsx`

- [ ] **Step 1: Add `kickoffBlocked` prop to `MatchRow`**

In `web/app/admin/tournaments/[id]/MatchRow.tsx`, update the `Props` interface (line 24):

```typescript
interface Props {
  match: MatchWithTeams
  tournamentStatus: TournamentStatus
  isAdmin: boolean
  onMatchClick?: (m: MatchWithTeams) => void
  kickoffBlocked?: boolean   // ← add this
}
```

Update the destructure at line 88:

```typescript
export function MatchRow({ match, tournamentStatus, isAdmin, onMatchClick, kickoffBlocked = false }: Props) {
```

- [ ] **Step 2: Disable kickoff button and show inline note when blocked**

In `MatchRow`, find where `lifecycleActions` are rendered (around line 198). Change the `disabled` condition for the Kickoff action only:

```typescript
        {lifecycleActions.map((action) => (
          <Button
            key={action.next + action.label}
            size="sm"
            variant={action.tone === 'primary' ? 'default' : 'outline'}
            className="admin-tab tracking-wider text-[11px]"
            style={
              action.tone === 'amber'
                ? { color: '#B45309', borderColor: 'rgba(180,83,9,0.4)' }
                : action.tone === 'destructive'
                  ? { color: '#DC2626', borderColor: 'rgba(220,38,38,0.4)' }
                  : undefined
            }
            disabled={busy !== null || (action.next === 'live' && kickoffBlocked)}
            title={action.next === 'live' && kickoffBlocked ? 'Schedule all matches in this phase first' : undefined}
            onClick={() => setPrompt(action)}
          >
            {busy === action.next ? <Loader2 className="h-3 w-3 animate-spin" /> : action.icon}
            {action.label}
          </Button>
        ))}
```

Then add the inline note directly after the `lifecycleActions.map(...)` block:

```tsx
        {scheduled && kickoffBlocked && (
          <p className="text-[11px] text-muted-foreground">
            Schedule all {match.phase} matches first
          </p>
        )}
```

(`scheduled` is already derived from `match.status === 'scheduled'` at line 94.)

- [ ] **Step 3: Pass `kickoffBlocked` from `ListView` in `MatchViews`**

In `web/components/admin/MatchViews.tsx`, update the `ListView` props interface (around line 262):

```typescript
function ListView({
  matches,
  tournamentStatus,
  isAdmin,
  onMatchClick,
  phaseScheduled,
}: {
  matches: MatchWithTeams[]
  tournamentStatus: TournamentStatus
  isAdmin: boolean
  onMatchClick?: (m: MatchWithTeams) => void
  phaseScheduled: { group: boolean; knockout: boolean }  // ← add
}) {
```

In `renderList` inside `ListView`, pass the prop to `MatchRow`:

```tsx
            <MatchRow
              match={m}
              tournamentStatus={tournamentStatus}
              isAdmin={isAdmin}
              onMatchClick={onMatchClick}
              kickoffBlocked={!phaseScheduled[m.phase as 'group' | 'knockout'] ?? false}
            />
```

- [ ] **Step 4: Compute `phaseScheduled` in `MatchViews` and pass it to both `ListView` call sites**

At the top of the `MatchViews` component function (before the return), add:

```typescript
import { phaseSchedulingStatus } from '@/lib/phase-schedule-guard'

// inside MatchViews component:
const phaseScheduled = phaseSchedulingStatus(matches)
```

Add `phaseScheduled={phaseScheduled}` to both `<ListView ... />` call sites (lines ~110 and ~182).

- [ ] **Step 5: TypeCheck**

```bash
cd web && tsc --noEmit 2>&1 | grep -E "MatchViews|MatchRow"
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add web/app/admin/tournaments/[id]/MatchRow.tsx web/components/admin/MatchViews.tsx
git commit -m "feat: disable kickoff and show warning when phase not fully scheduled"
```

---

## Task 4: Thread `kickoffBlocked` into `UpNextRow`

**Files:**
- Modify: `web/app/admin/tournaments/[id]/UpNextRow.tsx`
- Modify: `web/app/admin/tournaments/[id]/page.tsx`

- [ ] **Step 1: Add `kickoffBlocked` prop to `UpNextRow`**

In `web/app/admin/tournaments/[id]/UpNextRow.tsx`, update the `Props` interface:

```typescript
interface Props {
  match: MatchWithTeams
  isAdmin: boolean
  hasLiveMatch: boolean
  kickoffBlocked?: boolean  // ← add
}
```

Update the destructure:

```typescript
export function UpNextRow({ match, isAdmin, hasLiveMatch, kickoffBlocked = false }: Props) {
```

Update the `Button`:

```tsx
      <div className="flex flex-col items-end gap-1">
        <Button
          size="sm"
          disabled={pending || hasLiveMatch || kickoffBlocked}
          onClick={kickoff}
          title={
            hasLiveMatch
              ? 'Finish the current match first'
              : kickoffBlocked
                ? 'Schedule all matches in this phase first'
                : undefined
          }
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Kickoff
        </Button>
        {kickoffBlocked && !hasLiveMatch && (
          <p className="text-[11px] text-muted-foreground">Schedule all {match.phase} matches first</p>
        )}
      </div>
```

> The existing `<Button>` is wrapped in a `div` that also holds the new note. The outer layout div in `UpNextRow` uses `justify-between`, so the right side can be a column-flex.

- [ ] **Step 2: Compute and pass `kickoffBlocked` from `page.tsx`**

In `web/app/admin/tournaments/[id]/page.tsx`, add after the `upNext` derivation:

```typescript
import { phaseSchedulingStatus } from '@/lib/phase-schedule-guard'

// after upNext is defined:
const phaseScheduled = phaseSchedulingStatus(matches)
const upNextKickoffBlocked = upNext
  ? !(phaseScheduled[upNext.phase as 'group' | 'knockout'] ?? true)
  : false
```

Pass to `UpNextRow`:

```tsx
      <UpNextRow
        match={upNext}
        isAdmin={admin}
        hasLiveMatch={hasLiveMatch}
        kickoffBlocked={upNextKickoffBlocked}
      />
```

- [ ] **Step 3: TypeCheck**

```bash
cd web && tsc --noEmit 2>&1 | grep -E "UpNextRow|page"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/tournaments/[id]/UpNextRow.tsx web/app/admin/tournaments/[id]/page.tsx
git commit -m "feat: block UpNextRow kickoff when phase not fully scheduled"
```

---

## Task 5: Full test run + manual smoke test

- [ ] **Step 1: Run full test suite**

```bash
cd web && pnpm test -- --run
```

Expected: all tests pass (273+7 = 280).

- [ ] **Step 2: Dev server smoke test**

Open `http://localhost:3000/admin` and navigate to **Stage · GP Midway**.

Check:
1. In the Matches list, the unscheduled group matches show a **disabled Kickoff button** with the inline note "Schedule all group matches first"
2. The "Next up" row (if visible) also shows the button disabled with the same note
3. Navigate to **Stage · KO Seeded** — KO matches should be kickoffable (all have `match_time` from the seeder)
4. Navigate to **Stage · GP Done** — group matches have no `match_time` (seeded with `null`), kickoff should be blocked

> To verify Stage · KO Seeded has times: the seeder sets `match_time: SCHED_TIME` for all scheduled KO matches, so knockout kickoff should be allowed.

- [ ] **Step 3: Verify server-side guard (safety net)**

In the browser console or via curl, confirm the server action also rejects if called directly without a scheduled phase. (Optional — the client guard prevents reaching the server in normal flow.)

---

## Self-Review Checklist

- [x] Spec coverage: all three layers (pure helper / server / client) implemented
- [x] No TBDs or placeholders
- [x] Type consistency: `phaseScheduled: { group: boolean; knockout: boolean }` used consistently across helper, MatchViews, page.tsx
- [x] `kickoffBlocked` default is `false` in both MatchRow and UpNextRow — safe if prop omitted
- [x] Server guard fires even if client is bypassed (defense in depth)
- [x] `match.phase` can technically be any string; `?? false` / `?? true` fallbacks handle unknown phases safely
