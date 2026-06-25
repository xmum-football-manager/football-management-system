import { describe, it, expect } from 'vitest'
import {
  homeStatus,
  tournamentAccent,
  startsIn,
  tournamentChampion,
  buildTicker,
  homeStats,
  formatDateRange,
  formatLabel,
} from '@/lib/home-utils'
import type { Tournament, Team, MatchWithTeams, Standing } from '@/lib/supabase/types'

// ── Minimal fixture builders ────────────────────────────────────────────────
const tournament = (over: Partial<Tournament> = {}): Tournament =>
  ({
    id: 't-1',
    name: 'Test Cup',
    status: 'active',
    format: 'round_robin',
    start_date: '2026-06-10',
    end_date: '2026-06-20',
    ...over,
  }) as Tournament

const team = (id: string, name: string): Team =>
  ({ id, tournament_id: 't-1', name, group_label: null, logo_path: null, created_at: '' }) as Team

const home = team('team-a', 'Red Lions')
const away = team('team-b', 'Blue Eagles')

const match = (over: Partial<MatchWithTeams> = {}): MatchWithTeams =>
  ({
    id: 'm-1',
    tournament_id: 't-1',
    home_team_id: home.id,
    away_team_id: away.id,
    match_time: '2026-06-10T14:00:00Z',
    status: 'scheduled',
    home_score: 0,
    away_score: 0,
    phase: 'group',
    knockout_round: null,
    match_started_at: null,
    match_finished_at: null,
    home_team: home,
    away_team: away,
    ...over,
  }) as MatchWithTeams

// ── homeStatus ───────────────────────────────────────────────────────────────
describe('homeStatus', () => {
  it('finished tournament returns finished', () => {
    expect(homeStatus(tournament({ status: 'finished' }), [])).toBe('finished')
  })

  it('active tournament with a live match returns live', () => {
    expect(homeStatus(tournament(), [match({ status: 'live' })])).toBe('live')
  })

  it('halftime counts as live', () => {
    expect(homeStatus(tournament(), [match({ status: 'halftime' })])).toBe('live')
  })

  it('active tournament with only scheduled matches returns upcoming', () => {
    expect(homeStatus(tournament(), [match()])).toBe('upcoming')
  })

  it('active tournament with no matches returns upcoming', () => {
    expect(homeStatus(tournament(), [])).toBe('upcoming')
  })

  it('active tournament with finished matches but none live returns active', () => {
    expect(homeStatus(tournament(), [match({ status: 'finished' }), match({ id: 'm-2' })])).toBe('active')
  })

  it('ignores matches from other tournaments', () => {
    expect(homeStatus(tournament(), [match({ tournament_id: 'other', status: 'live' })])).toBe('upcoming')
  })
})

