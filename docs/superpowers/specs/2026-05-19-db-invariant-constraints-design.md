# DB-Level Invariant Constraints

**Date:** 2026-05-19
**Status:** Spec — awaiting implementation plan

## Problem

Several data invariants are enforced only in TypeScript (DAL functions, wizard validation, tests) or in RLS policies. Both layers can be bypassed:

- **RLS** is bypassed by the `service_role` key, used by migrations, seed scripts, and any backend job that runs without a user session.
- **TS validation** is bypassed by any code path that does not go through the validated DAL function (other DAL calls, ad-hoc scripts, future code).

This spec moves the highest-risk invariants into Postgres itself (CHECK constraints, triggers, composite FKs) so the database is the source of truth.

## Scope

**In scope (high-risk only):**
- Time/date ordering on tournaments and matches
- Score non-negativity
- Status transition graphs (tournaments and matches)
- Tournament points-ordering (`win > draw > loss`)
- Format-required fields (round-robin / knockout / hybrid)
- Cross-tournament team integrity on matches
- Scorekeeper role coherence
- Last-admin lockout guard

**Out of scope (deferred):**
- Name trimming / non-empty checks (tournaments, teams, players)
- Jersey number uniqueness and positivity
- Case-insensitive team-name uniqueness
- `match_time` within tournament window
- `first_match_scheduled_at` recalculation trigger
- Halftime / extra-time minute positivity
- Pure-knockout group-field cleanup
- Player name uniqueness within team

These may land in a follow-up migration.

## Architecture

A single new migration: `web/supabase/migrations/20260519000000_db_level_invariants.sql`.

All invariants enforced at the Postgres layer. RLS policies stay as-is and continue to provide friendly per-role errors for the authenticated path; the new DB constraints are belt-and-suspenders that close the service-role gap.

## CHECK Constraints

### `tournaments`

| Constraint | Predicate |
|---|---|
| `tournaments_end_after_start` | `end_date >= start_date` |
| `tournaments_half_length_positive` | `minutes_per_half >= 1` |
| `tournaments_points_win_gt_draw` | `points_win > points_draw` |
| `tournaments_points_draw_gt_loss` | `points_draw > points_loss` |
| `tournaments_round_robin_fields` | `format NOT IN ('round_robin','round_robin_knockout') OR (num_groups IS NOT NULL AND teams_per_group IS NOT NULL)` |
| `tournaments_knockout_fields` | `format NOT IN ('knockout','round_robin_knockout') OR (knockout_start_round IS NOT NULL AND seeding_method IS NOT NULL)` |
| `tournaments_hybrid_advance` | `format <> 'round_robin_knockout' OR advance_per_group IS NOT NULL` |

### `matches`

| Constraint | Predicate |
|---|---|
| `matches_home_score_nonneg` | `home_score >= 0` |
| `matches_away_score_nonneg` | `away_score >= 0` |
| `matches_started_before_finished` | `match_started_at IS NULL OR match_finished_at IS NULL OR match_started_at <= match_finished_at` |

### `user_roles`

| Constraint | Predicate |
|---|---|
| `user_roles_scorekeeper_has_scope` | `role <> 'scorekeeper' OR tournament_id IS NOT NULL OR match_id IS NOT NULL` |

## Triggers

### `trg_matches_status_transition` — BEFORE UPDATE on `matches`

Reuses the existing `is_valid_match_transition(old_status, new_status)` function from migration `20260505000002_match_transition_rls.sql`. Raises an exception if the transition is invalid.

**Admin revert escape hatch.** The transition `finished → live` is normally invalid. It is allowed only when the session GUC `app.allow_admin_revert` is set to `'on'`. The DAL function `revertMatchToLive` wraps its update in a transaction and runs `SET LOCAL app.allow_admin_revert = 'on'` first. `SET LOCAL` scopes the GUC to the current transaction, so it cannot leak across requests.

