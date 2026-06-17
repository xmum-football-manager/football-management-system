import type { MatchPhase, MatchStatus, TournamentFormat } from '@/lib/supabase/types'
import { isGroupPhaseMatch, isKnockoutPhaseMatch } from '@/lib/match-lifecycle'

export function canEditQualifiers(
  isAdmin: boolean,
  alreadySaved: boolean,
  bracketExists: boolean,
): boolean {
  return isAdmin && alreadySaved && !bracketExists
}

// True once at least one group match exists and every group match is finished.
// Classifies by the `phase` column (never group labels), so a knockout match
// between two same-group teams is not miscounted as an unfinished group match.
// This gates the knockout tab; the old group-label heuristic locked it forever
// when a same-group final appeared.
export function allGroupMatchesFinished(
  matches: Array<{ phase: MatchPhase | string | null; status: MatchStatus }>,
): boolean {
  const groupMatches = matches.filter(isGroupPhaseMatch)
  return groupMatches.length > 0 && groupMatches.every((m) => m.status === 'finished')
}

export function shouldShowKnockoutCTA(
  format: TournamentFormat,
  matches: Array<{ phase: MatchPhase; status: MatchStatus }>,
): boolean {
  if (format !== 'round_robin_knockout') return false
  if (!allGroupMatchesFinished(matches)) return false
  if (matches.some(isKnockoutPhaseMatch)) return false
  return true
}
