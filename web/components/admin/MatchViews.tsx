'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Loader2,
  GripVertical,
  CalendarClock,
  List as ListIcon,
  Network,
} from 'lucide-react'
import { MatchStatusBadge } from '@/components/admin/MatchStatusBadge'
import {
  AdminBracketView,
  type BracketGroupColumn,
  type BracketGroupStanding,
} from '@/components/admin/AdminBracketView'
import { MatchRow } from '@/app/admin/tournaments/[id]/MatchRow'
import { rescheduleMatchAction } from '@/app/admin/tournaments/[id]/fixtures/actions'
import { setTeamGroupAction } from '@/app/admin/tournaments/[id]/teams/actions'
import { usePersistedView } from '@/lib/hooks/use-persisted-view'
import { phaseSchedulingStatus } from '@/lib/phase-schedule-guard'
import { formatClock } from '@/lib/format'
import type {
  MatchWithTeams,
  TournamentFormat,
  TournamentStatus,
} from '@/lib/supabase/types'

type TeamRef = { id: string; name: string; group_label: string | null }

type ViewKey = 'list' | 'structure'
const VIEW_STORAGE_KEY = 'admin-matches-view'

interface MatchViewsProps {
  tournamentId: string
  tournamentStart: string
  tournamentEnd: string
  tournamentFormat: TournamentFormat
  tournamentStatus: TournamentStatus
  isAdmin: boolean
  canManageFixtures: boolean
  canAssignGroups?: boolean
  numGroups?: number | null
  advancePerGroup?: number | null
  teams: TeamRef[]
  matches: MatchWithTeams[]
  hideTabs?: boolean
}

export function MatchViews({
  tournamentId,
  tournamentStart,
  tournamentEnd,
  tournamentFormat,
  tournamentStatus,
  isAdmin,
  canManageFixtures,
  canAssignGroups = false,
  numGroups,
  advancePerGroup,
  teams,
  matches,
  hideTabs = false,
}: MatchViewsProps) {
  const [reschedulingMatch, setReschedulingMatch] = useState<MatchWithTeams | null>(null)
  const handleMatchClick = (m: MatchWithTeams) => {
    if (m.status !== 'scheduled' || !canManageFixtures || !m.match_time) return
    setReschedulingMatch(m)
  }

  const supportsStructure =
    tournamentFormat === 'knockout' ||
    tournamentFormat === 'round_robin_knockout' ||
    tournamentFormat === 'round_robin'
  const allowed = useMemo<readonly ViewKey[]>(() => {
    const base: ViewKey[] = ['list']
    if (supportsStructure) base.push('structure')
    return base
  }, [supportsStructure])
  const initialDefault: ViewKey = supportsStructure ? 'structure' : 'list'

  const [view, setView] = usePersistedView<ViewKey>(VIEW_STORAGE_KEY, initialDefault, allowed)
  const phaseScheduled = phaseSchedulingStatus(matches)

  if (hideTabs) {
    return (
      <div className="space-y-3">
        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No matches yet.{' '}
              {teams.length >= 2
                ? 'Generate fixtures from the panel above.'
                : 'Add at least 2 teams first.'}
            </CardContent>
          </Card>
        ) : (
          <ListView
            matches={matches}
            tournamentStatus={tournamentStatus}
            isAdmin={isAdmin}
            onMatchClick={canManageFixtures ? handleMatchClick : undefined}
            phaseScheduled={phaseScheduled}
          />
        )}
        {reschedulingMatch && (
          <RescheduleDialog
            match={reschedulingMatch}
            initialTime={reschedulingMatch.match_time ?? ''}
            tournamentId={tournamentId}
            tournamentStart={tournamentStart}
            tournamentEnd={tournamentEnd}
            onClose={() => setReschedulingMatch(null)}
          />
        )}
      </div>
    )
  }
  const effectiveView = allowed.includes(view) ? view : initialDefault

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <div
          role="tablist"
          aria-label="Match view"
          className="inline-flex items-center gap-0.5 rounded-lg p-1"
          style={{
            background: 'var(--admin-surface-2)',
            border: '1px solid var(--admin-rule)',
          }}
        >
          {supportsStructure && (
            <ViewTab
              icon={<Network className="h-3.5 w-3.5" />}
              label="Structure"
              active={effectiveView === 'structure'}
              onClick={() => setView('structure')}
            />
          )}
          <ViewTab
            icon={<ListIcon className="h-3.5 w-3.5" />}
            label="List"
            active={effectiveView === 'list'}
            onClick={() => setView('list')}
          />
        </div>
      </div>

      {effectiveView === 'structure' ? (
        <StructureView
          format={tournamentFormat}
          teams={teams}
          matches={matches}
          canAssignGroups={canAssignGroups}
          numGroups={numGroups ?? null}
          advancePerGroup={advancePerGroup ?? null}
          onMatchClick={handleMatchClick}
          tournamentId={tournamentId}
        />
      ) : matches.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No matches yet.{' '}
            {teams.length >= 2
              ? 'Generate fixtures from the panel above.'
              : 'Add at least 2 teams first.'}
          </CardContent>
        </Card>
      ) : (
        <ListView
          matches={matches}
          tournamentStatus={tournamentStatus}
          isAdmin={isAdmin}
          onMatchClick={canManageFixtures ? handleMatchClick : undefined}
          phaseScheduled={phaseScheduled}
        />
      )}

      {reschedulingMatch && (
        <RescheduleDialog
          match={reschedulingMatch}
          initialTime={reschedulingMatch.match_time ?? ''}
          tournamentId={tournamentId}
          tournamentStart={tournamentStart}
          tournamentEnd={tournamentEnd}
          onClose={() => setReschedulingMatch(null)}
        />
      )}
    </div>
  )
}

function ViewTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="admin-tab inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] transition-colors"
      style={
        active
          ? {
              background: 'var(--admin-lime-wash)',
              color: 'var(--admin-lime)',
              border: '1px solid color-mix(in srgb, var(--admin-lime) 35%, transparent)',
              boxShadow: '0 1px 0 rgba(0,0,0,0.02)',
            }
          : {
              color: 'var(--muted-foreground)',
              border: '1px solid transparent',
            }
      }
    >
      {icon}
      {label}
    </button>
  )
}

/* ============================================================
 * Match phase helpers
 * ========================================================== */

// Phase is the source of truth — NOT a group_label heuristic. A knockout match can pair
// two teams from the same group (e.g. 4-team semis: 1A vs 2A), which a group_label check
// would mis-flag as a group match — hiding it from the bracket and double-counting it in
// group standings. Always gate on `m.phase`.
function isGroupStageMatch(m: MatchWithTeams): boolean {
  return m.phase === 'group'
}

function knockoutMatches(matches: MatchWithTeams[]): MatchWithTeams[] {
  return matches.filter((m) => m.phase === 'knockout')
}

function comparePhaseThenTime(a: MatchWithTeams, b: MatchWithTeams): number {
  if (a.phase !== b.phase) return a.phase === 'group' ? -1 : 1
  return (a.match_time ?? '').localeCompare(b.match_time ?? '')
}

/* ============================================================
 * List view — MatchRow grid (admin transitions live here)
 * ========================================================== */

