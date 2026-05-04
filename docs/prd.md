# PRD: Football Tournament Scoring & Sharing System

**Date:** 2026-04-29
**Status:** In progress
**Client:** University football club (zero budget)
**Champion:** Club president

---

## Problem Statement

A university football club runs tournaments using Copa Fácil — a generic multi-sport tournament app. The UX is poor (buttons are not visually identifiable), it is not football-specific (designed for basketball, volleyball, and football interchangeably), and it has no role separation — one "organizer" account controls everything. The club president cannot safely delegate live score input to a student volunteer without handing over full admin access. Participants (players and supporters) have no real-time view of scores, standings, or rosters during matches.

**The core differentiator vs. Copa Fácil:** scoped roles — specifically the Scorekeeper role, which gives a trusted volunteer score-input access only, without touching fixtures or rosters.

---

## Competitive Landscape

| Tool | Free? | Football-specific? | Scoped roles? | Custom points? | Club-owned? |
|------|-------|-------------------|---------------|----------------|-------------|
| Copa Fácil | Yes | No (multi-sport) | No | No | No |
| OpenMatchDay | Yes | Yes | No | No | No (their platform) |
| Torneo by Sofascore | Yes | Yes | Partial | No | No (their platform) |
| **This system** | Yes (self-hosted) | Yes | Yes (4 roles) | Yes | Yes |

**Why custom build:** Zero budget rules out paid tools. Free third-party platforms (OpenMatchDay, Sofascore) are public platforms — the club does not own its data, URLs, or experience. A custom build gives the club permanent operational infrastructure at hosting cost only.

---

## User Personas

### Admin
- **Role:** Club system administrator
- **Goal:** Manage the overall system — create accounts, assign Organizers to tournaments, override match states
- **Pain point:** No centralized way to control who can manage which tournament

### Organizer
- **Role:** Tournament manager, scoped to a specific tournament
- **Goal:** Set up and run a tournament end-to-end — fixtures, rosters, scores, match state transitions
- **Pain point:** Manual coordination of schedules and score updates is error-prone and time-consuming

### Scorekeeper
- **Role:** Match official or assistant, scoped to a specific match or tournament
- **Goal:** Input live match scores quickly and accurately — nothing else
- **Pain point:** Needs focused, simple score-input access without risking accidental changes to fixtures
- **Note:** Used for larger tournaments; smaller tournaments may have the Organizer scoring directly

### Participant
- **Role:** Player, team member, or supporter following a tournament
- **Goal:** Check live scores, upcoming match times, standings, and team rosters in real-time
- **Pain point:** Currently has no direct access to live tournament information — has to ask the organizer

---

## Functional Requirements

