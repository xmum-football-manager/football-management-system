# Admin Tournament UI Improvements

**Date:** 2026-05-25

## Scope

Three improvements to `/admin/tournaments/[id]/`:

1. Fix horizontal tab scrolling on mobile
2. Merge Organizers + Scorekeepers into a new "Users" tab
3. Add CSV import to the Teams tab (sample CSV: 8 teams × 20 players)

---

## 1. Horizontal Tab Scroll (Mobile Fix)

### Problem

On narrow screens, the tab strip overflows and users must scroll the entire page vertically. The intent is left/right touch-swipe on the tab row only.

### Current State

`TournamentNav.tsx` already applies `overflow-x-auto` and `min-w-max` to the nav/ul. The issue is that a parent container may impose `overflow-hidden`, or the browser's touch scroll target is the page rather than the nav element.

### Fix

- Add `scrollbar-hide` (or equivalent `[&::-webkit-scrollbar]:hidden`) to the `<nav>` so the scrollbar doesn't appear on desktop but touch-scroll still works.
- Confirm no ancestor container has `overflow-hidden` that would clip horizontal scroll. If found, change to `overflow-x-clip overflow-y-visible` or remove the constraint.
- No structural changes needed — CSS only.

**Files:** `web/app/admin/tournaments/[id]/TournamentNav.tsx` (and possibly `web/app/admin/layout.tsx` or `web/app/admin/tournaments/[id]/layout.tsx` if a parent clips).

---

## 2. Users Tab

### Problem

Organizer assignment is buried inside Settings. Scorekeeper assignment is a separate tab. Admin users need both in one place. Non-admin organizers also need to manage both.

### Access

- **Admin:** sees Users tab, manages both sections
- **Organizer:** sees Users tab, manages both sections
- **Scorekeeper:** no access to this area (layout already enforces this)

Since every user who can reach `/admin/tournaments/[id]/` is already an admin or organizer, the Users tab is shown unconditionally — no extra gating needed.

### Tab Order (after change)

Overview · Teams · Fixtures · **Users** · Settings

The `Scorekeepers` tab is removed.

### New Route

`web/app/admin/tournaments/[id]/users/page.tsx`

### UsersPanel Layout

Two stacked sections inside a single `UsersPanel` client component:

**Organizers section** (top)
- Heading: "Organizers"
- Assign by email form (same as current Settings organizer section)
- List of assigned organizers with remove button

**Scorekeepers section** (below)
- Heading: "Scorekeepers"
- Assign by email form with tournament-wide / specific-match scope toggle
- List of current assignments with remove button

### Files

| Action | File |
|--------|------|
| Create | `web/app/admin/tournaments/[id]/users/page.tsx` |
| Create | `web/app/admin/tournaments/[id]/users/UsersPanel.tsx` |
| Create | `web/app/admin/tournaments/[id]/users/actions.ts` |
| Modify | `web/app/admin/tournaments/[id]/TournamentNav.tsx` — replace `Scorekeepers` tab with `Users` |
| Modify | `web/app/admin/tournaments/[id]/settings/SettingsPanel.tsx` — remove organizer section |
| Modify | `web/app/admin/tournaments/[id]/settings/page.tsx` — remove organizer data loading |
| Delete | `web/app/admin/tournaments/[id]/scorekeepers/` folder (page, panel, actions) |

Server actions for `users/actions.ts`:
- `assignOrganizerAction` — copied/moved from settings actions
- `removeOrganizerAction` — copied/moved from settings actions
- `assignScorekeeperAction` — copied/moved from scorekeepers actions
- `removeScorekeeperAction` — copied/moved from scorekeepers actions

---

## 3. CSV Import for Teams

### Problem

Adding 8 teams × 20 players (160 rows) one at a time via the UI is impractical for tournament setup.

### CSV Format

Header row + one row per player. Same team name = same team.

```
team,player_name,position,jersey_number
Lions,John Smith,FWD,9
Lions,Mike Lee,GK,1
```

Required columns: `team`, `player_name`
Optional columns: `position`, `jersey_number`

### Sample CSV

Downloadable file with 8 teams × 20 players = 160 data rows. Team names are generic football club names. Positions drawn from GK/DEF/MID/FWD. Jersey numbers 1–20 per team.

### UI Additions (TeamsPanel, canEdit only)

Two new buttons in the "Add Team" card area:

1. **Download sample CSV** — triggers client-side download of the hardcoded sample data as `teams-sample.csv`
2. **Import CSV** — opens `<input type="file" accept=".csv">`, parses file client-side, calls bulk server action

### Import Flow

1. User selects `.csv` file
2. Client parses CSV (no library needed — plain `split('\n')` / `split(',')`)
3. Client groups rows by team name
4. Single call to `importTeamsCsvAction(tournamentId, rows[])` server action
5. Server action:
   - For each unique team name: fetch existing team or create it
   - For each player row: create player under that team (skip if player name already exists in that team)
6. Returns `{ teamsCreated, playersAdded, errors[] }`
7. Client shows toast: `"3 teams, 47 players imported"` or lists row errors

### Validation

Client-side (before sending):
- File must be `.csv`
- Header row must contain `team` and `player_name` columns
- Rows with empty `team` or `player_name` are skipped with a warning

Server-side:
- `jersey_number` must be 0–99 if provided
- Tournament must be in `setup` status (canEdit check already enforced by existing lock rules)

### Files

| Action | File |
|--------|------|
| Modify | `web/app/admin/tournaments/[id]/teams/TeamsPanel.tsx` — add import/download buttons |
| Modify | `web/app/admin/tournaments/[id]/teams/actions.ts` — add `importTeamsCsvAction` |

No new files needed — CSV parsing stays inline in `TeamsPanel.tsx`, bulk action goes in existing `actions.ts`.

---

## Verification

- `cd web && pnpm tsc --noEmit` — no type errors
- `cd web && pnpm lint` — no lint errors
- Manual test:
  - On mobile (or narrow browser): tab strip scrolls left/right, does not scroll page vertically
  - Users tab visible; organizer + scorekeeper assignment both work
  - Scorekeepers tab and organizer section in Settings are gone
  - Download sample CSV produces correct 160-row file
  - Import CSV with sample file creates 8 teams + 160 players
  - Import CSV with partial data (missing position/jersey) works without error
  - Import CSV with duplicate team name appends players rather than creating a second team
