'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertCircle, Lock } from 'lucide-react'

interface TabDef {
  href: string
  label: string
  needsAttention?: boolean
  locked?: boolean
}

interface Props {
  tournamentId: string
  isAdmin: boolean
  teamsProgress?: string | null
  fixturesLocked?: boolean
  fixturesLockReason?: string | null
}

export function TournamentNav({
  tournamentId,
  isAdmin: _isAdmin,
  teamsProgress = null,
  fixturesLocked = false,
  fixturesLockReason = null,
}: Props) {
  const pathname = usePathname()
  const base = `/admin/tournaments/${tournamentId}`

  const tabs: TabDef[] = [
    { href: base, label: 'Overview' },
    { href: `${base}/teams`, label: 'Teams', needsAttention: !!teamsProgress },
    { href: `${base}/fixtures`, label: 'Fixtures', locked: fixturesLocked },
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
                  opacity: t.locked ? 0.5 : 1,
                  pointerEvents: t.locked ? 'none' : 'auto',
                }}
                title={
                  t.locked && fixturesLockReason
                    ? fixturesLockReason
                    : undefined
                }
              >
                {t.label}
                {t.needsAttention && (
                  <AlertCircle className="inline-block ml-1 h-3.5 w-3.5 text-red-500" />
                )}
                {t.locked && (
                  <Lock className="inline-block ml-1 h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