| ID | Requirement | Persona(s) | Priority | Phase |
|----|-------------|------------|----------|-------|
| FR-01 | The system must allow participants to access a tournament via a public shareable URL with no login required | Participant | Must-have | 1 |
| FR-02 | The tournament public page must default to a live/upcoming match schedule showing match time, team names, and current score | Participant | Must-have | 1 |
| FR-03 | Participants must be able to click on any team to view its roster (player name, jersey number, position) | Participant | Must-have | 1 |
| FR-04 | Organizer must be able to manually enter player roster (name, jersey number, position) during tournament setup | Organizer | Must-have | 1 |
| FR-05 | The system must support four roles: Admin, Organizer, Scorekeeper, and Participant | All | Must-have | 1 |
| FR-06 | Admin, Organizer, and Scorekeeper must authenticate via login to access the management layer | Admin, Organizer, Scorekeeper | Must-have | 1 |
| FR-07 | Admin must be able to assign Organizers to specific tournaments | Admin | Must-have | 1 |
| FR-08 | Organizer must be able to set match fixtures: which teams compete against each other and at what time | Organizer | Must-have | 1 |
| FR-09 | Organizer must be able to input and update match scores | Organizer | Must-have | 1 |
| FR-10 | Scorekeeper must be able to input and update match scores only — Scorekeeper cannot modify fixtures, schedule, or rosters | Scorekeeper | Must-have | 1 |
| FR-11 | Score updates must be reflected in real-time on the participant-facing tournament page without requiring a manual page refresh | Participant | Must-have | 1 |
| FR-12 | The system must default to a 1/0.5/0 (win/draw/loss) — i.e. loss=0, draw=0.5, win=1 points system; Organizer can change the values per tournament | Organizer | Must-have | 1 |
| FR-13 | Scorekeeper inputs actual goals per team per match; system auto-derives win/draw/loss outcome and awards points accordingly | Scorekeeper, Organizer | Must-have | 1 |
| FR-14 | Scorekeeper can freely edit the score for their specific match at any time with no finalization lock | Scorekeeper | Must-have | 1 |
| FR-15 | Scorekeepers can be assigned to a tournament by either Admin or Organizer | Admin, Organizer | Must-have | 1 |
| FR-16 | A single user account can hold multiple roles simultaneously (e.g., Admin + Organizer) | Admin | Must-have | 1 |
| FR-17 | Organizer configures tournament format via a toggle: Round-robin ON = league format; Round-robin OFF = direct knockout elimination | Organizer | Must-have | 2 |
| FR-18 | Knockout bracket must be seeded so best teams are placed at opposite ends of the bracket; goal difference is used as tiebreaker when teams are equal on points for seeding purposes | Organizer, Participant | Must-have | 2 |
| FR-19 | Matches must follow a four-state lifecycle: Scheduled → Live → Halftime → Live → Finished | All | Must-have | 1 |
| FR-20 | Only the Organizer can trigger match state transitions: Scheduled → Live ("Start Match"), Live → Halftime ("Half Time"), Halftime → Live ("Start 2nd Half"), Live → Finished ("Full Time") | Organizer | Must-have | 1 |
| FR-21 | Once a match is marked Live, the team roster and fixture details for that match are locked and cannot be edited | Organizer | Must-have | 1 |
| FR-22 | Only Admin can revert a match from Finished back to Live (e.g., to correct a disputed result) | Admin | Must-have | 1 |
| FR-23 | Tournament deletion must require the user to type the tournament name to confirm (Danger Zone pattern) | Admin, Organizer | Must-have | 2 |
| FR-24 | Completed tournaments must be archivable — archived tournaments become read-only historical records | Admin, Organizer | Must-have | 2 |
| FR-25 | Admin creates Organizer and Scorekeeper accounts by entering their email and role; the account is created with a default password (`footballclub`) that the user must change on first login | Admin | Must-have | 1 |
| FR-33 | Admin must be able to view a list of all users in the system along with their assigned roles (Admin, Organizer, Scorekeeper) | Admin | Must-have | 1 |
| FR-26 | Organizer can assign a Scorekeeper to a specific match or to the entire tournament | Organizer | Must-have | 1 |
| FR-27 | Tournament creation form must collect: name, start/end dates, location, description, format toggle (round-robin/knockout), and points system values | Organizer | Must-have | 1 |
| FR-28 | Tournament format and points system lock once the first match is Scheduled (`first_match_scheduled_at` is set). All other locks follow tournament status (see FR-34). | Organizer | Must-have | 1 |
| FR-34 | Tournament edit lock rules by status: (setup) start_date/end_date editable, add/remove teams allowed, add/delete scheduled fixtures allowed, edit match_time on scheduled matches allowed; (active — first match has gone live) start_date/end_date locked, add/remove teams locked, add new fixtures allowed, edit match_time of scheduled matches allowed, edit match_time of live/halftime/finished matches locked; (finished/archived) all edits locked | Organizer, Admin | Must-have | 1 |
| FR-29 | Multiple tournaments can be active simultaneously under the same club | Admin, Organizer, Participant | Must-have | 2 |
| FR-30 | A public homepage must list all active tournaments; each tournament also has its own direct shareable URL | Participant | Must-have | 1 |
| FR-31 | The standings table must display: Matches Played, Wins, Draws, Losses, Goals Scored, Goals Conceded, Goal Difference, and Points | Participant | Must-have | 1 |
| FR-32 | The knockout bracket must offer both a visual bracket tree view and a match list view, switchable by the participant | Participant | Must-have | 2 |

---

## Non-Functional Requirements

| ID | Requirement | Type | Notes |
|----|-------------|------|-------|
| NFR-01 | The system must be a Progressive Web App (PWA) — accessible as a website and installable on mobile as an app | Platform | No native app build required; mobile + laptop browser |
| NFR-02 | Participant-facing tournament pages must be publicly accessible without any authentication | Security / UX | Login only required for management roles |
| NFR-03 | Score and schedule updates must propagate to participants without a manual refresh | Performance | Implemented via long polling — client fetches current state every 5 seconds via HTTP. No WebSocket dependency. |
| NFR-04 | Each UI surface must be served from a separate path to prevent management chrome from leaking into the participant view | UX / Security | /admin, /score, /t/[id] (public tournament), / (homepage) — completely separate routing |
| NFR-05 | Every interactive element must be visually identifiable as a button — no ambiguous tap targets | UX | Direct response to Copa Fácil pain point. Football-specific UI, not generic multi-sport |
| NFR-06 | Total hosting cost must stay at or below RM 50/month | Cost | Target: Vercel free tier (frontend) + Supabase free tier (DB + auth + realtime) = RM 0 |

