# Homepage: Show Live Tournaments Only

**Date:** 2026-05-20
**Status:** Approved

## Problem

The homepage (`/`) currently fetches tournaments with status `setup` or `active` from the database. Tournaments in `setup` are not visible to the public yet — only `active` (live) tournaments should appear. The filter must happen at the database level, not in the frontend.

## Lifecycles

### Tournament

```
setup → active → finished → archived
```

| Status | Meaning |
|---|---|
| `setup` | Being configured by admin. Not public. |
| `active` | Live — visible on homepage. |
| `finished` | Concluded. Not shown on homepage. |
| `archived` | Retired. Not shown on homepage. |

### Match

```
scheduled → live → halftime → live → finished
```

| Status | Meaning |
|---|---|
| `scheduled` | Upcoming fixture. |
| `live` | Match in progress. |
| `halftime` | Pause between halves (organizer-controlled). |
| `finished` | Result confirmed. |

`halftime` is a pause state entered from `live` and exits back to `live`. No current-half column — half context is inferred from transition history.

## Changes

### `web/lib/db/tournaments.ts`

Rename `getActiveTournaments` → `getLiveTournaments`. Change the Supabase filter from `.in('status', ['setup', 'active'])` to `.eq('status', 'active')`. The function name now matches its intent: returns only tournaments currently live.

### `web/app/page.tsx`

Update import and call site: `getActiveTournaments` → `getLiveTournaments`.

### `docs/backend/schema.md`

Add a dedicated "Lifecycles" section with the two flows above, replacing the inline notes currently buried in the table.

### `docs/frontend/pages.md`

Update homepage description to explicitly state: shows only `active`-status tournaments. Remove ambiguous "active tournaments" phrasing.

## Out of Scope

- Showing `finished` tournaments on homepage (e.g., recent results section)
- Any admin-side changes — admin views their own tournament list separately
