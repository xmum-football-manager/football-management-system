import type { MatchStatus } from '@/lib/supabase/types'

const STEPS: { key: MatchStatus; label: string; short: string }[] = [
  { key: 'scheduled', label: 'Scheduled', short: 'SCH' },
  { key: 'live', label: 'Kickoff', short: 'KO' },
  { key: 'halftime', label: 'Half Time', short: 'HT' },
  { key: 'finished', label: 'Full Time', short: 'FT' },
]

function indexOf(status: MatchStatus): number {
  return STEPS.findIndex((s) => s.key === status)
}

export function MatchStateStepper({
  status,
  size = 'sm',
}: {
  status: MatchStatus
  size?: 'sm' | 'md'
}) {
  const current = indexOf(status)
  const dotSize = size === 'md' ? 10 : 8
  const labelSize = size === 'md' ? 10 : 9
  const lineLen = size === 'md' ? 18 : 14

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={STEPS.length}
      aria-valuenow={current + 1}
      aria-label={`Match progress: ${STEPS[current]?.label ?? 'Unknown'}`}
      className="inline-flex items-center"
    >
      {STEPS.map((step, i) => {
        const done = i < current
        const active = i === current
        const isLive = active && step.key === 'live'
        return (
          <div key={step.key} className="inline-flex items-center">
            <div className="inline-flex flex-col items-center" style={{ minWidth: 36 }}>
              <span
                aria-hidden
                style={{
                  width: active ? dotSize + 4 : dotSize,
                  height: active ? dotSize + 4 : dotSize,
                  borderRadius: 999,
                  background: done
                    ? 'var(--admin-lime)'
                    : active
                      ? isLive
                        ? '#DC2626'
                        : 'var(--admin-lime)'
                      : 'transparent',
                  border:
                    done || active
                      ? 'none'
                      : '1.5px solid var(--admin-rule)',
                  boxShadow: isLive
                    ? '0 0 0 3px rgba(220,38,38,0.20)'
                    : active
                      ? '0 0 0 3px var(--admin-lime-wash)'
                      : 'none',
                  transition: 'all var(--dur-fast) var(--ease-out)',
                }}
              />
              <span
                className="admin-tab mt-1"
                style={{
                  fontSize: labelSize,
                  letterSpacing: '0.08em',
                  color: active
                    ? isLive
                      ? '#DC2626'
                      : 'var(--admin-lime)'
                    : done
                      ? 'var(--foreground)'
                      : 'var(--muted-foreground)',
                  fontWeight: active ? 900 : 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {step.short}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                style={{
                  width: lineLen,
                  height: 2,
                  background: i < current ? 'var(--admin-lime)' : 'var(--admin-rule)',
                  marginBottom: labelSize + 4,
                  transition: 'background var(--dur-fast) var(--ease-out)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
