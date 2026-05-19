# DAL Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `web/lib/db/` an environment-agnostic Data Access Layer so it works in server components, client components, and API routes — then migrate all 30+ direct `.from()` callsites to use it.

**Architecture:** Today every file in `web/lib/db/*.ts` starts with `import { createClient } from '@/lib/supabase/client'` — the browser-only client. This means server components can't safely use the DAL, so 16 files outside `lib/db/` still call `.from()` directly. The fix is mechanical: each DAL function takes a `SupabaseClient` as its first argument instead of creating one internally. Callers pass whichever client fits their context (browser, server, or service-role). Errors throw instead of being swallowed.

**Tech Stack:** Next.js App Router, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), TypeScript.

**Scope:** This plan covers GitHub issues #33 (A2), #34 (A3), #35 (A9), #36 (A1). Issues #37–#42 (auth helpers, flash-of-protected-content, service layer, domain types, realtime hook, RLS docs) are out of scope and should be separate plans run after this one.

**Critical context for the engineer:**
- Read `web/AGENTS.md` first — Next.js App Router conventions in this repo differ from defaults
- Read `web/lib/supabase/client.ts`, `server.ts`, and `types.ts` before touching the DAL
- Health stack: `cd web && tsc --noEmit`, `cd web && pnpm lint`, `cd web && pnpm test`
- Use **pnpm**, never npm/yarn
- Karpathy guidelines apply (see `/CLAUDE.md`): surgical changes only, no speculative abstractions

---

## File Structure

**Files modified (DAL — change signatures):**
- `web/lib/db/tournaments.ts` (6 functions)
- `web/lib/db/matches.ts` (~8 functions)
- `web/lib/db/teams.ts` (~6 functions)
- `web/lib/db/players.ts` (~5 functions)
- `web/lib/db/roles.ts` (~4 functions)

**Files modified (callsites — pass client):**
- All files under `web/app/admin/tournaments/[id]/` that import from `@/lib/db/*` (already DAL users, need to pass client)
- `web/app/admin/page.tsx`, `web/app/page.tsx`, `web/app/score/page.tsx`, `web/app/admin/users/page.tsx`, `web/app/login/page.tsx`, `web/app/t/[id]/page.tsx`, `web/app/t/[id]/TournamentView.tsx`, `web/app/t/[id]/team/[teamId]/page.tsx`, `web/app/score/ScoreEntry.tsx`, `web/components/BracketView.tsx`
- API routes: `web/app/api/admin/scorekeepers/route.ts`, `web/app/api/admin/users/route.ts`, `web/app/api/admin/users/create/route.ts`, `web/app/api/admin/organizers/route.ts`, `web/app/api/health/route.ts`
- Server action: `web/app/admin/tournaments/new/actions.ts`

**Files created:**
- `web/lib/db/AGENTS.md` — convention doc to prevent future drift
- `web/lib/db/__tests__/tournaments.test.ts` (and one test file per DAL module touched)

**Files NOT touched:**
- `web/lib/supabase/client.ts`, `server.ts`, `types.ts` — unchanged
- Anything under `web/app/t/[id]/TournamentView.tsx` realtime channel logic (lines 223-246) — that's issue #41, out of scope

---

## Task 1: Pilot — refactor `tournaments.ts` end-to-end

This is the proof-of-shape. Once this lands cleanly, Tasks 2–5 follow the same recipe per file.

**Files:**
- Modify: `web/lib/db/tournaments.ts`
- Create: `web/lib/db/__tests__/tournaments.test.ts`
- Modify (callers): every file in the survey that imports from `@/lib/db/tournaments`:
  - `web/app/admin/tournaments/[id]/TournamentSetupCard.tsx`
  - `web/app/admin/tournaments/[id]/OverviewTab.tsx`
  - `web/app/admin/tournaments/[id]/page.tsx`
  - `web/app/admin/tournaments/[id]/GoLivePanel.tsx`
  - `web/app/admin/tournaments/[id]/edit/page.tsx`
  - `web/app/admin/tournaments/[id]/SettingsTab.tsx`

- [ ] **Step 1: Write the failing test**

