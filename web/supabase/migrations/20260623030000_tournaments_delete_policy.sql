-- Fix: deleting a tournament silently did nothing from the app.
--
-- public.tournaments has RLS enabled (since init) with select/insert/update
-- policies but no delete policy. A delete from the user-scoped client therefore
-- matched zero rows and returned no error, so deleteTournamentAction reported
-- success while the tournament stayed. Every other table (teams, matches,
-- players, goals, cards, user_roles) already has a delete policy; tournaments
-- was missed.
--
-- deleteTournamentAction already requires admin, so scope the policy to admins.
-- Child rows are removed via the existing on-delete cascades.

drop policy if exists "tournaments_delete_admin" on public.tournaments;
create policy "tournaments_delete_admin"
  on public.tournaments for delete
  using (public.is_admin());
