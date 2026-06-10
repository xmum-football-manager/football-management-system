# Scorekeeper Match Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live match timer, tournament day label, and match time range to the scorekeeper score screen.

**Architecture:** Add two nullable timestamp columns to `matches` via migration, extend types, wire timestamp-setting logic into `updateMatchStatus`, add four pure helper functions to `lib/format.ts`, write unit tests for those helpers, then render the timer and context in `ScoreCard`.

**Tech Stack:** Next.js (modified), React (client components), Supabase (PostgreSQL + JS client), Vitest, TypeScript.

---

### File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260610000000_match_halftime_timestamps.sql` | Create | DB migration for two new columns |
| `web/lib/supabase/types.ts` | Modify | Add new fields to `Match`, add `tournament` to `MatchWithTeams` |
| `web/lib/db/matches.ts` | Modify | Set `halftime_started_at` / `second_half_started_at` in `updateMatchStatus` |
| `web/lib/format.ts` | Modify | Add `matchElapsedSeconds`, `formatElapsed`, `tournamentDayLabel`, `expectedMatchRange` |
| `web/__tests__/format.test.ts` | Create | Unit tests for the four new helpers |
| `web/app/score/page.tsx` | Modify | Add `tournament:tournaments(*)` to Supabase select |
| `web/app/score/ScoreApp.tsx` | Modify | Add `tournament:tournaments(*)` to refresh select; add 1s tick + timer render in `ScoreCard` |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260610000000_match_halftime_timestamps.sql`

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE matches ADD COLUMN halftime_started_at timestamptz;
ALTER TABLE matches ADD COLUMN second_half_started_at timestamptz;
```

- [ ] **Step 2: Verify the file exists**

```bash
cat supabase/migrations/20260610000000_match_halftime_timestamps.sql
```

Expected: the two ALTER statements printed.

---

### Task 2: Extend TypeScript types

**Files:**
- Modify: `web/lib/supabase/types.ts`

- [ ] **Step 1: Add new fields to `Match` and extend `MatchWithTeams`**

In `Match` interface (after `match_finished_at: string | null`), add:
```ts
  halftime_started_at: string | null
  second_half_started_at: string | null
```

Replace the `MatchWithTeams` interface:
```ts
export interface MatchWithTeams extends Match {
  home_team: Team
  away_team: Team
  tournament: Tournament
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit 2>&1 | head -40
```

Expected: no new errors (ignore any pre-existing ones).

---

### Task 3: Update `updateMatchStatus` in `lib/db/matches.ts`

**Files:**
- Modify: `web/lib/db/matches.ts`

- [ ] **Step 1: Extend the existing `if (status === 'live')` block and add halftime case**

Replace the existing status-patching section (lines 95–103) with:

```ts
  if (status === 'live') {
    const existing = await getMatch(id)
    if (existing && !existing.match_started_at) {
      patch.match_started_at = new Date().toISOString()
    }
    if (existing && existing.halftime_started_at && !existing.second_half_started_at) {
      patch.second_half_started_at = new Date().toISOString()
    }
  }
  if (status === 'halftime') {
    const existing = await getMatch(id)
    if (existing && !existing.halftime_started_at) {
      patch.halftime_started_at = new Date().toISOString()
    }
  }
  if (status === 'finished') {
    patch.match_finished_at = new Date().toISOString()
  }
```

Note: the original code only called `getMatch` inside `if (status === 'live')`. The new code calls it for `halftime` too, separately, to avoid one extra fetch when transitioning to `finished`.

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

---

### Task 4: Add pure format helpers to `lib/format.ts`

**Files:**
- Modify: `web/lib/format.ts`

- [ ] **Step 1: Append the four helpers at the end of the file**

