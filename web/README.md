# Football Tournament Manager

A football tournament scoring and management system built with Next.js and Supabase.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Routes](#routes)
- [Development](#development)
- [Creating the first admin account](#creating-the-first-admin-account)

## Prerequisites

- [Node.js](https://nodejs.org) 20+
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)
- A [Supabase](https://supabase.com) project (free tier works)

## Setup

**1. Install dependencies**

```bash
pnpm install
```

**2. Configure environment variables**

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `localhost` for local dev |

**3. Install Supabase CLI and link your project**

Make sure you are in the `web/` folder first:

```bash
cd web
```

Then install the CLI, log in, and link your project:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

Your project ref is the ID at the end of your Supabase dashboard URL:
`supabase.com/dashboard/project/<ref>` — use only the ID part, not the full URL.

**4. Apply the database schema**

```bash
supabase db push
```

This runs all migration files in `supabase/migrations/` against your project. You never need to manually paste SQL into the dashboard.

When new migrations are added (e.g. after a `git pull`), run `supabase db push` again to apply them.

**5. Start the dev server**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Path | Description |
|---|---|
| `/` | Public homepage — lists all active tournaments |
| `/t/[id]` | Public tournament view — scores, standings, rosters |
| `/admin` | Admin/Organizer dashboard (login required) |
| `/score` | Scorekeeper score-input screen (login required) |

## Development

Each developer uses their own Supabase project. There is no shared dev database. Create a free project at [supabase.com](https://supabase.com), run `supabase/schema.sql`, and put your own keys in `.env.local`. The `.env.local` file is gitignored — never commit it.

Production uses a separate dedicated Supabase project with its own API keys. Never use a dev project for production, and never use production keys locally.

## Creating the first admin account

Supabase Auth doesn't automatically assign roles. Follow these steps:

**1. Create your account**

Go to [http://localhost:3000/admin/login](http://localhost:3000/admin/login) and sign up with your email and password.

**2. Get your user ID**

Go to Supabase dashboard → **Authentication → Users**, find your email, and copy the UUID.

**3. Assign the admin role**

Go to Supabase dashboard → **Table Editor → `user_roles`** → click **Insert row** and fill in:

- `user_id` → paste your UUID
- `role` → `admin`
- leave `tournament_id` and `match_id` blank

Click **Save**. Refresh the admin page and you will have full access.
