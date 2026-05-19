-- ============================================================
-- Date validation constraints
-- Ensures data integrity at the database level, not just frontend.
-- ============================================================
-- ROLLBACK:
-- DROP TRIGGER IF EXISTS trg_validate_match_time ON public.matches;
-- DROP TRIGGER IF EXISTS trg_validate_tournament_dates ON public.tournaments;
-- DROP FUNCTION IF EXISTS public.validate_match_time();
-- DROP FUNCTION IF EXISTS public.validate_tournament_dates();
-- ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_dates_valid;

-- 1. Tournament end_date must be >= start_date
alter table public.tournaments
  add constraint tournaments_dates_valid
  check (end_date >= start_date);

-- 2. Validate match_time falls within tournament date range
--    Uses a trigger because CHECK cannot reference other tables.
create or replace function public.validate_match_time()
returns trigger
language plpgsql
as $$
declare
  t_start date;
  t_end   date;
begin
  select start_date, end_date into t_start, t_end
    from public.tournaments where id = new.tournament_id;

  if t_start is null then
    raise exception 'Tournament % not found', new.tournament_id;
  end if;

  if new.match_time::date < t_start or new.match_time::date > t_end then
    raise exception 'match_time (%) must be between tournament start_date (%) and end_date (%)',
      new.match_time::date, t_start, t_end;
  end if;

  return new;
end;
$$;

create trigger trg_validate_match_time
  before insert or update of match_time, tournament_id
  on public.matches
  for each row
  execute function public.validate_match_time();

-- 3. Prevent tournament date updates that would exclude existing matches
create or replace function public.validate_tournament_dates()
returns trigger
language plpgsql
as $$
declare
  earliest_match date;
  latest_match   date;
begin
  if new.start_date = old.start_date and new.end_date = old.end_date then
    return new;
  end if;

  select min(match_time::date), max(match_time::date)
    into earliest_match, latest_match
    from public.matches
    where tournament_id = new.id;

  if earliest_match is not null then
    if new.start_date > earliest_match then
      raise exception 'Cannot move start_date to % — a match is scheduled on %',
        new.start_date, earliest_match;
    end if;
    if new.end_date < latest_match then
      raise exception 'Cannot move end_date to % — a match is scheduled on %',
        new.end_date, latest_match;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_validate_tournament_dates
  before update of start_date, end_date
  on public.tournaments
  for each row
  execute function public.validate_tournament_dates();
