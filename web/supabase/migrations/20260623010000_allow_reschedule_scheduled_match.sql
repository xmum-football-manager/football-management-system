-- Rescheduling a match (setting/changing match_time) leaves status unchanged
-- at 'scheduled'. The organizer update policy's WITH CHECK gated every update
-- through is_valid_match_transition(old, new), which has no same-status case and
-- so returns false for 'scheduled' -> 'scheduled'. The reschedule UPDATE failed
-- the WITH CHECK and surfaced as:
--   "new row violates row-level security policy for table matches"
-- (see scheduleMatchAction -> updateMatchTime, lib/db/matches.ts).
--
-- Fix: allow a status-unchanged update while the match is still 'scheduled'
-- (rescheduling), mirroring how the scorekeeper policy already permits its own
-- same-status edits. Real status changes still go through the transition table.
-- The match_time lock clause is preserved unchanged. is_valid_match_transition
-- is left untouched so the scorekeeper policy keeps its 'live'-only guard.
drop policy if exists "matches_update_organizer_transition" on public.matches;
create policy "matches_update_organizer_transition"
  on public.matches for update
  using (public.is_organizer(tournament_id))
  with check (
    public.is_organizer(tournament_id)
    and (
      -- status unchanged: only while still scheduled (e.g. rescheduling match_time)
      (
        (select status from public.matches as m where m.id = matches.id) = matches.status
        and matches.status = 'scheduled'
      )
      or public.is_valid_match_transition(
        (select status from public.matches as m where m.id = matches.id),
        matches.status
      )
    )
    and (
      matches.match_time = (select match_time from public.matches as m where m.id = matches.id)
      or (
        (select status from public.matches as m where m.id = matches.id)
          not in ('live', 'halftime', 'finished')
        and (
          select status from public.tournaments where id = matches.tournament_id
        ) not in ('finished', 'archived')
      )
    )
  );
