import type { MatchPhase, MatchStatus, TournamentFormat } from '@/lib/supabase/types'

export function canEditQualifiers(
  isAdmin: boolean,
  alreadySaved: boolean,
  bracketExists: boolean,
): boolean {
  return isAdmin && alreadySaved && !bracketExists
}

export function shouldShowKnockoutCTA(
  format: TournamentFormat,
  matches: Array<{ phase: MatchPhase; status: MatchStatus }>,
): boolean {
  if (format !== 'round_robin_knockout') return false
  const groupMatches = matches.filter((m) => m.phase === 'group')
  if (groupMatches.length === 0) return false
  if (!groupMatches.every((m) => m.status === 'finished')) return false
  if (matches.some((m) => m.phase === 'knockout')) return false
  return true
}
