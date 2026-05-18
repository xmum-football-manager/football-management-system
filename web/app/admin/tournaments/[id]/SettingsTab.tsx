'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { toast } from '@/components/Toast'
import {
  canEditTournamentName,
  canEditVenueDescription,
  canEditDates,
  canEditFormat,
} from '@/lib/lock-rules'
import { createClient } from '@/lib/supabase/client'
import { updateTournament } from '@/lib/db/tournaments'
import { assignScorekeeper, removeScorekeeper } from '@/lib/db/roles'
import type { Tournament, MatchWithTeams } from '@/lib/supabase/types'

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400'

const FORMAT_OPTIONS = [
  { value: 'round_robin', label: 'Round Robin (League)' },
  { value: 'round_robin_knockout', label: 'Round Robin + Knockout Rounds' },
  { value: 'knockout', label: 'Knockout Only' },
]

interface Props {
  tournament: Tournament
  matches: MatchWithTeams[]
  tournamentId: string
  isAdmin: boolean
  onRefresh: () => void
}

export function SettingsTab({ tournament: t, matches, tournamentId, isAdmin, onRefresh }: Props) {
  const supabase = createClient()
  const [form, setForm] = useState({
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
    halftime_minutes: (t.halftime_minutes ?? '') as number | '',
    extra_time_minutes: (t.extra_time_minutes ?? '') as number | '',
    penalty_shootout_enabled: t.penalty_shootout_enabled,
    require_goal_player: t.require_goal_player,
    num_groups: (t.num_groups ?? '') as number | '',
    teams_per_group: (t.teams_per_group ?? '') as number | '',
    advance_per_group: (t.advance_per_group ?? '') as number | '',
    knockout_start_round: (t.knockout_start_round ?? '') as string,
    seeding_method: (t.seeding_method ?? '') as string,
    min_players_per_team: t.min_players_per_team,
  })
  const [isPending, startTransition] = useTransition()

  // Scorekeeper state
  interface ScorekeeperRow { user_id: string; email: string; match_id: string | null }
  const [scorekeepers, setScorekeepers] = useState<ScorekeeperRow[]>([])
  const [skEmail, setSkEmail] = useState('')
  const [skScope, setSkScope] = useState<'tournament' | 'match'>('tournament')
  const [skMatchId, setSkMatchId] = useState('')
  const [skPending, startSkTransition] = useTransition()

  const loadScorekeepers = useCallback(async () => {
    const res = await fetch(`/api/admin/scorekeepers?tournamentId=${tournamentId}`)
    if (res.ok) setScorekeepers(await res.json())
  }, [tournamentId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadScorekeepers() }, [loadScorekeepers])

  function update(field: string, value: string | number | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function saveSettings() {
    if (form.end_date < form.start_date) { toast.error('End date cannot be before start date'); return }
    if (Number(form.min_players_per_team) < 11) { toast.error('Minimum players per team must be at least 11'); return }
    startTransition(async () => {
      const nameLocked = !canEditTournamentName(t.status, t.start_date)
      const venueLocked = !canEditVenueDescription(t.status)
      const datesLocked = !canEditDates(t.status)
      const formatLocked = !canEditFormat(t.status, t.first_match_scheduled_at)

      const patch: Record<string, unknown> = {}
      if (!nameLocked) patch.name = form.name
      if (!venueLocked) { patch.description = form.description || null; patch.location = form.location || null }
      if (!datesLocked) { patch.start_date = form.start_date; patch.end_date = form.end_date }
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
      patch.min_players_per_team = Number(form.min_players_per_team)

      if (Object.keys(patch).length === 0) { toast.error('All fields are locked.'); return }

      try {
        await updateTournament(supabase, tournamentId, patch)
        toast.success('Settings saved!')
        onRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  function handleAssignScorekeeper(e: React.FormEvent) {
    e.preventDefault()
    startSkTransition(async () => {
      const matchId = skScope === 'match' && skMatchId ? skMatchId : null
      try {
        await assignScorekeeper(supabase, skEmail, tournamentId, matchId)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Assign failed')
        return
      }
      toast.success('Scorekeeper assigned!')
      setSkEmail(''); setSkMatchId('')
      await loadScorekeepers()
    })
  }

  function handleRemoveScorekeeper(userId: string, matchId: string | null) {
    startSkTransition(async () => {
      try {
        await removeScorekeeper(supabase, userId, tournamentId, matchId)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Remove failed')
        return
      }
      toast.success('Scorekeeper removed.')
      await loadScorekeepers()
    })
  }

  const nameLocked = !canEditTournamentName(t.status, t.start_date)
  const venueLocked = !canEditVenueDescription(t.status)
  const datesLocked = !canEditDates(t.status)
  const formatLocked = !canEditFormat(t.status, t.first_match_scheduled_at)
  const hasRR = form.format === 'round_robin' || form.format === 'round_robin_knockout'
  const hasKO = form.format === 'knockout' || form.format === 'round_robin_knockout'
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Lock warnings */}
      {venueLocked && !datesLocked && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600">
          Venue and description are locked once the tournament goes live.
        </div>
      )}

      {/* Tournament Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Tournament Info</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input type="text" value={form.name} onChange={e => update('name', e.target.value)} disabled={nameLocked} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} disabled={venueLocked} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Venue</label>
          <input type="text" value={form.location} onChange={e => update('location', e.target.value)} disabled={venueLocked} className={inputClass} />
        </div>
      </div>

      {/* Dates */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Dates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} disabled={datesLocked} min={new Date().toISOString().split('T')[0]} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
            <input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} disabled={datesLocked} min={form.start_date || new Date().toISOString().split('T')[0]} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Format */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Format</h3>
        {formatLocked ? (
          <div>
            <input type="text" value={FORMAT_OPTIONS.find(o => o.value === form.format)?.label ?? form.format} disabled className={inputClass} />
            <p className="text-xs text-slate-400 mt-1">Locked once the first match is scheduled.</p>
          </div>
        ) : (
          <select value={form.format} onChange={e => update('format', e.target.value)} className={inputClass}>
            {FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {hasRR && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Number of groups</label>
              <input type="number" min={1} value={form.num_groups} disabled={formatLocked}
                onChange={e => update('num_groups', e.target.value === '' ? '' : Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teams per group</label>
              <input type="number" min={2} value={form.teams_per_group} disabled={formatLocked}
                onChange={e => update('teams_per_group', e.target.value === '' ? '' : Number(e.target.value))} className={inputClass} />
            </div>
            {form.format === 'round_robin_knockout' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teams advancing per group</label>
                <input type="number" min={1} value={form.advance_per_group} disabled={formatLocked}
                  onChange={e => update('advance_per_group', e.target.value === '' ? '' : Number(e.target.value))} className={inputClass} />
              </div>
            )}
          </div>
        )}
        {hasKO && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Knockout starts at</label>
              <select value={form.knockout_start_round} disabled={formatLocked} onChange={e => update('knockout_start_round', e.target.value)} className={inputClass}>
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
              <select value={form.seeding_method} disabled={formatLocked} onChange={e => update('seeding_method', e.target.value)} className={inputClass}>
                <option value="">Select method</option>
                <option value="by_standings">By standings</option>
                <option value="manual">Manual</option>
                <option value="random">Random</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Points */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Points System</h3>
        <div className="grid grid-cols-3 gap-4">
          {(['points_win', 'points_draw', 'points_loss'] as const).map(field => (
            <div key={field}>
              <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">{field.replace('points_', '')}</label>
              <input type="number" step="0.5" value={form[field]} disabled={formatLocked}
                onChange={e => update(field, Number(e.target.value))} className={inputClass} />
            </div>
          ))}
        </div>
      </div>

      {/* Match Rules */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Match Rules</h3>
        <label className={`flex items-center gap-3 ${formatLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
          <input type="checkbox" checked={form.halftime_enabled} disabled={formatLocked}
            onChange={e => update('halftime_enabled', e.target.checked)} className="accent-green-600" />
          <span className="text-sm text-slate-700">Enable halftime</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Time per half (min)</label>
            <input type="number" min={1} value={form.minutes_per_half} disabled={formatLocked}
              onChange={e => update('minutes_per_half', Number(e.target.value))} className={inputClass} />
          </div>
          {form.halftime_enabled && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Halftime duration (min)</label>
              <input type="number" min={1} value={form.halftime_minutes} disabled={formatLocked}
                onChange={e => update('halftime_minutes', e.target.value === '' ? '' : Number(e.target.value))} className={inputClass} />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Extra time duration (min)</label>
          <input type="number" min={0} value={form.extra_time_minutes} disabled={formatLocked}
            onChange={e => update('extra_time_minutes', e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="0 or blank = none" className={inputClass} />
        </div>
        <label className={`flex items-center gap-3 ${formatLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
          <input type="checkbox" checked={form.penalty_shootout_enabled} disabled={formatLocked}
            onChange={e => update('penalty_shootout_enabled', e.target.checked)} className="accent-green-600" />
          <span className="text-sm text-slate-700">Penalty shootout as tiebreaker</span>
        </label>
        <label className={`flex items-center gap-3 ${formatLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
          <input type="checkbox" checked={form.require_goal_player} disabled={formatLocked}
            onChange={e => update('require_goal_player', e.target.checked)} className="accent-green-600" />
          <span className="text-sm text-slate-700">Require player attribution for goals</span>
        </label>
      </div>

      {/* Min Players */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Minimum Players Per Team</h3>
        <input type="number" min={11} value={form.min_players_per_team}
          onChange={e => update('min_players_per_team', e.target.value === '' ? 11 : Math.max(11, Number(e.target.value)))}
          className={inputClass} />
        <p className="text-xs text-slate-400">Each team must have at least this many players before going live. Minimum: 11.</p>
      </div>

      <button onClick={saveSettings} disabled={isPending}
        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors">
        {isPending ? 'Saving…' : 'Save Settings'}
      </button>

      {/* Scorekeepers */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Scorekeepers</h3>
          <form onSubmit={handleAssignScorekeeper} className="space-y-3">
            <input type="email" value={skEmail} onChange={e => setSkEmail(e.target.value)} required
              placeholder="scorekeeper@example.com" className={inp} />
            <div className="flex gap-3">
              {(['tournament', 'match'] as const).map(s => (
                <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="sk-scope" value={s} checked={skScope === s} onChange={() => setSkScope(s)} className="accent-green-600" />
                  {s === 'tournament' ? 'Entire tournament' : 'Specific match'}
                </label>
              ))}
            </div>
            {skScope === 'match' && (
              <select value={skMatchId} onChange={e => setSkMatchId(e.target.value)} required className={inp}>
                <option value="">Select match…</option>
                {matches.map(m => (
                  <option key={m.id} value={m.id}>{m.home_team.name} vs {m.away_team.name} — {new Date(m.match_time).toLocaleDateString('en-MY')}</option>
                ))}
              </select>
            )}
            <button type="submit" disabled={skPending} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm">
              {skPending ? 'Assigning…' : 'Assign Scorekeeper'}
            </button>
          </form>
          {scorekeepers.length > 0 && (
            <div className="space-y-2">
              {scorekeepers.map(sk => {
                const match = matches.find(m => m.id === sk.match_id)
                return (
                  <div key={`${sk.user_id}-${sk.match_id}`} className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                    <div>
                      <p className="text-sm text-slate-700">{sk.email}</p>
                      <p className="text-xs text-slate-400">
                        {sk.match_id && match ? `${match.home_team.name} vs ${match.away_team.name}` : 'Entire tournament'}
                      </p>
                    </div>
                    <button onClick={() => handleRemoveScorekeeper(sk.user_id, sk.match_id)} disabled={skPending}
                      className="text-red-400 hover:text-red-600 text-sm font-medium">Remove</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
