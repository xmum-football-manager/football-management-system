# Design: Tabbed Admin Tournament Detail Page

## Problem

The admin tournament detail page (`/admin/tournaments/[id]`) is a flat layout with link-based navigation to separate sub-pages (Teams, Fixtures, Scorekeepers, Edit). Tab switching navigates away, losing form state and context. There is no "Go Live" readiness check, no team initialization indicator, and no unified settings view.

## Goal

Convert `/admin/tournaments/[id]` into a single client-side tabbed page with 4 tabs: Overview, Teams, Fixtures, Settings. Content persists across tab switches. Teams tab shows red indicators for incomplete rosters. Overview tab has a Go Live button with a condition checklist.

## Architecture

**Approach:** Single client component with inline tabs (Approach A).

- Convert `page.tsx` from server component to `'use client'` component
- All data loaded client-side on mount via Supabase queries
- Tabs switch via React `useState` — no URL changes, no remounting
- Existing sub-pages (`/teams`, `/fixtures`, `/scorekeepers`, `/edit`) become dead routes (removed later)

## Data Model Changes

### New column: `min_players_per_team`

```sql
ALTER TABLE tournaments
  ADD COLUMN min_players_per_team INTEGER NOT NULL DEFAULT 11
  CHECK (min_players_per_team >= 11);
```

Migration file: `supabase/migrations/20260517000000_min_players_per_team.sql`

## Page Structure

### Header (fixed, above tabs)

- Left: `← Dashboard` link
- Center: Tournament name (bold)
- Right: `Public View →` link + status badge

### Tab Strip

4 tabs below header: `Overview | Teams | Fixtures | Settings`

- Active tab has green underline indicator
- **Red dot** on Teams tab when any team has `players.length < min_players_per_team` OR `teams.length < expectedTeamCount`
- Styled to match existing design system (Tailwind, slate colors)

### Data loaded on mount

Single useEffect fetches:
1. Tournament row (`tournaments`)
2. Teams with nested players (`teams` → `players`)
3. Matches with home/away teams (`matches` → `teams`)
4. User roles (`user_roles`)

Computed values:
- `expectedTeamCount = num_groups * teams_per_group` (from tournament format settings)
- `goLiveReadiness` object (see Go Live section)
- `isAdmin`, `isOrganizer`

## Tab Components

### Tab 1: Overview

Content:
- Stat cards row (Status, Matches count, Live count, Format)
- Matches list with live score editing and status controls (start/halftime/fulltime/revert)
- ScoreEditor inline for live matches
- MatchStatusControls for organizer
- Organizer assignment panel (admin-only)
- **Go Live section** (see below)
- Mark as Finished button (when status is `active`)

### Tab 2: Teams

Layout: two-column grid (team list left, roster editor right).

**Left panel:**
- Add team form (text input + Add button)
- Team list: each row shows team name, player count, and status indicator
  - Green check: `players.length >= min_players_per_team`
  - Red warning: `"Need X more players (has Y of Z)"`
- Locked when tournament is not `setup`

**Right panel:**
- "Select a team to edit its roster" empty state
- When team selected: RosterEditor component (add player form + player table)
- Player table: jersey #, name, position, delete button

**Tab badge:**
- Red dot shown when: any team below min_players OR teams count < expected
- Badge removed when all teams meet requirements

### Tab 3: Fixtures

Content:
- Add fixture form: home team dropdown, away team dropdown, date/time picker
- Match list: chronological order, each match shows teams, time, status, delete button
- Match time editable for scheduled matches
- Locked when tournament is `finished` or `archived`

### Tab 4: Settings

Sections (each with its own save button or single save):

