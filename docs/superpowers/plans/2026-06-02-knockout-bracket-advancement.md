# Knockout Bracket Advancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-create the entire knockout bracket (all rounds) at finalize time with explicit feeder-match edges, so later rounds render "Winner of {match}" and auto-fill with the correct winner — including admin-resolved draws — when feeder matches finish.

**Architecture:** Add nullable team-slot columns plus `home_source_match_id` / `away_source_match_id` / `winner_team_id` to `matches`. A pure skeleton-builder (`lib/bracket-skeleton.ts`) computes every round's matches and their feeder wiring from N round-1 pairings; `createManualKnockoutAction` inserts them in two passes (round 1, then later rounds wired to inserted ids). `advanceBracketIfReady` is rewritten to read `winner_team_id` and write it into whichever slot's `*_source_match_id` matches the finished match — no `created_at` pairing, no dedup. Draws are resolved by an explicit admin winner pick. Renderers fall back to "Winner of …" when a slot's team id is null.

**Tech Stack:** Next.js (App Router — see framework note), Supabase (Postgres), TypeScript, Vitest, pnpm.

> **FRAMEWORK NOTE (read before any framework API):** `web/AGENTS.md` warns this Next.js has breaking changes. Before using any App Router / Next API (server actions, `revalidatePath`, etc.), read the relevant guide under `web/node_modules/next/dist/docs/`. Do not assume API shapes from memory. This plan only *extends* existing server actions that already work, so no new framework APIs are introduced — but heed this if you deviate.

> **SCHEMA DRIFT NOTE:** `phase` and `knockout_round` already exist on the remote DB but are in **no repo migration**. The migration in Task 1 declares the three new columns and makes the two team-id columns nullable. It does **not** re-declare `phase`/`knockout_round` (they exist remotely); a comment records the drift. Keep the migration focused on what's needed.

> **COMMANDS:** All commands run from `web/`. Health checks: `pnpm test` (Vitest, `vitest run`), `tsc --noEmit`, `pnpm lint`.

---

## File Structure / File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `supabase/migrations/20260602000000_knockout_feeder_columns.sql` | Make team-id columns nullable; add `home_source_match_id`, `away_source_match_id`, `winner_team_id` |
| Modify | `web/lib/supabase/types.ts:58-73` | `Match`: team ids nullable + three new fields |
| Create | `web/lib/bracket-skeleton.ts` | Pure function: N round-1 pairings → full set of round descriptors with feeder edges + power-of-two guard |
| Create | `web/__tests__/bracket-skeleton.test.ts` | Tests for skeleton builder |
| Modify | `web/lib/db/matches.ts:33-58, 116-128` | `CreateMatchInput` + insert shape accept new columns; add `setMatchSlotTeam`, `setMatchWinner` |
| Modify | `web/app/admin/tournaments/[id]/fixtures/actions.ts:308-354` | `createManualKnockoutAction` builds + inserts full skeleton |
| Modify | `web/app/admin/tournaments/[id]/actions.ts:60-191` | Rewrite advancement: read `winner_team_id`, write to matching feeder slot; add `setMatchWinnerAction` |
| Modify | `web/lib/bracket.ts:42-62` | Delete `futureRoundsAfter`; add `feederMatchLabel` helper |
| Modify | `web/__tests__/bracket.test.ts:1-65` | Remove `futureRoundsAfter` tests |
| Modify | `web/components/BracketView.tsx:1-193` | Drop `futureRoundsAfter`; render null slots as "Winner of …" |
| Modify | `web/components/admin/AdminBracketView.tsx` | Render real later-round matches; null slots show "Winner of …" |
| Modify | `web/app/admin/tournaments/[id]/MatchRow.tsx` | Draw "Who advances?" picker before finishing a level KO match |
| Modify | `web/components/__fixtures__/index.ts:24-44` | Add new fields to mock matches |

---

## Task 1: Database migration — nullable team ids + feeder columns

