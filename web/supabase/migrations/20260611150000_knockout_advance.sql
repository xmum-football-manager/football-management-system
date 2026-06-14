-- Knockout bracket: full-bracket creation + automatic winner advancement.
--
-- 1. home_team_id / away_team_id become nullable to hold TBD slots for
--    later-round matches whose teams are not known at bracket-creation time.
-- 2. home_source_match_id / away_source_match_id record which earlier-round
--    match feeds each slot. When that match finishes, the trigger below fills
--    the team in automatically.
-- 3. winner_team_id records the advancing team. For a drawn knockout match the
--    organizer must set this manually before the match can be marked finished.
-- 4. advance_knockout_winner trigger: after a match is updated to finished with
--    a winner_team_id, it fans out the winner into every match that lists this
--    match as a source.

alter table public.matches alter column home_team_id drop not null;
alter table public.matches alter column away_team_id drop not null;

alter table public.matches
  add column if not exists home_source_match_id uuid references public.matches(id) on delete set null,
  add column if not exists away_source_match_id uuid references public.matches(id) on delete set null,
  add column if not exists winner_team_id uuid references public.teams(id);

-- Trigger function: propagate winner into downstream slots.
-- Security-definer so it can write without RLS interference.
-- The WHEN clause on the trigger stops recursion: child-row updates change
-- home/away_team_id but leave status != 'finished', so the guard never fires.
create or replace function public.advance_knockout_winner()
returns trigger
language plpgsql security definer as $$
begin
  -- Fan out to matches where this match feeds the home slot.
  -- (SET target columns must NOT be alias-qualified in Postgres.)
  update public.matches
    set home_team_id = NEW.winner_team_id
    where home_source_match_id = NEW.id
      and home_team_id is distinct from NEW.winner_team_id;

  -- Fan out to matches where this match feeds the away slot
  update public.matches
    set away_team_id = NEW.winner_team_id
    where away_source_match_id = NEW.id
      and away_team_id is distinct from NEW.winner_team_id;

  return NEW;
end;
$$;

drop trigger if exists trg_advance_knockout_winner on public.matches;

create trigger trg_advance_knockout_winner
  after update on public.matches
  for each row
  when (NEW.status = 'finished' and NEW.winner_team_id is not null)
  execute function public.advance_knockout_winner();
