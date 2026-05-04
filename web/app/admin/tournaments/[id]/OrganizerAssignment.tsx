'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'

interface OrganizerRow {
  user_id: string
  email: string
}

interface Props {
  tournamentId: string
}

export function OrganizerAssignment({ tournamentId }: Props) {
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([])
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/organizers?tournamentId=${tournamentId}`)
    if (res.ok) setOrganizers(await res.json())
  }, [tournamentId])

  useEffect(() => { load() }, [load])

  function assign(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const supabase = createClient()
      const { data: userId, error: userErr } = await supabase
        .rpc('get_user_id_by_email', { email_input: email.trim().toLowerCase() })
      if (userErr || !userId) { toast.error('User not found.'); return }

      const { error } = await supabase.from('user_roles').upsert(
        { user_id: userId, role: 'organizer', tournament_id: tournamentId },
        { onConflict: 'user_id,role,tournament_id' }
      )
      if (error) { toast.error(error.message); return }
      toast.success('Organizer assigned!')
      setEmail('')
      await load()
    })
  }

  function remove(userId: string) {
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'organizer')
        .eq('tournament_id', tournamentId)
      if (error) { toast.error(error.message); return }
      toast.success('Organizer removed.')
      await load()
    })
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <h2 className="text-base font-bold text-slate-900">Organizers</h2>

      <form onSubmit={assign} className="flex gap-2">
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
                onClick={() => remove(o.user_id)}
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
