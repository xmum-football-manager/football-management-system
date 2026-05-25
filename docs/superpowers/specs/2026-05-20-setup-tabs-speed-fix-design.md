# Design: Client-side Setup Tabs with URL Sync

## Problem

Tab switching in `/admin/tournaments/[id]/setup/*` is slow because:

1. **`<Link>` causes full client-side route change** — layout re-mounts on every tab click
2. **Layout re-fetches 4 Supabase queries** on every mount (tournament, teams, matches, roles)
3. **`setup/settings/page.tsx` fetches redundantly** — ignores `SetupContext`, fetches the same 3 queries independently
4. **Child components lose state** — e.g. selected team in roster editor resets on tab switch

Net result: every tab click = 7 network requests to Supabase.

## Goal

Instant tab switching. Data fetched once. URL stays in sync. Back button navigates to previous page, not previous tab.

## Approach

Client-side tabs with `router.replace` for URL sync (Approach A from brainstorm).

- Layout reads `usePathname()` → maps to `activeTab` state
- Tab buttons call `router.replace(href)` — shallow URL update, no layout remount
- Layout never unmounts → data fetched once → SetupContext provides to all tabs

## URL Structure

```
/admin/tournaments/[id]                   → redirect to /setup
/admin/tournaments/[id]/setup             → redirect to /setup/overview
/admin/tournaments/[id]/setup/overview    → Overview tab (default)
/admin/tournaments/[id]/setup/teams       → Teams tab
/admin/tournaments/[id]/setup/fixtures    → Fixtures tab
/admin/tournaments/[id]/setup/settings    → Settings tab
```

Existing route files (`/setup/teams/page.tsx`, etc.) stay as direct-access entry points but are no longer the primary navigation targets.

## File Changes

### 1. `setup/layout.tsx` — core change

- Add `activeTab` state derived from `usePathname()` (extract last path segment)
- Import all 4 tab components: `OverviewTab`, `SetupTeamsPage`, `SetupFixturesPage`, `SetupSettingsTab`
- Conditionally render the active tab component inline (not via route children)
- Pass `activeTab` and `onTabChange` to `TabStrip`
- `useEffect` runs `load()` once on mount → provides data via `SetupContext`
- Remove `children` prop usage (render tabs directly)

### 2. `TabStrip.tsx` — buttons instead of links

- Accept `activeTab: string` and `onTabChange: (segment: string) => void` props
- Replace `<Link>` with `<button onClick={...}>`
- `onTabChange` calls `router.replace(href)` — URL updates without navigation
- Overview tab segment becomes `'overview'` (not empty string)
- Tabs: `overview | teams | fixtures | settings`

### 3. `setup/settings/page.tsx` — use SetupContext

- Remove own `load()`, `useEffect`, and redundant fetches
- Import and use `useSetup()` to get `tournament`, `matches`, `isAdmin`
- Export as `SetupSettingsTab` (rename to match pattern, or keep as component)

### 4. `setup/overview/page.tsx` — new file

- Renders existing `OverviewTab` component
- Gets data from `useSetup()` (tournament, teams, matches, isAdmin, isOrganizer, refresh)
- OverviewTab already accepts matching props — no changes needed to the component

### 5. `tournaments/[id]/page.tsx` — redirect

- Simplify to server component that calls `redirect('/admin/tournaments/${id}/setup')`

### 6. `setup/page.tsx` — redirect

- Change redirect from `setup/teams` to `setup/overview`

## Files Summary

| File | Action |
|------|--------|
| `setup/layout.tsx` | Rewrite — inline tab rendering, activeTab state |
| `TabStrip.tsx` | Rewrite — buttons instead of `<Link>` |
| `setup/settings/page.tsx` | Refactor — use `useSetup()` instead of own fetch |
| `setup/overview/page.tsx` | **New** — OverviewTab with context |
| `tournaments/[id]/page.tsx` | Simplify — redirect to `/setup` |
| `setup/page.tsx` | Change redirect to `overview` |
| `OverviewTab.tsx` | No changes (just moves to new location conceptually) |
| `SetupContext.tsx` | No changes (already has all needed fields) |
| `setup/teams/page.tsx` | No changes (already uses `useSetup()`) |
| `setup/fixtures/page.tsx` | No changes (already uses `useSetup()`) |

## What Stays the Same

- Route files for direct URL access (refresh, share links)
- `SetupContext.tsx` interface
- `OverviewTab.tsx`, `GoLivePanel`, `MatchStatusControls`, `ScoreEditor` components
- All data fetching logic (just runs once instead of per-tab)

## Browser History Behavior

Tab clicks use `router.replace` — no history entries created. Back button goes to the previous page (e.g. dashboard), not the previous tab.

## Verification

1. **Typecheck:** `cd web && tsc --noEmit`
2. **Lint:** `cd web && pnpm lint`
3. **Tests:** `cd web && pnpm test`
4. **Manual test:** Navigate to `/admin/tournaments/[id]`
   - Tab switching is instant (no loading spinner)
   - URL bar updates on tab click
   - Refresh on a tab URL shows correct tab
   - Form state persists across tab switches (e.g. selected team)
   - No duplicate Supabase requests in Network tab
