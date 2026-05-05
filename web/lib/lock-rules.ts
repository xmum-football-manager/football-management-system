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

// Name is locked 14 days before the tournament start date
export function canEditTournamentName(
  tournamentStatus: TournamentStatus,
  startDate: string,
): boolean {
  if (FULLY_LOCKED.includes(tournamentStatus)) return false
  const deadline = new Date(startDate)
  deadline.setDate(deadline.getDate() - 14)
  return new Date() <= deadline
}

// Venue and description are only editable before the tournament goes live
export function canEditVenueDescription(tournamentStatus: TournamentStatus): boolean {
  return tournamentStatus === 'setup'
}

export function canEditFormat(
  tournamentStatus: TournamentStatus,
  firstMatchScheduledAt: string | null,
): boolean {
  return tournamentStatus === 'setup' && firstMatchScheduledAt === null
}
