import { createClient } from '@/lib/supabase/server'

export interface AuditEntry {
  id: string
  admin_user_id: string
  action: string
  match_id: string | null
  tournament_id: string | null
  previous_status: string | null
  new_status: string | null
  note: string | null
  created_at: string
}

export async function logMatchRevert(
  adminUserId: string,
  matchId: string,
  tournamentId: string,
  previousStatus: string,
  note?: string,
): Promise<void> {
  const supabase = await createClient()
  await supabase.from('admin_audit_log').insert({
    admin_user_id: adminUserId,
    action: 'match_revert',
    match_id: matchId,
    tournament_id: tournamentId,
    previous_status: previousStatus,
    new_status: 'live',
    note: note ?? null,
  })
}

export async function listAuditEntries(limit = 50): Promise<AuditEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as AuditEntry[]
}
