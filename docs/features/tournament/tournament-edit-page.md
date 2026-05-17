# tournament-edit-page

## What & Why

Once a tournament is created there is no way to correct its metadata (name, dates, location, description, format, points). FR-34 specifies which fields are editable by tournament status.

## Edit Lock Rules

| Field | Editable when |
|-------|--------------|
| name, description, location | Always (setup, active) |
| start_date, end_date | setup or active (locked when finished/archived) |
| format, points_win/draw/loss | setup only AND `first_match_scheduled_at IS NULL` |

When status is finished or archived, ALL fields are locked (read-only form).

## New Helpers in lock-rules.ts

- `canEditTournamentMeta(status)` — true when setup or active
- `canEditFormat(status, firstMatchScheduledAt)` — true when setup and no match scheduled yet

## Route

`/admin/tournaments/[id]/edit` — loads tournament server-side, renders a pre-filled form. On submit, PATCHes the tournament row and redirects to `/admin/tournaments/[id]`.

## Navigation

"Edit" link added to the quick-links row on the tournament detail page.
