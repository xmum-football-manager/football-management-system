'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { startKnockoutPhase } from '@/lib/db/tournaments'
import { createMatch } from '@/lib/db/matches'
import { getTournamentStandings } from '@/lib/db/standings'
import { expectedFirstRoundKOMatches } from '@/lib/fixture-utils'
import { useSetup } from '../SetupContext'
import type { Standing } from '@/lib/supabase/types'

type Slot = { home_team_id: string; away_team_id: string; match_date: string; match_time: string }

function emptySlot(): Slot {
  return { home_team_id: '', away_team_id: '', match_date: '', match_time: '' }
}

const sel = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

export default function BracketSetupPage() {
  const { tournament, teams } = useSetup()
  const router = useRouter()
  const [standings, setStandings] = useState<Standing[]>([])
  const [isPending, startTransition] = useTransition()
  const numSlots = expectedFirstRoundKOMatches(tournament.knockout_start_round)
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: numSlots }, emptySlot))

  useEffect(() => {
    if (tournament.status !== 'bracket_setup') {
      router.replace(`/admin/tournaments/${tournament.id}`)
    }
  }, [tournament.status, tournament.id, router])

  useEffect(() => {
    const supabase = createClient()
    getTournamentStandings(supabase, tournament.id).then(setStandings).catch(() => {})
  }, [tournament.id])

  function updateSlot(i: number, field: keyof Slot, value: string) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  const allFilled = slots.length > 0 && slots.every(
    s => s.home_team_id && s.away_team_id && s.match_date && s.match_time && s.home_team_id !== s.away_team_id
  )

  function handleConfirm() {
    startTransition(async () => {
      const supabase = createClient()
      try {
        for (const slot of slots) {
          await createMatch(
            supabase,
            tournament.id,
            slot.home_team_id,
            slot.away_team_id,
            new Date(`${slot.match_date}T${slot.match_time}`).toISOString(),
          )
        }
        await startKnockoutPhase(supabase, tournament.id)
        toast.success('Knockout phase started!')
        router.push(`/admin/tournaments/${tournament.id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to start knockout phase')
      }
    })
  }

  if (tournament.status !== 'bracket_setup') return null

  return (
    <div className="space-y-6">
      {standings.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-bold mb-3">Group Stage Standings</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100">
                  <th className="text-left pb-2 pr-4">Team</th>
                  <th className="text-center pb-2 px-2">P</th>
                  <th className="text-center pb-2 px-2">W</th>
                  <th className="text-center pb-2 px-2">D</th>
                  <th className="text-center pb-2 px-2">L</th>
                  <th className="text-center pb-2 px-2">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {standings.map(s => (
                  <tr key={s.team_id}>
                    <td className="py-1.5 font-medium pr-4">{s.team_name}</td>
                    <td className="text-center py-1.5 px-2 text-slate-500">{s.matches_played}</td>
                    <td className="text-center py-1.5 px-2 text-slate-500">{s.wins}</td>
                    <td className="text-center py-1.5 px-2 text-slate-500">{s.draws}</td>
                    <td className="text-center py-1.5 px-2 text-slate-500">{s.losses}</td>
                    <td className="text-center py-1.5 px-2 font-semibold">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-bold mb-1">Knockout First Round</h2>
        <p className="text-sm text-slate-500 mb-4">
          Assign teams to all {numSlots} first-round {numSlots === 1 ? 'match' : 'matches'} to start the knockout phase.
        </p>
        <div className="space-y-4">
          {slots.map((slot, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-500 mb-3">Match {i + 1}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Home Team</label>
                  <select
                    value={slot.home_team_id}
                    onChange={e => updateSlot(i, 'home_team_id', e.target.value)}
                    className={sel}
                  >
                    <option value="">Select…</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Away Team</label>
                  <select
                    value={slot.away_team_id}
                    onChange={e => updateSlot(i, 'away_team_id', e.target.value)}
                    className={sel}
                  >
                    <option value="">Select…</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={slot.match_date}
                    onChange={e => updateSlot(i, 'match_date', e.target.value)}
                    className={sel}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={slot.match_time}
                    onChange={e => updateSlot(i, 'match_time', e.target.value)}
                    className={sel}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleConfirm}
          disabled={!allFilled || isPending}
          className={`mt-6 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            allFilled
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isPending ? 'Starting Knockout Phase…' : allFilled ? 'Confirm Bracket & Start Knockout Phase' : 'Fill all slots to continue'}
        </button>
      </div>
    </div>
  )
}
