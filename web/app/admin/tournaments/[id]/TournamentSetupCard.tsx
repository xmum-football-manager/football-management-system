'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/components/Toast'
import { canEditVenueDescription, canEditDates } from '@/lib/lock-rules'
import { updateTournament } from '@/lib/db/tournaments'
import type { Tournament } from '@/lib/supabase/types'

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400'

export function TournamentSetupCard({ tournament }: { tournament: Tournament }) {
  const [location, setLocation] = useState(tournament.location ?? '')
  const [startDate, setStartDate] = useState(tournament.start_date)
  const [endDate, setEndDate] = useState(tournament.end_date)
  const [isPending, startTransition] = useTransition()

  const venueLocked = !canEditVenueDescription(tournament.status)
  const datesLocked = !canEditDates(tournament.status)

  if (venueLocked && datesLocked) return null

  function save() {
    if (endDate < startDate) {
      toast.error('End date cannot be before start date')
      return
    }
    startTransition(async () => {
      const patch: Record<string, unknown> = {}
      if (!venueLocked) patch.location = location || null
      if (!datesLocked) {
        patch.start_date = startDate
        patch.end_date = endDate
      }
      const { error } = await updateTournament(tournament.id, patch)
      if (error) toast.error(error.message)
      else toast.success('Setup saved!')
    })
  }

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900 mb-3">Tournament Setup</h2>
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        {!venueLocked && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Venue</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className={inputClass}
              placeholder="Xiamen University Malaysia, Football Field"
            />
          </div>
        )}
        {!datesLocked && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().split('T')[0]}
                className={inputClass}
              />
            </div>
          </div>
        )}
        <button
          onClick={save}
          disabled={isPending}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {isPending ? 'Saving…' : 'Save Setup'}
        </button>
      </div>
    </section>
  )
}
