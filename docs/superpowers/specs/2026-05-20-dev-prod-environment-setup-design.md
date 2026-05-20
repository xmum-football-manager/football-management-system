# Dev / Prod Environment Setup Design

**Date:** 2026-05-20
**Status:** Approved

## Problem

The project has no Vercel environment variables configured, so deployments fail. Stakeholders need a shareable live link backed by the dev Supabase (real shared data). A production environment will be wired up later once a prod Supabase project is created.

## Approach

One Vercel project (`web`), two environments:

| Environment | Supabase | URL |
|---|---|---|
| Development (now) | Dev Supabase (`xqjmnxqceegrevlmbqbd`) | `web-xyz.vercel.app` — stakeholder link |
| Production (later) | New prod Supabase (TBD) | `football.codingclub.my` |

Preview deployments are out of scope for now.

## What Gets Done Now

### 1. Vercel env vars — Production environment

Add the following to the **Production** environment on Vercel:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xqjmnxqceegrevlmbqbd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from `.env.production.local`) |
| `SUPABASE_SERVICE_ROLE_KEY` | (from `.env.production.local`) |
| `NEXT_PUBLIC_APP_URL` | Vercel auto-generated URL for now |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `vercel.app` for now |

### 2. Deploy

Push to `main` to trigger a production deployment. Share the resulting Vercel URL with stakeholders.

## What Gets Done Later (Linear issue)

- Create a new prod Supabase project
- Run migrations on it
- Swap Vercel Production env vars to prod Supabase credentials
- Add `football.codingclub.my` as a custom domain on the Vercel project

## Out of Scope

- Subdomain routing — the app runs under a single domain, no subdomain switching within the app
- Preview environment configuration
