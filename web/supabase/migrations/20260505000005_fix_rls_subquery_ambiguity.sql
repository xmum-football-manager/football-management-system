-- Fix ambiguous correlated subqueries in RLS policies.
--
-- The subquery pattern `(select status from public.matches where id = matches.id)`
-- was ambiguous — `matches.id` inside the subquery resolved to the inner table,
-- making `id = id` always true and returning ALL rows, causing:
--   "more than one row returned by a subquery used as an expression"
--
-- Fixed by adding an explicit alias on the inner table so the correlation
-- reference is unambiguous: (select status from public.matches as m where m.id = matches.id)

-- ============================================================
-- MATCHES — organizer update policy
-- ============================================================
drop policy if exists "matches_update_organizer_transition" on public.matches;
create policy "matches_update_organizer_transition"
  on public.matches for update
  using (public.is_organizer(tournament_id))
  with check (
    public.is_organizer(tournament_id)
    and public.is_valid_match_transition(
      (select status from public.matches as m where m.id = matches.id),
      matches.status
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

-- ============================================================
-- TOURNAMENTS — update policy
-- ============================================================
drop policy if exists "tournaments_update" on public.tournaments;
create policy "tournaments_update"
  on public.tournaments for update
  using (public.is_organizer(id))
  with check (
    public.is_organizer(id)
    and (
      (start_date = (select start_date from public.tournaments as t where t.id = tournaments.id)
      and end_date = (select end_date from public.tournaments as t where t.id = tournaments.id))
      or (select status from public.tournaments as t where t.id = tournaments.id) not in ('active', 'finished', 'archived')
    )
  );
