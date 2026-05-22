import { Badge } from '@/components/ui/badge'
import type { TournamentStatus } from '@/lib/supabase/types'

const MAP: Record<TournamentStatus, { label: string; variant: 'success' | 'warning' | 'slate' | 'secondary' }> = {
  setup: { label: 'Setup', variant: 'warning' },
  active: { label: 'Active', variant: 'success' },
  finished: { label: 'Finished', variant: 'slate' },
  archived: { label: 'Archived', variant: 'secondary' },
}

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const m = MAP[status]
  return <Badge variant={m.variant}>{m.label}</Badge>
}
