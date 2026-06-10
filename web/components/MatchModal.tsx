'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { teamColor, teamCode } from '@/lib/team-style'
import { mediaUrl } from '@/lib/storage'
import { matchStageLabel } from './MatchCard'
import type { MatchWithTeams, Team } from '@/lib/supabase/types'

interface MatchModalProps {
  match: MatchWithTeams | null
  onClose: () => void
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-MY', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function liveMinute(startedAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000))
}

function ModalTeam({ team, winner }: { team: Team; winner: boolean }) {
  const logo = mediaUrl(team.logo_path)
  return (
    <div className={`mmodal-team ${winner ? 'winner' : ''}`}>
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
  )
}

export function MatchModal({ match, onClose }: MatchModalProps) {
  if (!match) return null

  const isLive     = match.status === 'live'
  const isFinished = match.status === 'finished'
  const isUpcoming = match.status === 'scheduled'

  const homeWon = isFinished && match.home_score > match.away_score
  const awayWon = isFinished && match.away_score > match.home_score

  const metaRows: { k: string; v: string }[] = [
    ...(match.match_time ? [{ k: 'Kick-off', v: fmtDateTime(match.match_time) }] : []),
    { k: 'Stage', v: matchStageLabel(match) || '—' },
    ...(match.match_started_at ? [{ k: 'Started', v: fmtTime(match.match_started_at) }] : []),
    ...(match.match_finished_at ? [{ k: 'Finished', v: fmtTime(match.match_finished_at) }] : []),
  ]

  return (
    <Dialog.Root open onOpenChange={o => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="mmodal-overlay" />
        <Dialog.Content className="mmodal" aria-describedby={undefined}>
          <Dialog.Title style={{
            position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
            overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
          }}>
            {match.home_team.name} vs {match.away_team.name}
          </Dialog.Title>

          <div className="mmodal-head">
            {isLive && (
              <span className="match-status live">
                <span className="dot" />
                LIVE{match.match_started_at ? ` · ${liveMinute(match.match_started_at)}'` : ''}
              </span>
            )}
            {isFinished && <span className="match-status ft">Full time</span>}
            {isUpcoming && <span className="match-status upcoming">Upcoming</span>}
            <span className="mmodal-stage">{matchStageLabel(match)}</span>
          </div>

          <div className="mmodal-board">
            <ModalTeam team={match.home_team} winner={homeWon} />
            {isUpcoming ? (
              <div className="mmodal-score vs">VS</div>
            ) : (
              <div className="mmodal-score">
                <span>{match.home_score}</span>
                <span className="sep">–</span>
                <span>{match.away_score}</span>
              </div>
            )}
            <ModalTeam team={match.away_team} winner={awayWon} />
          </div>

          <div className="mmodal-meta">
            {metaRows.map(r => (
              <div className="mmodal-meta-row" key={r.k}>
                <span className="k">{r.k}</span>
                <span className="v">{r.v}</span>
              </div>
            ))}
          </div>

          <Dialog.Close asChild>
            <button className="mmodal-close" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
