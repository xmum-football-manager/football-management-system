-- Extend the format check constraint to allow the hybrid round_robin_knockout format
alter table tournaments drop constraint if exists tournaments_format_check;
alter table tournaments add constraint tournaments_format_check
  check (format in ('round_robin', 'round_robin_knockout', 'knockout'));
