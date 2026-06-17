-- The app-level admin revert was changed from finished → live to
-- finished → scheduled (see lib/match-lifecycle.ts ADMIN_EXTRA_TRANSITIONS),
-- but this DB-enforced transition table was never updated to match. The RLS
-- WITH CHECK on matches_update_organizer_transition silently rejected the
-- new transition (0 rows updated, no error surfaced to the client), so the
-- "Revert" button appeared to succeed but never actually changed the match.
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
    when from_status = 'finished'  and to_status = 'scheduled' then public.is_admin()
    -- everything else denied
    else false
  end;
$$;
