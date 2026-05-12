# Unified Login Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/admin/login` and `/score/login` with a single `/login` page that has Admin, Organizer, and Scorekeeper tabs, redirecting to the right area after login.

**Architecture:** One new client component at `app/login/page.tsx` exports a pure `hasRequiredRole` helper (testable) plus the default page component. Old login pages are deleted and replaced with Next.js route handlers that 308-redirect to the new URL. Both signout routes are updated to redirect to `/login`.

**Tech Stack:** Next.js 16 App Router, Supabase SSR client (`@/lib/supabase/client`), Tailwind CSS, Vitest for unit tests.

---

### Task 1: Write failing tests for `hasRequiredRole`

**Files:**
- Create: `web/__tests__/unified-login.test.ts`

- [ ] **Step 1: Create the test file**

```ts
import { describe, it, expect } from 'vitest'
import { hasRequiredRole } from '@/app/login/page'

describe('hasRequiredRole', () => {
  it('returns true when requiredRoles is null (scorekeeper tab — no role check)', () => {
    expect(hasRequiredRole([], null)).toBe(true)
  })

  it('returns true when user has the required role', () => {
    expect(hasRequiredRole(['admin'], ['admin'])).toBe(true)
  })

  it('returns true when user has one of multiple accepted roles', () => {
    expect(hasRequiredRole(['organizer'], ['organizer', 'admin'])).toBe(true)
  })

  it('returns false when user has no matching role', () => {
    expect(hasRequiredRole(['scorekeeper'], ['admin'])).toBe(false)
  })

  it('returns false when user has no roles at all', () => {
    expect(hasRequiredRole([], ['admin'])).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm it fails (module not found)**

```bash
cd web && pnpm vitest run __tests__/unified-login.test.ts
```

Expected: `Error: Cannot find module '@/app/login/page'`

---

### Task 2: Create `app/login/page.tsx`

**Files:**
- Create: `web/app/login/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { Suspense, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tab = 'admin' | 'organizer' | 'scorekeeper'

const TAB_CONFIG: Record<Tab, { label: string; emoji: string; redirect: string; requiredRoles: string[] | null }> = {
  admin:       { label: 'Admin',       emoji: '🏆', redirect: '/admin', requiredRoles: ['admin'] },
  organizer:   { label: 'Organizer',   emoji: '📋', redirect: '/admin', requiredRoles: ['organizer', 'admin'] },
  scorekeeper: { label: 'Scorekeeper', emoji: '✏️', redirect: '/score', requiredRoles: null },
}

export function hasRequiredRole(userRoles: string[], requiredRoles: string[] | null): boolean {
  if (requiredRoles === null) return true
  return userRoles.some(r => requiredRoles.includes(r))
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawTab = searchParams.get('tab') as Tab | null
  const initialTab: Tab = rawTab && rawTab in TAB_CONFIG ? rawTab : 'admin'
  const redirectTo = searchParams.get('redirectTo')

  const [tab, setTab] = useState<Tab>(initialTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleTabChange(newTab: Tab) {
    setTab(newTab)
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const config = TAB_CONFIG[tab]
    const target = redirectTo ?? config.redirect

    startTransition(async () => {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(authError.message)
        return
      }
      if (data.user?.user_metadata?.must_change_password) {
        router.push(`/change-password?redirectTo=${encodeURIComponent(target)}`)
        return
      }
      if (config.requiredRoles !== null) {
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
        const userRoles = roleRows?.map(r => r.role) ?? []
        if (!hasRequiredRole(userRoles, config.requiredRoles)) {
          await supabase.auth.signOut()
          setError("Your account doesn't have access to this area.")
          return
        }
      }
      router.push(target)
      router.refresh()
    })
  }

  const config = TAB_CONFIG[tab]

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <p className="text-5xl mb-3">⚽</p>
          <h1 className="text-white text-2xl font-bold">Tournament Manager</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex border-b border-slate-200">
            {(Object.keys(TAB_CONFIG) as Tab[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => handleTabChange(t)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  tab === t
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {TAB_CONFIG[t].emoji} {TAB_CONFIG[t].label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {isPending ? 'Signing in…' : `Sign in as ${config.label}`}
            </button>
          </form>
        </div>
        <p className="text-center text-slate-500 text-sm mt-6">
          Need access? Contact your tournament administrator.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
```

- [ ] **Step 2: Run tests — confirm they pass**

```bash
cd web && pnpm vitest run __tests__/unified-login.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```bash
cd web && git add app/login/page.tsx __tests__/unified-login.test.ts
git commit -m "feat: add unified login page with admin/organizer/scorekeeper tabs"
```

---

### Task 3: Replace old login pages with redirect routes

**Files:**
- Delete: `web/app/admin/login/page.tsx`
- Create: `web/app/admin/login/route.ts`
- Delete: `web/app/score/login/page.tsx`
- Create: `web/app/score/login/route.ts`

Next.js cannot have both `page.tsx` and `route.ts` in the same directory — delete the page first.

- [ ] **Step 1: Delete old admin login page**

```bash
rm "web/app/admin/login/page.tsx"
```

- [ ] **Step 2: Create admin login redirect route**

```ts
// web/app/admin/login/route.ts
import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.redirect(
    new URL('/login?tab=admin', process.env.NEXT_PUBLIC_APP_URL!),
    308
  )
}
```

- [ ] **Step 3: Delete old score login page**

```bash
rm "web/app/score/login/page.tsx"
```

- [ ] **Step 4: Create score login redirect route**

```ts
// web/app/score/login/route.ts
import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.redirect(
    new URL('/login?tab=scorekeeper', process.env.NEXT_PUBLIC_APP_URL!),
    308
  )
}
```

- [ ] **Step 5: Commit**

```bash
cd web && git add app/admin/login/route.ts app/score/login/route.ts
git rm app/admin/login/page.tsx app/score/login/page.tsx
git commit -m "feat: replace old login pages with 308 redirects to /login"
```

---

### Task 4: Update signout routes to redirect to `/login`

Both signout handlers currently redirect back to their respective login pages. Update them to redirect to `/login` instead.

**Files:**
- Modify: `web/app/admin/auth/signout/route.ts`
- Modify: `web/app/score/auth/signout/route.ts`

- [ ] **Step 1: Update admin signout**

Replace the redirect URL in `web/app/admin/auth/signout/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!))
}
```

- [ ] **Step 2: Update score signout**

Replace the redirect URL in `web/app/score/auth/signout/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!))
}
```

- [ ] **Step 3: Run full test suite to confirm nothing broken**

```bash
cd web && pnpm vitest run --project='*' --reporter=verbose 2>&1 | tail -20
```

Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
cd web && git add app/admin/auth/signout/route.ts app/score/auth/signout/route.ts
git commit -m "fix: redirect to /login after signout"
```
