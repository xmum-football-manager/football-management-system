# Design: Player Goal Stats, Card Tracking, Half-Time Fix, Remove Position

**Date:** 2026-06-11
**Status:** Approved (design phase)

## Overview

Four client-requested changes to the football tournament app:

1. **Top players / goal scorers** — track which player scores each goal; show a goal-ranked
   "Top Players" section in the public tournament view and in the admin player list.
2. **Yellow/red card tracking** — record cards per player during a live match; display
   per-team yellow/red counts in the public view. (Display only — no tiebreaker logic.)
3. **Half-time bug + timer** — fix the public score appearing to reset to 0-0 at half-time;
   freeze the live clock during the break and resume it from the recorded elapsed time.
4. **Remove `position`** — drop the player `position` attribute from DB and all UI.

These are independent and can be built/reviewed in any order, but share one migration file.

---

## 1. Top Players / Goal Scorers

### Decisions (from client)
- Scorer selection is **strictly mandatory** — a goal cannot be recorded without picking a player.
- Players are **picked from the existing team roster only** — no add-on-the-fly.

### Data model
New table `public.goals`:

```sql
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  player_id uuid not null references public.players(id),
  created_at timestamptz not null default now()
);
```

- `matches.home_score` / `away_score` remain the authoritative score. A `goals` row is the
  per-scorer record. The two must be kept consistent by the write path (below).
- RLS: public `select` (true); `insert`/`delete` allowed for `is_scorekeeper(match_id)` while
  the match is `live` (mirrors score-edit rules). Added to `supabase_realtime` publication so
  the public view updates live.

### Top-scorer view
New SQL view `public.top_scorers`:

```sql
create view public.top_scorers as
select g.player_id, p.name as player_name, t.id as team_id, t.name as team_name,
       tm.tournament_id, count(*) as goals
from public.goals g
join public.players p on p.id = g.player_id
join public.teams t on t.id = g.team_id
join public.matches tm on tm.id = g.match_id
group by g.player_id, p.name, t.id, t.name, tm.tournament_id;
```

### Write path (the important part)
Goal increment becomes a two-step, ordered operation. Because the existing scorekeeper flow
writes the score directly from the client (`ScoreApp.bump`), and we now need a roster picker +
a `goals` insert, we wrap this in a **server action** to keep score and goal log atomic-ish and
to centralise the logic for both the scorekeeper and admin pages:

- New server action `recordGoal(matchId, side, playerId)`:
  1. Insert a `goals` row.
  2. Increment the matching `home_score`/`away_score`.
  Returns the new score. (If step 2 fails, the goal row is rolled back via a DB function — see
  Eng-review note below; simplest correct version is a single `plpgsql` function
  `record_goal(match_id, player_id)` that does both in one transaction and returns the new row.)
- New server action `undoGoal(matchId, side)`: deletes the most recent `goals` row for that
  team in that match and decrements the score. Used by the existing "−" button.

**Goal entry UX (scorekeeper + admin):** pressing "+" on a team opens a player picker (modal/sheet)
listing that team's roster; selecting a player commits the goal. Pressing "−" removes the most
recent goal for that team. The bare numeric score buttons no longer write directly.

### UI surfaces
- **Public `TournamentView`**: new "Top Players" section (reuse existing section/table styling),
  rows = player name · team · goals, sorted desc, reading from `top_scorers`.
- **Admin tournament player list**: same goal-ranked list (admins can see scorers per tournament).

---

## 2. Yellow / Red Cards

### Decisions (from client)
- Cards are recorded **only during a live match**, with explicit player selection.
- Public view shows **per-team yellow & red counts**. **No tiebreaker logic** — display only.

### Data model
New table `public.cards`:

```sql
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  player_id uuid not null references public.players(id),
  card_type text not null check (card_type in ('yellow', 'red')),
  created_at timestamptz not null default now()
);
```

- RLS: public `select`; `insert`/`delete` for `is_scorekeeper(match_id)` while match is `live`
  (so admins/organizers also qualify via `is_scorekeeper`). Added to realtime publication.

### View
`public.team_card_counts` (or aggregate in the standings query):

