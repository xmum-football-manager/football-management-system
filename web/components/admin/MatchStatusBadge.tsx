import { Badge } from '@/components/ui/badge'
import type { MatchStatus } from '@/lib/supabase/types'

const MAP: Record<MatchStatus, { label: string; variant: 'success' | 'warning' | 'slate' | 'secondary' | 'outline' }> = {
  scheduled: { label: 'Scheduled', variant: 'outline' },
  live: { label: 'Live', variant: 'success' },
  halftime: { label: 'Half time', variant: 'warning' },
  finished: { label: 'Full time', variant: 'slate' },
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const m = MAP[status]
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold px-2.5 py-0.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Live
      </span>
    )
  }
  return <Badge variant={m.variant}>{m.label}</Badge>
}
