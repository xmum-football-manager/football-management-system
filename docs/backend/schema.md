# Database Schema

## Tables

| Table | Description |
|---|---|
| `tournaments` | Tournament records — name, dates, location, format, points system, status |
| `teams` | Teams scoped to a tournament |
| `players` | Players scoped to a team — name, jersey number, position |
| `matches` | Fixtures — home/away teams, scheduled time, scores, match status |
| `user_roles` | Role assignments — admin (global), organizer (per tournament), scorekeeper (per tournament or per match) |
| `admin_audit_log` | Audit trail for admin-only actions (e.g., reverting a finished match to live) |

## Views

| View | Description |
|---|---|
| `standings` | Computed from finished matches using the tournament's points system. Returns MP, W, D, L, GS, GC, GD, Pts per team per tournament. |

The standings view is pure SQL — no app-layer aggregation. The points system values (`points_win`, `points_draw`, `points_loss`) are read directly from the `tournaments` row, so custom point values are reflected automatically.

## Key column notes

**`tournaments`**
- `format`: `'round_robin'` | `'knockout'`
- `status`: `'setup'` | `'active'` | `'bracket_setup'` | `'knockout'` | `'finished'` | `'archived'`
- `first_match_scheduled_at`: set on the first match creation; locks `format` and points system values after this point

**`matches`**
- `status`: `'scheduled'` | `'live'` | `'halftime'` | `'finished'`
- `home_score` / `away_score`: actual goals entered by scorekeeper or organizer
- `match_started_at` / `match_finished_at`: timestamps set on status transitions
- `match_time`: Display-only scheduled estimate shown to the audience. Editable while match status is `scheduled`. Locked once status is `live` or beyond. Does not auto-start the match — the Organizer always controls start via "Start Match".
- `match_started_at`: Set to current timestamp when Organizer presses "Start Match". This is the authoritative actual start time.

**`user_roles`**
- `admin`: `tournament_id = NULL`, `match_id = NULL`
- `organizer`: `tournament_id` set, `match_id = NULL`
- `scorekeeper (tournament-wide)`: `tournament_id` set, `match_id = NULL`
- `scorekeeper (match-specific)`: `match_id` set, `tournament_id = NULL`
- CHECK constraints enforce these rules at the DB level

## Lifecycles

### Tournament Lifecycle

**Round-robin / Knockout only:** `setup → active → finished → archived`

**Round-robin + Knockout:** `setup → active → bracket_setup → knockout → finished → archived`

| Status | Meaning |
|---|---|
| `setup` | Being configured by admin. Teams and rosters are being set up; matches can be scheduled. Not shown on the public homepage. |
| `active` | Live and in progress — group stage running. Shown on the public homepage. |
| `bracket_setup` | Group stage finished; organizer is manually seeding the knockout bracket. Shown on the public homepage. Only applies to `round_robin_knockout` format. |
| `knockout` | Knockout phase running. Shown on the public homepage. Only applies to `round_robin_knockout` format. |
| `finished` | Tournament concluded. Results are final. Not shown on the public homepage. |
| `archived` | Retired. Not shown on the public homepage. |

### Match Lifecycle

A match moves through five states with one loop-back: `scheduled → live → halftime → live → finished`

- **`scheduled`**: Upcoming fixture. Not yet started.
- **`live`**: Match in progress. The running clock is active.
- **`halftime`**: Pause state entered from `live`. Organizer-controlled — organizer can pause and resume the match. Half context is inferred from the transition sequence (no `current_half` column). Exits back to `live`.
- **`live` (resumed)**: Match resumes after halftime. The second half clock continues.
- **`finished`**: Result confirmed and final. An admin-only revert from `finished → live` exists to correct score entry errors or mark a match as live again.