Create `web/lib/db/__tests__/tournaments.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { getTournament, updateTournament } from '../tournaments'

function mockClient(response: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(response)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(response) })
  const from = vi.fn().mockReturnValue({ select, update })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any
}

describe('tournaments DAL', () => {
  it('getTournament returns typed data when the query succeeds', async () => {
    const client = mockClient({ data: { id: 't1', name: 'Cup' }, error: null })
    const result = await getTournament(client, 't1')
    expect(result).toEqual({ id: 't1', name: 'Cup' })
  })

  it('getTournament throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    await expect(getTournament(client, 't1')).rejects.toThrow('boom')
  })

  it('updateTournament accepts a typed patch and awaits the result', async () => {
    const client = mockClient({ data: null, error: null })
    await updateTournament(client, 't1', { name: 'Renamed' })
    expect(client.from).toHaveBeenCalledWith('tournaments')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
cd web && pnpm test lib/db/__tests__/tournaments.test.ts
```

Expected: FAIL — `getTournament` currently takes `(tournamentId: string)`, not `(client, tournamentId)`. TypeScript will reject the test calls.

- [ ] **Step 3: Refactor `tournaments.ts`**

Replace the entire contents of `web/lib/db/tournaments.ts` with:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tournament } from '@/lib/supabase/types'

export async function getTournament(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null // not found
    throw new Error(error.message)
  }
  return data as Tournament
}

export async function updateTournament(
  supabase: SupabaseClient,
  tournamentId: string,
  patch: Partial<Tournament>,
): Promise<void> {
  const { error } = await supabase.from('tournaments').update(patch).eq('id', tournamentId)
  if (error) throw new Error(error.message)
}

export async function goLive(supabase: SupabaseClient, tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'active' })
    .eq('id', tournamentId)
  if (error) throw new Error(error.message)
}

export async function finishTournament(
  supabase: SupabaseClient,
  tournamentId: string,
): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'finished' })
    .eq('id', tournamentId)
  if (error) throw new Error(error.message)
}

export async function getCurrentUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getUserRoles(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, tournament_id')
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  return data ?? []
}
```

- [ ] **Step 4: Run the DAL test again — should now pass**

```
cd web && pnpm test lib/db/__tests__/tournaments.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Update every caller of `tournaments.ts`**

For each of the 6 caller files listed above:
1. Read the file
2. Determine the runtime: is it `'use client'` (top of file) or a server component (no directive, in `app/`) or a server action / API route?
3. Add the matching client import at top:
   - Client component → already imports from `@/lib/supabase/client`, reuse the existing `createClient()` call. If none, add `import { createClient } from '@/lib/supabase/client'` and `const supabase = createClient()` inside the component
   - Server component / server action / API route → `import { createClient } from '@/lib/supabase/server'` and `const supabase = await createClient()` (note: server `createClient` is async in this codebase — check `web/lib/supabase/server.ts` to confirm before changing)
4. Update each DAL call site to pass `supabase` as the first argument:

```ts
// Before
const tournament = await getTournament(params.id)
await updateTournament(params.id, { name: 'X' })

// After
const tournament = await getTournament(supabase, params.id)
await updateTournament(supabase, params.id, { name: 'X' })
```

- [ ] **Step 6: Typecheck**

```
cd web && tsc --noEmit
```

Expected: PASS. If any caller was missed, TypeScript will pinpoint it.

- [ ] **Step 7: Lint**

```
cd web && pnpm lint
```

Expected: PASS.

- [ ] **Step 8: Run all tests**

```
cd web && pnpm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/lib/db/tournaments.ts web/lib/db/__tests__/tournaments.test.ts \
  web/app/admin/tournaments/[id]/TournamentSetupCard.tsx \
  web/app/admin/tournaments/[id]/OverviewTab.tsx \
  web/app/admin/tournaments/[id]/page.tsx \
  web/app/admin/tournaments/[id]/GoLivePanel.tsx \
  web/app/admin/tournaments/[id]/edit/page.tsx \
  web/app/admin/tournaments/[id]/SettingsTab.tsx
git commit -m "refactor(dal): make tournaments.ts environment-agnostic

- Each function takes SupabaseClient as first arg
- Errors throw instead of being swallowed
- updateTournament uses Partial<Tournament> instead of Record<string, unknown>
- Update all 6 internal callers to pass the client

Closes #33 (A2 for tournaments), #34 (A3 for tournaments), #35 (A9 for tournaments)"
```

