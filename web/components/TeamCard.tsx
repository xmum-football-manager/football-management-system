'use client'

import { useState } from 'react'
import type { Team, Player, Standing } from '@/lib/supabase/types'

interface TeamCardProps {
  team: Team & { players: Player[] }
  standings: Standing[]
}

export function TeamCard({ team, standings }: TeamCardProps) {
  const [open, setOpen] = useState(false)
  const rec = standings.find(s => s.team_id === team.id)

  const initials = team.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={{
      background: 'var(--ink-800)',
      border: `1px solid ${open ? 'var(--brand-lime)' : 'var(--ink-700)'}`,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      transition: 'border-color var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '18px 18px 14px', cursor: 'pointer',
        }}
      >
        <div style={{
          width: 52, height: 52, borderRadius: 999, flexShrink: 0,
          background: 'var(--ink-600)',
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.12)',
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22,
            letterSpacing: '-0.01em', textTransform: 'uppercase', color: 'var(--ink-50)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{team.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 2 }}>
            {team.players.length} players{rec ? ` · ${rec.points} pts` : ''}
          </div>
        </div>
        <span style={{
          width: 28, height: 28, borderRadius: 999, flexShrink: 0,
          background: open ? 'var(--brand-lime)' : 'var(--ink-700)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: open ? 'var(--ink-900)' : 'var(--ink-300)',
          transform: open ? 'rotate(45deg)' : 'none',
          transition: 'transform var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
        </span>
      </div>

      {/* Record bar */}
      {rec && (
        <div style={{
          display: 'flex', padding: '0 18px 14px',
          borderBottom: '1px solid var(--ink-700)',
        }}>
          {[
            { v: rec.wins,   l: 'Won' },
            { v: rec.draws,  l: 'Drew' },
            { v: rec.losses, l: 'Lost' },
            { v: rec.goal_difference >= 0 ? `+${rec.goal_difference}` : rec.goal_difference, l: 'GD', lime: rec.goal_difference > 0 },
          ].map((s, i, arr) => (
            <div key={s.l} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              padding: '8px 4px',
              borderRight: i < arr.length - 1 ? '1px solid var(--ink-700)' : 'none',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22,
                letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
                color: s.lime ? 'var(--brand-lime)' : 'var(--ink-50)',
              }}>{s.v}</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 9,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--ink-400)', marginTop: 2,
              }}>{s.l}</span>
            </div>
          ))}
        </div>
      )}

      {/* Roster (collapsible) */}
      <div style={{
        maxHeight: open ? 600 : 0,
        overflow: 'hidden',
        transition: 'max-height 420ms var(--ease-out)',
      }}>
        <div style={{ padding: '14px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {team.players.length === 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)' }}>
              No players added yet.
            </span>
          )}
          {team.players.map(p => (
            <div key={p.id} style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr auto auto',
              alignItems: 'center',
              gap: 12,
              padding: '8px 4px',
              borderBottom: '1px dashed var(--ink-700)',
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'var(--ink-700)',
                fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontVariantNumeric: 'tabular-nums', color: 'var(--ink-200)',
              }}>
                {p.jersey_number ?? '—'}
              </span>
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-100)' }}>{p.name}</span>
              {p.position && (
                <span style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10,
                  letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-400)',
                }}>{p.position}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
