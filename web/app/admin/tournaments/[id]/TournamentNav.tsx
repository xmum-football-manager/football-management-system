'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Props {
  tournamentId: string
  isAdmin: boolean
}

export function TournamentNav({ tournamentId }: Props) {
  const pathname = usePathname()
  const base = `/admin/tournaments/${tournamentId}`
  const tabs: { href: string; label: string }[] = [
    { href: base, label: 'Overview' },
    { href: `${base}/teams`, label: 'Teams' },
    { href: `${base}/fixtures`, label: 'Fixtures' },
    { href: `${base}/scorekeepers`, label: 'Scorekeepers' },
    { href: `${base}/settings`, label: 'Settings' },
  ]

  return (
    <nav className="border-b -mx-2 px-2 overflow-x-auto">
      <ul className="flex gap-1 min-w-max">
        {tabs.map((t) => {
          const active = pathname === t.href
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={cn(
                  'inline-block px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors',
                  active
                    ? 'border-emerald-600 text-foreground font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
