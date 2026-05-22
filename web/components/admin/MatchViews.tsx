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
import { Loader2, GripVertical, CalendarClock } from 'lucide-react'
import { MatchStatusBadge } from '@/components/admin/MatchStatusBadge'
import { MatchStateStepper } from '@/components/admin/MatchStateStepper'
import { AdminBracketView, type BracketGroupColumn } from '@/components/admin/AdminBracketView'
import { MatchRow } from '@/app/admin/tournaments/[id]/MatchRow'
import {
  rescheduleMatchAction,
  swapTeamSlotsAction,
} from '@/app/admin/tournaments/[id]/fixtures/actions'
import { setTeamGroupAction } from '@/app/admin/tournaments/[id]/teams/actions'
import { usePersistedView } from '@/lib/hooks/use-persisted-view'
import { formatClock } from '@/lib/format'
import type {
  MatchStatus,
  MatchWithTeams,
  TournamentFormat,
  TournamentStatus,
} from '@/lib/supabase/types'

type TeamRef = { id: string; name: string; group_label: string | null }

type ViewKey = 'list' | 'board' | 'structure'
const VIEW_STORAGE_KEY = 'admin-matches-view'

interface MatchViewsProps {
  tournamentId: string
  tournamentFormat: TournamentFormat
  tournamentStatus: TournamentStatus
  isAdmin: boolean
  canManageFixtures: boolean
  canAssignGroups?: boolean
  numGroups?: number | null
  advancePerGroup?: number | null
  teams: TeamRef[]
  matches: MatchWithTeams[]
}

export function MatchViews({
  tournamentId,
  tournamentFormat,
  tournamentStatus,
  isAdmin,
  canManageFixtures,
  canAssignGroups = false,
  numGroups,
  advancePerGroup,
  teams,
  matches,
}: MatchViewsProps) {
  const supportsStructure =
    tournamentFormat === 'knockout' ||
    tournamentFormat === 'round_robin_knockout' ||
    tournamentFormat === 'round_robin'
  const allowed = useMemo<readonly ViewKey[]>(() => {
    const base: ViewKey[] = ['board', 'list']
    if (supportsStructure) base.push('structure')
    return base
  }, [supportsStructure])
  const initialDefault: ViewKey = supportsStructure ? 'structure' : 'board'

  const [view, setView] = usePersistedView<ViewKey>(VIEW_STORAGE_KEY, initialDefault, allowed)
  const effectiveView = allowed.includes(view) ? view : initialDefault

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-md border bg-white p-0.5 text-xs">
          {supportsStructure && (
            <ViewTab
              label="Structure"
              active={effectiveView === 'structure'}
              onClick={() => setView('structure')}
            />
          )}
          <ViewTab label="Board" active={effectiveView === 'board'} onClick={() => setView('board')} />
          <ViewTab label="List" active={effectiveView === 'list'} onClick={() => setView('list')} />
        </div>
      </div>

      {effectiveView === 'structure' ? (
        <StructureView
          format={tournamentFormat}
          teams={teams}
          matches={matches}
          tournamentId={tournamentId}
          canAssignGroups={canAssignGroups}
          numGroups={numGroups ?? null}
          advancePerGroup={advancePerGroup ?? null}
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
      ) : effectiveView === 'board' ? (
        <BoardView
          matches={matches}
          canEdit={canManageFixtures}
          tournamentId={tournamentId}
        />
      ) : (
        <ListView matches={matches} tournamentStatus={tournamentStatus} isAdmin={isAdmin} />
      )}
    </div>
  )
}

function ViewTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded ${
        active ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )
}

/* ============================================================
 * Match phase helpers
 * ========================================================== */

function isGroupStageMatch(m: MatchWithTeams): boolean {
  const h = m.home_team.group_label
  const a = m.away_team.group_label
  return !!h && !!a && h === a
}

