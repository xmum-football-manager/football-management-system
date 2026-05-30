'use client'

import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { setTeamGroupAction } from '../teams/actions'

interface TeamData {
  id: string
  name: string
  group_label: string | null
}

interface Props {
  tournamentId: string
  initialTeams: TeamData[]
  numGroups: number
  teamsPerGroup: number | null
  canEdit: boolean
}

export function RDGroupsPanel({ tournamentId, initialTeams, numGroups, teamsPerGroup, canEdit }: Props) {
  const [pending, startTransition] = useTransition()
  const [teams, setTeams] = useState<TeamData[]>(initialTeams)

  const groupLabels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))

  const unassigned = teams.filter(t => !t.group_label || !groupLabels.includes(t.group_label))
  const byGroup = new Map<string, TeamData[]>()
  for (const l of groupLabels) byGroup.set(l, [])
  for (const t of teams) {
    if (t.group_label && groupLabels.includes(t.group_label)) {
      byGroup.get(t.group_label)!.push(t)
    }
  }

  const groupsFull = teamsPerGroup != null
    ? groupLabels.every(l => (byGroup.get(l)?.length ?? 0) === teamsPerGroup)
    : unassigned.length === 0

  function assign(teamId: string, label: string | null) {
    const prev = teams
    setTeams(t => t.map(t => t.id === teamId ? { ...t, group_label: label } : t))
    startTransition(async () => {
      const r = await setTeamGroupAction(teamId, tournamentId, label)
      if ('error' in r) {
        toast.error(r.error)
        setTeams(prev)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {groupsFull ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center gap-2 text-xs text-emerald-900">
          <CheckCircle2 className="h-3.5 w-3.5" />
          All groups complete — RD-Fixtures is now unlocked.
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2 text-xs text-amber-900">
          <AlertCircle className="h-3.5 w-3.5" />
          {teamsPerGroup != null
            ? `Each group needs exactly ${teamsPerGroup} teams. Assign all teams to unlock RD-Fixtures.`
            : 'Assign all teams to a group to unlock RD-Fixtures.'}
        </div>
      )}

      {/* Unassigned pool */}
      {(unassigned.length > 0) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Unassigned</span>
              <Badge variant="secondary">{unassigned.length}</Badge>
            </div>
            {unassigned.length === 0 && (
              <p className="text-xs text-muted-foreground">All teams assigned.</p>
            )}
            {unassigned.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <span className="text-sm">{t.name}</span>
                {canEdit && (
                  <Select
                    value=""
                    onValueChange={label => assign(t.id, label)}
                    disabled={pending}
                  >
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue placeholder="Assign…" />
                    </SelectTrigger>
                    <SelectContent>
                      {groupLabels.map(l => (
                        <SelectItem key={l} value={l}>Group {l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Group cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groupLabels.map(label => {
          const groupTeams = byGroup.get(label) ?? []
          const full = teamsPerGroup != null && groupTeams.length === teamsPerGroup
          const over = teamsPerGroup != null && groupTeams.length > teamsPerGroup
          return (
            <Card key={label}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Group {label}</span>
                  <Badge
                    variant="secondary"
                    className={
                      over ? 'bg-red-100 text-red-800'
                      : full ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                    }
                  >
                    {teamsPerGroup != null ? `${groupTeams.length}/${teamsPerGroup}` : groupTeams.length}
                  </Badge>
                </div>
                {groupTeams.length === 0 && (
                  <p className="text-xs text-muted-foreground">No teams yet.</p>
                )}
                {groupTeams.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm">{t.name}</span>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={pending}
                        onClick={() => assign(t.id, null)}
                        aria-label={`Remove ${t.name} from group`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
