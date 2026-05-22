import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { BracketView } from './BracketView'
import type { MatchWithTeams } from '@/lib/supabase/types'

const meta: Meta<typeof BracketView> = {
  component: BracketView,
}
export default meta

type Story = StoryObj<typeof BracketView>

function makeTeam(id: string, name: string) {
  return { id, tournament_id: 'tour-1', name, group_label: null, created_at: '2026-05-01T00:00:00Z' }
}

function makeMatch(id: string, homeId: string, homeName: string, awayId: string, awayName: string, overrides: Partial<MatchWithTeams> = {}): MatchWithTeams {
  return {
    id,
    tournament_id: 'tour-1',
    home_team_id: homeId,
    away_team_id: awayId,
    match_time: '2026-06-07T10:00:00+08:00',
    status: 'scheduled',
    home_score: 0,
    away_score: 0,
    match_started_at: null,
    match_finished_at: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    home_team: makeTeam(homeId, homeName),
    away_team: makeTeam(awayId, awayName),
    ...overrides,
  }
}

// 7-match bracket: 4 QF + 2 SF + 1 F
const fullBracketMatches: MatchWithTeams[] = [
  // Quarterfinals
  makeMatch('m-qf1', 'team-1', 'Red Lions',     'team-8', 'Purple Wolves',  { status: 'finished', home_score: 2, away_score: 1, match_finished_at: '2026-06-07T10:50:00+08:00' }),
  makeMatch('m-qf2', 'team-2', 'Blue Hawks',    'team-7', 'Orange Foxes',   { status: 'finished', home_score: 0, away_score: 1, match_finished_at: '2026-06-07T11:50:00+08:00' }),
  makeMatch('m-qf3', 'team-3', 'Green Eagles',  'team-6', 'Silver Sharks',  { status: 'finished', home_score: 3, away_score: 2, match_finished_at: '2026-06-07T12:50:00+08:00' }),
  makeMatch('m-qf4', 'team-4', 'Gold Tigers',   'team-5', 'White Panthers', { status: 'live', home_score: 1, away_score: 0, match_started_at: new Date(Date.now() - 22 * 60000).toISOString() }),
  // Semifinals
  makeMatch('m-sf1', 'team-1', 'Red Lions',    'team-7', 'Orange Foxes',   { status: 'scheduled' }),
  makeMatch('m-sf2', 'team-3', 'Green Eagles', 'team-4', 'Gold Tigers',    { status: 'scheduled' }),
  // Final
  makeMatch('m-f1',  'team-1', 'Red Lions',    'team-3', 'Green Eagles',   { status: 'scheduled' }),
]

// Simple 3-match bracket: 2 SF + 1 F
const semiFinalBracketMatches: MatchWithTeams[] = [
  makeMatch('m-sf1', 'team-1', 'Red Lions',   'team-2', 'Blue Hawks',   { status: 'finished', home_score: 2, away_score: 0, match_finished_at: '2026-06-05T10:50:00+08:00' }),
  makeMatch('m-sf2', 'team-3', 'Green Eagles','team-4', 'Gold Tigers',  { status: 'finished', home_score: 1, away_score: 2, match_finished_at: '2026-06-05T12:50:00+08:00' }),
  makeMatch('m-f1',  'team-1', 'Red Lions',   'team-4', 'Gold Tigers',  { status: 'finished', home_score: 3, away_score: 1, match_finished_at: '2026-06-07T15:50:00+08:00' }),
]

export const FullBracketInProgress: Story = {
  args: { matches: fullBracketMatches },
}

export const FinalCompleted: Story = {
  args: { matches: semiFinalBracketMatches },
}

export const Empty: Story = {
  args: { matches: [] },
}
