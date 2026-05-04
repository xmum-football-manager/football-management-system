'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import type { MatchWithTeams } from '@/lib/supabase/types'

interface Props {
  match: MatchWithTeams
  tournamentId: string
  isAdmin: boolean
}

export function MatchStatusControls({ match: m, tournamentId, isAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function transition(action: 'start' | 'finish' | 'revert') {
    startTransition(async () => {
      const supabase = createClient()

      if (action === 'start') {
        const { error } = await supabase
          .from('matches')
          .update({ status: 'live', match_started_at: new Date().toISOString() })
          .eq('id', m.id).eq('status', 'scheduled')
        if (error) { toast.error('Could not start match.'); return }
        toast.success('Match is now Live!')
      }

      if (action === 'finish') {
        const { error } = await supabase
          .from('matches')
          .update({ status: 'finished', match_finished_at: new Date().toISOString() })
          .eq('id', m.id).eq('status', 'live')
        if (error) { toast.error('Could not finish match.'); return }
        toast.success('Match finished.')
      }

      if (action === 'revert' && isAdmin) {
        const { error } = await supabase
          .from('matches')
          .update({ status: 'live', match_finished_at: null })
          .eq('id', m.id).eq('status', 'finished')
        if (error) { toast.error('Could not revert match.'); return }
        await supabase.from('admin_audit_log').insert({
          action: 'revert_finished_to_live',
          match_id: m.id,
          tournament_id: tournamentId,
          previous_status: 'finished',
          new_status: 'live',
        })
        toast.success('Match reverted to Live.')
      }

      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      {m.status === 'scheduled' && (
        <button onClick={() => transition('start')} disabled={isPending}
          className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
          Mark Live
        </button>
      )}
      {m.status === 'live' && (
        <button onClick={() => transition('finish')} disabled={isPending}
          className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
          Finish
        </button>
      )}
      {m.status === 'finished' && isAdmin && (
        <button onClick={() => transition('revert')} disabled={isPending}
          className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
          Revert
        </button>
      )}
    </div>
  )
}
