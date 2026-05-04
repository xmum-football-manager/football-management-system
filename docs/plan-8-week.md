# 8-Week Build Plan

**D-Day:** June 29–30 (live tournament)
**Today:** May 4

---

## Constraints & anchors

| Fixed point | Date | Requirement |
|---|---|---|
| Week 1 end | May 10 | Deployed to Vercel + CI/CD live — club can open the link and give feedback |
| Week 5 end | June 1 | All features complete — feature freeze |
| Week 6 | June 2–8 | End-to-end testing + bug fixes |
| Week 7 | June 9–15 | OC team training on staging |
| Weeks 8+ | June 16–28 | Buffer — production readiness, critical fixes only |
| D-Day | June 29–30 | Live tournament |

---

## Week-by-Week

### Week 1 — May 4–10 · Deploy skeleton + full backend
**Goal:** A real URL the club can open, and every DB table, policy, and API route done.

**Infrastructure:**
- [ ] Vercel project created, `main` branch auto-deploys on push (CI/CD)
- [ ] Staging + production Supabase projects provisioned
- [ ] Supabase CLI migrations wired — all schema changes go through `supabase/migrations/`
- [ ] Vercel environment variables set (anon key, service role key, app URL)
- [ ] Sentry + UptimeRobot connected

**Backend — all done this week:**
- [ ] All tables migrated: `tournaments`, `teams`, `players`, `matches`, `user_roles`, `admin_audit_log`
- [ ] `standings` SQL view
- [ ] All RLS policies: public SELECT, role-gated writes
- [ ] Helper functions: `is_admin()`, `is_organizer()`, `is_scorekeeper()`, `get_user_id_by_email()`
- [ ] `POST /api/admin/users/create` + `GET /api/admin/users`
- [ ] Auth middleware (`proxy.ts`) guarding `/admin` and `/score`
- [ ] Forced password change flow (`must_change_password` + `/change-password`)

**Frontend (skeleton only):**
- [ ] `/` homepage renders (even if empty — "No tournaments yet")
- [ ] `/admin/login` → `/admin` dashboard (auth flow end-to-end)

**Hand to club:** Share Vercel URL. Ask president to log in and confirm it loads on their phone.

---

### Week 2 — May 11–17 · Admin + tournament + roster management

**Frontend:**
- [ ] `/admin/users` — user list with role pills
- [ ] `/admin/users/invite` — create account form (email, role radio, default password info panel)
- [ ] `/admin/tournaments/new` — create tournament form (name, dates, location, format toggle, points system)
- [ ] `/admin/tournaments/[id]` — stat cards + match list skeleton
- [ ] `/admin/tournaments/[id]/teams` — add team, expand/collapse accordion, add/delete players
- [ ] Roster lock enforced in UI (controls disabled once any match goes live)

---

### Week 3 — May 18–24 · Match lifecycle + scorekeeper

**Frontend:**
- [ ] `/admin/tournaments/[id]/fixtures` — schedule matches, fixture list, delete (scheduled only)
- [ ] `/admin/tournaments/[id]/scorekeepers` — assign by email, scope toggle (tournament / specific match), remove
- [ ] `MatchStatusControls.tsx` — Start / End / Revert buttons with spinner, optimistic update
- [ ] `/score/login` + `/score` — scorekeeper screen, match selector, score steppers, auto-save, empty state
- [ ] Admin audit log: Revert action writes to `admin_audit_log`

---

### Week 4 — May 25–31 · Public participant view + real-time

**Frontend:**
- [ ] `/t/[id]` full public tournament page:
  - Live hero: team crests, animated scoreboard, match clock, goal scorer lines, form strip
  - Event ticker (horizontally scrolling, goals + cards)
  - Fixtures section: filter chips (All / Live now / Upcoming / Full time), match cards (all 3 states)
  - Standings section: round-robin table, advance indicator, points bar
  - Teams section: accordion expand, roster table
