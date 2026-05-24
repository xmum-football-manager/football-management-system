'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

const DEFAULT_PASSWORD = 'footballclub'

export function ChangePasswordForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (pw.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (pw === DEFAULT_PASSWORD) {
      setError(`You cannot reuse the default password (${DEFAULT_PASSWORD}).`)
      return
    }
    if (pw !== confirm) {
      setError('Passwords must match.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      password: pw,
      data: { must_change_password: false },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pw">New password</Label>
        <Input
          id="pw"
          type="password"
          required
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm</Label>
        <Input
          id="confirm"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? 'Saving…' : 'Set Password'}
      </Button>
    </form>
  )
}
