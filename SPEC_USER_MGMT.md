# Spec: User Management + Inline Scorekeeper Creation

Status: proposed · Scope: `web/app/admin/users`, `web/app/admin/tournaments/[id]/scorekeepers`, `web/lib`

## Problem

1. **Scorekeeper assignment requires a pre-existing account.** `assignScorekeeperAction`
   calls `findUserIdByEmail` and hard-fails with *"No account with email …"* if the
   person doesn't exist. The organizer has to leave the tab, go to Add User, create the
   account, come back, and assign — a 4-step detour for what should be one action.
2. **No way to see / hand out login credentials.** Admin Users lists email + roles but
   not the password, so an organizer can't tell a new scorekeeper how to log in.

## Hard constraint (read first)

Supabase Auth stores passwords as **bcrypt hashes — not recoverable**. We therefore do
**not** store or display real passwords. Instead:

- New accounts are created with the default password `footballclub` and
  `must_change_password: true` (already the behavior in
  `api/admin/users/create/route.ts`).
- Admin shows `footballclub` **only while `must_change_password` is still true** — i.e.
  the account is untouched, so we already know the value from the constant.
- Once the user changes their password, admin shows `••• (changed)` and offers a
  **Reset to `footballclub`** action. No plaintext secret is ever persisted.

## Decisions (confirmed)

- Password visibility = **show default + reset** (no plaintext at rest).
- Inline create password field = **prefilled `footballclub`, editable**.

---

## Feature 1 — Inline create-and-assign in the Scorekeeper tab

### UX (`ScorekeepersPanel.tsx`)

Add a two-way mode toggle at the top of the "Assign a scorekeeper" card:

- **Assign existing** (current behavior) — email + scope.
- **Create new** — email + password (prefilled `footballclub`, editable) + scope.
  Replaces today's *"The user must already have a scorekeeper account."* hint.

Scope picker (Entire tournament / Specific match) is shared by both modes — unchanged.

On submit in **Create new** mode:
- Call new action `createAndAssignScorekeeperAction`.
- On success: toast `Account created — login: <email> / <password>`, reset form,
  `router.refresh()`.
- If the email already exists: don't error out — fall through to assigning the existing
  user the scorekeeper role (and toast `Existing account found — assigned as scorekeeper`).

### Server (`scorekeepers/actions.ts`)

```ts
export async function createAndAssignScorekeeperAction(input: {
  tournamentId: string
  email: string
  password: string          // defaults to footballclub client-side
  scope: 'tournament' | 'match'
  matchId: string | null
}): Promise<{ id: string } | { error: string }>
```

Logic:
1. `ensureOrganizer(tournamentId)` (existing helper — admin or organizer).
2. `createClubUser({ email, password })` (new shared lib, below). If it returns
   `already-exists`, fall back to `findUserIdByEmail`.
3. `assignRole({ user_id, role: 'scorekeeper', tournament_id | match_id })` per scope.
4. `revalidatePath(.../scorekeepers)`.

Validation: reject empty email; if `scope === 'match'` require `matchId`; password
min length 6 (Supabase default) — surface Supabase's error message verbatim on failure.

---

## Feature 2 — Password column + reset in Admin Users

### UX (`admin/users/page.tsx`)

Add a **Password** cell to each user row:

- `must_change_password === true` → show `footballclub` behind an eye-toggle
  (reveal/hide, cosmetic) + a small "default" tag.
- otherwise → `••• (changed)` muted text.
- Every row gets a **Reset to default** button (overflow/ghost) that calls the reset
  action and, on success, flips the row back to the `footballclub` state.

### Server — new route `POST /api/admin/users/[id]/reset-password`

- Guard: `isAdmin(auth.user.id)` → else 401/403 (mirror existing routes).
- `svc.auth.admin.updateUserById(id, { password: DEFAULT_PASSWORD, user_metadata: { must_change_password: true } })`.
- Return `{ success: true }`. Client toasts `Password reset to footballclub` +
  `router.refresh()`.

---

## Shared cleanup (fold in while we're here)

1. **Centralize the constant.** Move `DEFAULT_PASSWORD = 'footballclub'` into
   `web/lib/auth.ts` (or a new `web/lib/users.ts`) and import everywhere
   (create route, reset route, inline-create, UI copy). Currently hard-coded in
   `create/route.ts` and as a string literal in `InviteForm.tsx`.
2. **Extract `createClubUser`** into `web/lib/users.ts`:
   ```ts
   // returns { userId } | { error } | { alreadyExists: true }
   createClubUser({ email, password? }): Promise<…>
   ```
   Used by both the existing create route and the new inline-create action. Wraps
   `svc.auth.admin.createUser({ email, password, email_confirm: true,
   user_metadata: { must_change_password: true } })` and maps the "already registered"
   error to `alreadyExists`.
