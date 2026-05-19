'use client'

import { Suspense, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getUserRoles } from '@/lib/db/tournaments'

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
        let roleRows: Awaited<ReturnType<typeof getUserRoles>>
        try {
          roleRows = await getUserRoles(supabase, data.user.id)
        } catch {
          await supabase.auth.signOut()
          setError('Could not verify your role. Please try again.')
          return
        }
        const userRoles = roleRows.map(r => r.role)
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
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
