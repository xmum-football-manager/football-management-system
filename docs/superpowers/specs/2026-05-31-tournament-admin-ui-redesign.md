# Tournament Admin UI Redesign — Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce cognitive load for tournament organisers by restructuring the admin nav from 8 flat tabs into 5 meaningful tabs with sub-steppers, and making the Overview tab the match-day command centre.

**Architecture:** Nav restructure + two new sub-stepper pages (Knockout) + Overview tab redesign. Groups sub-stepper already built. All existing route pages stay; only nav and new consolidated pages change.

**Tech Stack:** Next.js 15 App Router, Supabase, server actions, `useTransition` for optimistic updates, Tailwind + shadcn/ui.

---

## Current state (already done)

- `TournamentNav` updated: 8 flat tabs → 5 tabs (Overview · Teams · Groups · Knockout · Scorekeepers · Settings)
- Groups tab (`/groups`) built with sub-stepper: Draw → Fixtures
- Layout props simplified

---

## 1. Nav tab structure (final)

| Format | Tabs |
|--------|------|
| `round_robin` | Overview · Teams · Fixtures · Scorekeepers · Settings |
| `knockout` | Overview · Teams · Knockout · Scorekeepers · Settings |
| `round_robin_knockout` | Overview · Teams · Groups · Knockout · Scorekeepers · Settings |

Lock rules already computed in `layout.tsx`:
- **Groups tab**: locked when `rdFixturesLocked` (teams not ready)
- **Knockout tab**: locked when `koFixturesLocked` (group stage not all finished)
- **Teams tab**: `needsAttention` dot when teams are not player-ready

---

## 2. Knockout tab — `/knockout` page (new)

### Route
`app/admin/tournaments/[id]/knockout/page.tsx` — server component, only renders for `round_robin_knockout` (404 otherwise).

### Sub-stepper: Qualifiers → Bracket

**Step status logic:**
- Qualifiers: always accessible once the tab is unlocked. Done when `tournament.knockout_qualifiers` is non-empty.
- Bracket: locked until Qualifiers done. Done when knockout matches exist.
- Auto-open: if qualifiers saved → open Bracket, else open Qualifiers.

**Qualifiers step:**
- Loads all teams + their group-stage match results (points, GD).
- Auto-populates `advance_per_group` top teams per group by points (ties broken by GD, then alphabetical).
- Organiser can override by toggling teams.
- "Save qualifiers" calls existing `saveQualifiersAction`.
- Shows which slot each qualifier occupies (used for bracket seeding order).

**Bracket step:**
- Shows existing knockout matches from `FixturesPanel` (knockout phase only).
- If no bracket exists yet: shows "Seed bracket" button → calls existing `seedKnockoutBracketAction`.
- Bracket matches can be scheduled inline (same as group fixtures).

### Files
- `app/admin/tournaments/[id]/knockout/page.tsx` — server component (loads teams + matches + tournament)
- `app/admin/tournaments/[id]/knockout/KnockoutStepper.tsx` — client component with sub-stepper UI
- `app/admin/tournaments/[id]/knockout/QualifiersStep.tsx` — client component for team selection

---

## 3. Overview tab — match-day command centre

### Behaviour

**When no match is live:**
- Stats row: Teams · Matches · Played · Live now (0, greyed)
- "Up next" section: the next scheduled match by `match_time`, with a **Go live** button
- Full schedule below (existing `MatchViews`)

**When a match is live:**
- Stats row: "Live now" tile highlighted red (value = 1)
- **Live card** pinned between stats and schedule:
  - Red border, red "● LIVE" label (or amber "● HT" when status = `halftime`)
  - Team names with inline +/− score buttons (optimistic update via `updateMatchScore`)
  - Lifecycle buttons reuse the exact same pattern as `MatchRow` / `transitionMatchAction`:

| Current status | Buttons shown |
|---|---|
| `scheduled` | **Kickoff** (Play icon) |
| `live` | **Half time** (Pause) · **Full time** (CircleStop) |
| `halftime` | **2nd half** (FastForward) |

  - Each button opens the same confirmation `AlertDialog` before calling `transitionMatchAction`
  - `halftime_enabled` is checked when deciding whether to show the Half time button (consistent with existing behaviour)
  - Score +/− enabled in all `live` and `halftime` states
- "Up next" section shown below live card, but **Go live** button is disabled with tooltip "Finish current match first"
- Validation enforced server-side: `scheduleMatchAction` / go-live action checks no other match has status `live` or `halftime`

**When all matches finished:**
- Stats row normal, no live card, no "Up next"
- Full schedule shows all results

### Score entry: inline +/− 
- Each `+` tap calls `updateMatchScore(id, home+1, away)` (or away side).
- Optimistic: score updates immediately in UI, rolls back on error.
- No confirmation dialog — the `−` button corrects mistakes.

### Validation: 1 match live at a time
- **Client**: Kickoff button disabled + tooltip "Finish the current match first" when any match in `matches` prop has `status = 'live' | 'halftime'`.
- **Server**: add check to existing `transitionMatchAction` — before transitioning to `live`, verify no other match in the same tournament is already `live` or `halftime`. Returns `{ error: 'Another match is already live.' }` if so.

### Files to change
- `app/admin/tournaments/[id]/page.tsx` — add live card + "Up next" section above existing `MatchViews`; pass `halftime_enabled` and `isAdmin` as props
- New client component `app/admin/tournaments/[id]/MatchDayCard.tsx` — live card with +/− score buttons and lifecycle buttons (reuses `transitionMatchAction` pattern from `MatchRow`)
- `app/admin/tournaments/[id]/actions.ts` — add 1-live-at-a-time guard to `transitionMatchAction`'s `scheduled → live` path

---

## 4. Data requirements

### `goLiveAction` (new server action)
```ts
export async function goLiveAction(
  matchId: string,
  tournamentId: string,
): Promise<{ ok: true } | { error: string }>
```
- Checks auth (organiser or scorekeeper for this match)
- Checks no other match in the tournament is `live` or `halftime`
- Sets match status to `live`, sets `match_started_at = now()`
- Revalidates fixtures paths

### QualifiersStep data
Needs per-team group-stage stats: points (W=3, D=1, L=0), goal difference. Compute from existing matches client-side or add a DB helper. Computing client-side from match results is simpler and avoids a new query.

---

## 5. What is NOT in scope

- Real-time score sync (no Supabase realtime / polling) — organiser refreshes page after full-time
- Scorekeeper's separate view — scorekeepers use the same Overview tab via their own login
- Match timer / clock display
- Public-facing live scoreboard changes (already handled by existing public view)
