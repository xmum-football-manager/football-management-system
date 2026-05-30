'use client'

import { Lock } from 'lucide-react'
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
  tournamentEnd: string
  tournamentFormat: TournamentFormat
  tournamentStatus: TournamentStatus
  isAdmin: boolean
  teams: TeamRef[]
  matches: MatchWithTeams[]
  canEdit: boolean
  canAssignGroups: boolean
  numGroups: number | null
  advancePerGroup: number | null
  knockoutQualifiers: string[] | null
  knockoutSlots: number
}

export function FixturesPanel({
  tournamentId,
  tournamentStart,
  tournamentEnd,
  tournamentFormat,
  tournamentStatus,
  isAdmin,
  teams,
  matches,
  canEdit,
  canAssignGroups,
  numGroups,
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

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Fixtures ({matches.length})
        </h2>
      </div>

      {tournamentFormat === 'round_robin_knockout' && canEdit && knockoutSlots > 0 && knockoutSlots % 2 === 0 && (
        <QualifierSelector
          tournamentId={tournamentId}
          slots={knockoutSlots}
          teams={teams}
          savedQualifiers={knockoutQualifiers}
        />
      )}

      <MatchViews
        tournamentId={tournamentId}
        tournamentStart={tournamentStart}
        tournamentEnd={tournamentEnd}
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
