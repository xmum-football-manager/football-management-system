'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getTournament, getCurrentUser, getUserRoles } from '@/lib/db/tournaments'
import { getTeams } from '@/lib/db/teams'
import { getMatches } from '@/lib/db/matches'
import { TabStrip } from '../TabStrip'
import { SetupProvider, type SetupContextValue } from './SetupContext'
import type { Tournament, MatchWithTeams, TeamWithPlayers } from '@/lib/supabase/types'

interface RoleInfo { role: string; tournament_id: string | null }

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<TeamWithPlayers[]>([])
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOrganizer, setIsOrganizer] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const user = await getCurrentUser(supabase)
    if (!user) { window.location.href = '/login'; return }

    const [t, teamsData, matchesData, roles] = await Promise.all([
      getTournament(supabase, id),
      getTeams(supabase, id),
      getMatches(supabase, id),
      getUserRoles(supabase, user.id),
    ])

    if (!t) { router.push('/admin'); return }

    const admin = roles.some((r: RoleInfo) => r.role === 'admin')
    const organizer = admin || roles.some((r: RoleInfo) => r.role === 'organizer' && r.tournament_id === id)

    if (!organizer) { router.push('/admin'); return }

    setTournament(t)
    setTeams(teamsData)
    setMatches(matchesData)
    setIsAdmin(admin)
    setIsOrganizer(organizer)
    setLoading(false)
  }, [id, router])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  if (loading || !tournament) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    )
  }

  const value: SetupContextValue = { tournament, teams, matches, isAdmin, isOrganizer, refresh: load }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="font-bold text-slate-900 truncate max-w-xs">{tournament.name}</span>
          <div className="w-20" />
        </div>
      </header>
      <TabStrip
          showBracketTab={tournament.format === 'round_robin_knockout' && tournament.status === 'bracket_setup'}
        />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <SetupProvider value={value}>{children}</SetupProvider>
      </main>
    </div>
  )
}
