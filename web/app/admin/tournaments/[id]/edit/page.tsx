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
import type { Tournament, TournamentFormat } from '@/lib/supabase/types'

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400'

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
    format: 'round_robin' as TournamentFormat,
    points_win: 1,
    points_draw: 0.5,
    points_loss: 0,
    // Wizard fields
    halftime_enabled: true,
    minutes_per_half: 45,
    halftime_minutes: 15 as number | '',
    extra_time_minutes: '' as number | '',
    penalty_shootout_enabled: false,
    require_goal_player: false,
    num_groups: '' as number | '',
    teams_per_group: '' as number | '',
    advance_per_group: '' as number | '',
    knockout_start_round: '' as string,
    seeding_method: '' as string,
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
        points_win: t.points_win,
        points_draw: t.points_draw,
        points_loss: t.points_loss,
        halftime_enabled: t.halftime_enabled,
        minutes_per_half: t.minutes_per_half,
        halftime_minutes: t.halftime_minutes ?? '',
        extra_time_minutes: t.extra_time_minutes ?? '',
        penalty_shootout_enabled: t.penalty_shootout_enabled,
        require_goal_player: t.require_goal_player,
        num_groups: t.num_groups ?? '',
        teams_per_group: t.teams_per_group ?? '',
        advance_per_group: t.advance_per_group ?? '',
        knockout_start_round: t.knockout_start_round ?? '',
        seeding_method: t.seeding_method ?? '',
      })
    }
    load()
  }, [id])

  function update(field: string, value: string | number | boolean) {
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
        patch.points_win = form.points_win
        patch.points_draw = form.points_draw
        patch.points_loss = form.points_loss
        patch.halftime_enabled = form.halftime_enabled
        patch.minutes_per_half = Number(form.minutes_per_half)
        patch.halftime_minutes = form.halftime_enabled ? Number(form.halftime_minutes) : null
        patch.extra_time_minutes = form.extra_time_minutes !== '' ? Number(form.extra_time_minutes) : null
        patch.penalty_shootout_enabled = form.penalty_shootout_enabled
        patch.require_goal_player = form.require_goal_player
        const hasRR = form.format === 'round_robin' || form.format === 'round_robin_knockout'
        const hasKO = form.format === 'knockout' || form.format === 'round_robin_knockout'
        const isHybrid = form.format === 'round_robin_knockout'
        patch.num_groups = hasRR ? Number(form.num_groups) : null
        patch.teams_per_group = hasRR ? Number(form.teams_per_group) : null
        patch.advance_per_group = isHybrid ? Number(form.advance_per_group) : null
        patch.knockout_start_round = hasKO ? form.knockout_start_round || null : null
        patch.seeding_method = hasKO ? form.seeding_method || null : null
      }

      if (!formatLocked) {
        const hasRR = form.format === 'round_robin' || form.format === 'round_robin_knockout'
        if (hasRR) {
          if (!form.num_groups || Number(form.num_groups) < 1) {
            toast.error('Number of groups must be at least 1')
            return
          }
          if (!form.teams_per_group || Number(form.teams_per_group) < 2) {
            toast.error('Teams per group must be at least 2')
            return
          }
        }
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

        {/* Format-conditional fields */}
        {(form.format === 'round_robin' || form.format === 'round_robin_knockout') && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Number of groups</label>
              <input
                type="number"
                min={1}
                value={form.num_groups}
                disabled={formatLocked}
                onChange={e => update('num_groups', e.target.value === '' ? '' : Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teams per group</label>
              <input
                type="number"
                min={2}
                value={form.teams_per_group}
                disabled={formatLocked}
                onChange={e => update('teams_per_group', e.target.value === '' ? '' : Number(e.target.value))}
                className={inputClass}
              />
            </div>
            {form.format === 'round_robin_knockout' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teams advancing per group</label>
                <input
                  type="number"
                  min={1}
                  value={form.advance_per_group}
                  disabled={formatLocked}
                  onChange={e => update('advance_per_group', e.target.value === '' ? '' : Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            )}
          </div>
        )}
        {(form.format === 'knockout' || form.format === 'round_robin_knockout') && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Knockout starts at</label>
              <select
                value={form.knockout_start_round}
                disabled={formatLocked}
                onChange={e => update('knockout_start_round', e.target.value)}
                className={inputClass}
              >
                <option value="">Select round</option>
                <option value="top_32">Top 32</option>
                <option value="top_16">Top 16</option>
                <option value="top_8">Top 8</option>
                <option value="semi">Semi-finals</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Seeding method</label>
              <select
                value={form.seeding_method}
                disabled={formatLocked}
                onChange={e => update('seeding_method', e.target.value)}
                className={inputClass}
              >
                <option value="">Select method</option>
                <option value="by_standings">By standings</option>
                <option value="manual">Manual</option>
                <option value="random">Random</option>
              </select>
            </div>
          </div>
        )}

        {/* Points System */}
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Points System</p>
            {formatLocked && <p className="text-xs text-slate-400">Locked after first match scheduled.</p>}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {(['points_win', 'points_draw', 'points_loss'] as const).map(field => (
              <div key={field}>
                <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">
                  {field.replace('points_', '')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={form[field]}
                  disabled={formatLocked}
                  onChange={e => update(field, Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Match Rules */}
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Match Rules</p>
            {formatLocked && <p className="text-xs text-slate-400">Locked after first match scheduled.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Time per half (min)</label>
              <input
                type="number"
                min={1}
                value={form.minutes_per_half}
                disabled={formatLocked}
                onChange={e => update('minutes_per_half', Number(e.target.value))}
                className={inputClass}
              />
            </div>
            {form.halftime_enabled && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Halftime duration (min)</label>
                <input
                  type="number"
                  min={1}
                  value={form.halftime_minutes}
                  disabled={formatLocked}
                  onChange={e => update('halftime_minutes', e.target.value === '' ? '' : Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Extra time duration (min)</label>
            <input
              type="number"
              min={0}
              value={form.extra_time_minutes}
              disabled={formatLocked}
              onChange={e => update('extra_time_minutes', e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0 or blank = none"
              className={inputClass}
            />
          </div>
          <label className={`flex items-center gap-3 ${formatLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={form.penalty_shootout_enabled}
              disabled={formatLocked}
              onChange={e => update('penalty_shootout_enabled', e.target.checked)}
              className="accent-green-600"
            />
            <span className="text-sm text-slate-700">Penalty shootout as tiebreaker (best of 5)</span>
          </label>
          <label className={`flex items-center gap-3 ${formatLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={form.require_goal_player}
              disabled={formatLocked}
              onChange={e => update('require_goal_player', e.target.checked)}
              className="accent-green-600"
            />
            <span className="text-sm text-slate-700">Require player attribution for goals</span>
          </label>
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
