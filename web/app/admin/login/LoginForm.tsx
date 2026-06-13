'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface Props {
  redirectTo: string
  surface: 'admin' | 'score'
}

export function LoginForm({ redirectTo, surface }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error || !data.user) {
      setError(error?.message ?? 'Could not sign in.')
      return
    }
    // Admin surface is for admins/organizers only — a scorekeeper-only account can
    // authenticate but must not land in the admin console.
    if (surface === 'admin') {
      const { data: roleRows } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
      const allowed = (roleRows ?? []).some((r) => r.role === 'admin' || r.role === 'organizer')
      if (!allowed) {
        await supabase.auth.signOut()
        setError('This account doesn’t have admin access. Use the scorekeeper sign-in.')
        return
      }
    }
    const mustChange = Boolean(data.user.user_metadata?.must_change_password)
    if (mustChange) {
      router.push(`/change-password?redirectTo=${encodeURIComponent(redirectTo)}`)
      router.refresh()
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        {surface === 'admin' ? 'Manager & admin sign-in.' : 'Scorekeeper sign-in.'}
      </p>
    </form>
  )
}
