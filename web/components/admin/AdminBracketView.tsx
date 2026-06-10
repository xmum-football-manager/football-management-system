'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { MatchWithTeams } from '@/lib/supabase/types'
import { teamInitials } from '@/lib/format'

export interface BracketGroupStanding {
  team_id: string
  team_name: string
  played: number
  wins: number
  draws: number
  losses: number
  gd: number
  pts: number
}

export interface BracketGroupColumn {
  label: string
  standings: BracketGroupStanding[]
  matches: MatchWithTeams[]
}

interface Props {
  matches?: MatchWithTeams[]
  /** Expected first-round size (number of teams entering the bracket). Drives placeholder layout. */
  bracketTeamCount?: number | null
  /** First-round source labels (e.g. ["1A", "2B", ...]). Used in placeholder mode. */
  firstRoundSourceLabels?: string[] | null
  /** Optional group columns rendered before the knockout rounds. */
  groupColumns?: BracketGroupColumn[]
  /** Optional left sidebar card (e.g. teams list) rendered before bracket columns. */
  sidebar?: ReactNode
  /** Called when a scheduled match is clicked (in group matches OR bracket matches). */
  onMatchClick?: (match: MatchWithTeams) => void
}

const CARD_HEIGHT = 64
const ROW_GAP = 16

function roundLabel(slotCount: number): string {
  if (slotCount === 8) return 'Round of 16'
  if (slotCount === 4) return 'Quarterfinals'
  if (slotCount === 2) return 'Semifinals'
  if (slotCount === 1) return 'Final'
  if (slotCount > 8) return `Round of ${slotCount * 2}`
  return `${slotCount} matches`
}

function bucketRounds(matches: MatchWithTeams[]): MatchWithTeams[][] {
  const total = matches.length
  const rounds: MatchWithTeams[][] = []
  let consumed = 0
  let size = 1
  while (size * 2 <= total) size *= 2
  while (size >= 1 && consumed < total) {
    const slice = matches.slice(consumed, consumed + size)
    if (slice.length === 0) break
    rounds.push(slice)
    consumed += size
    size = size / 2
  }
  return rounds
}

/** Valid single-elimination match counts: 1 (final only), 3 (SF+F), 7 (QF+SF+F), 15 (R16+...). i.e. n+1 is a power of 2. */
function isValidBracketCount(n: number): boolean {
  if (n <= 0) return false
  const total = n + 1
  return (total & (total - 1)) === 0
}

interface PlaceholderSlot {
  homeLabel: string
  awayLabel: string
}

function buildPlaceholderRounds(
  bracketTeamCount: number,
  firstRoundSourceLabels: string[] | null,
): PlaceholderSlot[][] {
  const rounds: PlaceholderSlot[][] = []
  let matchCount = bracketTeamCount / 2
  let roundIndex = 0
  while (matchCount >= 1) {
    const round: PlaceholderSlot[] = []
    for (let i = 0; i < matchCount; i++) {
      if (roundIndex === 0) {
        const homeLabel = firstRoundSourceLabels?.[i * 2] ?? `Seed ${i * 2 + 1}`
        const awayLabel = firstRoundSourceLabels?.[i * 2 + 1] ?? `Seed ${i * 2 + 2}`
        round.push({ homeLabel, awayLabel })
      } else {
        const baseMatchNumber = totalMatchesBefore(rounds) + 1
        round.push({
          homeLabel: `Winner of M${baseMatchNumber + i * 2 - matchCount * 2}`,
          awayLabel: `Winner of M${baseMatchNumber + i * 2 - matchCount * 2 + 1}`,
        })
      }
    }
    rounds.push(round)
    matchCount = Math.floor(matchCount / 2)
    roundIndex++
  }
  return rounds
}

function totalMatchesBefore(rounds: PlaceholderSlot[][]): number {
  return rounds.reduce((n, r) => n + r.length, 0)
}

