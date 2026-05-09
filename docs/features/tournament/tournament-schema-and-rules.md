# tournament-schema-and-rules

## What this does

Extends the tournament data model and lock-rule logic to support:
- A new `round_robin_knockout` format option (alongside existing `round_robin` and `knockout`)
- A time-based name-edit lock: name can only be changed when the tournament start date is more than 14 days away (and the tournament is not finished/archived)
- A status-based venue/description lock: venue and description are editable only while status is `setup` (before the tournament goes live)

## Key behaviours

| Field | Editable when |
|-------|--------------|
| name | `start_date - today > 14 days` AND status not in `finished`, `archived` |
| description | status === `setup` |
| location/venue | status === `setup` |
| format | status === `setup` AND `first_match_scheduled_at` is null (unchanged) |
| points_win/draw/loss | same as format |
| start_date / end_date | status === `setup` (unchanged via `canEditDates`) |

## New functions in `lib/lock-rules.ts`

- `canEditTournamentName(status, startDate): boolean`
- `canEditVenueDescription(status): boolean`

## DB migration

Drops the format check constraint and re-adds it with three values:
`'round_robin'`, `'round_robin_knockout'`, `'knockout'`

## Dependencies

None — this is the foundation for subsequent sub-features.
