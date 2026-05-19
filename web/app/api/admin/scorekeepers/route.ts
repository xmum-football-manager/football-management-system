import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCurrentUser, getUserRoles } from '@/lib/db/tournaments'
import { getScorekeepersForTournament } from '@/lib/db/roles'

export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get('tournamentId')
  if (!tournamentId) return NextResponse.json({ error: 'Missing tournamentId' }, { status: 400 })

  const supabase = await createClient()
  const user = await getCurrentUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const callerRoles = await getUserRoles(supabase, user.id)
  const isAdmin = callerRoles.some(r => r.role === 'admin')
  const isOrganizer = callerRoles.some(r => r.role === 'organizer' && r.tournament_id === tournamentId)
  if (!isAdmin && !isOrganizer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const roles = await getScorekeepersForTournament(service, tournamentId)

  if (roles.length === 0) return NextResponse.json([])

  const { data: authUsers } = await service.auth.admin.listUsers({ perPage: 1000 })
  const userMap = new Map((authUsers?.users ?? []).map(u => [u.id, u.email ?? u.id]))

  const result = roles.map(r => ({
    user_id: r.user_id,
    email: userMap.get(r.user_id) ?? r.user_id,
    match_id: r.match_id,
  }))

  return NextResponse.json(result)
}
