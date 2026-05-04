# Frontend Architecture

## Overview

The frontend is a Next.js (App Router) application. All UI is path-based — no subdomains. There are four distinct surfaces, each with its own visual style and access rules.

## Surfaces

### `/admin` — Admin & Organizer Dashboard
- **Who:** Admin and Organizer roles (login required)
- **UI style:** shadcn/ui components on top of Tailwind CSS
- **Rendering:** Mix of server components (data fetching) and client components (forms, interactive controls)

| Page | Path | Description |
|---|---|---|
| Dashboard | `/admin` | Lists all tournaments the user can manage |
| New Tournament | `/admin/tournaments/new` | Create tournament form — name, dates, format, points system |
| Tournament Detail | `/admin/tournaments/[id]` | Stat cards, match list, match status controls |
| Teams & Rosters | `/admin/tournaments/[id]/teams` | Add teams, manage player rosters |
| Fixtures | `/admin/tournaments/[id]/fixtures` | Schedule matches between teams |
| Scorekeepers | `/admin/tournaments/[id]/scorekeepers` | Assign scorekeepers to matches or the whole tournament |
| Users | `/admin/users` | View all users and their roles; invite new Organizer or Scorekeeper accounts |
| Login | `/admin/login` | Email/password sign-in |

**Match lifecycle controls** (`MatchStatusControls.tsx`):
- Organizer: Scheduled → Live, Live → Finished
- Admin only: Finished → Live (revert), logged to `admin_audit_log`

---

### `/score` — Scorekeeper Screen
- **Who:** Scorekeeper role (login required)
- **UI style:** Custom Tailwind, dark background (`#0f172a`), focused single-screen layout
- **Rendering:** Server component loads assigned matches; `ScoreEntry.tsx` handles score input as a client component

The scorekeeper sees only the matches they are assigned to. Live matches are sorted to the top. Scorekeepers can edit scores freely — no finalization lock.

---

### `/t/[id]` — Public Tournament View
- **Who:** Anyone — no login required
- **UI style:** Custom Tailwind, dark header, mobile-first
- **Rendering:** Server component fetches initial data; `TournamentView.tsx` is a client component that handles real-time updates

**Tabs:**
- **Live** — live matches first, then upcoming, then recent results
- **Schedule** — full fixture list
- **Standings** — league table (MP, W, D, L, GS, GC, GD, Pts)
- **Teams** — team list linking to individual team/roster pages

**Real-time strategy:** Supabase Realtime subscription on the `matches` table. Falls back to polling every 30 seconds if the WebSocket connection drops. Refetches on tab visibility change (user returns to browser tab).

**Share:** WhatsApp share button on the tournament header using the public URL.

---

### `/` — Public Homepage
- **Who:** Anyone — no login required
- **UI style:** Custom Tailwind
- **Rendering:** Server component
- Lists all active tournaments, each linking to its `/t/[id]` page

---

## Component Structure

```
components/
  MatchCard.tsx       — match display card (participant view)
  StandingsTable.tsx  — league standings table (participant view)
  LiveBadge.tsx       — animated "LIVE" indicator
  Toast.tsx           — toast notification system (admin/score views)
```

shadcn/ui components are used only within `/admin` — not in `/t/[id]`, `/score`, or `/`.

---

## Auth Flow

- Admin/Organizer/Scorekeeper authenticate via Supabase Auth (email + password)
- `proxy.ts` middleware guards `/admin` and `/score` routes — unauthenticated requests are redirected to the relevant login page with a `redirectTo` param
- The login page itself is excluded from the auth check to avoid redirect loops
- Role checks happen at the database layer via RLS — frontend routing is a secondary guard only
