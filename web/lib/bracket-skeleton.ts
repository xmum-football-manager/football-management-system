import { KNOCKOUT_ROUND_ORDER, type KnockoutRound } from '@/lib/bracket'

/** Allowed first-round bracket sizes (number of teams entering round 1). */
export const POWER_OF_TWO_SIZES = [2, 4, 8, 16, 32] as const

export interface SkeletonPairing {
  home_team_id: string
  away_team_id: string
  match_time: string | null
}

export interface SkeletonNode {
  knockout_round: KnockoutRound
  home_team_id: string | null
  away_team_id: string | null
  match_time: string | null
  /** Index (into the returned node array) of the feeder match for the home slot, or null for round 1. */
  home_source_index: number | null
  away_source_index: number | null
}

/**
 * Given N round-1 pairings, build descriptors for EVERY round of the bracket.
 * Round 1 nodes carry concrete team ids; later-round nodes have null team ids
 * and reference their two feeder matches by index. Feeders are wired so that
 * matches 0,1 feed the first next-round match, 2,3 feed the second, etc.
 *
 * Round labels are assigned from the END of KNOCKOUT_ROUND_ORDER: the single
 * last round is always 'final', the round before it 'sf', etc.
 */
export function buildBracketSkeleton(pairings: SkeletonPairing[]): SkeletonNode[] {
  const teamCount = pairings.length * 2
  if (!POWER_OF_TWO_SIZES.includes(teamCount as (typeof POWER_OF_TWO_SIZES)[number])) {
    throw new Error(
      `Bracket size must be a power of two (${POWER_OF_TWO_SIZES.join(', ')} teams). Got ${teamCount}.`,
    )
  }

  // Number of rounds = log2(teamCount). Labels are the LAST `rounds` entries of
  // KNOCKOUT_ROUND_ORDER so the final round is always 'final'.
  const roundCount = Math.log2(teamCount)
  const roundLabels = KNOCKOUT_ROUND_ORDER.slice(KNOCKOUT_ROUND_ORDER.length - roundCount)

  const nodes: SkeletonNode[] = []
  // Track the node indices produced by the previous round, in order.
  let prevRoundIndices: number[] = []

  for (let r = 0; r < roundCount; r++) {
    const round = roundLabels[r]
    const matchesThisRound = pairings.length / 2 ** r
    const thisRoundIndices: number[] = []
    for (let i = 0; i < matchesThisRound; i++) {
      const node: SkeletonNode =
        r === 0
          ? {
              knockout_round: round,
              home_team_id: pairings[i].home_team_id,
              away_team_id: pairings[i].away_team_id,
              match_time: pairings[i].match_time,
              home_source_index: null,
              away_source_index: null,
            }
          : {
              knockout_round: round,
              home_team_id: null,
              away_team_id: null,
              match_time: null,
              home_source_index: prevRoundIndices[i * 2],
              away_source_index: prevRoundIndices[i * 2 + 1],
            }
      thisRoundIndices.push(nodes.length)
      nodes.push(node)
    }
    prevRoundIndices = thisRoundIndices
  }

  return nodes
}