// ── tournamentAccent ─────────────────────────────────────────────────────────
describe('tournamentAccent', () => {
  it('is stable for the same id', () => {
    expect(tournamentAccent('abc-123')).toBe(tournamentAccent('abc-123'))
  })

  it('returns a hex color', () => {
    expect(tournamentAccent('any-id')).toMatch(/^#[0-9A-F]{6}$/i)
  })
})

// ── startsIn ─────────────────────────────────────────────────────────────────
describe('startsIn', () => {
  const now = new Date(2026, 5, 7, 15, 30) // 7 Jun 2026 local

  it('same day returns Starts today', () => {
    expect(startsIn('2026-06-07', now)).toBe('Starts today')
  })

  it('next day returns Starts tomorrow', () => {
    expect(startsIn('2026-06-08', now)).toBe('Starts tomorrow')
  })

  it('future date returns Starts in N days', () => {
    expect(startsIn('2026-06-10', now)).toBe('Starts in 3 days')
  })

  it('past date returns Starting soon', () => {
    expect(startsIn('2026-06-01', now)).toBe('Starting soon')
  })
})

// ── tournamentChampion ───────────────────────────────────────────────────────
describe('tournamentChampion', () => {
  it('returns null for non-finished tournaments', () => {
    expect(tournamentChampion(tournament(), [], [], [home, away])).toBeNull()
  })

  it('round robin: table leader by points wins', () => {
    const standings = [
      { tournament_id: 't-1', team_id: 'team-a', team_name: 'Red Lions', points: 9, goal_difference: 5 },
      { tournament_id: 't-1', team_id: 'team-b', team_name: 'Blue Eagles', points: 7, goal_difference: 8 },
    ] as Standing[]
    const champ = tournamentChampion(
      tournament({ status: 'finished', format: 'round_robin' }),
      [],
      standings,
      [home, away],
    )
    expect(champ?.team.id).toBe('team-a')
    expect(champ?.note).toBe('Top of table · 9 pts')
  })

  it('round robin: goal difference breaks point ties', () => {
    const standings = [
      { tournament_id: 't-1', team_id: 'team-a', team_name: 'Red Lions', points: 9, goal_difference: 2 },
      { tournament_id: 't-1', team_id: 'team-b', team_name: 'Blue Eagles', points: 9, goal_difference: 6 },
    ] as Standing[]
    const champ = tournamentChampion(
      tournament({ status: 'finished', format: 'round_robin' }),
      [],
      standings,
      [home, away],
    )
    expect(champ?.team.id).toBe('team-b')
  })

  it('knockout: winner of the final', () => {
    const final = match({
      phase: 'knockout',
      knockout_round: 'final',
      status: 'finished',
      home_score: 1,
      away_score: 3,
    })
    const champ = tournamentChampion(
      tournament({ status: 'finished', format: 'knockout' }),
      [final],
      [],
      [home, away],
    )
    expect(champ?.team.id).toBe('team-b')
    expect(champ?.note).toBe('Final 3–1')
  })

  it('knockout: drawn final yields no champion', () => {
    const final = match({
      phase: 'knockout',
      knockout_round: 'final',
      status: 'finished',
      home_score: 2,
      away_score: 2,
    })
    expect(
      tournamentChampion(tournament({ status: 'finished', format: 'knockout' }), [final], [], [home, away]),
    ).toBeNull()
  })
})

// ── buildTicker ──────────────────────────────────────────────────────────────
describe('buildTicker', () => {
  const now = new Date('2026-06-07T12:00:00Z')
  const ts = [tournament({ name: 'XMUM Cup' })]

  it('live matches come first with score and LIVE marker', () => {
    const items = buildTicker(
      ts,
      [
        match({ id: 'fin', status: 'finished', home_score: 3, away_score: 1, match_time: '2026-06-06T10:00:00Z' }),
        match({ id: 'live', status: 'live', home_score: 2, away_score: 1 }),
      ],
      now,
    )
    expect(items[0]).toEqual({ tag: 'XMUM Cup', text: 'Red Lions 2–1 Blue Eagles · LIVE' })
  })

  it('halftime matches show HT', () => {
    const items = buildTicker(ts, [match({ status: 'halftime', home_score: 1, away_score: 0 })], now)
    expect(items[0].text).toContain('· HT')
  })

  it('finished matches appear as FT results', () => {
    const items = buildTicker(
      ts,
      [match({ status: 'finished', home_score: 3, away_score: 1, match_time: '2026-06-06T10:00:00Z' })],
      now,
    )
    expect(items[0].text).toBe('FT · Red Lions 3–1 Blue Eagles')
  })

  it('future scheduled matches appear as kickoffs; past scheduled are skipped', () => {
    const items = buildTicker(
      ts,
      [
        match({ id: 'past', status: 'scheduled', match_time: '2026-06-01T10:00:00Z' }),
        match({ id: 'future', status: 'scheduled', match_time: '2026-06-09T10:00:00Z' }),
      ],
      now,
    )
    expect(items).toHaveLength(1)
    expect(items[0].text).toContain('Red Lions vs Blue Eagles')
  })

  it('returns empty list when no matches', () => {
    expect(buildTicker(ts, [], now)).toEqual([])
  })
})

// ── homeStats ────────────────────────────────────────────────────────────────
describe('homeStats', () => {
  const now = new Date('2026-06-07T12:00:00Z')

  it('counts non-finished tournaments and their teams', () => {
    const ts = [
      tournament({ id: 't-1' }),
      tournament({ id: 't-2', status: 'finished' }),
    ]
    const teams = [team('a', 'A'), { ...team('b', 'B'), tournament_id: 't-2' } as Team]
    const stats = homeStats(ts, [], teams, now)
    expect(stats.tournaments).toBe(1)
    expect(stats.teams).toBe(1)
  })

  it('counts matches scheduled today', () => {
    // now = 2026-06-07T12:00:00Z = 20:00 MYT (June 7).
    // Use 08:00 UTC = 16:00 MYT — same Malaysia calendar day.
    const todayIso = '2026-06-07T08:00:00Z'
    const stats = homeStats(
      [tournament()],
      [match({ match_time: todayIso }), match({ id: 'm-2', match_time: '2026-06-20T10:00:00Z' })],
      [],
      now,
    )
    expect(stats.matchesToday).toBe(1)
  })

  it('sums goals from started matches within the last 7 days', () => {
    const stats = homeStats(
      [tournament()],
      [
        match({ status: 'finished', home_score: 3, away_score: 1, match_time: '2026-06-05T10:00:00Z' }),
        match({ id: 'm-2', status: 'live', home_score: 1, away_score: 0, match_time: '2026-06-07T10:00:00Z' }),
        // too old
        match({ id: 'm-3', status: 'finished', home_score: 5, away_score: 5, match_time: '2026-05-01T10:00:00Z' }),
        // scheduled — not counted
        match({ id: 'm-4', status: 'scheduled', match_time: '2026-06-07T20:00:00Z' }),
      ],
      [],
      now,
    )
    expect(stats.goalsThisWeek).toBe(5)
  })
})

// ── formatDateRange ──────────────────────────────────────────────────────────
describe('formatDateRange', () => {
  it('single date (null end) returns just start date formatted', () => {
    expect(formatDateRange('2025-01-15', null)).toBe('15 Jan')
  })

  it('date range returns "D Mon – D Mon YYYY" format', () => {
    expect(formatDateRange('2025-01-15', '2025-03-20')).toBe('15 Jan – 20 Mar 2025')
  })

  it('date range with different years returns cross-year format', () => {
    expect(formatDateRange('2024-12-01', '2025-01-15')).toBe('1 Dec – 15 Jan 2025')
  })

  it('date range same month returns correct format', () => {
    expect(formatDateRange('2025-06-01', '2025-06-30')).toBe('1 Jun – 30 Jun 2025')
  })
})

describe('formatLabel', () => {
  it('knockout returns Knockout', () => {
    expect(formatLabel('knockout')).toBe('Knockout')
  })

  it('round_robin returns Round Robin', () => {
    expect(formatLabel('round_robin')).toBe('Round Robin')
  })

  it('round_robin_knockout returns Round Robin + Knockout', () => {
    expect(formatLabel('round_robin_knockout')).toBe('Round Robin + Knockout')
  })

  it('unknown format defaults to Round Robin', () => {
    expect(formatLabel('unknown_format')).toBe('Round Robin')
  })
})
