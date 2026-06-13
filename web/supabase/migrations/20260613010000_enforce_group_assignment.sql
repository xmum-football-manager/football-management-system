-- Enforce group assignment on group-phase match creation/update.
--
-- When a group-phase match is inserted or its team slots are updated, verify
-- that each non-null team_id has a non-null group_label in the teams table.
-- Knockout matches (phase != 'group') are skipped entirely.
-- TBD knockout slots (null team ids) are implicitly skipped by the null check.
--
-- This enforces the ASSIGNED part of the groups-complete invariant at the DB
-- level, catching direct/service-role inserts that bypass the server gate.
-- The FULL aggregate check (all groups must have exactly teams_per_group teams)
-- is enforced by the server gate in fixtures/actions.ts generateGroupFixturesAction.

create or replace function public.enforce_group_assignment_on_match()
returns trigger
language plpgsql security definer as $$
declare
  v_home_label text;
  v_away_label text;
begin
  -- Only enforce on group-phase matches.
  if NEW.phase is distinct from 'group' then
    return NEW;
  end if;

  -- Check home team (skip TBD null slots).
  if NEW.home_team_id is not null then
    select group_label
      into v_home_label
      from public.teams
     where id = NEW.home_team_id;

    if v_home_label is null then
      raise exception
        'home team has no group assignment (team_id: %)',
        NEW.home_team_id;
    end if;
  end if;

  -- Check away team (skip TBD null slots).
  if NEW.away_team_id is not null then
    select group_label
      into v_away_label
      from public.teams
     where id = NEW.away_team_id;

    if v_away_label is null then
      raise exception
        'away team has no group assignment (team_id: %)',
        NEW.away_team_id;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_group_assignment on public.matches;

create trigger trg_enforce_group_assignment
  before insert or update of home_team_id, away_team_id, phase on public.matches
  for each row
  execute function public.enforce_group_assignment_on_match();
