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
  teamsNeedsAttention?: boolean
  groupsLocked?: boolean
  groupsLockReason?: string | null
  groupsNeedsAttention?: boolean
  fixturesLocked?: boolean
  fixturesLockReason?: string | null
  knockoutLocked?: boolean
  knockoutLockReason?: string | null
}

export function TournamentNav({
  tournamentId,
  format,
  isAdmin: _isAdmin,
  teamsNeedsAttention = false,
  groupsLocked = false,
  groupsLockReason = null,
  groupsNeedsAttention = false,
  fixturesLocked = false,
  fixturesLockReason = null,
  knockoutLocked = false,
  knockoutLockReason = null,
}: Props) {
  const pathname = usePathname()
  const base = `/admin/tournaments/${tournamentId}`

  const tabs: TabDef[] = [{ href: base, label: 'Overview' }]

  if (format === 'round_robin') {
    tabs.push(
      { href: `${base}/rd-teams`, label: 'Teams', needsAttention: teamsNeedsAttention },
      { href: `${base}/rd-fixtures`, label: 'Fixtures', locked: fixturesLocked, lockReason: fixturesLockReason },
    )
  } else if (format === 'knockout') {
    tabs.push(
      { href: `${base}/ko-teams`, label: 'Teams', needsAttention: teamsNeedsAttention },
      { href: `${base}/ko-fixtures`, label: 'Knockout', locked: knockoutLocked, lockReason: knockoutLockReason },
    )
  } else {
    // round_robin_knockout
    tabs.push(
      { href: `${base}/rd-teams`, label: 'Teams', needsAttention: teamsNeedsAttention },
      { href: `${base}/groups`, label: 'Groups', locked: groupsLocked, lockReason: groupsLockReason, needsAttention: !groupsLocked && groupsNeedsAttention },
      { href: `${base}/knockout`, label: 'Knockout', locked: knockoutLocked, lockReason: knockoutLockReason },
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
          const active = pathname === t.href || (t.href !== base && pathname.startsWith(t.href))
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
