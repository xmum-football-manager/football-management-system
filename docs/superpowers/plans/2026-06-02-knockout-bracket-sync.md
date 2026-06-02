# Knockout Bracket Sync — Implementation Plan

> **For agentic workers:** Execute task-by-task. Steps use checkbox (`- [ ]`) syntax. This plan is run by a Sonnet subagent; the Opus controller reviews each task.

**Goal:** Make created knockout matches reliably appear in the admin overview Structure tab *and* the public bracket, by (a) confirming why they currently vanish and (b) bucketing brackets by the authoritative `knockout_round` column instead of array-position heuristics.

**Architecture:** Single source of truth. A match's round is `match.knockout_round` (`'r32' | 'r16' | 'qf' | 'sf' | 'final'`), not its index in a count-sliced array. Add one shared lib helper that both bracket renderers consume. Diagnose the disappearance before touching renderers — the cause may be data (seed script not setting `phase`), not code.

**Tech Stack:** Next.js (App Router — note `web/AGENTS.md`: read `node_modules/next/dist/docs/` before using framework APIs), TypeScript, Supabase, Vitest.

**Round vocabulary (authoritative, lowercase):** `r32`, `r16`, `qf`, `sf`, `final`. Order earliest→latest: `['r32','r16','qf','sf','final']`. Defined in `app/admin/tournaments/[id]/actions.ts:108` and produced by `knockoutRoundLabel` in `app/admin/tournaments/[id]/fixtures/actions.ts:178`.

**Working dir:** all paths are under `web/`. Run all commands from `web/`. Package manager: **pnpm**.

**Health checks:** `tsc --noEmit` · `pnpm lint` · `pnpm test`

---

### Task 1: Diagnose WHY knockout matches disappear (evidence before fixes)

**Do not write any fix in this task.** Gather evidence, report findings, then stop for controller decision.

**Context:** The seed script `web/scripts/seed-knockout-test.ts` creates ONLY group matches (all correctly `phase='group'`, finished). It does NOT create knockout matches — those are created by the user via the KO stepper → `createManualKnockoutAction` (`app/admin/tournaments/[id]/fixtures/actions.ts:308`), which DOES set `phase: 'knockout'` and `knockout_round` (e.g. `'sf'` for a `knockout_start_round: 'semi'` tournament). So a missing-phase seed bug is NOT the cause. RLS SELECT is `using(true)` (not the cause); both `listMatches`/`listMatchesAdmin` `select('*')` (not the cause).

Static tracing says a 4-qualifier SF bracket (2 `sf` matches) SHOULD render in both the overview Structure tab and the public bracket. So if they're genuinely missing, the likely causes are: **(1)** the user-created KO matches never persisted — `knockout_round` may have violated the DB CHECK constraint and the insert errored (cf. commit `21aa644` "use lowercase knockout_round values to match DB check constraint"); or **(2)** a render/bucketing fault that Task 2–4 fix anyway. Confirm with a DB probe.

**Files:**
- Reference: `web/scripts/seed-knockout-test.ts` (connection setup to model the probe on — service-role client + tsx)
- Reference: `app/admin/tournaments/[id]/fixtures/actions.ts:308` (`createManualKnockoutAction`)

- [ ] **Step 1: Probe the live DB.** Write a throwaway read-only script `web/scripts/diag-phase.ts` modeled on the connection setup in `seed-knockout-test.ts`. For the "KO Test Runners" tournament (or the most recently created `round_robin_knockout`), print: the tournament's `knockout_start_round`/`advance_per_group`/`num_groups`, and every match's `id, phase, knockout_round, match_time, status, home_team_id, away_team_id`. Run: `pnpm tsx scripts/diag-phase.ts`. Capture output.

- [ ] **Step 2: Check the CHECK constraint.** From the probe, note what distinct `knockout_round` values exist. If there are ZERO `phase='knockout'` rows even though a bracket was built in the UI, the inserts likely failed — inspect the constraint by attempting a probe insert of a `knockout_round='sf'` match (then delete it) and report any error message.

- [ ] **Step 3: Classify the failure:**
  - **(A) Not persisted:** no `phase='knockout'` rows exist despite building a bracket → insert is failing (constraint or action error). Fix is in the create path, not the renderers.
  - **(B) Render bug:** `phase='knockout'` rows exist with valid `knockout_round` but don't display → Task 2–4 fix it.
  - **(C) Stale/sub-view:** rows exist and render once you hard-refresh or switch to the Structure sub-view → caching/UX, not data.

- [ ] **Step 4: Delete the diagnostic script** (`rm scripts/diag-phase.ts`) and report: `CLASSIFICATION: A | B | C` plus the captured row dump and any constraint error. **Stop here — await controller direction.**

---

### Task 2: Add a shared `bracketRounds` helper keyed on `knockout_round`

**Context:** Two renderers currently infer rounds from array position: `components/admin/AdminBracketView.tsx:50` (`bucketRounds`) and `components/BracketView.tsx:112-114` (`.slice`). Replace both with one helper that groups by the authoritative `knockout_round` column. Per `web/CLAUDE.md`, shared helpers used in >1 file belong in `lib/`.

