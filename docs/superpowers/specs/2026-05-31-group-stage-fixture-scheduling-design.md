# Group-Stage Fixture Scheduling Design

**Date:** 2026-05-31
**Scope:** `round_robin_knockout` format, RD-Fixtures tab only

## Problem

Group-stage fixtures cannot be created. The auto-generate-with-scheduling-dialog feature was removed. Organizers need a way to:
1. Generate all round-robin matchups per group in one click
2. Assign each match a day and time after the fact, via a visual day-slot UI

## Goal

Add a "Generate fixtures" button that creates all group-stage matchups with no time set, then provide a day-slot scheduling panel (similar in style to RD-Groups) where organizers assign each match to a day and time. The public view hides unscheduled matches.

---

## Schema Change

Make `match_time` nullable in the `matches` table:

```sql
ALTER TABLE matches ALTER COLUMN match_time DROP NOT NULL;
```

All existing rows are unaffected (they already have times). New fixture rows created by the generate action will have `match_time = NULL`.

**TypeScript:** Update `Match` and `MatchWithTeams` types so `match_time: string` becomes `match_time: string | null`.

---

## Generate Button

**Location:** RD-Fixtures page (`rd-fixtures/page.tsx` + a new `GenerateGroupFixturesButton` client component)

**Behaviour:**
- Shown only when `matches.length === 0` (no fixtures yet) and `readiness.canGenerateFixtures` (all groups full, all players ready — readiness check restored in `rd-fixtures/page.tsx` for this purpose only)
- On click: calls `generateGroupFixturesAction(tournamentId)` server action
- Action runs `generateRoundRobin` per group, inserts all matchups with `match_time = null` via `bulkAddMatchesAction`
- After generation, button disappears (matches now exist)
- Locked once any match has gone live (existing guard in `bulkAddMatchesAction`)

**No dialog** — single button click, no kickoff/slot config.

---

## Scheduling Panel (`FixtureSchedulerPanel`)

**Location:** Shown on RD-Fixtures page below the generate button, when fixtures exist.

**Layout** (mirrors RD-Groups column-card pattern):

### Unscheduled Pool (top card)
- Header: `Unscheduled (n)`
- One row per null-time match: `Group A: Team X vs Team Y` + `[Schedule]` button
- When `[Schedule]` is clicked, opens an inline form (or small popover) on that row

### Schedule Form (inline, per match)
Fields:
- **Day** — dropdown: `Day 1 (15 Jan)`, `Day 2 (16 Jan)`, … `Day N (end_date)`. Days derived from `tournament.start_date` to `tournament.end_date`.
- **Start time** — time input (HH:MM)
- **End time** — read-only, computed from start time:
  ```
  duration = 2 × minutes_per_half
            + (halftime_enabled ? halftime_minutes ?? 0 : 0)
  end_time = start_time + duration minutes
  ```
  Extra time is not included in the default display (it only applies if a match goes to ET).
- **Confirm** button — calls `scheduleMatchAction(matchId, isoDateTime)`, moves match to the correct day card

### Day Cards (below unscheduled pool)
- One card per tournament day: `Day 1 — Mon 15 Jan`, `Day 2 — Tue 16 Jan`, etc.
- Only days that have ≥1 scheduled match are shown (no empty day cards)
- Matches within each card sorted by start time, earliest first
- Each match row shows: `Group A: Team X vs Team Y · 09:00 – 10:30` + an Edit button (re-opens the schedule form to change day/time) + an Unschedule (×) button that sets `match_time = null` and returns it to the unscheduled pool

---

## New Server Action: `scheduleMatchAction`

```typescript
export async function scheduleMatchAction(
  matchId: string,
  tournamentId: string,
  matchTime: string | null,   // ISO datetime string, or null to unschedule
): Promise<{ ok: true } | { error: string }>
```

- Auth: `ensureOrganizer(tournamentId)`
- Validates that the date falls within `tournament.start_date – tournament.end_date` (when not null)
- Blocks if match status is not `scheduled` (can't reschedule a live/finished match)
- Updates `match_time` in DB
- Revalidates `/admin/tournaments/${tournamentId}/rd-fixtures` and `/t/${tournamentId}`

---

## Public View

`TournamentView` already maps matches for display. Add a filter:
```typescript
matches.filter(m => m.match_time !== null)
```
Null-time matches are completely hidden from the public tournament page.

---

## Scorekeeper Guard

In the "go live" action, add a check:
```typescript
if (!match.match_time) return { error: 'Set a match time before going live.' }
```

---

## Readiness Check (partial restore)

`rd-fixtures/page.tsx` restores the `checkTournamentReadiness` call **only** to gate the generate button visibility:
```typescript
const canGenerate = matches.length === 0 && readiness.canGenerateFixtures
```
No readiness banner is shown — the tab-level lock in `layout.tsx` already handles that.

---

## Out of Scope

- Drag-and-drop scheduling
- Bulk time assignment across multiple matches at once
- Extra time in end-time calculation (applied dynamically during match, not at scheduling)
- Pure `round_robin` or `knockout` format support (this spec is RD-Fixtures only)
