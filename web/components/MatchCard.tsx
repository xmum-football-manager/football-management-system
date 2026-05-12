import type { MatchWithTeams } from '@/lib/supabase/types'
import { LiveBadge } from './LiveBadge'

interface MatchCardProps {
  match: MatchWithTeams
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { weekday: 'short', month: 'short', day: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export function MatchCard({ match }: MatchCardProps) {
  const isLive      = match.status === 'live'
  const isFinished  = match.status === 'finished'
  const isUpcoming  = match.status === 'scheduled'

  const homeWon = isFinished && match.home_score > match.away_score
  const awayWon = isFinished && match.away_score > match.home_score

  const accentColor = isLive ? 'var(--brand-lime)' : isUpcoming ? 'var(--brand-lime)' : 'var(--ink-500)'

  return (
    <div style={{
      position: 'relative',
      background: 'var(--ink-800)',
      border: `1px solid ${isLive ? 'rgba(163,230,53,0.3)' : 'var(--ink-700)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
    }}>
      {/* Left accent bar */}
      <span style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: 3, background: accentColor,
      }} />

      {/* Card header: status + group */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        {isLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LiveBadge size="sm" />
            {match.match_started_at && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-300)', fontWeight: 600 }}>
                · {Math.floor((Date.now() - new Date(match.match_started_at).getTime()) / 60000)}&apos;
              </span>
            )}
          </div>
        )}
        {isFinished && (
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-400)',
          }}>Full time</span>
        )}
        {isUpcoming && (
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--brand-lime)',
          }}>
            Upcoming · {formatTime(match.match_time)}
          </span>
        )}
      </div>

      {/* Home team row */}
      <TeamRow
        name={match.home_team.name}
        score={isUpcoming ? null : match.home_score}
        winner={homeWon}
        loser={awayWon}
        dim={isUpcoming}
      />
      {/* Away team row */}
      <TeamRow
        name={match.away_team.name}
        score={isUpcoming ? null : match.away_score}
        winner={awayWon}
        loser={homeWon}
        dim={isUpcoming}
      />

      {/* Footer */}
      <div style={{
        marginTop: 14, paddingTop: 12,
        borderTop: '1px solid var(--ink-700)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 12, color: 'var(--ink-400)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {isUpcoming ? formatDate(match.match_time) : isFinished ? `FT · ${formatDate(match.match_time)}` : ''}
        </span>
        <span style={{
          width: 24, height: 24, borderRadius: 999,
          background: 'var(--ink-700)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-300)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="m13 5 7 7-7 7"/>
          </svg>
        </span>
      </div>
    </div>
  )
}

function TeamRow({ name, score, winner, loser, dim }: {
  name: string
  score: number | null
  winner: boolean
  loser: boolean
  dim: boolean
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto',
      alignItems: 'center', gap: 12, padding: '8px 0',
      borderTop: '1px dashed var(--ink-700)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, flexShrink: 0,
          background: 'var(--ink-600)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 11, color: '#fff',
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.1)',
        }}>
          {initials(name)}
        </span>
        <span style={{
          fontWeight: 700, fontSize: 14,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          color: loser ? 'var(--ink-400)' : 'var(--ink-50)',
        }}>{name}</span>
      </div>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22,
        fontVariantNumeric: 'tabular-nums',
        color: dim ? 'var(--ink-500)' : winner ? 'var(--brand-lime)' : 'var(--ink-50)',
      }}>
        {score == null ? '—' : score}
      </span>
    </div>
  )
}
