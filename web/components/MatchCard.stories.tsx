import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MatchCard } from './MatchCard'
import type { MatchWithTeams } from '@/lib/supabase/types'

const meta: Meta<typeof MatchCard> = {
  component: MatchCard,
}
export default meta

type Story = StoryObj<typeof MatchCard>

const homeTeam = { id: 'team-1', tournament_id: 'tour-1', name: 'Red Lions', group_label: null, created_at: '2026-05-01T00:00:00Z' }
const awayTeam = { id: 'team-2', tournament_id: 'tour-1', name: 'Blue Hawks', group_label: null, created_at: '2026-05-01T00:00:00Z' }

const baseMatch = {
  id: 'match-1',
  tournament_id: 'tour-1',
  home_team_id: 'team-1',
  away_team_id: 'team-2',
  match_time: '2026-05-15T10:00:00+08:00',
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-15T10:00:00Z',
  home_team: homeTeam,
  away_team: awayTeam,
}

export const Scheduled: Story = {
  args: {
    match: {
      ...baseMatch,
      status: 'scheduled',
      home_score: 0,
      away_score: 0,
      match_started_at: null,
      match_finished_at: null,
    } satisfies MatchWithTeams,
  },
}

export const Live: Story = {
  args: {
    match: {
      ...baseMatch,
      status: 'live',
      home_score: 2,
      away_score: 1,
      match_started_at: new Date(Date.now() - 35 * 60000).toISOString(),
      match_finished_at: null,
    } satisfies MatchWithTeams,
  },
}

export const Finished: Story = {
  args: {
    match: {
      ...baseMatch,
      status: 'finished',
      home_score: 3,
      away_score: 2,
      match_started_at: '2026-05-15T10:00:00+08:00',
      match_finished_at: '2026-05-15T10:50:00+08:00',
    } satisfies MatchWithTeams,
  },
}

export const Draw: Story = {
  args: {
    match: {
      ...baseMatch,
      id: 'match-2',
      status: 'finished',
      home_score: 1,
      away_score: 1,
      match_started_at: '2026-05-15T12:00:00+08:00',
      match_finished_at: '2026-05-15T12:50:00+08:00',
    } satisfies MatchWithTeams,
  },
}
