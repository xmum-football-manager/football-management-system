import type { MatchStatus } from '@/lib/supabase/types'

type Role = 'organizer' | 'admin'

const ORGANIZER_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  scheduled: ['live'],
  live: ['halftime', 'finished'],
  halftime: ['live'],
  finished: [],
}

const ADMIN_EXTRA_TRANSITIONS: Partial<Record<MatchStatus, MatchStatus[]>> = {
  finished: ['live'],
}

export function isValidTransition(from: MatchStatus, to: MatchStatus, role: Role): boolean {
  const allowed = [...(ORGANIZER_TRANSITIONS[from] ?? [])]
  if (role === 'admin') {
    allowed.push(...(ADMIN_EXTRA_TRANSITIONS[from] ?? []))
  }
  return allowed.includes(to)
}

export function getAvailableTransitions(
  status: MatchStatus,
  role: Role,
): { action: string; nextStatus: MatchStatus }[] {
  const results: { action: string; nextStatus: MatchStatus }[] = []

  const labels: Partial<Record<MatchStatus, { to: MatchStatus; action: string }[]>> = {
    scheduled: [{ to: 'live', action: 'Kickoff' }],
    live: [
      { to: 'halftime', action: 'Half Time' },
      { to: 'finished', action: 'Full Time' },
    ],
    halftime: [{ to: 'live', action: 'Start 2nd Half' }],
    finished: [],
  }

  for (const t of labels[status] ?? []) {
    if (isValidTransition(status, t.to, role)) {
      results.push({ action: t.action, nextStatus: t.to })
    }
  }

  if (role === 'admin' && status === 'finished') {
    results.push({ action: 'Revert to Live', nextStatus: 'live' })
  }

  return results
}

export function canScorekeeper(status: MatchStatus): boolean {
  return status === 'live'
}

export function shouldClearKnockoutWinner(opts: {
  phase: string | null
  from: string
  to: string
}): boolean {
  return opts.phase === 'knockout' && opts.from === 'finished' && opts.to !== 'finished'
}
