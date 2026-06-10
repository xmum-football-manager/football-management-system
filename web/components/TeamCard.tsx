'use client'

import { useState } from 'react'
import Link from 'next/link'
import { teamColor, teamCode } from '@/lib/team-style'
import { mediaUrl } from '@/lib/storage'
import type { Team, Player, Standing } from '@/lib/supabase/types'
import { teamInitials } from '@/lib/format'

interface TeamCardProps {
  team: Team & { players: Player[] }
  standings: Standing[]
  tournamentId: string
}

export function TeamCard({ team, standings, tournamentId }: TeamCardProps) {
  const [open, setOpen] = useState(false)
  const rec = standings.find(s => s.team_id === team.id)
  const logo = mediaUrl(team.logo_path)

  const sub = [
    team.group_label ? `Group ${team.group_label}` : null,
    `${team.players.length} players`,
    rec ? `${rec.points} pts` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className={`team-card ${open ? 'open' : ''}`}>
      <div className="team-card-head" onClick={() => setOpen(o => !o)}>
        <div
          className="crest"
          style={
            logo
              ? { backgroundImage: `url(${logo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: teamColor(team.id) }
          }
        >
          {logo ? null : teamCode(team.name)}
        </div>
        <div className="meta">
          <div className="nm">{team.name}</div>
          <div className="sub">{sub}</div>
        </div>
        <span className="toggle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
        </span>
      </div>

      {rec && (
        <div className="team-record">
          <div className="stat"><span className="v">{rec.wins}</span><span className="l">Won</span></div>
          <div className="stat"><span className="v">{rec.draws}</span><span className="l">Drew</span></div>
          <div className="stat"><span className="v">{rec.losses}</span><span className="l">Lost</span></div>
          <div className="stat">
            <span className="v" style={{ color: rec.goal_difference > 0 ? 'var(--brand-lime)' : rec.goal_difference < 0 ? 'var(--red-card)' : undefined }}>
              {rec.goal_difference >= 0 ? `+${rec.goal_difference}` : rec.goal_difference}
            </span>
            <span className="l">GD</span>
          </div>
        </div>
      )}

      <div className="roster-list">
        <div className="roster-inner">
          {team.players.length === 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)', padding: '8px 4px' }}>
              No players added yet.
            </span>
          )}

          {team.players.map(p => (
            <div className="roster-row" key={p.id}>
              <span className="num">{p.jersey_number ?? '—'}</span>
              <span className="nm">
                {p.photo_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(p.photo_path)!}
                    alt=""
                    // inline-block overrides Tailwind preflight's `img { display: block }`
                    style={{ display: 'inline-block', width: 24, height: 24, borderRadius: 999, objectFit: 'cover', verticalAlign: 'middle', marginRight: 8 }}
                  />
                )}
                {p.name}
              </span>
              <span className="pos">{p.position ?? '—'}</span>
            </div>
          ))}

          <Link href={`/t/${tournamentId}/team/${team.id}`} className="roster-link">
            View full roster page
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="m13 5 7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}
