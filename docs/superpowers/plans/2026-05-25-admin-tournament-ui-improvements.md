# Admin Tournament UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three improvements to `/admin/tournaments/[id]/`: fix mobile tab horizontal scroll, merge Organizers + Scorekeepers into a new "Users" tab, and add CSV bulk-import (8-team × 20-player sample) to the Teams tab.

**Architecture:** The tournament detail area uses Next.js App Router with route-based tabs under `web/app/admin/tournaments/[id]/`. Each tab is a separate route folder with a server `page.tsx` that loads data and a client `*Panel.tsx` for interaction. We follow this same pattern for the new Users tab. Server actions live in `actions.ts` within each route folder.

**Tech Stack:** TypeScript, Next.js 15 App Router, Supabase SSR (`@supabase/ssr`), Tailwind CSS, Vitest for unit tests.

---

## File Map

| Action | File | Why |
|--------|------|-----|
| Modify | `web/app/globals.css` | Add `.scrollbar-hide` utility |
| Modify | `web/app/admin/tournaments/[id]/TournamentNav.tsx` | Add scrollbar-hide class; swap Scorekeepers → Users tab |
| **Create** | `web/app/admin/tournaments/[id]/users/actions.ts` | Server actions for organizer + scorekeeper assign/remove |
| **Create** | `web/app/admin/tournaments/[id]/users/UsersPanel.tsx` | Combined client UI for organizer + scorekeeper sections |
| **Create** | `web/app/admin/tournaments/[id]/users/page.tsx` | Server component loading organizer + scorekeeper data |
| Modify | `web/app/admin/tournaments/[id]/settings/SettingsPanel.tsx` | Remove organizer card + props |
| Modify | `web/app/admin/tournaments/[id]/settings/page.tsx` | Remove organizer data loading + `isAdmin` prop |
| **Delete** | `web/app/admin/tournaments/[id]/scorekeepers/` | Entire folder (page, panel, actions) |
| **Create** | `web/lib/csv.ts` | Pure CSV parser used by TeamsPanel (testable) |
| **Create** | `web/__tests__/csv.test.ts` | Unit tests for CSV parser |
| Modify | `web/app/admin/tournaments/[id]/teams/actions.ts` | Add `importTeamsCsvAction` |
| Modify | `web/app/admin/tournaments/[id]/teams/TeamsPanel.tsx` | Add download-sample + import-CSV buttons |

---

### Task 1: Add `.scrollbar-hide` CSS and fix TournamentNav mobile scroll

**Files:**
- Modify: `web/app/globals.css`
- Modify: `web/app/admin/tournaments/[id]/TournamentNav.tsx`

- [ ] **Step 1: Add `.scrollbar-hide` to globals.css**

At the end of `web/app/globals.css` add:

