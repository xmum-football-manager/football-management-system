import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { HeroLive } from './HeroLive'
import type { MatchWithTeams } from '@/lib/supabase/types'

const meta: Meta<typeof HeroLive> = {
  component: HeroLive,
}
export default meta

type Story = StoryObj<typeof HeroLive>

const homeTeam = { id: 'team-1', tournament_id: 'tour-1', name: 'Red Lions',  group_label: null, logo_path: null, created_at: '2026-05-01T00:00:00Z' }
const awayTeam = { id: 'team-2', tournament_id: 'tour-1', name: 'Blue Hawks', group_label: null, logo_path: null, created_at: '2026-05-01T00:00:00Z' }

const baseMatch = {
  id: 'match-1',
  tournament_id: 'tour-1',
  home_team_id: 'team-1',
  away_team_id: 'team-2',
  match_time: '2026-05-15T10:00:00+08:00',
  phase: 'group' as const,
  knockout_round: null,
  home_source_match_id: null,
  away_source_match_id: null,
  winner_team_id: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-15T10:00:00Z',
  home_team: homeTeam,
  away_team: awayTeam,
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
      halftime_started_at: null,
      second_half_started_at: null,
  scorekeeper_token: 'aaaaaaaa-0000-0000-0000-000000000000',
    } satisfies MatchWithTeams,
  },
}

export const Halftime: Story = {
  args: {
    match: {
      ...baseMatch,
      status: 'halftime',
      home_score: 1,
      away_score: 0,
      match_started_at: new Date(Date.now() - 50 * 60000).toISOString(),
      match_finished_at: null,
      halftime_started_at: new Date(Date.now() - 5 * 60000).toISOString(),
      second_half_started_at: null,
  scorekeeper_token: 'aaaaaaaa-0000-0000-0000-000000000000',
    } satisfies MatchWithTeams,
  },
}

export const SecondHalf: Story = {
  args: {
    match: {
      ...baseMatch,
      status: 'live',
      home_score: 1,
      away_score: 1,
      match_started_at: new Date(Date.now() - 65 * 60000).toISOString(),
      match_finished_at: null,
      halftime_started_at: new Date(Date.now() - 20 * 60000).toISOString(),
      second_half_started_at: new Date(Date.now() - 5 * 60000).toISOString(),
      scorekeeper_token: 'aaaaaaaa-0000-0000-0000-000000000000',
    } satisfies MatchWithTeams,
  },
}

export const JustStarted: Story = {
  args: {
    match: {
      ...baseMatch,
      status: 'live',
      home_score: 0,
      away_score: 0,
      match_started_at: new Date(Date.now() - 3 * 60000).toISOString(),
      match_finished_at: null,
      halftime_started_at: null,
      second_half_started_at: null,
  scorekeeper_token: 'aaaaaaaa-0000-0000-0000-000000000000',
    } satisfies MatchWithTeams,
  },
}
