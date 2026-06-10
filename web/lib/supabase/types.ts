export type Role = 'admin' | 'organizer' | 'scorekeeper'
export type TournamentFormat = 'round_robin' | 'round_robin_knockout' | 'knockout'
export type TournamentStatus = 'setup' | 'active' | 'finished' | 'archived'
export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'finished'
export type KnockoutStartRound = 'top_32' | 'top_16' | 'top_8' | 'semi' | 'final'
export type SeedingMethod = 'by_standings' | 'manual' | 'random'

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
  halftime_enabled: boolean
  minutes_per_half: number
  halftime_minutes: number | null
  extra_time_minutes: number | null
  penalty_shootout_enabled: boolean
  require_goal_player: boolean
  num_groups: number | null
  teams_per_group: number | null
  advance_per_group: number | null
  knockout_start_round: KnockoutStartRound | null
  seeding_method: SeedingMethod | null
  knockout_qualifiers: string[] | null
  min_players_per_team: number
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  tournament_id: string
  name: string
  group_label: string | null
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

export type MatchPhase = 'group' | 'knockout'
export type KnockoutRound = 'r32' | 'r16' | 'qf' | 'sf' | 'final'

export interface Match {
  id: string
  tournament_id: string
  home_team_id: string
  away_team_id: string
  match_time: string | null
  status: MatchStatus
  home_score: number
  away_score: number
  phase: MatchPhase
  knockout_round: string | null
  match_started_at: string | null
  match_finished_at: string | null
  halftime_started_at: string | null
  second_half_started_at: string | null
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

export interface MatchWithTeams extends Match {
  home_team: Team
  away_team: Team
  tournament: Tournament
}

export interface TeamWithPlayers extends Team {
  players: Player[]
}
