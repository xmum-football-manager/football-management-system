'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Play, Loader2 } from 'lucide-react'
import { transitionMatchAction } from './actions'
import type { MatchWithTeams } from '@/lib/supabase/types'

interface Props {
  match: MatchWithTeams
  isAdmin: boolean
  hasLiveMatch: boolean
}

export function UpNextRow({ match, isAdmin, hasLiveMatch }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function kickoff() {
    startTransition(async () => {
      const r = await transitionMatchAction(match.id, 'live', isAdmin)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Kickoff started.')
        router.refresh()
      }
    })
  }

  const time = match.match_time
    ? new Date(match.match_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null

  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div>
        <p className="font-semibold text-sm">
          {match.home_team.name} vs {match.away_team.name}
        </p>
        {time && <p className="text-xs text-muted-foreground mt-0.5">{time}</p>}
      </div>
      <Button
        size="sm"
        disabled={pending || hasLiveMatch}
        onClick={kickoff}
        title={hasLiveMatch ? 'Finish the current match first' : undefined}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Kickoff
      </Button>
    </div>
  )
}