Pseudocode:

```sql
CREATE OR REPLACE FUNCTION enforce_match_status_transition()
RETURNS trigger AS $$
DECLARE
  revert_allowed text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Admin revert path
  IF OLD.status = 'finished' AND NEW.status = 'live' THEN
    revert_allowed := current_setting('app.allow_admin_revert', true);
    IF revert_allowed = 'on' THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT is_valid_match_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'invalid match status transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### `trg_tournaments_status_transition` — BEFORE UPDATE on `tournaments`

Allowed transitions: `setup → active`, `active → finished`, `finished → archived`. No escape hatch (no current revert flow). Rejects any other status change.

### `trg_user_roles_last_admin_guard` — BEFORE DELETE OR UPDATE on `user_roles`

Fires only when the operation removes the `admin` role (DELETE of an admin row, or UPDATE that changes `role` away from `admin`). Counts remaining admin rows; if the result would be zero, raises `EXCEPTION 'cannot remove the last admin'`.

## Cross-Tournament Team Integrity (composite FK)

Currently `matches.home_team_id` and `matches.away_team_id` FK to `teams.id` only — there is no DB guarantee that both teams belong to the match's `tournament_id`.

Solution: composite FK.

1. Add `UNIQUE (id, tournament_id)` on `teams`. Redundant with the PK on `id`, but Postgres requires the referenced columns to have a unique constraint as a single index for the composite FK to target them.
2. Drop the existing `matches.home_team_id` FK; re-add as `FOREIGN KEY (home_team_id, tournament_id) REFERENCES teams (id, tournament_id) ON DELETE NO ACTION`.
3. Same for `away_team_id`.

Behaviour: an INSERT or UPDATE that pairs a `tournament_id` with a `home_team_id` belonging to a different tournament fails with an FK violation.

## Migration Safety

Pre-flight: at the top of the migration, run `SELECT` queries that check for currently-violating rows for every new constraint. If any violation is found, the migration aborts with `RAISE EXCEPTION` listing the offending row IDs. Operator must clean up data manually before re-running. No silent auto-fix.

Constraint validation order:
1. Run pre-flight checks.
2. Add CHECK constraints with `NOT VALID`, then `VALIDATE CONSTRAINT` in a second statement. Cheap insurance for future scale.
3. Create or replace trigger functions and triggers (idempotent on re-run).
4. Add unique index and composite FKs.

The migration is wrapped in a single transaction so any failure rolls back cleanly.

## DAL Changes

Single change: `web/lib/db/matches.ts::revertMatchToLive` must wrap its update in a transaction (Supabase RPC or raw SQL) that issues `SET LOCAL app.allow_admin_revert = 'on'` before the UPDATE. If Supabase's JS client cannot issue `SET LOCAL` inline, we create a Postgres function `admin_revert_match(match_id uuid)` that does both steps atomically and call it via `rpc()`. The implementation plan will decide between these based on what the client API supports.

No other DAL changes are required. The existing validated write paths already satisfy the new constraints; the constraints only fire if those paths are bypassed.

## Testing

**Deferred to a follow-up PR.** This migration ships first; constraint tests follow.

Planned follow-up coverage:
- `web/lib/db/__tests__/matches.test.ts`: negative scores rejected, invalid transitions rejected via service role, cross-tournament team pairing rejected.
- `web/lib/db/__tests__/tournaments-constraints.test.ts` (new): points-ordering, format-required fields, status-transition rejection.
- `web/lib/db/__tests__/user-roles-constraints.test.ts` (new): last-admin guard, scorekeeper-scope check.

## Rollback

Drop the migration in reverse order: drop composite FKs and restore original single-column FKs, drop unique index, drop triggers and functions, drop CHECK constraints. Standard Supabase down-migration if needed.

## Open Questions

None at spec time. The implementation plan will resolve the `SET LOCAL` vs `rpc()` choice in the DAL change.
