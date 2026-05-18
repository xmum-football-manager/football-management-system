'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { TabStrip, type TabId } from './TabStrip'
import { OverviewTab } from './OverviewTab'
import { TeamsTab } from './TeamsTab'
import { FixturesTab } from './FixturesTab'
import { SettingsTab } from './SettingsTab'
import { createClient } from '@/lib/supabase/client'
import { getTournament } from '@/lib/db/tournaments'
import { getTeams } from '@/lib/db/teams'
import { getMatches } from '@/lib/db/matches'
import { getCurrentUser, getUserRoles } from '@/lib/db/tournaments'
import type { Tournament, MatchWithTeams, TeamWithPlayers } from '@/lib/supabase/types'

interface RoleInfo { role: string; tournament_id: string | null }

export default function TournamentDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
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

    const admin = roles.some((r: RoleInfo) => r.role === 'admin') ?? false
    const organizer = admin || (roles.some((r: RoleInfo) => r.role === 'organizer' && r.tournament_id === id) ?? false)

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

  const teamsAlert = teams.some(t => t.players.length < tournament.min_players_per_team) ||
    (tournament.num_groups != null && tournament.teams_per_group != null &&
     teams.length < tournament.num_groups * tournament.teams_per_group)

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/t/${id}`

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="font-bold text-slate-900 truncate max-w-xs">{tournament.name}</span>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-green-600 hover:text-green-500 font-medium">
            Public View →
          </a>
        </div>
      </header>

      <TabStrip active={activeTab} onChange={setActiveTab} teamsAlert={teamsAlert} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <OverviewTab
            tournament={tournament}
            matches={matches}
            teams={teams}
            tournamentId={id}
            isAdmin={isAdmin}
            isOrganizer={isOrganizer}
            onRefresh={load}
          />
        )}
        {activeTab === 'teams' && (
          <TeamsTab
            teams={teams}
            tournamentStatus={tournament.status}
            tournamentId={id}
            minPlayers={tournament.min_players_per_team}
            onRefresh={load}
          />
        )}
        {activeTab === 'fixtures' && (
          <FixturesTab
            teams={teams}
            matches={matches}
            tournamentStatus={tournament.status}
            tournamentId={id}
            onRefresh={load}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            tournament={tournament}
            matches={matches}
            tournamentId={id}
            isAdmin={isAdmin}
            onRefresh={load}
          />
        )}
      </main>
    </div>
  )
}
