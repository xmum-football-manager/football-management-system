-- Enforce match status transition rules at the DB layer via RLS.
--
-- Valid transitions:
--   organizer or admin:  scheduled → live
--                        live → halftime
--                        halftime → live
--                        live → finished
--   admin only:          finished → live  (revert)
--   never:               anything else
--
-- Replaces the broad "matches_update_scorekeeper_score" policy with two
-- targeted policies: one for score-only updates (scorekeeper), one for
-- status transitions (organizer / admin).

-- ============================================================
-- Helper: is the OLD→NEW status transition allowed for this user?
-- ============================================================
create or replace function public.is_valid_match_transition(
  from_status text,
  to_status   text
)
returns boolean language sql security definer stable as $$
  select case
    -- organizer-level transitions (admin also passes is_organizer)
    when from_status = 'scheduled' and to_status = 'live'      then true
    when from_status = 'live'      and to_status = 'halftime'  then true
    when from_status = 'halftime'  and to_status = 'live'      then true
    when from_status = 'live'      and to_status = 'finished'  then true
    -- admin-only revert
    when from_status = 'finished'  and to_status = 'live'      then public.is_admin()
    -- everything else denied
    else false
  end;
$$;

-- ============================================================
-- Drop existing broad update policy so we can replace it
-- ============================================================
drop policy if exists "matches_update_scorekeeper_score" on public.matches;

-- ============================================================
-- Policy 1: scorekeeper — score updates only while match is live
-- Scorekeeper cannot change status; they can only touch scores.
-- ============================================================
create policy "matches_update_scorekeeper_score"
  on public.matches for update
  using (
    status = 'live'
    and public.is_scorekeeper(id)
    and not public.is_organizer(tournament_id)
  )
  with check (
    -- status must not change
    status = 'live'
  );

-- ============================================================
-- Policy 2: organizer / admin — status transitions + score edits
-- Enforces the allowed transition table via WITH CHECK.
-- ============================================================
create policy "matches_update_organizer_transition"
  on public.matches for update
  using (public.is_organizer(tournament_id))
  with check (
    public.is_organizer(tournament_id)
    and public.is_valid_match_transition(
      -- OLD.status is accessible in USING via the row being updated;
      -- in WITH CHECK we need the current (OLD) value from the table.
      -- Use a subselect on the immutable id to get OLD status.
      (select status from public.matches where id = matches.id),
      matches.status
    )
  );
