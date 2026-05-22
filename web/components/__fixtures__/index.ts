import type { Tournament, Team, Player, Match, Standing, MatchWithTeams } from '@/lib/supabase/types'

export const mockTeamHome: Team = {
  id: 'team-home-1',
  tournament_id: 'tournament-1',
  name: 'Red Lions FC',
  group_label: null,
  created_at: '2026-01-01T00:00:00Z',
}

export const mockTeamAway: Team = {
  id: 'team-away-1',
  tournament_id: 'tournament-1',
  name: 'Blue Eagles United',
  group_label: null,
  created_at: '2026-01-01T00:00:00Z',
}

export const mockPlayers: Player[] = [
  { id: 'p1', team_id: 'team-home-1', name: 'Ali Hassan',  jersey_number: 9, position: 'FW', created_at: '2026-01-01T00:00:00Z' },
  { id: 'p2', team_id: 'team-home-1', name: 'Raj Kumar',   jersey_number: 1, position: 'GK', created_at: '2026-01-01T00:00:00Z' },
  { id: 'p3', team_id: 'team-home-1', name: 'Wei Liang',   jersey_number: 4, position: 'CB', created_at: '2026-01-01T00:00:00Z' },
]

export const mockMatchLive: MatchWithTeams = {
  id: 'match-live-1',
  tournament_id: 'tournament-1',
  home_team_id: 'team-home-1',
  away_team_id: 'team-away-1',
  match_time: '2026-05-12T14:00:00Z',
  status: 'live',
  home_score: 2,
  away_score: 1,
  match_started_at: new Date(Date.now() - 37 * 60000).toISOString(),
  match_finished_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-05-12T14:00:00Z',
  home_team: mockTeamHome,
  away_team: mockTeamAway,
}

export const mockMatchScheduled: MatchWithTeams = {
  ...mockMatchLive,
  id: 'match-sched-1',
  status: 'scheduled',
  home_score: 0,
  away_score: 0,
  match_time: '2026-05-13T10:00:00Z',
  match_started_at: null,
}

export const mockMatchFinished: MatchWithTeams = {
  ...mockMatchLive,
  id: 'match-fin-1',
  status: 'finished',
  home_score: 3,
  away_score: 1,
  match_finished_at: '2026-05-12T15:35:00Z',
}

export const mockStandings: Standing[] = [
  { tournament_id: 'tournament-1', team_id: 'team-home-1', team_name: 'Red Lions FC',       matches_played: 4, wins: 3, draws: 1, losses: 0, goals_scored: 9,  goals_conceded: 3,  goal_difference: 6,  points: 10 },
  { tournament_id: 'tournament-1', team_id: 'team-away-1', team_name: 'Blue Eagles United', matches_played: 4, wins: 2, draws: 1, losses: 1, goals_scored: 7,  goals_conceded: 5,  goal_difference: 2,  points: 7  },
  { tournament_id: 'tournament-1', team_id: 'team-c',      team_name: 'Green Tigers',       matches_played: 4, wins: 1, draws: 0, losses: 3, goals_scored: 4,  goals_conceded: 8,  goal_difference: -4, points: 3  },
  { tournament_id: 'tournament-1', team_id: 'team-d',      team_name: 'Yellow Wolves SC',   matches_played: 4, wins: 0, draws: 0, losses: 4, goals_scored: 2,  goals_conceded: 11, goal_difference: -9, points: 0  },
]

export const mockTournament: Tournament = {
  id: 'tournament-1',
  name: 'KL City Cup 2026',
  description: 'Annual city football championship',
  location: 'Stadium Merdeka, KL',
  start_date: '2026-05-01',
  end_date: '2026-05-31',
  format: 'round_robin_knockout',
  points_win: 3,
  points_draw: 1,
  points_loss: 0,
  status: 'active',
  first_match_scheduled_at: '2026-05-01T09:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-05-12T00:00:00Z',
  halftime_enabled: true,
  minutes_per_half: 45,
  halftime_minutes: 15,
  extra_time_minutes: null,
  penalty_shootout_enabled: false,
  require_goal_player: false,
  num_groups: null,
  teams_per_group: null,
  advance_per_group: null,
  knockout_start_round: null,
  seeding_method: null,
  min_players_per_team: 11,
}

export const mockBracketMatches: MatchWithTeams[] = [
  // QF
  { ...mockMatchFinished,  id: 'qf-1', home_team: { ...mockTeamHome, name: 'Red Lions FC' },    away_team: { ...mockTeamAway, name: 'Blue Eagles United' }, home_score: 2, away_score: 0 },
  { ...mockMatchFinished,  id: 'qf-2', home_team: { ...mockTeamHome, name: 'Green Tigers' },     away_team: { ...mockTeamAway, name: 'Yellow Wolves SC' },  home_score: 1, away_score: 3 },
  { ...mockMatchScheduled, id: 'qf-3', home_team: { ...mockTeamHome, name: 'City Panthers' },   away_team: { ...mockTeamAway, name: 'East United' } },
  { ...mockMatchScheduled, id: 'qf-4', home_team: { ...mockTeamHome, name: 'River Sharks' },    away_team: { ...mockTeamAway, name: 'North Stars FC' } },
  // SF
  { ...mockMatchLive,      id: 'sf-1', home_team: { ...mockTeamHome, name: 'Red Lions FC' },    away_team: { ...mockTeamAway, name: 'Yellow Wolves SC' }, home_score: 1, away_score: 1 },
  { ...mockMatchScheduled, id: 'sf-2', home_team: { ...mockTeamHome, name: 'TBD' },              away_team: { ...mockTeamAway, name: 'TBD' } },
  // Final
  { ...mockMatchScheduled, id: 'final-1', home_team: { ...mockTeamHome, name: 'TBD' },          away_team: { ...mockTeamAway, name: 'TBD' } },
]

export const mockToastMessages = {
  success: 'Tournament saved successfully.',
  error:   'Failed to save. Please try again.',
  info:    'Scores updated.',
} as const

export const mockQrUrls = {
  default: 'https://football-manager.com/t/tournament-1',
  long:    'https://football-manager.com/t/kl-city-cup-2026-grand-final-knockout-stage',
} as const
