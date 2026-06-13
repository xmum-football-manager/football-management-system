'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, RotateCcw } from 'lucide-react'
import { DEFAULT_PASSWORD } from '@/lib/auth-constants'

interface Props {
  userId: string
  mustChangePassword: boolean
}

export function PasswordCell({ userId, mustChangePassword }: Props) {
  const router = useRouter()
  const [revealed, setRevealed] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleReset() {
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? 'Reset failed.')
      } else {
        toast.success(`Password reset to ${DEFAULT_PASSWORD}`)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {mustChangePassword ? (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm">
            {revealed ? DEFAULT_PASSWORD : '••••••••••••'}
          </span>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={revealed ? 'Hide password' : 'Reveal password'}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <span className="text-xs text-amber-700 border border-amber-300 rounded px-1">default</span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">••• (changed)</span>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        disabled={pending}
        onClick={handleReset}
        title="Reset to default password"
      >
        <RotateCcw className="h-3 w-3" />
        Reset
      </Button>
    </div>
  )
}
