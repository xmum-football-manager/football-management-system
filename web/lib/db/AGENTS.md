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

## Callers

- Exactly ONE `createClient()` call per file. Hoist to component body (after hooks, before handlers) and reuse it everywhere in that file.
- If a local sub-component in the same file needs the client, pass it as a `supabase: SupabaseClient` prop (import the type from `@supabase/supabase-js`).
- Convert old `const { error } = await fn(...)` patterns to `try/catch` — the DAL throws now.

## Why these rules exist

- Client-only DAL forces server components to bypass it and call `.from()` directly, leading to drift and 30+ ad-hoc callsites (the original A1/A2 problem).
- Swallowed errors hide bugs; throwing surfaces them at the caller boundary (A3).
- Untyped patches let any field slip through, including misspelled column names (A9).
- Multiple `createClient()` calls per file fragment session/cookie state and make future refactors harder.

See `docs/superpowers/plans/2026-05-19-dal-refactor.md` for the refactor that established these conventions.
