'use client'

import { useTransition } from 'react'
import { toast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { goLive } from '@/lib/db/tournaments'
import { expectedGroupFixtures, expectedFirstRoundKOMatches } from '@/lib/fixture-utils'
import type { Tournament, TeamWithPlayers, MatchWithTeams } from '@/lib/supabase/types'

interface GoLiveCheck {
  label: string
  ok: boolean
  detail?: string
}

function computeChecks(t: Tournament, teams: TeamWithPlayers[], matches: MatchWithTeams[]): GoLiveCheck[] {
  const checks: GoLiveCheck[] = []

  const hasRR = t.format === 'round_robin' || t.format === 'round_robin_knockout'
  const hasKO = t.format === 'knockout' || t.format === 'round_robin_knockout'

  // 1. Settings configured
  const settingsOk = !!(
    t.name && t.start_date && t.end_date &&
    (!hasRR || (t.num_groups && t.teams_per_group)) &&
    (!hasKO || (t.knockout_start_round && t.seeding_method))
  )
  checks.push({ label: 'All settings configured', ok: settingsOk })

  // 2. Enough teams
  const expectedTeams = hasRR ? (t.num_groups ?? 0) * (t.teams_per_group ?? 0) : 0
  const teamsOk = expectedTeams > 0 && teams.length >= expectedTeams
  checks.push({
    label: `Teams (${teams.length}/${expectedTeams})`,
    ok: teamsOk,
    detail: teamsOk ? undefined : `Add ${Math.max(0, expectedTeams - teams.length)} more team${expectedTeams - teams.length !== 1 ? 's' : ''}`,
  })

  // 3. All teams rostered
  const minPlayers = t.min_players_per_team
  const underRostered = teams.filter(tm => tm.players.length < minPlayers)
  const rosterOk = underRostered.length === 0 && teams.length > 0
  checks.push({
    label: `All teams have ≥${minPlayers} players`,
    ok: rosterOk,
    detail: rosterOk ? undefined : underRostered.map(tm => `${tm.name} (${tm.players.length}/${minPlayers})`).join(', '),
  })

  // 4. Date reached
  const today = new Date().toISOString().slice(0, 10)
  const dateOk = today >= t.start_date
  checks.push({
    label: 'Tournament date reached',
    ok: dateOk,
    detail: dateOk ? undefined : `Wait until ${formatDate(t.start_date)}`,
  })

  // 5. Fixtures scheduled
  const matchCount = matches.length
  if (hasRR) {
    const expected = expectedGroupFixtures(t)
    const fixturesOk = expected > 0 && matchCount >= expected
    const diff = Math.max(0, expected - matchCount)
    checks.push({
      label: `All group fixtures scheduled (${matchCount}/${expected})`,
      ok: fixturesOk,
      detail: fixturesOk ? undefined : `Schedule ${diff} more fixture${diff !== 1 ? 's' : ''}`,
    })
  } else {
    const expected = expectedFirstRoundKOMatches(t.knockout_start_round)
    const fixturesOk = expected > 0 && matchCount >= expected
    const diff = Math.max(0, expected - matchCount)
    checks.push({
      label: `First-round fixtures scheduled (${matchCount}/${expected})`,
      ok: fixturesOk,
      detail: fixturesOk ? undefined : `Schedule ${diff} more fixture${diff !== 1 ? 's' : ''}`,
    })
  }

  return checks
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Props {
  tournament: Tournament
  teams: TeamWithPlayers[]
  matches: MatchWithTeams[]
  onLive: () => void
}

export function GoLivePanel({ tournament, teams, matches, onLive }: Props) {
  const [isPending, startTransition] = useTransition()
  const checks = computeChecks(tournament, teams, matches)
  const allOk = checks.every(c => c.ok)

  function handleGoLive() {
    startTransition(async () => {
      const supabase = createClient()
      try {
        await goLive(supabase, tournament.id)
        toast.success('Tournament is now live!')
        onLive()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to go live')
      }
    })
  }

  if (tournament.status === 'active') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-green-700">Tournament is Live</p>
        <p className="text-xs text-green-600 mt-1">Matches can be started from the Overview tab.</p>
      </div>
    )
  }

  if (tournament.status !== 'setup') return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-base font-bold text-slate-900 mb-3">Go Live</h3>
      <ul className="space-y-2 mb-4">
        {checks.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 text-base ${c.ok ? 'text-green-500' : 'text-red-400'}`}>
              {c.ok ? '✓' : '✗'}
            </span>
            <div>
              <span className={c.ok ? 'text-slate-700' : 'text-red-600 font-medium'}>{c.label}</span>
              {c.detail && <span className="text-xs text-red-500 ml-1">— {c.detail}</span>}
            </div>
          </li>
        ))}
      </ul>
      <button
        onClick={handleGoLive}
        disabled={!allOk || isPending}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          allOk
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isPending ? 'Going Live…' : allOk ? 'Go Live' : 'Cannot Go Live Yet'}
      </button>
    </div>
  )
}
