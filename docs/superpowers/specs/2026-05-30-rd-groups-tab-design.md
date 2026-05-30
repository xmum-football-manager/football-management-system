# RD-Groups Tab Design

**Date:** 2026-05-30
**Format scope:** `round_robin_knockout` only

## Problem

Teams cannot be assigned to groups from the admin UI. `setTeamGroupAction` exists but has no UI. The Fixtures panel warns "Open the Groups view" but that view does not exist. Teams show as unassigned, blocking RD-Fixtures generation.

## Goal

Add an RD-Groups tab where organizers assign teams to groups (Group A, B, …). RD-Fixtures unlocks only when every group is exactly full.

---

## Route

`/admin/tournaments/[id]/rd-groups/` — new Next.js page, visible only for `round_robin_knockout` format.

---

## Components

### `page.tsx` (server component)

Fetches: `getTournament`, `listTeamsWithPlayers`, `listMatches`.

Passes to `RDGroupsPanel`:
- `tournamentId`
- `teams` — id, name, group_label
- `numGroups` — from `tournament.num_groups`
- `teamsPerGroup` — from `tournament.teams_per_group`
- `canEdit` — `canManageTeams(tournament.status) && !anyMatchActive`

### `RDGroupsPanel.tsx` (client component)

Layout (top to bottom):

1. **Unassigned pool card**
   - Header: `Unassigned (n)`
   - One row per team with no valid group label
   - Each row: team name + `<Select>` showing Group A / B / C … (derived from `numGroups`)
   - Selecting a group calls `setTeamGroupAction(teamId, tournamentId, label)` in a transition; updates local state optimistically

2. **Group cards** (one per expected label A, B, C …)
   - Header: `Group X — n / teamsPerGroup`
   - Header colour: green when `n === teamsPerGroup`, amber otherwise
   - Each row: team name + small `×` Remove button
   - Remove calls `setTeamGroupAction(teamId, tournamentId, null)`; team returns to unassigned pool

3. **Status banner** (bottom)
   - Amber + AlertCircle: lists groups that are under/over the required count
   - Green + CheckCircle: "All groups complete — RD-Fixtures is now unlocked" when every group is full

---

## Validation Logic Change

### `checkTournamentReadiness` (`lib/tournament-readiness.ts`)

**Current:** `allGroupsAssigned` = every team has a valid label.

**New:** also add `allGroupsFull` check when `teams_per_group` is not null:
- Build a count per expected label
- Every label must have exactly `teams_per_group` teams

**`canGenerateFixtures`** becomes:
```
allPlayersReady && allGroupsAssigned && allGroupsFull
```

`TournamentReadiness` interface gains one new field: `allGroupsFull: boolean`.

This means `rdFixturesLocked` in `layout.tsx` auto-unlocks only once all groups are exactly full. No other changes to `layout.tsx` needed.

---

## Nav Changes (`TournamentNav.tsx`)

- Add `RD-Groups` tab between `RD-Teams` and `RD-Fixtures` in the `round_robin_knockout` branch
- Prop: `rdGroupsProgress?: string | null` — non-null string triggers the `AlertCircle` dot
- `layout.tsx` passes `rdGroupsProgress` when `!readiness.allGroupsAssigned || !readiness.allGroupsFull`

---

## Lock rules summary

| Condition | RD-Groups | RD-Fixtures |
|---|---|---|
| Groups incomplete | AlertCircle dot | Locked |
| All groups full + players ready | No dot | Unlocked |
| Any match gone live | `canEdit = false` (read-only) | — |

---

## Out of scope

- Drag-and-drop reordering
- Auto-assign / randomise groups
- Editing group count (that lives in Settings)
