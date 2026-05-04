import type { Standing } from '@/lib/supabase/types'

interface StandingsCardProps {
  standings: Standing[]
}

export function StandingsCard({ standings }: StandingsCardProps) {
  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
    return a.team_name.localeCompare(b.team_name)
  })

  const maxPts = Math.max(...sorted.map(r => r.points), 1)

  return (
    <div style={{
      background: 'var(--ink-800)',
      border: '1px solid var(--ink-700)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '18px 20px',
        borderBottom: '1px solid var(--ink-700)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24,
          letterSpacing: '-0.01em', textTransform: 'uppercase', color: 'var(--ink-50)',
        }}>
          Standings
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-400)',
        }}>
          Top 2 advance
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['#', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'Pts'].map((h, i) => (
                <th key={h} style={{
                  textAlign: i < 2 ? 'left' : 'right',
                  padding: '12px 8px',
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
                  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-400)',
                  borderBottom: '1px solid var(--ink-700)',
                  ...(i === 0 ? { paddingLeft: 18, width: 40 } : {}),
                  ...(i === 8 ? { paddingRight: 18 } : {}),
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const qualifies = i < 2
              return (
                <tr key={row.team_id} style={{
                  background: qualifies
                    ? 'linear-gradient(90deg, rgba(163,230,53,0.08), transparent 60%)'
                    : 'transparent',
                  borderBottom: i < sorted.length - 1 ? '1px solid var(--ink-700)' : 'none',
                }}>
                  {/* Rank */}
                  <td style={{ padding: '14px 8px', paddingLeft: 18, width: 40 }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16,
                      color: qualifies ? 'var(--brand-lime)' : 'var(--ink-400)',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}>
                      {i + 1}
                      {qualifies && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m18 15-6-6-6 6"/>
                        </svg>
                      )}
                    </span>
                  </td>
                  {/* Team */}
                  <td style={{ padding: '14px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, color: 'var(--ink-50)' }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: 999, background: 'var(--ink-600)',
                        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 10,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', flexShrink: 0,
                      }}>
                        {row.team_name.slice(0, 2).toUpperCase()}
                      </span>
                      <span style={{ fontSize: 14 }}>{row.team_name}</span>
                    </div>
                  </td>
                  {/* Stats */}
                  {[row.matches_played, row.wins, row.draws, row.losses, row.goals_scored, row.goals_conceded].map((v, j) => (
                    <td key={j} style={{
                      padding: '14px 8px', textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums', fontSize: 14,
                      color: 'var(--ink-300)',
                    }}>{v}</td>
                  ))}
                  {/* Points + bar */}
                  <td style={{ padding: '14px 8px', paddingRight: 18, textAlign: 'right' }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18,
                      color: qualifies ? 'var(--brand-lime)' : 'var(--ink-50)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{row.points}</span>
                    <div style={{
                      height: 4, background: 'var(--ink-700)', borderRadius: 999,
                      marginTop: 5, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', background: 'var(--brand-lime)', borderRadius: 999,
                        width: `${(row.points / maxPts) * 100}%`,
                        transition: 'width 800ms var(--ease-out)',
                      }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 18px', borderTop: '1px solid var(--ink-700)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-500)' }}>
          Tiebreaker: Points → Goal Difference → Alphabetical
        </span>
      </div>
    </div>
  )
}