---

## Task 2: Apply the same recipe to `matches.ts`

**Files:**
- Modify: `web/lib/db/matches.ts`
- Create: `web/lib/db/__tests__/matches.test.ts`
- Modify (callers): every file that imports from `@/lib/db/matches`:
  - `web/app/admin/tournaments/[id]/MatchStatusControls.tsx`
  - `web/app/admin/tournaments/[id]/ScoreEditor.tsx`
  - `web/app/admin/tournaments/[id]/page.tsx`
  - `web/app/admin/tournaments/[id]/FixturesTab.tsx`
  - `web/app/admin/tournaments/[id]/scorekeepers/page.tsx`
  - `web/app/admin/tournaments/[id]/fixtures/page.tsx`

- [ ] **Step 1: Read the current file**

```
cd web && cat lib/db/matches.ts
```

Note the exported functions and their current signatures.

- [ ] **Step 2: Write the failing test**

Create `web/lib/db/__tests__/matches.test.ts` following the exact pattern from `tournaments.test.ts` (Task 1, Step 1). Cover at minimum: one read function, one mutation, one error-throws case. Reuse the `mockClient` helper pattern verbatim.

- [ ] **Step 3: Run test — expect FAIL**

```
cd web && pnpm test lib/db/__tests__/matches.test.ts
```

- [ ] **Step 4: Refactor `matches.ts`**

