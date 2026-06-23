'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { saveQualifiersAction } from '../fixtures/actions'
import type { TeamStanding } from '@/lib/qualifiers'
import { canEditQualifiers } from '@/lib/overview-utils'
import { detectBoundaryTies, validateQualifierSelection } from '@/lib/qualifiers'

interface Props {
  tournamentId: string
  standings: TeamStanding[]
  savedQualifiers: string[] | null
  advancePerGroup: number
  numGroups: number
  isAdmin: boolean
  bracketExists: boolean
  onSaved: () => void
}

export function QualifiersStep({
  tournamentId,
  standings,
  savedQualifiers,
  advancePerGroup,
  numGroups,
  isAdmin,
  bracketExists,
  onSaved,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(standings.filter((s) => s.qualified).map((s) => s.teamId)),
  )

  const labels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))
  const totalSlots = numGroups * advancePerGroup

  const boundaryTies = detectBoundaryTies(standings, advancePerGroup)
  const contestedByGroup = new Map<string, Set<string>>()
  for (const tie of boundaryTies) {
    contestedByGroup.set(tie.groupLabel, new Set(tie.contestedTeamIds))
  }

  function toggleTeam(teamId: string, groupLabel: string) {
    const groupTeams = standings.filter((s) => s.groupLabel === groupLabel)
    const currentGroupSelected = groupTeams.filter((s) => selectedIds.has(s.teamId))
    const isCurrentlySelected = selectedIds.has(teamId)
    if (!isCurrentlySelected && currentGroupSelected.length >= advancePerGroup) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (isCurrentlySelected) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  function confirm() {
    const ids = [...selectedIds]
    const validation = validateQualifierSelection(standings, ids, advancePerGroup, numGroups)
    if ('error' in validation) {
      toast.error(validation.error)
      return
    }
    startTransition(async () => {
      const r = await saveQualifiersAction(tournamentId, ids)
      setConfirming(false)
      setEditing(false)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Qualifiers updated.')
        onSaved()
      }
    })
  }

  const alreadySaved = (savedQualifiers?.length ?? 0) > 0
  const canEdit = canEditQualifiers(isAdmin, alreadySaved, bracketExists)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Top {advancePerGroup} from each group advance by default.{' '}
        <span className="font-medium text-foreground">{totalSlots} teams total.</span>{' '}
        {canEdit && 'You can pick any team — useful when teams are level on points.'}
      </p>

      {labels.map((label) => {
        const group = standings
          .filter((s) => s.groupLabel === label)
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points
            if (b.gd !== a.gd) return b.gd - a.gd
            return a.teamName.localeCompare(b.teamName)
          })
        const groupContested = contestedByGroup.get(label)
        const hasTie = !!groupContested && groupContested.size > 0
        return (
          <div key={label}>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Group {label} · top {advancePerGroup}
              {hasTie && (
                <span className="ml-2 text-amber-500">· tie — pick {boundaryTies.find(t => t.groupLabel === label)!.slots}</span>
              )}
            </p>
            <div className="space-y-1">
              {group.map((s) => {
                const isContested = groupContested?.has(s.teamId) ?? false
                const isSelected = selectedIds.has(s.teamId)
                const canToggle = canEdit
                return (
                  <div
                    key={s.teamId}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm${canToggle ? ' cursor-pointer select-none' : ''}`}
                    style={{
                      background: isSelected
                        ? 'color-mix(in srgb, var(--admin-lime) 10%, transparent)'
                        : 'transparent',
                      borderColor: isSelected
                        ? 'color-mix(in srgb, var(--admin-lime) 40%, transparent)'
                        : isContested && canEdit
                          ? 'color-mix(in srgb, var(--admin-amber, #f59e0b) 50%, transparent)'
                          : 'var(--border)',
                    }}
                    onClick={canToggle ? () => toggleTeam(s.teamId, label) : undefined}
                    role={canToggle ? 'checkbox' : undefined}
                    aria-checked={canToggle ? isSelected : undefined}
                  >
                    <span className="font-medium">{s.teamName}</span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{s.points} pts</span>
                      <span>GD {s.gd >= 0 ? '+' : ''}{s.gd}</span>
                      {canEdit
                        ? (
                          <input
                            type="checkbox"
                            readOnly
                            checked={isSelected}
                            className="h-3.5 w-3.5 accent-emerald-500 pointer-events-none"
                          />
                        )
                        : isSelected && <Check className="h-3.5 w-3.5 text-emerald-500" />
                      }
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {(!alreadySaved || editing) && (
        <Button
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="w-full"
          size="sm"
        >
          Confirm qualifiers →
        </Button>
      )}

      {canEdit && !editing && (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setEditing(true)}
        >
          Edit qualifiers
        </Button>
      )}

      <AlertDialog open={confirming} onOpenChange={(open) => !open && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm qualifiers?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>The following {totalSlots} teams will advance to the knockout stage:</p>
                <div className="space-y-2">
                  {labels.map((label) => {
                    const qualified = standings
                      .filter((s) => s.groupLabel === label && selectedIds.has(s.teamId))
                      .sort((a, b) => {
                        if (b.points !== a.points) return b.points - a.points
                        if (b.gd !== a.gd) return b.gd - a.gd
                        return a.teamName.localeCompare(b.teamName)
                      })
                    return (
                      <div key={label}>
                        <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
                          Group {label}
                        </p>
                        {qualified.map((s) => (
                          <p key={s.teamId} className="text-sm font-medium text-foreground">
                            {s.teamName}
                          </p>
                        ))}
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Admins can edit qualifiers again as long as the bracket has not been seeded.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} disabled={pending}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
