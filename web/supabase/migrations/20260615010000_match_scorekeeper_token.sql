alter table public.matches
  add column if not exists scorekeeper_token uuid not null default gen_random_uuid();
