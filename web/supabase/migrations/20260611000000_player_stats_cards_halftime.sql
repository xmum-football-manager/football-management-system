-- Player stats, card tracking, halftime columns, drop position

-- ============================================================
-- GOALS TABLE
-- ============================================================
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  player_id uuid not null references public.players(id),
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "goals_select_public"
  on public.goals for select
  using (true);

create policy "goals_insert_scorekeeper"
  on public.goals for insert
  with check (
    public.is_scorekeeper(match_id)
    and (select status from public.matches where id = match_id) = 'live'
  );

create policy "goals_delete_scorekeeper"
  on public.goals for delete
  using (
    public.is_scorekeeper(match_id)
    and (select status from public.matches where id = match_id) = 'live'
  );

alter publication supabase_realtime add table public.goals;

-- ============================================================
-- CARDS TABLE
-- ============================================================
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  player_id uuid not null references public.players(id),
  card_type text not null check (card_type in ('yellow', 'red')),
  created_at timestamptz not null default now()
);

alter table public.cards enable row level security;

create policy "cards_select_public"
  on public.cards for select
  using (true);

create policy "cards_insert_scorekeeper"
  on public.cards for insert
  with check (
    public.is_scorekeeper(match_id)
    and (select status from public.matches where id = match_id) = 'live'
  );

create policy "cards_delete_scorekeeper"
  on public.cards for delete
  using (
    public.is_scorekeeper(match_id)
    and (select status from public.matches where id = match_id) = 'live'
  );

alter publication supabase_realtime add table public.cards;

-- ============================================================
-- VIEWS
-- ============================================================
create view public.top_scorers as
select
  g.player_id,
  p.name as player_name,
  t.id as team_id,
  t.name as team_name,
  tm.tournament_id,
  count(*) as goals
from public.goals g
join public.players p on p.id = g.player_id
join public.teams t on t.id = g.team_id
join public.matches tm on tm.id = g.match_id
group by g.player_id, p.name, t.id, t.name, tm.tournament_id;

create view public.team_card_counts as
select
  team_id,
  count(*) filter (where card_type = 'yellow') as yellow,
  count(*) filter (where card_type = 'red') as red
from public.cards
group by team_id;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- record_goal: insert goals row + increment match score atomically
create or replace function public.record_goal(p_match_id uuid, p_player_id uuid)
returns table(home_score integer, away_score integer)
language plpgsql security definer as $$
declare
  v_team_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
begin
  -- resolve player's team
  select team_id into v_team_id from public.players where id = p_player_id;
  if v_team_id is null then
    raise exception 'Player not found';
  end if;

  -- get match sides
  select home_team_id, away_team_id
    into v_home_team_id, v_away_team_id
    from public.matches where id = p_match_id;
  if v_home_team_id is null then
    raise exception 'Match not found';
  end if;

  -- insert goal record
  insert into public.goals (match_id, team_id, player_id)
  values (p_match_id, v_team_id, p_player_id);

  -- increment the correct side
  if v_team_id = v_home_team_id then
    update public.matches set home_score = home_score + 1 where id = p_match_id;
  elsif v_team_id = v_away_team_id then
    update public.matches set away_score = away_score + 1 where id = p_match_id;
  else
    raise exception 'Player team is not participating in this match';
  end if;

  return query
    select m.home_score, m.away_score from public.matches m where m.id = p_match_id;
end;
$$;

-- undo_goal: delete most recent goal for team+match and decrement score (floor 0)
create or replace function public.undo_goal(p_match_id uuid, p_team_id uuid)
returns table(home_score integer, away_score integer)
language plpgsql security definer as $$
declare
  v_goal_id uuid;
  v_home_team_id uuid;
  v_away_team_id uuid;
begin
  -- find most recent goal for this team in this match
  select id into v_goal_id
    from public.goals
    where match_id = p_match_id and team_id = p_team_id
    order by created_at desc
    limit 1;

  if v_goal_id is null then
    -- nothing to undo, return current scores
    return query
      select m.home_score, m.away_score from public.matches m where m.id = p_match_id;
    return;
  end if;

  delete from public.goals where id = v_goal_id;

  -- get match sides
  select home_team_id, away_team_id
    into v_home_team_id, v_away_team_id
    from public.matches where id = p_match_id;

  if p_team_id = v_home_team_id then
    update public.matches
      set home_score = greatest(home_score - 1, 0)
      where id = p_match_id;
  else
    update public.matches
      set away_score = greatest(away_score - 1, 0)
      where id = p_match_id;
  end if;

  return query
    select m.home_score, m.away_score from public.matches m where m.id = p_match_id;
end;
$$;

-- ============================================================
-- MATCHES: halftime columns
-- ============================================================
alter table public.matches
  add column halftime_started_at timestamptz,
  add column second_half_started_at timestamptz;

-- ============================================================
-- PLAYERS: drop position
-- ============================================================
alter table public.players drop column position;
