# Knockout Overview Sync — Design

## Goal

Knockout matches must appear in the Overview tab's "Next up" row so admins can kick off Round 1 matches directly from the overview, without navigating to a separate page.

## Problem

The overview's `upNext` computation filters `m.match_time !== null`. Knockout matches created via `BracketSetupView` always have a `match_time` set (enforced by `allFilled`), but matches created with the old builder (or edge-case null times) are silently excluded. The result: "Next up" is blank even though a scheduled knockout match exists.

## Approach

Phase-aware fallback. The existing timed filter runs first (group-stage behaviour unchanged). If it returns nothing, the overview falls back to the first scheduled knockout match regardless of whether a time is set.

## Change

**File:** `web/app/admin/tournaments/[id]/page.tsx`

Replace:
```ts
const upNext = matches
  .filter((m) => m.status === 'scheduled' && m.match_time !== null)
  .sort((a, b) => a.match_time!.localeCompare(b.match_time!))
  .at(0) ?? null
```

With:
```ts
const timedUpNext = matches
  .filter((m) => m.status === 'scheduled' && m.match_time !== null)
  .sort((a, b) => a.match_time!.localeCompare(b.match_time!))
  .at(0) ?? null

const upNext =
  timedUpNext ??
  (matches.find((m) => m.status === 'scheduled' && m.phase === 'knockout') ?? null)
```

## Behaviour

| Scenario | Result |
|---|---|
| Group match with scheduled time exists | Shows that match (unchanged) |
| No timed matches, knockout match exists | Shows knockout match; time row omitted if null |
| No scheduled matches at all | `upNext` is null, row hidden (unchanged) |

## Out of scope

- `UpNextRow` already handles `match_time: null` — no change needed
- Kickoff button already works for any match phase — no change needed
- Bracket collapse after setup already shipped (commit `5f29c10`)
- No DB changes, no new components