```sql
create view public.team_card_counts as
select team_id,
       count(*) filter (where card_type = 'yellow') as yellow,
       count(*) filter (where card_type = 'red')    as red
from public.cards
group by team_id;
```

### UI surfaces
- **Scorekeeper + admin match controls**: a "Card" action (live only) → pick team → pick player
  from that team's roster → pick yellow/red → insert.
- **Public view**: per-team yellow/red badges (e.g. 🟨 2 🟥 1) shown on the team card / standings row.

---

## 3. Half-Time Bug + Timer

### Bug
At half-time, status flips `live → halftime`. `HeroLive` only renders matches with
`status === 'live'`, so the live hero (and its score) disappears, making the public score look
like it reset to 0-0. The `LiveClock` also counts continuously and has no pause concept.

### Fix — display
- `HeroLive` / hero-match selection treats `halftime` like a live-but-paused match: still shows
  the **current score**, shows a **"Half Time"** status pill, and renders a **frozen** clock.
- Same frozen-clock + current-score behavior in the admin and scorekeeper views.

### Fix — timer (client decision: clock continues from recorded elapsed)
Behavior: clock stops at e.g. 43:00 when half-time is pressed; that elapsed value is recorded;
second half resumes counting up from 43:00. The break is **not** counted.

Migration adds two columns to `matches`:
```sql
alter table public.matches
  add column halftime_started_at  timestamptz,
  add column second_half_started_at timestamptz;
```
(`match_started_at` already exists = kickoff.)

`updateMatchStatus` sets:
- `live` (first time): `match_started_at = now()` (already implemented).
- `halftime`: `halftime_started_at = now()`.
- `halftime → live` (2nd half): `second_half_started_at = now()`.

**Displayed elapsed seconds:**
- `live`, 1st half (no halftime yet): `now − match_started_at`.
- `halftime` (frozen): `halftime_started_at − match_started_at`.
- `live`, 2nd half: `(halftime_started_at − match_started_at) + (now − second_half_started_at)`.

`LiveClock` is generalized to take these timestamps + status and compute the above; it stops
ticking when `status === 'halftime'`.

---

## 4. Remove `position`

Drop the attribute everywhere:

- **DB:** `alter table public.players drop column position;`
- **Code/UI references to remove or strip:**
  - `lib/db/players.ts:19` — `position?` field on the type.
  - `app/admin/tournaments/[id]/teams/CsvImport.tsx` — sample CSV header + `p.position` render.
  - `app/admin/tournaments/[id]/teams/csv-utils.ts` — `posIdx`, `normalisePosition`, validation,
    and the `position` field in the parsed row.
  - `app/admin/tournaments/[id]/teams/TeamsPanel.tsx:326-327` — position chip.
  - `app/t/[id]/team/[teamId]/page.tsx:229` — position cell.
  - `components/TeamCard.tsx:88` — position cell.
  - Any `players.csv` header references / seed data using `position`.

(`components/StandingsTable.tsx`, `BracketView.tsx`, `ui/*` "position" hits are unrelated layout
terms — leave them.)

---

## Migration

Single new migration file `web/supabase/migrations/20260611000000_player_stats_cards_halftime.sql`
containing: `goals` table + RLS + realtime, `cards` table + RLS + realtime, `top_scorers` /
`team_card_counts` views, `record_goal`/`undo_goal` functions, `matches` half-time columns, and
`drop column players.position`. `schema.sql` updated to match (it's the canonical full schema).

## Testing / Verification

- **Goals:** record a goal → score increments **and** `goals` row exists; mandatory picker blocks
  goal with no player; `top_scorers` ranks correctly; undo decrements both.
- **Cards:** card only addable while `live`; per-team counts render in public view.
- **Half-time:** unit-test the elapsed-seconds math for all three states; manual: score stays
  visible and clock freezes at half-time, resumes from recorded value in 2nd half.
- **Position:** `tsc --noEmit` + `pnpm lint` clean after column/field removal; CSV import still
  works without a position column.

## Out of Scope
- Disciplinary tiebreaker logic (client: display only).
- Assists, own-goals, minute-of-goal, substitutions, CSV roster import rework.
- Add-player-on-the-fly during goal entry.
