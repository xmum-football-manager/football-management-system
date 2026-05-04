# Overview

The backend is Supabase (Postgres + Auth + Storage). There is no separate backend server. All data access goes through the Supabase client libraries called from Next.js server and client components, with the exception of two Next.js API routes that require the service role key.

## Data Access Pattern

| Context | Client | Notes |
|---|---|---|
| Server components (`page.tsx`) | `createClient()` from `@/lib/supabase/server` | Uses request cookies for session |
| Client components (`'use client'`) | `createClient()` from `@/lib/supabase/client` | Browser-side, respects RLS as the authenticated user |
| Service-role operations | `createServiceClient()` from `@/lib/supabase/server` | Used in API routes only — **never referenced in client-side code** |

The service role key bypasses RLS entirely. It is only used where the Supabase auth admin API is required (user listing, invite sending). It is stored in `SUPABASE_SERVICE_ROLE_KEY` and is not exposed to the browser.

## Key Design Decisions

- **No custom API layer** — Supabase is called directly from components. An intermediate API layer would add complexity without benefit at this scale.
- **RLS is the security boundary** — frontend routing is a UX guard only. Even if someone bypasses routing, RLS prevents unauthorized data access at the database level.
- **Service role key is server-only** — only used in `createServiceClient()` inside API routes, never referenced in client-side code.
