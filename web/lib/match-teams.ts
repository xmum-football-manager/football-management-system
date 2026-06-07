import type { MatchWithTeams, Team } from '@/lib/supabase/types'

// The DB schema declares home_team_id/away_team_id NOT NULL, but the deployed
// data can contain knockout matches whose team join resolves to null (e.g.
// placeholder slots for undecided rounds). Normalize at the fetch boundary so
// MatchWithTeams's non-null teams hold everywhere downstream.
function tbdTeam(tournament_id: string): Team {
  return { id: '', tournament_id, name: 'TBD', group_label: null, logo_path: null, created_at: '' }
}

export function withTeamFallback(matches: MatchWithTeams[]): MatchWithTeams[] {
  return matches.map((m) =>
    m.home_team && m.away_team
      ? m
      : {
          ...m,
          home_team: m.home_team ?? tbdTeam(m.tournament_id),
          away_team: m.away_team ?? tbdTeam(m.tournament_id),
        },
  )
}