function ListView({
  matches,
  tournamentStatus,
  isAdmin,
  onMatchClick,
  phaseScheduled,
}: {
  matches: MatchWithTeams[]
  tournamentStatus: TournamentStatus
  isAdmin: boolean
  onMatchClick?: (m: MatchWithTeams) => void
  phaseScheduled: { group: boolean; knockout: boolean }
}) {
  const koStarted = matches.some((m) => m.phase === 'knockout' && m.status !== 'scheduled')
  const groupStageMatches = useMemo(() => matches.filter(isGroupStageMatch), [matches])
  const koStageMatches = useMemo(() => knockoutMatches(matches), [matches])

  function renderList(ms: MatchWithTeams[]) {
    return (
      <ul
        className="overflow-hidden rounded-xl border bg-card"
        style={{ borderColor: 'var(--admin-rule)' }}
      >
        {ms.map((m, i) => (
          <li
            key={m.id}
            style={{ borderTop: i > 0 ? '1px solid var(--admin-rule-soft)' : 'none' }}
          >
            <MatchRow
              match={m}
              tournamentStatus={tournamentStatus}
              isAdmin={isAdmin}
              onMatchClick={onMatchClick}
              kickoffBlocked={!(phaseScheduled[m.phase as 'group' | 'knockout'] ?? true)}
              revertBlocked={m.phase === 'group' && koStarted}
            />
          </li>
        ))}
      </ul>
    )
  }

  // Renders the Day N / Unscheduled grouping for matches already confined to one phase.
  function renderStage(stageMatches: MatchWithTeams[]) {
    const days = groupByDay(stageMatches)
    const unscheduled = stageMatches.filter((m) => !m.match_time).sort(comparePhaseThenTime)
    return (
      <div className="space-y-4">
        {days.map((day, i) => (
          <div key={day.key} className="space-y-1.5">
            <div className="flex items-baseline gap-2 px-0.5">
              <span className="text-xs font-semibold text-foreground">Day {i + 1}</span>
              <span className="text-[11px] text-muted-foreground">{day.label}</span>
            </div>
            {renderList(day.matches)}
          </div>
        ))}
        {unscheduled.length > 0 && (
          <div className="space-y-1.5">
            <div className="px-0.5 text-xs font-semibold text-muted-foreground">Unscheduled</div>
            {renderList(unscheduled)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groupStageMatches.length > 0 && (
        <div className="space-y-3">
          <h3 className="admin-eyebrow">Group Stage</h3>
          {renderStage(groupStageMatches)}
        </div>
      )}
      {koStageMatches.length > 0 && (
        <div className="space-y-3">
          <h3 className="admin-eyebrow">Knockout Stage</h3>
          {renderStage(koStageMatches)}
        </div>
      )}
    </div>
  )
}

/* ============================================================
 * Structure view — single tab that merges groups + bracket
 * ========================================================== */

function StructureView({
  format,
  teams,
  matches,
  tournamentId,
  canAssignGroups,
  numGroups,
  advancePerGroup,
  onMatchClick,
}: {
  format: TournamentFormat
  teams: TeamRef[]
  matches: MatchWithTeams[]
  tournamentId: string
  canAssignGroups: boolean
  numGroups: number | null
  advancePerGroup: number | null
  onMatchClick: (m: MatchWithTeams) => void
}) {
  const ko = useMemo(() => knockoutMatches(matches), [matches])

  if (format === 'round_robin') {
    return <LeagueFlowView teams={teams} matches={matches} onMatchClick={onMatchClick} />
  }

  if (format === 'knockout') {
    const teamCount = teams.length
    const bracketTeamCount = teamCount >= 2 ? nextPowerOfTwoAtLeast(teamCount) : 0
    return (
      <div className="space-y-3">
        {ko.length === 0 && bracketTeamCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Bracket structure with {bracketTeamCount} slots. Set up the draw to start filling
            matches.
          </p>
        )}
        <AdminBracketView
          matches={ko}
          bracketTeamCount={bracketTeamCount}
          sidebar={teams.length > 0 ? <TeamsListCard teams={teams} /> : undefined}
          onMatchClick={onMatchClick}
        />
      </div>
    )
  }

  // round_robin_knockout
  const effectiveNumGroups = Math.max(2, Math.min(16, numGroups ?? 4))
  const effectiveAdvance = Math.max(1, advancePerGroup ?? 2)
  const bracketTeamCount = effectiveNumGroups * effectiveAdvance
  const groupLabels = Array.from({ length: effectiveNumGroups }, (_, i) =>
    String.fromCharCode(65 + i),
  )
  const firstRoundLabels = buildCrossPoolLabels(groupLabels, effectiveAdvance)

  // Build group columns for inline rendering inside the bracket.
  const groupColumns: BracketGroupColumn[] = groupLabels.map((label) => {
    const standings: BracketGroupStanding[] = computeGroupStandings(label, teams, matches).map(
      (s) => ({
        team_id: s.team_id,
        team_name: s.team_name,
        played: s.played,
        wins: s.wins,
        draws: s.draws,
        losses: s.losses,
        gd: s.gd,
        pts: s.pts,
      }),
    )
    const groupMatches = matches
      .filter(
        (m) =>
          m.phase === 'group' &&
          m.home_team.group_label === label &&
          m.away_team.group_label === label,
      )
      .sort((a, b) => (a.match_time ?? '').localeCompare(b.match_time ?? ''))
    return { label: `Group ${label}`, standings, matches: groupMatches }
  })

  return (
    <div className="space-y-6">
      {canAssignGroups && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="admin-eyebrow">Group stage</h3>
          </div>
          <GroupAssignment
            teams={teams}
            groupLabels={groupLabels}
            tournamentId={tournamentId}
          />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="admin-eyebrow">Tournament flow</h3>
          <span className="admin-mono text-[11px] text-muted-foreground">
            {effectiveNumGroups} groups · top {effectiveAdvance} advance · {bracketTeamCount}-team
            bracket
          </span>
        </div>
        <AdminBracketView
          matches={ko}
          bracketTeamCount={bracketTeamCount}
          firstRoundSourceLabels={firstRoundLabels}
          groupColumns={groupColumns}
          onMatchClick={onMatchClick}
        />
      </section>
    </div>
  )
}

/* ============================================================
 * League flow (round_robin) — standings card + matchday columns
 * ========================================================== */

function LeagueFlowView({
  teams,
  matches,
  onMatchClick,
}: {
  teams: TeamRef[]
  matches: MatchWithTeams[]
  onMatchClick: (m: MatchWithTeams) => void
}) {
  const standings = useMemo(() => computeLeagueStandings(teams, matches), [teams, matches])
  const matchdays = useMemo(() => groupByDay(matches), [matches])
  const played = matches.filter((m) => m.status === 'finished').length

  if (teams.length === 0 && matches.length === 0) {
    return (
      <div
        className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground"
        style={{ borderColor: 'var(--admin-rule)' }}
      >
        Add teams and generate fixtures to see the league flow.
      </div>
    )
  }

  const minWidth = 320 + matchdays.length * 240 + 24

  return (
    <div
      className="rounded-xl border bg-card p-6 overflow-x-auto"
      style={{ borderColor: 'var(--admin-rule)' }}
    >
      <div className="flex gap-6 items-start" style={{ minWidth }}>
        <div style={{ width: 320, flexShrink: 0 }}>
          <StandingsCard
            label="League standings"
            played={played}
            total={matches.length}
            standings={standings}
          />
        </div>
        {matchdays.map((md, i) => (
          <MatchdayColumn
            key={md.key}
            index={i + 1}
            label={md.label}
            matches={md.matches}
            onMatchClick={onMatchClick}
          />
        ))}
        {matchdays.length === 0 && teams.length >= 2 && (
          <div className="text-xs italic text-muted-foreground py-6 px-3">
            No matches generated yet. Use the panel above to generate the round-robin schedule.
          </div>
        )}
      </div>
    </div>
  )
}

function StandingsCard({
  label,
  played,
  total,
  standings,
}: {
  label: string
  played: number
  total: number
  standings: MiniStanding[]
}) {
  return (
    <div
      className="rounded-lg border bg-card overflow-hidden"
      style={{ borderColor: 'var(--admin-rule)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          background: 'var(--admin-surface-2)',
          borderBottom: '1px solid var(--admin-rule)',
        }}
      >
        <span
          className="admin-tab"
          style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--admin-lime)' }}
        >
          {label}
        </span>
        <span className="admin-mono text-[10px] text-muted-foreground">
          {played}/{total} played
        </span>
      </div>
      {standings.length === 0 ? (
        <div className="px-3 py-4 text-[11px] italic text-muted-foreground">
          No teams yet.
        </div>
      ) : (
        <table className="w-full text-[11px]">
          <thead>
            <tr
              className="admin-tab text-[9px] tracking-wider"
              style={{
                color: 'var(--muted-foreground)',
                borderBottom: '1px solid var(--admin-rule-soft)',
              }}
            >
              <th className="text-left px-2 py-1.5">#</th>
              <th className="text-left px-2 py-1.5">Team</th>
              <th className="text-right px-1 py-1.5">P</th>
              <th className="text-right px-1 py-1.5">W</th>
              <th className="text-right px-1 py-1.5">D</th>
              <th className="text-right px-1 py-1.5">L</th>
              <th className="text-right px-1 py-1.5">GD</th>
              <th className="text-right px-2 py-1.5">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr
                key={s.team_id}
                style={{
                  borderTop: i > 0 ? '1px solid var(--admin-rule-soft)' : 'none',
                  background: i === 0 ? 'var(--admin-lime-wash)' : 'transparent',
                }}
              >
                <td className="px-2 py-1.5 admin-mono text-muted-foreground">{i + 1}</td>
                <td className="px-2 py-1.5 font-medium truncate">{s.team_name}</td>
                <td className="px-1 py-1.5 text-right admin-mono">{s.played}</td>
                <td className="px-1 py-1.5 text-right admin-mono">{s.wins}</td>
                <td className="px-1 py-1.5 text-right admin-mono">{s.draws}</td>
                <td className="px-1 py-1.5 text-right admin-mono">{s.losses}</td>
                <td className="px-1 py-1.5 text-right admin-mono">
                  {s.gd > 0 ? `+${s.gd}` : s.gd}
                </td>
                <td className="px-2 py-1.5 text-right admin-mono font-bold">{s.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function MatchdayColumn({
  index,
  label,
  matches,
  onMatchClick,
}: {
  index: number
  label: string
  matches: MatchWithTeams[]
  onMatchClick: (m: MatchWithTeams) => void
}) {
  const played = matches.filter((m) => m.status === 'finished').length
  return (
    <div className="flex flex-col" style={{ width: 220, flexShrink: 0 }}>
      <div
        className="admin-tab text-center"
        style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--muted-foreground)',
          marginBottom: 4,
        }}
      >
        DAY {index}
      </div>
      <div
        className="text-center mb-3"
        style={{ fontSize: 10, color: 'var(--muted-foreground)' }}
      >
        {label} · {played}/{matches.length}
      </div>
      <div className="flex flex-col gap-2">
        {matches.map((m) => (
          <MatchdayCard key={m.id} match={m} onMatchClick={onMatchClick} />
        ))}
      </div>
    </div>
  )
}

function MatchdayCard({
  match,
  onMatchClick,
}: {
  match: MatchWithTeams
  onMatchClick: (m: MatchWithTeams) => void
}) {
  const clickable = match.status === 'scheduled'
  const isLive = match.status === 'live' || match.status === 'halftime'
  const isFinished = match.status === 'finished'
  const homeWon = isFinished && match.home_score > match.away_score
  const awayWon = isFinished && match.away_score > match.home_score
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onMatchClick(match)}
      className="rounded-md overflow-hidden bg-card text-left disabled:cursor-default"
      style={{
        border: `1px solid ${isLive ? '#DC2626' : 'var(--admin-rule)'}`,
        boxShadow: isLive ? '0 0 0 3px rgba(220,38,38,0.10)' : 'none',
        cursor: clickable ? 'pointer' : 'default',
      }}
      title={
        clickable
          ? 'Click to reschedule'
          : isFinished
            ? 'Match finished'
            : isLive
              ? 'Match in progress'
              : undefined
      }
    >
      <div
        className="flex items-center justify-between px-2 py-1 text-[10px] text-muted-foreground"
        style={{ background: 'var(--admin-surface-2)' }}
      >
        <span className="admin-mono">{formatClock(match.match_time ?? '')}</span>
        <MatchStatusBadge status={match.status} />
      </div>
      <MatchdayTeamRow
        name={match.home_team.name}
        score={match.status === 'scheduled' ? null : match.home_score}
        winner={homeWon}
        loser={awayWon}
      />
      <div style={{ height: 1, background: 'var(--admin-rule-soft)' }} />
      <MatchdayTeamRow
        name={match.away_team.name}
        score={match.status === 'scheduled' ? null : match.away_score}
        winner={awayWon}
        loser={homeWon}
      />
    </button>
  )
}

function MatchdayTeamRow({
  name,
  score,
  winner,
  loser,
}: {
  name: string
  score: number | null
  winner: boolean
  loser: boolean
}) {
  return (
    <div
      className="grid items-center gap-2 px-2.5 py-1.5"
      style={{
        gridTemplateColumns: '1fr auto',
        background: winner ? 'var(--admin-lime-wash)' : 'transparent',
      }}
    >
      <span
        className="truncate text-xs"
        style={{
          fontWeight: winner ? 700 : 500,
          color: loser ? 'var(--muted-foreground)' : 'var(--foreground)',
        }}
      >
        {name}
      </span>
      <span
        className="admin-mono tabular-nums"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: winner
            ? 'var(--admin-lime)'
            : loser
              ? 'var(--muted-foreground)'
              : 'var(--foreground)',
        }}
      >
        {score == null ? '—' : score}
      </span>
    </div>
  )
}