export function AdminBracketView({
  matches = [],
  bracketTeamCount,
  firstRoundSourceLabels,
  groupColumns,
  sidebar,
  onMatchClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const groupsColumnRef = useRef<HTMLDivElement | null>(null)
  const [measuredGroupsHeight, setMeasuredGroupsHeight] = useState(0)

  const hasValidMatches = matches.length > 0 && isValidBracketCount(matches.length)
  const matchRounds = hasValidMatches ? bucketRounds(matches) : []
  const placeholderRounds =
    !hasValidMatches && bracketTeamCount && bracketTeamCount >= 2
      ? buildPlaceholderRounds(bracketTeamCount, firstRoundSourceLabels ?? null)
      : []
  const totalRounds = hasValidMatches ? matchRounds.length : placeholderRounds.length
  const hasGroupColumns = (groupColumns?.length ?? 0) > 0
  const hasAnything = totalRounds > 0 || hasGroupColumns

  const firstRoundSize = hasValidMatches
    ? matchRounds[0]?.length ?? 1
    : placeholderRounds[0]?.length ?? 1
  const bracketColumnHeight =
    totalRounds > 0
      ? Math.max(1, firstRoundSize) * CARD_HEIGHT + Math.max(0, firstRoundSize - 1) * ROW_GAP
      : 0

  const finalMatch = hasValidMatches ? matchRounds[matchRounds.length - 1]?.[0] : undefined
  const champion =
    finalMatch?.status === 'finished'
      ? finalMatch.home_score > finalMatch.away_score
        ? finalMatch.home_team?.name ?? null
        : finalMatch.away_score > finalMatch.home_score
          ? finalMatch.away_team?.name ?? null
          : null
      : null

  const minWidth =
    (sidebar ? GROUP_COLUMN_WIDTH + 24 : 0) +
    (hasGroupColumns ? GROUP_COLUMN_WIDTH + 24 : 0) +
    totalRounds * 240 +
    (totalRounds > 0 ? 220 : 0)

  const showStrayMatchesWarning =
    matches.length > 0 && !hasValidMatches && (bracketTeamCount ?? 0) >= 2

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    function compute() {
      const groupsCol = groupsColumnRef.current
      setMeasuredGroupsHeight(groupsCol ? groupsCol.offsetHeight : 0)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(container)
    if (groupsColumnRef.current) ro.observe(groupsColumnRef.current)
    return () => ro.disconnect()
  }, [hasGroupColumns, hasValidMatches, totalRounds])

  const effectiveColumnHeight =
    hasGroupColumns && measuredGroupsHeight > 0
      ? Math.max(bracketColumnHeight, measuredGroupsHeight)
      : bracketColumnHeight

  if (!hasAnything) {
    return (
      <div
        className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground"
        style={{ borderColor: 'var(--admin-rule)' }}
      >
        No bracket structure yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {showStrayMatchesWarning && (
        <p className="text-[11px] text-amber-700">
          ⚠ {matches.length} cross-group fixture{matches.length === 1 ? '' : 's'} don&apos;t fit
          this tournament&apos;s bracket shape and aren&apos;t shown here. Use the Board view to
          delete them, or seed the bracket from group standings.
        </p>
      )}
      <div
        className="rounded-xl border bg-card p-6 overflow-x-auto"
        style={{ borderColor: 'var(--admin-rule)' }}
      >
        <div ref={containerRef} style={{ minWidth }}>
          <div className="flex gap-6 items-start">
            {sidebar && (
              <div style={{ width: GROUP_COLUMN_WIDTH, flexShrink: 0 }}>{sidebar}</div>
            )}
            {hasGroupColumns && (
              <div
                ref={groupsColumnRef}
                className="flex flex-col gap-5"
                style={{ width: GROUP_COLUMN_WIDTH, flexShrink: 0 }}
              >
                {groupColumns?.map((g) => (
                  <GroupCard key={g.label} column={g} onMatchClick={onMatchClick} />
                ))}
              </div>
            )}

            {hasValidMatches
              ? matchRounds.map((round, i) => (
                  <BracketColumn
                    key={i}
                    label={roundLabel(round.length)}
                    matches={round}
                    placeholders={null}
                    columnHeight={effectiveColumnHeight}
                    isFinal={i === matchRounds.length - 1}
                    onMatchClick={onMatchClick}
                  />
                ))
              : placeholderRounds.map((round, i) => (
                  <BracketColumn
                    key={i}
                    label={roundLabel(round.length)}
                    matches={null}
                    placeholders={round}
                    columnHeight={effectiveColumnHeight}
                    isFinal={i === placeholderRounds.length - 1}
                    onMatchClick={undefined}
                  />
                ))}

            {totalRounds > 0 && (
              <ChampionColumn
                champion={champion}
                columnHeight={effectiveColumnHeight}
                hasFinal={!!finalMatch || placeholderRounds.length > 0}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const GROUP_COLUMN_WIDTH = 300

function GroupCard({
  column,
  onMatchClick,
}: {
  column: BracketGroupColumn
  onMatchClick?: (m: MatchWithTeams) => void
}) {
  const played = column.matches.filter((m) => m.status === 'finished').length
  return (
    <div
      className="rounded-lg border bg-card overflow-hidden"
      style={{ borderColor: 'var(--admin-rule)' }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          background: 'var(--admin-surface-2)',
          borderBottom: '1px solid var(--admin-rule)',
        }}
      >
        <span
          className="admin-tab"
          style={{
            fontSize: 11,
            letterSpacing: '0.12em',
            color: 'var(--admin-lime)',
          }}
        >
          {column.label}
        </span>
        <span className="admin-mono text-[10px] text-muted-foreground">
          {played}/{column.matches.length} played
        </span>
      </div>

      {column.standings.length === 0 ? (
        <div className="px-3 py-4 text-[11px] italic text-muted-foreground">
          No teams in this group
        </div>
      ) : (
        <table className="w-full text-[11px]">
          <thead>
            <tr
              className="admin-tab text-[9px] tracking-wider"
              style={{
                color: 'var(--muted-foreground)',
                borderBottom: '1px solid var(--admin-rule-soft)',
              }}
            >
              <th className="text-left px-2 py-1.5">#</th>
              <th className="text-left px-2 py-1.5">Team</th>
              <th className="text-right px-1 py-1.5">P</th>
              <th className="text-right px-1 py-1.5">W</th>
              <th className="text-right px-1 py-1.5">D</th>
              <th className="text-right px-1 py-1.5">L</th>
              <th className="text-right px-1 py-1.5">GD</th>
              <th className="text-right px-2 py-1.5">Pts</th>
            </tr>
          </thead>
          <tbody>
            {column.standings.map((s, i) => (
              <tr
                key={s.team_id}
                style={{
                  borderTop: i > 0 ? '1px solid var(--admin-rule-soft)' : 'none',
                  background: i === 0 ? 'var(--admin-lime-wash)' : 'transparent',
                }}
              >
                <td className="px-2 py-1.5 admin-mono text-muted-foreground">{i + 1}</td>
                <td className="px-2 py-1.5 font-medium truncate">{s.team_name}</td>
                <td className="px-1 py-1.5 text-right admin-mono">{s.played}</td>
                <td className="px-1 py-1.5 text-right admin-mono">{s.wins}</td>
                <td className="px-1 py-1.5 text-right admin-mono">{s.draws}</td>
                <td className="px-1 py-1.5 text-right admin-mono">{s.losses}</td>
                <td className="px-1 py-1.5 text-right admin-mono">
                  {s.gd > 0 ? `+${s.gd}` : s.gd}
                </td>
                <td className="px-2 py-1.5 text-right admin-mono font-bold">{s.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div
        className="px-3 py-2"
        style={{ borderTop: '1px solid var(--admin-rule-soft)' }}
      >
        <div className="admin-tab text-[9px] tracking-wider text-muted-foreground mb-1.5">
          Matches
        </div>
        <div className="flex flex-col gap-1.5">
          {column.matches.length === 0 ? (
            <div className="text-[11px] italic text-muted-foreground py-1">
              No matches yet
            </div>
          ) : (
            column.matches.map((m) => (
              <GroupMatchCard key={m.id} match={m} onMatchClick={onMatchClick} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function GroupMatchCard({
  match,
  onMatchClick,
}: {
  match: MatchWithTeams
  onMatchClick?: (m: MatchWithTeams) => void
}) {
  const clickable = match.status === 'scheduled' && !!onMatchClick
  const isLive = match.status === 'live' || match.status === 'halftime'
  const isFinished = match.status === 'finished'
  const homeWon = isFinished && match.home_score > match.away_score
  const awayWon = isFinished && match.away_score > match.home_score
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onMatchClick?.(match)}
      className="rounded-md overflow-hidden bg-card text-left disabled:cursor-default"
      style={{
        border: `1px solid ${isLive ? '#DC2626' : 'var(--admin-rule)'}`,
        boxShadow: isLive ? '0 0 0 3px rgba(220,38,38,0.10)' : 'none',
        cursor: clickable ? 'pointer' : 'default',
      }}
      title={
        clickable
          ? 'Click to reschedule'
          : isFinished
            ? 'Match finished'
            : isLive
              ? 'Match in progress'
              : undefined
      }
    >
      <BracketTeamRow
        name={match.home_team?.name ?? 'TBD'}
        score={match.status === 'scheduled' ? null : match.home_score}
        winner={homeWon}
        loser={awayWon}
      />
      <div style={{ height: 1, background: 'var(--admin-rule)' }} />
      <BracketTeamRow
        name={match.away_team?.name ?? 'TBD'}
        score={match.status === 'scheduled' ? null : match.away_score}
        winner={awayWon}
        loser={homeWon}
      />
    </button>
  )
}

function BracketColumn({
  label,
  matches,
  placeholders,
  columnHeight,
  isFinal,
  onMatchClick,
}: {
  label: string
  matches: MatchWithTeams[] | null
  placeholders: PlaceholderSlot[] | null
  columnHeight: number
  isFinal: boolean
  onMatchClick?: (m: MatchWithTeams) => void
}) {
  return (
    <div className="flex flex-col" style={{ width: 220, flexShrink: 0 }}>
      <div
        className="admin-tab text-center"
        style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--muted-foreground)',
          marginBottom: 16,
          height: 16,
        }}
      >
        {label}
      </div>
      <div className="flex flex-col justify-around" style={{ height: columnHeight }}>
        {matches
          ? matches.map((m) => (
              <BracketMatch
                key={m.id}
                match={m}
                isFinal={isFinal}
                onMatchClick={onMatchClick}
              />
            ))
          : placeholders?.map((p, i) => (
              <BracketPlaceholder key={i} slot={p} isFinal={isFinal} />
            ))}
      </div>
    </div>
  )
}

function ChampionColumn({
  champion,
  columnHeight,
  hasFinal,
}: {
  champion: string | null
  columnHeight: number
  hasFinal: boolean
}) {
  return (
    <div className="flex flex-col" style={{ width: 200, flexShrink: 0 }}>
      <div
        className="admin-tab text-center"
        style={{
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--muted-foreground)',
          marginBottom: 16,
          height: 16,
        }}
      >
        Champion
      </div>
      <div className="flex flex-col justify-center" style={{ height: columnHeight }}>
        <div
          className="flex flex-col items-center rounded-lg p-5 text-center"
          style={{
            border: champion
              ? '1.5px solid var(--admin-lime)'
              : '1.5px dashed var(--admin-rule)',
            background: champion ? 'var(--admin-lime-wash)' : 'transparent',
            minHeight: CARD_HEIGHT + 40,
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke={champion ? 'var(--admin-lime)' : 'var(--muted-foreground)'}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
          <div
            className="admin-display mt-2 truncate w-full"
            style={{
              fontSize: 14,
              color: champion ? 'var(--admin-lime)' : 'var(--muted-foreground)',
            }}
          >
            {champion ?? (hasFinal ? 'TBD' : '—')}
          </div>
        </div>
      </div>
    </div>
  )
}

function BracketMatch({
  match,
  isFinal,
  onMatchClick,
}: {
  match: MatchWithTeams
  isFinal: boolean
  onMatchClick?: (m: MatchWithTeams) => void
}) {
  const isLive = match.status === 'live' || match.status === 'halftime'
  const isFinished = match.status === 'finished'
  const homeWon = isFinished && match.home_score > match.away_score
  const awayWon = isFinished && match.away_score > match.home_score
  const clickable = match.status === 'scheduled' && !!onMatchClick

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onMatchClick?.(match)}
      className="rounded-md overflow-hidden bg-card text-left disabled:cursor-default"
      style={{
        border: `1px solid ${
          isLive ? '#DC2626' : isFinal ? 'var(--admin-lime)' : 'var(--admin-rule)'
        }`,
        boxShadow: isLive
          ? '0 0 0 3px rgba(220,38,38,0.10)'
          : isFinal
            ? '0 0 0 3px var(--admin-lime-wash)'
            : 'none',
        cursor: clickable ? 'pointer' : 'default',
      }}
      title={clickable ? 'Click to reschedule' : isFinished ? 'Match finished' : isLive ? 'Match in progress' : undefined}
    >
      <BracketTeamRow
        name={match.home_team?.name ?? 'TBD'}
        score={match.status === 'scheduled' ? null : match.home_score}
        winner={homeWon}
        loser={awayWon}
      />
      <div style={{ height: 1, background: 'var(--admin-rule)' }} />
      <BracketTeamRow
        name={match.away_team?.name ?? 'TBD'}
        score={match.status === 'scheduled' ? null : match.away_score}
        winner={awayWon}
        loser={homeWon}
      />
    </button>
  )
}

function BracketPlaceholder({
  slot,
  isFinal,
}: {
  slot: PlaceholderSlot
  isFinal: boolean
}) {
  return (
    <div
      className="rounded-md overflow-hidden bg-card"
      style={{
        border: `1.5px dashed ${isFinal ? 'var(--admin-lime)' : 'var(--admin-rule)'}`,
        opacity: 0.85,
      }}
    >
      <PlaceholderTeamRow label={slot.homeLabel} />
      <div style={{ height: 1, background: 'var(--admin-rule)' }} />
      <PlaceholderTeamRow label={slot.awayLabel} />
    </div>
  )
}

function PlaceholderTeamRow({ label }: { label: string }) {
  return (
    <div
      className="grid items-center gap-2 px-3 py-2"
      style={{ gridTemplateColumns: '20px 1fr auto' }}
    >
      <span
        className="admin-display inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px]"
        style={{
          background: 'var(--admin-surface-2)',
          color: 'var(--muted-foreground)',
          border: '1px dashed var(--admin-rule)',
        }}
      >
        ?
      </span>
      <span
        className="truncate text-sm italic"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {label}
      </span>
      <span
        className="admin-mono tabular-nums"
        style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted-foreground)' }}
      >
        —
      </span>
    </div>
  )
}

function BracketTeamRow({
  name,
  score,
  winner,
  loser,
}: {
  name: string
  score: number | null
  winner: boolean
  loser: boolean
}) {
  return (
    <div
      className="grid items-center gap-2 px-3 py-2"
      style={{
        gridTemplateColumns: '20px 1fr auto',
        background: winner ? 'var(--admin-lime-wash)' : 'transparent',
      }}
    >
      <span
        className="admin-display inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px]"
        style={{
          background: 'var(--admin-surface-2)',
          color: 'var(--muted-foreground)',
          border: '1px solid var(--admin-rule)',
        }}
      >
        {teamInitials(name)}
      </span>
      <span
        className="truncate text-sm"
        style={{
          fontWeight: winner ? 800 : 600,
          color: loser ? 'var(--muted-foreground)' : 'var(--foreground)',
        }}
      >
        {name}
      </span>
      <span
        className="admin-mono tabular-nums"
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: winner
            ? 'var(--admin-lime)'
            : loser
              ? 'var(--muted-foreground)'
              : 'var(--foreground)',
        }}
      >
        {score == null ? '—' : score}
      </span>
    </div>
  )
}
