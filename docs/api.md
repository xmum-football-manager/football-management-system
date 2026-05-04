# API & Backend Architecture

## Overview

The backend is Supabase (Postgres). Most data operations are done by calling Supabase directly from Next.js server components and client components — there are no intermediate API routes except for operations that require the service role key (which must never be exposed to the client).

## Data Access Pattern

| Context | How data is fetched |
|---|---|
| Server components (`page.tsx`) | `createClient()` from `@/lib/supabase/server` — uses cookies for session |
| Client components (`'use client'`) | `createClient()` from `@/lib/supabase/client` — browser-side Supabase client |
| Service-role operations | `createServiceClient()` from `@/lib/supabase/server` — used in API routes only, never in client code |

---

## API Routes

There is one API route in the project. All other operations go directly through Supabase.

### `GET /api/admin/users`

Returns all users in the system with their assigned roles. Used by the `/admin/users` page to display the user list.

**Auth:** Caller must be logged in and have the `admin` role.

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "roles": [
        { "role": "organizer", "tournament_id": "uuid" },
        { "role": "scorekeeper", "tournament_id": "uuid" }
      ]
    }
  ]
}
```

**Why an API route:** Listing all auth users requires `auth.admin.listUsers()` which needs the Supabase service role key — same reason as the invite route.

---

### `POST /api/admin/invite`

Sends an email invite to a new Organizer or Scorekeeper account.

**Auth:** Caller must be logged in and have the `admin` role.

**Request body:**
```json
{
  "email": "user@example.com",
  "role": "organizer" | "scorekeeper"
}
```

**Response:**
```json
{ "success": true }
```

**Why an API route:** Sending invites requires the Supabase service role key (`auth.admin.inviteUserByEmail`). The service role key must never be sent to the browser, so this must run server-side in an API route.

---

## Database Tables

| Table | Description |
|---|---|
| `tournaments` | Tournament records — name, dates, format, points system, status |
| `teams` | Teams scoped to a tournament |
| `players` | Players scoped to a team — name, jersey number, position |
| `matches` | Fixtures — home/away teams, match time, scores, status |
| `user_roles` | Role assignments — `admin` (global), `organizer` (per tournament), `scorekeeper` (per tournament or per match) |
| `admin_audit_log` | Audit trail for admin actions (e.g. reverting a finished match to live) |
| `standings` | Postgres view — computed from match results using the tournament's points system |

---

## Role System

Roles are stored in `user_roles` and enforced by Supabase Row Level Security (RLS) policies.

| Role | Scope | Access |
|---|---|---|
| `admin` | Global (`tournament_id` = NULL) | Full access to everything |
| `organizer` | Per tournament | Manage fixtures, rosters, scores, scorekeepers for their tournament |
| `scorekeeper` | Per tournament or per match | Score input only for assigned match(es) |

The `is_admin()` SQL function is used across RLS policies to check admin status efficiently.

---

## Real-time

The participant view (`/t/[id]`) subscribes to Supabase Realtime on the `matches` table filtered by `tournament_id`. On any change event it refetches matches and standings. If the WebSocket connection drops, it falls back to polling every 30 seconds.

---

## Storage

Supabase Storage (free tier) is used for storing images such as team logos and player photos.

---

## Key Design Decisions

- **No custom API layer** — Supabase is called directly from components. An intermediate API layer would add complexity without benefit at this scale.
- **RLS is the security boundary** — frontend routing is a UX guard only. Even if someone bypasses routing, RLS prevents unauthorized data access at the database level.
- **Service role key is server-only** — only used in `createServiceClient()` inside API routes, never referenced in client-side code.
