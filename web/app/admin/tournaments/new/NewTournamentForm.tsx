'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createTournamentAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Info, Loader2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { removeImage } from '@/lib/storage-client'
import type { TournamentFormat, KnockoutStartRound } from '@/lib/supabase/types'

const KNOCKOUT_STAGES: {
  value: KnockoutStartRound
  label: string
  teams: number
  description: string
}[] = [
  {
    value: 'final',
    label: 'Final',
    teams: 2,
    description:
      'Only 2 teams qualify from the groups. They play a single match for the title — no earlier knockout rounds.',
  },
  {
    value: 'semi',
    label: 'Semi-final',
    teams: 4,
    description:
      '4 teams qualify and play two semi-final matches. The winners meet in the final.',
  },
  {
    value: 'top_8',
    label: 'Quarter-final',
    teams: 8,
    description:
      '8 teams qualify and play quarter-finals, then semi-finals, then the final — 3 knockout rounds in total.',
  },
  {
    value: 'top_16',
    label: 'Round of 16',
    teams: 16,
    description:
      '16 teams qualify. The bracket runs round of 16 → quarter-finals → semi-finals → final, 4 knockout rounds in total.',
  },
  {
    value: 'top_32',
    label: 'Round of 32',
    teams: 32,
    description:
      '32 teams qualify. The bracket runs round of 32 → round of 16 → quarter-finals → semi-finals → final, 5 knockout rounds in total.',
  },
]

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
  const [minutesPerHalf, setMinutesPerHalf] = useState(45)
  const [halftimeEnabled, setHalftimeEnabled] = useState(true)
  const [halftimeMinutes, setHalftimeMinutes] = useState(15)
  const [numGroups, setNumGroups] = useState(4)
  const [teamsPerGroup, setTeamsPerGroup] = useState(4)
  const [knockoutStage, setKnockoutStage] = useState<KnockoutStartRound>('top_8')
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [bannerPath, setBannerPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (endDate < startDate) {
      setError('End date must be on or after the start date.')
      return
    }
    if (!Number.isFinite(minutesPerHalf) || minutesPerHalf < 1) {
      setError('Minutes per half must be at least 1.')
      return
    }
    if (halftimeEnabled && (!Number.isFinite(halftimeMinutes) || halftimeMinutes < 1)) {
      setError('Halftime length must be at least 1 minute.')
      return
    }
    const selectedStage = KNOCKOUT_STAGES.find((s) => s.value === knockoutStage)!
    const advancePerGroup = format === 'round_robin_knockout' ? selectedStage.teams / numGroups : null
    if (format === 'round_robin_knockout') {
      if (numGroups < 2 || numGroups > 16) {
        setError('Number of groups must be between 2 and 16.')
        return
      }
      if (teamsPerGroup < 2 || teamsPerGroup > 16) {
        setError('Teams per group must be between 2 and 16.')
        return
      }
      if (!advancePerGroup || !Number.isInteger(advancePerGroup) || advancePerGroup >= teamsPerGroup) {
        setError('Selected knockout stage does not divide evenly into the number of groups.')
        return
      }
    }
    setLoading(true)
    const result = await createTournamentAction({
      name: name.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      logo_path: logoPath,
      banner_path: bannerPath,
      start_date: startDate,
      end_date: endDate,
      format,
      points_win: pointsWin,
      points_draw: pointsDraw,
      points_loss: pointsLoss,
      minutes_per_half: minutesPerHalf,
      halftime_enabled: halftimeEnabled,
      halftime_minutes: halftimeEnabled ? halftimeMinutes : null,
      num_groups: format === 'round_robin_knockout' ? numGroups : null,
      teams_per_group: format === 'round_robin_knockout' ? teamsPerGroup : null,
      advance_per_group: format === 'round_robin_knockout' ? advancePerGroup : null,
      knockout_start_round: format === 'round_robin_knockout' ? knockoutStage : null,
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
        <legend className="text-sm font-medium">Branding (optional)</legend>
        <div className="flex items-start gap-4">
          <ImageUpload
            label="Logo"
            value={logoPath}
            folder="tournament-logos"
            maxDim={512}
            onUploaded={(p) => {
              if (logoPath) void removeImage(logoPath)
              setLogoPath(p)
            }}
            onRemove={() => {
              if (logoPath) void removeImage(logoPath)
              setLogoPath(null)
            }}
          />
          <div className="flex-1">
            <ImageUpload
              label="Banner"
              shape="banner"
              value={bannerPath}
              folder="tournament-banners"
              maxDim={1600}
              onUploaded={(p) => {
                if (bannerPath) void removeImage(bannerPath)
                setBannerPath(p)
              }}
              onRemove={() => {
                if (bannerPath) void removeImage(bannerPath)
                setBannerPath(null)
              }}
            />
          </div>
        </div>
      </fieldset>

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

      {format === 'round_robin_knockout' && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Group stage</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="num-groups" className="text-xs">Number of groups</Label>
              <Input
                id="num-groups"
                type="number"
                min={2}
                max={16}
                required
                value={numGroups}
                onChange={(e) => setNumGroups(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teams-per-group" className="text-xs">Teams per group</Label>
              <Input
                id="teams-per-group"
                type="number"
                min={2}
                max={16}
                required
                value={teamsPerGroup}
                onChange={(e) => setTeamsPerGroup(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Knockout stage</Label>
            <div className="flex flex-wrap gap-2">
              {KNOCKOUT_STAGES.map((stage) => {
                const valid = stage.teams % numGroups === 0
                const advPerGroup = valid ? stage.teams / numGroups : null
                const active = knockoutStage === stage.value
                return (
                  <div
                    key={stage.value}
                    className="flex items-center rounded-md border transition-colors"
                    style={{
                      background: active ? 'var(--admin-lime)' : 'transparent',
                      color: active ? '#000' : valid ? 'var(--foreground)' : 'var(--muted-foreground)',
                      borderColor: active ? 'var(--admin-lime)' : 'var(--border)',
                    }}
                  >
                    <button
                      type="button"
                      disabled={!valid}
                      onClick={() => setKnockoutStage(stage.value)}
                      className="py-1.5 pl-3 text-xs font-medium"
                      style={{
                        opacity: valid ? 1 : 0.4,
                        cursor: valid ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {stage.label}
                      {valid && advPerGroup !== null && (
                        <span className="ml-1 opacity-60">· top {advPerGroup}/group</span>
                      )}
                    </button>
                    <StageInfo stage={stage} />
                  </div>
                )
              })}
            </div>
          </div>
          {(() => {
            const stage = KNOCKOUT_STAGES.find((s) => s.value === knockoutStage)!
            const valid = stage.teams % numGroups === 0
            const advPerGroup = valid ? stage.teams / numGroups : null
            return (
              <p className="text-xs text-muted-foreground">
                {numGroups} group{numGroups === 1 ? '' : 's'} × {teamsPerGroup} team
                {teamsPerGroup === 1 ? '' : 's'} = {numGroups * teamsPerGroup} teams total
                {valid && advPerGroup !== null
                  ? ` · top ${advPerGroup} per group advance (${stage.teams} into ${stage.label})`
                  : ' · select a valid knockout stage above'}
              </p>
            )
          })()}
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Match timing</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mph" className="text-xs">Minutes per half</Label>
            <Input
              id="mph"
              type="number"
              min={1}
              max={120}
              required
              value={minutesPerHalf}
              onChange={(e) => setMinutesPerHalf(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="htm" className="text-xs">Halftime length (min)</Label>
            <Input
              id="htm"
              type="number"
              min={1}
              max={60}
              disabled={!halftimeEnabled}
              value={halftimeMinutes}
              onChange={(e) => setHalftimeMinutes(Number(e.target.value))}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={halftimeEnabled}
            onChange={(e) => setHalftimeEnabled(e.target.checked)}
          />
          Include halftime break
        </label>
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

function StageInfo({ stage }: { stage: (typeof KNOCKOUT_STAGES)[number] }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${stage.label}`}
          className="py-1.5 pl-1.5 pr-2 opacity-50 hover:opacity-100"
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse') setOpen(true)
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setOpen(false)
          }}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-64 p-3"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-xs font-medium">
          {stage.label} · {stage.teams} teams
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{stage.description}</p>
      </PopoverContent>
    </Popover>
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
