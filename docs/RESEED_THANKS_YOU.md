# Reseed the "thanks you" tournament

A captured snapshot of the **"thanks you"** tournament (taken 2026-06-23 from prod)
and a one-command script to recreate it exactly, on prod or any other environment.

## Snapshot state

- **Format:** `round_robin_knockout` — 2 groups of 4, top 2 advance, knockout starts at semis.
- **Status:** `active`.
- **Stage:** **GP Done** — all 12 group matches are `finished`; the knockout bracket is
  **not** seeded and qualifiers are **not** confirmed yet.
- **Scoring:** 3 / 1 / 0. Halftime on, 45-min halves, 15-min break. Min 11 players/team.
- **Teams**
  - Group A: Team Beta, Team Delta, Team Epsilon, Team Eta
  - Group B: Team Alpha, Team Gamma, Team Theta, Team Zeta
  - 11 named players each (88 total).
- **Results (group stage):** mostly 0–0. Decisive games: Beta 1–0 Delta, Eta 1–0 Delta,
  Beta 2–0 Epsilon (so Beta and Eta top the standings).
- **Events:** 4 goals (Beta ×3, Eta ×1) and 4 cards (one Beta red; one Delta player
  yellow → yellow → red).

The complete, exact data is embedded in
[`web/scripts/seed-thanks-you.data.json`](../web/scripts/seed-thanks-you.data.json)
— team rosters, every match, and each goal/card mapped to a named player.

## How to reseed

The script is **idempotent**: it deletes every tournament named `thanks you` (and all of
its teams/players/matches/goals/cards/audit rows) and inserts a fresh, identical copy.

```bash
cd web
# .env.prod must contain the PROD project's:
#   NEXT_PUBLIC_SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY
npx tsx --env-file=.env.prod scripts/seed-thanks-you.ts
```

It prints the new tournament id and `/admin/tournaments/<id>` link when done.

To reseed a **dev/local** project instead, point at that env file
(e.g. `--env-file=.env.local`).

> **`.env.prod` is gitignored** (matched by `web/.gitignore` `.env*`). It is **not**
> committed. If it's missing, recreate it with the prod Supabase URL + service-role key
> before running.

## Re-capturing a new snapshot

If the prod tournament changes and you want the script to reproduce the *new* state,
re-dump it: read the `tournaments` / `teams` / `players` / `matches` / `goals` / `cards`
rows for the `thanks you` tournament, translate every id to a stable name
(team name, per-team player name, `"Home vs Away"` match key), and overwrite
`web/scripts/seed-thanks-you.data.json` in the same shape. The script consumes whatever
is in that file — no code changes needed.

---

## Reusable prompt (paste this next time)

> Reseed the **"thanks you"** tournament into our prod Supabase. Use
> `web/scripts/seed-thanks-you.ts` with `web/scripts/seed-thanks-you.data.json` (the
> captured snapshot — round_robin_knockout, 2 groups of 4, all group matches finished,
> knockout not yet seeded). Run it from `web/` with
> `npx tsx --env-file=.env.prod scripts/seed-thanks-you.ts`. The prod URL +
> service-role key live in `web/.env.prod` (gitignored — recreate it from the prod
> Supabase project settings if it's missing). The script is idempotent: it wipes any
> existing "thanks you" tournament first, then recreates the exact state. Confirm the
> printed counts are 8 teams / 88 players / 12 matches / 4 goals / 4 cards.
