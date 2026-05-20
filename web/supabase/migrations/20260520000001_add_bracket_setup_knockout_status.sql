-- Drop the existing inline check constraint (auto-named by Postgres from schema.sql)
alter table tournaments drop constraint if exists tournaments_status_check;

-- Recreate with bracket_setup and knockout added
alter table tournaments add constraint tournaments_status_check
  check (status in ('setup', 'active', 'bracket_setup', 'knockout', 'finished', 'archived'));