**Files:**
- Create: `lib/bracket.ts`
- Test: `__tests__/bracket.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// __tests__/bracket.test.ts
import { describe, it, expect } from 'vitest'
import { groupByKnockoutRound, KNOCKOUT_ROUND_ORDER } from '@/lib/bracket'

type M = { id: string; knockout_round: string | null }
const m = (id: string, r: string | null): M => ({ id, knockout_round: r })

describe('groupByKnockoutRound', () => {
  it('orders rounds earliest→latest regardless of input order', () => {
    const out = groupByKnockoutRound([m('a', 'final'), m('b', 'qf'), m('c', 'sf'), m('d', 'qf')])
    expect(out.map((r) => r.round)).toEqual(['qf', 'sf', 'final'])
    expect(out[0].matches.map((x) => x.id)).toEqual(['b', 'd'])
  })

  it('drops matches with null/unknown round', () => {
    const out = groupByKnockoutRound([m('a', null), m('b', 'sf'), m('c', 'bogus')])
    expect(out.map((r) => r.round)).toEqual(['sf'])
    expect(out[0].matches.map((x) => x.id)).toEqual(['b'])
  })

  it('returns empty array for no matches', () => {
    expect(groupByKnockoutRound([])).toEqual([])
  })

  it('exposes canonical round order', () => {
    expect(KNOCKOUT_ROUND_ORDER).toEqual(['r32', 'r16', 'qf', 'sf', 'final'])
  })
})
```

- [ ] **Step 2: Run it, verify it fails.** `pnpm test bracket` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/bracket.ts`.**

```ts
export const KNOCKOUT_ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'final'] as const
export type KnockoutRound = (typeof KNOCKOUT_ROUND_ORDER)[number]

export interface RoundGroup<T> {
  round: KnockoutRound
  matches: T[]
}

/**
 * Group knockout matches into ordered rounds using the authoritative
 * `knockout_round` column. Matches with a null/unknown round are dropped.
 * Input order within a round is preserved.
 */
export function groupByKnockoutRound<T extends { knockout_round: string | null }>(
  matches: T[],
): RoundGroup<T>[] {
  const buckets = new Map<KnockoutRound, T[]>()
  for (const match of matches) {
    const round = match.knockout_round
    if (!round || !KNOCKOUT_ROUND_ORDER.includes(round as KnockoutRound)) continue
    const key = round as KnockoutRound
    const list = buckets.get(key) ?? []
    list.push(match)
    buckets.set(key, list)
  }
  return KNOCKOUT_ROUND_ORDER
    .filter((r) => buckets.has(r))
    .map((r) => ({ round: r, matches: buckets.get(r)! }))
}

export function knockoutRoundLabel(round: KnockoutRound): string {
  switch (round) {
    case 'r32': return 'Round of 32'
    case 'r16': return 'Round of 16'
    case 'qf':  return 'Quarterfinals'
    case 'sf':  return 'Semifinals'
    case 'final': return 'Final'
  }
}
```

- [ ] **Step 4: Run tests, verify pass.** `pnpm test bracket` → PASS. Then `tsc --noEmit` → clean.

- [ ] **Step 5: Commit.** `git add lib/bracket.ts __tests__/bracket.test.ts && git commit -m "feat: add knockout_round-keyed bracket grouping helper"`

---

### Task 3: Rewire the public `BracketView` to use `groupByKnockoutRound`

**Context:** `components/BracketView.tsx:107-181` infers rounds via `matches.slice(...)`. Replace that inference with `groupByKnockoutRound`. Keep all existing JSX/styling (`BracketRound`, `BracketMatch`, the Champion cell). The champion is the winner of the `final` round group's single match.

**Files:**
- Modify: `components/BracketView.tsx:107-181`

- [ ] **Step 1: Replace the bucketing block.** Remove the `total`/`qf`/`sf`/`f` slice lines (112-114) and the `finalist`/`champion` derivation (116-122). Replace with:

```ts
import { groupByKnockoutRound, knockoutRoundLabel } from '@/lib/bracket'
// ...inside BracketView:
const rounds = groupByKnockoutRound(matches)
const finalGroup = rounds.find((r) => r.round === 'final')
const finalMatch = finalGroup?.matches[0]
const champion =
  finalMatch?.status === 'finished'
    ? finalMatch.home_score > finalMatch.away_score
      ? finalMatch.home_team.name
      : finalMatch.away_team.name
    : null
