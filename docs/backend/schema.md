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
- `status`: `'setup'` | `'active'` | `'finished'` | `'archived'`
- `first_match_scheduled_at`: set on the first match creation; locks `format` and points system values after this point

**`matches`**
- `status`: `'scheduled'` | `'live'` | `'finished'`
- `home_score` / `away_score`: actual goals entered by scorekeeper or organizer
- `match_started_at` / `match_finished_at`: timestamps set on status transitions

**`user_roles`**
- `admin`: `tournament_id = NULL`, `match_id = NULL`
- `organizer`: `tournament_id` set, `match_id = NULL`
- `scorekeeper (tournament-wide)`: `tournament_id` set, `match_id = NULL`
- `scorekeeper (match-specific)`: `match_id` set, `tournament_id = NULL`
- CHECK constraints enforce these rules at the DB level