Apply the same three rules from Task 1:
1. Add `supabase: SupabaseClient` as the **first** argument to every exported function
2. Remove `import { createClient } from '@/lib/supabase/client'` and any `const supabase = createClient()` lines
3. Replace `if (error) return null` / silent error swallowing with `throw new Error(error.message)` (exception: `.single()` queries may return `null` when `error.code === 'PGRST116'` — that's "no row found," not a failure)
4. Replace `Record<string, unknown>` patch params with `Partial<DomainType>` where the domain type exists in `@/lib/supabase/types`

- [ ] **Step 5: Run test — expect PASS**

```
cd web && pnpm test lib/db/__tests__/matches.test.ts
```

- [ ] **Step 6: Update every caller**

Follow Task 1 Step 5 procedure for the 6 caller files.

- [ ] **Step 7: Run health stack**

```
cd web && tsc --noEmit && pnpm lint && pnpm test
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add web/lib/db/matches.ts web/lib/db/__tests__/matches.test.ts \
  web/app/admin/tournaments/[id]/MatchStatusControls.tsx \
  web/app/admin/tournaments/[id]/ScoreEditor.tsx \
  web/app/admin/tournaments/[id]/page.tsx \
  web/app/admin/tournaments/[id]/FixturesTab.tsx \
  web/app/admin/tournaments/[id]/scorekeepers/page.tsx \
  web/app/admin/tournaments/[id]/fixtures/page.tsx
git commit -m "refactor(dal): make matches.ts environment-agnostic"
```

---

## Task 3: Apply the same recipe to `teams.ts`

**Files:**
- Modify: `web/lib/db/teams.ts`
- Create: `web/lib/db/__tests__/teams.test.ts`
- Modify (callers): every file that imports from `@/lib/db/teams`:
  - `web/app/admin/tournaments/[id]/teams/page.tsx`
  - `web/app/admin/tournaments/[id]/CsvImport.tsx`
  - `web/app/admin/tournaments/[id]/TeamsTab.tsx`
  - `web/app/admin/tournaments/[id]/fixtures/page.tsx`
  - `web/app/admin/tournaments/[id]/page.tsx`

Follow the same 8-step procedure as Task 2. Final commit message: `refactor(dal): make teams.ts environment-agnostic`.

---

## Task 4: Apply the same recipe to `players.ts`

**Files:**
- Modify: `web/lib/db/players.ts`
- Create: `web/lib/db/__tests__/players.test.ts`
- Modify (callers): every file that imports from `@/lib/db/players`:
  - `web/app/admin/tournaments/[id]/teams/page.tsx`
  - `web/app/admin/tournaments/[id]/CsvImport.tsx`
  - `web/app/admin/tournaments/[id]/TeamsTab.tsx`

Follow the same 8-step procedure as Task 2. Final commit message: `refactor(dal): make players.ts environment-agnostic`.

---

## Task 5: Apply the same recipe to `roles.ts`

**Files:**
- Modify: `web/lib/db/roles.ts`
- Create: `web/lib/db/__tests__/roles.test.ts`
- Modify (callers): every file that imports from `@/lib/db/roles`:
  - `web/app/admin/tournaments/[id]/OrganizerAssignment.tsx`
  - `web/app/admin/tournaments/[id]/SettingsTab.tsx`
  - `web/app/admin/tournaments/[id]/scorekeepers/page.tsx`

Follow the same 8-step procedure as Task 2. Final commit message: `refactor(dal): make roles.ts environment-agnostic`.

**Checkpoint:** After Task 5 commits, the DAL itself is fully refactored. The next tasks migrate the ~30 stragglers that still call `.from()` directly.

---

## Task 6: Migrate non-DAL callsites — read-only pages

These pages currently call `.from()` directly and only **read** data. Convert them to use the DAL functions you already refactored. If the table they query has no corresponding DAL function yet, add one (following the same rules as Task 1).

**Files (read-only):**
- `web/app/page.tsx`
- `web/app/admin/page.tsx`
- `web/app/admin/users/page.tsx`
- `web/app/t/[id]/page.tsx`
- `web/app/t/[id]/team/[teamId]/page.tsx`
- `web/app/login/page.tsx`
- `web/app/api/health/route.ts`
- `web/components/BracketView.tsx`

- [ ] **Step 1: For each file, list every `.from('table')` call**

```
cd web && grep -n "\.from(" app/page.tsx app/admin/page.tsx app/admin/users/page.tsx \
  app/t/[id]/page.tsx 'app/t/[id]/team/[teamId]/page.tsx' app/login/page.tsx \
  app/api/health/route.ts components/BracketView.tsx
```

- [ ] **Step 2: For each call, find the matching DAL function**

If one exists (e.g. `getTournament`, `getMatches`), replace the inline query with the DAL call. If none exists, add a new function to the appropriate DAL file following Task 1's rules (signature `(supabase, ...args)`, throws on error, typed return). Add a test for any new function.

- [ ] **Step 3: After each file is migrated, run typecheck**

```
cd web && tsc --noEmit
```

- [ ] **Step 4: After all 8 files are migrated, run full health stack**

```
cd web && tsc --noEmit && pnpm lint && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add -A web/app/page.tsx web/app/admin/page.tsx web/app/admin/users/page.tsx \
  web/app/t web/app/login web/app/api/health web/components/BracketView.tsx \
  web/lib/db
git commit -m "refactor: migrate read-only pages to use DAL

Closes part of #36 (A1)"
```

---

## Task 7: Migrate non-DAL callsites — write paths (API routes, server actions, score entry)

These files mutate data and need careful handling of the service-role vs anon client choice.

**Files (write paths):**
- `web/app/api/admin/scorekeepers/route.ts`
- `web/app/api/admin/users/route.ts`
- `web/app/api/admin/users/create/route.ts`
- `web/app/api/admin/organizers/route.ts`
- `web/app/admin/tournaments/new/actions.ts`
- `web/app/score/page.tsx`
- `web/app/score/ScoreEntry.tsx`
- `web/app/t/[id]/TournamentView.tsx` (mutation calls only — leave realtime channel logic untouched; issue #41 owns that)

- [ ] **Step 1: For each API route, identify which calls need service-role vs anon**

Service-role is required when the operation must bypass RLS (e.g. listing all users, assigning roles for users you're not). Anon/server client is used for everything else. Match the existing pattern in each file — do not change which client is used, only which function wraps the query.

- [ ] **Step 2: Migrate each file's `.from()` calls to DAL functions**

Add new DAL functions where needed (e.g. an `admin_audit_log` helper if `transitionMatchStatus` doesn't already cover it). Each new function follows Task 1's rules.

- [ ] **Step 3: For `TournamentView.tsx`, only touch the imperative mutation calls**

The realtime channel block (currently around lines 223-246) is **out of scope**. Leave the `.channel()` / `.on()` / `.subscribe()` calls alone — issue #41 owns that refactor.

- [ ] **Step 4: Run health stack after each file**

```
cd web && tsc --noEmit
```

- [ ] **Step 5: Full health stack after all files migrated**

```
cd web && tsc --noEmit && pnpm lint && pnpm test
```

- [ ] **Step 6: Manual smoke test — start the dev server and exercise each touched flow**

```
cd web && pnpm dev
```

Then in a browser:
- Log in as admin
- Create a tournament (exercises `app/admin/tournaments/new/actions.ts`)
- Open a tournament's settings, assign and remove a scorekeeper (exercises `app/api/admin/scorekeepers/route.ts`)
- Open `/score` and submit a score update (exercises `app/score/ScoreEntry.tsx`)
- Open the public tournament view (exercises `app/t/[id]/TournamentView.tsx`)
- Visit `/api/health` (exercises `app/api/health/route.ts`)

For each flow, confirm no console errors and the data persists on reload.

- [ ] **Step 7: Verify migration is complete**

```
cd web && grep -rn "\.from(" app components lib 2>/dev/null | grep -v "lib/db/" | grep -v "supabase/types"
```

Expected: zero results (or only the realtime channel lines in `TournamentView.tsx`, which are explicitly out of scope and should be tagged with a `// TODO(#41): migrate to useRealtimeTable hook` comment).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: migrate write paths to use DAL

Closes #36 (A1) — all .from() callsites outside lib/db/ now use DAL functions,
except realtime channel subscription in TournamentView.tsx which is tracked
under #41."
```

---

## Task 8: Lock in the conventions with `web/lib/db/AGENTS.md`

**Files:**
- Create: `web/lib/db/AGENTS.md`

- [ ] **Step 1: Write the file**

Create `web/lib/db/AGENTS.md` with exactly this content:

```markdown
# DAL conventions

Every function in this directory MUST follow these rules. Future agents and humans editing this folder are expected to read this file first.

## Signature

- The **first argument** is always `supabase: SupabaseClient` (from `@supabase/supabase-js`).
- The function MUST NOT create its own client. Callers pass whichever client fits their runtime:
  - Client component → `createClient()` from `@/lib/supabase/client`
  - Server component / server action / API route → `await createClient()` from `@/lib/supabase/server`
  - Admin operation that must bypass RLS → `createServiceClient()` from `@/lib/supabase/server`

## Errors

- Throw `new Error(error.message)` on any unexpected error.
- The only allowed "soft null" is `.single()` returning no row — detect via `error.code === 'PGRST116'` and return `null`.
- Do NOT return `{ data, error }` builders or partially-resolved query objects. Await everything before returning.

## Types

- Patch arguments use `Partial<DomainType>`, never `Record<string, unknown>`.
- Return values use the domain types from `@/lib/supabase/types`.
- No `'use client'` directive — this layer is environment-agnostic by contract.

## Why these rules exist

- Client-only DAL forces server components to bypass it and call `.from()` directly, leading to drift and 30+ ad-hoc callsites (the original A1/A2 problem).
- Swallowed errors hide bugs; throwing surfaces them at the caller boundary (A3).
- Untyped patches let any field slip through, including misspelled column names (A9).

See `docs/superpowers/plans/2026-05-19-dal-refactor.md` for the refactor that established these conventions.
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/db/AGENTS.md
git commit -m "docs(dal): document DAL conventions to prevent drift"
```

---

## Done criteria

After Task 8, the following must all be true:
- `cd web && tsc --noEmit && pnpm lint && pnpm test` passes
- `grep -rn "\.from(" web/app web/components web/lib 2>/dev/null | grep -v "lib/db/" | grep -v "supabase/types"` returns only the realtime channel lines in `TournamentView.tsx` (commented with `// TODO(#41)`)
- Every file in `web/lib/db/*.ts` (excluding tests) has zero imports from `@/lib/supabase/client`
- `web/lib/db/AGENTS.md` exists
- Manual smoke test from Task 7 Step 6 passed

If any criterion fails, return to the corresponding task before reporting done.
