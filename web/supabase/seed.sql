-- ============================================================
-- DUMMY SEED DATA — XMU-26 Tournament Preview
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ⚠️ Save the tournament UUID printed at the bottom — you'll need it for the URL
-- ============================================================

do $$
declare
  t_id     uuid := gen_random_uuid();
  team_a   uuid := gen_random_uuid();
  team_b   uuid := gen_random_uuid();
  team_c   uuid := gen_random_uuid();
  team_d   uuid := gen_random_uuid();
  m1       uuid := gen_random_uuid();
  m2       uuid := gen_random_uuid();
  m3       uuid := gen_random_uuid();
  m4       uuid := gen_random_uuid();
  m5       uuid := gen_random_uuid();
begin

  -- ── Tournament ──────────────────────────────────────────────
  insert into public.tournaments (id, name, description, location, start_date, end_date, format, status)
  values (
    t_id,
    'XMU Cup 2025',
    'Annual inter-faculty football tournament at Xiamen University Malaysia',
    'XMU Sports Complex · Sepang',
    '2025-05-01',
    '2025-05-31',
    'round_robin',   -- change to 'round_robin_knockout' to see Bracket tab
    'active'
  );

  -- ── Teams ────────────────────────────────────────────────────
  insert into public.teams (id, tournament_id, name) values
    (team_a, t_id, 'FC Engineering'),
    (team_b, t_id, 'Business United'),
    (team_c, t_id, 'Science City'),
    (team_d, t_id, 'Arts & Humanity FC');

  -- ── Players (4 per team) ─────────────────────────────────────
  insert into public.players (team_id, name, jersey_number, position) values
    -- FC Engineering
    (team_a, 'Ahmad Faiz',       1, 'GK'),
    (team_a, 'Lim Wei Jie',      7, 'MF'),
    (team_a, 'Ravi Kumar',       9, 'FW'),
    (team_a, 'Zack Hazim',      14, 'DF'),
    -- Business United
    (team_b, 'Wan Haziq',        1, 'GK'),
    (team_b, 'Chong Kai Ming',  10, 'MF'),
    (team_b, 'Arif Danial',     11, 'FW'),
    (team_b, 'Sanjay Pillai',    5, 'DF'),
    -- Science City
    (team_c, 'Johan Rahim',      1, 'GK'),
    (team_c, 'Yap Wen Hao',      8, 'MF'),
    (team_c, 'Idris Azman',     17, 'FW'),
    (team_c, 'Chen Bo',          3, 'DF'),
    -- Arts & Humanity FC
    (team_d, 'Harith Zafran',    1, 'GK'),
    (team_d, 'Nurul Ain',       22, 'MF'),
    (team_d, 'Faris Luqman',     6, 'FW'),
    (team_d, 'Tang Yee Seng',   12, 'DF');

  -- ── Matches ──────────────────────────────────────────────────
  -- 1 LIVE match right now
  insert into public.matches (id, tournament_id, home_team_id, away_team_id, match_time, status, home_score, away_score, match_started_at) values
    (m1, t_id, team_a, team_b, now() - interval '45 min', 'live', 2, 1, now() - interval '45 min');

  -- 2 FINISHED matches
  insert into public.matches (id, tournament_id, home_team_id, away_team_id, match_time, status, home_score, away_score, match_started_at, match_finished_at) values
    (m2, t_id, team_c, team_d, now() - interval '3 hours', 'finished', 3, 0, now() - interval '3 hours', now() - interval '2 hours'),
    (m3, t_id, team_b, team_c, now() - interval '1 day',   'finished', 1, 1, now() - interval '1 day',   now() - interval '23 hours');

  -- 2 SCHEDULED matches
  insert into public.matches (id, tournament_id, home_team_id, away_team_id, match_time, status) values
    (m4, t_id, team_d, team_a, now() + interval '2 hours',  'scheduled'),
    (m5, t_id, team_a, team_c, now() + interval '1 day',    'scheduled');

  -- ── Print the tournament URL ─────────────────────────────────
  raise notice '✅ Seed complete!';
  raise notice '👉 Open: http://localhost:3000/t/%', t_id;

end $$;