3. **Roles are always assigned where the tournament is known (decided).** A scorekeeper
   (and likewise an organizer) only makes sense scoped to a tournament — a role row with
   no `tournament_id`/`match_id` has nothing to act on. So:
   - **Invite form becomes "create account only"** — drop the role picker entirely.
     `POST /api/admin/users/create` just provisions the login (email + default password +
     `must_change_password`) and inserts **no** `user_roles` row. This also retires the
     latent bug where the route accepted a `role` field and silently ignored it.
   - **All scorekeeper scoping happens in the tournament's scorekeeper tab** (Feature 1),
     which always sets `tournament_id` (whole tournament) or `match_id` (one match).
     A scorekeeper belongs to **exactly one tournament** (see Feature 3); they may still
     hold several match-scoped rows, but all within that single tournament. There is
     never an unscoped scorekeeper.
   - Organizer scoping likewise stays in the per-tournament organizer assignment flow.

---

## Feature 3 — A scorekeeper belongs to exactly one tournament

### Current state (none of this is enforced)

`user_roles` (`web/supabase/schema.sql:70`) has `valid_admin` and `valid_organizer`
CHECKs but **no `valid_scorekeeper` CHECK** — so a scorekeeper row can legally have both
`tournament_id` and `match_id` null (an unscoped/global scorekeeper) or both set. The
`unique (user_id, role, tournament_id, match_id)` only blocks exact-duplicate rows, not
multi-tournament membership. And `listScorekeeperMatchesForUser` (`web/lib/db/roles.ts:114`)
unions matches across **every** tournament the user scorekeeps, so a multi-tournament
scorekeeper would see matches from all of them in `/score`.

### Layer 1 — DB: add the missing scope CHECK (new migration)

```sql
alter table public.user_roles add constraint valid_scorekeeper check (
  role <> 'scorekeeper'
  or (tournament_id is not null and match_id is null)   -- tournament-wide
  or (tournament_id is null and match_id is not null)   -- single match
);
```

Guarantees every scorekeeper row is scoped to exactly one of {a tournament, a match}.
**Pre-flight:** check existing rows for violations before applying (the data is small;
a `select … where role='scorekeeper' and (both null or both set)` should return zero).

> Note: this CHECK can't express "all of a user's match-scoped rows share one tournament"
> because the tournament lives in `matches.tournament_id` (a join) — CHECK can't subquery.
> That cross-row rule is handled in Layer 2.

### Layer 2 — App: single-tournament guard (the enforced rule)

New helper in `web/lib/db/roles.ts`:

```ts
// Distinct tournament ids this user already scorekeeps (tournament-wide rows directly
// + match-scoped rows resolved via matches.tournament_id). Mirrors the resolution in
// listScorekeeperMatchesForUser but returns tournament ids.
export async function getScorekeeperTournamentIds(userId: string): Promise<string[]>
```

In **both** `assignScorekeeperAction` and `createAndAssignScorekeeperAction`, before
inserting the role:

```ts
const others = (await getScorekeeperTournamentIds(userId)).filter(t => t !== tournamentId)
if (others.length > 0) {
  return { error: 'This account already keeps score for another tournament. A scorekeeper can only belong to one tournament.' }
}
```

This is the rule users actually hit, and it has the tournament context already.

### Layer 3 — optional DB trigger (belt-and-suspenders)

A `BEFORE INSERT` trigger on `user_roles` that resolves the incoming row's tournament
(direct or via `match_id`) and rejects if the user has any scorekeeper row in a different
tournament. Only worth adding if we need protection against direct DB writes / seed
scripts — the app path is already guarded by Layer 2. **Default: skip unless requested.**

### Test additions

- [ ] Assigning a scorekeeper who already scorekeeps tournament A to tournament B →
      rejected with the single-tournament message.
- [ ] Assigning the same user to a second match **within the same tournament** → allowed.
- [ ] Migration: inserting a scorekeeper row with both `tournament_id` and `match_id`
      (or neither) → rejected by `valid_scorekeeper`.

---

## Security notes

- No plaintext password is ever written to the DB or metadata. Admin only ever renders
  the literal constant `footballclub`, and only when `must_change_password` is true.
- Reset endpoint is admin-only; create+assign is organizer-or-admin (matches existing
  authorization for the tab).
- `must_change_password` already forces a change on first login via
  `mustChangePassword()` + `/change-password` — reset re-arms that gate.

## Test checklist

- [ ] Create-new in scorekeeper tab → account exists, scorekeeper role with correct
      scope, can log in with the entered password, forced to change on first login.
- [ ] Create-new with an email that already exists → no error; existing user gets the
      role.
- [ ] Admin Users shows `footballclub` for fresh accounts, `••• (changed)` after the
      user changes it.
- [ ] Reset to default → user can log in with `footballclub`, `must_change_password`
      re-set, admin row flips back to default state.
- [ ] Non-admin hitting the reset route → 403. Non-organizer calling create+assign →
      throws "Not authorized."
- [ ] `DEFAULT_PASSWORD` referenced from one place; typecheck + lint clean.
