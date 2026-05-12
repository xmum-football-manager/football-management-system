import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StandingsCard } from './StandingsCard'
import type { Standing } from '@/lib/supabase/types'

const meta: Meta<typeof StandingsCard> = {
  component: StandingsCard,
}
export default meta

type Story = StoryObj<typeof StandingsCard>

const standings: Standing[] = [
  { tournament_id: 'tour-1', team_id: 'team-1', team_name: 'Red Lions',    matches_played: 4, wins: 3, draws: 1, losses: 0, goals_scored: 10, goals_conceded: 4, goal_difference: 6,  points: 10 },
  { tournament_id: 'tour-1', team_id: 'team-2', team_name: 'Blue Hawks',   matches_played: 4, wins: 2, draws: 1, losses: 1, goals_scored: 7,  goals_conceded: 5, goal_difference: 2,  points: 7  },
  { tournament_id: 'tour-1', team_id: 'team-3', team_name: 'Green Eagles', matches_played: 4, wins: 1, draws: 0, losses: 3, goals_scored: 5,  goals_conceded: 9, goal_difference: -4, points: 3  },
  { tournament_id: 'tour-1', team_id: 'team-4', team_name: 'Gold Tigers',  matches_played: 4, wins: 0, draws: 2, losses: 2, goals_scored: 3,  goals_conceded: 7, goal_difference: -4, points: 2  },
]

export const Default: Story = {
  args: { standings },
}

export const TwoTeams: Story = {
  args: {
    standings: standings.slice(0, 2),
  },
}