```css
/* Hides scrollbar visually while keeping scroll behaviour */
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

- [ ] **Step 2: Apply class and tighten nav in TournamentNav.tsx**

Replace the entire `<nav>` element (line 22–48) in `web/app/admin/tournaments/[id]/TournamentNav.tsx`:

```tsx
  return (
    <nav
      className="-mx-2 overflow-x-auto px-2 scrollbar-hide"
      style={{ borderBottom: '1px solid var(--admin-rule)' }}
    >
      <ul className="flex gap-0 min-w-max">
        {tabs.map((t) => {
          const active = pathname === t.href
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className="admin-tab inline-block px-4 py-2.5 text-[12px] transition-colors -mb-px"
                style={{
                  color: active ? 'var(--admin-lime)' : 'var(--muted-foreground)',
                  borderBottom: active
                    ? '2px solid var(--admin-lime)'
                    : '2px solid transparent',
                }}
              >
                {t.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
```

(Only change is `scrollbar-hide` added to the `<nav>` className.)

- [ ] **Step 3: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css web/app/admin/tournaments/[id]/TournamentNav.tsx
git commit -m "fix: hide tab scrollbar on mobile while preserving touch-scroll"
```

---

### Task 2: Create `users/actions.ts`

**Files:**
- Create: `web/app/admin/tournaments/[id]/users/actions.ts`

This file re-houses the organizer and scorekeeper server actions so they `revalidatePath` the `/users` route.

- [ ] **Step 1: Create the file**

Create `web/app/admin/tournaments/[id]/users/actions.ts`:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireUser, requireAdmin } from '@/lib/auth'
import { assignRole, findUserIdByEmail, isAdmin, isOrganizer, removeRole } from '@/lib/db/roles'

async function ensureOrganizer(tournamentId: string) {
  const user = await requireUser()
  if (await isAdmin(user.id)) return
  if (!(await isOrganizer(user.id, tournamentId))) throw new Error('Not authorized.')
}

export async function assignOrganizerAction(
  tournamentId: string,
  email: string,
): Promise<{ id: string } | { error: string }> {
  try {
    await requireAdmin()
    const userId = await findUserIdByEmail(email)
    if (!userId) return { error: `No account with email "${email}".` }
    const result = await assignRole({
      user_id: userId,
      role: 'organizer',
      tournament_id: tournamentId,
    })
    if ('id' in result) revalidatePath(`/admin/tournaments/${tournamentId}/users`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function removeOrganizerAction(
  roleId: string,
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireAdmin()
    const r = await removeRole(roleId)
    if (r.error) return { error: r.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/users`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function assignScorekeeperAction(input: {
  tournamentId: string
  email: string
  scope: 'tournament' | 'match'
  matchId: string | null
}): Promise<{ id: string } | { error: string }> {
  try {
    await ensureOrganizer(input.tournamentId)
    const userId = await findUserIdByEmail(input.email)
    if (!userId) return { error: `No account with email "${input.email}".` }
    const result = await assignRole({
      user_id: userId,
      role: 'scorekeeper',
      tournament_id: input.scope === 'tournament' ? input.tournamentId : null,
      match_id: input.scope === 'match' ? input.matchId : null,
    })
    if ('id' in result) revalidatePath(`/admin/tournaments/${input.tournamentId}/users`)
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function removeScorekeeperAction(
  roleId: string,
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const r = await removeRole(roleId)
    if (r.error) return { error: r.error }
    revalidatePath(`/admin/tournaments/${tournamentId}/users`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/[id]/users/actions.ts
git commit -m "feat: add users/actions.ts with organizer + scorekeeper server actions"
```

---

### Task 3: Create `UsersPanel.tsx`

**Files:**
- Create: `web/app/admin/tournaments/[id]/users/UsersPanel.tsx`

This is a client component combining the organizer UI (from `SettingsPanel`) and the scorekeeper UI (from `ScorekeepersPanel`), adapted to import from `./actions`.

- [ ] **Step 1: Create the file**

Create `web/app/admin/tournaments/[id]/users/UsersPanel.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, UserPlus, Trash2 } from 'lucide-react'
import {
  assignOrganizerAction,
  removeOrganizerAction,
  assignScorekeeperAction,
  removeScorekeeperAction,
} from './actions'

interface Match {
  id: string
  label: string
  time: string
}

interface ScorekeeperAssignment {
  id: string
  email: string
  scope: 'tournament' | 'match'
  matchLabel: string | null
}

interface Props {
  tournamentId: string
  isAdmin: boolean
  organizers: { id: string; email: string }[]
  matches: Match[]
  scorekeeperAssignments: ScorekeeperAssignment[]
}

export function UsersPanel({
  tournamentId,
  isAdmin,
  organizers,
  matches,
  scorekeeperAssignments,
}: Props) {
  return (
    <div className="space-y-8">
      {isAdmin && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Organizers</h2>
            <p className="text-xs text-muted-foreground">
              Organizers can manage this tournament&apos;s teams, fixtures, and scores.
            </p>
          </div>
          <OrganizersSection tournamentId={tournamentId} organizers={organizers} />
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Scorekeepers</h2>
          <p className="text-xs text-muted-foreground">
            Scorekeepers can enter match scores during the tournament.
          </p>
        </div>
        <ScorekeepersSection
          tournamentId={tournamentId}
          matches={matches}
          assignments={scorekeeperAssignments}
        />
      </section>
    </div>
  )
}

function OrganizersSection({
  tournamentId,
  organizers,
}: {
  tournamentId: string
  organizers: { id: string; email: string }[]
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()

  function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    startTransition(async () => {
      const r = await assignOrganizerAction(tournamentId, email.trim())
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Organizer assigned.')
        setEmail('')
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <form onSubmit={handleAssign} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="org-email" className="sr-only">Email</Label>
            <Input
              id="org-email"
              type="email"
              placeholder="organizer@club.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </div>
          <Button type="submit" disabled={pending || !email.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Assign
          </Button>
        </form>
        <div className="divide-y border-t">
          {organizers.length === 0 ? (
            <div className="py-3 text-sm text-muted-foreground">No organizers assigned.</div>
          ) : (
            organizers.map((o) => (
              <div key={o.id} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 truncate text-sm">{o.email}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-700 hover:bg-red-50"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await removeOrganizerAction(o.id, tournamentId)
                      if ('error' in r) toast.error(r.error)
                      else {
                        toast.success('Removed.')
                        router.refresh()
                      }
                    })
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ScorekeepersSection({
  tournamentId,
  matches,
  assignments,
}: {
  tournamentId: string
  matches: Match[]
  assignments: ScorekeeperAssignment[]
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [scope, setScope] = useState<'tournament' | 'match'>('tournament')
  const [matchId, setMatchId] = useState('')
  const [pending, startTransition] = useTransition()

  function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (scope === 'match' && !matchId) {
      toast.error('Pick a match.')
      return
    }
    startTransition(async () => {
      const r = await assignScorekeeperAction({
        tournamentId,
        email: email.trim(),
        scope,
        matchId: scope === 'match' ? matchId : null,
      })
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Scorekeeper assigned.')
        setEmail('')
        setMatchId('')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Assign a scorekeeper</h3>
          <form onSubmit={handleAssign} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sk-email">Email</Label>
              <Input
                id="sk-email"
                type="email"
                placeholder="scorekeeper@club.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The user must already have a scorekeeper account.
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Scope</legend>
              <div className="flex flex-col gap-2">
                <label className={`flex items-start gap-3 rounded-md border p-2.5 cursor-pointer ${scope === 'tournament' ? 'border-emerald-600 bg-emerald-50' : 'hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="sk-scope"
                    className="mt-1"
                    checked={scope === 'tournament'}
                    onChange={() => setScope('tournament')}
                  />
                  <div>
                    <div className="text-sm font-medium">Entire tournament</div>
                    <div className="text-xs text-muted-foreground">Scores any match in this tournament.</div>
                  </div>
                </label>
                <label className={`flex items-start gap-3 rounded-md border p-2.5 cursor-pointer ${scope === 'match' ? 'border-emerald-600 bg-emerald-50' : 'hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="sk-scope"
                    className="mt-1"
                    checked={scope === 'match'}
                    onChange={() => setScope('match')}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Specific match</div>
                    <div className="text-xs text-muted-foreground">Only the chosen match.</div>
                    {scope === 'match' && (
                      <div className="mt-2">
                        <Select value={matchId} onValueChange={setMatchId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pick a match" />
                          </SelectTrigger>
                          <SelectContent>
                            {matches.length === 0 ? (
                              <SelectItem value="__none__" disabled>
                                No scheduled matches
                              </SelectItem>
                            ) : (
                              matches.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.label}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </fieldset>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Assign
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Current Assignments ({assignments.length})
        </h3>
        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No scorekeepers assigned yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3">
                  <span className="flex-1 truncate font-medium text-sm">{a.email}</span>
                  {a.scope === 'tournament' ? (
                    <Badge variant="info">Tournament-wide</Badge>
                  ) : (
                    <Badge variant="outline">{a.matchLabel ?? 'Match'}</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-700 hover:bg-red-50"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await removeScorekeeperAction(a.id, tournamentId)
                        if ('error' in r) toast.error(r.error)
                        else {
                          toast.success('Removed.')
                          router.refresh()
                        }
                      })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/[id]/users/UsersPanel.tsx
git commit -m "feat: add UsersPanel combining organizer + scorekeeper assignment"
```

---

### Task 4: Create `users/page.tsx`

**Files:**
- Create: `web/app/admin/tournaments/[id]/users/page.tsx`

Server component that loads organizer + scorekeeper data and passes it to `UsersPanel`.

- [ ] **Step 1: Create the file**

Create `web/app/admin/tournaments/[id]/users/page.tsx`:

```tsx
import { requireUser } from '@/lib/auth'
import { isAdmin, listOrganizerRoles, listScorekeeperRoles } from '@/lib/db/roles'
import { getTournament } from '@/lib/db/tournaments'
import { listMatches } from '@/lib/db/matches'
import { createServiceClient } from '@/lib/supabase/server'
import { UsersPanel } from './UsersPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function UsersPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null

  const admin = await isAdmin(user.id)

  const svc = createServiceClient()
  const [matches, scorekeeperRoles, organizerRoles, { data: authData }] = await Promise.all([
    listMatches(id),
    listScorekeeperRoles(id),
    admin ? listOrganizerRoles(id) : Promise.resolve([]),
    svc.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ])

  const emails = new Map<string, string>()
  for (const u of authData?.users ?? []) {
    if (u.email) emails.set(u.id, u.email)
  }

  const organizers = organizerRoles.map((r) => ({
    id: r.id,
    email: emails.get(r.user_id) ?? '(unknown)',
  }))

  const scorekeeperAssignments = scorekeeperRoles.map((r) => {
    const match = r.match_id ? matches.find((m) => m.id === r.match_id) : null
    return {
      id: r.id,
      email: emails.get(r.user_id) ?? '(unknown)',
      scope: r.tournament_id ? ('tournament' as const) : ('match' as const),
      matchLabel: match ? `${match.home_team.name} vs ${match.away_team.name}` : null,
    }
  })

  return (
    <UsersPanel
      tournamentId={id}
      isAdmin={admin}
      organizers={organizers}
      matches={matches
        .filter((m) => m.status !== 'finished')
        .map((m) => ({
          id: m.id,
          label: `${m.home_team.name} vs ${m.away_team.name}`,
          time: m.match_time,
        }))}
      scorekeeperAssignments={scorekeeperAssignments}
    />
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/[id]/users/page.tsx
git commit -m "feat: add users/page.tsx server component for Users tab"
```

---

### Task 5: Update TournamentNav — swap Scorekeepers for Users

**Files:**
- Modify: `web/app/admin/tournaments/[id]/TournamentNav.tsx:14-20`

- [ ] **Step 1: Replace the tabs array**

In `TournamentNav.tsx`, change the `tabs` array (lines 14–20) from:

```typescript
  const tabs: { href: string; label: string }[] = [
    { href: base, label: 'Overview' },
    { href: `${base}/teams`, label: 'Teams' },
    { href: `${base}/fixtures`, label: 'Fixtures' },
    { href: `${base}/scorekeepers`, label: 'Scorekeepers' },
    { href: `${base}/settings`, label: 'Settings' },
  ]
```

to:

```typescript
  const tabs: { href: string; label: string }[] = [
    { href: base, label: 'Overview' },
    { href: `${base}/teams`, label: 'Teams' },
    { href: `${base}/fixtures`, label: 'Fixtures' },
    { href: `${base}/users`, label: 'Users' },
    { href: `${base}/settings`, label: 'Settings' },
  ]
```

- [ ] **Step 2: Typecheck and lint**

```bash
cd web && pnpm tsc --noEmit && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/[id]/TournamentNav.tsx
git commit -m "feat: replace Scorekeepers tab with Users tab in tournament nav"
```

---

### Task 6: Remove organizer section from SettingsPanel

**Files:**
- Modify: `web/app/admin/tournaments/[id]/settings/SettingsPanel.tsx`
- Modify: `web/app/admin/tournaments/[id]/settings/page.tsx`
- Modify: `web/app/admin/tournaments/[id]/settings/actions.ts`

The organizer section (assign form + list) moves to the Users tab. Settings now only has tournament status + danger zone. We also remove `assignOrganizerAction` / `removeOrganizerAction` from settings/actions.ts since they now live in users/actions.ts.

- [ ] **Step 1: Rewrite SettingsPanel.tsx**

Replace the entire file `web/app/admin/tournaments/[id]/settings/SettingsPanel.tsx` with:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Loader2, Archive, CheckCircle2, Trash2 } from 'lucide-react'
import {
  archiveTournamentAction,
  finishTournamentAction,
  deleteTournamentAction,
} from './actions'
import type { Tournament } from '@/lib/supabase/types'

interface Props {
  tournamentId: string
  tournament: Tournament
  isAdmin: boolean
}

export function SettingsPanel({ tournamentId, tournament, isAdmin }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-5 max-w-3xl">
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-sm">Tournament status</h3>
          <p className="text-xs text-muted-foreground">
            Current status: <span className="font-medium text-foreground">{tournament.status}</span>.
          </p>
          <div className="flex gap-2 flex-wrap">
            {tournament.status === 'active' && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await finishTournamentAction(tournamentId)
                    if ('error' in r) toast.error(r.error)
                    else {
                      toast.success('Tournament marked finished.')
                      router.refresh()
                    }
                  })
                }
              >
                <CheckCircle2 className="h-4 w-4" /> Mark as Finished
              </Button>
            )}
            {tournament.status === 'finished' && isAdmin && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await archiveTournamentAction(tournamentId)
                    if ('error' in r) toast.error(r.error)
                    else {
                      toast.success('Archived.')
                      router.refresh()
                    }
                  })
                }
              >
                <Archive className="h-4 w-4" /> Archive
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-red-200">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm text-red-700">Danger zone</h3>
            <p className="text-xs text-muted-foreground">
              Deleting a tournament removes its teams, players, fixtures, and scores. This cannot be undone.
            </p>
            <DangerDelete tournamentName={tournament.name} tournamentId={tournamentId} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DangerDelete({
  tournamentName,
  tournamentId,
}: {
  tournamentName: string
  tournamentId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [pending, startTransition] = useTransition()

  const canDelete = confirm.trim() === tournamentName

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4" /> Delete tournament
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{tournamentName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            Type <span className="font-mono">{tournamentName}</span> to confirm. This permanently
            removes all teams, players, fixtures, and scores.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          autoFocus
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={tournamentName}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canDelete || pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault()
              startTransition(async () => {
                const r = await deleteTournamentAction(tournamentId)
                if ('error' in r) toast.error(r.error)
                else {
                  toast.success('Tournament deleted.')
                  setOpen(false)
                  router.push('/admin')
                  router.refresh()
                }
              })
            }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Delete forever
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 2: Update settings/page.tsx**

Replace the entire file `web/app/admin/tournaments/[id]/settings/page.tsx` with:

```tsx
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { getTournament } from '@/lib/db/tournaments'
import { SettingsPanel } from './SettingsPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null
  const admin = await isAdmin(user.id)

  return (
    <SettingsPanel
      tournamentId={id}
      tournament={tournament}
      isAdmin={admin}
    />
  )
}
```

- [ ] **Step 3: Remove organizer actions from settings/actions.ts**

Replace the entire file `web/app/admin/tournaments/[id]/settings/actions.ts` with:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireUser, requireAdmin } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { deleteTournament, updateTournamentStatus } from '@/lib/db/tournaments'

async function ensureOrganizer(tournamentId: string) {
  const user = await requireUser()
  if (await isAdmin(user.id)) return
  if (!(await isOrganizer(user.id, tournamentId))) throw new Error('Not authorized.')
}

export async function finishTournamentAction(
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)
    const r = await updateTournamentStatus(tournamentId, 'finished')
    if (r.error) return { error: r.error }
    revalidatePath('/admin')
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    revalidatePath(`/t/${tournamentId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function archiveTournamentAction(
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireAdmin()
    const r = await updateTournamentStatus(tournamentId, 'archived')
    if (r.error) return { error: r.error }
    revalidatePath('/admin')
    revalidatePath(`/admin/tournaments/${tournamentId}`)
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}

export async function deleteTournamentAction(
  tournamentId: string,
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireAdmin()
    const r = await deleteTournament(tournamentId)
    if (r.error) return { error: r.error }
    revalidatePath('/admin')
    return { ok: true }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
```

- [ ] **Step 4: Typecheck and lint**

```bash
cd web && pnpm tsc --noEmit && pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/[id]/settings/
git commit -m "refactor: remove organizer section from Settings (moved to Users tab)"
```

---

### Task 7: Delete the scorekeepers route folder

**Files:**
- Delete: `web/app/admin/tournaments/[id]/scorekeepers/` (entire folder)

- [ ] **Step 1: Delete the folder**

```bash
rm -rf web/app/admin/tournaments/[id]/scorekeepers
```

- [ ] **Step 2: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
cd web && pnpm test -- --run
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: remove scorekeepers tab (content moved to Users tab)"
```

---

### Task 8: Write CSV parser + tests

**Files:**
- Create: `web/lib/csv.ts`
- Create: `web/__tests__/csv.test.ts`

A pure function that parses a CSV string into typed rows — easy to test in isolation, reused by the TeamsPanel.

- [ ] **Step 1: Write the failing tests first**

Create `web/__tests__/csv.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseTeamsCsv } from '@/lib/csv'

describe('parseTeamsCsv', () => {
  it('parses a well-formed CSV into rows', () => {
    const csv = `team,player_name,position,jersey_number
Lions,John Smith,FWD,9
Lions,Mike Lee,GK,1`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ team: 'Lions', player_name: 'John Smith', position: 'FWD', jersey_number: 9 })
    expect(result.rows[1]).toEqual({ team: 'Lions', player_name: 'Mike Lee', position: 'GK', jersey_number: 1 })
    expect(result.errors).toHaveLength(0)
  })

  it('handles optional position and jersey_number', () => {
    const csv = `team,player_name,position,jersey_number
Tigers,Amy Chen,,`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({ team: 'Tigers', player_name: 'Amy Chen', position: null, jersey_number: null })
  })

  it('returns an error for missing required columns in header', () => {
    const csv = `team,name\nLions,John`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toContain('Missing required columns: player_name')
  })

  it('skips rows with empty team or player_name and reports them', () => {
    const csv = `team,player_name,position,jersey_number
,John Smith,FWD,9
Lions,,GK,1
Lions,Valid Player,,`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toHaveLength(2)
  })

  it('rejects jersey_number outside 0-99', () => {
    const csv = `team,player_name,position,jersey_number
Lions,John Smith,FWD,150`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.errors[0]).toContain('jersey_number')
  })

  it('handles Windows CRLF line endings', () => {
    const csv = `team,player_name,position,jersey_number\r\nLions,John Smith,FWD,9\r\n`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && pnpm test -- --run __tests__/csv
```

Expected: FAIL — `parseTeamsCsv` does not exist yet.

- [ ] **Step 3: Implement `parseTeamsCsv`**

Create `web/lib/csv.ts`:

```typescript
export interface CsvRow {
  team: string
  player_name: string
  position: string | null
  jersey_number: number | null
}

export interface ParseResult {
  rows: CsvRow[]
  errors: string[]
}

export function parseTeamsCsv(csv: string): ParseResult {
  const errors: string[] = []
  const rows: CsvRow[] = []

  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  if (lines.length < 2) return { rows, errors }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const teamIdx = header.indexOf('team')
  const playerIdx = header.indexOf('player_name')
  const posIdx = header.indexOf('position')
  const numIdx = header.indexOf('jersey_number')

  const missing: string[] = []
  if (teamIdx === -1) missing.push('team')
  if (playerIdx === -1) missing.push('player_name')
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(', ')}`)
    return { rows, errors }
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = line.split(',').map((c) => c.trim())

    const team = cols[teamIdx] ?? ''
    const player_name = cols[playerIdx] ?? ''

    if (!team || !player_name) {
      errors.push(`Row ${i + 1}: missing team or player_name — skipped`)
      continue
    }

    const rawNum = numIdx >= 0 ? cols[numIdx] : ''
    let jersey_number: number | null = null
    if (rawNum) {
      const n = Number(rawNum)
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        errors.push(`Row ${i + 1}: jersey_number "${rawNum}" must be 0–99 — skipped`)
        continue
      }
      jersey_number = n
    }

    const position = posIdx >= 0 && cols[posIdx] ? cols[posIdx] : null

    rows.push({ team, player_name, position, jersey_number })
  }

  return { rows, errors }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && pnpm test -- --run __tests__/csv
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/csv.ts web/__tests__/csv.test.ts
git commit -m "feat: add parseTeamsCsv utility with tests"
```

---

### Task 9: Add `importTeamsCsvAction` to teams/actions.ts

**Files:**
- Modify: `web/app/admin/tournaments/[id]/teams/actions.ts`

- [ ] **Step 1: Add the action**

At the end of `web/app/admin/tournaments/[id]/teams/actions.ts`, add:

```typescript
import { listTeams } from '@/lib/db/teams'
import type { CsvRow } from '@/lib/csv'

export async function importTeamsCsvAction(
  tournamentId: string,
  rows: CsvRow[],
): Promise<{ teamsCreated: number; playersAdded: number } | { error: string }> {
  try {
    await ensureOrganizer(tournamentId)

    const existing = await listTeams(tournamentId)
    const teamIdByName = new Map<string, string>(existing.map((t) => [t.name.toLowerCase(), t.id]))

    let teamsCreated = 0
    let playersAdded = 0

    const grouped = new Map<string, CsvRow[]>()
    for (const row of rows) {
      const key = row.team
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(row)
    }

    for (const [teamName, teamRows] of grouped) {
      let teamId = teamIdByName.get(teamName.toLowerCase())
      if (!teamId) {
        const result = await createTeam(tournamentId, teamName)
        if ('error' in result) return { error: `Creating team "${teamName}": ${result.error}` }
        teamId = result.id
        teamIdByName.set(teamName.toLowerCase(), teamId)
        teamsCreated++
      }

      for (const row of teamRows) {
        const result = await createPlayer({
          team_id: teamId,
          name: row.player_name,
          jersey_number: row.jersey_number,
          position: row.position,
        })
        if ('error' in result) continue
        playersAdded++
      }
    }

    revalidatePath(`/admin/tournaments/${tournamentId}/teams`)
    return { teamsCreated, playersAdded }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed.' }
  }
}
```

Also add `listTeams` to the existing import at the top of the file. Change:

```typescript
import { createTeam, deleteTeam, setTeamGroup } from '@/lib/db/teams'
```

to:

```typescript
import { createTeam, deleteTeam, listTeams, setTeamGroup } from '@/lib/db/teams'
```

And add the CsvRow import after the existing imports:

```typescript
import type { CsvRow } from '@/lib/csv'
```

- [ ] **Step 2: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/[id]/teams/actions.ts
git commit -m "feat: add importTeamsCsvAction for bulk CSV team/player import"
```

---

### Task 10: Add CSV import UI to TeamsPanel

**Files:**
- Modify: `web/app/admin/tournaments/[id]/teams/TeamsPanel.tsx`

Two additions inside the existing `<Card>` that holds the "Add Team" form (only when `canEdit`): a "Download sample" button and an "Import CSV" button.

- [ ] **Step 1: Add imports to TeamsPanel.tsx**

At the top of `TeamsPanel.tsx`, add to the existing lucide import:

```typescript
import { ChevronDown, ChevronRight, Plus, Trash2, Loader2, Lock, Download, Upload } from 'lucide-react'
```

Add after the `addPlayerAction` import line:

```typescript
import { parseTeamsCsv } from '@/lib/csv'
import { importTeamsCsvAction } from './actions'
```

- [ ] **Step 2: Add the sample CSV data constant**

At the top of the file, before the component definition, add:

```typescript
const SAMPLE_CSV_ROWS = [
  ['Eagles', 'Oliver Bennett', 'GK', '1'],
  ['Eagles', 'Liam Carter', 'DEF', '2'],
  ['Eagles', 'Noah Harrison', 'DEF', '3'],
  ['Eagles', 'James Mitchell', 'DEF', '4'],
  ['Eagles', 'William Turner', 'DEF', '5'],
  ['Eagles', 'Benjamin Foster', 'MID', '6'],
  ['Eagles', 'Lucas Edwards', 'MID', '7'],
  ['Eagles', 'Henry Collins', 'MID', '8'],
  ['Eagles', 'Alexander Stewart', 'MID', '10'],
  ['Eagles', 'Daniel Morris', 'MID', '11'],
  ['Eagles', 'Mason Rogers', 'FWD', '9'],
  ['Eagles', 'Ethan Reed', 'FWD', '12'],
  ['Eagles', 'Jack Bailey', 'FWD', '13'],
  ['Eagles', 'Sebastian Cooper', 'DEF', '14'],
  ['Eagles', 'Aiden Richardson', 'MID', '15'],
  ['Eagles', 'Matthew Cox', 'FWD', '16'],
  ['Eagles', 'Joseph Ward', 'GK', '17'],
  ['Eagles', 'David Torres', 'DEF', '18'],
  ['Eagles', 'Luke Peterson', 'MID', '19'],
  ['Eagles', 'Ryan Gray', 'FWD', '20'],
  ['Lions', 'Elijah Hughes', 'GK', '1'],
  ['Lions', 'Nathan Price', 'DEF', '2'],
  ['Lions', 'Isaac Flores', 'DEF', '3'],
  ['Lions', 'Caleb Sanders', 'DEF', '4'],
  ['Lions', 'Joshua Jenkins', 'DEF', '5'],
  ['Lions', 'Andrew Russell', 'MID', '6'],
  ['Lions', 'Christopher Simmons', 'MID', '7'],
  ['Lions', 'Dylan Powell', 'MID', '8'],
  ['Lions', 'Zachary Long', 'MID', '10'],
  ['Lions', 'Nicholas Patterson', 'MID', '11'],
  ['Lions', 'Tyler Hughes', 'FWD', '9'],
  ['Lions', 'Brandon Flores', 'FWD', '12'],
  ['Lions', 'Austin Washington', 'FWD', '13'],
  ['Lions', 'Kevin Butler', 'DEF', '14'],
  ['Lions', 'Justin Barnes', 'MID', '15'],
  ['Lions', 'Robert Ross', 'FWD', '16'],
  ['Lions', 'Jonathan Henderson', 'GK', '17'],
  ['Lions', 'Samuel Coleman', 'DEF', '18'],
  ['Lions', 'Patrick Jenkins', 'MID', '19'],
  ['Lions', 'Eric Perry', 'FWD', '20'],
  ['Tigers', 'Brian Powell', 'GK', '1'],
  ['Tigers', 'Raymond Long', 'DEF', '2'],
  ['Tigers', 'Gregory Patterson', 'DEF', '3'],
  ['Tigers', 'Frank Hughes', 'DEF', '4'],
  ['Tigers', 'Raymond Washington', 'DEF', '5'],
  ['Tigers', 'Gerald Butler', 'MID', '6'],
  ['Tigers', 'Harold Barnes', 'MID', '7'],
  ['Tigers', 'Walter Ross', 'MID', '8'],
  ['Tigers', 'Arthur Henderson', 'MID', '10'],
  ['Tigers', 'Vincent Coleman', 'MID', '11'],
  ['Tigers', 'Roy Perry', 'FWD', '9'],
  ['Tigers', 'Eugene Powell', 'FWD', '12'],
  ['Tigers', 'Russell Long', 'FWD', '13'],
  ['Tigers', 'Louis Patterson', 'DEF', '14'],
  ['Tigers', 'Albert Hughes', 'MID', '15'],
  ['Tigers', 'Clarence Washington', 'FWD', '16'],
  ['Tigers', 'Fred Butler', 'GK', '17'],
  ['Tigers', 'Herbert Barnes', 'DEF', '18'],
  ['Tigers', 'Earl Ross', 'MID', '19'],
  ['Tigers', 'Leroy Henderson', 'FWD', '20'],
  ['Wolves', 'Edwin Coleman', 'GK', '1'],
  ['Wolves', 'Cecil Perry', 'DEF', '2'],
  ['Wolves', 'Ivan Powell', 'DEF', '3'],
  ['Wolves', 'Marvin Long', 'DEF', '4'],
  ['Wolves', 'Alvin Patterson', 'DEF', '5'],
  ['Wolves', 'Glen Hughes', 'MID', '6'],
  ['Wolves', 'Melvin Washington', 'MID', '7'],
  ['Wolves', 'Chester Butler', 'MID', '8'],
  ['Wolves', 'Wilbur Barnes', 'MID', '10'],
  ['Wolves', 'Sherman Ross', 'MID', '11'],
  ['Wolves', 'Lester Henderson', 'FWD', '9'],
  ['Wolves', 'Floyd Coleman', 'FWD', '12'],
  ['Wolves', 'Harvey Perry', 'FWD', '13'],
  ['Wolves', 'Reginald Powell', 'DEF', '14'],
  ['Wolves', 'Clifford Long', 'MID', '15'],
  ['Wolves', 'Virgil Patterson', 'FWD', '16'],
  ['Wolves', 'Herman Hughes', 'GK', '17'],
  ['Wolves', 'Milton Washington', 'DEF', '18'],
  ['Wolves', 'Elmer Butler', 'MID', '19'],
  ['Wolves', 'Homer Barnes', 'FWD', '20'],
  ['Hawks', 'Salvatore Ross', 'GK', '1'],
  ['Hawks', 'Dominic Henderson', 'DEF', '2'],
  ['Hawks', 'Marco Coleman', 'DEF', '3'],
  ['Hawks', 'Angelo Perry', 'DEF', '4'],
  ['Hawks', 'Enzo Powell', 'DEF', '5'],
  ['Hawks', 'Luca Long', 'MID', '6'],
  ['Hawks', 'Matteo Patterson', 'MID', '7'],
  ['Hawks', 'Giovanni Hughes', 'MID', '8'],
  ['Hawks', 'Leonardo Washington', 'MID', '10'],
  ['Hawks', 'Francesco Butler', 'MID', '11'],
  ['Hawks', 'Alessandro Barnes', 'FWD', '9'],
  ['Hawks', 'Roberto Ross', 'FWD', '12'],
  ['Hawks', 'Stefano Henderson', 'FWD', '13'],
  ['Hawks', 'Antonio Coleman', 'DEF', '14'],
  ['Hawks', 'Federico Perry', 'MID', '15'],
  ['Hawks', 'Claudio Powell', 'FWD', '16'],
  ['Hawks', 'Sergio Long', 'GK', '17'],
  ['Hawks', 'Fabio Patterson', 'DEF', '18'],
  ['Hawks', 'Bruno Hughes', 'MID', '19'],
  ['Hawks', 'Emilio Washington', 'FWD', '20'],
  ['Falcons', 'Carlos Butler', 'GK', '1'],
  ['Falcons', 'Miguel Barnes', 'DEF', '2'],
  ['Falcons', 'Pablo Ross', 'DEF', '3'],
  ['Falcons', 'Diego Henderson', 'DEF', '4'],
  ['Falcons', 'Javier Coleman', 'DEF', '5'],
  ['Falcons', 'Alejandro Perry', 'MID', '6'],
  ['Falcons', 'Fernando Powell', 'MID', '7'],
  ['Falcons', 'Ricardo Long', 'MID', '8'],
  ['Falcons', 'Eduardo Patterson', 'MID', '10'],
  ['Falcons', 'Manuel Hughes', 'MID', '11'],
  ['Falcons', 'Andres Washington', 'FWD', '9'],
  ['Falcons', 'Rafael Butler', 'FWD', '12'],
  ['Falcons', 'Sergio Barnes', 'FWD', '13'],
  ['Falcons', 'Alvaro Ross', 'DEF', '14'],
  ['Falcons', 'Raul Henderson', 'MID', '15'],
  ['Falcons', 'Hector Coleman', 'FWD', '16'],
  ['Falcons', 'Oscar Perry', 'GK', '17'],
  ['Falcons', 'Ivan Powell', 'DEF', '18'],
  ['Falcons', 'Victor Long', 'MID', '19'],
  ['Falcons', 'Emilio Patterson', 'FWD', '20'],
  ['Panthers', 'Kai Hughes', 'GK', '1'],
  ['Panthers', 'Finn Washington', 'DEF', '2'],
  ['Panthers', 'Leo Butler', 'DEF', '3'],
  ['Panthers', 'Max Barnes', 'DEF', '4'],
  ['Panthers', 'Axel Ross', 'DEF', '5'],
  ['Panthers', 'Soren Henderson', 'MID', '6'],
  ['Panthers', 'Erik Coleman', 'MID', '7'],
  ['Panthers', 'Lars Perry', 'MID', '8'],
  ['Panthers', 'Mikkel Powell', 'MID', '10'],
  ['Panthers', 'Bjorn Long', 'MID', '11'],
  ['Panthers', 'Rasmus Patterson', 'FWD', '9'],
  ['Panthers', 'Magnus Hughes', 'FWD', '12'],
  ['Panthers', 'Niels Washington', 'FWD', '13'],
  ['Panthers', 'Henrik Butler', 'DEF', '14'],
  ['Panthers', 'Oskar Barnes', 'MID', '15'],
  ['Panthers', 'Viggo Ross', 'FWD', '16'],
  ['Panthers', 'Tobias Henderson', 'GK', '17'],
  ['Panthers', 'Valentin Coleman', 'DEF', '18'],
  ['Panthers', 'Emil Perry', 'MID', '19'],
  ['Panthers', 'Lukas Powell', 'FWD', '20'],
  ['Sharks', 'Hamid Long', 'GK', '1'],
  ['Sharks', 'Yusuf Patterson', 'DEF', '2'],
  ['Sharks', 'Omar Hughes', 'DEF', '3'],
  ['Sharks', 'Ibrahim Washington', 'DEF', '4'],
  ['Sharks', 'Khalid Butler', 'DEF', '5'],
  ['Sharks', 'Hassan Barnes', 'MID', '6'],
  ['Sharks', 'Ali Ross', 'MID', '7'],
  ['Sharks', 'Tariq Henderson', 'MID', '8'],
  ['Sharks', 'Bilal Coleman', 'MID', '10'],
  ['Sharks', 'Kareem Perry', 'MID', '11'],
  ['Sharks', 'Jamal Powell', 'FWD', '9'],
  ['Sharks', 'Malik Long', 'FWD', '12'],
  ['Sharks', 'Rashid Patterson', 'FWD', '13'],
  ['Sharks', 'Idris Hughes', 'DEF', '14'],
  ['Sharks', 'Farouk Washington', 'MID', '15'],
  ['Sharks', 'Suleiman Butler', 'FWD', '16'],
  ['Sharks', 'Mustafa Barnes', 'GK', '17'],
  ['Sharks', 'Samir Ross', 'DEF', '18'],
  ['Sharks', 'Nabil Henderson', 'MID', '19'],
  ['Sharks', 'Ziad Coleman', 'FWD', '20'],
] as const

function buildSampleCsv(): string {
  const header = 'team,player_name,position,jersey_number'
  const rows = SAMPLE_CSV_ROWS.map((r) => r.join(',')).join('\n')
  return `${header}\n${rows}`
}
```

- [ ] **Step 3: Add `CsvImportCard` component and wire it into `TeamsPanel`**

In `TeamsPanel.tsx`, inside the `TeamsPanel` function, replace the existing `{canEdit && ( <Card> ... Add Team form ... </Card> )}` block (around line 124–145) with:

```tsx
      {canEdit && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <form onSubmit={handleAddTeam} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="team-name" className="sr-only">Team name</Label>
                <Input
                  id="team-name"
                  placeholder="New team name"
                  value={newTeam}
                  onChange={(e) => setNewTeam(e.target.value)}
                  disabled={pending}
                />
              </div>
              <Button type="submit" disabled={pending || !newTeam.trim()}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Team
              </Button>
            </form>
            <div className="flex gap-2 pt-1 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const csv = buildSampleCsv()
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'teams-sample.csv'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <Download className="h-4 w-4" /> Sample CSV
              </Button>
              <CsvImportButton tournamentId={tournamentId} />
            </div>
          </CardContent>
        </Card>
      )}
```

Then add this component at the bottom of the file (before or after `AddPlayerForm`):

```tsx
function CsvImportButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text !== 'string') return
      const { rows, errors } = parseTeamsCsv(text)
      if (errors.length > 0 && rows.length === 0) {
        toast.error(errors[0])
        return
      }
      if (rows.length === 0) {
        toast.error('No valid rows found in CSV.')
        return
      }
      startTransition(async () => {
        const r = await importTeamsCsvAction(tournamentId, rows)
        if ('error' in r) {
          toast.error(r.error)
        } else {
          toast.success(`${r.teamsCreated} team${r.teamsCreated !== 1 ? 's' : ''}, ${r.playersAdded} player${r.playersAdded !== 1 ? 's' : ''} imported.`)
          router.refresh()
        }
        if (errors.length > 0) {
          toast.warning(`${errors.length} row${errors.length !== 1 ? 's' : ''} skipped — check console for details.`)
          console.warn('CSV import skipped rows:', errors)
        }
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus-within:ring-1 focus-within:ring-ring">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      Import CSV
      <input type="file" accept=".csv" className="sr-only" onChange={handleFile} disabled={pending} />
    </label>
  )
}
```

- [ ] **Step 4: Typecheck and lint**

```bash
cd web && pnpm tsc --noEmit && pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
cd web && pnpm test -- --run
```

Expected: all pass (csv tests + prior tests).

- [ ] **Step 6: Commit**

```bash
git add web/app/admin/tournaments/[id]/teams/TeamsPanel.tsx
git commit -m "feat: add sample CSV download and CSV import to Teams tab"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered |
|-----------------|---------|
| Mobile tab scroll fix | Task 1 |
| Horizontal-only scrollbar hidden | Task 1 (scrollbar-hide CSS) |
| Users tab — admin + organizer visible | Task 2–5 (isAdmin passed, shown conditionally in UsersPanel) |
| Users tab — replaces Scorekeepers | Task 5 |
| Organizer section removed from Settings | Task 6 |
| Scorekeepers folder deleted | Task 7 |
| CSV parser — pure + tested | Task 8 |
| Bulk server action | Task 9 |
| Download sample button (8 teams × 20 players) | Task 10 |
| Import CSV button with file picker | Task 10 |
| Duplicate team names append players | Task 9 (`importTeamsCsvAction` logic) |
| Validation: required fields, jersey 0–99 | Tasks 8–9 |
| Toast summary after import | Task 10 |

**Type consistency check:**
- `CsvRow` type defined in `web/lib/csv.ts`, used in both `actions.ts` and `TeamsPanel.tsx` — consistent.
- `importTeamsCsvAction` returns `{ teamsCreated: number; playersAdded: number } | { error: string }` — matches usage in `CsvImportButton`.
- `UsersPanel` props (`organizers`, `scorekeeperAssignments`, `matches`, `isAdmin`, `tournamentId`) — all provided by `users/page.tsx`.

**Placeholder scan:** None found.
