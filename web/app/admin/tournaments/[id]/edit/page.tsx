'use client'

import { useState, useTransition, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import { canEditTournamentMeta, canEditFormat } from '@/lib/lock-rules'
import type { Tournament } from '@/lib/supabase/types'

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function EditTournamentPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [form, setForm] = useState({
    name: '', description: '', location: '',
    start_date: '', end_date: '', format: 'round_robin',
    points_win: '1', points_draw: '0.5', points_loss: '0',
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
        points_win: String(t.points_win),
        points_draw: String(t.points_draw),
        points_loss: String(t.points_loss),
      })
    }
    load()
  }, [id])

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tournament) return
    startTransition(async () => {
      const supabase = createClient()
      const metaLocked = !canEditTournamentMeta(tournament.status)
      const formatLocked = !canEditFormat(tournament.status, tournament.first_match_scheduled_at)

      const patch: Record<string, unknown> = {
        name: form.name,
        description: form.description || null,
        location: form.location || null,
      }

      if (!metaLocked) {
        patch.start_date = form.start_date
        patch.end_date = form.end_date
      }
      if (!formatLocked) {
        patch.format = form.format
        patch.points_win = parseFloat(form.points_win)
        patch.points_draw = parseFloat(form.points_draw)
        patch.points_loss = parseFloat(form.points_loss)
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

  const metaLocked = !canEditTournamentMeta(tournament.status)
  const formatLocked = !canEditFormat(tournament.status, tournament.first_match_scheduled_at)
  const allLocked = metaLocked

  return (
    <PageShell id={id}>
      {allLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mb-4">
          This tournament is {tournament.status} — all fields are locked.
        </div>
      )}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <Field label="Tournament Name *">
          <input type="text" value={form.name} onChange={e => update('name', e.target.value)} required disabled={allLocked} className={inputClass} />
        </Field>
        <Field label="Description">
          <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} disabled={allLocked} className={inputClass} />
        </Field>
        <Field label="Location">
          <input type="text" value={form.location} onChange={e => update('location', e.target.value)} disabled={allLocked} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date *">
            <input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} required disabled={allLocked} className={inputClass} />
          </Field>
          <Field label="End Date *">
            <input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} required disabled={allLocked} className={inputClass} />
          </Field>
        </div>

        <Field label="Format">
          {formatLocked ? (
            <div>
              <input type="text" value={form.format === 'round_robin' ? 'Round Robin (League)' : 'Knockout'} disabled className={inputClass} />
              <p className="text-xs text-slate-400 mt-1">Locked once the first match is scheduled.</p>
            </div>
          ) : (
            <select value={form.format} onChange={e => update('format', e.target.value)} className={inputClass}>
              <option value="round_robin">Round Robin (League)</option>
              <option value="knockout">Knockout (Phase 2)</option>
            </select>
          )}
        </Field>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Points System</p>
          {formatLocked && (
            <p className="text-xs text-slate-400 mb-3">Locked once the first match is scheduled.</p>
          )}
          <div className="grid grid-cols-3 gap-4">
            <Field label="Win">
              <input type="number" value={form.points_win} onChange={e => update('points_win', e.target.value)} step="0.5" min="0" disabled={formatLocked} className={inputClass} />
            </Field>
            <Field label="Draw">
              <input type="number" value={form.points_draw} onChange={e => update('points_draw', e.target.value)} step="0.5" min="0" disabled={formatLocked} className={inputClass} />
            </Field>
            <Field label="Loss">
              <input type="number" value={form.points_loss} onChange={e => update('points_loss', e.target.value)} step="0.5" min="0" disabled={formatLocked} className={inputClass} />
            </Field>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || allLocked}
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
