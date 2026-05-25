# Setup Tabs Speed Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tab switching in `/admin/tournaments/[id]/setup/*` instant by replacing route-based `<Link>` navigation with client-side state, eliminating redundant Supabase fetches.

**Architecture:** Layout tracks active tab via `usePathname()`, renders tab components inline. Tab buttons use `router.replace` for URL sync without triggering a layout remount. Data fetches once via `SetupContext`.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase, Tailwind CSS

---

## File Map

| File | Role |
|------|------|
| `web/app/admin/tournaments/[id]/setup/layout.tsx` | Core: inline tab rendering, activeTab state, one-time data fetch |
| `web/app/admin/tournaments/[id]/TabStrip.tsx` | Tab buttons with `router.replace` instead of `<Link>` |
| `web/app/admin/tournaments/[id]/setup/settings/page.tsx` | Settings tab: use `useSetup()` instead of own fetch |
| `web/app/admin/tournaments/[id]/setup/overview/page.tsx` | **New**: Overview tab consuming `SetupContext` |
| `web/app/admin/tournaments/[id]/page.tsx` | Redirect to `/setup` |
| `web/app/admin/tournaments/[id]/setup/page.tsx` | Redirect to `overview` |

---

### Task 1: Update TabStrip to use buttons instead of `<Link>`

**Files:**
- Modify: `web/app/admin/tournaments/[id]/TabStrip.tsx`

**What:** Replace `<Link>` navigation with `<button onClick>` callbacks. Accept `activeTab` and `onTabChange` props. Overview segment becomes `'overview'` instead of `''`.

- [ ] **Step 1: Rewrite TabStrip component**

Replace the entire file with:

