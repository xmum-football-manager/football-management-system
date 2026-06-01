'use client'

import { useState } from 'react'
import Link from 'next/link'
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

  const initials = teamInitials(team.name)

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
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </span>
      </div>

      {/* Record bar */}
      {rec && (
        <div style={{
          display: 'flex', padding: '0 18px 14px',
          borderBottom: open ? '1px solid var(--ink-700)' : 'none',
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
          {/* Roster header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr auto 48px',
            alignItems: 'center', gap: 12, padding: '6px 4px',
            borderBottom: '1px solid var(--ink-700)',
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-500)',
          }}>
            <span>#</span>
            <span>Name</span>
            <span>Pos</span>
            <span style={{ textAlign: 'right' }}>Goals</span>
          </div>

          {team.players.length === 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)', padding: '8px 4px' }}>
              No players added yet.
            </span>
          )}

          {team.players.map(p => (
            <div key={p.id} style={{
              display: 'grid',
              gridTemplateColumns: '36px 1fr auto 48px',
              alignItems: 'center', gap: 12,
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
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10,
                letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-400)',
              }}>{p.position ?? '—'}</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16,
                fontVariantNumeric: 'tabular-nums', color: 'var(--ink-300)',
                textAlign: 'right',
              }}>{'—'/* Update based on player goals if Goals table exists in database */}</span>
            </div>
          ))}

          <Link
            href={`/t/${tournamentId}/team/${team.id}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 4, padding: '10px 16px', borderRadius: 8,
              background: 'var(--brand-lime)', color: 'var(--ink-900)',
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              textDecoration: 'none', alignSelf: 'flex-start',
            }}
          >
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
