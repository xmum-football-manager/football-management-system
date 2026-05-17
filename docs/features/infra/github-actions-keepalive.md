# github-actions-keepalive

## What & Why

Supabase free-tier projects pause after 7 days of inactivity. A scheduled GitHub Actions workflow pings the app's `/api/health` endpoint every 5 days to keep the Supabase project active, preventing it from pausing before the tournament.

## Workflow

File: `.github/workflows/supabase-keepalive.yml`

- Schedule: `cron: '0 0 */5 * *'` (midnight UTC every 5 days)
- Job: `curl` GET to `$NEXT_PUBLIC_APP_URL/api/health`
- The `/api/health` route already exists and performs a lightweight DB check

## Required GitHub Secret

`NEXT_PUBLIC_APP_URL` — the production Vercel URL (e.g. `https://your-app.vercel.app`). Set under Settings → Secrets → Actions in the GitHub repo.