function knockoutMatches(matches: MatchWithTeams[]): MatchWithTeams[] {
  return matches.filter((m) => !isGroupStageMatch(m))
}

/* ============================================================
 * List view — MatchRow grid (admin transitions live here)
 * ========================================================== */

function ListView({
  matches,
  tournamentStatus,
  isAdmin,
}: {
  matches: MatchWithTeams[]
  tournamentStatus: TournamentStatus
  isAdmin: boolean
}) {
  return (
    <ul
      className="overflow-hidden rounded-xl border bg-card"
      style={{ borderColor: 'var(--admin-rule)' }}
    >
      {matches.map((m, i) => (
        <li
          key={m.id}
          style={{ borderTop: i > 0 ? '1px solid var(--admin-rule-soft)' : 'none' }}
        >
          <MatchRow match={m} tournamentStatus={tournamentStatus} isAdmin={isAdmin} />
        </li>
      ))}
    </ul>
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
}: {
  format: TournamentFormat
  teams: TeamRef[]
  matches: MatchWithTeams[]
  tournamentId: string
  canAssignGroups: boolean
  numGroups: number | null
  advancePerGroup: number | null
}) {
  const ko = useMemo(() => knockoutMatches(matches), [matches])
  const [reschedulingMatch, setReschedulingMatch] = useState<MatchWithTeams | null>(null)

  function handleMatchClick(m: MatchWithTeams) {
    if (m.status !== 'scheduled') return
    setReschedulingMatch(m)
  }

  if (format === 'round_robin') {
    return (
      <LeagueStandingsTable
        teams={teams}
        matches={matches}
        title="League standings"
      />
    )
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
          onMatchClick={handleMatchClick}
        />
        {reschedulingMatch && (
          <RescheduleDialog
            match={reschedulingMatch}
            initialTime={reschedulingMatch.match_time}
            tournamentId={tournamentId}
            onClose={() => setReschedulingMatch(null)}
          />
        )}
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
    const standings = computeGroupStandings(label, teams, matches).map((s) => ({
      team_id: s.team_id,
      team_name: s.team_name,
      pts: s.pts,
      gd: s.gd,
    }))
    const groupMatches = matches
      .filter(
        (m) => m.home_team.group_label === label && m.away_team.group_label === label,
      )
      .sort((a, b) => a.match_time.localeCompare(b.match_time))
    return { label, standings, matches: groupMatches }
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
          <h3 className="admin-eyebrow">Group standings</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groupLabels.map((label) => (
            <GroupDetailCard
              key={label}
              groupLabel={label}
              teams={teams}
              matches={matches}
              onMatchClick={handleMatchClick}
            />
          ))}
        </div>
      </section>

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
          onMatchClick={handleMatchClick}
        />
      </section>

      {reschedulingMatch && (
        <RescheduleDialog
          match={reschedulingMatch}
          initialTime={reschedulingMatch.match_time}
          tournamentId={tournamentId}
          onClose={() => setReschedulingMatch(null)}
        />
      )}
    </div>
  )
}