**Files:**
- Create: `supabase/migrations/20260602000000_knockout_feeder_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Knockout bracket advancement: feeder-match edges + nullable team slots.
--
-- SCHEMA DRIFT: columns `phase` and `knockout_round` already exist on the
-- remote DB but were never captured in a repo migration. They are intentionally
-- NOT re-declared here to avoid "column already exists" failures. This migration
-- is focused only on the new advancement columns.

-- A bracket slot is empty until its feeder match resolves, so team ids are now nullable.
ALTER TABLE matches ALTER COLUMN home_team_id DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN away_team_id DROP NOT NULL;

-- Explicit feeder edges: this match's home/away slot = winner of the referenced match.
ALTER TABLE matches ADD COLUMN home_source_match_id uuid REFERENCES matches(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN away_source_match_id uuid REFERENCES matches(id) ON DELETE SET NULL;

-- Who advances from this match: auto from score, admin-set on a draw.
ALTER TABLE matches ADD COLUMN winner_team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Verify the migration is syntactically applied locally (if a local Supabase is available)**

Run: `cd /home/alex-lee/Desktop/football-manager && supabase db reset --no-seed 2>&1 | tail -20`
Expected: completes without SQL errors. If no local Supabase is running, skip this step and rely on review — note that in the commit message.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260602000000_knockout_feeder_columns.sql
git commit -m "feat: migration for knockout feeder columns and nullable team slots

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Update the `Match` type

**Files:**
- Modify: `web/lib/supabase/types.ts:58-73`

- [ ] **Step 1: Edit the `Match` interface**

Replace the `Match` interface (lines 58-73) with:

```typescript
export interface Match {
  id: string
  tournament_id: string
  home_team_id: string | null
  away_team_id: string | null
  match_time: string | null
  status: MatchStatus
  home_score: number
  away_score: number
  phase: MatchPhase
  knockout_round: string | null
  home_source_match_id: string | null
  away_source_match_id: string | null
  winner_team_id: string | null
  match_started_at: string | null
  match_finished_at: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Make the joined team objects nullable too**

`MatchWithTeams` (lines 98-101) types `home_team`/`away_team` as non-null `Team`, but a pre-created later-round match has NO team in a slot until its feeder resolves — so the joined object is null at runtime. Leaving the type non-null hides real null-deref crashes from tsc. Replace the interface:

```typescript
export interface MatchWithTeams extends Match {
  home_team: Team | null
  away_team: Team | null
}
```

- [ ] **Step 3: Typecheck to surface the ripple**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec tsc --noEmit 2>&1 | head -60`
Expected: FAIL — null-safety errors in readers that assume non-null team ids AND non-null `home_team`/`away_team` objects (e.g. `lib/qualifiers.ts`, `MatchRow.tsx`, `TournamentView.tsx`, `HeroLive`, fixtures, both bracket views). This is the ripple list; Task 9 enumerates and fixes each. Record the full file list.

- [ ] **Step 4: Commit**

```bash
git add web/lib/supabase/types.ts
git commit -m "feat: nullable team ids and feeder fields on Match type

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Bracket skeleton builder (pure, tested)

`MatchWithTeams` from `MatchWithTeams extends Match` now has nullable `home_team_id`. The builder is pure data — it does not touch the DB. It produces, for N round-1 pairings, descriptors for **every** round. Round 1 has concrete team ids; later rounds reference feeders by **index into the flat descriptor list** (resolved to real DB ids during insert in Task 5).

**Files:**
- Create: `web/lib/bracket-skeleton.ts`
- Test: `web/__tests__/bracket-skeleton.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { buildBracketSkeleton, POWER_OF_TWO_SIZES } from '@/lib/bracket-skeleton'

describe('buildBracketSkeleton', () => {
  it('rejects pairing counts that are not a power-of-two bracket size', () => {
    // 3 pairings = 6 teams, not in {2,4,8,16,32}
    expect(() => buildBracketSkeleton([
      { home_team_id: 'a', away_team_id: 'b', match_time: null },
      { home_team_id: 'c', away_team_id: 'd', match_time: null },
      { home_team_id: 'e', away_team_id: 'f', match_time: null },
    ])).toThrow(/power of two/i)
  })

  it('builds round 1 with concrete teams and no feeders for a 4-team bracket', () => {
    const out = buildBracketSkeleton([
      { home_team_id: 'a', away_team_id: 'b', match_time: '2026-06-02T12:00:00Z' },
      { home_team_id: 'c', away_team_id: 'd', match_time: '2026-06-02T13:00:00Z' },
    ])
    // 2 pairings => round1 (sf, 2 matches) + final (1 match) = 3 nodes
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({
      knockout_round: 'sf', home_team_id: 'a', away_team_id: 'b',
      match_time: '2026-06-02T12:00:00Z',
      home_source_index: null, away_source_index: null,
    })
    expect(out[1]).toMatchObject({ knockout_round: 'sf', home_team_id: 'c', away_team_id: 'd' })
  })

  it('wires the final to its two feeder semifinals by index', () => {
    const out = buildBracketSkeleton([
      { home_team_id: 'a', away_team_id: 'b', match_time: null },
      { home_team_id: 'c', away_team_id: 'd', match_time: null },
    ])
    const final = out[2]
    expect(final).toMatchObject({
      knockout_round: 'final',
      home_team_id: null, away_team_id: null,
      match_time: null,
      home_source_index: 0, away_source_index: 1,
    })
  })

  it('builds all rounds with correct labels for an 8-team bracket', () => {
    const pairings = ['ab', 'cd', 'ef', 'gh'].map((p) => ({
      home_team_id: p[0], away_team_id: p[1], match_time: null,
    }))
    const out = buildBracketSkeleton(pairings)
    // qf(4) + sf(2) + final(1) = 7 nodes
    expect(out.map((n) => n.knockout_round)).toEqual([
      'qf', 'qf', 'qf', 'qf', 'sf', 'sf', 'final',
    ])
    // sf[0] (index 4) is fed by qf[0] and qf[1]
    expect(out[4]).toMatchObject({ home_source_index: 0, away_source_index: 1 })
    // sf[1] (index 5) is fed by qf[2] and qf[3]
    expect(out[5]).toMatchObject({ home_source_index: 2, away_source_index: 3 })
    // final (index 6) is fed by the two sfs
    expect(out[6]).toMatchObject({ home_source_index: 4, away_source_index: 5 })
  })

  it('exposes the allowed bracket sizes', () => {
    expect(POWER_OF_TWO_SIZES).toEqual([2, 4, 8, 16, 32])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec vitest run __tests__/bracket-skeleton.test.ts`
Expected: FAIL — cannot resolve `@/lib/bracket-skeleton`.

- [ ] **Step 3: Write the implementation**

Create `web/lib/bracket-skeleton.ts`:

```typescript
import { KNOCKOUT_ROUND_ORDER, type KnockoutRound } from '@/lib/bracket'

/** Allowed first-round bracket sizes (number of teams entering round 1). */
export const POWER_OF_TWO_SIZES = [2, 4, 8, 16, 32] as const

export interface SkeletonPairing {
  home_team_id: string
  away_team_id: string
  match_time: string | null
}

export interface SkeletonNode {
  knockout_round: KnockoutRound
  home_team_id: string | null
  away_team_id: string | null
  match_time: string | null
  /** Index (into the returned node array) of the feeder match for the home slot, or null for round 1. */
  home_source_index: number | null
  away_source_index: number | null
}

/**
 * Given N round-1 pairings, build descriptors for EVERY round of the bracket.
 * Round 1 nodes carry concrete team ids; later-round nodes have null team ids
 * and reference their two feeder matches by index. Feeders are wired so that
 * matches 0,1 feed the first next-round match, 2,3 feed the second, etc.
 *
 * Round labels are assigned from the END of KNOCKOUT_ROUND_ORDER: the single
 * last round is always 'final', the round before it 'sf', etc.
 */
export function buildBracketSkeleton(pairings: SkeletonPairing[]): SkeletonNode[] {
  const teamCount = pairings.length * 2
  if (!POWER_OF_TWO_SIZES.includes(teamCount as (typeof POWER_OF_TWO_SIZES)[number])) {
    throw new Error(
      `Bracket size must be a power of two (${POWER_OF_TWO_SIZES.join(', ')} teams). Got ${teamCount}.`,
    )
  }

  // Number of rounds = log2(teamCount). Labels are the LAST `rounds` entries of
  // KNOCKOUT_ROUND_ORDER so the final round is always 'final'.
  const roundCount = Math.log2(teamCount)
  const roundLabels = KNOCKOUT_ROUND_ORDER.slice(KNOCKOUT_ROUND_ORDER.length - roundCount)

  const nodes: SkeletonNode[] = []
  // Track the node indices produced by the previous round, in order.
  let prevRoundIndices: number[] = []

  for (let r = 0; r < roundCount; r++) {
    const round = roundLabels[r]
    const matchesThisRound = pairings.length / 2 ** r
    const thisRoundIndices: number[] = []
    for (let i = 0; i < matchesThisRound; i++) {
      const node: SkeletonNode =
        r === 0
          ? {
              knockout_round: round,
              home_team_id: pairings[i].home_team_id,
              away_team_id: pairings[i].away_team_id,
              match_time: pairings[i].match_time,
              home_source_index: null,
              away_source_index: null,
            }
          : {
              knockout_round: round,
              home_team_id: null,
              away_team_id: null,
              match_time: null,
              home_source_index: prevRoundIndices[i * 2],
              away_source_index: prevRoundIndices[i * 2 + 1],
            }
      thisRoundIndices.push(nodes.length)
      nodes.push(node)
    }
    prevRoundIndices = thisRoundIndices
  }

  return nodes
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec vitest run __tests__/bracket-skeleton.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/bracket-skeleton.ts web/__tests__/bracket-skeleton.test.ts
git commit -m "feat: pure bracket skeleton builder with feeder edges and power-of-two guard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: DB layer — accept new columns, slot/winner writers

**Files:**
- Modify: `web/lib/db/matches.ts:33-58, 116-128`

- [ ] **Step 1: Extend `CreateMatchInput` and `createMatchAdmin` insert shape**

In `web/lib/db/matches.ts`, replace the `CreateMatchInput` interface (lines 33-40) with:

```typescript
export interface CreateMatchInput {
  tournament_id: string
  home_team_id: string | null
  away_team_id: string | null
  match_time: string | null
  phase?: string
  knockout_round?: string
  home_source_match_id?: string | null
  away_source_match_id?: string | null
}
```

- [ ] **Step 2: Update the `createMatchAdmin` insert to pass feeder columns**

Replace the `.insert({...})` object inside `createMatchAdmin` (lines 46-53) with:

```typescript
    .insert({
      tournament_id: input.tournament_id,
      home_team_id: input.home_team_id,
      away_team_id: input.away_team_id,
      match_time: input.match_time,
      ...(input.phase != null && { phase: input.phase }),
      ...(input.knockout_round != null && { knockout_round: input.knockout_round }),
      ...(input.home_source_match_id != null && { home_source_match_id: input.home_source_match_id }),
      ...(input.away_source_match_id != null && { away_source_match_id: input.away_source_match_id }),
    })
```

- [ ] **Step 3: Add `setMatchSlotTeam` and `setMatchWinner` writers**

Append to `web/lib/db/matches.ts` (after `updateMatchTeams`, before `deleteMatch`):

```typescript
/**
 * Fill one team slot (home or away) of a knockout match with a concrete team.
 * Uses the service client so auto-advance works regardless of the actor's RLS.
 */
export async function setMatchSlotTeam(
  id: string,
  slot: 'home' | 'away',
  teamId: string,
): Promise<{ error?: string }> {
  const supabase = createServiceClient()
  const patch = slot === 'home' ? { home_team_id: teamId } : { away_team_id: teamId }
  const { error } = await supabase.from('matches').update(patch).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

/** Record who advances from a match (auto from score or admin-picked on a draw). */
export async function setMatchWinner(
  id: string,
  winnerTeamId: string,
): Promise<{ error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('matches').update({ winner_team_id: winnerTeamId }).eq('id', id)
  if (error) return { error: error.message }
  return {}
}

/**
 * Wire a later-round match to the two matches whose winners feed its slots.
 * Service client so skeleton wiring matches the service-client inserts (no RLS
 * UPDATE policy assumption).
 */
export async function setMatchFeeders(
  id: string,
  homeSourceMatchId: string | null,
  awaySourceMatchId: string | null,
): Promise<{ error?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('matches')
    .update({ home_source_match_id: homeSourceMatchId, away_source_match_id: awaySourceMatchId })
    .eq('id', id)
  if (error) return { error: error.message }
  return {}
}
```

- [ ] **Step 4: Typecheck this file**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec tsc --noEmit 2>&1 | grep "lib/db/matches.ts" || echo "matches.ts clean"`
Expected: `matches.ts clean` (other files still error — fixed in later tasks).

- [ ] **Step 5: Commit**

```bash
git add web/lib/db/matches.ts
git commit -m "feat: db writers for feeder columns, slot fill, and match winner

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Generate the full skeleton in `createManualKnockoutAction`

Insert round 1 first (to get real DB ids), then insert later rounds wiring `*_source_match_id` to the inserted ids — using the `home_source_index` / `away_source_index` from the skeleton to map node-index → DB id.

**Files:**
- Modify: `web/app/admin/tournaments/[id]/fixtures/actions.ts:308-354`

- [ ] **Step 1: Import the skeleton builder**

At the top of `web/app/admin/tournaments/[id]/fixtures/actions.ts`, add to the imports (after the `generateRoundRobin` import on line 17):

```typescript
import { buildBracketSkeleton } from '@/lib/bracket-skeleton'
```

Also ensure `setMatchFeeders` (added in Task 4) is imported from `@/lib/db/matches` — extend the existing `createMatch`/`createMatchAdmin` import from that module to include `setMatchFeeders`.

- [ ] **Step 2: Rewrite the body of `createManualKnockoutAction`**

Replace the function body from `const round = knockoutRoundLabel(...)` through `return { created }` (lines 331-350) with:

```typescript
    // Build the FULL bracket (all rounds) from the round-1 pairings.
    let skeleton
    try {
      skeleton = buildBracketSkeleton(
        pairings.map((p) => ({
          home_team_id: p.home_team_id,
          away_team_id: p.away_team_id,
          match_time: p.match_time ?? null,
        })),
      )
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Invalid bracket size.' }
    }

    // Pass 1: insert every node, recording node-index -> created DB id.
    const nodeIdByIndex: (string | null)[] = skeleton.map(() => null)
    for (let i = 0; i < skeleton.length; i++) {
      const node = skeleton[i]
      const r = await createMatchAdmin({
        tournament_id: tournamentId,
        home_team_id: node.home_team_id,
        away_team_id: node.away_team_id,
        match_time: node.match_time,
        phase: 'knockout',
        knockout_round: node.knockout_round,
      })
      if ('error' in r) return { error: r.error }
      nodeIdByIndex[i] = r.id
    }

    // Pass 2: wire feeder edges for later-round nodes now that ids exist.
    // Service client (via setMatchFeeders) to match the service-client inserts.
    for (let i = 0; i < skeleton.length; i++) {
      const node = skeleton[i]
      if (node.home_source_index === null && node.away_source_index === null) continue
      const homeSrc = node.home_source_index === null ? null : nodeIdByIndex[node.home_source_index]
      const awaySrc = node.away_source_index === null ? null : nodeIdByIndex[node.away_source_index]
      const w = await setMatchFeeders(nodeIdByIndex[i]!, homeSrc, awaySrc)
      if (w.error) return { error: w.error }
    }

    const created = skeleton.length
    revalidatePath(`/admin/tournaments/${tournamentId}/fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}/ko-fixtures`)
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    revalidatePath(`/admin/tournaments/${tournamentId}/knockout`)
    revalidatePath(`/t/${tournamentId}`)
    return { created }
```

- [ ] **Step 3: Confirm `setMatchFeeders` is imported**

Run: `cd /home/alex-lee/Desktop/football-manager/web && grep -n "setMatchFeeders" app/admin/tournaments/[id]/fixtures/actions.ts || echo "MISSING - add to the @/lib/db/matches import"`
Expected: a matching import line (added in Step 1). If `MISSING`, add `setMatchFeeders` to the existing `@/lib/db/matches` import.

- [ ] **Step 4: Typecheck this file**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec tsc --noEmit 2>&1 | grep "fixtures/actions.ts" || echo "fixtures/actions.ts clean"`
Expected: `fixtures/actions.ts clean`.

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/[id]/fixtures/actions.ts
git commit -m "feat: createManualKnockoutAction generates full bracket skeleton with feeder edges

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Rewrite advancement — read winner, write feeder slot

`computeAutoWinner` is a pure helper (testable). `advanceBracketIfReady` becomes: ensure `winner_team_id` is set (auto from score; abort if a draw has no admin pick), then find the match referencing this one and fill its slot.

**Files:**
- Modify: `web/app/admin/tournaments/[id]/actions.ts:60-191`
- Test: `web/__tests__/advance.test.ts` (create)

- [ ] **Step 1: Write the failing test for the pure winner helper**

Create `web/__tests__/advance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeAutoWinner } from '@/app/admin/tournaments/[id]/advance'

describe('computeAutoWinner', () => {
  it('returns the home team when home outscores away', () => {
    expect(computeAutoWinner({ home_team_id: 'h', away_team_id: 'a', home_score: 2, away_score: 1 })).toBe('h')
  })
  it('returns the away team when away outscores home', () => {
    expect(computeAutoWinner({ home_team_id: 'h', away_team_id: 'a', home_score: 0, away_score: 3 })).toBe('a')
  })
  it('returns null on a draw (admin must pick)', () => {
    expect(computeAutoWinner({ home_team_id: 'h', away_team_id: 'a', home_score: 1, away_score: 1 })).toBeNull()
  })
  it('returns null when a team slot is unfilled', () => {
    expect(computeAutoWinner({ home_team_id: null, away_team_id: 'a', home_score: 0, away_score: 0 })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec vitest run __tests__/advance.test.ts`
Expected: FAIL — cannot resolve `@/app/admin/tournaments/[id]/advance`.

- [ ] **Step 3: Create the pure helper module**

Create `web/app/admin/tournaments/[id]/advance.ts`:

```typescript
/**
 * Pure winner derivation for a knockout match. Returns the winning team id, or
 * null when the score is level (admin must pick) or a slot is unfilled.
 */
export function computeAutoWinner(m: {
  home_team_id: string | null
  away_team_id: string | null
  home_score: number
  away_score: number
}): string | null {
  if (!m.home_team_id || !m.away_team_id) return null
  if (m.home_score > m.away_score) return m.home_team_id
  if (m.away_score > m.home_score) return m.away_team_id
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec vitest run __tests__/advance.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewrite `advanceBracketIfReady` and its call site**

In `web/app/admin/tournaments/[id]/actions.ts`:

(a) Add imports — extend the existing `@/lib/db/matches` import (line 6) to include `setMatchSlotTeam` and `setMatchWinner`, and add the helper import:

```typescript
import { createMatchAdmin, getMatch, updateMatchScore, updateMatchStatus, updateMatchTime, setMatchSlotTeam, setMatchWinner } from '@/lib/db/matches'
import { computeAutoWinner } from './advance'
```

(b) Replace the auto-advance call block (lines 59-62) with:

```typescript
    // Auto-advance knockout bracket: flow this match's winner into the match it feeds.
    if (next === 'finished' && match.phase === 'knockout') {
      await advanceBracketIfReady(matchId)
    }
```

(c) Delete `ROUND_ORDER`, `nextKnockoutRound`, and the entire old `advanceBracketIfReady` (lines 107-191) and replace with:

```typescript
/**
 * Flow a finished knockout match's winner into the slot that references it.
 * Reads `winner_team_id` (auto-derived from score here if unset; a level match
 * with no admin pick is left for the draw UI and does NOT advance). Then finds
 * the match whose home_source_match_id or away_source_match_id equals this id
 * and fills that slot. No created_at pairing, no dedup heuristic.
 */
async function advanceBracketIfReady(matchId: string) {
  try {
    const finished = await getMatch(matchId)
    if (!finished || finished.phase !== 'knockout') return

    // Resolve the winner: prefer an explicit (admin-picked) winner, else auto from score.
    let winnerId = finished.winner_team_id
    if (!winnerId) {
      winnerId = computeAutoWinner(finished)
      if (!winnerId) return // level score, no admin pick yet — draw UI handles it
      await setMatchWinner(matchId, winnerId)
    }

    const supabase = await createClient()
    const { data: dependents } = await supabase
      .from('matches')
      .select('id, home_source_match_id, away_source_match_id')
      .eq('tournament_id', finished.tournament_id)
      .or(`home_source_match_id.eq.${matchId},away_source_match_id.eq.${matchId}`)

    for (const dep of dependents ?? []) {
      const slot: 'home' | 'away' = dep.home_source_match_id === matchId ? 'home' : 'away'
      await setMatchSlotTeam(dep.id, slot, winnerId)
    }
  } catch {
    // Auto-advance is best-effort — never fail the transition.
  }
}
```

- [ ] **Step 6: Typecheck `actions.ts`**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec tsc --noEmit 2>&1 | grep "\[id\]/actions.ts" || echo "actions.ts clean"`
Expected: `actions.ts clean`.

- [ ] **Step 7: Commit**

```bash
git add web/app/admin/tournaments/[id]/actions.ts web/app/admin/tournaments/[id]/advance.ts web/__tests__/advance.test.ts
git commit -m "feat: rewrite knockout advancement to use feeder edges and explicit winner

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: `setMatchWinnerAction` + draw "Who advances?" picker

When finishing a level KO match, the admin must pick a winner. `MatchRow`'s "Full time" confirm dialog gains a winner radio when the score is level and the match is knockout. The action sets `winner_team_id` then triggers advancement by re-using `transitionMatchAction`'s finish path.

**Files:**
- Modify: `web/app/admin/tournaments/[id]/actions.ts` (add `setMatchWinnerAction`)
- Modify: `web/app/admin/tournaments/[id]/MatchRow.tsx`

- [ ] **Step 1: Add `setMatchWinnerAction` server action**

In `web/app/admin/tournaments/[id]/actions.ts`, after `updateScoreAction` (line 90), add:

```typescript
export async function setMatchWinnerAction(
  matchId: string,
  winnerTeamId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    const { match } = await ensureOrganizerOfMatch(matchId)
    if (match.phase !== 'knockout') return { error: 'Only knockout matches have a winner pick.' }
    if (winnerTeamId !== match.home_team_id && winnerTeamId !== match.away_team_id) {
      return { error: 'Winner must be one of the two teams.' }
    }
    const r = await setMatchWinner(matchId, winnerTeamId)
    if (r.error) return { error: r.error }
    // Now that a winner exists, flow it into the next round.
    if (match.status === 'finished') {
      await advanceBracketIfReady(matchId)
    }
    revalidatePath(`/admin/tournaments/${match.tournament_id}`)
    revalidatePath(`/admin/tournaments/${match.tournament_id}/ko-fixtures`)
    revalidatePath(`/t/${match.tournament_id}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
```

- [ ] **Step 2: Add the winner picker to the Full-time confirm in `MatchRow.tsx`**

In `web/app/admin/tournaments/[id]/MatchRow.tsx`:

(a) Extend the import on line 19:

```typescript
import { transitionMatchAction, setMatchWinnerAction } from './actions'
```

(b) Add state inside `MatchRow` (after `const [prompt, setPrompt] = useState<LifecycleAction | null>(null)` on line 91):

```typescript
  const [winnerPick, setWinnerPick] = useState<string | null>(null)
  const isLevelKo =
    match.phase === 'knockout' && match.home_score === match.away_score
```

(c) Replace the `commit` function (lines 99-110) with one that records the winner first when finishing a level KO match:

```typescript
  async function commit(action: LifecycleAction) {
    if (action.next === 'finished' && isLevelKo && !winnerPick) {
      toast.error('Pick who advances first.')
      return
    }
    setBusy(action.next)
    if (action.next === 'finished' && isLevelKo && winnerPick) {
      const w = await setMatchWinnerAction(match.id, winnerPick)
      if ('error' in w) {
        setBusy(null)
        toast.error(w.error)
        return
      }
    }
    const r = await transitionMatchAction(match.id, action.next, isAdmin)
    setBusy(null)
    setPrompt(null)
    setWinnerPick(null)
    if ('error' in r) {
      toast.error(r.error)
      return
    }
    toast.success(action.label + (action.next === 'finished' ? '.' : ' started.'))
    router.refresh()
  }
```

(d) Inside the `{prompt && (...)}` confirm dialog, add the picker after `{prompt.confirmDescription}` (the `</AlertDialogDescription>` is on line 257). Insert immediately before `</AlertDialogDescription>`:

```typescript
                {prompt.next === 'finished' && isLevelKo && (
                  <span className="mt-3 block">
                    <span className="mb-1.5 block text-foreground font-medium">
                      Scores are level — who advances?
                    </span>
                    <span className="flex flex-col gap-1.5">
                      {match.home_team_id && (
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="radio"
                            name="ko-winner"
                            checked={winnerPick === match.home_team_id}
                            onChange={() => setWinnerPick(match.home_team_id)}
                          />
                          {match.home_team?.name}
                        </label>
                      )}
                      {match.away_team_id && (
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="radio"
                            name="ko-winner"
                            checked={winnerPick === match.away_team_id}
                            onChange={() => setWinnerPick(match.away_team_id)}
                          />
                          {match.away_team?.name}
                        </label>
                      )}
                    </span>
                  </span>
                )}
```

- [ ] **Step 3: Typecheck both files**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec tsc --noEmit 2>&1 | grep -E "MatchRow.tsx|\[id\]/actions.ts" || echo "match views clean"`
Expected: `match views clean`.

- [ ] **Step 4: Lint the touched files**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm lint 2>&1 | tail -15`
Expected: no errors for `MatchRow.tsx` / `actions.ts` (pre-existing warnings elsewhere are fine).

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/[id]/actions.ts web/app/admin/tournaments/[id]/MatchRow.tsx
git commit -m "feat: admin draw resolution UI and setMatchWinnerAction for level KO matches

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Delete `futureRoundsAfter`; add `feederMatchLabel`

`feederMatchLabel` renders a feeder reference as "Winner of {round label} #{n}". The skeleton no longer needs fake future columns — rounds are real.

**Files:**
- Modify: `web/lib/bracket.ts:42-62`
- Modify: `web/__tests__/bracket.test.ts:1-65`

- [ ] **Step 1: Update the bracket test — remove `futureRoundsAfter`, add `feederMatchLabel`**

In `web/__tests__/bracket.test.ts`:

(a) Remove `futureRoundsAfter,` from the import (line 6) and add `feederMatchLabel,`.

(b) Delete the entire `describe('futureRoundsAfter', ...)` block (lines 43-62).

(c) Add this block (after the `KNOCKOUT_ROUND_ORDER` describe):

```typescript
describe('feederMatchLabel', () => {
  it('labels a feeder reference as "Winner of {round} #{n}"', () => {
    expect(feederMatchLabel('qf', 1)).toBe('Winner of Quarterfinals #1')
    expect(feederMatchLabel('sf', 2)).toBe('Winner of Semifinals #2')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec vitest run __tests__/bracket.test.ts`
Expected: FAIL — `feederMatchLabel` is not exported / `futureRoundsAfter` no longer imported.

- [ ] **Step 3: Edit `lib/bracket.ts` — delete `futureRoundsAfter`, add `feederMatchLabel`**

Delete the `futureRoundsAfter` function (lines 42-62). Add, after `knockoutRoundLabel`:

```typescript
/** Human label for an unresolved feeder slot, e.g. "Winner of Quarterfinals #1". */
export function feederMatchLabel(round: KnockoutRound, oneBasedIndex: number): string {
  return `Winner of ${knockoutRoundLabel(round)} #${oneBasedIndex}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec vitest run __tests__/bracket.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/bracket.ts web/__tests__/bracket.test.ts
git commit -m "refactor: drop futureRoundsAfter, add feederMatchLabel for unresolved slots

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Null-team-id ripple — enumerate and fix every reader

After Task 2 the team-id columns are nullable. **Group-stage paths must stay unchanged**; only knockout rendering tolerates null. Enumerate every reader and handle null explicitly.

Two kinds of null now exist: the team-id **string** (`home_team_id`) and the joined team **object** (`home_team`, made nullable in Task 2). The object derefs (`match.home_team.name`) are the dangerous ones — they crash at runtime on any scheduled later-round KO match. Enumerate BOTH.

**Files (each verified by the greps below):**
- `web/lib/qualifiers.ts:18-19, 37-38` — group-only; tighten the param type, no behaviour change
- `web/app/t/[id]/TournamentView.tsx:535` — group filter; null ids can't match a group team set
- `web/components/__fixtures__/index.ts:24-44` — add new fields to mocks
- Every `match.home_team.X` / `match.away_team.X` object access that can render a KO match — guard with `match.home_team_id ? match.home_team!.name : <fallback>` (group matches always have a team, so the guard is a no-op there). Confirm the exact set via the second grep; known candidates: `MatchRow.tsx`, `TournamentView.tsx`, `HeroLive.tsx`, `app/score/ScoreApp.tsx`. The two bracket views are fixed in Tasks 10-11.

- [ ] **Step 1: Re-run the ripple grep to confirm the id-reader set**

Run: `cd /home/alex-lee/Desktop/football-manager/web && grep -rn "\.home_team_id\|\.away_team_id\|home_team_id:\|away_team_id:" --include="*.ts" --include="*.tsx" lib app components | grep -v node_modules`
Expected: lists the id readers above. If a new one appears, handle it in this task.

- [ ] **Step 1b: Grep the joined-object accesses (the crash risk)**

Run: `cd /home/alex-lee/Desktop/football-manager/web && grep -rn "\.home_team\.\|\.away_team\." --include="*.ts" --include="*.tsx" lib app components | grep -v node_modules`
Expected: every site that reads a property off the joined team. For each one that can receive a KO match, add the `match.home_team_id ? … : <fallback>` guard. Let tsc (Task 2 Step 3 errors) be the checklist — every reported `home_team`/`away_team` "possibly null" error must be resolved here or in Tasks 10-11.

- [ ] **Step 2: Tighten `computeGroupStandings` param type (group-only, no behaviour change)**

In `web/lib/qualifiers.ts`, the `matches` param (lines 16-22) keeps `home_team_id: string` / `away_team_id: string`. Group matches always have concrete ids, so leave the **runtime** logic untouched. To satisfy the now-nullable `Match`, callers pass group matches; confirm no caller passes a raw `Match[]` that would type-error:

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec tsc --noEmit 2>&1 | grep qualifiers || echo "qualifiers ok"`
Expected: `qualifiers ok`. If it errors, change the param types to `string | null` and add `if (!m.home_team_id || !m.away_team_id) continue` at the top of the match loop (line 36) — group matches are never null so this is a no-op guard.

- [ ] **Step 3: Guard the group filter in `TournamentView.tsx`**

The filter at line 535 is `teamIds.has(m.home_team_id) && teamIds.has(m.away_team_id)`. `Set<string>.has(null)` is a type error now. Replace it with:

```typescript
          (m) =>
            !!m.home_team_id && !!m.away_team_id &&
            teamIds.has(m.home_team_id) && teamIds.has(m.away_team_id),
```

- [ ] **Step 4: Add new fields to the mock matches**

In `web/components/__fixtures__/index.ts`, in `mockMatchLive` (after `knockout_round: null,` on line 36) add:

```typescript
  home_source_match_id: null,
  away_source_match_id: null,
  winner_team_id: null,
```

(`mockMatchScheduled` and others spread `mockMatchLive`, so they inherit these.)

- [ ] **Step 5: Typecheck the whole project**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec tsc --noEmit 2>&1 | grep -v "BracketView.tsx\|AdminBracketView.tsx" | grep "error" || echo "only bracket renderers remain"`
Expected: `only bracket renderers remain` (those are fixed in Tasks 10-11). If other files error, fix them here following the same null-guard pattern (group paths skip null; never invent behaviour).

- [ ] **Step 6: Commit**

```bash
git add web/lib/qualifiers.ts web/app/t/[id]/TournamentView.tsx web/components/__fixtures__/index.ts
git commit -m "fix: handle nullable team ids in group-stage readers and fixtures

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Public `BracketView` — render real rounds + "Winner of …" slots

Remove `futureRoundsAfter`; render every real round from `groupByKnockoutRound`. A slot with a null team renders its feeder label.

**Files:**
- Modify: `web/components/BracketView.tsx:1-193`

- [ ] **Step 1: Update imports**

Replace line 3:

```typescript
import { groupByKnockoutRound, knockoutRoundLabel, feederMatchLabel, KNOCKOUT_ROUND_ORDER, type KnockoutRound } from '@/lib/bracket'
```

- [ ] **Step 2: Make `BracketTeamRow` accept an optional `label` for unresolved slots**

In `BracketTeamRow` (lines 9-48), the `tbd` branch already renders italic "TBD". Add a `label?: string` prop and render it when present. Replace the props destructure (line 9) and the name `<span>` (lines 31-38):

```typescript
function BracketTeamRow({ name, score, winner, loser, tbd, label }: {
  name: string
  score: number | null
  winner: boolean
  loser: boolean
  tbd?: boolean
  label?: string
}) {
```

and the text span body (line 37) from `{tbd ? 'TBD' : name}` to:

```typescript
        {label ?? (tbd ? 'TBD' : name)}
```

- [ ] **Step 3: Resolve feeder labels per match and pass them to slots**

Replace the `BracketMatch` component (lines 50-89) with a version that accepts feeder labels and renders an unresolved slot when a team is missing:

```typescript
function BracketMatch({
  match,
  homeLabel,
  awayLabel,
}: {
  match: MatchWithTeams | null
  homeLabel?: string
  awayLabel?: string
}) {
  if (!match) {
    return (
      <div style={{
        background: 'var(--ink-900)', border: '1px dashed var(--ink-700)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
      }}>
        <BracketTeamRow name="TBD" score={null} winner={false} loser={false} tbd />
        <BracketTeamRow name="TBD" score={null} winner={false} loser={false} tbd />
      </div>
    )
  }

  const isLive     = match.status === 'live'
  const isFinished = match.status === 'finished'
  const homeWon    = isFinished && match.home_score > match.away_score
  const awayWon    = isFinished && match.away_score > match.home_score
  const homeResolved = !!match.home_team_id
  const awayResolved = !!match.away_team_id

  return (
    <div style={{
      background: 'var(--ink-900)',
      border: `1px solid ${isLive ? 'rgba(220,38,38,0.5)' : 'var(--ink-700)'}`,
      borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative',
      transition: 'transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
    }}>
      {isLive && (
        <span style={{
          position: 'absolute', top: -8, right: 8,
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 9,
          background: 'var(--red-card)', color: '#fff',
          padding: '2px 8px', borderRadius: 999, letterSpacing: '0.1em',
        }}>LIVE</span>
      )}
      <div style={{ borderBottom: '1px solid var(--ink-700)' }}>
        <BracketTeamRow
          name={homeResolved ? match.home_team!.name : ''}
          score={match.status === 'scheduled' || !homeResolved ? null : match.home_score}
          winner={homeWon} loser={awayWon}
          tbd={!homeResolved}
          label={homeResolved ? undefined : homeLabel ?? 'TBD'}
        />
      </div>
      <BracketTeamRow
        name={awayResolved ? match.away_team!.name : ''}
        score={match.status === 'scheduled' || !awayResolved ? null : match.away_score}
        winner={awayWon} loser={homeWon}
        tbd={!awayResolved}
        label={awayResolved ? undefined : awayLabel ?? 'TBD'}
      />
    </div>
  )
}
```

- [ ] **Step 4: Replace `futureRoundsAfter` usage with real rounds + a feeder-label lookup**

Replace the `BracketView` body's round assembly (lines 108-128) with:

```typescript
export function BracketView({ matches }: BracketViewProps) {
  const rounds = groupByKnockoutRound(matches)
  const finalMatch = rounds.find((r) => r.round === 'final')?.matches[0]
  const champion =
    finalMatch?.status === 'finished'
      ? finalMatch.home_score > finalMatch.away_score
        ? finalMatch.home_team?.name ?? null
        : finalMatch.away_team?.name ?? null
      : null

  // Index every match by id so a feeder reference resolves to "Winner of {round} #n".
  const byId = new Map(matches.map((m) => [m.id, m]))
  const positionInRound = new Map<string, { round: KnockoutRound; idx: number }>()
  for (const r of rounds) {
    r.matches.forEach((m, i) => positionInRound.set(m.id, { round: r.round, idx: i }))
  }
  function labelFor(sourceMatchId: string | null): string | undefined {
    if (!sourceMatchId) return undefined
    const pos = positionInRound.get(sourceMatchId)
    if (!pos) return undefined
    return feederMatchLabel(pos.round, pos.idx + 1)
  }

  const displayRounds = rounds.map((r) => ({ round: r.round, matches: r.matches }))
```

Then update the render of each round so `BracketMatch` receives feeder labels. Replace `BracketRound` (lines 91-106) so it forwards a label resolver:

```typescript
function BracketRound({
  label,
  matches,
  slotCount,
  labelFor,
}: {
  label: string
  matches: (MatchWithTeams | null)[]
  slotCount: number
  labelFor: (id: string | null) => string | undefined
}) {
  const slots = Array.from({ length: slotCount }, (_, i) => matches[i] ?? null)
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'space-around', gap: 20, position: 'relative',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-400)',
        textAlign: 'center', marginBottom: 12,
      }}>{label}</div>
      {slots.map((m, i) => (
        <BracketMatch
          key={i}
          match={m}
          homeLabel={m ? labelFor(m.home_source_match_id) : undefined}
          awayLabel={m ? labelFor(m.away_source_match_id) : undefined}
        />
      ))}
    </div>
  )
}
```

And update the `displayRounds.map(...)` JSX (line 147) to pass `labelFor`:

```typescript
        {displayRounds.map((r) => (
          <BracketRound
            key={r.round}
            label={knockoutRoundLabel(r.round)}
            matches={r.matches}
            slotCount={r.matches.length}
            labelFor={labelFor}
          />
        ))}
```

- [ ] **Step 5: Typecheck**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec tsc --noEmit 2>&1 | grep "BracketView.tsx" || echo "BracketView clean"`
Expected: `BracketView clean`.

- [ ] **Step 6: Commit**

```bash
git add web/components/BracketView.tsx
git commit -m "feat: public BracketView renders real later rounds with Winner-of feeder slots

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: `AdminBracketView` — render real later rounds + "Winner of …" slots

The admin view currently treats a partial bracket as needing fake future columns. Now every round is a real match. Render all real rounds; a match with a null team slot shows its feeder label instead of the (null) team name.

**Files:**
- Modify: `web/components/admin/AdminBracketView.tsx`

- [ ] **Step 1: Import feeder helpers**

Replace line 6:

```typescript
import { groupByKnockoutRound, countStrayKnockoutMatches, feederMatchLabel, type KnockoutRound } from '@/lib/bracket'
```

- [ ] **Step 2: Build a feeder-label resolver and drop the partial-future-rounds logic**

In `AdminBracketView`, after `const realRounds = groupByKnockoutRound(matches)...` (line 102), add a position index and resolver, mirroring Task 10:

```typescript
  const groupedRounds = groupByKnockoutRound(matches)
  const positionInRound = new Map<string, { round: KnockoutRound; idx: number }>()
  for (const r of groupedRounds) {
    r.matches.forEach((m, i) => positionInRound.set(m.id, { round: r.round, idx: i }))
  }
  const feederLabelFor = (sourceMatchId: string | null): string | undefined => {
    if (!sourceMatchId) return undefined
    const pos = positionInRound.get(sourceMatchId)
    return pos ? feederMatchLabel(pos.round, pos.idx + 1) : undefined
  }
```

Because the bracket is now created whole, `hasValidMatches` (a single final match present) is the normal case. Delete the `partialFutureRounds` construction (lines 115-125) and replace its later usages so partial real rounds render directly (no fake TBD columns). Concretely, in the render branch (lines 226-273) keep the `hasValidMatches` branch, and change the `hasPartialMatches` branch to render `partialRounds` **without** appending `partialFutureRounds`:

```typescript
            {hasValidMatches
              ? matchRounds.map((round, i) => (
                  <BracketColumn
                    key={i}
                    label={roundLabel(round.length)}
                    matches={round}
                    placeholders={null}
                    columnHeight={effectiveColumnHeight}
                    isFinal={i === matchRounds.length - 1}
                    onMatchClick={onMatchClick}
                    feederLabelFor={feederLabelFor}
                  />
                ))
              : hasPartialMatches
                ? partialRounds.map((round, i) => (
                    <BracketColumn
                      key={`real-${i}`}
                      label={roundLabel(round.length)}
                      matches={round}
                      placeholders={null}
                      columnHeight={effectiveColumnHeight}
                      isFinal={false}
                      onMatchClick={onMatchClick}
                      feederLabelFor={feederLabelFor}
                    />
                  ))
                : placeholderRounds.map((round, i) => (
                    <BracketColumn
                      key={i}
                      label={roundLabel(round.length)}
                      matches={null}
                      placeholders={round}
                      columnHeight={effectiveColumnHeight}
                      isFinal={i === placeholderRounds.length - 1}
                      onMatchClick={undefined}
                      feederLabelFor={feederLabelFor}
                    />
                  ))}
```

Update the `totalRounds` calculation (lines 127-131) so the partial branch no longer adds `partialFutureRounds.length`:

```typescript
  const totalRounds = hasValidMatches
    ? matchRounds.length
    : hasPartialMatches
      ? partialRounds.length
      : placeholderRounds.length
```

And in the `ChampionColumn` `hasFinal` prop (line 279), remove the `|| partialFutureRounds.length > 0` term:

```typescript
                hasFinal={!!finalMatch || placeholderRounds.length > 0}
```

- [ ] **Step 3: Thread `feederLabelFor` through `BracketColumn` → `BracketMatch` and render feeder labels**

Add `feederLabelFor` to `BracketColumn`'s props (line 448-462) and pass it to each `BracketMatch`:

```typescript
function BracketColumn({
  label,
  matches,
  placeholders,
  columnHeight,
  isFinal,
  onMatchClick,
  feederLabelFor,
}: {
  label: string
  matches: MatchWithTeams[] | null
  placeholders: PlaceholderSlot[] | null
  columnHeight: number
  isFinal: boolean
  onMatchClick?: (m: MatchWithTeams) => void
  feederLabelFor: (id: string | null) => string | undefined
}) {
```

and the `matches.map` (line 479) becomes:

```typescript
          ? matches.map((m) => (
              <BracketMatch
                key={m.id}
                match={m}
                isFinal={isFinal}
                onMatchClick={onMatchClick}
                homeLabel={feederLabelFor(m.home_source_match_id)}
                awayLabel={feederLabelFor(m.away_source_match_id)}
              />
            ))
```

In `BracketMatch` (lines 561-610), add `homeLabel` / `awayLabel` props and render the feeder label when a team slot is null. Replace the props (lines 561-569):

```typescript
function BracketMatch({
  match,
  isFinal,
  onMatchClick,
  homeLabel,
  awayLabel,
}: {
  match: MatchWithTeams
  isFinal: boolean
  onMatchClick?: (m: MatchWithTeams) => void
  homeLabel?: string
  awayLabel?: string
}) {
```

and the two `BracketTeamRow` usages (lines 595-606) to pass a label override:

```typescript
      <BracketTeamRow
        name={match.home_team_id ? (match.home_team?.name ?? '') : (homeLabel ?? 'TBD')}
        score={match.status === 'scheduled' || !match.home_team_id ? null : match.home_score}
        winner={homeWon}
        loser={awayWon}
        unresolved={!match.home_team_id}
      />
      <div style={{ height: 1, background: 'var(--admin-rule)' }} />
      <BracketTeamRow
        name={match.away_team_id ? (match.away_team?.name ?? '') : (awayLabel ?? 'TBD')}
        score={match.status === 'scheduled' || !match.away_team_id ? null : match.away_score}
        winner={awayWon}
        loser={homeWon}
        unresolved={!match.away_team_id}
      />
```

- [ ] **Step 4: Add the `unresolved` style to `BracketTeamRow`**

In `BracketTeamRow` (lines 666-720), add an `unresolved?: boolean` prop that italicises the name and shows `?` initials. Replace the props (lines 666-676):

```typescript
function BracketTeamRow({
  name,
  score,
  winner,
  loser,
  unresolved,
}: {
  name: string
  score: number | null
  winner: boolean
  loser: boolean
  unresolved?: boolean
}) {
```

and the initials span body (line 693) from `{teamInitials(name)}` to `{unresolved ? '?' : teamInitials(name)}`, and add `fontStyle: unresolved ? 'italic' : 'normal'` to the name span style object (the `<span className="truncate text-sm">` style at lines 696-700):

```typescript
        style={{
          fontWeight: winner ? 800 : 600,
          fontStyle: unresolved ? 'italic' : 'normal',
          color: loser || unresolved ? 'var(--muted-foreground)' : 'var(--foreground)',
        }}
```

- [ ] **Step 5: Typecheck and lint**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec tsc --noEmit 2>&1 | grep "AdminBracketView.tsx" || echo "AdminBracketView clean"`
Expected: `AdminBracketView clean`.

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec tsc --noEmit 2>&1 | grep error || echo "FULL TYPECHECK CLEAN"`
Expected: `FULL TYPECHECK CLEAN`.

- [ ] **Step 6: Commit**

```bash
git add web/components/admin/AdminBracketView.tsx
git commit -m "feat: AdminBracketView renders real later rounds with Winner-of feeder slots

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Power-of-two guard on the setup path + full suite green

The skeleton builder already rejects bad sizes (Task 3). `BracketSetupView` derives `matchCount = floor(qualifiedTeams.length / 2)`; surface a clear pre-submit guard so the admin can't open the builder with a non-power-of-two count.

**Files:**
- Modify: `web/app/admin/tournaments/[id]/knockout/BracketSetupView.tsx`

- [ ] **Step 1: Add the guard import and check**

In `web/app/admin/tournaments/[id]/knockout/BracketSetupView.tsx`, add the import (after line 17):

```typescript
import { POWER_OF_TWO_SIZES } from '@/lib/bracket-skeleton'
```

After `const matchCount = Math.floor(qualifiedTeams.length / 2)` (line 57), add:

```typescript
  const sizeOk = POWER_OF_TWO_SIZES.includes(
    qualifiedTeams.length as (typeof POWER_OF_TWO_SIZES)[number],
  )
```

- [ ] **Step 2: Render an early guard panel when the size is invalid**

Immediately inside the component's returned JSX, before the existing `<div className="space-y-4">` (line 110), add a guarded early return:

```typescript
  if (!sizeOk) {
    return (
      <div
        className="rounded-xl border bg-card p-6 text-sm"
        style={{ borderColor: 'var(--admin-rule)' }}
      >
        <p className="font-medium text-foreground">Bracket size must be a power of two.</p>
        <p className="mt-1 text-muted-foreground">
          You have {qualifiedTeams.length} qualified team{qualifiedTeams.length === 1 ? '' : 's'}.
          Adjust qualifiers so the count is one of {POWER_OF_TWO_SIZES.join(', ')}.
        </p>
      </div>
    )
  }
```

- [ ] **Step 3: Typecheck**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm exec tsc --noEmit 2>&1 | grep "BracketSetupView.tsx" || echo "BracketSetupView clean"`
Expected: `BracketSetupView clean`.

- [ ] **Step 4: Run the FULL test suite**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm test`
Expected: PASS — including `bracket-skeleton.test.ts`, `advance.test.ts`, and the updated `bracket.test.ts`.

- [ ] **Step 5: Run lint**

Run: `cd /home/alex-lee/Desktop/football-manager/web && pnpm lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add web/app/admin/tournaments/[id]/knockout/BracketSetupView.tsx
git commit -m "feat: power-of-two guard on manual bracket setup path

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §1 nullable team ids + 3 feeder columns + drift note | Task 1 (migration), Task 2 (type) |
| §2 skeleton generation, all rounds, explicit feeders, power-of-two guard | Task 3 (builder + guard), Task 5 (insert) |
| §3 rewrite advancement: read `winner_team_id`, write feeder slot, no created_at/dedup/draw-stall | Task 6 |
| §4 rendering "Winner of A", delete `futureRoundsAfter` | Task 8 (delete + label), Task 10 (public), Task 11 (admin) |
| §5 draw "Who advances?" UI | Task 7 |
| §6 power-of-two on setup path, no new fields | Task 12 |
| Ripple enumeration (nullable team ids) | Task 9 |

All six design sections plus the explicitly-required ripple task are covered. No spec requirement is left without a task.

**2. Placeholder scan** — No "TBD/TODO/similar to Task N/add validation" in any code step; every code step shows complete code. The only literal "TBD" strings are intentional UI fallback text. Fixed during writing.

**3. Type consistency** — Cross-checked names across tasks: `buildBracketSkeleton`/`SkeletonNode.home_source_index`/`POWER_OF_TWO_SIZES` (Task 3) are consumed unchanged in Tasks 5 and 12. `setMatchSlotTeam`/`setMatchWinner` (Task 4) are imported with identical signatures in Tasks 6-7. `computeAutoWinner` (Task 6) matches its test. `feederMatchLabel(round, oneBasedIndex)` (Task 8) is called with `pos.idx + 1` in Tasks 10-11. `advanceBracketIfReady(matchId)` single-arg signature is consistent between its definition (Task 6) and the new call in `setMatchWinnerAction` (Task 7).

**Issues found & fixed during review:**
- Initially Task 6 left `advanceBracketIfReady` taking a match object; corrected to single `matchId` arg and a fresh `getMatch` read so `setMatchWinnerAction` (Task 7) can reuse it after the score is already finished.
- Task 11 originally kept `partialFutureRounds`; removed it and its three usages (`totalRounds`, render branch, `ChampionColumn.hasFinal`) so no fake columns remain, satisfying §4's deletion requirement.
- Added the `createClient` import-existence check (Task 5 Step 3) since the feeder-wiring pass needs it and the file may not already import it.