```tsx
'use client'

import { useParams, useRouter, usePathname } from 'next/navigation'

interface TabDef {
  segment: string
  label: string
}

const TABS: TabDef[] = [
  { segment: 'overview', label: 'Overview' },
  { segment: 'teams', label: 'Teams' },
  { segment: 'fixtures', label: 'Fixtures' },
  { segment: 'settings', label: 'Settings' },
]

interface Props {
  teamsAlert?: boolean
}

export function TabStrip({ teamsAlert = false }: Props) {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const pathname = usePathname()
  const basePath = `/admin/tournaments/${id}/setup`

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto flex">
        {TABS.map(tab => {
          const href = `${basePath}/${tab.segment}`
          const isActive = pathname === href || pathname.endsWith(`/${tab.segment}`)
          return (
            <button
              key={tab.segment}
              onClick={() => router.replace(href)}
              className={`relative px-5 py-3 text-sm font-medium transition-colors ${
                isActive ? 'text-green-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.segment === 'teams' && teamsAlert && (
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd web && tsc --noEmit`
Expected: PASS (no errors)

---

### Task 2: Create overview page that uses SetupContext

**Files:**
- Create: `web/app/admin/tournaments/[id]/setup/overview/page.tsx`

**What:** New route file that renders the existing `OverviewTab` component using data from `useSetup()`. This page is also a valid direct-access URL for `/setup/overview`.

- [ ] **Step 1: Create the overview page**

```tsx
'use client'

import { useSetup } from '../SetupContext'
import { OverviewTab } from '../../OverviewTab'

export default function SetupOverviewPage() {
  const { tournament, teams, matches, isAdmin, isOrganizer, refresh } = useSetup()

  return (
    <OverviewTab
      tournament={tournament}
      matches={matches}
      teams={teams}
      tournamentId={tournament.id}
      isAdmin={isAdmin}
      isOrganizer={isOrganizer}
      onRefresh={refresh}
    />
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd web && tsc --noEmit`
Expected: PASS

---

### Task 3: Refactor settings page to use SetupContext

**Files:**
- Modify: `web/app/admin/tournaments/[id]/setup/settings/page.tsx`

**What:** Remove redundant data fetching. Use `useSetup()` to get `tournament`, `matches`, `isAdmin` instead of fetching independently. The `SettingsTab` component already accepts these as props.

- [ ] **Step 1: Rewrite settings page to use context**

Replace the entire file with:

```tsx
'use client'

import { useSetup } from '../SetupContext'
import { SettingsTab } from '../../SettingsTab'

export default function SetupSettingsPage() {
  const { tournament, matches, isAdmin, refresh } = useSetup()

  return (
    <SettingsTab
      tournament={tournament}
      matches={matches}
      tournamentId={tournament.id}
      isAdmin={isAdmin}
      onRefresh={refresh}
    />
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd web && tsc --noEmit`
Expected: PASS

---

### Task 4: Rewrite setup layout for inline tab rendering

**Files:**
- Modify: `web/app/admin/tournaments/[id]/setup/layout.tsx`

**What:** This is the core change. Layout imports all 4 tab components, determines active tab from pathname, renders the correct one inline. Data fetches once via `useEffect`, provides via `SetupContext`.

- [ ] **Step 1: Rewrite layout with inline tabs**

Replace the entire file with:

```tsx
'use client'

import { useParams, useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getTournament, getCurrentUser, getUserRoles } from '@/lib/db/tournaments'
import { getTeams } from '@/lib/db/teams'
import { getMatches } from '@/lib/db/matches'
import { TabStrip } from '../TabStrip'
import { SetupProvider, useSetup, type SetupContextValue } from './SetupContext'
import { OverviewTab } from '../OverviewTab'
import SetupTeamsPage from './teams/page'
import SetupFixturesPage from './fixtures/page'
import SetupSettingsPage from './settings/page'
import type { Tournament, MatchWithTeams, TeamWithPlayers } from '@/lib/supabase/types'

interface RoleInfo { role: string; tournament_id: string | null }

function OverviewContent() {
  const { tournament, teams, matches, isAdmin, isOrganizer, refresh } = useSetup()
  return (
    <OverviewTab
      tournament={tournament}
      matches={matches}
      teams={teams}
      tournamentId={tournament.id}
      isAdmin={isAdmin}
      isOrganizer={isOrganizer}
      onRefresh={refresh}
    />
  )
}

function TabContent({ tab }: { tab: string }) {
  switch (tab) {
    case 'teams': return <SetupTeamsPage />
    case 'fixtures': return <SetupFixturesPage />
    case 'settings': return <SetupSettingsPage />
    default: return <OverviewContent />
  }
}

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<TeamWithPlayers[]>([])
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOrganizer, setIsOrganizer] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const user = await getCurrentUser(supabase)
    if (!user) { window.location.href = '/login'; return }

    const [t, teamsData, matchesData, roles] = await Promise.all([
      getTournament(supabase, id),
      getTeams(supabase, id),
      getMatches(supabase, id),
      getUserRoles(supabase, user.id),
    ])

    if (!t) { router.push('/admin'); return }

    const admin = roles.some((r: RoleInfo) => r.role === 'admin')
    const organizer = admin || roles.some((r: RoleInfo) => r.role === 'organizer' && r.tournament_id === id)

    if (!organizer) { router.push('/admin'); return }

    setTournament(t)
    setTeams(teamsData)
    setMatches(matchesData)
    setIsAdmin(admin)
    setIsOrganizer(organizer)
    setLoading(false)
  }, [id, router])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const activeTab = pathname.split('/').pop() || 'overview'

  if (loading || !tournament) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    )
  }

  const teamsAlert = teams.some(t => t.players.length < tournament.min_players_per_team) ||
    (tournament.num_groups != null && tournament.teams_per_group != null &&
     teams.length < tournament.num_groups * tournament.teams_per_group)

  const value: SetupContextValue = { tournament, teams, matches, isAdmin, isOrganizer, refresh: load }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="font-bold text-slate-900 truncate max-w-xs">{tournament.name}</span>
          <div className="w-20" />
        </div>
      </header>
      <TabStrip teamsAlert={teamsAlert} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <SetupProvider value={value}>
          <TabContent tab={activeTab} />
        </SetupProvider>
      </main>
    </div>
  )
}
```

**Note:** `OverviewContent` uses `useSetup()` inside `SetupProvider` — this is safe because `TabContent` is always rendered as a child of `SetupProvider`. The `{children}` prop is accepted but not rendered — route files serve as direct-access fallbacks only.

- [ ] **Step 2: Run typecheck**

Run: `cd web && tsc --noEmit`
Expected: PASS

---

### Task 5: Update redirects

**Files:**
- Modify: `web/app/admin/tournaments/[id]/page.tsx`
- Modify: `web/app/admin/tournaments/[id]/setup/page.tsx`

**What:** Tournament detail page redirects to `/setup`. Setup index redirects to `overview`.

- [ ] **Step 1: Simplify tournament detail page to redirect**

Replace `web/app/admin/tournaments/[id]/page.tsx` with:

```tsx
'use client'

import { useParams, redirect } from 'next/navigation'

export default function TournamentDetailPage() {
  const { id } = useParams() as { id: string }
  redirect(`/admin/tournaments/${id}/setup`)
}
```

This uses `redirect` from `next/navigation` which throws a redirect — works in client components.

- [ ] **Step 2: Update setup index redirect to overview**

Modify `web/app/admin/tournaments/[id]/setup/page.tsx` — change line 12:

```tsx
// Before:
router.replace(`/admin/tournaments/${id}/setup/teams`)

// After:
router.replace(`/admin/tournaments/${id}/setup/overview`)
```

- [ ] **Step 3: Run typecheck**

Run: `cd web && tsc --noEmit`
Expected: PASS

---

### Task 6: Verify everything works

- [ ] **Step 1: Run full typecheck**

Run: `cd web && tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run linter**

Run: `cd web && pnpm lint`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `cd web && pnpm test`
Expected: 26 test files, 248 tests passed

- [ ] **Step 4: Manual verification**

Start dev server: `cd web && pnpm dev`
Navigate to `http://localhost:3000/admin/tournaments/[id]`
- Verify redirect to `/setup` then to `/setup/overview`
- Click each tab — should be instant, no loading spinner
- URL bar should update on each tab click
- Refresh on a tab URL should show that tab
- Open Network tab — should see only 4 requests on initial load, 0 on tab switches
- Form state (e.g. selected team in Teams tab) should persist across tab switches