/* ============================================================
 * Teams list card — sidebar for pure knockout flow
 * ========================================================== */

function TeamsListCard({ teams }: { teams: TeamRef[] }) {
  const ordered = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams])
  return (
    <div
      className="rounded-lg border bg-card overflow-hidden"
      style={{ borderColor: 'var(--admin-rule)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          background: 'var(--admin-surface-2)',
          borderBottom: '1px solid var(--admin-rule)',
        }}
      >
        <span
          className="admin-tab"
          style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--admin-lime)' }}
        >
          Teams
        </span>
        <span className="admin-mono text-[10px] text-muted-foreground">
          {ordered.length} entered
        </span>
      </div>
      <ol className="divide-y" style={{ borderColor: 'var(--admin-rule-soft)' }}>
        {ordered.map((t, i) => (
          <li
            key={t.id}
            className="flex items-center gap-2 px-3 py-2 text-xs"
            style={{
              borderTop: i > 0 ? '1px solid var(--admin-rule-soft)' : 'none',
            }}
          >
            <span className="admin-mono text-[10px] text-muted-foreground w-5 text-right">
              {i + 1}
            </span>
            <span className="font-medium truncate">{t.name}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function nextPowerOfTwoAtLeast(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

/** FIFA-style cross-pool seeding: for each pair of groups (A,B), (C,D)...
 *  generates [1A, 2B, 2A, 1B, 1C, 2D, 2C, 1D, ...]. Falls back to a simple
 *  [1A, 2A, 1B, 2B, ...] pattern when groups can't be paired or advance > 2. */
function buildCrossPoolLabels(groupLabels: string[], advance: number): string[] {
  if (advance === 2 && groupLabels.length % 2 === 0) {
    const labels: string[] = []
    for (let i = 0; i < groupLabels.length; i += 2) {
      const g1 = groupLabels[i]
      const g2 = groupLabels[i + 1]
      labels.push(`1${g1}`, `2${g2}`, `2${g1}`, `1${g2}`)
    }
    return labels
  }
  const labels: string[] = []
  for (const g of groupLabels) {
    for (let pos = 1; pos <= advance; pos++) {
      labels.push(`${pos}${g}`)
    }
  }
  return labels
}

/* ============================================================
 * Groups view — per-group mini standings + matches
 * ========================================================== */

interface MiniStanding {
  team_id: string
  team_name: string
  played: number
  wins: number
  draws: number
  losses: number
  gf: number
  ga: number
  gd: number
  pts: number
}

function computeGroupStandings(
  groupLabel: string,
  teams: TeamRef[],
  matches: MatchWithTeams[],
  pointsWin = 3,
  pointsDraw = 1,
  pointsLoss = 0,
): MiniStanding[] {
  const groupTeams = teams.filter((t) => t.group_label === groupLabel)
  const acc = new Map<string, MiniStanding>()
  for (const t of groupTeams) {
    acc.set(t.id, {
      team_id: t.id,
      team_name: t.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    })
  }
  for (const m of matches) {
    if (m.status !== 'finished') continue
    if (m.phase !== 'group') continue
    if (
      m.home_team.group_label !== groupLabel ||
      m.away_team.group_label !== groupLabel
    )
      continue
    const home = acc.get(m.home_team.id)
    const away = acc.get(m.away_team.id)
    if (!home || !away) continue
    home.played++
    away.played++
    home.gf += m.home_score
    home.ga += m.away_score
    away.gf += m.away_score
    away.ga += m.home_score
    if (m.home_score > m.away_score) {
      home.wins++
      away.losses++
      home.pts += pointsWin
      away.pts += pointsLoss
    } else if (m.home_score < m.away_score) {
      away.wins++
      home.losses++
      away.pts += pointsWin
      home.pts += pointsLoss
    } else {
      home.draws++
      away.draws++
      home.pts += pointsDraw
      away.pts += pointsDraw
    }
  }
  for (const s of acc.values()) s.gd = s.gf - s.ga
  return [...acc.values()].sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team_name.localeCompare(b.team_name),
  )
}

function computeLeagueStandings(
  teams: TeamRef[],
  matches: MatchWithTeams[],
  pointsWin = 3,
  pointsDraw = 1,
  pointsLoss = 0,
): MiniStanding[] {
  const acc = new Map<string, MiniStanding>()
  for (const t of teams) {
    acc.set(t.id, {
      team_id: t.id,
      team_name: t.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    })
  }
  for (const m of matches) {
    if (m.status !== 'finished') continue
    const home = acc.get(m.home_team.id)
    const away = acc.get(m.away_team.id)
    if (!home || !away) continue
    home.played++
    away.played++
    home.gf += m.home_score
    home.ga += m.away_score
    away.gf += m.away_score
    away.ga += m.home_score
    if (m.home_score > m.away_score) {
      home.wins++
      away.losses++
      home.pts += pointsWin
      away.pts += pointsLoss
    } else if (m.home_score < m.away_score) {
      away.wins++
      home.losses++
      away.pts += pointsWin
      home.pts += pointsLoss
    } else {
      home.draws++
      away.draws++
      home.pts += pointsDraw
      away.pts += pointsDraw
    }
  }
  for (const s of acc.values()) s.gd = s.gf - s.ga
  return [...acc.values()].sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team_name.localeCompare(b.team_name),
  )
}

/* ============================================================
 * Group assignment — drag chips between groups
 * ========================================================== */

function GroupAssignment({
  teams,
  groupLabels,
  tournamentId,
}: {
  teams: TeamRef[]
  groupLabels: string[]
  tournamentId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [hoverTarget, setHoverTarget] = useState<string | null>(null)

  const buckets = useMemo(() => {
    const map = new Map<string, TeamRef[]>()
    map.set('__unassigned__', [])
    for (const label of groupLabels) map.set(label, [])
    for (const t of teams) {
      const key =
        t.group_label && groupLabels.includes(t.group_label) ? t.group_label : '__unassigned__'
      map.get(key)!.push(t)
    }
    return map
  }, [teams, groupLabels])

  function assign(teamId: string, label: string | null) {
    startTransition(async () => {
      const r = await setTeamGroupAction(teamId, tournamentId, label)
      if ('error' in r) toast.error(r.error)
      else router.refresh()
    })
  }

  function onChipDragStart(e: React.DragEvent, team: TeamRef) {
    e.dataTransfer.setData('text/team-id', team.id)
    e.dataTransfer.setData('text/team-current-group', team.group_label ?? '')
    e.dataTransfer.effectAllowed = 'move'
  }
  function onBucketDragOver(e: React.DragEvent, label: string) {
    if (!e.dataTransfer.types.includes('text/team-id')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setHoverTarget(label)
  }
  function onBucketDrop(e: React.DragEvent, label: string | null) {
    const teamId = e.dataTransfer.getData('text/team-id')
    if (!teamId) return
    const currentGroup = e.dataTransfer.getData('text/team-current-group') || null
    if (currentGroup === label) {
      setHoverTarget(null)
      return
    }
    e.preventDefault()
    assign(teamId, label)
    setHoverTarget(null)
  }

  const unassigned = buckets.get('__unassigned__') ?? []

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Assign teams to groups</h3>
            <p className="text-xs text-muted-foreground">
              Drag a team chip into a group. Locked once a match goes live.
            </p>
          </div>
          {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {groupLabels.map((label) => {
            const teamsInGroup = buckets.get(label) ?? []
            const isHover = hoverTarget === label
            return (
              <div
                key={label}
                onDragOver={(e) => onBucketDragOver(e, label)}
                onDragLeave={() => setHoverTarget((h) => (h === label ? null : h))}
                onDrop={(e) => onBucketDrop(e, label)}
                className={`rounded-md border bg-white p-3 transition-colors ${
                  isHover ? 'border-emerald-500 bg-emerald-50' : ''
                }`}
                style={{ minHeight: 96 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="admin-tab text-[11px] tracking-wider">Group {label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {teamsInGroup.length} team{teamsInGroup.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {teamsInGroup.length === 0 ? (
                    <span className="text-[11px] italic text-muted-foreground">Drop teams here</span>
                  ) : (
                    teamsInGroup.map((t) => (
                      <DraggableTeamChip
                        key={t.id}
                        team={t}
                        onDragStart={onChipDragStart}
                        onClear={() => assign(t.id, null)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div
          onDragOver={(e) => onBucketDragOver(e, '__unassigned__')}
          onDragLeave={() => setHoverTarget((h) => (h === '__unassigned__' ? null : h))}
          onDrop={(e) => onBucketDrop(e, null)}
          className={`rounded-md border border-dashed bg-slate-50 p-3 transition-colors ${
            hoverTarget === '__unassigned__' ? 'border-emerald-500 bg-emerald-50' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="admin-tab text-[11px] tracking-wider text-muted-foreground">
              Unassigned
            </span>
            <span className="text-[10px] text-muted-foreground">
              {unassigned.length} team{unassigned.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.length === 0 ? (
              <span className="text-[11px] italic text-muted-foreground">
                All teams assigned to a group.
              </span>
            ) : (
              unassigned.map((t) => (
                <DraggableTeamChip key={t.id} team={t} onDragStart={onChipDragStart} />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DraggableTeamChip({
  team,
  onDragStart,
  onClear,
}: {
  team: TeamRef
  onDragStart: (e: React.DragEvent, t: TeamRef) => void
  onClear?: () => void
}) {
  return (
    <span
      draggable
      onDragStart={(e) => onDragStart(e, team)}
      className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs font-medium select-none"
      style={{ cursor: 'grab' }}
      title="Drag to another group"
    >
      <GripVertical className="h-3 w-3 text-muted-foreground" />
      <span className="truncate max-w-[12rem]">{team.name}</span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="ml-0.5 text-muted-foreground hover:text-red-700"
          aria-label={`Remove ${team.name} from group`}
        >
          ×
        </button>
      )}
    </span>
  )
}

export function RescheduleDialog({
  match,
  initialTime,
  tournamentId,
  tournamentStart,
  tournamentEnd,
  onClose,
}: {
  match: MatchWithTeams
  initialTime: string
  tournamentId: string
  tournamentStart: string
  tournamentEnd: string
  onClose: () => void
}) {
  const router = useRouter()
  const [time, setTime] = useState(() => toLocalDatetime(initialTime))
  const [pending, startTransition] = useTransition()

  const minDatetime = `${tournamentStart}T00:00`
  const maxDatetime = `${tournamentEnd}T23:59`

  function submit() {
    startTransition(async () => {
      const r = await rescheduleMatchAction(
        match.id,
        tournamentId,
        new Date(time).toISOString(),
      )
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      toast.success('Fixture rescheduled.')
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Reschedule fixture
          </DialogTitle>
          <DialogDescription>
            Move <span className="font-semibold text-foreground">{match.home_team.name}</span> vs{' '}
            <span className="font-semibold text-foreground">{match.away_team.name}</span> to a new
            kickoff time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rs-time">New kickoff</Label>
          <Input
            id="rs-time"
            type="datetime-local"
            value={time}
            min={minDatetime}
            max={maxDatetime}
            onChange={(e) => setTime(e.target.value)}
            disabled={pending}
          />
          <p className="text-[11px] text-muted-foreground">
            Currently scheduled for {new Date(match.match_time ?? '').toLocaleString()}. Must be within {tournamentStart} – {tournamentEnd}.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !time}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Move fixture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function groupByDay(matches: MatchWithTeams[]) {
  const map = new Map<string, MatchWithTeams[]>()
  for (const m of matches) {
    if (!m.match_time) continue
    const d = new Date(m.match_time)
    const key = d.toISOString().slice(0, 10)
    const arr = map.get(key) ?? []
    arr.push(m)
    map.set(key, arr)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ms]) => ({
      key,
      label: new Date(key).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
      matches: ms.sort(comparePhaseThenTime),
    }))
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

