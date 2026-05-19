'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getTournament, getCurrentUser, getUserRoles } from '@/lib/db/tournaments'
import { getMatches } from '@/lib/db/matches'
import { SettingsTab } from '../../SettingsTab'
import type { Tournament, MatchWithTeams } from '@/lib/supabase/types'

interface RoleInfo { role: string; tournament_id: string | null }

export default function SetupSettingsPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const user = await getCurrentUser(supabase)
    if (!user) { window.location.href = '/login'; return }

    const [t, matchesData, roles] = await Promise.all([
      getTournament(supabase, id),
      getMatches(supabase, id),
      getUserRoles(supabase, user.id),
    ])

    if (!t) { router.push('/admin'); return }

    setTournament(t)
    setMatches(matchesData)
    setIsAdmin(roles.some((r: RoleInfo) => r.role === 'admin'))
    setLoading(false)
  }, [id, router])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  if (loading || !tournament) return <div className="text-center py-16 text-slate-400">Loading…</div>

  return (
    <SettingsTab
      tournament={tournament}
      matches={matches}
      tournamentId={id}
      isAdmin={isAdmin}
      onRefresh={load}
    />
  )
}
