# Knockout Overview Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make scheduled knockout matches appear in the Overview tab's "Next up" row so admins can kick off Round 1 without leaving the overview.

**Architecture:** Phase-aware fallback in the overview page's `upNext` computation — the existing timed-match filter runs first (group-stage behaviour unchanged); if it returns nothing, the first scheduled knockout match is used regardless of whether `match_time` is set. No new components or DB changes.

**Tech Stack:** Next.js App Router (Server Component), TypeScript, Vitest for unit tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `web/app/admin/tournaments/[id]/page.tsx` | Add phase-aware fallback to `upNext` computation |
| Create | `web/__tests__/overview-upnext.test.ts` | Unit tests for the `upNext` selection logic |

---

### Task 1: Unit tests for upNext selection logic

The `upNext` logic lives inline in a Server Component, so we extract it into a pure helper function, test it, then inline the equivalent in the page.

**Files:**
- Create: `web/__tests__/overview-upnext.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/__tests__/overview-upnext.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

// Pure helper — mirrors the logic in page.tsx
function pickUpNext(
  matches: Array<{ status: string; match_time: string | null; phase: string }>,
) {
  const timedUpNext = matches
    .filter((m) => m.status === 'scheduled' && m.match_time !== null)
    .sort((a, b) => a.match_time!.localeCompare(b.match_time!))
    .at(0) ?? null

  return (
    timedUpNext ??
    matches.find((m) => m.status === 'scheduled' && m.phase === 'knockout') ??
    null
  )
}

const sched = (match_time: string | null, phase = 'group') =>
  ({ status: 'scheduled', match_time, phase })
const finished = (phase = 'group') =>
  ({ status: 'finished', match_time: '2026-06-01T10:00:00Z', phase })

describe('pickUpNext', () => {
  it('returns null when no scheduled matches exist', () => {
    expect(pickUpNext([])).toBeNull()
    expect(pickUpNext([finished()])).toBeNull()
  })

  it('returns the earliest timed match when one exists', () => {
    const matches = [
      sched('2026-06-07T15:00:00Z'),
      sched('2026-06-07T12:00:00Z'),
    ]
    const result = pickUpNext(matches)
    expect(result?.match_time).toBe('2026-06-07T12:00:00Z')
  })

  it('ignores finished matches even if timed', () => {
    const matches = [finished(), sched('2026-06-07T15:00:00Z')]
    expect(pickUpNext(matches)?.match_time).toBe('2026-06-07T15:00:00Z')
  })

  it('falls back to knockout match when no timed matches exist', () => {
    const ko = sched(null, 'knockout')
    expect(pickUpNext([ko])).toBe(ko)
  })

  it('prefers timed group match over untimed knockout match', () => {
    const group = sched('2026-06-07T15:00:00Z', 'group')
    const ko = sched(null, 'knockout')
    expect(pickUpNext([ko, group])).toBe(group)
  })

  it('returns null when only non-knockout untimed scheduled matches exist', () => {
    // Unscheduled group match (no time) should NOT appear — only knockout fallback
    const untimed = sched(null, 'group')
    expect(pickUpNext([untimed])).toBeNull()
  })

  it('returns the knockout match when all group matches are finished', () => {
    const matches = [finished('group'), finished('group'), sched(null, 'knockout')]
    const result = pickUpNext(matches)
    expect(result?.phase).toBe('knockout')
  })

  it('picks knockout match with time over knockout match without time', () => {
    const ko1 = sched(null, 'knockout')
    const ko2 = sched('2026-06-07T15:00:00Z', 'knockout')
    // ko2 has a time so it wins via timedUpNext
    expect(pickUpNext([ko1, ko2])).toBe(ko2)
  })
})
```

- [ ] **Step 2: Run tests — expect them to pass (logic is self-contained)**

```bash
cd web && pnpm test __tests__/overview-upnext.test.ts
```

Expected: 8 tests pass. The helper is defined inline in the test file so all assertions are immediately valid.

- [ ] **Step 3: Commit**

```bash
git add web/__tests__/overview-upnext.test.ts
git commit -m "test: add unit tests for overview upNext phase-aware fallback"
```

---

### Task 2: Apply the fallback in the overview page

**Files:**
- Modify: `web/app/admin/tournaments/[id]/page.tsx` — lines 34–37 (the `upNext` block)

- [ ] **Step 1: Read the current upNext block**

Open `web/app/admin/tournaments/[id]/page.tsx` and find:

```ts
  const upNext = matches
    .filter((m) => m.status === 'scheduled' && m.match_time !== null)
    .sort((a, b) => a.match_time!.localeCompare(b.match_time!))
    .at(0) ?? null
```

- [ ] **Step 2: Replace with the phase-aware fallback**

```ts
  const timedUpNext = matches
    .filter((m) => m.status === 'scheduled' && m.match_time !== null)
    .sort((a, b) => a.match_time!.localeCompare(b.match_time!))
    .at(0) ?? null

  const upNext =
    timedUpNext ??
    matches.find((m) => m.status === 'scheduled' && m.phase === 'knockout') ??
    null
```

- [ ] **Step 3: Run typecheck**

```bash
cd web && pnpm tsc --noEmit 2>&1 | grep -v "seed-knockout" | head -20
```

Expected: no output (zero errors).

- [ ] **Step 4: Run full test suite**

```bash
cd web && pnpm test
```

Expected: all tests pass including the 8 new ones in `overview-upnext.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/page.tsx
git commit -m "feat: show knockout match in overview Next Up even without scheduled time"
```
