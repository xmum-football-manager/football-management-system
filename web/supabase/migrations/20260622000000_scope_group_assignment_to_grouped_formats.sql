-- Scope enforce_group_assignment to grouped tournament formats only.
--
-- The original trigger (20260613010000) rejected any group-phase match whose
-- teams lacked a group_label. But plain `round_robin` tournaments also use
-- phase='group' (the matches.phase default) with teams that legitimately have
-- no group assignment (group_label is null by design — groups only exist for
-- `round_robin_knockout`). That made the trigger reject every round-robin
-- fixture, breaking both fixture generation in the app and seed scripts.
--
-- Fix: only enforce the group-assignment invariant when the tournament's format
-- actually uses groups (`round_robin_knockout`). Round-robin and knockout
-- formats are exempt (knockout matches were already skipped via phase).

create or replace function public.enforce_group_assignment_on_match()
returns trigger
language plpgsql security definer as $$
declare
  v_format     text;
  v_home_label text;
  v_away_label text;
begin
  -- Only enforce on group-phase matches.
  if NEW.phase is distinct from 'group' then
    return NEW;
  end if;

  -- Only grouped formats carry group assignments; plain round_robin does not.
  select format
    into v_format
    from public.tournaments
   where id = NEW.tournament_id;

  if v_format is distinct from 'round_robin_knockout' then
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
