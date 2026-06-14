-- Enforce minimum players per team on match creation/update.
--
-- When a match is inserted or its team slots are updated, look up the
-- tournament's min_players_per_team and verify that each non-null team has
-- at least that many players.  TBD knockout slots (null team ids) are skipped
-- so later-round bracket rows can be created before the teams are known.
-- Winner-advancement updates (team already played → they have players) pass
-- naturally since those teams already satisfied the check at bracket creation.
--
-- If min_players_per_team is null the trigger is a no-op (safety valve).

create or replace function public.enforce_min_players_on_match()
returns trigger
language plpgsql security definer as $$
declare
  v_min    int;
  v_home_count int;
  v_away_count int;
begin
  -- Look up the tournament minimum.
  select min_players_per_team
    into v_min
    from public.tournaments
   where id = NEW.tournament_id;

  -- Safety valve: if the column is somehow null, allow the insert.
  if v_min is null then
    return NEW;
  end if;

  -- Check home team (skip TBD null slots).
  if NEW.home_team_id is not null then
    select count(*) into v_home_count
      from public.players
     where team_id = NEW.home_team_id;

    if v_home_count < v_min then
      raise exception
        'home team has % player(s) but tournament requires at least % (team_id: %)',
        v_home_count, v_min, NEW.home_team_id;
    end if;
  end if;

  -- Check away team (skip TBD null slots).
  if NEW.away_team_id is not null then
    select count(*) into v_away_count
      from public.players
     where team_id = NEW.away_team_id;

    if v_away_count < v_min then
      raise exception
        'away team has % player(s) but tournament requires at least % (team_id: %)',
        v_away_count, v_min, NEW.away_team_id;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_min_players on public.matches;

create trigger trg_enforce_min_players
  before insert or update of home_team_id, away_team_id on public.matches
  for each row
  execute function public.enforce_min_players_on_match();
