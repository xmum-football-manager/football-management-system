-- Football Tournament Scoring & Sharing System
-- Phase 1 Schema with RLS policies
-- Run this in Supabase SQL editor

-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- Tournaments
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  location text,
  start_date date not null,
  end_date date not null,
  format text not null default 'round_robin' check (format in ('round_robin', 'round_robin_knockout', 'knockout')),
  points_win numeric(4,1) not null default 3,
  points_draw numeric(4,1) not null default 1,
  points_loss numeric(4,1) not null default 0,
  status text not null default 'setup' check (status in ('setup', 'active', 'finished', 'archived')),
  first_match_scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tournament_id, name)
);

-- Players (roster)
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  jersey_number integer,
  created_at timestamptz not null default now()
);

-- Matches
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  match_time timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  home_score integer not null default 0,
  away_score integer not null default 0,
  match_started_at timestamptz,
  match_finished_at timestamptz,
  halftime_started_at timestamptz,
  second_half_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint different_teams check (home_team_id <> away_team_id)
);

-- User roles (global admin, per-tournament organizer, per-tournament or per-match scorekeeper)
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'organizer', 'scorekeeper')),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- admin: tournament_id null, match_id null
  -- organizer: tournament_id set, match_id null
  -- scorekeeper: tournament_id set (tournament-wide) OR match_id set (match-specific)
  constraint valid_admin check (
    role <> 'admin' or (tournament_id is null and match_id is null)
  ),
  constraint valid_organizer check (
    role <> 'organizer' or (tournament_id is not null and match_id is null)
  ),
  unique (user_id, role, tournament_id, match_id)
);

-- Admin audit log (for match reverts FR-22)
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  action text not null,
  match_id uuid references public.matches(id),
  tournament_id uuid references public.tournaments(id),
  previous_status text,
  new_status text,
  note text,
  created_at timestamptz not null default now()
);

-- Goals (per-scorer record, kept in sync with match scores).
-- player_id is nullable: a goal can be logged without naming the scorer.
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  player_id uuid references public.players(id),
  created_at timestamptz not null default now()
);

