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
import { Loader2, Wand2, Lock, AlertTriangle, CheckCircle2, Trophy } from 'lucide-react'
import { generateRoundRobin } from '@/lib/round-robin'
import {
  bulkAddMatchesAction,
  seedDirectKnockoutAction,
  seedKnockoutBracketAction,
} from './actions'
import type { MatchWithTeams, TournamentFormat, TournamentStatus } from '@/lib/supabase/types'
import { MatchViews } from '@/components/admin/MatchViews'
import { QualifierSelector } from '@/components/admin/QualifierSelector'

interface TeamRef {
  id: string
  name: string
  group_label: string | null
}

interface Props {
  tournamentId: string
  tournamentStart: string
  tournamentFormat: TournamentFormat
  tournamentStatus: TournamentStatus
  isAdmin: boolean
  teams: TeamRef[]
  matches: MatchWithTeams[]
  canEdit: boolean
  canCreateFixtures: boolean
  canAssignGroups: boolean
  numGroups: number | null
  teamsPerGroup: number | null
  advancePerGroup: number | null
  knockoutQualifiers: string[] | null
  knockoutSlots: number
}

export function FixturesPanel({
  tournamentId,
  tournamentStart,
  tournamentFormat,
  tournamentStatus,
  isAdmin,
  teams,
  matches,
  canEdit,
  canCreateFixtures,
  canAssignGroups,
  numGroups,
  teamsPerGroup,
  advancePerGroup,
  knockoutQualifiers,
  knockoutSlots,
}: Props) {
  return (
    <div className="space-y-5">
      {!canEdit && (
        <div className="rounded-md border bg-amber-50 border-amber-200 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
          <Lock className="h-3 w-3" /> Fixtures are locked — the tournament is finished or archived.
        </div>
      )}

      {canEdit && !canCreateFixtures && (
        <div className="rounded-md border bg-emerald-50 border-emerald-200 px-3 py-2 text-xs text-emerald-900 flex items-center gap-2">
          <Lock className="h-3 w-3" /> Tournament is in progress — fixture generation is locked. You
          can still reschedule scheduled matches.
        </div>
      )}

      {canCreateFixtures && (
        <FormatSetupCard
          tournamentId={tournamentId}
          tournamentStart={tournamentStart}
          tournamentFormat={tournamentFormat}
          teams={teams}
          matches={matches}
          numGroups={numGroups}
          teamsPerGroup={teamsPerGroup}
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Fixtures ({matches.length})
        </h2>
      </div>

      {tournamentFormat === 'round_robin_knockout' && canEdit && knockoutSlots > 0 && (
        <QualifierSelector
          tournamentId={tournamentId}
          slots={knockoutSlots}
          teams={teams}
          savedQualifiers={knockoutQualifiers}
        />
      )}

      <MatchViews
        tournamentId={tournamentId}
        tournamentFormat={tournamentFormat}
        tournamentStatus={tournamentStatus}
        isAdmin={isAdmin}
        canManageFixtures={canEdit}
        canAssignGroups={canAssignGroups}
        numGroups={numGroups}
        advancePerGroup={advancePerGroup}
        teams={teams}
        matches={matches}
      />
    </div>
  )
}

/* ============================================================
 * Format-aware setup
 * ========================================================== */

function isGroupStageMatch(m: MatchWithTeams): boolean {
  const h = m.home_team.group_label
  const a = m.away_team.group_label
  return !!h && !!a && h === a
}

function FormatSetupCard({
  tournamentId,
  tournamentStart,
  tournamentFormat,
  teams,
  matches,
  numGroups,
  teamsPerGroup,
}: {
  tournamentId: string
  tournamentStart: string
  tournamentFormat: TournamentFormat
  teams: TeamRef[]
  matches: MatchWithTeams[]
  numGroups: number | null
  teamsPerGroup: number | null
}) {
  if (tournamentFormat === 'round_robin') {
    if (matches.length > 0) return null
    return <RoundRobinSetup tournamentId={tournamentId} tournamentStart={tournamentStart} teams={teams} />
  }

  if (tournamentFormat === 'round_robin_knockout') {
    const groupMatches = matches.filter(isGroupStageMatch)
    const knockoutExists = matches.some((m) => !isGroupStageMatch(m))
    if (groupMatches.length === 0) {
      return (
        <GroupStageSetup
          tournamentId={tournamentId}
          tournamentStart={tournamentStart}
          teams={teams}
          numGroups={numGroups ?? 4}
          teamsPerGroup={teamsPerGroup}
        />
      )
    }
    const finished = groupMatches.filter((m) => m.status === 'finished').length
    const allFinished = finished === groupMatches.length
    if (!allFinished) {
      return <GroupStageInProgress finished={finished} total={groupMatches.length} />
    }
    if (!knockoutExists) {
      return (
        <KnockoutSeedSetup tournamentId={tournamentId} tournamentStart={tournamentStart} />
      )
    }
    return null
  }

  if (tournamentFormat === 'knockout') {
    if (matches.length === 0) {
      return (
        <KnockoutDirectSetup
          tournamentId={tournamentId}
          tournamentStart={tournamentStart}
          teams={teams}
        />
      )
    }
    return null
  }

  return null
}

function RoundRobinSetup({
  tournamentId,
  tournamentStart,
  teams,
}: {
  tournamentId: string
  tournamentStart: string
  teams: TeamRef[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const rounds = useMemo(() => generateRoundRobin(teams.map((t) => t.id)), [teams])
  const totalMatches = rounds.reduce((n, r) => n + r.length, 0)

  function generate(opts: { kickoff: string; slotLength: number; perDay: number }) {
    const inserts = scheduleRounds(rounds, opts.kickoff, opts.slotLength, opts.perDay)
    startTransition(async () => {
      const r = await bulkAddMatchesAction(tournamentId, inserts)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success(`Generated ${r.created} fixtures.`)
        router.refresh()
        setOpen(false)
      }
    })
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-emerald-600" />
          <h3 className="font-semibold text-sm">Generate round-robin fixtures</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Every team plays every other team.{' '}
          {teams.length < 2
            ? 'Add at least 2 teams to enable.'
            : `${teams.length} teams = ${totalMatches} fixtures.`}
        </p>
        <Button onClick={() => setOpen(true)} disabled={teams.length < 2 || pending}>
          <Wand2 className="h-4 w-4" /> Generate fixtures
        </Button>
      </CardContent>
      {open && (
        <GenerateFixturesDialog
          title="Generate round-robin fixtures"
          summary={`${teams.length} teams × every team = ${totalMatches} fixtures.`}
          warning="After generation you'll be able to reschedule individual fixtures, but not add new ones."
          defaultStart={tournamentStart}
          submitLabel={`Generate ${totalMatches} fixtures`}
          pending={pending}
          onCancel={() => setOpen(false)}
          onSubmit={generate}
        />
      )}
    </Card>
  )
}

function GroupStageSetup({
  tournamentId,
  tournamentStart,
  teams,
  numGroups,
  teamsPerGroup,
}: {
  tournamentId: string
  tournamentStart: string
  teams: TeamRef[]
  numGroups: number
  teamsPerGroup: number | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const validation = useMemo(
    () => validateGroupSetup(teams, numGroups, teamsPerGroup),
    [teams, numGroups, teamsPerGroup],
  )

  const totalMatches = useMemo(() => {
    let n = 0
    for (const ts of validation.teamsByGroup.values()) {
      if (ts.length >= 2) n += (ts.length * (ts.length - 1)) / 2
    }
    return n
  }, [validation.teamsByGroup])

  function generate(opts: { kickoff: string; slotLength: number; perDay: number }) {
    const groupsByLabel = validation.teamsByGroup
    const allRounds: { home: string; away: string }[][] = []
    for (const [, groupTeams] of groupsByLabel) {
      if (groupTeams.length < 2) continue
      const rounds = generateRoundRobin(groupTeams.map((t) => t.id))
      allRounds.push(...rounds)
    }
    const inserts = scheduleRounds(allRounds, opts.kickoff, opts.slotLength, opts.perDay)
    startTransition(async () => {
      const r = await bulkAddMatchesAction(tournamentId, inserts)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success(`Generated ${r.created} group-stage fixtures.`)
        router.refresh()
        setOpen(false)
      }
    })
  }

  const ready = validation.issues.length === 0

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-emerald-600" />
          <h3 className="font-semibold text-sm">Generate group-stage fixtures</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Creates a round-robin within each group. {numGroups} groups
          {teamsPerGroup ? ` × ${teamsPerGroup} teams` : ''}.
          {ready && ` → ${totalMatches} matches.`}
        </p>

        {validation.issues.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5" /> Fix before generating:
            </div>
            <ul className="text-xs text-amber-900 list-disc pl-5 space-y-0.5">
              {validation.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
            <p className="text-[11px] text-amber-800 pt-1">
              Open the <span className="font-semibold">Groups</span> view to assign or move teams.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2 text-xs text-emerald-900">
            <CheckCircle2 className="h-3.5 w-3.5" /> Groups look good. Ready to generate{' '}
            {totalMatches} fixtures.
          </div>
        )}

        <Button onClick={() => setOpen(true)} disabled={!ready || pending}>
          <Wand2 className="h-4 w-4" /> Generate group-stage fixtures
        </Button>
      </CardContent>
      {open && (
        <GenerateFixturesDialog
          title="Generate group-stage fixtures"
          summary={`${totalMatches} matches across ${validation.teamsByGroup.size} groups.`}
          warning="After this, you won't be able to reassign teams to different groups. You can still reschedule individual fixtures."
          defaultStart={tournamentStart}
          submitLabel={`Generate ${totalMatches} fixtures`}
          pending={pending}
          onCancel={() => setOpen(false)}
          onSubmit={generate}
        />
      )}
    </Card>
  )
}

function GroupStageInProgress({ finished, total }: { finished: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((finished / total) * 100)
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-emerald-600 animate-spin" />
          <h3 className="font-semibold text-sm">Group stage in progress</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {finished} of {total} group-stage matches finished ({pct}%). The knockout bracket will
          unlock once all groups conclude.
        </p>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function KnockoutSeedSetup({
  tournamentId,
  tournamentStart,
}: {
  tournamentId: string
  tournamentStart: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function seed(opts: { kickoff: string; slotLength: number; perDay: number }) {
    startTransition(async () => {
      const r = await seedKnockoutBracketAction(tournamentId, opts)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success(`Seeded ${r.created} knockout match${r.created === 1 ? '' : 'es'}.`)
        router.refresh()
        setOpen(false)
      }
    })
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-600" />
          <h3 className="font-semibold text-sm">Seed the knockout bracket</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Group stage is complete. Seed the bracket using current group standings — top finishers
          cross-paired (e.g., 1A v 2B, 2A v 1B).
        </p>
        <Button onClick={() => setOpen(true)} disabled={pending}>
          <Trophy className="h-4 w-4" /> Seed knockout bracket
        </Button>
      </CardContent>
      {open && (
        <GenerateFixturesDialog
          title="Seed knockout bracket"
          summary="Creates the first knockout round from current group standings. Later rounds (semis, final) will fill in as matches finish."
          warning="Bracket matchups are derived from the final group table. They won't update if you revert a finished group match later."
          defaultStart={tournamentStart}
          submitLabel="Seed bracket"
          pending={pending}
          onCancel={() => setOpen(false)}
          onSubmit={seed}
        />
      )}
    </Card>
  )
}

function KnockoutDirectSetup({
  tournamentId,
  tournamentStart,
  teams,
}: {
  tournamentId: string
  tournamentStart: string
  teams: TeamRef[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const n = teams.length
  const isPowerOfTwo = n >= 2 && (n & (n - 1)) === 0
  const firstRoundMatches = isPowerOfTwo ? n / 2 : 0

  function seed(opts: { kickoff: string; slotLength: number; perDay: number }) {
    startTransition(async () => {
      const r = await seedDirectKnockoutAction(tournamentId, opts)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success(`Seeded ${r.created} knockout match${r.created === 1 ? '' : 'es'}.`)
        router.refresh()
        setOpen(false)
      }
    })
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-600" />
          <h3 className="font-semibold text-sm">Seed the knockout bracket</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Pairs teams alphabetically into the first round. You can rearrange matchups by dragging
          team names between fixtures in the Board view.
        </p>

        {n < 2 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2 text-xs text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" /> Add at least 2 teams to seed the bracket.
          </div>
        ) : !isPowerOfTwo ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2 text-xs text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" />
            Knockout needs a power-of-2 team count (2, 4, 8, 16…). You have {n} teams.
          </div>
        ) : (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2 text-xs text-emerald-900">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ready to seed {n} teams →{' '}
            {firstRoundMatches} first-round match{firstRoundMatches === 1 ? '' : 'es'}.
          </div>
        )}

        <Button onClick={() => setOpen(true)} disabled={!isPowerOfTwo || pending}>
          <Trophy className="h-4 w-4" /> Seed knockout bracket
        </Button>
      </CardContent>
      {open && (
        <GenerateFixturesDialog
          title="Seed knockout bracket"
          summary={`Creates ${firstRoundMatches} first-round match${firstRoundMatches === 1 ? '' : 'es'} from your ${n} teams (alphabetical pairing). Later rounds fill in as matches finish.`}
          warning="Once a match goes live, fixture generation is locked. You can still reschedule scheduled matches or swap teams between fixtures."
          defaultStart={tournamentStart}
          submitLabel="Seed bracket"
          pending={pending}
          onCancel={() => setOpen(false)}
          onSubmit={seed}
        />
      )}
    </Card>
  )
}

/* ============================================================
 * Shared modal + scheduling helpers
 * ========================================================== */

function GenerateFixturesDialog({
  title,
  summary,
  warning,
  defaultStart,
  submitLabel,
  pending,
  onCancel,
  onSubmit,
}: {
  title: string
  summary: string
  warning: string
  defaultStart: string
  submitLabel: string
  pending: boolean
  onCancel: () => void
  onSubmit: (opts: { kickoff: string; slotLength: number; perDay: number }) => void
}) {
  const [kickoff, setKickoff] = useState(() => `${defaultStart}T15:00`)
  const [slotLength, setSlotLength] = useState(90)
  const [perDay, setPerDay] = useState(4)

  return (
    <Dialog open onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gen-kickoff" className="text-xs">First kickoff</Label>
            <Input
              id="gen-kickoff"
              type="datetime-local"
              value={kickoff}
              onChange={(e) => setKickoff(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="gen-slot" className="text-xs">Slot length (min)</Label>
              <Input
                id="gen-slot"
                type="number"
                min={30}
                max={240}
                value={slotLength}
                onChange={(e) => setSlotLength(Number(e.target.value))}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gen-perday" className="text-xs">Matches per day</Label>
              <Input
                id="gen-perday"
                type="number"
                min={1}
                max={20}
                value={perDay}
                onChange={(e) => setPerDay(Number(e.target.value))}
                disabled={pending}
              />
            </div>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 flex gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{warning}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ kickoff, slotLength, perDay })}
            disabled={pending || !kickoff || slotLength < 1 || perDay < 1}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ValidationResult {
  issues: string[]
  teamsByGroup: Map<string, TeamRef[]>
}

function validateGroupSetup(
  teams: TeamRef[],
  numGroups: number,
  teamsPerGroup: number | null,
): ValidationResult {
  const expectedLabels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))
  const byGroup = new Map<string, TeamRef[]>()
  for (const l of expectedLabels) byGroup.set(l, [])
  const unassigned: TeamRef[] = []
  for (const t of teams) {
    if (t.group_label && expectedLabels.includes(t.group_label)) {
      byGroup.get(t.group_label)!.push(t)
    } else {
      unassigned.push(t)
    }
  }

  const issues: string[] = []
  if (unassigned.length > 0) {
    const names = unassigned.slice(0, 3).map((t) => t.name).join(', ')
    const more = unassigned.length > 3 ? ` +${unassigned.length - 3} more` : ''
    issues.push(`${unassigned.length} team${unassigned.length === 1 ? '' : 's'} unassigned: ${names}${more}.`)
  }
  for (const label of expectedLabels) {
    const ts = byGroup.get(label)!
    if (ts.length === 0) {
      issues.push(`Group ${label} is empty.`)
    } else if (ts.length < 2) {
      issues.push(`Group ${label} needs at least 2 teams (currently 1).`)
    } else if (teamsPerGroup != null && ts.length !== teamsPerGroup) {
      issues.push(
        `Group ${label} has ${ts.length} teams, expected ${teamsPerGroup}.`,
      )
    }
  }
  return { issues, teamsByGroup: byGroup }
}

function scheduleRounds(
  rounds: { home: string; away: string }[][],
  kickoff: string,
  slotLength: number,
  perDay: number,
): { home_team_id: string; away_team_id: string; match_time: string }[] {
  const start = new Date(kickoff)
  const inserts: { home_team_id: string; away_team_id: string; match_time: string }[] = []
  let dayIndex = 0
  let slotIndex = 0
  for (const round of rounds) {
    for (const m of round) {
      const t = new Date(start)
      t.setDate(t.getDate() + dayIndex)
      t.setMinutes(t.getMinutes() + slotLength * slotIndex)
      inserts.push({
        home_team_id: m.home,
        away_team_id: m.away,
        match_time: t.toISOString(),
      })
      slotIndex++
      if (slotIndex >= perDay) {
        slotIndex = 0
        dayIndex++
      }
    }
  }
  return inserts
}
