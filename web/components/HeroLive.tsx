'use client'

import { useEffect, useState } from 'react'
import { LiveBadge } from './LiveBadge'
import { teamInitials, formatClock } from '@/lib/format'
import type { MatchWithTeams } from '@/lib/supabase/types'

interface HeroLiveProps {
  variant: 'live' | 'nextup' | 'done'
  match?: MatchWithTeams
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

export function HeroLive({ variant, match }: HeroLiveProps) {
  const isNextup = variant === 'nextup'
  const isDone = variant === 'done'

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
        background: isDone
          ? 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(163,230,53,0.06), transparent 65%)'
          : isNextup
            ? `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(163,230,53,0.07), transparent 65%),
               radial-gradient(ellipse 50% 40% at 12% 100%, rgba(163,230,53,0.03), transparent 60%)`
            : `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(163,230,53,0.18), transparent 65%),
               radial-gradient(ellipse 50% 40% at 12% 100%, rgba(163,230,53,0.07), transparent 60%)`,
      }} />
      {/* Pitch stripe pattern */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(163,230,53,0.025) 0, rgba(163,230,53,0.025) 60px, transparent 60px, transparent 120px)',
        opacity: isDone ? 0.5 : 1,
      }} />

      <div style={{ position: 'relative', maxWidth: 1240, margin: '0 auto', padding: '48px 28px 56px' }}>

        {/* ── Done state ── */}
        {isDone && (
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚽</div>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(22px, 4vw, 40px)', letterSpacing: '-0.02em',
              textTransform: 'uppercase', color: 'var(--ink-400)',
              margin: 0,
            }}>No matches remaining</p>
          </div>
        )}

        {/* ── Live / Next Up state ── */}
        {match && (
          <>
            {/* Meta row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 32 }}>
              {variant === 'live' ? (
                <LiveBadge size="md" />
              ) : (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 999,
                  background: 'var(--ink-800)', border: '1px solid var(--ink-700)',
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: 'var(--ink-400)',
                }}>
                  Next Up
                </div>
              )}
            </div>

            {/* Scoreboard: home / score / away */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              gap: 'clamp(4px, 4vw, 64px)',
            }}>
              {/* Home */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', gap: 12 }}>
                <div style={{
                  width: 'clamp(64px, 10vw, 104px)', height: 'clamp(64px, 10vw, 104px)',
                  borderRadius: 999,
                  background: isNextup ? 'var(--ink-800)' : 'var(--ink-600)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 900,
                  fontSize: 'clamp(20px, 4vw, 40px)',
                  color: isNextup ? 'var(--ink-500)' : '#fff',
                  boxShadow: isNextup
                    ? 'inset 0 0 0 4px rgba(255,255,255,0.05), 0 8px 20px rgba(0,0,0,0.3)'
                    : 'inset 0 0 0 4px rgba(255,255,255,0.12), 0 12px 32px rgba(0,0,0,0.45)',
                }}>{teamInitials(match.home_team?.name ?? 'TBD')}</div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 900,
                  fontSize: 'clamp(12px, 3vw, 34px)', letterSpacing: '-0.02em',
                  textTransform: 'uppercase',
                  color: isNextup ? 'var(--ink-500)' : 'var(--ink-50)',
                  lineHeight: 1.1,
                  wordBreak: 'break-word', overflowWrap: 'break-word',
                }}>{match.home_team?.name ?? 'TBD'}</div>
              </div>

              {/* Centre column */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                {variant === 'live' ? (
                  <>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 900,
                      fontSize: 'clamp(48px, 14vw, 160px)', lineHeight: 0.85,
                      letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums',
                      display: 'flex', alignItems: 'baseline',
                      gap: 'clamp(4px, 2vw, 24px)', color: 'var(--ink-50)',
                      textShadow: '0 0 60px rgba(163,230,53,0.15)',
                    }}>
                      <span>{match.home_score}</span>
                      <span style={{ color: 'var(--ink-600)', fontSize: '0.5em', fontWeight: 800, alignSelf: 'center' }}>–</span>
                      <span>{match.away_score}</span>
                    </div>
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
                  </>
                ) : (
                  <>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 900,
                      fontSize: 'clamp(28px, 8vw, 80px)', lineHeight: 0.9,
                      letterSpacing: '-0.04em', color: 'var(--ink-700)',
                    }}>VS</div>
                    {match.match_time && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px', borderRadius: 999,
                        background: 'var(--ink-800)', border: '1px solid var(--ink-700)',
                        fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 14,
                        letterSpacing: '0.04em', color: 'var(--ink-400)',
                      }}>
                        {formatClock(match.match_time)}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Away */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', gap: 12 }}>
                <div style={{
                  width: 'clamp(64px, 10vw, 104px)', height: 'clamp(64px, 10vw, 104px)',
                  borderRadius: 999,
                  background: isNextup ? 'var(--ink-800)' : 'var(--ink-600)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 900,
                  fontSize: 'clamp(24px, 4vw, 40px)',
                  color: isNextup ? 'var(--ink-500)' : '#fff',
                  boxShadow: isNextup
                    ? 'inset 0 0 0 4px rgba(255,255,255,0.05), 0 8px 20px rgba(0,0,0,0.3)'
                    : 'inset 0 0 0 4px rgba(255,255,255,0.12), 0 12px 32px rgba(0,0,0,0.45)',
                }}>{teamInitials(match.away_team?.name ?? 'TBD')}</div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 900,
                  fontSize: 'clamp(14px, 2.5vw, 34px)', letterSpacing: '-0.02em',
                  textTransform: 'uppercase',
                  color: isNextup ? 'var(--ink-500)' : 'var(--ink-50)',
                  lineHeight: 1.1,
                  wordBreak: 'break-word', overflowWrap: 'break-word',
                }}>{match.away_team?.name ?? 'TBD'}</div>
              </div>
            </div>
          </>
        )}

      </div>
    </section>
  )
}
