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
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, GripVertical, X } from 'lucide-react'
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
  const [hoverTarget, setHoverTarget] = useState<string | null>(null)

  const groupLabels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))

  const effectiveGroup = (t: TeamData) =>
    t.group_label && groupLabels.includes(t.group_label) ? t.group_label : null

  const unassigned = teams.filter(t => effectiveGroup(t) === null)
  const byGroup = new Map<string, TeamData[]>()
  for (const l of groupLabels) byGroup.set(l, [])
  for (const t of teams) {
    const g = effectiveGroup(t)
    if (g) byGroup.get(g)!.push(t)
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

  function onTeamDragStart(e: React.DragEvent, team: TeamData) {
    e.dataTransfer.setData('text/team-id', team.id)
    e.dataTransfer.setData('text/team-current-group', effectiveGroup(team) ?? '')
    e.dataTransfer.effectAllowed = 'move'
  }

  function onZoneDragOver(e: React.DragEvent, key: string) {
    if (!e.dataTransfer.types.includes('text/team-id')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setHoverTarget(h => (h === key ? h : key))
  }

  function onZoneDrop(e: React.DragEvent, label: string | null) {
    e.preventDefault()
    setHoverTarget(null)
    const teamId = e.dataTransfer.getData('text/team-id')
    if (!teamId) return
    const currentGroup = e.dataTransfer.getData('text/team-current-group') || null
    if (currentGroup === label) return
    assign(teamId, label)
  }

  const dropZoneProps = (key: string, label: string | null) =>
    canEdit
      ? {
          onDragOver: (e: React.DragEvent) => onZoneDragOver(e, key),
          onDragLeave: () => setHoverTarget(h => (h === key ? null : h)),
          onDrop: (e: React.DragEvent) => onZoneDrop(e, label),
        }
      : {}

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
      {(canEdit || unassigned.length > 0) && (
        <Card
          {...dropZoneProps('__unassigned__', null)}
          className={`transition-colors ${canEdit ? 'border-dashed' : ''} ${
            hoverTarget === '__unassigned__' ? 'border-emerald-500 bg-emerald-50' : ''
          }`}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Unassigned</span>
              <Badge variant="secondary">{unassigned.length}</Badge>
              {canEdit && unassigned.length > 0 && (
                <span className="text-xs text-muted-foreground">Drag teams into a group below.</span>
              )}
            </div>
            {unassigned.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                All teams assigned — drag a team here to unassign it.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {unassigned.map(t => (
                  <span
                    key={t.id}
                    draggable={canEdit && !pending}
                    onDragStart={e => onTeamDragStart(e, t)}
                    className={`inline-flex items-center gap-1 rounded-full border bg-background py-1 text-xs font-medium select-none ${
                      canEdit ? 'pl-2 pr-1 cursor-grab' : 'px-2.5'
                    }`}
                    title={canEdit ? 'Drag into a group' : undefined}
                  >
                    {canEdit && <GripVertical className="h-3 w-3 text-muted-foreground" />}
                    <span className="max-w-[12rem] truncate">{t.name}</span>
                    {canEdit && (
                      <Select
                        value=""
                        onValueChange={label => assign(t.id, label)}
                        disabled={pending}
                      >
                        <SelectTrigger
                          className="h-5 w-5 justify-center border-none bg-transparent p-0 focus:ring-0 focus:ring-offset-0"
                          aria-label={`Assign ${t.name} to a group`}
                        />
                        <SelectContent>
                          {groupLabels.map(l => (
                            <SelectItem key={l} value={l}>Group {l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </span>
                ))}
              </div>
            )}
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
            <Card
              key={label}
              {...dropZoneProps(label, label)}
              className={`transition-colors ${
                hoverTarget === label ? 'border-emerald-500 bg-emerald-50' : ''
              }`}
            >
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
                  <p className="text-xs italic text-muted-foreground">
                    {canEdit ? 'Drop teams here.' : 'No teams yet.'}
                  </p>
                )}
                {groupTeams.map(t => (
                  <div
                    key={t.id}
                    draggable={canEdit && !pending}
                    onDragStart={e => onTeamDragStart(e, t)}
                    className={`flex items-center justify-between gap-2 ${canEdit ? 'cursor-grab select-none' : ''}`}
                    title={canEdit ? 'Drag to another group or to Unassigned' : undefined}
                  >
                    <span className="flex items-center gap-1.5 text-sm">
                      {canEdit && <GripVertical className="h-3 w-3 text-muted-foreground" />}
                      {t.name}
                    </span>
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
