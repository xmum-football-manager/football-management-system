-- Auto-manage tournament.status and tournament.first_match_scheduled_at
-- so they always reflect reality regardless of which role mutated a match.
--
-- Rules:
--   * first_match_scheduled_at = MIN(match_time) across all matches for the tournament.
--     Recomputed on insert / update of match_time / delete.
--   * status auto-advances:
--       'setup'  -> 'active'   when any match status leaves 'scheduled'
--                               (covers kickoff by admin, organizer, or scorekeeper).
--       'active' -> 'finished' is left to manual control; the trigger never finishes
--                               a tournament automatically.
--       Admin revert (finished -> active) is also left to manual control.
--   * 'finished' / 'archived' are never auto-changed.
--
-- The trigger is idempotent and re-entrant safe: it only updates when the value
-- would actually change, so it won't loop with the existing tournaments_updated_at trigger.

create or replace function public.refresh_tournament_first_match()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  earliest timestamptz;
  tid uuid;
begin
  tid := coalesce(new.tournament_id, old.tournament_id);
  if tid is null then
    return coalesce(new, old);
  end if;

  select min(match_time) into earliest from public.matches where tournament_id = tid;

  update public.tournaments
     set first_match_scheduled_at = earliest
   where id = tid
     and first_match_scheduled_at is distinct from earliest;

  return coalesce(new, old);
end;
$$;

drop trigger if exists matches_refresh_first_kickoff on public.matches;
create trigger matches_refresh_first_kickoff
  after insert or delete or update of match_time, tournament_id on public.matches
  for each row execute function public.refresh_tournament_first_match();

-- Auto-activate the tournament the moment any match leaves 'scheduled'.
create or replace function public.auto_activate_tournament()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and old.status = 'scheduled'
     and new.status <> 'scheduled' then
    update public.tournaments
       set status = 'active'
     where id = new.tournament_id
       and status = 'setup';
  end if;
  return new;
end;
$$;

drop trigger if exists matches_auto_activate_tournament on public.matches;
create trigger matches_auto_activate_tournament
  after update of status on public.matches
  for each row execute function public.auto_activate_tournament();

-- Backfill first_match_scheduled_at and status for any existing data.
update public.tournaments t
   set first_match_scheduled_at = sub.earliest
  from (
    select tournament_id, min(match_time) as earliest
      from public.matches
     group by tournament_id
  ) sub
 where sub.tournament_id = t.id
   and t.first_match_scheduled_at is distinct from sub.earliest;

update public.tournaments t
   set status = 'active'
 where t.status = 'setup'
   and exists (
     select 1 from public.matches m
      where m.tournament_id = t.id
        and m.status <> 'scheduled'
   );
