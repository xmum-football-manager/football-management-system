import type { MatchWithTeams } from '@/lib/supabase/types'

interface BracketViewProps {
  matches: MatchWithTeams[]
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function BracketTeamRow({ name, score, winner, loser, tbd }: {
  name: string
  score: number | null
  winner: boolean
  loser: boolean
  tbd?: boolean
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 1fr auto',
      alignItems: 'center', gap: 10, padding: '10px 14px',
      borderBottom: '1px solid var(--ink-700)',
      background: winner ? 'rgba(163,230,53,0.06)' : 'transparent',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 999,
        background: tbd ? 'var(--ink-700)' : 'var(--ink-600)',
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 9,
        color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {tbd ? '?' : initials(name)}
      </span>
      <span style={{
        fontWeight: 700, fontSize: 13,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        color: tbd ? 'var(--ink-500)' : loser ? 'var(--ink-400)' : 'var(--ink-50)',
        fontStyle: tbd ? 'italic' : 'normal',
      }}>
        {tbd ? 'TBD' : name}
      </span>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16,
        fontVariantNumeric: 'tabular-nums',
        color: winner ? 'var(--brand-lime)' : loser ? 'var(--ink-400)' : 'var(--ink-50)',
      }}>
        {score == null ? '—' : score}
      </span>
    </div>
  )
}

function BracketMatch({ match }: { match: MatchWithTeams | null }) {
  if (!match) {
    return (
      <div style={{
        background: 'var(--ink-900)', border: '1px dashed var(--ink-700)',
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
      }}>
        <BracketTeamRow name="TBD" score={null} winner={false} loser={false} tbd />
        <BracketTeamRow name="TBD" score={null} winner={false} loser={false} tbd />
      </div>
    )
  }

  const isLive     = match.status === 'live'
  const isFinished = match.status === 'finished'
  const homeWon    = isFinished && match.home_score > match.away_score
  const awayWon    = isFinished && match.away_score > match.home_score

  return (
    <div style={{
      background: 'var(--ink-900)',
      border: `1px solid ${isLive ? 'rgba(220,38,38,0.5)' : 'var(--ink-700)'}`,
      borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative',
      transition: 'transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
    }}>
      {isLive && (
        <span style={{
          position: 'absolute', top: -8, right: 8,
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 9,
          background: 'var(--red-card)', color: '#fff',
          padding: '2px 8px', borderRadius: 999, letterSpacing: '0.1em',
        }}>LIVE</span>
      )}
      <div style={{ borderBottom: '1px solid var(--ink-700)' }}>
        <BracketTeamRow name={match.home_team.name} score={match.status === 'scheduled' ? null : match.home_score} winner={homeWon} loser={awayWon} />
      </div>
      <BracketTeamRow name={match.away_team.name} score={match.status === 'scheduled' ? null : match.away_score} winner={awayWon} loser={homeWon} />
    </div>
  )
}

function BracketRound({ label, matches, slotCount }: { label: string; matches: (MatchWithTeams | null)[]; slotCount: number }) {
  const slots = Array.from({ length: slotCount }, (_, i) => matches[i] ?? null)
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'space-around', gap: 20, position: 'relative',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-400)',
        textAlign: 'center', marginBottom: 12,
      }}>{label}</div>
      {slots.map((m, i) => <BracketMatch key={i} match={m} />)}
    </div>
  )
}

export function BracketView({ matches }: BracketViewProps) {
  // Bucket matches into rounds by position in the knockout draw.
  // Without explicit round metadata we use match count heuristics:
  // 8 teams → QF(4) SF(2) F(1); 4 teams → SF(2) F(1); 2 teams → F(1)
  const total = matches.length
  const qf = total >= 4 ? matches.slice(0, 4)  : []
  const sf = total >= 4 ? matches.slice(4, 6)   : total >= 2 ? matches.slice(0, 2) : []
  const f  = total >= 4 ? matches.slice(6, 7)   : total >= 2 ? matches.slice(2, 3) : matches.slice(0, 1)

  const finalist = f[0]
  const champion =
    finalist?.status === 'finished'
      ? finalist.home_score > finalist.away_score
        ? finalist.home_team.name
        : finalist.away_team.name
      : null

  if (matches.length === 0) {
    return (
      <p style={{ color: 'var(--ink-400)', textAlign: 'center', padding: '48px 0' }}>
        No knockout matches yet.
      </p>
    )
  }

  return (
    <div style={{
      background: `radial-gradient(ellipse 80% 80% at 50% 50%, rgba(163,230,53,0.06), transparent 70%), var(--ink-800)`,
      border: '1px solid var(--ink-700)',
      borderRadius: 'var(--radius-xl)',
      padding: '32px clamp(16px, 3vw, 32px)',
      overflowX: 'auto',
    }}>
      <div style={{ display: 'flex', gap: 'clamp(24px, 4vw, 64px)', minWidth: 720 }}>
        {qf.length > 0 && <BracketRound label="Quarterfinals" matches={qf} slotCount={4} />}
        {sf.length > 0 && <BracketRound label="Semifinals"    matches={sf} slotCount={2} />}
        {             <BracketRound label="Final"          matches={f}  slotCount={1} />}

        {/* Champion cell */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: 20,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-400)',
            textAlign: 'center', marginBottom: 12,
          }}>Champion</div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: 24,
            background: `radial-gradient(circle at center, rgba(163,230,53,0.18), transparent 60%), var(--ink-900)`,
            border: '1.5px solid var(--brand-lime)', borderRadius: 'var(--radius-md)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand-lime)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14,
              letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-lime)', marginTop: 8,
            }}>Champion</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18,
              color: 'var(--ink-50)', marginTop: 6, textTransform: 'uppercase',
            }}>
              {champion ?? 'TBD'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
