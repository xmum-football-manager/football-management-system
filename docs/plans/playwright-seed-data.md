# Playwright Test Data Seeding Plan

## Problem

3 Playwright tests fail due to missing data:

| Test | URL | Root cause |
|------|-----|------------|
| `admin/tournaments` | `/admin/tournaments` | No `page.tsx` exists at this route — only `/admin/tournaments/[id]` exists. Always 404s. |
| `tournament public` | `/t/test-tournament` | Route uses UUID (`id`), not slug. `test-tournament` is not a valid UUID. Always 404s. |
| `login error` | `/login` | WebKit-specific timing — selector `.text-red-600` doesn't appear within timeout. Not a data issue. |

## Solution

Seed a test tournament via Supabase before tests run.

## Tasks

### 1. Create `web/tests/seed.setup.ts`
- Uses `@supabase/supabase-js` with service role key
- Creates a test tournament (name: "Visual Test Tournament", status: "active")
- Writes tournament ID to `playwright/.test-data.json`

### 2. Update `web/playwright.config.ts`
- Add `seed` project that runs before other projects

### 3. Fix `tournament.spec.ts`
- Read tournament ID from `playwright/.test-data.json`
- Navigate to `/t/{tournamentId}` instead of `/t/test-tournament`

### 4. Fix `admin.spec.ts`
- Change `/admin/tournaments` → `/admin/tournaments/{tournamentId}`

### 5. Add `.gitignore` entry
- Ignore `playwright/.test-data.json`
