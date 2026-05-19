'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/Toast'
import { getAvailableTransitions } from '@/lib/match-lifecycle'
import { createClient } from '@/lib/supabase/client'
import { transitionMatchStatus, logRevertAudit } from '@/lib/db/matches'
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
      const timestamps: { match_started_at?: string | null; match_finished_at?: string | null } = {}

      if (nextStatus === 'live' && m.status === 'scheduled') {
        timestamps.match_started_at = now
      } else if (nextStatus === 'finished') {
        timestamps.match_finished_at = now
      } else if (nextStatus === 'live' && m.status === 'finished') {
        timestamps.match_finished_at = null
      }

      try {
        await transitionMatchStatus(supabase, m.id, m.status, nextStatus, timestamps)
        if (nextStatus === 'live' && m.status === 'finished') {
          await logRevertAudit(supabase, m.id, tournamentId)
        }
        router.refresh()
      } catch {
        toast.error('Could not update match status.')
      }
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