```ts
export function matchElapsedSeconds(
  match: {
    match_started_at: string | null
    halftime_started_at: string | null
    second_half_started_at: string | null
  },
  now: Date,
): number {
  if (!match.match_started_at) return 0
  const start = new Date(match.match_started_at).getTime()
  if (!match.halftime_started_at) {
    return Math.floor((now.getTime() - start) / 1000)
  }
  const firstHalf = Math.floor(
    (new Date(match.halftime_started_at).getTime() - start) / 1000,
  )
  if (!match.second_half_started_at) {
    return firstHalf
  }
  const secondHalfElapsed = Math.floor(
    (now.getTime() - new Date(match.second_half_started_at).getTime()) / 1000,
  )
  return firstHalf + secondHalfElapsed
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function tournamentDayLabel(
  tournament: { start_date: string; end_date: string },
  matchTime: string,
): string {
  const start = new Date(tournament.start_date)
  const end = new Date(tournament.end_date)
  const match = new Date(matchTime)

  // Strip to local date-only (midnight) for day arithmetic
  const toDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const startDay = toDay(start)
  const endDay = toDay(end)
  const matchDay = toDay(match)

  const msPerDay = 1000 * 60 * 60 * 24
  const totalDays =
    Math.round((endDay.getTime() - startDay.getTime()) / msPerDay) + 1
  const dayIndex =
    Math.round((matchDay.getTime() - startDay.getTime()) / msPerDay) + 1

  const label = match.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })

  return `Day ${dayIndex} of ${totalDays} (${label})`
}

export function expectedMatchRange(
  tournament: {
    minutes_per_half: number
    halftime_enabled: boolean
    halftime_minutes: number | null
  },
  matchTime: string,
): string {
  const start = new Date(matchTime)
  const durationMinutes =
    2 * tournament.minutes_per_half +
    (tournament.halftime_enabled ? (tournament.halftime_minutes ?? 0) : 0)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  return `${formatClock(start.toISOString())} – ${formatClock(end.toISOString())}`
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

---

### Task 5: Write unit tests for the four helpers

**Files:**
- Create: `web/__tests__/format.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect } from 'vitest'
import {
  matchElapsedSeconds,
  formatElapsed,
  tournamentDayLabel,
  expectedMatchRange,
} from '../lib/format'

const T0 = '2026-06-15T10:00:00.000Z'
const T1 = '2026-06-15T10:20:00.000Z' // 20 min after start = halftime_started_at
const T2 = '2026-06-15T10:35:00.000Z' // 15 min halftime break = second_half_started_at
const NOW = new Date('2026-06-15T10:45:00.000Z') // 10 min into second half

describe('matchElapsedSeconds', () => {
  it('returns 0 when match has not started', () => {
    expect(
      matchElapsedSeconds(
        { match_started_at: null, halftime_started_at: null, second_half_started_at: null },
        NOW,
      ),
    ).toBe(0)
  })

  it('counts up in first half (no halftime_started_at)', () => {
    // 45 minutes into first half
    const now = new Date('2026-06-15T10:45:00.000Z')
    expect(
      matchElapsedSeconds(
        { match_started_at: T0, halftime_started_at: null, second_half_started_at: null },
        now,
      ),
    ).toBe(45 * 60)
  })

  it('freezes at end of first half when at halftime', () => {
    // 1 hour after T0 but no second half started — should return first-half duration (20 min)
    const now = new Date('2026-06-15T11:00:00.000Z')
    expect(
      matchElapsedSeconds(
        { match_started_at: T0, halftime_started_at: T1, second_half_started_at: null },
        now,
      ),
    ).toBe(20 * 60)
  })

  it('adds second-half elapsed when second half is running', () => {
    // firstHalf = 20min, secondHalf so far = 10min → 30min total
    expect(
      matchElapsedSeconds(
        { match_started_at: T0, halftime_started_at: T1, second_half_started_at: T2 },
        NOW,
      ),
    ).toBe(30 * 60)
  })
})

describe('formatElapsed', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatElapsed(0)).toBe('0:00')
  })

  it('formats 541 seconds as 9:01', () => {
    expect(formatElapsed(541)).toBe('9:01')
  })

  it('formats 3792 seconds as 63:12', () => {
    expect(formatElapsed(3792)).toBe('63:12')
  })

  it('zero-pads seconds', () => {
    expect(formatElapsed(60)).toBe('1:00')
  })
})

describe('tournamentDayLabel', () => {
  it('returns Day 1 of 3 for first day of a 3-day tournament', () => {
    const tournament = { start_date: '2026-06-15', end_date: '2026-06-17' }
    const result = tournamentDayLabel(tournament, '2026-06-15T10:00:00.000Z')
    expect(result).toMatch(/^Day 1 of 3/)
  })

  it('returns Day 2 of 3 for second day', () => {
    const tournament = { start_date: '2026-06-15', end_date: '2026-06-17' }
    const result = tournamentDayLabel(tournament, '2026-06-16T14:00:00.000Z')
    expect(result).toMatch(/^Day 2 of 3/)
  })

  it('includes formatted date in parentheses', () => {
    const tournament = { start_date: '2026-06-15', end_date: '2026-06-17' }
    const result = tournamentDayLabel(tournament, '2026-06-15T10:00:00.000Z')
    expect(result).toContain('June 15')
  })

  it('returns Day 1 of 1 for single-day tournament', () => {
    const tournament = { start_date: '2026-06-20', end_date: '2026-06-20' }
    const result = tournamentDayLabel(tournament, '2026-06-20T09:00:00.000Z')
    expect(result).toMatch(/^Day 1 of 1/)
  })
})

