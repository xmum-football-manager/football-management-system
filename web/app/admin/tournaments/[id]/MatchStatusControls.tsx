'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import { getAvailableTransitions } from '@/lib/match-lifecycle'
import type { MatchWithTeams, MatchStatus } from '@/lib/supabase/types'

interface Props {
  match: MatchWithTeams
  tournamentId: string
  isAdmin: boolean
}

const actionStyles: Record<string, string> = {
  'Start Match': 'bg-green-600 hover:bg-green-500',
  'Half Time': 'bg-amber-500 hover:bg-amber-400',
  'Start 2nd Half': 'bg-green-600 hover:bg-green-500',
  'Full Time': 'bg-blue-600 hover:bg-blue-500',
  'Revert to Live': 'bg-amber-500 hover:bg-amber-400',
}

export function MatchStatusControls({ match: m, tournamentId, isAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function transition(nextStatus: MatchStatus) {
    startTransition(async () => {
      const supabase = createClient()
      const now = new Date().toISOString()

      const update: Record<string, string | null> = { status: nextStatus }
      if (nextStatus === 'live' && m.status === 'scheduled') {
        update.match_started_at = now
      } else if (nextStatus === 'finished') {
        update.match_finished_at = now
      } else if (nextStatus === 'live' && m.status === 'finished') {
        update.match_finished_at = null
      }

      const { error } = await supabase
        .from('matches')
        .update(update)
        .eq('id', m.id).eq('status', m.status)
      if (error) { toast.error('Could not update match status.'); return }

      if (nextStatus === 'live' && m.status === 'finished') {
        await supabase.from('admin_audit_log').insert({
          action: 'revert_finished_to_live',
          match_id: m.id,
          tournament_id: tournamentId,
          previous_status: 'finished',
          new_status: 'live',
        })
      }

      router.refresh()
    })
  }

  const transitions = getAvailableTransitions(m.status, isAdmin ? 'admin' : 'organizer')

  return (
    <div className="flex items-center gap-2">
      {transitions.map(({ action, nextStatus }) => (
        <button key={action} onClick={() => transition(nextStatus)} disabled={isPending}
          className={`text-xs ${actionStyles[action] ?? 'bg-slate-600 hover:bg-slate-500'} disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors`}>
          {action}
        </button>
      ))}
    </div>
  )
}
