'use client'

import { useTransition } from 'react'
import { toast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { finishTournament } from '@/lib/db/tournaments'
import { MatchStatusControls } from './MatchStatusControls'
import { ScoreEditor } from './ScoreEditor'
import { OrganizerAssignment } from './OrganizerAssignment'
import { GoLivePanel } from './GoLivePanel'
import type { Tournament, MatchWithTeams, TeamWithPlayers } from '@/lib/supabase/types'

interface Props {
  tournament: Tournament
  matches: MatchWithTeams[]
  teams: TeamWithPlayers[]
  tournamentId: string
  isAdmin: boolean
  isOrganizer: boolean
  onRefresh: () => void
}

export function OverviewTab({ tournament: t, matches, teams, tournamentId, isAdmin, isOrganizer, onRefresh }: Props) {
  const liveCount = matches.filter(m => m.status === 'live').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Status" value={<span className="capitalize">{t.status}</span>} />
        <StatCard label="Matches" value={matches.length} />
        <StatCard label="Live Now" value={liveCount} highlight={liveCount > 0} />
        <StatCard label="Format" value={
          t.format === 'round_robin' ? 'Round Robin' :
          t.format === 'round_robin_knockout' ? 'RR + Knockout' :
          'Knockout'
        } />
      </div>

      <GoLivePanel tournament={t} teams={teams} onLive={onRefresh} />

      {isAdmin && <OrganizerAssignment tournamentId={tournamentId} />}

      {t.status === 'active' && (
        <FinishPanel tournamentId={tournamentId} onFinished={onRefresh} />
      )}

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Matches</h2>
        {matches.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-slate-500">No fixtures yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map(m => (
              <MatchRow key={m.id} match={m} tournamentId={tournamentId} isOrganizer={isOrganizer} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FinishPanel({ tournamentId, onFinished }: { tournamentId: string; onFinished: () => void }) {
  const [isPending, startTransition] = useTransition()

  function finish() {
    startTransition(async () => {
      const supabase = createClient()
      try {
        await finishTournament(supabase, tournamentId)
        toast.success('Tournament marked as finished.')
        onFinished()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to finish tournament')
      }
    })
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-amber-800">All matches done?</p>
        <p className="text-xs text-amber-600">Marking as finished locks all editing.</p>
      </div>
      <button onClick={finish} disabled={isPending}
        className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
        {isPending ? 'Finishing…' : 'Mark as Finished'}
      </button>
    </div>
  )
}

function MatchRow({ match: m, tournamentId, isOrganizer, isAdmin }:
  { match: MatchWithTeams; tournamentId: string; isOrganizer: boolean; isAdmin: boolean }) {
  const matchTime = new Date(m.match_time).toLocaleString('en-MY', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  })
  const statusColors: Record<string, string> = {
    scheduled: 'bg-slate-100 text-slate-500',
    live: 'bg-green-100 text-green-700',
    halftime: 'bg-amber-100 text-amber-700',
    finished: 'bg-blue-50 text-blue-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 text-sm">{m.home_team.name} vs {m.away_team.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{matchTime}</p>
      </div>
      {m.status === 'live' && isOrganizer ? (
        <ScoreEditor
          matchId={m.id}
          homeScore={m.home_score}
          awayScore={m.away_score}
          homeName={m.home_team.name}
          awayName={m.away_team.name}
        />
      ) : m.status !== 'scheduled' && (
        <span className="text-base font-bold tabular-nums">{m.home_score} – {m.away_score}</span>
      )}
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusColors[m.status]}`}>
        {m.status}
      </span>
      {isOrganizer && (
        <MatchStatusControls match={m} tournamentId={tournamentId} isAdmin={isAdmin} />
      )}
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${highlight ? 'border-green-400' : 'border-slate-200'}`}>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? 'text-green-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
