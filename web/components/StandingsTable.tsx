'use client'

import { useEffect, useRef } from 'react'
import { teamColor, teamCode } from '@/lib/team-style'
import { mediaUrl } from '@/lib/storage'
import type { Standing, MatchWithTeams } from '@/lib/supabase/types'

interface StandingsTableProps {
  standings: Standing[]
  /** Pass all matches so we can derive matchday progress */
  matches?: MatchWithTeams[]
  /** Tournament name or group label (e.g. "Group A") */
  groupLabel?: string
  /** How many top positions advance to next round */
  advanceCount?: number
  /** team_id → logo_path lookup (standings view has no logo column) */
  teamLogos?: Record<string, string | null>
}

export function StandingsTable({
  standings,
  matches = [],
  groupLabel = 'Group A',
  advanceCount = 2,
  teamLogos,
}: StandingsTableProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Grow the points bars once the card scrolls into view (.standings-card.in)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          el.classList.add('in')
          io.unobserve(el)
        }
      })
    }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
    return a.team_name.localeCompare(b.team_name)
  })

  const maxPts = Math.max(...sorted.map(r => r.points), 1)
  const played = matches.filter(m => m.status === 'finished').length

  // "Group A" → tag "Group" + lime "A"; anything else renders as-is
  const groupMatch = /^Group (.+)$/.exec(groupLabel)

  const legend = advanceCount > 0
    ? `Top ${advanceCount} advance`
    : matches.length > 0 ? `${played} of ${matches.length} played` : ''

  return (
    <div className="standings-card" ref={ref}>
      <div className="head">
        <div className="group-tag">
          {groupMatch ? <>Group<span className="grp">{groupMatch[1]}</span></> : groupLabel}
        </div>
        {legend && <span className="legend">{legend}</span>}
      </div>

      {sorted.length === 0 ? (
        <p className="empty-note">No matches played yet — standings will appear here once matches finish.</p>
      ) : (
        <table className="standings-table">
          <thead>
            <tr>
              <th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const qualifies = advanceCount > 0 && i < advanceCount
              return (
                <tr key={r.team_id} className={qualifies ? 'qualify' : ''}>
                  <td>
                    <span className="rank">
                      {i + 1}
                      {qualifies && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m18 15-6-6-6 6"/>
                        </svg>
                      )}
                    </span>
                  </td>
                  <td>
                    <div className="team-cell">
                      {(() => {
                        const logo = mediaUrl(teamLogos?.[r.team_id])
                        return (
                          <span
                            className="crest"
                            style={
                              logo
                                ? { backgroundImage: `url(${logo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                                : { background: teamColor(r.team_id) }
                            }
                          >
                            {logo ? null : teamCode(r.team_name)}
                          </span>
                        )
                      })()}
                      <span className="team-nm">{r.team_name}</span>
                    </div>
                  </td>
                  <td>{r.matches_played}</td>
                  <td>{r.wins}</td>
                  <td>{r.draws}</td>
                  <td>{r.losses}</td>
                  <td>{r.goals_scored}</td>
                  <td>{r.goals_conceded}</td>
                  <td>
                    <span className="pts">{r.points}</span>
                    <div className="pts-bar"><i style={{ '--w': r.points / maxPts } as React.CSSProperties} /></div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
