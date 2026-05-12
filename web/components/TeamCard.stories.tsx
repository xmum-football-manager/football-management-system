import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { TeamCard } from './TeamCard'
import type { Team, Player, Standing } from '@/lib/supabase/types'

const meta: Meta<typeof TeamCard> = {
  component: TeamCard,
}
export default meta

type Story = StoryObj<typeof TeamCard>

const players: Player[] = [
  { id: 'p-1', team_id: 'team-1', name: 'Ahmad Farid',    jersey_number: 1,  position: 'GK',  created_at: '2026-05-01T00:00:00Z' },
  { id: 'p-2', team_id: 'team-1', name: 'Haziq Syafiq',   jersey_number: 5,  position: 'DEF', created_at: '2026-05-01T00:00:00Z' },
  { id: 'p-3', team_id: 'team-1', name: 'Danial Razif',   jersey_number: 7,  position: 'MID', created_at: '2026-05-01T00:00:00Z' },
  { id: 'p-4', team_id: 'team-1', name: 'Izzat Hakim',    jersey_number: 10, position: 'FWD', created_at: '2026-05-01T00:00:00Z' },
  { id: 'p-5', team_id: 'team-1', name: 'Syazwan Helmi',  jersey_number: 11, position: 'FWD', created_at: '2026-05-01T00:00:00Z' },
]

const team: Team & { players: Player[] } = {
  id: 'team-1',
  tournament_id: 'tour-1',
  name: 'Red Lions',
  created_at: '2026-05-01T00:00:00Z',
  players,
}

const standings: Standing[] = [
  { tournament_id: 'tour-1', team_id: 'team-1', team_name: 'Red Lions', matches_played: 4, wins: 3, draws: 1, losses: 0, goals_scored: 10, goals_conceded: 4, goal_difference: 6, points: 10 },
]

export const WithStandings: Story = {
  args: { team, standings },
}

export const NoStandings: Story = {
  args: { team, standings: [] },
}

export const EmptyRoster: Story = {
  args: {
    team: { ...team, id: 'team-2', name: 'Blue Hawks', players: [] },
    standings: [],
  },
}
