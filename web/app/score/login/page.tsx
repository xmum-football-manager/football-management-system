'use client'

import { Suspense, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/score'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else if (data.user?.user_metadata?.must_change_password) {
        router.push(`/change-password?redirectTo=${encodeURIComponent(redirectTo)}`)
      } else {
        router.push(redirectTo)
        router.refresh()
      }
    })
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-center text-6xl mb-6">⚽</p>
        <h1 className="text-white text-2xl font-bold text-center mb-8">Scorekeeper Login</h1>
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="you@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••••" />
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">{error}</p>
          )}
          <button type="submit" disabled={isPending}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-bold py-4 rounded-xl text-lg transition-colors">
            {isPending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ScoreLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
