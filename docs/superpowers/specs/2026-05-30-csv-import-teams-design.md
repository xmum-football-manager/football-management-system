# CSV Import for Teams — Design Spec

**Date:** 2026-05-30  
**Scope:** Admin → Tournament → Teams tab

---

## Overview

Add CSV import functionality to the Teams tab so organizers can bulk-load teams and players from a spreadsheet. To eliminate all duplication and conflict concerns, import is only permitted when the tournament has zero teams.

---

## CSV Format

Header row is required. Four columns:

```
team,player_name,jersey_number,position
Team A,John Smith,1,GK
Team A,Jane Doe,5,DEF
Team B,Bob Wilson,10,MID
Team B,Alice Chen,,FWD
```

| Column | Required | Validation |
|--------|----------|------------|
| `team` | Yes | Non-empty string |
| `player_name` | Yes | Non-empty string |
| `jersey_number` | No | Integer 0–99 if provided |
| `position` | No | One of `GK`, `DEF`, `MID`, `FWD` if provided |

Multiple rows with the same `team` value belong to the same team. Teams are created in the order they first appear in the CSV.

---

## UI

### When `canEdit` is true and zero teams exist (import enabled)

- **Download Sample CSV** button — downloads a pre-filled example CSV
- **Import CSV** button — active; opens a file picker (`.csv` only)
- Existing "Add Team" form remains available

### When `canEdit` is true and teams already exist (import disabled)

- **Download Sample CSV** button — still available
- **Import CSV** button — visually disabled (grayed out) with label: *"Import only available when no teams have been added yet"*
- Normal per-team management UI unchanged

### When `canEdit` is false

Neither CSV button is shown.

---

## Import Flow

1. User selects a `.csv` file.
2. File is parsed **client-side** immediately (no server round-trip yet).
3. A **preview modal/section** renders:
   - Summary: "X teams, Y total players"
   - Per-team breakdown: team name + player count + player list
   - Inline validation errors (bad position value, jersey out of range, missing name, empty team name) shown per row — import is blocked until all errors are resolved
4. User clicks **"Confirm Import"**.
5. A single server action receives the full parsed payload and creates all teams then all players in sequence.
6. On success: toast "X teams and Y players imported.", page refreshes.
7. On server error: toast with error message, no partial state left visible (teams created before a failure remain, but this is acceptable given the zero-team gate).

---

## Server Action

New action `importTeamsAction` in `actions.ts`:

```ts
importTeamsAction(tournamentId: string, teams: ImportTeamInput[])
// ImportTeamInput: { name: string; players: { name: string; jersey_number: number | null; position: string | null }[] }
```

- Re-checks that the tournament still has zero teams before writing (race condition guard).
- Creates each team via `createTeam`, then each player via `createPlayer`.
- Returns `{ ok: true, teamCount: number, playerCount: number }` or `{ error: string }`.

---

## Sample CSV

Downloaded as `teams-sample.csv`. Content:

```
team,player_name,jersey_number,position
Team A,John Smith,1,GK
Team A,Jane Doe,5,DEF
Team A,Bob Wilson,8,MID
Team A,Alice Chen,10,FWD
Team B,Carlos Rivera,1,GK
Team B,Emily Tan,4,DEF
```

---

## What Is Not In Scope

- Importing when teams already exist
- Updating or overwriting existing players via CSV
- Max players per team enforcement (no such field exists on tournament)
- Group label assignment via CSV (handled separately in Fixtures tab)
