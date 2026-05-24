'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveQualifiersAction } from '@/app/admin/tournaments/[id]/fixtures/actions'

interface TeamRef {
  id: string
  name: string
}

interface Props {
  tournamentId: string
  slots: number
  teams: TeamRef[]
  savedQualifiers: string[] | null
}

export function QualifierSelector({ tournamentId, slots, teams, savedQualifiers }: Props) {
  const router = useRouter()
  const [selections, setSelections] = useState<string[]>(
    savedQualifiers ?? Array(slots).fill(''),
  )
  const [pending, startTransition] = useTransition()

  function setSlot(index: number, teamId: string) {
    setSelections((prev) => {
      const next = [...prev]
      next[index] = teamId
      return next
    })
  }

  function availableFor(slotIndex: number): TeamRef[] {
    const takenElsewhere = new Set(
      selections.filter((id, i) => i !== slotIndex && id !== ''),
    )
    return teams.filter((t) => !takenElsewhere.has(t.id))
  }

  const allFilled = selections.length === slots && selections.every((id) => id !== '')

  function save() {
    startTransition(async () => {
      const r = await saveQualifiersAction(tournamentId, selections)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Qualifiers saved.')
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="text-sm font-medium">Knockout Qualifiers</div>
      <p className="text-xs text-muted-foreground">
        Select the {slots} teams advancing to the knockout stage.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: slots }, (_, i) => (
          <Select
            key={i}
            value={selections[i] ?? ''}
            onValueChange={(v) => setSlot(i, v)}
            disabled={pending}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Slot ${i + 1}`} />
            </SelectTrigger>
            <SelectContent>
              {availableFor(i).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>
      <Button size="sm" onClick={save} disabled={pending || !allFilled}>
        Save qualifiers
      </Button>
    </div>
  )
}
