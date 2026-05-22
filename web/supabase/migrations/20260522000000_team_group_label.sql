-- Group assignment for round_robin_knockout tournaments.
-- A team belongs to at most one group (label like 'A', 'B', ...). NULL = unassigned.
alter table public.teams
  add column if not exists group_label text;

alter table public.teams
  add constraint teams_group_label_check
    check (group_label is null or group_label ~ '^[A-Z]$');

create index if not exists teams_tournament_group_idx
  on public.teams (tournament_id, group_label);
