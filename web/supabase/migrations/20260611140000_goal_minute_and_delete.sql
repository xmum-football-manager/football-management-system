-- Goal match-minute + delete-specific-goal.
--
-- 1. goals.elapsed_seconds: the match-clock time (in seconds) at which the goal
--    was scored, recorded server-side at insert. Lets the UI show "9'50"" and
--    lets the organizer/scorekeeper pick WHICH goal to remove (not just the last).
-- 2. record_goal now stamps elapsed_seconds from the live match clock.
-- 3. delete_goal(match, goal): removes one specific goal and decrements that
--    goal's team score. Replaces the blunt "undo last goal" for corrections.

alter table public.goals
  add column if not exists elapsed_seconds integer;

-- record_goal: optional-scorer signature (match, team, player) +
-- elapsed_seconds stamped from the match clock (mirrors useMatchClock in ScoreApp).
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
  v_started_at timestamptz;
  v_halftime_at timestamptz;
  v_second_half_at timestamptz;
  v_elapsed integer;
begin
  select m.home_team_id, m.away_team_id,
         m.match_started_at, m.halftime_started_at, m.second_half_started_at
    into v_home_team_id, v_away_team_id,
         v_started_at, v_halftime_at, v_second_half_at
    from public.matches m where m.id = p_match_id;
  if v_home_team_id is null then
    raise exception 'Match not found';
  end if;

  if p_team_id <> v_home_team_id and p_team_id <> v_away_team_id then
    raise exception 'Team is not participating in this match';
  end if;

  if p_player_id is not null then
    select p.team_id into v_player_team_id from public.players p where p.id = p_player_id;
    if v_player_team_id is null then
      raise exception 'Player not found';
    end if;
    if v_player_team_id <> p_team_id then
      raise exception 'Player is not on the scoring team';
    end if;
  end if;

  -- Match clock at this moment, accounting for the halftime gap.
  if v_started_at is null then
    v_elapsed := null;
  elsif v_second_half_at is not null then
    v_elapsed := floor(extract(epoch from (v_halftime_at - v_started_at))
                     + extract(epoch from (now() - v_second_half_at)));
  elsif v_halftime_at is not null then
    -- Scored while paused at halftime: clamp to end of first half.
    v_elapsed := floor(extract(epoch from (v_halftime_at - v_started_at)));
  else
    v_elapsed := floor(extract(epoch from (now() - v_started_at)));
  end if;

  insert into public.goals (match_id, team_id, player_id, elapsed_seconds)
  values (p_match_id, p_team_id, p_player_id, v_elapsed);

  if p_team_id = v_home_team_id then
    update public.matches m set home_score = m.home_score + 1 where m.id = p_match_id;
  else
    update public.matches m set away_score = m.away_score + 1 where m.id = p_match_id;
  end if;

  return query
    select m.home_score, m.away_score from public.matches m where m.id = p_match_id;
end;
$$;

-- delete_goal: remove one specific goal and decrement that goal's team score.
-- p_match_id is verified against the goal so callers can authorize by match.
create or replace function public.delete_goal(p_match_id uuid, p_goal_id uuid)
returns table(home_score integer, away_score integer)
language plpgsql security definer as $$
declare
  v_team_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
begin
  select g.team_id into v_team_id
    from public.goals g
    where g.id = p_goal_id and g.match_id = p_match_id;

  if v_team_id is null then
    -- Nothing to delete (wrong match or already gone); return current scores.
    return query
      select m.home_score, m.away_score from public.matches m where m.id = p_match_id;
    return;
  end if;

  delete from public.goals where id = p_goal_id;

  select m.home_team_id, m.away_team_id
    into v_home_team_id, v_away_team_id
    from public.matches m where m.id = p_match_id;

  if v_team_id = v_home_team_id then
    update public.matches m set home_score = greatest(m.home_score - 1, 0) where m.id = p_match_id;
  else
    update public.matches m set away_score = greatest(m.away_score - 1, 0) where m.id = p_match_id;
  end if;

  return query
    select m.home_score, m.away_score from public.matches m where m.id = p_match_id;
end;
$$;
