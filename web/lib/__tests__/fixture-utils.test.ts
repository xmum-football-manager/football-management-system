import { describe, it, expect } from 'vitest'
import { expectedGroupFixtures, expectedFirstRoundKOMatches } from '../fixture-utils'
import type { Tournament } from '@/lib/supabase/types'

function makeTournament(overrides: Partial<Tournament>): Tournament {
  return {
    id: 't1', name: 'T', description: null, location: null,
    start_date: '2026-06-01', end_date: '2026-06-10',
    format: 'round_robin', points_win: 3, points_draw: 1, points_loss: 0,
    status: 'setup', first_match_scheduled_at: null,
    halftime_enabled: true, minutes_per_half: 45, halftime_minutes: 15,
    extra_time_minutes: null, penalty_shootout_enabled: false,
    require_goal_player: false, num_groups: null, teams_per_group: null,
    advance_per_group: null, knockout_start_round: null, seeding_method: null,
    min_players_per_team: 5, created_at: '', updated_at: '',
    ...overrides,
  }
}

describe('expectedGroupFixtures', () => {
  it('returns 0 when num_groups or teams_per_group is null', () => {
    expect(expectedGroupFixtures(makeTournament({}))).toBe(0)
    expect(expectedGroupFixtures(makeTournament({ num_groups: 2 }))).toBe(0)
    expect(expectedGroupFixtures(makeTournament({ teams_per_group: 4 }))).toBe(0)
  })
  it('returns 6 for 1 group of 4 teams (single round-robin)', () => {
    expect(expectedGroupFixtures(makeTournament({ num_groups: 1, teams_per_group: 4 }))).toBe(6)
  })
  it('returns 12 for 2 groups of 4 teams', () => {
    expect(expectedGroupFixtures(makeTournament({ num_groups: 2, teams_per_group: 4 }))).toBe(12)
  })
  it('returns 3 for 1 group of 3 teams', () => {
    expect(expectedGroupFixtures(makeTournament({ num_groups: 1, teams_per_group: 3 }))).toBe(3)
  })
  it('returns 0 for 1 group of 1 team', () => {
    expect(expectedGroupFixtures(makeTournament({ num_groups: 1, teams_per_group: 1 }))).toBe(0)
  })
})

describe('expectedFirstRoundKOMatches', () => {
  it('returns 0 for null', () => {
    expect(expectedFirstRoundKOMatches(null)).toBe(0)
  })
  it('returns correct match counts per round', () => {
    expect(expectedFirstRoundKOMatches('top_32')).toBe(16)
    expect(expectedFirstRoundKOMatches('top_16')).toBe(8)
    expect(expectedFirstRoundKOMatches('top_8')).toBe(4)
    expect(expectedFirstRoundKOMatches('semi')).toBe(2)
    expect(expectedFirstRoundKOMatches('final')).toBe(1)
  })
})
