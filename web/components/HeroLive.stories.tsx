import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { HeroLive } from './HeroLive'
import type { MatchWithTeams } from '@/lib/supabase/types'

const meta: Meta<typeof HeroLive> = {
  component: HeroLive,
}
export default meta

type Story = StoryObj<typeof HeroLive>

const homeTeam = { id: 'team-1', tournament_id: 'tour-1', name: 'Red Lions',  group_label: null, created_at: '2026-05-01T00:00:00Z' }
const awayTeam = { id: 'team-2', tournament_id: 'tour-1', name: 'Blue Hawks', group_label: null, created_at: '2026-05-01T00:00:00Z' }

const baseMatch = {
  id: 'match-1',
  tournament_id: 'tour-1',
  home_team_id: 'team-1',
  away_team_id: 'team-2',
  match_time: '2026-05-15T10:00:00+08:00',
  phase: 'group' as const,
  knockout_round: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-15T10:00:00Z',
  home_source_match_id: null,
  away_source_match_id: null,
  winner_team_id: null,
  home_team: homeTeam,
  away_team: awayTeam,
}

export const Live: Story = {
  args: {
    variant: 'live',
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

export const Halftime: Story = {
  args: {
    variant: 'live',
    match: {
      ...baseMatch,
      status: 'halftime',
      home_score: 1,
      away_score: 0,
      match_started_at: new Date(Date.now() - 45 * 60000).toISOString(),
      match_finished_at: null,
    } satisfies MatchWithTeams,
  },
}

export const JustStarted: Story = {
  args: {
    variant: 'live',
    match: {
      ...baseMatch,
      status: 'live',
      home_score: 0,
      away_score: 0,
      match_started_at: new Date(Date.now() - 3 * 60000).toISOString(),
      match_finished_at: null,
    } satisfies MatchWithTeams,
  },
}

export const NextUp: Story = {
  args: {
    variant: 'nextup',
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

export const Done: Story = {
  args: {
    variant: 'done',
  },
}