```

- [ ] **Step 2: Render rounds from the grouped data.** Replace the three hardcoded `<BracketRound>` lines (141-143) with:

```tsx
{rounds.map((r) => (
  <BracketRound
    key={r.round}
    label={knockoutRoundLabel(r.round)}
    matches={r.matches}
    slotCount={r.matches.length}
  />
))}
```

Keep the empty-state guard `if (matches.length === 0)` (124-130) and the Champion cell (145-178) unchanged.

- [ ] **Step 3: Verify.** `tsc --noEmit` → clean. `pnpm lint` → clean. If a `BracketView.stories.tsx` fixture lacks `knockout_round`, set realistic values (e.g. `'sf'`/`'final'`) so the story still renders rounds.

- [ ] **Step 4: Commit.** `git add components/BracketView.tsx && git commit -m "fix: render public bracket by knockout_round, not match-count slicing"`

---

### Task 4: Rewire `AdminBracketView` real-match rounds to use `groupByKnockoutRound`

**Context:** `components/admin/AdminBracketView.tsx` uses `bucketRounds` (line 50) + `isValidBracketCount` (line 67). The partial/placeholder machinery (lines 123-160) for future TBD rounds stays — only the *real-match* bucketing switches to `groupByKnockoutRound`. This makes "valid count" gating unnecessary for ordering real rounds.

**Files:**
- Modify: `components/admin/AdminBracketView.tsx` (replace `bucketRounds`, adjust `matchRounds`/`partialRounds` derivation)
- Reference for shape: lines 123-294 (rendering)

- [ ] **Step 1: Import the helper and replace `bucketRounds`.** At top, `import { groupByKnockoutRound } from '@/lib/bracket'`. Delete the local `bucketRounds` function (50-64). Replace its two call sites:

```ts
// was: const matchRounds = hasValidMatches ? bucketRounds(matches) : []
//      const partialRounds = hasPartialMatches ? bucketRounds(matches) : []
const realRounds = groupByKnockoutRound(matches).map((g) => g.matches)
const hasValidMatches = realRounds.length > 0 && /* full bracket: last round has exactly 1 match */ realRounds[realRounds.length - 1]?.length === 1 && isValidBracketCount(matches.length)
const matchRounds = hasValidMatches ? realRounds : []
const partialRounds = !hasValidMatches && matches.length > 0 ? realRounds : []
```

> Note for implementer: `hasValidMatches`/`hasPartialMatches` are currently defined at lines 123-127 BEFORE these. Reorder so `realRounds` is computed first, then derive the flags from it. Keep `hasPartialMatches = !hasValidMatches && matches.length > 0`. The `partialFutureRounds` TBD logic (134-143) and everything below stays as-is — it already keys off `partialRounds.length` and `bracketTeamCount`.

- [ ] **Step 2: Confirm round labels.** The rendering uses `roundLabel(slotCount)` (line 41) which maps by count. Leave it — with correct grouping, `qf`=4 slots→"Quarterfinals" etc. still holds for full brackets. (Do NOT spend time replacing it unless `tsc`/render breaks.)

- [ ] **Step 3: Verify.** `tsc --noEmit` → clean. `pnpm lint` → clean. `pnpm test` → all pass.

- [ ] **Step 4: Manual render sanity (describe, don't automate).** In the task report, state which scenarios you traced: (a) 8-team bracket, qf-only created → shows QF real + SF/Final TBD; (b) partial sf-only → shows SF real + Final TBD; (c) full final → shows single Final + champion.

- [ ] **Step 5: Commit.** `git add components/admin/AdminBracketView.tsx && git commit -m "fix: bucket admin bracket real rounds by knockout_round"`

---

### Task 5 (CONDITIONAL — only if Task 1 == A): Fix the KO create path

**Context:** Only runs if Task 1 finds KO matches are NOT persisting (classification A). The seed script is NOT the culprit (it creates only group matches). The fix targets `createManualKnockoutAction` / the DB CHECK constraint on `knockout_round`. Skip entirely if Task 1 == B or C.

**Files:**
- Investigate: `app/admin/tournaments/[id]/fixtures/actions.ts:308` (`createManualKnockoutAction`) — confirm the `knockout_round` value it sends matches the DB CHECK constraint's allowed set.
- Possibly: a new migration adding/relaxing the constraint, OR correcting `knockoutRoundLabel` output.

- [ ] **Step 1:** Reproduce the failed insert (from Task 1's constraint probe). Identify whether the rejected value is a casing/vocabulary mismatch vs the constraint.
- [ ] **Step 2:** Fix at the source — align the produced `knockout_round` with the constraint (or fix the constraint if it's wrong). Surface insert errors in `createManualKnockoutAction` so they're not silently swallowed.
- [ ] **Step 3: Commit** with a message describing the specific root cause found.

---

## Out of scope (separate effort — do NOT do here)
- Killing the `isGroupStageMatch` heuristic across the 4 page files (the broader phase single-source-of-truth refactor). Tracked separately.
- Splitting `MatchViews.tsx` (1560 lines).
- Removing duplicate `computeGroupStandings` / `toLocalDatetime`.
- Adding `phase`/`knockout_round` to repo migrations to end schema drift (worth doing, but a DB-migration task of its own).

## Self-review notes
- Round vocabulary is consistent across all tasks (`r32/r16/qf/sf/final`, lowercase).
- `groupByKnockoutRound` signature is identical in test (Task 2) and consumers (Tasks 3, 4).
- Task 1 is diagnostic-only and gates whether Task 5 runs — no fix is written on an unconfirmed cause.