---

## Architecture Decisions

### Tech Stack
| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Next.js (App Router) | SSR + PWA support, Vercel free tier deploy |
| Styling | Tailwind CSS | Fast, consistent, mobile-first |
| UI Components | shadcn/ui (admin only) | Pre-built accessible components for the admin dashboard; participant view uses custom Tailwind UI |
| Database | Supabase (Postgres) | Free tier, built-in auth, row-level security |
| Storage | Supabase Storage | Free tier, used for storing images (e.g. team logos, player photos) |
| Real-time | Long polling (10s interval) | HTTP fetch on setInterval — no WebSocket dependency, works on any hosting |
| Auth | Supabase Auth | Email/password, invite links, no OAuth needed |
| Hosting | Vercel | Free tier, path-based routing via Next.js App Router |

### Path-Based Architecture
```
/admin             → Admin + Organizer management UI
/score             → Scorekeeper score-input UI (one focused screen)
/t/[id]            → Public participant tournament view (no auth, no management chrome)
/                  → Public homepage listing all active tournaments
```

All surfaces are served from the same domain via path-based routing. No subdomains are used.

Role enforcement is done at the **database layer** via Supabase Row Level Security (RLS) policies — not just frontend routing. A Scorekeeper RLS policy allows INSERT into `goals` for their assigned match only, and SELECT on public match data. Nothing else.

### Real-time Strategy
Participants poll the API every 5 seconds via a `setInterval` HTTP fetch. On each tick the client GETs current match scores, standings, and match status — the UI diffs and updates in place. No WebSocket connection required. Max staleness is 5 seconds, which is acceptable for a live football score context.

---

## Build Phases

### Phase 1 — Core Tournament OS (target: ~2 weeks with AI assistance)
Covers: roles + auth, match lifecycle, live scores via 10s long polling, standings, public shareable URL, roster management, scorekeeper assignment, email invites, round-robin format.

FR in Phase 1: FR-01 through FR-16, FR-19 through FR-22, FR-25 through FR-28, FR-30, FR-31, FR-34.

**Additions accepted during planning review:**
- WhatsApp share button on public tournament URL
- QR code generator for tournament URL
- Supabase keep-alive cron (GitHub Actions, every 5 days)
- Sentry error tracking (free tier)
- UptimeRobot uptime monitoring (free tier)
- Staging Supabase project + Supabase CLI migrations from day 1
- Admin audit log for match revert operations
- README with local dev setup + deployment instructions

**Phase 1 is the demo.** Ship this, run one real club tournament, get the president's feedback.

### Phase 2 — Full Feature Set (after first real tournament)
Covers: knockout bracket + visual tree, multiple simultaneous tournaments, danger zone deletion, archive, FR-17, FR-18, FR-23, FR-24, FR-29, FR-32.

Phase 2 scope is informed by real usage — requirements may be revised after Phase 1 feedback.

---

## Out of Scope

- Multi-tenant / multi-organization support — V1 serves a single football club only
- Participant login or identity — participants are anonymous viewers in V1
- Native iOS / Android apps — PWA covers mobile use case
- Multiple sports — V1 is football (soccer) only
- Match-level tiebreaker / penalty shootout — excluded from V1
- Notifications / alerts to participants — not in scope for V1
- Payment processing — university club, zero budget model

---

## Resolved Questions

| Question | Resolution |
|----------|------------|
| Can an Organizer manage more than one tournament at a time? | Yes — an Organizer can be assigned to multiple tournaments simultaneously |
| Should fixture/roster changes before Live push real-time updates to participants? | Nice-to-have but not required for Phase 1; score updates are the priority |
| WebSocket vs polling for real-time? | Long polling — HTTP GET every 5s via setInterval. No WebSocket, no Supabase Realtime dependency. Simpler, fully stateless. |
| Separate apps per role or one app? | Path-based routing (/admin, /score, /t/[id]) — enforced at routing + DB layer |

---

## Open Questions

- What domain does the club want to use? (affects Vercel custom domain setup)
- Should the Scorekeeper UI support offline score entry with sync-on-reconnect, or is network required during matches?

---
