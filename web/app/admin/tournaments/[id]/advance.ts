/**
 * Pure winner derivation for a knockout match. Returns the winning team id, or
 * null when the score is level (admin must pick) or a slot is unfilled.
 */
export function computeAutoWinner(m: {
  home_team_id: string | null
  away_team_id: string | null
  home_score: number
  away_score: number
}): string | null {
  if (!m.home_team_id || !m.away_team_id) return null
  if (m.home_score > m.away_score) return m.home_team_id
  if (m.away_score > m.home_score) return m.away_team_id
  return null
}
