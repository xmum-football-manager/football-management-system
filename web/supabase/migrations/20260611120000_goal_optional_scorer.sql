-- Allow recording a goal without naming the scorer ("Don't specify").
-- goals.player_id becomes nullable, and record_goal now takes the team
-- explicitly (so an unspecified goal can still be attributed to a side).
--
-- NOTE: this migration was originally applied directly to the remote DB and is
-- recreated here so local migration history matches remote. The record_goal body
-- below still contains the "home_score is ambiguous" bug; it is corrected in the
-- follow-up migration 20260611130000_fix_goal_score_ambiguous.sql.

alter table public.goals alter column player_id drop not null;

-- Old signature resolved the team from the player; the new one takes the team
-- directly with an optional scorer. Drop the old overload to avoid ambiguity.
drop function if exists public.record_goal(uuid, uuid);

create or replace function public.record_goal(
  p_match_id uuid,
  p_team_id uuid,
  p_player_id uuid default null
)
returns table(home_score integer, away_score integer)
language plpgsql security definer as $$
declare
  v_home_team_id uuid;
  v_away_team_id uuid;
  v_player_team_id uuid;
begin
  -- get match sides
  select home_team_id, away_team_id
    into v_home_team_id, v_away_team_id
    from public.matches where id = p_match_id;
  if v_home_team_id is null then
    raise exception 'Match not found';
  end if;

  -- team must be one of the two playing
  if p_team_id <> v_home_team_id and p_team_id <> v_away_team_id then
    raise exception 'Team is not participating in this match';
  end if;

  -- if a scorer is named, they must belong to the scoring team
  if p_player_id is not null then
    select team_id into v_player_team_id from public.players where id = p_player_id;
    if v_player_team_id is null then
      raise exception 'Player not found';
    end if;
    if v_player_team_id <> p_team_id then
      raise exception 'Player is not on the scoring team';
    end if;
  end if;

  -- insert goal record (player_id may be null = unspecified scorer)
  insert into public.goals (match_id, team_id, player_id)
  values (p_match_id, p_team_id, p_player_id);

  -- increment the correct side
  if p_team_id = v_home_team_id then
    update public.matches set home_score = home_score + 1 where id = p_match_id;
  else
    update public.matches set away_score = away_score + 1 where id = p_match_id;
  end if;

  return query
    select m.home_score, m.away_score from public.matches m where m.id = p_match_id;
end;
$$;
