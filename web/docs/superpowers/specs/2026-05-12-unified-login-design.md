# Unified Login Page Design

## Summary

Replace the two separate login pages (`/admin/login` and `/score/login`) with a single unified login at `/login`. Users pick their role via a 3-tab switcher before submitting credentials.

## Design System

Inherits the existing login page visual language:
- Background: `bg-[#0f172a]` (dark navy)
- Card: white, `rounded-2xl`, large drop shadow
- Primary accent: `green-600` / `green-500` (hover)
- Typography: slate palette (`slate-900`, `slate-700`, `slate-500`, `slate-400`)
- Inputs: white bg, `border-slate-300`, `focus:ring-green-500`
- Error: red text on `bg-red-50 border-red-200`

## Route

- **New route:** `app/login/page.tsx`
- `/admin/login` → 308 redirect to `/login?tab=admin`
- `/score/login` → 308 redirect to `/login?tab=scorekeeper`
- Default tab on page load: Admin (or whichever tab the `?tab=` param specifies)

## Layout

```
bg-[#0f172a] full screen, centered
  ⚽ (emoji, 40px)
  "Tournament Manager" (white, bold, 22px)

  White card (max-w-sm, rounded-2xl)
  ┌──────────────────────────────────┐
  │  🏆 Admin │ 📋 Organizer │ ✏️ SK │  ← tabs, underline active
  ├──────────────────────────────────┤
  │  Email input                     │
  │  Password input                  │
  │  [error box if any]              │
  │  [Sign in as {Role}] ← green btn │
  └──────────────────────────────────┘
  "Need access? Contact your tournament administrator."
```

## Tab Behaviour

| Tab | Label on button | Redirects to after login |
|-----|----------------|--------------------------|
| Admin | Sign in as Admin | `/admin` |
| Organizer | Sign in as Organizer | `/admin` |
| Scorekeeper | Sign in as Scorekeeper | `/score` |

- Active tab: green underline (`border-b-2 border-green-600`), `text-green-600 font-bold`
- Inactive tabs: `text-slate-400 font-semibold`
- Switching tab clears any existing error state

## Auth Flow

1. User picks tab, enters email + password, submits
2. Call `supabase.auth.signInWithPassword()`
3. On error → show error box (existing red style)
4. On success:
   - If `user_metadata.must_change_password` → redirect to `/change-password?redirectTo=<target>`
   - If Admin or Organizer tab selected → check user has `admin` or `organizer` role in `user_roles`. If not → show error: "Your account doesn't have access to this area."
   - Otherwise → redirect to target (`/admin` or `/score`)
5. `redirectTo` query param preserved and forwarded as before

## Wrong-Role Guard

After a successful Supabase auth, the client fetches the user's roles from `user_roles` before redirecting. If the selected tab's required role is absent, sign the user out and show an inline error. This prevents a scorekeeper accidentally landing on the admin shell.

## Files Changed

| Action | Path |
|--------|------|
| Create | `app/login/page.tsx` |
| Delete | `app/admin/login/page.tsx` |
| Delete | `app/score/login/page.tsx` |
| Add redirect | `app/admin/login/route.ts` (308 → `/login?tab=admin`) |
| Add redirect | `app/score/login/route.ts` (308 → `/login?tab=scorekeeper`) |

## Out of Scope

- No design changes to the admin dashboard or scorekeeper UI
- No changes to auth middleware or session logic
- No password reset / forgot-password flow (not currently implemented)
