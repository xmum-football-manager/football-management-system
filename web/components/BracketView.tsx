import { teamColor, teamCode } from '@/lib/team-style'
import { mediaUrl } from '@/lib/storage'
import type { MatchWithTeams, Team } from '@/lib/supabase/types'

interface BracketViewProps {
  matches: MatchWithTeams[]
  /** Called with the clicked match (e.g. to open the match modal) */
  onMatchClick?: (match: MatchWithTeams) => void
}

// Approximate match-card height; drives the shared column height so each
// round's matches center between their feeder matches (same as AdminBracketView).
const CARD_HEIGHT = 82
const ROW_GAP = 20
// The champion trophy cell is taller than a single match card — never let the
// shared column height drop below it, or the cell gets cropped/scrolls.
const TROPHY_HEIGHT = 230

function BracketTeamRow({ team, score, winner, loser }: {
  team: Team | null
  score: number | null
  winner: boolean
  loser: boolean
}) {
  if (!team) {
    return (
      <div className="bracket-team-row tbd">
        <span className="crest" />
        <span className="nm">TBD</span>
        <span className="sc">—</span>
      </div>
    )
  }
  const logo = mediaUrl(team.logo_path)
  return (
    <div className={`bracket-team-row ${winner ? 'winner' : loser ? 'loser' : ''}`}>
      <span
        className="crest"
        style={
          logo
            ? { backgroundImage: `url(${logo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: teamColor(team.id) }
        }
      >
        {logo ? null : teamCode(team.name)}
      </span>
      <span className="nm">{team.name}</span>
      <span className="sc">{score == null ? '—' : score}</span>
    </div>
  )
}

function BracketMatch({ match, onClick }: { match: MatchWithTeams | null; onClick?: () => void }) {
  if (!match) {
    return (
      <div className="bracket-match tbd">
        <BracketTeamRow team={null} score={null} winner={false} loser={false} />
        <BracketTeamRow team={null} score={null} winner={false} loser={false} />
      </div>
    )
  }

  const isLive     = match.status === 'live'
  const isFinished = match.status === 'finished'
  const homeWon    = isFinished && match.home_score > match.away_score
  const awayWon    = isFinished && match.away_score > match.home_score

  return (
    <div
      className={`bracket-match ${isLive ? 'live' : ''} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      {isLive && <span className="live-tag">LIVE</span>}
      <BracketTeamRow team={match.home_team ?? null} score={match.status === 'scheduled' ? null : match.home_score} winner={homeWon} loser={awayWon} />
      <BracketTeamRow team={match.away_team ?? null} score={match.status === 'scheduled' ? null : match.away_score} winner={awayWon} loser={homeWon} />
    </div>
  )
}

function BracketRound({ label, matches, slotCount, columnHeight, onMatchClick }: {
  label: string
  matches: (MatchWithTeams | null)[]
  slotCount: number
  columnHeight: number
  onMatchClick?: (match: MatchWithTeams) => void
}) {
  const slots = Array.from({ length: slotCount }, (_, i) => matches[i] ?? null)
  return (
    <div className="bracket-round">
      <div className="bracket-round-label">{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', minHeight: columnHeight }}>
        {slots.map((m, i) => (
          <BracketMatch key={i} match={m} onClick={m && onMatchClick ? () => onMatchClick(m) : undefined} />
        ))}
      </div>
    </div>
  )
}

export function BracketView({ matches, onMatchClick }: BracketViewProps) {
  // Bucket matches into rounds by position in the knockout draw.
  // Without explicit round metadata we use match count heuristics:
  // 8 teams → QF(4) SF(2) F(1); 4 teams → SF(2) F(1); 2 teams → F(1)
  const total = matches.length
  const qf = total >= 4 ? matches.slice(0, 4)  : []
  const sf = total >= 4 ? matches.slice(4, 6)   : total >= 2 ? matches.slice(0, 2) : []
  const f  = total >= 4 ? matches.slice(6, 7)   : total >= 2 ? matches.slice(2, 3) : matches.slice(0, 1)

  const finalist = f[0]
  const champion: Team | null =
    finalist?.status === 'finished'
      ? finalist.home_score > finalist.away_score
        ? finalist.home_team ?? null
        : finalist.away_score > finalist.home_score
          ? finalist.away_team ?? null
          : null
      : null
  const championLogo = champion ? mediaUrl(champion.logo_path) : null

  if (matches.length === 0) {
    return (
      <p style={{ color: 'var(--ink-400)', textAlign: 'center', padding: '48px 0' }}>
        No knockout matches yet.
      </p>
    )
  }

  // Shared column height: every round distributes its matches inside the same
  // envelope, so later-round matches sit centered between their feeders.
  // Floor at the trophy cell's height so a sparse bracket doesn't crop it.
  const firstRoundSize = qf.length > 0 ? 4 : sf.length > 0 ? 2 : 1
  const columnHeight = Math.max(
    firstRoundSize * CARD_HEIGHT + (firstRoundSize - 1) * ROW_GAP,
    TROPHY_HEIGHT,
  )
  const roundCount = (qf.length > 0 ? 1 : 0) + (sf.length > 0 ? 1 : 0) + 1
  const minWidth = roundCount * 244 + 220

  return (
    <div className="bracket-shell">
      <div className="bracket" style={{ minWidth }}>
        {qf.length > 0 && <BracketRound label="Quarterfinals" matches={qf} slotCount={4} columnHeight={columnHeight} onMatchClick={onMatchClick} />}
        {sf.length > 0 && <BracketRound label="Semifinals"    matches={sf} slotCount={2} columnHeight={columnHeight} onMatchClick={onMatchClick} />}
        {                 <BracketRound label="Final"         matches={f}  slotCount={1} columnHeight={columnHeight} onMatchClick={onMatchClick} />}

        {/* Champion cell */}
        <div className="bracket-round">
          <div className="bracket-round-label">Champion</div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: columnHeight }}>
            {champion ? (
              <div className="trophy-cell won">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand-lime)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
                <span
                  className="crest"
                  style={
                    championLogo
                      ? { backgroundImage: `url(${championLogo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { background: teamColor(champion.id) }
                  }
                >
                  {championLogo ? null : teamCode(champion.name)}
                </span>
                <div className="winner-name">{champion.name}</div>
                <div className="winner-sub">Won the final {Math.max(finalist!.home_score, finalist!.away_score)}–{Math.min(finalist!.home_score, finalist!.away_score)}</div>
              </div>
            ) : (
              <div className="trophy-cell tbd">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand-lime)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                  <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                </svg>
                <div className="label">Champion</div>
                <div className="winner-pending">Awaiting the final&hellip;</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
