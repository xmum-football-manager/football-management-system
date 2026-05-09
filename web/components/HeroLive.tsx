'use client'

import { useEffect, useState } from 'react'
import type { MatchWithTeams } from '@/lib/supabase/types'
localhost:3000/t
app/t/[id]
interface HeroLiveProps {
  match: MatchWithTeams
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function ElapsedClock({ startedAt }: { startedAt: string }) {
  const [min, setMin] = useState(() => Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000))

  useEffect(() => {
    const id = setInterval(() => {
      setMin(Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000))
    }, 30000)
    return () => clearInterval(id)
  }, [startedAt])

  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{min}&apos;</span>
}

export function HeroLive({ match }: HeroLiveProps) {
  return (
    <section style={{
      position: 'relative',
      background: 'var(--ink-900)',
      overflow: 'hidden',
      borderBottom: '1px solid var(--ink-700)',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 80% 60% at 50% -10%, rgba(163,230,53,0.18), transparent 65%),
          radial-gradient(ellipse 50% 40% at 12% 100%, rgba(163,230,53,0.07), transparent 60%)
        `,
      }} />
      {/* Pitch stripe pattern */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(163,230,53,0.025) 0, rgba(163,230,53,0.025) 60px, transparent 60px, transparent 120px)',
      }} />

      <div style={{ position: 'relative', maxWidth: 1240, margin: '0 auto', padding: '48px 28px 56px' }}>

        {/* Meta row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(220,38,38,0.4)',
            borderRadius: 999,
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12,
            letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FCA5A5',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 999, background: '#DC2626',
              animation: 'pitchPulse 1.6s infinite', display: 'inline-block',
            }} />
            Live now
          </span>
        </div>

        {/* Scoreboard: home / score / away */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 'clamp(20px, 4vw, 64px)',
        }}>
          {/* Home */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', gap: 12 }}>
            <div style={{
              width: 'clamp(64px, 10vw, 104px)', height: 'clamp(64px, 10vw, 104px)',
              borderRadius: 999, background: 'var(--ink-600)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(24px, 4vw, 40px)', color: '#fff',
              boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.12), 0 12px 32px rgba(0,0,0,0.45)',
            }}>{initials(match.home_team.name)}</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(20px, 3vw, 34px)', letterSpacing: '-0.02em',
              textTransform: 'uppercase', color: 'var(--ink-50)', lineHeight: 0.95,
            }}>{match.home_team.name}</div>
          </div>

          {/* Score column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(72px, 14vw, 160px)', lineHeight: 0.85,
              letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums',
              display: 'flex', alignItems: 'baseline',
              gap: 'clamp(8px, 2vw, 24px)', color: 'var(--ink-50)',
              textShadow: '0 0 60px rgba(163,230,53,0.15)',
            }}>
              <span>{match.home_score}</span>
              <span style={{ color: 'var(--ink-600)', fontSize: '0.5em', fontWeight: 800, alignSelf: 'center' }}>–</span>
              <span>{match.away_score}</span>
            </div>
            {/* Clock pill */}
            {match.match_started_at && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 999,
                background: 'var(--ink-800)', border: '1px solid var(--ink-700)',
                fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14,
                letterSpacing: '0.04em', color: 'var(--ink-50)',
              }}>
                <span style={{ color: 'var(--brand-lime)', fontWeight: 700 }}>1H</span>
                <ElapsedClock startedAt={match.match_started_at} />
              </div>
            )}
          </div>

          {/* Away */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: 12 }}>
            <div style={{
              width: 'clamp(64px, 10vw, 104px)', height: 'clamp(64px, 10vw, 104px)',
              borderRadius: 999, background: 'var(--ink-600)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(24px, 4vw, 40px)', color: '#fff',
              boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.12), 0 12px 32px rgba(0,0,0,0.45)',
            }}>{initials(match.away_team.name)}</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(20px, 3vw, 34px)', letterSpacing: '-0.02em',
              textTransform: 'uppercase', color: 'var(--ink-50)', lineHeight: 0.95,
            }}>{match.away_team.name}</div>
          </div>
        </div>

      </div>
    </section>
  )
}
