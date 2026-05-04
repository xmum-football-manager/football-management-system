# Overview

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

**Real-time strategy:** Supabase Realtime (WebSocket) subscription on the `matches` table. Falls back to polling every 30 seconds if the connection drops. Refetches on tab visibility change.

**Share:** WhatsApp share button on the tournament header using the public URL.

---

### `/` — Public Homepage
- **Who:** Anyone — no login required
- **UI style:** Custom Tailwind
- **Rendering:** Server component
- Lists all active tournaments, each linking to its `/t/[id]` page
