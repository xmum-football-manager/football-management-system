/**
 * Phase helpers shared across admin pages and MatchViews.
 *
 * WHY: isGroupStageMatch was copy-pasted into 4+ files. Any change to the
 * heuristic must now be made in exactly one place.
 *
 * NOTE: This is a heuristic — it infers phase from team group_label equality,
 * not from the match.phase column. If the phase column becomes reliable as
 * the sole source of truth, replace the body with `m.phase === 'group'`.
 */

type MatchTeamRef = { group_label: string | null }
type MatchWithTeamRefs = { home_team: MatchTeamRef; away_team: MatchTeamRef }

export function isGroupStageMatch(m: MatchWithTeamRefs): boolean {
  const h = m.home_team.group_label
  const a = m.away_team.group_label
  return !!h && !!a && h === a
}

export function isKnockoutMatch(m: MatchWithTeamRefs): boolean {
  return !isGroupStageMatch(m)
}
