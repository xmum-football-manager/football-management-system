/**
 * Knockout bracket grouping — single source of truth for round structure.
 *
 * WHY: both bracket renderers (`components/BracketView.tsx` and
 * `components/admin/AdminBracketView.tsx`) used to infer rounds from match
 * COUNT + array position, ignoring the authoritative `knockout_round` column.
 * That breaks whenever match ordering (e.g. by match_time) doesn't match round
 * order, or when partial-bracket counts collide. Group by the column instead.
 */

export const KNOCKOUT_ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'final'] as const
export type KnockoutRound = (typeof KNOCKOUT_ROUND_ORDER)[number]

export interface RoundGroup<T> {
  round: KnockoutRound
  matches: T[]
}

/**
 * Group knockout matches into ordered rounds using the authoritative
 * `knockout_round` column. Rounds are returned earliest→latest. Matches with a
 * null/unknown round are dropped. Input order within a round is preserved.
 */
export function groupByKnockoutRound<T extends { knockout_round: string | null }>(
  matches: T[],
): RoundGroup<T>[] {
  const buckets = new Map<KnockoutRound, T[]>()
  for (const match of matches) {
    const round = match.knockout_round
    if (!round || !KNOCKOUT_ROUND_ORDER.includes(round as KnockoutRound)) continue
    const key = round as KnockoutRound
    const list = buckets.get(key) ?? []
    list.push(match)
    buckets.set(key, list)
  }
  return KNOCKOUT_ROUND_ORDER.filter((r) => buckets.has(r)).map((r) => ({
    round: r,
    matches: buckets.get(r)!,
  }))
}

/**
 * Count matches that cannot be placed in the bracket because their
 * `knockout_round` is null or unrecognised. These are "stray" fixtures the
 * bracket can't render.
 */
export function countStrayKnockoutMatches<T extends { knockout_round: string | null }>(
  matches: T[],
): number {
  return matches.filter(
    (m) => !m.knockout_round || !KNOCKOUT_ROUND_ORDER.includes(m.knockout_round as KnockoutRound),
  ).length
}

export function knockoutRoundLabel(round: KnockoutRound): string {
  switch (round) {
    case 'r32':
      return 'Round of 32'
    case 'r16':
      return 'Round of 16'
    case 'qf':
      return 'Quarterfinals'
    case 'sf':
      return 'Semifinals'
    case 'final':
      return 'Final'
  }
}

/** Human label for an unresolved feeder slot, e.g. "Winner of Quarterfinals #1". */
export function feederMatchLabel(round: KnockoutRound, oneBasedIndex: number): string {
  return `Winner of ${knockoutRoundLabel(round)} #${oneBasedIndex}`
}
