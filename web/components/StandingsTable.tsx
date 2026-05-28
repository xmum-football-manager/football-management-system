'use client'

import type { Standing, MatchWithTeams } from '@/lib/supabase/types'

interface StandingsTableProps {
  standings: Standing[]
  /** Pass all matches so we can derive matchday progress */
  matches?: MatchWithTeams[]
  /** Tournament name or group label (e.g. "Group A") */
  groupLabel?: string
  /** How many top positions advance to next round */
  advanceCount?: number
}

function deriveMatchdayProgress(matches: MatchWithTeams[] = []) {
  if (matches.length === 0) return { played: 0, total: 0 }

  const total = matches.length
  const played = matches.filter(m => m.status === 'finished').length

  return { played, total }
}

export function StandingsTable({
  standings,
  matches = [],
  groupLabel = 'Group A',
  advanceCount = 2,
}: StandingsTableProps) {
  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
    return a.team_name.localeCompare(b.team_name)
  })

  const maxPts = Math.max(...sorted.map(r => r.points), 1)
  const { played, total } = deriveMatchdayProgress(matches)

  const headerLabel =
    total > 0
      ? `After ${played} of ${total} matchday${total !== 1 ? 's' : ''} played`
      : 'No matches played yet'

  if (sorted.length === 0) {
    return (
      <div style={{
        background: 'var(--ink-800)',
        border: '1px solid var(--ink-700)',
        borderRadius: 'var(--radius-lg)',
        padding: '48px 24px',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 15,
          color: 'var(--ink-400)',
          margin: 0,
        }}>
          No matches played yet — standings will appear here once matches finish.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--ink-800)',
      border: '1px solid var(--ink-700)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>

      {/* ── Card Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px 24px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--ink-700)',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 20,
          letterSpacing: '-0.01em',
          textTransform: 'uppercase',
          color: 'var(--ink-50)',
        }}>
          {groupLabel}
        </span>

        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-400)',
          letterSpacing: '0.04em',
        }}>
          {headerLabel}
        </span>
      </div>

      {/* ── Advance legend ── */}
      {advanceCount > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 20px',
          borderBottom: '1px solid var(--ink-700)',
          background: 'rgba(163,230,53,0.04)',
        }}>
          <span style={{
            width: 3,
            height: 14,
            borderRadius: 999,
            background: 'var(--brand-lime)',
            flexShrink: 0,
            display: 'inline-block',
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--brand-lime)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            Top {advanceCount} advance ➤
          </span>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          minWidth: 480,
        }}>
          {/* Column widths — fixed columns for numerics, flexible for team */}
          <colgroup>
            <col style={{ width: 40 }}  /* # *//>
            <col style={{ width: 'auto' }} /* Team *//>
            <col style={{ width: 32 }}  /* P *//>
            <col style={{ width: 32 }}  /* W *//>
            <col style={{ width: 32 }}  /* D *//>
            <col style={{ width: 32 }}  /* L *//>
            <col style={{ width: 36 }}  /* GF *//>
            <col style={{ width: 36 }}  /* GA *//>
            <col style={{ width: 40 }}  /* GD *//>
            <col style={{ width: 36 }}  /* Pts *//>
            <col style={{ width: 64 }}  /* Bar *//>
          </colgroup>

          <thead>
            <tr>
              {(['#', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts', ''] as const).map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: i === 0 ? '10px 8px 10px 20px' : i === 10 ? '10px 20px 10px 8px' : '10px 8px',
                    textAlign: i <= 1 ? 'left' : 'right',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-400)',
                    borderBottom: '1px solid var(--ink-700)',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sorted.map((row, i) => {
              const qualifies = advanceCount > 0 && i < advanceCount
              const gdStr = row.goal_difference > 0
                ? `+${row.goal_difference}`
                : String(row.goal_difference)
              const barPct = maxPts > 0 ? (row.points / maxPts) * 100 : 0

              return (
                <tr
                  key={row.team_id}
                  style={{
                    background: qualifies
                      ? 'linear-gradient(90deg, rgba(163,230,53,0.07) 0%, transparent 70%)'
                      : 'transparent',
                    borderBottom: i < sorted.length - 1 ? '1px solid var(--ink-700)' : 'none',
                    transition: 'background 200ms var(--ease-out)',
                  }}
                >
                  {/* # — Rank (STICKY) */}
                  <td style={{
                    padding: '13px 8px 13px 20px',
                    verticalAlign: 'middle',
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    background: qualifies ? 'rgba(21, 33, 23, 1)' : 'var(--ink-800)',
                    borderLeft: qualifies ? '3px solid var(--brand-lime)' : '3px solid transparent',
                  }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      fontSize: 15,
                      color: qualifies ? 'var(--brand-lime)' : 'var(--ink-400)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {i + 1}
                      {qualifies && (
                        <span style={{ fontSize: 11, color: 'var(--brand-lime)', lineHeight: 1 }}>
                          ➤
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Team name + badge (STICKY) */}
                  <td style={{ 
                    padding: '13px 12px 13px 8px', 
                    verticalAlign: 'middle',
                    position: 'sticky',
                    left: 40,
                    zIndex: 10,
                    background: qualifies ? 'rgba(21, 33, 23, 1)' : 'var(--ink-800)',
                    boxShadow: '8px 0 12px -8px rgba(0,0,0,0.5)',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                    }}>
                      <span style={{
                        flexShrink: 0,
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        background: qualifies ? 'rgba(163,230,53,0.18)' : 'var(--ink-700)',
                        border: qualifies ? '1px solid rgba(163,230,53,0.35)' : '1px solid var(--ink-600)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-display)',
                        fontWeight: 900,
                        fontSize: 9,
                        letterSpacing: '0.04em',
                        color: qualifies ? 'var(--brand-lime)' : 'var(--ink-300)',
                      }}>
                        {row.team_name.slice(0, 2).toUpperCase()}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-sans)',
                        fontWeight: 700,
                        fontSize: 14,
                        color: qualifies ? 'var(--ink-50)' : 'var(--ink-200)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 100,
                      }}>
                        {row.team_name}
                      </span>
                    </div>
                  </td>

                  {/* Numeric stats: P W D L GF GA GD */}
                  {[row.matches_played, row.wins, row.draws, row.losses, row.goals_scored, row.goals_conceded].map((v, j) => (
                    <td key={j} style={{
                      padding: '13px 8px',
                      textAlign: 'right',
                      verticalAlign: 'middle',
                      fontFamily: 'var(--font-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 13,
                      color: 'var(--ink-300)',
                      whiteSpace: 'nowrap',
                    }}>
                      {v}
                    </td>
                  ))}

                  {/* GD */}
                  <td style={{
                    padding: '13px 8px',
                    textAlign: 'right',
                    verticalAlign: 'middle',
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 13,
                    color: row.goal_difference > 0
                      ? 'var(--brand-lime-deep)'
                      : row.goal_difference < 0
                        ? '#f87171'
                        : 'var(--ink-300)',
                    whiteSpace: 'nowrap',
                  }}>
                    {gdStr}
                  </td>

                  {/* Pts */}
                  <td style={{
                    padding: '13px 8px',
                    textAlign: 'right',
                    verticalAlign: 'middle',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: 17,
                    color: qualifies ? 'var(--brand-lime)' : 'var(--ink-50)',
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}>
                    {row.points}
                  </td>

                  {/* Points bar */}
                  <td style={{
                    padding: '13px 20px 13px 8px',
                    verticalAlign: 'middle',
                  }}>
                    <div style={{
                      height: 5,
                      background: 'var(--ink-700)',
                      borderRadius: 999,
                      overflow: 'hidden',
                      minWidth: 40,
                    }}>
                      <div style={{
                        height: '100%',
                        background: qualifies
                          ? 'linear-gradient(90deg, var(--brand-lime-deep), var(--brand-lime))'
                          : 'var(--ink-500)',
                        borderRadius: 999,
                        width: `${barPct}%`,
                        transition: 'width 900ms var(--ease-out)',
                        transformOrigin: 'left',
                      }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer tiebreaker note ── */}
      <div style={{
        padding: '9px 20px',
        borderTop: '1px solid var(--ink-700)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-500)',
          letterSpacing: '0.04em',
        }}>
          Tiebreaker: Pts → GD → Alphabetical
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-500)',
        }}>
          {sorted.length} teams
        </span>
      </div>
    </div>
  )
}