-- Cards
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  player_id uuid not null references public.players(id),
  card_type text not null check (card_type in ('yellow', 'red')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- STANDINGS VIEW (computed from matches, no app-layer logic)
-- ============================================================
create or replace view public.standings as
select
  t.id as tournament_id,
  tm.id as team_id,
  tm.name as team_name,
  count(m.id) as matches_played,
  count(case
    when (m.home_team_id = tm.id and m.home_score > m.away_score)
      or (m.away_team_id = tm.id and m.away_score > m.home_score)
    then 1 end) as wins,
  count(case
    when m.home_score = m.away_score then 1 end) as draws,
  count(case
    when (m.home_team_id = tm.id and m.home_score < m.away_score)
      or (m.away_team_id = tm.id and m.away_score < m.home_score)
    then 1 end) as losses,
  coalesce(sum(case when m.home_team_id = tm.id then m.home_score
                    when m.away_team_id = tm.id then m.away_score
                    else 0 end), 0) as goals_scored,
  coalesce(sum(case when m.home_team_id = tm.id then m.away_score
                    when m.away_team_id = tm.id then m.home_score
                    else 0 end), 0) as goals_conceded,
  coalesce(sum(case when m.home_team_id = tm.id then m.home_score - m.away_score
                    when m.away_team_id = tm.id then m.away_score - m.home_score
                    else 0 end), 0) as goal_difference,
  coalesce(
    sum(case
      when (m.home_team_id = tm.id and m.home_score > m.away_score)
        or (m.away_team_id = tm.id and m.away_score > m.home_score)
      then t_ref.points_win
      when m.home_score = m.away_score
      then t_ref.points_draw
      when (m.home_team_id = tm.id and m.home_score < m.away_score)
        or (m.away_team_id = tm.id and m.away_score < m.home_score)
      then t_ref.points_loss
      else 0
    end), 0
  ) as points
from public.tournaments t
join public.teams tm on tm.tournament_id = t.id
join public.tournaments t_ref on t_ref.id = t.id
left join public.matches m
  on m.tournament_id = t.id
  and m.status = 'finished'
  and (m.home_team_id = tm.id or m.away_team_id = tm.id)
group by t.id, tm.id, tm.name, t_ref.points_win, t_ref.points_draw, t_ref.points_loss;

-- Top scorers view
create or replace view public.top_scorers as
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

-- Team card counts view
create or replace view public.team_card_counts as
select
  team_id,
  count(*) filter (where card_type = 'yellow') as yellow,
  count(*) filter (where card_type = 'red') as red
from public.cards
group by team_id;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tournaments_updated_at
  before update on public.tournaments
  for each row execute function public.update_updated_at();

create trigger matches_updated_at
  before update on public.matches
  for each row execute function public.update_updated_at();

-- ============================================================
-- HELPER FUNCTIONS (used in RLS policies)
-- ============================================================

-- Check if requesting user is global admin
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- Check if requesting user is organizer for a tournament
create or replace function public.is_organizer(t_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role = 'organizer'
      and tournament_id = t_id
  ) or public.is_admin();
$$;

-- Check if requesting user is scorekeeper for a match (tournament-wide or match-specific)
create or replace function public.is_scorekeeper(m_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.user_roles ur
    join public.matches m on m.id = m_id
    where ur.user_id = auth.uid()
      and ur.role = 'scorekeeper'
      and (
        ur.match_id = m_id
        or ur.tournament_id = m.tournament_id
      )
  ) or public.is_organizer((select tournament_id from public.matches where id = m_id));
$$;

-- record_goal: insert goals row + increment match score atomically.
-- Takes the scoring team explicitly; p_player_id is optional (null = unspecified).
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
  select home_team_id, away_team_id
    into v_home_team_id, v_away_team_id
    from public.matches where id = p_match_id;
  if v_home_team_id is null then
    raise exception 'Match not found';
  end if;

  if p_team_id <> v_home_team_id and p_team_id <> v_away_team_id then
    raise exception 'Team is not participating in this match';
  end if;

  if p_player_id is not null then
    select team_id into v_player_team_id from public.players where id = p_player_id;
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
    update public.matches set home_score = home_score + 1 where id = p_match_id;
  else
    update public.matches set away_score = away_score + 1 where id = p_match_id;
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
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.user_roles enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.goals enable row level security;
alter table public.cards enable row level security;

-- TOURNAMENTS
-- Anyone (anon + auth) can read tournaments
create policy "tournaments_select_public"
  on public.tournaments for select
  using (true);

-- Only admin/organizer can insert
create policy "tournaments_insert_admin_organizer"
  on public.tournaments for insert
  with check (public.is_admin());

-- Organizer can update their own tournament; admin can update any
create policy "tournaments_update"
  on public.tournaments for update
  using (public.is_organizer(id));

-- TEAMS
create policy "teams_select_public"
  on public.teams for select
  using (true);

create policy "teams_insert_organizer"
  on public.teams for insert
  with check (public.is_organizer(tournament_id));

create policy "teams_update_organizer"
  on public.teams for update
  using (public.is_organizer(tournament_id));

create policy "teams_delete_organizer"
  on public.teams for delete
  using (public.is_organizer(tournament_id));

-- PLAYERS
create policy "players_select_public"
  on public.players for select
  using (true);

create policy "players_insert_organizer"
  on public.players for insert
  with check (
    public.is_organizer((select tournament_id from public.teams where id = team_id))
  );

create policy "players_update_organizer"
  on public.players for update
  using (
    public.is_organizer((select tournament_id from public.teams where id = team_id))
  );

create policy "players_delete_organizer"
  on public.players for delete
  using (
    public.is_organizer((select tournament_id from public.teams where id = team_id))
  );

-- MATCHES
create policy "matches_select_public"
  on public.matches for select
  using (true);

create policy "matches_insert_organizer"
  on public.matches for insert
  with check (public.is_organizer(tournament_id));

-- Score updates: scorekeeper can update home_score/away_score on their assigned live match
-- Organizer can update status transitions + scores
create policy "matches_update_scorekeeper_score"
  on public.matches for update
  using (
    (status = 'live' and public.is_scorekeeper(id))
    or public.is_organizer(tournament_id)
  );

-- USER ROLES
create policy "user_roles_select_own"
  on public.user_roles for select
  using (user_id = auth.uid() or public.is_admin());

create policy "user_roles_insert_admin_organizer"
  on public.user_roles for insert
  with check (
    public.is_admin()
    or (
      role = 'scorekeeper'
      and public.is_organizer(tournament_id)
    )
  );

create policy "user_roles_delete_admin_organizer"
  on public.user_roles for delete
  using (
    public.is_admin()
    or (
      role = 'scorekeeper'
      and public.is_organizer(tournament_id)
    )
  );

-- GOALS
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

-- CARDS
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

-- ADMIN AUDIT LOG
create policy "audit_log_select_admin"
  on public.admin_audit_log for select
  using (public.is_admin());

create policy "audit_log_insert_admin"
  on public.admin_audit_log for insert
  with check (public.is_admin());

-- ============================================================
-- REALTIME
-- Enable Realtime for score broadcasting to participants
-- ============================================================
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.tournaments;
alter publication supabase_realtime add table public.goals;
alter publication supabase_realtime add table public.cards;

-- ============================================================
-- HELPER: resolve email → user_id (used by scorekeeper assignment)
-- Called with .rpc('get_user_id_by_email', { email_input: '...' })
-- ============================================================
create or replace function public.get_user_id_by_email(email_input text)
returns uuid language sql security definer stable as $$
  select id from auth.users where email = email_input limit 1;
$$;
