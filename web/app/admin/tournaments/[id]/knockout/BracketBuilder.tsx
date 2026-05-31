'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createManualKnockoutAction } from '../fixtures/actions'

interface Team {
  id: string
  name: string
}

interface Props {
  tournamentId: string
  qualifiedTeams: Team[]
  onCreated: () => void
}

export function BracketBuilder({ tournamentId, qualifiedTeams, onCreated }: Props) {
  const matchCount = Math.floor(qualifiedTeams.length / 2)
  const [pending, startTransition] = useTransition()

  const emptyPairings = Array.from({ length: matchCount }, () => ({ home: '', away: '' }))
  const [pairings, setPairings] = useState(emptyPairings)

  const assignedIds = new Set(pairings.flatMap((p) => [p.home, p.away].filter(Boolean)))

  function setSlot(matchIdx: number, slot: 'home' | 'away', teamId: string) {
    setPairings((prev) => {
      const next = prev.map((p, i) => (i === matchIdx ? { ...p, [slot]: teamId } : p))
      return next
    })
  }

  const allFilled = pairings.every((p) => p.home && p.away)

  function submit() {
    startTransition(async () => {
      const r = await createManualKnockoutAction(
        tournamentId,
        pairings.map((p) => ({ home_team_id: p.home, away_team_id: p.away })),
      )
      if ('error' in r) toast.error(r.error)
      else {
        toast.success(`${r.created} knockout match${r.created === 1 ? '' : 'es'} created.`)
        onCreated()
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Manually set up {matchCount} first-round match{matchCount === 1 ? '' : 'es'} from the {qualifiedTeams.length} confirmed qualifiers.
      </p>

      <div className="space-y-2">
        {pairings.map((pairing, i) => {
          const availableForHome = qualifiedTeams.filter(
            (t) => !assignedIds.has(t.id) || t.id === pairing.home,
          )
          const availableForAway = qualifiedTeams.filter(
            (t) => !assignedIds.has(t.id) || t.id === pairing.away,
          )
          return (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Select value={pairing.home} onValueChange={(v) => setSlot(i, 'home', v)} disabled={pending}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Home team" />
                </SelectTrigger>
                <SelectContent>
                  {availableForHome.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <span className="text-xs text-muted-foreground">vs</span>

              <Select value={pairing.away} onValueChange={(v) => setSlot(i, 'away', v)} disabled={pending}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Away team" />
                </SelectTrigger>
                <SelectContent>
                  {availableForAway.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>

      <Button onClick={submit} disabled={!allFilled || pending} className="w-full" size="sm">
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {allFilled ? 'Create fixtures →' : `Fill all ${matchCount} match${matchCount === 1 ? '' : 'es'} to continue`}
      </Button>
    </div>
  )
}
