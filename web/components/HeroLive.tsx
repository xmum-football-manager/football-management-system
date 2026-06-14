'use client'

import { useEffect, useState } from 'react'
import { teamColor, teamCode } from '@/lib/team-style'
import { mediaUrl } from '@/lib/storage'
import { useMatchScorers } from '@/lib/use-match-scorers'
import type { MatchWithTeams, Team } from '@/lib/supabase/types'

interface HeroLiveProps {
  match: MatchWithTeams
  /** All tournament matches — used to derive each team's recent form */
  allMatches?: MatchWithTeams[]
  /** "Tournament · Stage · Location" line shown next to the status pill */
  metaText?: React.ReactNode
  minutesPerHalf?: number
}

type FormResult = 'W' | 'D' | 'L'

function teamForm(teamId: string, matches: MatchWithTeams[]): FormResult[] {
  return matches
    .filter(m => m.status === 'finished' && (m.home_team_id === teamId || m.away_team_id === teamId))
    .slice(-5)
    .map(m => {
      const isHome = m.home_team_id === teamId
      const gf = isHome ? m.home_score : m.away_score
      const ga = isHome ? m.away_score : m.home_score
      return gf > ga ? 'W' : gf < ga ? 'L' : 'D'
    })
}

function BallIcon() {
  return (
    <svg className="clock-ball" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="currentColor" />
      <path d="M24 10 L32 16 L29 26 L19 26 L16 16 Z" fill="#0E1A12" />
      <path d="M10 24 L16 27 L16 36 L10 32 Z" fill="#0E1A12" />
      <path d="M38 24 L32 27 L32 36 L38 32 Z" fill="#0E1A12" />
      <path d="M19 36 L29 36 L26 44 L22 44 Z" fill="#0E1A12" />
    </svg>
  )
}

/** Animated scoreboard digit — the key remount replays the tick-in animation on change. */
function ScoreDigit({ value }: { value: number }) {
  return (
    <span className="score-digit-wrap">
      <span key={value} className="score-digit tick">{value}</span>
    </span>
  )
}

function FormStrip({ form, align }: { form: FormResult[]; align: 'left' | 'right' }) {
  if (form.length === 0) return null
  return (
    <div className="team-form" style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {form.map((r, i) => <span key={i} className={`form-pip ${r}`}>{r}</span>)}
    </div>
  )
}

interface LiveClockProps {
  status: 'live' | 'halftime'
  startedAt: string
  halftimeStartedAt: string | null
  secondHalfStartedAt: string | null
  minutesPerHalf: number
}

function computeElapsed({ status, startedAt, halftimeStartedAt, secondHalfStartedAt }: Omit<LiveClockProps, 'minutesPerHalf'>): number {
  const kickoff = new Date(startedAt).getTime()
  if (status === 'halftime' && halftimeStartedAt) {
    return Math.max(0, Math.floor((new Date(halftimeStartedAt).getTime() - kickoff) / 1000))
  }
  if (status === 'live' && halftimeStartedAt && secondHalfStartedAt) {
    const firstHalf = Math.max(0, new Date(halftimeStartedAt).getTime() - kickoff)
    const secondHalf = Math.max(0, Date.now() - new Date(secondHalfStartedAt).getTime())
    return Math.floor((firstHalf + secondHalf) / 1000)
  }
  return Math.max(0, Math.floor((Date.now() - kickoff) / 1000))
}

