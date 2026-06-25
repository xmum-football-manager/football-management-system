// Pure helpers for the public home page — status mapping, accents, ticker, stats.
import { MY_TZ, malaysiaDate } from '@/lib/tz'
import type { Tournament, Team, MatchWithTeams, Standing } from '@/lib/supabase/types'

/** Display status on the home page (DB has no "live"/"upcoming" — derived from matches). */
export type HomeStatus = 'live' | 'active' | 'upcoming' | 'finished'

export function isLiveMatch(m: MatchWithTeams): boolean {
  return m.status === 'live' || m.status === 'halftime'
}

export function homeStatus(t: Tournament, matches: MatchWithTeams[]): HomeStatus {
  if (t.status === 'finished') return 'finished'
  const ms = matches.filter((m) => m.tournament_id === t.id)
  if (ms.some(isLiveMatch)) return 'live'
  // Nothing has kicked off yet → upcoming (also covers tournaments with no fixtures)
  if (ms.every((m) => m.status === 'scheduled')) return 'upcoming'
  return 'active'
}

// Accent palette from the design system (one stable color per tournament)
const ACCENTS = ['#A3E635', '#38BDF8', '#FB923C', '#F59E0B', '#7C3AED', '#DB2777']

/** Stable accent color for a tournament, hashed from its id (same scheme as teamColor). */
export function tournamentAccent(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return ACCENTS[h % ACCENTS.length]
}

/** "Starts today" / "Starts tomorrow" / "Starts in N days" — date-string arithmetic, no TZ shift. */
export function startsIn(startDate: string, now: Date = new Date()): string {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((start.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return 'Starting soon'
  if (days === 0) return 'Starts today'
  if (days === 1) return 'Starts tomorrow'
  return `Starts in ${days} days`
}

/** Champion of a finished tournament — knockout: winner of the final; league: table leader. */
export function tournamentChampion(
  t: Tournament,
  matches: MatchWithTeams[],
  standings: Standing[],
  teams: Team[],
): { team: Team; note: string } | null {
  if (t.status !== 'finished') return null
  if (t.format === 'round_robin') {
    const rows = standings
      .filter((s) => s.tournament_id === t.id)
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
        return a.team_name.localeCompare(b.team_name)
      })
    const top = rows[0]
    const team = top && teams.find((x) => x.id === top.team_id)
    return team ? { team, note: `Top of table · ${top.points} pts` } : null
  }
  const ko = matches.filter(
    (m) => m.tournament_id === t.id && m.phase === 'knockout' && m.status === 'finished',
  )
  const final = ko.find((m) => m.knockout_round === 'final') ?? ko[ko.length - 1]
  if (!final || final.home_score === final.away_score) return null
  const won = final.home_score > final.away_score
  return {
    team: won ? final.home_team : final.away_team,
    note: `Final ${Math.max(final.home_score, final.away_score)}–${Math.min(final.home_score, final.away_score)}`,
  }
}

export interface TickerItem {
  tag: string
  text: string
}

/** Cross-tournament headlines: live scores first, then next kickoffs, then recent results. */
export function buildTicker(
  tournaments: Tournament[],
  matches: MatchWithTeams[],
  now: Date = new Date(),
): TickerItem[] {
  const name = new Map(tournaments.map((t) => [t.id, t.name]))
  const tag = (m: MatchWithTeams) => name.get(m.tournament_id) ?? 'Match'

  const live = matches.filter(isLiveMatch).map((m) => ({
    tag: tag(m),
    text: `${m.home_team.name} ${m.home_score}–${m.away_score} ${m.away_team.name} · ${m.status === 'halftime' ? 'HT' : 'LIVE'}`,
  }))

  const upcoming = matches
    .filter((m) => m.status === 'scheduled' && m.match_time && new Date(m.match_time) > now)
    .sort((a, b) => new Date(a.match_time!).getTime() - new Date(b.match_time!).getTime())
    .slice(0, 3)
    .map((m) => ({
      tag: tag(m),
      text: `${m.home_team.name} vs ${m.away_team.name} · ${new Date(m.match_time!).toLocaleString('en-MY', { timeZone: MY_TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}`,
    }))

  const results = matches
    .filter((m) => m.status === 'finished')
    .sort(
      (a, b) =>
        new Date(b.match_finished_at ?? b.match_time ?? 0).getTime() -
        new Date(a.match_finished_at ?? a.match_time ?? 0).getTime(),
    )
    .slice(0, 4)
    .map((m) => ({
      tag: tag(m),
      text: `FT · ${m.home_team.name} ${m.home_score}–${m.away_score} ${m.away_team.name}`,
    }))

  return [...live, ...upcoming, ...results]
}

export interface HomeStats {
  tournaments: number
  teams: number
  matchesToday: number
  goalsThisWeek: number
}

/** Hero counters: active tournaments, teams competing, matches today, goals this week. */
export function homeStats(
  tournaments: Tournament[],
  matches: MatchWithTeams[],
  teams: Team[],
  now: Date = new Date(),
): HomeStats {
  const activeIds = new Set(tournaments.filter((t) => t.status !== 'finished').map((t) => t.id))
  const today = malaysiaDate(now.toISOString())
  const sameDay = (d: Date) => malaysiaDate(d.toISOString()) === today
  const weekAgo = now.getTime() - 7 * 86_400_000
  return {
    tournaments: activeIds.size,
    teams: teams.filter((tm) => activeIds.has(tm.tournament_id)).length,
    matchesToday: matches.filter((m) => m.match_time && sameDay(new Date(m.match_time))).length,
    goalsThisWeek: matches
      .filter((m) => m.status !== 'scheduled' && m.match_time && new Date(m.match_time).getTime() >= weekAgo)
      .reduce((sum, m) => sum + m.home_score + m.away_score, 0),
  }
}

export function statusBadge(status: string) {
  if (status === 'active') return {
    bg: 'rgba(163,230,53,0.12)',
    border: 'rgba(163,230,53,0.45)',
    color: 'var(--brand-lime)',
    label: 'Active',
  }
  if (status === 'setup') return {
    bg: 'rgba(56,189,248,0.12)',
    border: 'rgba(56,189,248,0.4)',
    color: '#7DD3FC',
    label: 'Setup',
  }
  return {
    bg: 'var(--ink-800)',
    border: 'var(--ink-700)',
    color: 'var(--ink-300)',
    label: 'Finished',
  }
}

export function statusRail(status: string) {
  if (status === 'active') return 'var(--brand-lime)'
  if (status === 'setup') return '#7DD3FC'
  return 'var(--ink-600)'
}

export function formatDateRange(start: string, end: string | null) {
  const s = new Date(start).toLocaleDateString('en-MY', { timeZone: MY_TZ, day: 'numeric', month: 'short' })
  if (!end) return s
  const e = new Date(end).toLocaleDateString('en-MY', { timeZone: MY_TZ, day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

export function formatLabel(fmt: string) {
  if (fmt === 'knockout') return 'Knockout'
  if (fmt === 'round_robin_knockout') return 'Round Robin + Knockout'
  return 'Round Robin'
}
