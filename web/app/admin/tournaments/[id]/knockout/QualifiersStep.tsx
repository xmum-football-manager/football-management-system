'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { saveQualifiersAction } from '../fixtures/actions'
import type { TeamStanding } from '@/lib/qualifiers'

interface Props {
  tournamentId: string
  standings: TeamStanding[]
  savedQualifiers: string[] | null
  advancePerGroup: number
  numGroups: number
  onSaved: () => void
}

export function QualifiersStep({
  tournamentId,
  standings,
  savedQualifiers,
  advancePerGroup,
  numGroups,
  onSaved,
}: Props) {
  const [pending, startTransition] = useTransition()
  const computedIds = standings.filter((s) => s.qualified).map((s) => s.teamId)
  const [selected, setSelected] = useState<string[]>(savedQualifiers ?? computedIds)

  const labels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))
  const totalSlots = numGroups * advancePerGroup

  function toggle(teamId: string) {
    setSelected((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    )
  }

  function save() {
    startTransition(async () => {
      const r = await saveQualifiersAction(tournamentId, selected)
      if ('error' in r) {
        toast.error(r.error)
      } else {
        toast.success('Qualifiers saved.')
        onSaved()
      }
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select {totalSlots} teams advancing to knockout.{' '}
        <span className="font-medium text-foreground">{selected.length} / {totalSlots} selected.</span>
      </p>

      {labels.map((label) => {
        const group = standings
          .filter((s) => s.groupLabel === label)
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points
            if (b.gd !== a.gd) return b.gd - a.gd
            return a.teamName.localeCompare(b.teamName)
          })
        return (
          <div key={label}>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Group {label} · top {advancePerGroup}
            </p>
            <div className="space-y-1">
              {group.map((s) => {
                const isSelected = selected.includes(s.teamId)
                return (
                  <button
                    key={s.teamId}
                    onClick={() => toggle(s.teamId)}
                    disabled={pending}
                    className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors"
                    style={{
                      background: isSelected
                        ? 'color-mix(in srgb, var(--admin-lime) 10%, transparent)'
                        : 'transparent',
                      borderColor: isSelected
                        ? 'color-mix(in srgb, var(--admin-lime) 40%, transparent)'
                        : 'var(--border)',
                    }}
                  >
                    <span className="font-medium">{s.teamName}</span>
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{s.points} pts</span>
                      <span>GD {s.gd >= 0 ? '+' : ''}{s.gd}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <Button
        onClick={save}
        disabled={pending || selected.length !== totalSlots}
        className="w-full"
        size="sm"
      >
        {selected.length !== totalSlots
          ? `Select ${totalSlots - selected.length} more team${totalSlots - selected.length === 1 ? '' : 's'}`
          : 'Save qualifiers →'}
      </Button>
    </div>
  )
}