function LiveClock({ status, startedAt, halftimeStartedAt, secondHalfStartedAt, minutesPerHalf }: LiveClockProps) {
  const [sec, setSec] = useState(() => computeElapsed({ status, startedAt, halftimeStartedAt, secondHalfStartedAt }))

  useEffect(() => {
    if (status === 'halftime') return
    const id = setInterval(() => {
      setSec(computeElapsed({ status, startedAt, halftimeStartedAt, secondHalfStartedAt }))
    }, 1000)
    return () => clearInterval(id)
  }, [status, startedAt, halftimeStartedAt, secondHalfStartedAt])

  const m = Math.floor(sec / 60)
  const period = halftimeStartedAt ? '2H' : (m >= minutesPerHalf ? '2H' : '1H')
  const clock = `${String(m).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

  return (
    <div className="match-clock">
      <BallIcon />
      {/* suppressHydrationWarning: elapsed time is computed from Date.now(), so
          SSR text is a few seconds behind the client; first tick corrects it */}
      <span className="period" suppressHydrationWarning>{period}</span>
      <span className="tnum" style={{ fontVariantNumeric: 'tabular-nums' }} suppressHydrationWarning>{clock}</span>
    </div>
  )
}

function TeamSide({ team, side, form }: { team: Team; side: 'home' | 'away'; form: FormResult[] }) {
  const logo = mediaUrl(team.logo_path)
  return (
    <div className={`team-side ${side}`}>
      <div
        className="team-crest"
        style={
          logo
            ? { backgroundImage: `url(${logo})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: teamColor(team.id) }
        }
      >
        {logo ? null : teamCode(team.name)}
      </div>
      <div className="team-side-meta">
        <div className="team-name">{team.name}</div>
        <div className="team-tag">
          {teamCode(team.name)}{team.group_label ? ` · GROUP ${team.group_label}` : ''}
        </div>
        <FormStrip form={form} align={side === 'home' ? 'right' : 'left'} />
      </div>
    </div>
  )
}

function LastGoalLine({ match }: { match: MatchWithTeams }) {
  const scorers = useMatchScorers(match.id, true)
  const last = scorers[scorers.length - 1]
  if (!last) return null
  const team = last.team_id === match.home_team_id ? match.home_team : match.away_team
  const name = last.player_name
    ? `${last.jersey_number !== null ? `#${last.jersey_number} ` : ''}${last.player_name}`
    : null
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'center',
        marginTop: 14, padding: '7px 14px', borderRadius: 999,
        background: 'rgba(30,120,240,0.12)', border: '1px solid rgba(30,120,240,0.35)',
        fontSize: 13, color: 'var(--ink-50)',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--brand-lime)" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6 L14 10 L18 10 L15 13 L16 17 L12 15 L8 17 L9 13 L6 10 L10 10 Z" fill="#060C1C" />
      </svg>
      <span style={{ color: 'var(--ink-300)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11 }}>
        Last goal
      </span>
      <span style={{ fontWeight: 700 }}>{name ?? team.name}</span>
      {name && <span style={{ color: 'var(--ink-300)' }}>· {team.name}</span>}
    </div>
  )
}

export function HeroLive({ match, allMatches = [], metaText, minutesPerHalf = 45 }: HeroLiveProps) {
  const isLive = match.status === 'live' || match.status === 'halftime'
  const isHalftime = match.status === 'halftime'
  const isUpcoming = match.status === 'scheduled'

  const kickoff = match.match_time
    ? new Date(match.match_time).toLocaleString('en-MY', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    : null

  return (
    <section className="hero" id="live">
      <div className="hero-inner">

        <div className="hero-meta">
          {isHalftime ? (
            <span className="live-pill dim">Half Time</span>
          ) : isLive ? (
            <span className="live-pill"><span className="live-dot" />Live</span>
          ) : isUpcoming ? (
            <span className="live-pill lime">Up next</span>
          ) : (
            <span className="live-pill dim">Full time</span>
          )}
          {metaText && <span className="match-meta-text">{metaText}</span>}
        </div>

        <div className="scoreboard">
          <TeamSide team={match.home_team} side="home" form={teamForm(match.home_team_id ?? '', allMatches)} />

          <div className="score-column">
            {isUpcoming ? (
              <div className="score-display vs">VS</div>
            ) : (
              <div className="score-display">
                <ScoreDigit value={match.home_score} />
                <span className="sep">–</span>
                <ScoreDigit value={match.away_score} />
              </div>
            )}
            {isLive && match.match_started_at ? (
              <LiveClock
                status={match.status as 'live' | 'halftime'}
                startedAt={match.match_started_at}
                halftimeStartedAt={match.halftime_started_at}
                secondHalfStartedAt={match.second_half_started_at}
                minutesPerHalf={minutesPerHalf}
              />
            ) : (
              <div className="match-clock">
                <BallIcon />
                {isUpcoming
                  ? <><span className="period">KO</span><span>{kickoff ?? 'TBD'}</span></>
                  : <span className="period">FT</span>}
              </div>
            )}
          </div>

          <TeamSide team={match.away_team} side="away" form={teamForm(match.away_team_id ?? '', allMatches)} />
        </div>

        {isLive && <LastGoalLine match={match} />}

      </div>
    </section>
  )
}
