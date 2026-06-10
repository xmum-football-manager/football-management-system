# Scorekeeper Match Timer & Schedule Context — Design

Date: 2026-06-10

## Goal

Give the scorekeeper richer time context on the score screen:

1. **Live match timer** — counts up from kickoff in `m:ss` (e.g. `9:01` = 9 min 1 s
   elapsed). Counts continuously through both halves and **pauses during halftime**.
2. **Tournament day** — `Day N of M (June 15)` derived from tournament dates and the
   match's scheduled day.
3. **Match time range** — `16:00 – 17:00`, scheduled start → computed expected end.

## Data gap & migration

`matches` has `match_started_at` and `match_finished_at` but no record of the
halftime break, so a naive `now − match_started_at` would keep counting through
halftime. Add two nullable columns:

- `halftime_started_at timestamptz` — set on `live → halftime`
- `second_half_started_at timestamptz` — set on `halftime → live` (resume)

Migration file: `supabase/migrations/20260610000000_match_halftime_timestamps.sql`
(both columns `null` default; mirror existing nullable timestamp columns).

## Components

### `lib/db/matches.ts` — `updateMatchStatus`
Extend the existing patch logic (which already sets `match_started_at` on first
`live` and `match_finished_at` on `finished`):
- `next === 'halftime'` and no existing `halftime_started_at` → set it to now.
- `next === 'live'` and existing `halftime_started_at` and no
  `second_half_started_at` → set `second_half_started_at` to now.

### `lib/format.ts` — `matchElapsedSeconds(match, now)` + `formatElapsed(seconds)`
Pure functions. Elapsed logic:
```
if !match_started_at: return 0
if !halftime_started_at:            // first half, live
    return now − match_started_at
firstHalf = halftime_started_at − match_started_at
if !second_half_started_at:         // at halftime, frozen
    return firstHalf
return firstHalf + (now − second_half_started_at)   // second half, live
```
`formatElapsed` → `m:ss` (minutes uncapped, e.g. `9:01`, `63:12`), seconds
zero-padded.

Helpers for context (can live in `lib/format.ts`):
- `tournamentDayLabel(tournament, matchTime)` → `Day N of M (June 15)`.
  M = inclusive day count between `start_date` and `end_date`. N = 1-based day
  index of the match's local date relative to `start_date`. Date label =
  `toLocaleDateString('en-US', { month: 'long', day: 'numeric' })`.
- `expectedMatchRange(tournament, matchTime)` → `16:00 – 17:00`.
  end = start + `2 × minutes_per_half` + (`halftime_enabled` ?
  `halftime_minutes ?? 0` : 0) minutes. Times via `formatClock` (24h).

### `app/score/page.tsx` + `ScoreApp.tsx`
- Both Supabase selects add `tournament:tournaments(*)`.
- Extend `MatchWithTeams` to include `tournament: Tournament` (and the two new
  match columns flow through `Match`).
- `ScoreCard`: add a `setInterval(1000)` tick (cleared on unmount) driving a
  `now` state, used only to recompute the live clock. The timer renders only when
  `match_started_at` is set; it visibly freezes at halftime because the elapsed
  helper returns the frozen value.
- Render in the status block (near the LIVE / HALF TIME label): the `m:ss` timer
  (when started), the `Day N of M (June 15)` line, and the `16:00 – 17:00` range.

### `lib/supabase/types.ts`
- Add `halftime_started_at: string | null` and `second_half_started_at: string | null`
  to `Match`.
- Extend `MatchWithTeams` with `tournament: Tournament`.

## Testing
- Unit tests (vitest) for `matchElapsedSeconds` (four states), `formatElapsed`,
  `tournamentDayLabel`, `expectedMatchRange`.
- `tsc --noEmit` + `pnpm lint` clean.

## Out of scope
- Stoppage/injury time, per-half caps, extra time, penalties.
- Auto-transition on timer expiry (timer is display-only).
