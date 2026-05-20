import type { Tournament, KnockoutStartRound } from '@/lib/supabase/types'

export function expectedGroupFixtures(t: Tournament): number {
  const n = t.num_groups ?? 0
  const m = t.teams_per_group ?? 0
  const result = n * ((m * (m - 1)) / 2)
  return result === 0 ? 0 : result
}

const FIRST_ROUND_MATCH_COUNT: Record<KnockoutStartRound, number> = {
  top_32: 16,
  top_16: 8,
  top_8: 4,
  semi: 2,
  final: 1,
}

export function expectedFirstRoundKOMatches(round: KnockoutStartRound | null): number {
  if (!round) return 0
  return FIRST_ROUND_MATCH_COUNT[round]
}
