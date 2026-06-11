import type { TournamentStatus } from '@/lib/supabase/types'

const MAP: Record<
  TournamentStatus,
  { label: string; tone: 'live' | 'upcoming' | 'finished' | 'draft' }
> = {
  setup: { label: 'Setup', tone: 'draft' },
  active: { label: 'Live', tone: 'live' },
  finished: { label: 'Finished', tone: 'finished' },
  archived: { label: 'Archived', tone: 'finished' },
}

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const m = MAP[status]
  return <PitchBadge tone={m.tone} label={m.label} />
}

function PitchBadge({
  tone,
  label,
}: {
  tone: 'live' | 'upcoming' | 'finished' | 'draft'
  label: string
}) {
  const styles = TONES[tone]
  return (
    <span
      className="admin-tab inline-flex items-center gap-1.5 rounded px-2.5 py-[3px] text-[10px]"
      style={styles}
    >
      {tone === 'live' ? (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-[#DC2626]"
          style={{ boxShadow: '0 0 0 2px rgba(220,38,38,0.30)' }}
        />
      ) : null}
      {label}
    </span>
  )
}

const TONES: Record<'live' | 'upcoming' | 'finished' | 'draft', React.CSSProperties> = {
  live: {
    background: '#0E1A12',
    color: '#A3E635',
    border: '1px solid #0E1A12',
  },
  upcoming: {
    background: 'var(--admin-lime-wash)',
    color: 'var(--admin-lime)',
    border: '1px solid color-mix(in srgb, var(--admin-lime) 35%, transparent)',
  },
  finished: {
    background: 'transparent',
    color: 'var(--muted-foreground)',
    border: '1px solid var(--admin-rule)',
  },
  draft: {
    background: 'rgba(245,158,11,0.12)',
    color: '#B45309',
    border: '1px solid rgba(245,158,11,0.40)',
  },
}

export { PitchBadge as TournamentStatusPill }