- [ ] `TournamentView.tsx` — Supabase Realtime subscription + 30s polling fallback + visibility refetch
- [ ] WhatsApp share button + QR code modal
- [ ] `/t/[id]/team/[teamId]` — team roster page
- [ ] `LiveBadge.tsx`, `MatchCard.tsx`, `StandingsTable.tsx`, `Toast.tsx` complete

---

### Week 5 — June 1–1 · PWA + hardening + feature freeze ✋

**Goal:** Every FR-01–FR-31 (Phase 1) done and working together.

- [ ] PWA manifest + service worker (`sw.ts`) — installable on mobile
- [ ] Supabase keep-alive cron (GitHub Actions, every 5 days)
- [ ] README: local dev setup + deployment instructions
- [ ] Full end-to-end run: create tournament → add teams/players → schedule fixtures → assign scorekeeper → go live → enter scores → verify public view updates in real-time
- [ ] Fix all bugs found in that run

**Feature freeze after June 1. No new scope.**

---

### Week 6 — June 2–8 · Testing + bug fixes

- [ ] Second end-to-end run — repeat the full flow, different data
- [ ] Test on multiple phones (Android + iOS) — confirm PWA install, real-time updates, scorekeeper UX
- [ ] Test edge cases: simultaneous live matches, scorekeeper with multiple assigned matches, admin revert
- [ ] Fix all bugs found — critical only, no polish
- [ ] Staging environment confirmed as a separate clean instance

---

### Week 7 — June 9–15 · OC team training on staging

- [ ] Run a full mock tournament on staging with the actual OC team
- [ ] Train each role hands-on:
  - **Admin:** create accounts, assign organizers
  - **Organizer:** create tournament, add teams/players, schedule fixtures, assign scorekeepers, run match states
  - **Scorekeeper:** log in on their own phone, enter scores
  - **Participant:** open the public link, check standings and live scores
- [ ] Confirm the public URL works on every phone in the room
- [ ] Collect blockers — log them, fix only showstoppers

---

### Week 8 — June 16–22 · Buffer

- [ ] Fix any showstoppers from Week 7 training
- [ ] Production Supabase project verified (not staging data)
- [ ] All Vercel production env vars confirmed
- [ ] Custom domain set up if the club has one
- [ ] UptimeRobot monitoring confirmed on the production URL
- [ ] One final run-through on production

---

### June 23–28 — Extended buffer (1 week spare)

Intentionally empty. Use only if something breaks in Week 8 or the club requests a last-minute change.

---

### D-Day — June 29–30 · Live tournament

- Organizer sets up tournament on production the day before (June 28)
- Scorekeepers log in and confirm access before matches start
- Share `/t/[id]` link via WhatsApp to all participants
- Monitor Sentry + UptimeRobot during matches

---

## Phase 2 (post D-Day)

Knockout bracket, multiple simultaneous tournaments, danger zone deletion, archive — after real tournament feedback.

---

## Feature completion tracker

| FR | Feature | Done by |
|---|---|---|
| FR-01, FR-30 | Public URL + homepage | Wk 1 |
| FR-05, FR-06 | Auth + 4 roles | Wk 1 |
| FR-25, FR-33 | Admin creates accounts, user list | Wk 2 |
| FR-04, FR-16 | Roster management, multi-role | Wk 2 |
| FR-07, FR-27, FR-28 | Tournament creation + organizer assignment | Wk 2 |
| FR-08, FR-12 | Fixture scheduling, custom points system | Wk 3 |
| FR-15, FR-26 | Scorekeeper assignment (tournament + match) | Wk 3 |
| FR-19, FR-20, FR-21, FR-22 | Match lifecycle + locks + admin revert | Wk 3 |
| FR-09, FR-10, FR-13, FR-14 | Score input (organizer + scorekeeper) | Wk 3 |
| FR-02, FR-03, FR-31 | Public view: schedule, roster, standings | Wk 4 |
| FR-11 | Real-time score updates | Wk 4 |
| FR-17, FR-18, FR-23, FR-24, FR-29, FR-32 | Phase 2 features | Post D-Day |
