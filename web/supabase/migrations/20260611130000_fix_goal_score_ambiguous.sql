-- Fix: record_goal / undo_goal fail with "column reference home_score is ambiguous".
-- Both functions declare RETURNS TABLE(home_score, away_score), so those names are in
-- scope as output columns across the whole body. The UPDATE statements referenced the
-- unqualified columns home_score / away_score, which Postgres cannot disambiguate from
-- the output columns. Alias-qualify every match-column reference (m.home_score, etc).

-- record_goal: optional-scorer signature (match, team, player) from 20260611120000.
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
  select m.home_team_id, m.away_team_id
    into v_home_team_id, v_away_team_id
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

  insert into public.goals (match_id, team_id, player_id)
  values (p_match_id, p_team_id, p_player_id);

  if p_team_id = v_home_team_id then
    update public.matches m set home_score = m.home_score + 1 where m.id = p_match_id;
  else
    update public.matches m set away_score = m.away_score + 1 where m.id = p_match_id;
  end if;

  return query
    select m.home_score, m.away_score from public.matches m where m.id = p_match_id;
end;
$$;

-- undo_goal: unchanged signature (match, team); only the ambiguous UPDATE is fixed.
create or replace function public.undo_goal(p_match_id uuid, p_team_id uuid)
returns table(home_score integer, away_score integer)
language plpgsql security definer as $$
declare
  v_goal_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
begin
  select id into v_goal_id
    from public.goals
    where match_id = p_match_id and team_id = p_team_id
    order by created_at desc
    limit 1;

  if v_goal_id is null then
    return query
      select m.home_score, m.away_score from public.matches m where m.id = p_match_id;
    return;
  end if;

  delete from public.goals where id = v_goal_id;

  select m.home_team_id, m.away_team_id
    into v_home_team_id, v_away_team_id
    from public.matches m where m.id = p_match_id;

  if p_team_id = v_home_team_id then
    update public.matches m set home_score = greatest(m.home_score - 1, 0) where m.id = p_match_id;
  else
    update public.matches m set away_score = greatest(m.away_score - 1, 0) where m.id = p_match_id;
  end if;

  return query
    select m.home_score, m.away_score from public.matches m where m.id = p_match_id;
end;
$$;