describe('expectedMatchRange', () => {
  it('computes range with halftime enabled', () => {
    const tournament = {
      minutes_per_half: 45,
      halftime_enabled: true,
      halftime_minutes: 15,
    }
    // 45+45+15 = 105 minutes. Start 16:00 → end 17:45
    const result = expectedMatchRange(tournament, '2026-06-15T16:00:00.000Z')
    expect(result).toContain('–')
    const parts = result.split('–').map((s) => s.trim())
    expect(parts).toHaveLength(2)
  })

  it('computes range without halftime', () => {
    const tournament = {
      minutes_per_half: 20,
      halftime_enabled: false,
      halftime_minutes: 10,
    }
    // 20+20+0 = 40 min. Start 16:00 → end 16:40
    const result = expectedMatchRange(tournament, '2026-06-15T16:00:00.000Z')
    expect(result).toContain('–')
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd web && pnpm test -- --project=node 2>&1 | tail -30
```

Expected: all tests in `format.test.ts` pass.

---

### Task 6: Update Supabase selects to include tournament

**Files:**
- Modify: `web/app/score/page.tsx`
- Modify: `web/app/score/ScoreApp.tsx`

- [ ] **Step 1: Update `page.tsx` select**

In `web/app/score/page.tsx`, change the select string from:
```ts
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
```
to:
```ts
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*), tournament:tournaments(*)')
```

- [ ] **Step 2: Update `ScoreApp.tsx` refresh select**

In the `refresh()` function in `web/app/score/ScoreApp.tsx`, change the select string from:
```ts
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
```
to:
```ts
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*), tournament:tournaments(*)')
```

- [ ] **Step 3: Typecheck**

```bash
cd web && tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

---

### Task 7: Add timer tick and render in `ScoreCard`

**Files:**
- Modify: `web/app/score/ScoreApp.tsx`

- [ ] **Step 1: Add import for format helpers at the top of `ScoreApp.tsx`**

Add to the existing imports (after the existing `import type { MatchStatus, MatchWithTeams }` line):
```ts
import { matchElapsedSeconds, formatElapsed, tournamentDayLabel, expectedMatchRange } from '@/lib/format'
```

- [ ] **Step 2: Add `now` state and 1-second interval inside `ScoreCard`**

After the existing state declarations in `ScoreCard` (after `const [transitioning, setTransitioning] = useState(false)`), add:

```ts
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
```

- [ ] **Step 3: Render timer, day label, and time range in the status block**

In the `ScoreCard` return, the status block currently is:
```tsx
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
```

Replace it with:
```tsx
      <div className="text-center mb-4 space-y-1">
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
        {match.match_started_at && (
          <div className="text-white text-lg font-mono font-semibold tabular-nums">
            {formatElapsed(matchElapsedSeconds(match, now))}
          </div>
        )}
        {match.tournament && match.match_time && (
          <div className="text-slate-400 text-xs">
            {tournamentDayLabel(match.tournament, match.match_time)}
          </div>
        )}
        {match.tournament && match.match_time && (
          <div className="text-slate-400 text-xs">
            {expectedMatchRange(match.tournament, match.match_time)}
          </div>
        )}
      </div>
```

- [ ] **Step 4: Typecheck**

```bash
cd web && tsc --noEmit 2>&1 | head -40
```

Expected: no new errors.

---

### Task 8: Final verification

- [ ] **Step 1: Run typecheck**

```bash
cd web && tsc --noEmit
```

Expected: exits 0 with no output.

- [ ] **Step 2: Run lint**

```bash
cd web && pnpm lint
```

Expected: exits 0 (or only pre-existing warnings).

- [ ] **Step 3: Run tests**

```bash
cd web && pnpm test -- --project=node
```

Expected: all tests pass, including the new `format.test.ts`.
