-- Add tournament wizard configuration columns
alter table tournaments
  add column if not exists halftime_enabled       boolean not null default true,
  add column if not exists minutes_per_half       integer,
  add column if not exists halftime_minutes       integer,
  add column if not exists extra_time_minutes     integer,
  add column if not exists penalty_shootout_enabled boolean not null default false,
  add column if not exists require_goal_player    boolean not null default false,
  add column if not exists num_groups             integer,
  add column if not exists teams_per_group        integer,
  add column if not exists advance_per_group      integer,
  add column if not exists knockout_start_round   text,
  add column if not exists seeding_method         text;

alter table tournaments
  add constraint tournaments_knockout_start_round_check
    check (knockout_start_round is null or
           knockout_start_round in ('top_32','top_16','top_8','semi','final')),
  add constraint tournaments_seeding_method_check
    check (seeding_method is null or
           seeding_method in ('by_standings','manual','random'));

-- Backfill existing rows so minutes_per_half can be NOT NULL
update tournaments
  set minutes_per_half = 45,
      halftime_minutes = 15
  where minutes_per_half is null;

alter table tournaments
  alter column minutes_per_half set not null;
