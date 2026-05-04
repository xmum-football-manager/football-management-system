export type Role = 'admin' | 'organizer' | 'scorekeeper'
export type TournamentFormat = 'round_robin' | 'knockout'
export type TournamentStatus = 'setup' | 'active' | 'finished' | 'archived'
export type MatchStatus = 'scheduled' | 'live' | 'finished'

export interface Tournament {
  id: string
  name: string
  description: string | null
  location: string | null
  start_date: string
  end_date: string
  format: TournamentFormat
  points_win: number
  points_draw: number
  points_loss: number
  status: TournamentStatus
  first_match_scheduled_at: string | null
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  tournament_id: string
  name: string
  created_at: string
}

export interface Player {
  id: string
  team_id: string
  name: string
  jersey_number: number | null
  position: string | null
  created_at: string
}

export interface Match {
  id: string
  tournament_id: string
  home_team_id: string
  away_team_id: string
  match_time: string
  status: MatchStatus
  home_score: number
  away_score: number
  match_started_at: string | null
  match_finished_at: string | null
  created_at: string
  updated_at: string
}

export interface UserRole {
  id: string
  user_id: string
  role: Role
  tournament_id: string | null
  match_id: string | null
  created_at: string
}

export interface Standing {
  tournament_id: string
  team_id: string
  team_name: string
  matches_played: number
  wins: number
  draws: number
  losses: number
  goals_scored: number
  goals_conceded: number
  goal_difference: number
  points: number
}

// Joined types for UI
export interface MatchWithTeams extends Match {
  home_team: Team
  away_team: Team
}

export interface TeamWithPlayers extends Team {
  players: Player[]
}
