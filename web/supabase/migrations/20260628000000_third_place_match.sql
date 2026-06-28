-- Third-place playoff support.
--
-- A third-place match is a normal phase='knockout' match with
-- knockout_round = 'third'. Unlike every other knockout match it is fed by the
-- LOSERS of its two source matches (the semifinals), not their winners.
--
-- 1. home_loser_source_match_id / away_loser_source_match_id record which match
--    feeds each slot with its LOSER. When that source match finishes with a
--    winner, the trigger below fills the slot with the team that did NOT win.
-- 2. advance_knockout_winner is extended to fan out losers into these slots,
--    alongside the existing winner fan-out.

alter table public.matches
  add column if not exists home_loser_source_match_id uuid references public.matches(id) on delete set null,
  add column if not exists away_loser_source_match_id uuid references public.matches(id) on delete set null;

-- Trigger function: propagate winners into downstream winner-slots AND losers
-- into downstream loser-slots (the third-place playoff).
-- The loser of a finished match is whichever of home/away is not the winner.
-- Security-definer so it can write without RLS interference.
-- The WHEN clause on the trigger stops recursion: child-row updates change
-- home/away_team_id but leave status != 'finished', so the guard never fires.
create or replace function public.advance_knockout_winner()
returns trigger
language plpgsql security definer as $$
declare
  v_loser_team_id uuid;
begin
  -- Fan out the winner to matches where this match feeds the home slot.
  -- (SET target columns must NOT be alias-qualified in Postgres.)
  update public.matches
    set home_team_id = NEW.winner_team_id
    where home_source_match_id = NEW.id
      and home_team_id is distinct from NEW.winner_team_id;

  -- Fan out the winner to matches where this match feeds the away slot.
  update public.matches
    set away_team_id = NEW.winner_team_id
    where away_source_match_id = NEW.id
      and away_team_id is distinct from NEW.winner_team_id;

  -- The losing team is the side that is not the winner. If either team id is
  -- null we cannot resolve a loser, so leave the loser slots untouched.
  if NEW.home_team_id is not null and NEW.away_team_id is not null then
    v_loser_team_id := case
      when NEW.winner_team_id = NEW.home_team_id then NEW.away_team_id
      else NEW.home_team_id
    end;

    -- Fan out the loser to matches where this match feeds the home loser-slot.
    update public.matches
      set home_team_id = v_loser_team_id
      where home_loser_source_match_id = NEW.id
        and home_team_id is distinct from v_loser_team_id;

    -- Fan out the loser to matches where this match feeds the away loser-slot.
    update public.matches
      set away_team_id = v_loser_team_id
      where away_loser_source_match_id = NEW.id
        and away_team_id is distinct from v_loser_team_id;
  end if;

  return NEW;
end;
$$;

-- Trigger definition is unchanged from 20260611150000_knockout_advance.sql;
-- re-create it defensively in case this migration runs against a database where
-- the function was replaced out-of-band.
drop trigger if exists trg_advance_knockout_winner on public.matches;

create trigger trg_advance_knockout_winner
  after update on public.matches
  for each row
  when (NEW.status = 'finished' and NEW.winner_team_id is not null)
  execute function public.advance_knockout_winner();