function LeagueStandingsTable({
  teams,
  matches,
  title,
}: {
  teams: TeamRef[]
  matches: MatchWithTeams[]
  title: string
}) {
  const standings = useMemo(() => {
    // Treat the whole tournament as one "group" for round-robin standings.
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
        home.pts += 3
      } else if (m.home_score < m.away_score) {
        away.wins++
        home.losses++
        away.pts += 3
      } else {
        home.draws++
        away.draws++
        home.pts += 1
        away.pts += 1
      }
    }
    for (const s of acc.values()) s.gd = s.gf - s.ga
    return [...acc.values()].sort(
      (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team_name.localeCompare(b.team_name),
    )
  }, [teams, matches])

  if (standings.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Add teams to see the league table.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="text-[11px] text-muted-foreground">
            {standings.length} team{standings.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="overflow-hidden rounded-md border" style={{ borderColor: 'var(--admin-rule)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr
                className="admin-tab text-[10px] tracking-wider"
                style={{ background: 'var(--admin-surface-2)', color: 'var(--muted-foreground)' }}
              >
                <th className="text-left px-2 py-1.5">#</th>
                <th className="text-left px-2 py-1.5">Team</th>
                <th className="text-right px-1.5 py-1.5">P</th>
                <th className="text-right px-1.5 py-1.5">W</th>
                <th className="text-right px-1.5 py-1.5">D</th>
                <th className="text-right px-1.5 py-1.5">L</th>
                <th className="text-right px-1.5 py-1.5">GF</th>
                <th className="text-right px-1.5 py-1.5">GA</th>
                <th className="text-right px-1.5 py-1.5">GD</th>
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
                  <td className="px-1.5 py-1.5 text-right admin-mono">{s.played}</td>
                  <td className="px-1.5 py-1.5 text-right admin-mono">{s.wins}</td>
                  <td className="px-1.5 py-1.5 text-right admin-mono">{s.draws}</td>
                  <td className="px-1.5 py-1.5 text-right admin-mono">{s.losses}</td>
                  <td className="px-1.5 py-1.5 text-right admin-mono">{s.gf}</td>
                  <td className="px-1.5 py-1.5 text-right admin-mono">{s.ga}</td>
                  <td className="px-1.5 py-1.5 text-right admin-mono">
                    {s.gd > 0 ? `+${s.gd}` : s.gd}
                  </td>
                  <td className="px-2 py-1.5 text-right admin-mono font-bold">{s.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
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

/* ============================================================
 * Group detail card — full standings + clickable matches
 * ========================================================== */

function GroupDetailCard({
  groupLabel,
  teams,
  matches,
  onMatchClick,
}: {
  groupLabel: string
  teams: TeamRef[]
  matches: MatchWithTeams[]
  onMatchClick?: (m: MatchWithTeams) => void
}) {
  const standings = useMemo(
    () => computeGroupStandings(groupLabel, teams, matches),
    [groupLabel, teams, matches],
  )
  const groupMatches = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.home_team.group_label === groupLabel && m.away_team.group_label === groupLabel,
        )
        .sort((a, b) => a.match_time.localeCompare(b.match_time)),
    [groupLabel, matches],
  )
  const totalToPlay = (standings.length * (standings.length - 1)) / 2
  const played = groupMatches.filter((m) => m.status === 'finished').length

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span
            className="admin-display inline-flex h-8 w-8 items-center justify-center rounded-full text-sm"
            style={{
              background: 'var(--admin-lime-wash)',
              color: 'var(--admin-lime)',
              border: '1px solid color-mix(in srgb, var(--admin-lime) 35%, transparent)',
            }}
          >
            {groupLabel}
          </span>
          <div className="flex-1">
            <div className="font-semibold text-sm">Group {groupLabel}</div>
            <div className="text-[11px] text-muted-foreground">
              {standings.length} team{standings.length === 1 ? '' : 's'} · {played}/
              {totalToPlay || 0} played
            </div>
          </div>
        </div>

        {standings.length === 0 ? (
          <p className="text-xs italic text-muted-foreground py-3">No teams assigned.</p>
        ) : (
          <div
            className="overflow-hidden rounded-md border"
            style={{ borderColor: 'var(--admin-rule)' }}
          >
            <table className="w-full text-xs">
              <thead>
                <tr
                  className="admin-tab text-[10px] tracking-wider"
                  style={{ background: 'var(--admin-surface-2)', color: 'var(--muted-foreground)' }}
                >
                  <th className="text-left px-2 py-1.5">#</th>
                  <th className="text-left px-2 py-1.5">Team</th>
                  <th className="text-right px-1.5 py-1.5">P</th>
                  <th className="text-right px-1.5 py-1.5">W</th>
                  <th className="text-right px-1.5 py-1.5">D</th>
                  <th className="text-right px-1.5 py-1.5">L</th>
                  <th className="text-right px-1.5 py-1.5">GD</th>
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
                    <td className="px-1.5 py-1.5 text-right admin-mono">{s.played}</td>
                    <td className="px-1.5 py-1.5 text-right admin-mono">{s.wins}</td>
                    <td className="px-1.5 py-1.5 text-right admin-mono">{s.draws}</td>
                    <td className="px-1.5 py-1.5 text-right admin-mono">{s.losses}</td>
                    <td className="px-1.5 py-1.5 text-right admin-mono">
                      {s.gd > 0 ? `+${s.gd}` : s.gd}
                    </td>
                    <td className="px-2 py-1.5 text-right admin-mono font-bold">{s.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {groupMatches.length > 0 && (
          <div className="space-y-1.5">
            <div className="admin-eyebrow">Matches</div>
            <div className="space-y-1">
              {groupMatches.map((m) => (
                <GroupDetailMatchRow key={m.id} match={m} onMatchClick={onMatchClick} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GroupDetailMatchRow({
  match,
  onMatchClick,
}: {
  match: MatchWithTeams
  onMatchClick?: (m: MatchWithTeams) => void
}) {
  const clickable = match.status === 'scheduled' && !!onMatchClick
  const isScheduled = match.status === 'scheduled'
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onMatchClick?.(match)}
      className="grid items-center gap-2 rounded-md border px-3 py-1.5 text-xs w-full text-left disabled:cursor-default hover:enabled:bg-accent/40 transition-colors"
      style={{
        borderColor: 'var(--admin-rule-soft)',
        gridTemplateColumns: '70px 1fr 64px 1fr auto',
        cursor: clickable ? 'pointer' : 'default',
      }}
      title={clickable ? 'Click to reschedule' : undefined}
    >
      <span className="admin-mono text-muted-foreground">{formatClock(match.match_time)}</span>
      <span className="text-right truncate font-medium">{match.home_team.name}</span>
      <span
        className="admin-mono tabular-nums text-center font-bold rounded px-2 py-0.5"
        style={{ background: 'var(--admin-surface-2)' }}
      >
        {isScheduled ? '— : —' : `${match.home_score} : ${match.away_score}`}
      </span>
      <span className="text-left truncate font-medium">{match.away_team.name}</span>
      <MatchStateStepper status={match.status} />
    </button>
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

/* ============================================================
 * Board view — drag-to-reschedule + drag-to-swap-teams
 * ========================================================== */

function BoardView({
  matches,
  canEdit,
  tournamentId,
}: {
  matches: MatchWithTeams[]
  canEdit: boolean
  tournamentId: string
}) {
  const byDay = useMemo(() => groupByDay(matches), [matches])
  const [reschedule, setReschedule] = useState<{
    match: MatchWithTeams
    targetTime: string
  } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [draggingSlot, setDraggingSlot] = useState<{
    matchId: string
    slot: 'home' | 'away'
  } | null>(null)
  const [swap, setSwap] = useState<{
    source: { matchId: string; slot: 'home' | 'away'; teamName: string }
    target: { matchId: string; slot: 'home' | 'away'; teamName: string }
  } | null>(null)

  function onCardDragStart(e: React.DragEvent, m: MatchWithTeams) {
    if (!canEdit || m.status !== 'scheduled') return
    e.dataTransfer.setData('text/match-id', m.id)
    e.dataTransfer.effectAllowed = 'move'
    setDragId(m.id)
  }
  function onCardDragEnd() {
    setDragId(null)
  }
  function onCardDragOver(e: React.DragEvent, target: MatchWithTeams) {
    if (!canEdit) return
    const sourceId = e.dataTransfer.types.includes('text/match-id') ? dragId : null
    if (!sourceId || sourceId === target.id) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  function onCardDrop(e: React.DragEvent, target: MatchWithTeams) {
    if (!canEdit) return
    const sourceId = e.dataTransfer.getData('text/match-id')
    if (!sourceId || sourceId === target.id) return
    e.preventDefault()
    const source = matches.find((x) => x.id === sourceId)
    if (!source) return
    setReschedule({ match: source, targetTime: target.match_time })
    setDragId(null)
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <GripVertical className="h-3 w-3" />
            Drag a fixture card onto another → reschedule.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GripVertical className="h-3 w-3" />
            Drag a team name onto another → swap teams.
          </span>
        </p>
      )}
      {byDay.map((day) => (
        <div key={day.key}>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {day.label}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {day.matches.map((m) => {
              const draggable = canEdit && m.status === 'scheduled'
              const isDragging = dragId === m.id
              return (
                <Card
                  key={m.id}
                  className={`overflow-hidden transition-shadow ${isDragging ? 'opacity-50' : ''}`}
                  draggable={draggable}
                  onDragStart={(e) => onCardDragStart(e, m)}
                  onDragEnd={onCardDragEnd}
                  onDragOver={(e) => onCardDragOver(e, m)}
                  onDrop={(e) => onCardDrop(e, m)}
                  style={{ cursor: draggable ? 'grab' : 'default' }}
                >
                  <div
                    className={
                      m.status === 'live'
                        ? 'h-1 w-full bg-emerald-500'
                        : m.status === 'halftime'
                          ? 'h-1 w-full bg-amber-400'
                          : m.status === 'finished'
                            ? 'h-1 w-full bg-slate-400'
                            : 'h-1 w-full bg-transparent'
                    }
                  />
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      {draggable && <GripVertical className="h-3 w-3 opacity-60" />}
                      <span className="font-mono">{formatClock(m.match_time)}</span>
                      {m.home_team.group_label && m.home_team.group_label === m.away_team.group_label && (
                        <span
                          className="admin-tab rounded-full px-1.5 py-0.5 text-[9px]"
                          style={{
                            background: 'var(--admin-lime-wash)',
                            color: 'var(--admin-lime)',
                          }}
                        >
                          GROUP {m.home_team.group_label}
                        </span>
                      )}
                      <span className="flex-1" />
                      <MatchStatusBadge status={m.status} />
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <TeamSlot
                        match={m}
                        slot="home"
                        canEdit={canEdit}
                        align="right"
                        draggingSlot={draggingSlot}
                        setDraggingSlot={setDraggingSlot}
                        onSwap={setSwap}
                      />
                      <div className="px-2 py-1 bg-slate-100 rounded font-mono font-bold text-sm tabular-nums">
                        {m.home_score} : {m.away_score}
                      </div>
                      <TeamSlot
                        match={m}
                        slot="away"
                        canEdit={canEdit}
                        align="left"
                        draggingSlot={draggingSlot}
                        setDraggingSlot={setDraggingSlot}
                        onSwap={setSwap}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
      {reschedule && (
        <RescheduleDialog
          match={reschedule.match}
          initialTime={reschedule.targetTime}
          tournamentId={tournamentId}
          onClose={() => setReschedule(null)}
        />
      )}
      {swap && (
        <SwapTeamsDialog
          tournamentId={tournamentId}
          source={swap.source}
          target={swap.target}
          onClose={() => setSwap(null)}
        />
      )}
    </div>
  )
}

function TeamSlot({
  match,
  slot,
  canEdit,
  align,
  draggingSlot,
  setDraggingSlot,
  onSwap,
}: {
  match: MatchWithTeams
  slot: 'home' | 'away'
  canEdit: boolean
  align: 'left' | 'right'
  draggingSlot: { matchId: string; slot: 'home' | 'away' } | null
  setDraggingSlot: (s: { matchId: string; slot: 'home' | 'away' } | null) => void
  onSwap: (s: {
    source: { matchId: string; slot: 'home' | 'away'; teamName: string }
    target: { matchId: string; slot: 'home' | 'away'; teamName: string }
  }) => void
}) {
  const team = slot === 'home' ? match.home_team : match.away_team
  const draggable = canEdit && match.status === 'scheduled'
  const isSelf = draggingSlot?.matchId === match.id && draggingSlot.slot === slot
  const isHotDropTarget =
    !!draggingSlot && !isSelf && canEdit && match.status === 'scheduled'

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return
        e.stopPropagation()
        e.dataTransfer.setData('text/team-slot', `${match.id}:${slot}`)
        e.dataTransfer.setData('text/team-name', team.name)
        e.dataTransfer.effectAllowed = 'move'
        setDraggingSlot({ matchId: match.id, slot })
      }}
      onDragEnd={(e) => {
        e.stopPropagation()
        setDraggingSlot(null)
      }}
      onDragOver={(e) => {
        if (!isHotDropTarget) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => {
        e.stopPropagation()
        const raw = e.dataTransfer.getData('text/team-slot')
        if (!raw) return
        const [srcMatchId, srcSlotRaw] = raw.split(':')
        if (srcSlotRaw !== 'home' && srcSlotRaw !== 'away') return
        if (srcMatchId === match.id && srcSlotRaw === slot) return
        e.preventDefault()
        const sourceTeamName = e.dataTransfer.getData('text/team-name') || 'Other team'
        onSwap({
          source: { matchId: srcMatchId, slot: srcSlotRaw, teamName: sourceTeamName },
          target: { matchId: match.id, slot, teamName: team.name },
        })
        setDraggingSlot(null)
      }}
      className={`truncate font-medium text-sm select-none ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${isHotDropTarget ? 'rounded outline outline-2 outline-dashed outline-emerald-400 outline-offset-2' : ''} ${
        isSelf ? 'opacity-40' : ''
      }`}
      style={{ cursor: draggable ? 'grab' : 'default' }}
      title={draggable ? 'Drag onto another team to swap' : undefined}
    >
      {team.name}
    </div>
  )
}

function RescheduleDialog({
  match,
  initialTime,
  tournamentId,
  onClose,
}: {
  match: MatchWithTeams
  initialTime: string
  tournamentId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [time, setTime] = useState(() => toLocalDatetime(initialTime))
  const [pending, startTransition] = useTransition()

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
            onChange={(e) => setTime(e.target.value)}
            disabled={pending}
          />
          <p className="text-[11px] text-muted-foreground">
            Currently scheduled for {new Date(match.match_time).toLocaleString()}.
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

function SwapTeamsDialog({
  tournamentId,
  source,
  target,
  onClose,
}: {
  tournamentId: string
  source: { matchId: string; slot: 'home' | 'away'; teamName: string }
  target: { matchId: string; slot: 'home' | 'away'; teamName: string }
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const sameMatch = source.matchId === target.matchId

  function submit() {
    startTransition(async () => {
      const r = await swapTeamSlotsAction(
        tournamentId,
        { matchId: source.matchId, slot: source.slot },
        { matchId: target.matchId, slot: target.slot },
      )
      if ('error' in r) {
        toast.error(r.error)
        return
      }
      toast.success(sameMatch ? 'Sides swapped.' : 'Teams swapped.')
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Swap teams</DialogTitle>
          <DialogDescription>
            {sameMatch ? (
              <>
                Swap <span className="font-semibold text-foreground">{source.teamName}</span> (
                {source.slot}) and{' '}
                <span className="font-semibold text-foreground">{target.teamName}</span> (
                {target.slot}) in the same fixture?
              </>
            ) : (
              <>
                Move <span className="font-semibold text-foreground">{source.teamName}</span> into
                the other fixture and{' '}
                <span className="font-semibold text-foreground">{target.teamName}</span> into this
                one. Both fixtures must be scheduled.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Swap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function groupByDay(matches: MatchWithTeams[]) {
  const map = new Map<string, MatchWithTeams[]>()
  for (const m of matches) {
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
      matches: ms.sort((a, b) => a.match_time.localeCompare(b.match_time)),
    }))
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

