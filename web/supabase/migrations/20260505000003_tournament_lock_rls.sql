-- Enforce tournament edit-lock rules at the DB layer via RLS.
--
-- Teams:
--   INSERT blocked when tournament status in ('active', 'finished', 'archived')
--   DELETE blocked when tournament status in ('active', 'finished', 'archived')
--
-- Matches (fixtures):
--   INSERT blocked when tournament status in ('finished', 'archived')
--   DELETE blocked when tournament status in ('finished', 'archived')
--   UPDATE of match_time blocked when match status in ('live', 'halftime', 'finished')
--   UPDATE of match_time blocked when tournament status in ('finished', 'archived')
--
-- Tournaments:
--   UPDATE of start_date / end_date blocked when status in ('active', 'finished', 'archived')

-- ============================================================
-- TEAMS — replace insert/delete policies to add lock check
-- ============================================================
drop policy if exists "teams_insert_organizer" on public.teams;
create policy "teams_insert_organizer"
  on public.teams for insert
  with check (
    public.is_organizer(tournament_id)
    and (
      select status from public.tournaments where id = tournament_id
    ) not in ('active', 'finished', 'archived')
  );

drop policy if exists "teams_delete_organizer" on public.teams;
create policy "teams_delete_organizer"
  on public.teams for delete
  using (
    public.is_organizer(tournament_id)
    and (
      select status from public.tournaments where id = tournament_id
    ) not in ('active', 'finished', 'archived')
  );

-- ============================================================
-- MATCHES — replace insert policy to add lock check
-- ============================================================
drop policy if exists "matches_insert_organizer" on public.matches;
create policy "matches_insert_organizer"
  on public.matches for insert
  with check (
    public.is_organizer(tournament_id)
    and (
      select status from public.tournaments where id = tournament_id
    ) not in ('finished', 'archived')
  );

-- Matches DELETE — no delete policy existed; create one
-- (organizer can delete fixtures unless tournament is finished/archived)
create policy "matches_delete_organizer"
  on public.matches for delete
  using (
    public.is_organizer(tournament_id)
    and (
      select status from public.tournaments where id = tournament_id
    ) not in ('finished', 'archived')
  );

-- ============================================================
-- MATCHES — match_time lock via WITH CHECK on update policies
--
-- The existing update policies ("matches_update_scorekeeper_score"
-- and "matches_update_organizer_transition") allow match_time edits
-- implicitly.  We add WITH CHECK guards here by replacing them.
--
-- Scorekeeper policy: already has with check (status = 'live'),
-- scorekeepers never touch match_time so no change needed there.
--
-- Organizer policy: drop and recreate with match_time guard.
-- ============================================================
drop policy if exists "matches_update_organizer_transition" on public.matches;
create policy "matches_update_organizer_transition"
  on public.matches for update
  using (public.is_organizer(tournament_id))
  with check (
    public.is_organizer(tournament_id)
    and public.is_valid_match_transition(
      (select status from public.matches where id = matches.id),
      matches.status
    )
    -- Block match_time edits when match is live/halftime/finished
    -- or when tournament is finished/archived.
    -- If match_time is unchanged the condition below is trivially true.
    and (
      -- match_time unchanged → always ok
      matches.match_time = (select match_time from public.matches where id = matches.id)
      -- match_time changed → only allowed when match is scheduled
      -- AND tournament is not finished/archived
      or (
        (select status from public.matches where id = matches.id)
          not in ('live', 'halftime', 'finished')
        and (
          select status from public.tournaments where id = matches.tournament_id
        ) not in ('finished', 'archived')
      )
    )
  );

-- ============================================================
-- TOURNAMENTS — block start_date / end_date edits when locked
-- ============================================================
drop policy if exists "tournaments_update" on public.tournaments;
create policy "tournaments_update"
  on public.tournaments for update
  using (public.is_organizer(id))
  with check (
    public.is_organizer(id)
    and (
      -- dates unchanged → always ok regardless of status
      (
        start_date = (select start_date from public.tournaments where id = tournaments.id)
        and end_date = (select end_date from public.tournaments where id = tournaments.id)
      )
      -- dates changed → only allowed when tournament is in setup status
      or (
        select status from public.tournaments where id = tournaments.id
      ) not in ('active', 'finished', 'archived')
    )
  );
