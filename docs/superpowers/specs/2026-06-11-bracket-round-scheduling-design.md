# Bracket Round Scheduling — Design Spec

**Date:** 2026-06-11
**Scope:** Admin > Tournament > Knockout tab — scheduling subsequent bracket rounds (SF, Final, etc.) after first-round results are in.

---

## Problem

`BracketSetupView` only creates first-round matches. After those matches finish, subsequent rounds (e.g. Semifinals, Final) remain as read-only "Winner of M1 vs M2" placeholders. There is no UI path to schedule them.

---

## What We're Building

A **bracket sub-stepper** inside the Knockout tab's bracket step. After the bracket is created, instead of showing a static `AdminBracketView`, the admin sees a round-by-round stepper:

```
[ ✓ Quarterfinals ] ──  [ → Semifinals ]  ──  [ Locked: Final ]
```

Each step corresponds to one bracket round. The active step shows a scheduling form for that round's matches; completed steps show as done (checkmark); future steps are locked until the previous round finishes.

---

## Data Model

No schema changes needed. Existing fields are sufficient:

- `matches.phase = 'knockout'`
- `matches.knockout_round` — values: `'r32'`, `'r16'`, `'qf'`, `'sf'`, `'final'`
- `matches.home_team_id / away_team_id` — set to actual winners when a round is scheduled
- `matches.status` — `'scheduled' | 'live' | 'halftime' | 'finished'`

The round ordering is fixed: `r32 → r16 → qf → sf → final`. The bracket starts at whatever `knockout_start_round` the tournament was configured with.

---

## Round Progression Logic

A round is **schedulable** when every match of the previous round has `status = 'finished'`.

Winners are derived deterministically: for each finished match, the winner is the team with the higher score (`home_score > away_score` → home wins; else away wins). Draws are left unresolved (the form will show a warning and block submission).

When the admin submits a round's schedule, the server action:
1. Reads the finished previous-round matches and derives winners in slot order (M1-winner, M2-winner, ...).
2. Creates new matches pairing winners: `(M1-winner vs M2-winner)`, `(M3-winner vs M4-winner)`, etc.
3. Assigns `phase = 'knockout'` and the correct `knockout_round` label for the new round.
4. Assigns `match_time` from the admin's date/time selection.

---

## UI — BracketRoundStepper

Replaces the direct `AdminBracketView` render in `KnockoutStepper` (the `bracketExists` branch).

### Step bar

Horizontal pill-style step bar (matches existing `KnockoutStepper` step bar style):

- One step per bracket round from `knockout_start_round` to `final`.
- Step status:
  - `done` — all matches in that round are `finished`
  - `current` — previous round done, this round not yet scheduled or scheduled-but-not-finished
  - `locked` — previous round not fully finished yet
- Clicking a `done` or `current` step navigates to it. `locked` steps are not clickable.

### Active step content

**If the round has no matches yet (needs scheduling):**

Shows `NextRoundSchedulerForm` — same layout as `BracketSetupView`'s match cards:
- Lists the N/2 upcoming matches
- Each match card shows:
  - Home slot: winner of previous match X (auto-filled, read-only team name + initials badge)
  - Away slot: winner of previous match Y (auto-filled, read-only)
  - Day picker + Time picker (same `select` controls as existing)
- "Schedule [Round Name]" button, enabled only when all matches have a time set
- If any previous match ended in a draw: show an inline warning "M# ended in a draw — resolve the score before scheduling the next round." Button stays disabled.

**If the round is already scheduled (matches exist, status = scheduled/live/finished):**

Shows the read-only `AdminBracketView` scoped to just that round's matches, same as today. The full bracket view (all rounds) is always visible below the step content as context.

### Full bracket view

`AdminBracketView` always renders below the sub-stepper (showing all rounds, placeholders for future ones). This is the same component used today — no changes to it.

---

## Server Action — `scheduleNextKnockoutRoundAction`

New action in `fixtures/actions.ts`:

```
scheduleNextKnockoutRoundAction(
  tournamentId: string,
  round: KnockoutRound,           // 'sf' | 'final' | etc.
  matchTimes: string[],           // ISO strings, one per match in slot order
) → { created: number } | { error: string }
```

Guards:
- Tournament must be `round_robin_knockout` format.
- Previous round must be fully finished (all matches `status = 'finished'`).
- No existing matches for this round yet (idempotency guard).
- No draws in previous round (returns error listing the match numbers).

Winner derivation is pure: sort previous-round matches by `created_at` ascending (insertion order = slot order), then pair winners sequentially.

---

## Component Tree Changes

```
KnockoutStepper
  bracketExists=false → (unchanged) QualifiersStep / BracketSetupView
  bracketExists=true  → BracketRoundStepper   ← NEW (replaces direct AdminBracketView)
    BracketRoundStepper
      step bar (round pills)
      active step:
        NextRoundSchedulerForm  (if round not yet scheduled)
        AdminBracketView scoped to round (if scheduled)
      AdminBracketView (full bracket, all rounds, always visible below)
```

`BracketRoundStepper` is a new client component at:
`web/app/admin/tournaments/[id]/knockout/BracketRoundStepper.tsx`

`NextRoundSchedulerForm` is a new client component in the same directory.

`scheduleNextKnockoutRoundAction` goes into the existing `fixtures/actions.ts`.

---

## Assumptions

- Draws are treated as blockers — the admin must first correct the score before scheduling the next round. No tie-breaker logic (penalties etc.) is modelled in the DB or UI.
- Bracket size is always a power of 2 (enforced by existing `isValidBracketCount`). No byes.
- The first bracket round's match slot order equals insertion order (already the case — `createManualKnockoutAction` inserts in pairing order).
- No changes to the public tournament view (`/t/[id]`) — it already uses `AdminBracketView` and will render new round matches automatically once created.
