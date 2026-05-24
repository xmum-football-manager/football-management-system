'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Info } from 'lucide-react'

type Role = 'organizer' | 'scorekeeper'

export function InviteForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('organizer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await fetch('/api/admin/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    setLoading(false)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(body?.error ?? 'Failed to create account.')
      return
    }
    toast.success(`Account created for ${email}.`, {
      description: 'Default password: footballclub',
    })
    router.push('/admin/users')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Role</legend>
        <RoleOption
          checked={role === 'organizer'}
          onChange={() => setRole('organizer')}
          label="Organizer"
          description="Manages tournaments, fixtures, rosters."
        />
        <RoleOption
          checked={role === 'scorekeeper'}
          onChange={() => setRole('scorekeeper')}
          label="Scorekeeper"
          description="Enters live match scores only."
        />
      </fieldset>

      <div className="flex gap-2 rounded-md border bg-sky-50 border-sky-200 px-3 py-2 text-xs text-sky-900">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          Account will be created with default password <code className="font-mono bg-white/60 px-1 rounded">footballclub</code>.
          The user must change it on first login.
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? 'Creating…' : 'Create Account'}
      </Button>
    </form>
  )
}

function RoleOption({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: () => void
  label: string
  description: string
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
        checked ? 'border-emerald-600 bg-emerald-50' : 'hover:bg-slate-50'
      }`}
    >
      <input
        type="radio"
        name="role"
        className="mt-1"
        checked={checked}
        onChange={onChange}
      />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </label>
  )
}
