'use client'

import { useState, useTransition, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import {
  canEditTournamentName,
  canEditVenueDescription,
  canEditDates,
  canEditFormat,
} from '@/lib/lock-rules'
import type { Tournament } from '@/lib/supabase/types'

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400'

const POINTS_PRESETS = [
  { label: '3 / 2 / 1  (win / draw / loss)', win: 3, draw: 2, loss: 1 },
  { label: '1 / 0.5 / 0  (win / draw / loss)', win: 1, draw: 0.5, loss: 0 },
]

const FORMAT_OPTIONS = [
  { value: 'round_robin', label: 'Round Robin (League)' },
  { value: 'round_robin_knockout', label: 'Round Robin + Knockout Rounds' },
  { value: 'knockout', label: 'Knockout Only' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function matchPreset(win: number, draw: number, loss: number): number {
  return POINTS_PRESETS.findIndex(p => p.win === win && p.draw === draw && p.loss === loss)
}

export default function EditTournamentPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    location: '',
    start_date: '',
    end_date: '',
    format: 'round_robin',
    pointsPreset: 0,
  })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('tournaments').select('*').eq('id', id).single()
      if (!data) return
      const t = data as Tournament
      setTournament(t)
      setForm({
        name: t.name,
        description: t.description ?? '',
        location: t.location ?? '',
        start_date: t.start_date,
        end_date: t.end_date,
        format: t.format,
        pointsPreset: Math.max(0, matchPreset(t.points_win, t.points_draw, t.points_loss)),
      })
    }
    load()
  }, [id])

  function update(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tournament) return
    if (form.end_date < form.start_date) {
      toast.error('End date cannot be before start date')
      return
    }
    startTransition(async () => {
      const supabase = createClient()
      const nameLocked = !canEditTournamentName(tournament.status, tournament.start_date)
      const venueLocked = !canEditVenueDescription(tournament.status)
      const datesLocked = !canEditDates(tournament.status)
      const formatLocked = !canEditFormat(tournament.status, tournament.first_match_scheduled_at)
      const preset = POINTS_PRESETS[form.pointsPreset]

      const patch: Record<string, unknown> = {}

      if (!nameLocked) patch.name = form.name
      if (!venueLocked) {
        patch.description = form.description || null
        patch.location = form.location || null
      }
      if (!datesLocked) {
        patch.start_date = form.start_date
        patch.end_date = form.end_date
      }
      if (!formatLocked) {
        patch.format = form.format
        patch.points_win = preset.win
        patch.points_draw = preset.draw
        patch.points_loss = preset.loss
      }

      if (Object.keys(patch).length === 0) {
        toast.error('All fields are locked — nothing to save.')
        return
      }

      const { error } = await supabase.from('tournaments').update(patch).eq('id', id)
      if (error) { toast.error(error.message); return }
      toast.success('Tournament updated!')
      router.push(`/admin/tournaments/${id}`)
    })
  }

  if (!tournament) {
    return (
      <PageShell id={id}>
        <div className="text-center py-16 text-slate-400">Loading…</div>
      </PageShell>
    )
  }

  const nameLocked = !canEditTournamentName(tournament.status, tournament.start_date)
  const venueLocked = !canEditVenueDescription(tournament.status)
  const datesLocked = !canEditDates(tournament.status)
  const formatLocked = !canEditFormat(tournament.status, tournament.first_match_scheduled_at)
  const everythingLocked = nameLocked && venueLocked && datesLocked && formatLocked

  return (
    <PageShell id={id}>
      {everythingLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mb-4">
          This tournament is {tournament.status} — all fields are locked.
        </div>
      )}
      {nameLocked && !everythingLocked && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600 mb-4">
          Tournament name is locked (within 14 days of start date).
        </div>
      )}
      {venueLocked && !everythingLocked && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600 mb-4">
          Venue and description are locked once the tournament goes live.
        </div>
      )}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <Field label="Tournament Name *">
          <input
            type="text"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            required
            disabled={nameLocked}
            className={inputClass}
          />
        </Field>
        <Field label="Description">
          <textarea
            value={form.description}
            onChange={e => update('description', e.target.value)}
            rows={3}
            disabled={venueLocked}
            className={inputClass}
          />
        </Field>
        <Field label="Location">
          <input
            type="text"
            value={form.location}
            onChange={e => update('location', e.target.value)}
            disabled={venueLocked}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date *">
            <input
              type="date"
              value={form.start_date}
              onChange={e => update('start_date', e.target.value)}
              required
              disabled={datesLocked}
              className={inputClass}
            />
          </Field>
          <Field label="End Date *">
            <input
              type="date"
              value={form.end_date}
              onChange={e => update('end_date', e.target.value)}
              required
              disabled={datesLocked}
              min={form.start_date || undefined}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Format">
          {formatLocked ? (
            <div>
              <input
                type="text"
                value={FORMAT_OPTIONS.find(o => o.value === form.format)?.label ?? form.format}
                disabled
                className={inputClass}
              />
              <p className="text-xs text-slate-400 mt-1">Locked once the first match is scheduled.</p>
            </div>
          ) : (
            <select value={form.format} onChange={e => update('format', e.target.value)} className={inputClass}>
              {FORMAT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </Field>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Points System</p>
          {formatLocked && (
            <p className="text-xs text-slate-400 mb-3">Locked once the first match is scheduled.</p>
          )}
          <div className="space-y-2">
            {POINTS_PRESETS.map((preset, i) => (
              <label key={i} className={`flex items-center gap-3 ${formatLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                <input
                  type="radio"
                  name="pointsPreset"
                  checked={form.pointsPreset === i}
                  onChange={() => update('pointsPreset', i)}
                  disabled={formatLocked}
                  className="accent-green-600"
                />
                <span className="text-sm text-slate-700">{preset.label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || everythingLocked}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </PageShell>
  )
}

function PageShell({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href={`/admin/tournaments/${id}`} className="text-slate-500 hover:text-slate-700 text-sm">← Tournament</Link>
          <span className="font-bold text-slate-900">Edit Tournament</span>
          <div className="w-16" />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