1. **Tournament Info:** name, description, venue/location
2. **Dates:** start_date, end_date (date pickers)
3. **Format:** dropdown (round_robin / round_robin_knockout / knockout) — locked after first match scheduled
4. **Group Config:** num_groups, teams_per_group, advance_per_group — visible when format has RR, locked with format
5. **Knockout Config:** knockout_start_round, seeding_method — visible when format has KO, locked with format
6. **Points:** win/draw/loss inputs — locked when `active`
7. **Match Rules:** halftime toggle, minutes_per_half, halftime_minutes, extra_time_minutes, penalty_shootout, require_goal_player
8. **Min Players:** `min_players_per_team` number input (minimum 11, default 11)
9. **Scorekeepers:** scorekeeper assignment (moved from `/scorekeepers` page)

Lock indicators: locked fields show lock icon + "Locked — [reason]" help text.

## Go Live Logic

**Location:** Overview tab, prominent section.

### Conditions

| # | Condition | SQL/JS check |
|---|-----------|-------------|
| 1 | All settings configured | `name`, `start_date`, `end_date`, `format` set. If RR: `num_groups`, `teams_per_group` set. If KO: `knockout_start_round`, `seeding_method` set. |
| 2 | Enough teams | `teams.length === num_groups * teams_per_group` |
| 3 | All teams fully rostered | Every team: `players.length >= min_players_per_team` |
| 4 | Date reached | `today >= start_date` |

### UI States

**All conditions met:**
- Green "Go Live" button
- Click → `UPDATE tournaments SET status = 'active' WHERE id = ...`
- Page re-fetches data, UI reflects new locked state

**Conditions 1-3 met, date not yet:**
- Greyed out button
- Message: `"Go Live available on DD-MM-YYYY"`

**Other conditions failing:**
- Greyed out button
- Checklist showing missing items:
  - "Configure [missing setting name]"
  - "Add X more teams (have Y of Z)"
  - "Team 'ABC' needs X more players (has Y, need Z)"
- Items that are satisfied show green check

### After Going Live

- Tournament status → `active`
- Teams tab: add/remove locked, roster editing locked
- Settings tab: format, points, group config locked. Dates, venue still editable.
- Fixtures tab: can still add/delete and edit match times
- Overview: Go Live button replaced with "Mark as Finished" button

## File Changes

### New files
- `web/supabase/migrations/20260517000000_min_players_per_team.sql` — add column
- `web/app/admin/tournaments/[id]/TabStrip.tsx` — tab bar component
- `web/app/admin/tournaments/[id]/OverviewTab.tsx` — overview tab
- `web/app/admin/tournaments/[id]/TeamsTab.tsx` — teams tab (renamed from teams/page.tsx logic)
- `web/app/admin/tournaments/[id]/FixturesTab.tsx` — fixtures tab (renamed from fixtures/page.tsx logic)
- `web/app/admin/tournaments/[id]/SettingsTab.tsx` — settings tab
- `web/app/admin/tournaments/[id]/GoLivePanel.tsx` — go live button + checklist

### Modified files
- `web/app/admin/tournaments/[id]/page.tsx` — convert to client component with tabs
- `web/lib/supabase/types.ts` — add `min_players_per_team` to Tournament type
- `web/lib/lock-rules.ts` — no changes needed (existing rules still apply)

### Dead files (remove later)
- `web/app/admin/tournaments/[id]/teams/page.tsx`
- `web/app/admin/tournaments/[id]/fixtures/page.tsx`
- `web/app/admin/tournaments/[id]/scorekeepers/page.tsx`
- `web/app/admin/tournaments/[id]/edit/page.tsx`
- `web/app/admin/tournaments/[id]/TournamentSetupCard.tsx`

### Reused components (no changes)
- `MatchStatusControls.tsx`
- `ScoreEditor.tsx`
- `OrganizerAssignment.tsx`

## Verification

1. **Typecheck:** `cd web && tsc --noEmit`
2. **Lint:** `cd web && pnpm lint`
3. **Manual test:** Navigate to `/admin/tournaments/[id]`, verify:
   - 4 tabs visible, switching preserves state
   - Teams tab shows red indicator when teams are incomplete
   - Go Live button shows correct checklist when conditions not met
   - Go Live works when all conditions met
   - Settings tab saves `min_players_per_team`
   - After Go Live, locked fields show lock indicators
