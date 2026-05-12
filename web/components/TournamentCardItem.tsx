'use client'

import Link from 'next/link'
import type { Tournament } from '@/lib/supabase/types'

interface TournamentCardItemProps {
  tournament: Tournament
  badge: { bg: string; border: string; color: string; label: string }
  rail: string
  dateRange: string
  formatLabel: string
}

export function TournamentCardItem({
  tournament: t,
  badge,
  rail,
  dateRange,
  formatLabel,
}: TournamentCardItemProps) {
  return (
    <Link key={t.id} href={`/t/${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        position: 'relative',
        background: 'var(--ink-800)',
        border: '1px solid var(--ink-700)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 24px 24px 28px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
      }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.borderColor = 'var(--ink-500)'
          e.currentTarget.style.background = 'var(--ink-700)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.borderColor = 'var(--ink-700)'
          e.currentTarget.style.background = 'var(--ink-800)'
        }}
      >
        {/* Left accent rail */}
        <span style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: rail,
        }} />

        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Status pill */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: badge.bg, border: `1px solid ${badge.border}`,
              borderRadius: 999,
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
              letterSpacing: '0.1em', textTransform: 'uppercase', color: badge.color,
              marginBottom: 14,
            }}>
              {t.status === 'active' && (
                <span style={{
                  width: 6, height: 6, borderRadius: 999,
                  background: 'var(--brand-lime)',
                  animation: 'pitchPulse 1.6s infinite',
                  display: 'inline-block',
                }} />
              )}
              {badge.label}
            </span>

            {/* Tournament name */}
            <h3 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(22px, 3vw, 32px)',
              letterSpacing: '-0.01em', textTransform: 'uppercase',
              color: 'var(--ink-50)', margin: 0, lineHeight: 1,
            }}>{t.name}</h3>

            {/* Meta row */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              gap: 12, marginTop: 14,
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--ink-400)', letterSpacing: '0.04em',
              }}>
                {dateRange}
              </span>
              {t.location && (
                <>
                  <span style={{ color: 'var(--ink-600)', fontSize: 12 }}>·</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 13, color: 'var(--ink-400)',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    {t.location}
                  </span>
                </>
              )}

              {/* Format pill */}
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '5px 10px',
                background: 'var(--ink-700)',
                border: '1px solid var(--ink-600)',
                borderRadius: 999,
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 10, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--ink-300)',
              }}>
                {formatLabel}
              </span>
            </div>
          </div>

          {/* Arrow */}
          <span style={{
            width: 36, height: 36, borderRadius: 999, flexShrink: 0,
            background: 'var(--ink-700)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-300)',
            transition: 'transform var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
            marginTop: 32,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}
