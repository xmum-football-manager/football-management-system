'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
    <nav
      className="-mx-2 overflow-x-auto px-2"
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
}
