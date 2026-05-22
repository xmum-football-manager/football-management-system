'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createTournamentAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import type { TournamentFormat } from '@/lib/supabase/types'

const FORMATS: { value: TournamentFormat; label: string; description: string }[] = [
  {
    value: 'round_robin',
    label: 'Round-robin',
    description: 'Every team plays every other team. Standings table decides the winner.',
  },
  {
    value: 'knockout',
    label: 'Knockout',
    description: 'Single elimination bracket. Win or go home.',
  },
  {
    value: 'round_robin_knockout',
    label: 'Group → Knockout',
    description: 'Round-robin groups, then top teams advance to a knockout bracket.',
  },
]

export function NewTournamentForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [format, setFormat] = useState<TournamentFormat>('round_robin')
  const [pointsWin, setPointsWin] = useState(3)
  const [pointsDraw, setPointsDraw] = useState(1)
  const [pointsLoss, setPointsLoss] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await createTournamentAction({
      name,
      description: description || null,
      location: location || null,
      start_date: startDate,
      end_date: endDate,
      format,
      points_win: pointsWin,
      points_draw: pointsDraw,
      points_loss: pointsLoss,
    })
    setLoading(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    toast.success('Tournament created.')
    router.push(`/admin/tournaments/${result.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="start">Start date</Label>
          <Input
            id="start"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end">End date</Label>
          <Input
            id="end"
            type="date"
            required
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          placeholder="Stadium / pitch name"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={3}
          placeholder="Short blurb for participants."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Format</legend>
        <div className="grid grid-cols-1 gap-2">
          {FORMATS.map((f) => (
            <label
              key={f.value}
              className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                format === f.value ? 'border-emerald-600 bg-emerald-50' : 'hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="format"
                className="mt-1"
                checked={format === f.value}
                onChange={() => setFormat(f.value)}
              />
              <div>
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-muted-foreground">{f.description}</div>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Points system</legend>
        <div className="grid grid-cols-3 gap-3">
          <PointInput label="Win" value={pointsWin} onChange={setPointsWin} />
          <PointInput label="Draw" value={pointsDraw} onChange={setPointsDraw} />
          <PointInput label="Loss" value={pointsLoss} onChange={setPointsLoss} />
        </div>
        <p className="text-xs text-muted-foreground">Defaults: 3 / 1 / 0.</p>
      </fieldset>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Tournament
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function PointInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min="0"
        step="0.5"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
