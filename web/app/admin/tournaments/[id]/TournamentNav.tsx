'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertCircle, Lock } from 'lucide-react'
import type { TournamentFormat } from '@/lib/supabase/types'

interface TabDef {
  href: string
  label: string
  needsAttention?: boolean
  locked?: boolean
  lockReason?: string | null
}

interface Props {
  tournamentId: string
  format: TournamentFormat
  isAdmin: boolean
  rdTeamsProgress?: string | null
  rdFixturesLocked?: boolean
  rdFixturesLockReason?: string | null
  koTeamsLocked?: boolean
  koTeamsLockReason?: string | null
  koTeamsProgress?: string | null
  koFixturesLocked?: boolean
  koFixturesLockReason?: string | null
}

export function TournamentNav({
  tournamentId,
  format,
  isAdmin: _isAdmin,
  rdTeamsProgress = null,
  rdFixturesLocked = false,
  rdFixturesLockReason = null,
  koTeamsLocked = false,
  koTeamsLockReason = null,
  koTeamsProgress = null,
  koFixturesLocked = false,
  koFixturesLockReason = null,
}: Props) {
  const pathname = usePathname()
  const base = `/admin/tournaments/${tournamentId}`

  const tabs: TabDef[] = [{ href: base, label: 'Overview' }]

  if (format === 'round_robin') {
    tabs.push(
      { href: `${base}/rd-teams`, label: 'RD-Teams', needsAttention: !!rdTeamsProgress },
      { href: `${base}/rd-fixtures`, label: 'RD-Fixtures', locked: rdFixturesLocked, lockReason: rdFixturesLockReason },
    )
  } else if (format === 'knockout') {
    tabs.push(
      { href: `${base}/ko-teams`, label: 'KO-Teams', needsAttention: !!koTeamsProgress },
      { href: `${base}/ko-fixtures`, label: 'KO-Fixtures', locked: koFixturesLocked, lockReason: koFixturesLockReason },
    )
  } else {
    // round_robin_knockout
    tabs.push(
      { href: `${base}/rd-teams`, label: 'RD-Teams', needsAttention: !!rdTeamsProgress },
      { href: `${base}/rd-fixtures`, label: 'RD-Fixtures', locked: rdFixturesLocked, lockReason: rdFixturesLockReason },
      { href: `${base}/ko-teams`, label: 'KO-Teams', needsAttention: !koTeamsLocked && !!koTeamsProgress, locked: koTeamsLocked, lockReason: koTeamsLockReason },
      { href: `${base}/ko-fixtures`, label: 'KO-Fixtures', locked: koFixturesLocked, lockReason: koFixturesLockReason },
    )
  }

  tabs.push(
    { href: `${base}/scorekeepers`, label: 'Scorekeepers' },
    { href: `${base}/settings`, label: 'Settings' },
  )

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
                  t.locked && t.lockReason
                    ? t.lockReason
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
