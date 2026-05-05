'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import Link from 'next/link'

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent'

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

export default function NewTournamentPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: '',
    description: '',
    location: 'Xiamen University Malaysia, Football Field',
    start_date: '',
    end_date: '',
    format: 'round_robin',
    pointsPreset: 0,
  })

  function update(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.end_date < form.start_date) {
      toast.error('End date cannot be before start date')
      return
    }
    startTransition(async () => {
      const preset = POINTS_PRESETS[form.pointsPreset]
      const supabase = createClient()
      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          name: form.name,
          description: form.description || null,
          location: form.location || null,
          start_date: form.start_date,
          end_date: form.end_date,
          format: form.format,
          points_win: preset.win,
          points_draw: preset.draw,
          points_loss: preset.loss,
        })
        .select()
        .single()

      if (error) { toast.error(error.message); return }
      toast.success('Tournament created!')
      router.push(`/admin/tournaments/${data.id}`)
    })
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="font-bold text-slate-900">New Tournament</span>
          <div className="w-16" />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <Field label="Tournament Name *">
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)} required className={inputClass} placeholder="Spring Cup 2026" />
          </Field>
          <Field label="Description">
            <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} className={inputClass} placeholder="Optional description" />
          </Field>
          <Field label="Location">
            <input type="text" value={form.location} onChange={e => update('location', e.target.value)} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date *">
              <input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} required className={inputClass} />
            </Field>
            <Field label="End Date *">
              <input
                type="date"
                value={form.end_date}
                onChange={e => update('end_date', e.target.value)}
                required
                min={form.start_date || undefined}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Format">
            <select value={form.format} onChange={e => update('format', e.target.value)} className={inputClass}>
              {FORMAT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Points System</p>
            <div className="space-y-2">
              {POINTS_PRESETS.map((preset, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pointsPreset"
                    checked={form.pointsPreset === i}
                    onChange={() => update('pointsPreset', i)}
                    className="accent-green-600"
                  />
                  <span className="text-sm text-slate-700">{preset.label}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={isPending} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors">
            {isPending ? 'Creating…' : 'Create Tournament'}
          </button>
        </form>
      </main>
    </div>
  )
}
