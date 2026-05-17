# organizer-score-input

## What & Why

FR-09 requires Organizers to be able to input and update match scores. Currently only the `/score` scorekeeper page provides score entry. Organizers managing a tournament from `/admin/tournaments/[id]` have no way to update scores without also being a scorekeeper.

## Behaviour

- Score steppers are **only visible and writable when the match is `live`**. The organizer must press "Start match" first — this is the gate.
- Halftime matches do NOT show steppers (you can't score during halftime; the organizer uses lifecycle buttons to resume).
- Optimistic updates: the UI updates immediately, reverts on DB error.
- Any user with organizer access to the tournament can edit scores — no separate scorekeeper assignment required.

## Go-live gate

When the organizer presses **"Start match"**:

1. One DB write: `UPDATE matches SET status = 'live', started_at = now() WHERE id = $matchId`.
2. The response (updated match row, including `started_at`) is written to the **browser cache** (see below).
3. Score steppers become visible immediately — no extra read needed.

`started_at` is a `timestamptz` column on the `matches` table. It records the exact moment the organizer pressed "Go live" and is used for:
- Displaying "Kicked off at HH:MM" in the match row.
- Audit and dispute resolution.

## Browser cache strategy

**Goal:** after the initial "Start match" write, score entry must not add extra DB reads.

### What's cached

Key: `match-live:{matchId}` (localStorage)
Value: `{ status, home_score, away_score, started_at }` — a subset of the match row, updated optimistically on every stepper press.

### Cache lifetime

| Event | Cache action |
|---|---|
| "Start match" confirmed | Write `{ status: 'live', home_score: 0, away_score: 0, started_at }` |
| Score stepper press | Update `home_score` / `away_score` in cache immediately (optimistic); if DB write fails, revert cache |
| "Half time" pressed | Remove cache entry (match leaves `live`) |
| "Full time" pressed | Remove cache entry |
| Page reload | Cache hit → no DB read for status; score steppers render from cached values. Background re-validation happens once via the normal fixtures fetch. |

### Why this keeps reads and writes low

- **No extra reads:** score steppers read status from cache, not from a DB query. The match-list fetch (already happening on page load) is the only read.
- **No extra writes:** each stepper press is already a necessary DB write (the score has to be persisted). The cache just ensures the UI doesn't re-read the row after every write.
- **No polling for live state:** the organizer who pressed "Start match" has the ground truth in their browser. Spectators and other tabs use the existing 5s long-poll on the participant view.

## Component

`ScoreEditor.tsx` — client component rendered inside `MatchRow` when `match.status === 'live'`.

The component:
1. On mount, reads `match-live:{matchId}` from localStorage. If present, initialises from cache (no network call).
2. If cache miss, falls back to `match.status` from props (set by server fetch).
3. On `+` / `-` press: updates cache synchronously, fires `PATCH /api/matches/:id/score` in background.

## Dependencies

- `MatchRow` in `app/admin/tournaments/[id]/page.tsx` must be a client component so it can read/write localStorage.
- `matches` table needs a `started_at timestamptz` column (nullable; null = not yet started).
- Supabase browser client (`@/lib/supabase/client`).
