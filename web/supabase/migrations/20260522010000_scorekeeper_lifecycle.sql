-- Allow scorekeepers to drive match lifecycle (Kickoff / Half Time / Full Time)
-- in addition to updating scores. The valid-transition function is reused so
-- the same DB-enforced state machine applies; admin-only revert (finished →
-- live) remains admin-gated inside that function.

drop policy if exists "matches_update_scorekeeper_score" on public.matches;

create policy "matches_update_scorekeeper"
  on public.matches for update
  using (
    public.is_scorekeeper(id)
    and not public.is_organizer(tournament_id)
  )
  with check (
    -- Score-only updates (status unchanged) allowed only while live.
    (
      (select status from public.matches as m where m.id = matches.id) = matches.status
      and matches.status = 'live'
    )
    or
    -- Lifecycle transitions per the valid-transition function.
    public.is_valid_match_transition(
      (select status from public.matches as m where m.id = matches.id),
      matches.status
    )
  );
