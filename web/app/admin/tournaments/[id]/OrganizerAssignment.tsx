'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { toast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { assignOrganizer, removeOrganizer } from '@/lib/db/roles'

interface OrganizerRow {
  user_id: string
  email: string
}

interface Props {
  tournamentId: string
}

export function OrganizerAssignment({ tournamentId }: Props) {
  const supabase = createClient()
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([])
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/organizers?tournamentId=${tournamentId}`)
    if (res.ok) setOrganizers(await res.json())
  }, [tournamentId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        await assignOrganizer(supabase, email, tournamentId)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Assign failed')
        return
      }
      toast.success('Organizer assigned!')
      setEmail('')
      await load()
    })
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      try {
        await removeOrganizer(supabase, userId, tournamentId)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Remove failed')
        return
      }
      toast.success('Organizer removed.')
      await load()
    })
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <h2 className="text-base font-bold text-slate-900">Organizers</h2>

      <form onSubmit={handleAssign} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="organizer@example.com"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          type="submit"
          disabled={isPending || !email.trim()}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          Assign
        </button>
      </form>

      {organizers.length === 0 ? (
        <p className="text-sm text-slate-400">No organizers assigned to this tournament.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {organizers.map(o => (
            <li key={o.user_id} className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-700">{o.email}</span>
              <button
                onClick={() => handleRemove(o.user_id)}
                disabled={isPending}
                className="text-red-400 hover:text-red-600 disabled:opacity-30 text-sm font-medium"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
