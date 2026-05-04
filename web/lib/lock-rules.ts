import type { MatchStatus, TournamentStatus } from '@/lib/supabase/types'

const LOCKED_TOURNAMENT_STATUSES: TournamentStatus[] = ['active', 'finished', 'archived']
const FULLY_LOCKED: TournamentStatus[] = ['finished', 'archived']

export function canEditDates(tournamentStatus: TournamentStatus): boolean {
  return !LOCKED_TOURNAMENT_STATUSES.includes(tournamentStatus)
}

export function canManageTeams(tournamentStatus: TournamentStatus): boolean {
  return !LOCKED_TOURNAMENT_STATUSES.includes(tournamentStatus)
}

export function canAddFixture(tournamentStatus: TournamentStatus): boolean {
  return !FULLY_LOCKED.includes(tournamentStatus)
}

export function canDeleteFixture(tournamentStatus: TournamentStatus): boolean {
  return !FULLY_LOCKED.includes(tournamentStatus)
}

export function canEditMatchTime(
  tournamentStatus: TournamentStatus,
  matchStatus: MatchStatus,
): boolean {
  if (FULLY_LOCKED.includes(tournamentStatus)) return false
  return matchStatus === 'scheduled'
}

export function canEditTournamentMeta(tournamentStatus: TournamentStatus): boolean {
  return !FULLY_LOCKED.includes(tournamentStatus)
}

export function canEditFormat(
  tournamentStatus: TournamentStatus,
  firstMatchScheduledAt: string | null,
): boolean {
  return tournamentStatus === 'setup' && firstMatchScheduledAt === null
}
