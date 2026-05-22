'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle({ theme }: { theme: 'light' | 'dark' }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      disabled={pending}
      onClick={() => {
        document.cookie = `admin-theme=${next}; path=/; max-age=31536000; samesite=lax`
        start(() => router.refresh())
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-60"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
