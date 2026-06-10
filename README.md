# Football Tournament Manager

A football tournament scoring and management system for university clubs. Built with Next.js 16 (App Router), React 19, Supabase (Postgres + Auth + Realtime + RLS), and deployed on Vercel.

## Repository layout

```
.
├── web/                  Next.js application (everything you'll touch lives here)
│   ├── app/              Routes (App Router)
│   ├── components/       Shared React components
│   ├── lib/              Supabase clients + domain logic (lock-rules, match-lifecycle)
│   ├── supabase/         Migrations and canonical schema.sql
│   ├── __tests__/        Vitest unit tests (business logic only)
│   ├── e2e/              Playwright end-to-end tests
│   └── proxy.ts          Subdomain rewrites + auth guards (Next.js 16 "proxy" = middleware)
├── docs/                 Product + engineering docs (PRD, schema, RLS, screens, etc.)
└── package.json          Root only holds the Supabase CLI dev-dep
```

All `pnpm` commands run from `web/` unless stated otherwise.

> **Heads up for contributors:** this repo uses **Next.js 16**, which has breaking changes from anything you may have used before (file-based middleware became `proxy.ts`, etc.). See `web/AGENTS.md`. When in doubt, read `web/node_modules/next/dist/docs/` over Stack Overflow.

## Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) — `npm install -g pnpm`
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) — `brew install supabase/tap/supabase` on macOS, `scoop install supabase` on Windows, or `npm install -g supabase`
- Your own free [Supabase](https://supabase.com) project (one per developer — there is no shared dev DB)

## Local setup

**1. Install dependencies**

```bash
cd web
pnpm install
```

**2. Create `.env.local`**

```bash
cp .env.example .env.local
```

Then fill in `web/.env.local`. Where to find each value:

| Variable                          | Source                                                            |
| --------------------------------- | ----------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | Supabase dashboard → Settings → API → Project URL                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Supabase dashboard → Settings → API → anon public key             |
| `SUPABASE_SERVICE_ROLE_KEY`       | Supabase dashboard → Settings → API → service_role key (server-only) |
| `NEXT_PUBLIC_APP_URL`             | `http://localhost:3000` for local dev                             |
| `NEXT_PUBLIC_ROOT_DOMAIN`         | `localhost` for local dev                                         |
| `NEXT_PUBLIC_SENTRY_DSN`          | Optional locally; leave blank                                     |

`.env.local` is gitignored. Never commit it. The service-role key bypasses RLS — never expose it to the browser.

**3. Link your Supabase project and apply the schema**

From `web/`:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

Your `<project-ref>` is the ID at the end of the dashboard URL (`supabase.com/dashboard/project/<ref>`) — just the ID, not the full URL.

`supabase db push` runs every migration in `supabase/migrations/` against your project. Re-run it after a `git pull` that adds new migrations. You should never paste SQL into the Supabase dashboard by hand.

**4. Start the dev server**

```bash
pnpm dev
```

Open <http://localhost:3000>.

**5. Create the first admin account**

Supabase Auth doesn't assign roles automatically.

1. Sign up at <http://localhost:3000/admin/login>.
2. Supabase dashboard → **Authentication → Users** → copy your UUID.
3. Supabase dashboard → **Table Editor → `user_roles`** → **Insert row**:
   - `user_id` → your UUID
   - `role` → `admin`
   - leave `tournament_id` and `match_id` blank
4. Refresh the admin page.

## Day-to-day commands

All from `web/`:

```bash
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Production build
pnpm start            # Run the production build locally
pnpm lint             # ESLint
pnpm test             # Vitest, run-once
pnpm test:watch       # Vitest, watch mode
pnpm test:coverage    # Vitest with coverage report
```

See `web/README.md` for Playwright e2e testing details.
```

When you change the schema:

```bash
supabase migration new <short_name>   # creates a timestamped file under supabase/migrations/
# edit the new .sql file
supabase db push                      # apply to your linked project
```

## Routes & roles

| Route          | Audience                            |
| -------------- | ----------------------------------- |
| `/`            | Public — lists active tournaments   |
| `/t/[id]`      | Public — tournament view, standings |
| `/admin`       | Admin + organizer (login required)  |
| `/score`       | Scorekeeper (login required)        |

| Role          | Scope            | What they can do                                                                          |
| ------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `admin`       | Global           | Everything; only role that can revert `finished` → `live`                                 |
| `organizer`   | Per tournament   | Create/edit fixtures, rosters, scores; assign scorekeepers; trigger match transitions     |
| `scorekeeper` | Per tournament/match | Update `home_score`/`away_score` on assigned live matches — nothing else              |

A user can hold multiple roles. Enforcement is in Postgres via Row Level Security.

## Deployment (Vercel)

The `main` branch auto-deploys to production. Pull requests get preview deployments.

**One-time Vercel project setup:**

1. **Import the repo** in Vercel.
2. Set **Root Directory** to `web` (the project lives in a subdirectory).
3. Framework preset: **Next.js** (auto-detected).
4. Add environment variables under **Project Settings → Environment Variables**:

   | Variable                         | Production                        | Preview                              |
   | -------------------------------- | --------------------------------- | ------------------------------------ |
   | `NEXT_PUBLIC_SUPABASE_URL`       | Production Supabase project URL   | Staging Supabase project URL         |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Production anon key               | Staging anon key                     |
   | `SUPABASE_SERVICE_ROLE_KEY`      | Production service-role key       | Staging service-role key             |
   | `NEXT_PUBLIC_APP_URL`            | `https://<your-domain>`           | `https://<vercel-preview-url>`       |
   | `NEXT_PUBLIC_ROOT_DOMAIN`        | `<your-domain>` (no protocol)     | Same as production or preview host   |
   | `NEXT_PUBLIC_SENTRY_DSN`         | Sentry DSN                        | Sentry DSN (or omit)                 |

   **Never use the production Supabase project for previews.** Use a separate staging project so PRs can't corrupt prod data.

5. Add the production Supabase project's URL to its **Auth → URL Configuration** allowlist so login redirects work.

**Production migrations:**

`supabase db push` is run manually from a maintainer's machine against the production-linked project. It is **not** wired into Vercel's build. Workflow:

```bash
cd web
supabase link --project-ref <production-ref>   # one-time per machine
supabase db push                                # apply pending migrations
supabase link --project-ref <your-dev-ref>      # switch back when done
```

Apply migrations **before** merging the PR that depends on them, so the new code never hits an old schema.

## Troubleshooting

**"I logged in but `/admin` is empty / blocked."**
You haven't been assigned a role yet. See "Create the first admin account" above. Existing users assign you via `/admin/users/invite`.

**"`supabase db push` says project not linked."**
Run `supabase link --project-ref <your-ref>` from inside `web/`. The link is stored per-directory.

**"401 / RLS error from an API route."**
Either you're not signed in, or your role doesn't allow that action. Check `user_roles` in the dashboard.

**"Auth callback redirects to `localhost` from a deployed environment."**
`NEXT_PUBLIC_APP_URL` is wrong for that environment, or the URL isn't allowlisted in Supabase Auth settings.

**"Build fails with a Supabase types error."**
The generated `lib/supabase/types.ts` may be out of date. Regenerate against your linked project: `supabase gen types typescript --linked > lib/supabase/types.ts`.

