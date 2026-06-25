import { teamColor, teamCode } from '@/lib/team-style'
import { mediaUrl } from '@/lib/storage'
import { MY_TZ, tournamentDay } from '@/lib/tz'
import type { MatchWithTeams, Team } from '@/lib/supabase/types'

interface MatchCardProps {
  match: MatchWithTeams
  /** Tournament start date (ISO) — used to compute the "Day N" label */
  tournamentStartDate?: string
  /** Opens the match detail modal (or anything else) when the card is clicked */
  onClick?: () => void
}

const ROUND_LABELS: Record<string, string> = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarterfinal',
  sf: 'Semifinal',
  final: 'Final',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { timeZone: MY_TZ, hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { timeZone: MY_TZ, weekday: 'short', month: 'short', day: 'numeric' })
}

export function matchStageLabel(match: MatchWithTeams): string {
  if (match.phase === 'knockout') {
    return (match.knockout_round && ROUND_LABELS[match.knockout_round]) ?? 'Knockout'
  }
  return match.home_team.group_label ? `Group ${match.home_team.group_label}` : ''
}

function liveMinute(startedAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000))
}

export function MatchCard({ match, tournamentStartDate, onClick }: MatchCardProps) {
  const isLive     = match.status === 'live'
  const isFinished = match.status === 'finished'
  const isUpcoming = match.status === 'scheduled'

  const homeWon = isFinished && match.home_score > match.away_score
  const awayWon = isFinished && match.away_score > match.home_score

  const statusClass = isLive ? 'live' : isFinished ? 'ft' : 'upcoming'

  return (
    <div
      className={`match-card ${statusClass} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      <div className="match-card-head">
        {isLive && (
          /* suppressHydrationWarning: minute derives from Date.now(), SSR can lag the client */
          <span className="match-status live" suppressHydrationWarning>
            <span className="dot" />
            LIVE{match.match_started_at ? ` · ${liveMinute(match.match_started_at)}'` : ''}
          </span>
        )}
        {isUpcoming && (
          <span className="match-status upcoming">
            Upcoming{match.match_time ? ` · ${formatTime(match.match_time)}` : ''}
          </span>
        )}
        <span className="group">{matchStageLabel(match)}</span>
      </div>

      <TeamRow team={match.home_team} score={isUpcoming ? null : match.home_score} winner={homeWon} loser={awayWon} />
      <TeamRow team={match.away_team} score={isUpcoming ? null : match.away_score} winner={awayWon} loser={homeWon} />

      <div className="footer-row">
        <span className="when">
          {match.match_time
            ? [
                tournamentStartDate ? `Day ${tournamentDay(match.match_time, tournamentStartDate)}` : null,
                formatDate(match.match_time),
                formatTime(match.match_time),
              ].filter(Boolean).join(' · ')
            : ''}
        </span>
        <span className="arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="m13 5 7 7-7 7"/>
          </svg>
        </span>
      </div>
    </div>
  )
}

function TeamRow({ team, score, winner, loser }: {
  team: Team
  score: number | null
  winner: boolean
  loser: boolean
}) {
  const logo = mediaUrl(team.logo_path)
  return (
    <div className="match-row">
      <div className={`match-team-cell ${winner ? 'winner' : loser ? 'loser' : ''}`}>
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
      </div>
      <span className={`sc ${score == null ? 'dim' : ''}`}>
        {score == null ? '—' : score}
      </span>
    </div>
  )
}
