import type { MatchStatus } from '@/lib/supabase/types'

const MAP: Record<MatchStatus, { label: string; tone: 'live' | 'halftime' | 'finished' | 'scheduled' }> = {
  scheduled: { label: 'Scheduled', tone: 'scheduled' },
  live: { label: 'Live', tone: 'live' },
  halftime: { label: 'Half time', tone: 'halftime' },
  finished: { label: 'Full time', tone: 'finished' },
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const m = MAP[status]
  const styles = TONES[m.tone]
  return (
    <span
      className="admin-tab inline-flex items-center gap-1.5 rounded px-2.5 py-[3px] text-[10px]"
      style={styles}
    >
      {m.tone === 'live' ? (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-[#DC2626]"
          style={{ boxShadow: '0 0 0 2px rgba(220,38,38,0.30)' }}
        />
      ) : null}
      {m.label}
    </span>
  )
}

const TONES: Record<'live' | 'halftime' | 'finished' | 'scheduled', React.CSSProperties> = {
  live: { background: '#0E1A12', color: '#A3E635', border: '1px solid #0E1A12' },
  halftime: {
    background: 'rgba(245,158,11,0.12)',
    color: '#B45309',
    border: '1px solid rgba(245,158,11,0.40)',
  },
  finished: {
    background: 'transparent',
    color: 'var(--muted-foreground)',
    border: '1px solid var(--admin-rule)',
  },
  scheduled: {
    background: 'var(--admin-lime-wash)',
    color: 'var(--admin-lime)',
    border: '1px solid color-mix(in srgb, var(--admin-lime) 35%, transparent)',
  },
}
