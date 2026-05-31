'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, X } from 'lucide-react'
import { createManualKnockoutAction } from '../fixtures/actions'

interface Team {
  id: string
  name: string
}

interface Props {
  tournamentId: string
  qualifiedTeams: Team[]
  onCreated: () => void
}

interface Pairing {
  home: string      // team id or ''
  away: string      // team id or ''
  matchTime: string // datetime-local value or ''
}

function buildEmptyPairings(count: number): Pairing[] {
  return Array.from({ length: count }, () => ({ home: '', away: '', matchTime: '' }))
}

function assignedIds(pairings: Pairing[]): Set<string> {
  return new Set(pairings.flatMap((p) => [p.home, p.away].filter(Boolean)))
}

function setSlot(pairings: Pairing[], matchIdx: number, slot: 'home' | 'away', teamId: string): Pairing[] {
  return pairings.map((p, i) => (i === matchIdx ? { ...p, [slot]: teamId } : p))
}

function clearSlot(pairings: Pairing[], matchIdx: number, slot: 'home' | 'away'): Pairing[] {
  return setSlot(pairings, matchIdx, slot, '')
}

function setMatchTime(pairings: Pairing[], matchIdx: number, value: string): Pairing[] {
  return pairings.map((p, i) => (i === matchIdx ? { ...p, matchTime: value } : p))
}

function allFilled(pairings: Pairing[]): boolean {
  return pairings.every((p) => p.home && p.away && p.matchTime)
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

const CARD_HEIGHT = 64
const ROW_GAP = 16

export function BracketSetupView({ tournamentId, qualifiedTeams, onCreated }: Props) {
  const matchCount = Math.floor(qualifiedTeams.length / 2)
  const [pairings, setPairings] = useState<Pairing[]>(() => buildEmptyPairings(matchCount))
  const [openPicker, setOpenPicker] = useState<{ matchIdx: number; slot: 'home' | 'away' } | null>(null)
  const [isPending, startTransition] = useTransition()
  const handleClosePicker = useCallback(() => setOpenPicker(null), [])

  const assigned = assignedIds(pairings)

  // Build placeholder rounds for subsequent rounds
  const placeholderRounds: Array<{ homeLabel: string; awayLabel: string }[]> = []
  let prevMatchNums = Array.from({ length: matchCount }, (_, i) => i + 1)
  let nextMatchNum = matchCount + 1
  while (prevMatchNums.length > 1) {
    const round: { homeLabel: string; awayLabel: string }[] = []
    for (let i = 0; i + 1 < prevMatchNums.length; i += 2) {
      round.push({
        homeLabel: `Winner of M${prevMatchNums[i]}`,
        awayLabel: `Winner of M${prevMatchNums[i + 1]}`,
      })
    }
    const newMatchNums = round.map((_, i) => nextMatchNum + i)
    nextMatchNum += round.length
    placeholderRounds.push(round)
    prevMatchNums = newMatchNums
  }

  const firstRoundHeight =
    Math.max(1, matchCount) * CARD_HEIGHT + Math.max(0, matchCount - 1) * ROW_GAP

  function submit() {
    startTransition(async () => {
      const r = await createManualKnockoutAction(
        tournamentId,
        pairings.map((p) => ({
          home_team_id: p.home,
          away_team_id: p.away,
          match_time: p.matchTime ? new Date(p.matchTime).toISOString() : null,
        })),
      )
      if ('error' in r) toast.error(r.error)
      else {
        toast.success(`${r.created} knockout match${r.created === 1 ? '' : 'es'} created.`)
        onCreated()
      }
    })
  }

  const minWidth = 168 + 24 + 240 + placeholderRounds.length * (220 + 24) + 24 + 200

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border bg-card p-6" style={{ borderColor: 'var(--admin-rule)' }}>
        <div style={{ minWidth }}>
          <div className="flex gap-6 items-start">
            {/* Left sidebar — unscheduled teams */}
            <div style={{ width: 168, flexShrink: 0 }}>
              <div
                className="admin-tab text-center mb-4"
                style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted-foreground)', height: 16 }}
              >
                Unscheduled ({qualifiedTeams.length - assigned.size})
              </div>
              <div
                className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--admin-rule)', background: 'var(--admin-surface-2)' }}
              >
                {qualifiedTeams.length === 0 ? (
                  <div className="px-3 py-4 text-xs italic" style={{ color: 'var(--muted-foreground)' }}>
                    No teams
                  </div>
                ) : (
                  qualifiedTeams.map((t) => {
                    const isAssigned = assigned.has(t.id)
                    return (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 px-3 py-2"
                        style={{
                          borderBottom: '1px solid var(--admin-rule)',
                          opacity: isAssigned ? 0.45 : 1,
                        }}
                      >
                        <span
                          className="admin-display inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] shrink-0"
                          style={{
                            background: 'var(--admin-surface-2)',
                            color: 'var(--muted-foreground)',
                            border: '1px solid var(--admin-rule)',
                          }}
                        >
                          {initials(t.name)}
                        </span>
                        <span
                          className="truncate text-xs"
                          style={{
                            color: 'var(--foreground)',
                            textDecoration: isAssigned ? 'line-through' : 'none',
                          }}
                        >
                          {t.name}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Round 1 column */}
            <div style={{ width: 240, flexShrink: 0 }}>
              <div
                className="admin-tab text-center mb-4"
                style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted-foreground)', height: 16 }}
              >
                Round 1
              </div>
              <div className="flex flex-col justify-around" style={{ height: firstRoundHeight }}>
                {pairings.map((pairing, matchIdx) => (
                  <MatchCard
                    key={matchIdx}
                    matchIdx={matchIdx}
                    pairing={pairing}
                    qualifiedTeams={qualifiedTeams}
                    assigned={assigned}
                    openPicker={openPicker}
                    onOpenPicker={setOpenPicker}
                    onClosePicker={handleClosePicker}
                    onSetSlot={(slot, teamId) => setPairings(setSlot(pairings, matchIdx, slot, teamId))}
                    onClearSlot={(slot) => setPairings(clearSlot(pairings, matchIdx, slot))}
                    onSetTime={(value) => setPairings(setMatchTime(pairings, matchIdx, value))}
                  />
                ))}
              </div>
            </div>

            {/* Subsequent round placeholder columns */}
            {placeholderRounds.map((round, roundIdx) => (
              <div key={roundIdx} style={{ width: 220, flexShrink: 0 }}>
                <div
                  className="admin-tab text-center mb-4"
                  style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted-foreground)', height: 16 }}
                >
                  Round {roundIdx + 2}
                </div>
                <div className="flex flex-col justify-around" style={{ height: firstRoundHeight }}>
                  {round.map((slot, i) => (
                    <PlaceholderCard key={i} homeLabel={slot.homeLabel} awayLabel={slot.awayLabel} />
                  ))}
                </div>
              </div>
            ))}

            {/* Champion column */}
            <div style={{ width: 200, flexShrink: 0 }}>
              <div
                className="admin-tab text-center mb-4"
                style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted-foreground)', height: 16 }}
              >
                Champion
              </div>
              <div className="flex flex-col justify-center" style={{ height: firstRoundHeight }}>
                <div
                  className="flex flex-col items-center rounded-lg p-5 text-center"
                  style={{
                    border: '1.5px dashed var(--admin-rule)',
                    minHeight: CARD_HEIGHT + 40,
                  }}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--muted-foreground)"
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
                    className="admin-display mt-2"
                    style={{ fontSize: 14, color: 'var(--muted-foreground)' }}
                  >
                    TBD
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={!allFilled(pairings) || isPending || matchCount === 0}
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Bracket
        </Button>
      </div>
    </div>
  )
}

function MatchCard({
  matchIdx,
  pairing,
  qualifiedTeams,
  assigned,
  openPicker,
  onOpenPicker,
  onClosePicker,
  onSetSlot,
  onClearSlot,
  onSetTime,
}: {
  matchIdx: number
  pairing: Pairing
  qualifiedTeams: Team[]
  assigned: Set<string>
  openPicker: { matchIdx: number; slot: 'home' | 'away' } | null
  onOpenPicker: (v: { matchIdx: number; slot: 'home' | 'away' }) => void
  onClosePicker: () => void
  onSetSlot: (slot: 'home' | 'away', teamId: string) => void
  onClearSlot: (slot: 'home' | 'away') => void
  onSetTime: (value: string) => void
}) {
  return (
    <div
      className="rounded-md overflow-visible"
      style={{
        border: '1px solid var(--admin-rule)',
        background: 'var(--card)',
      }}
    >
      <TeamSlot
        slot="home"
        teamId={pairing.home}
        matchIdx={matchIdx}
        qualifiedTeams={qualifiedTeams}
        assigned={assigned}
        openPicker={openPicker}
        onOpenPicker={onOpenPicker}
        onClosePicker={onClosePicker}
        onSetSlot={onSetSlot}
        onClearSlot={onClearSlot}
      />
      <div style={{ height: 1, background: 'var(--admin-rule)' }} />
      <TeamSlot
        slot="away"
        teamId={pairing.away}
        matchIdx={matchIdx}
        qualifiedTeams={qualifiedTeams}
        assigned={assigned}
        openPicker={openPicker}
        onOpenPicker={onOpenPicker}
        onClosePicker={onClosePicker}
        onSetSlot={onSetSlot}
        onClearSlot={onClearSlot}
      />
      <div style={{ height: 1, background: 'var(--admin-rule)' }} />
      <div className="px-2 py-1.5">
        <input
          type="datetime-local"
          value={pairing.matchTime}
          onChange={(e) => onSetTime(e.target.value)}
          className="w-full rounded text-xs px-1.5 py-0.5"
          style={{
            border: '1px solid var(--admin-rule)',
            background: 'var(--admin-surface-2)',
            color: 'var(--foreground)',
            outline: 'none',
          }}
        />
      </div>
    </div>
  )
}

function TeamSlot({
  slot,
  teamId,
  matchIdx,
  qualifiedTeams,
  assigned,
  openPicker,
  onOpenPicker,
  onClosePicker,
  onSetSlot,
  onClearSlot,
}: {
  slot: 'home' | 'away'
  teamId: string
  matchIdx: number
  qualifiedTeams: Team[]
  assigned: Set<string>
  openPicker: { matchIdx: number; slot: 'home' | 'away' } | null
  onOpenPicker: (v: { matchIdx: number; slot: 'home' | 'away' }) => void
  onClosePicker: () => void
  onSetSlot: (slot: 'home' | 'away', teamId: string) => void
  onClearSlot: (slot: 'home' | 'away') => void
}) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const isPickerOpen = openPicker?.matchIdx === matchIdx && openPicker?.slot === slot
  const team = qualifiedTeams.find((t) => t.id === teamId)

  useEffect(() => {
    if (!isPickerOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClosePicker()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isPickerOpen, onClosePicker])

  // Teams available to pick: unassigned + the currently assigned team for this slot
  const available = qualifiedTeams.filter((t) => !assigned.has(t.id) || t.id === teamId)

  return (
    <div style={{ position: 'relative' }}>
      {team ? (
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            className="admin-display inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] shrink-0"
            style={{
              background: 'var(--admin-surface-2)',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--admin-rule)',
            }}
          >
            {initials(team.name)}
          </span>
          <span className="truncate text-xs flex-1" style={{ color: 'var(--foreground)' }}>
            {team.name}
          </span>
          <button
            type="button"
            onClick={() => onClearSlot(slot)}
            className="shrink-0 rounded p-0.5 hover:bg-red-100"
          >
            <X className="h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpenPicker({ matchIdx, slot })}
          className="w-full text-left px-2 py-1.5 text-xs"
          style={{
            color: 'var(--admin-lime)',
            border: 'none',
            background: 'transparent',
          }}
        >
          Pick {slot} team…
        </button>
      )}

      {isPickerOpen && (
        <div
          ref={pickerRef}
          className="absolute z-50 rounded-md shadow-lg"
          style={{
            top: '100%',
            left: 0,
            minWidth: 200,
            border: '1px solid var(--admin-rule)',
            background: 'var(--card)',
          }}
        >
          {available.length === 0 ? (
            <div className="px-3 py-2 text-xs italic" style={{ color: 'var(--muted-foreground)' }}>
              All teams assigned
            </div>
          ) : (
            available.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSetSlot(slot, t.id)
                  onClosePicker()
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-accent"
              >
                <span
                  className="admin-display inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] shrink-0"
                  style={{
                    background: 'var(--admin-surface-2)',
                    color: 'var(--muted-foreground)',
                    border: '1px solid var(--admin-rule)',
                  }}
                >
                  {initials(t.name)}
                </span>
                {t.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function PlaceholderCard({
  homeLabel,
  awayLabel,
}: {
  homeLabel: string
  awayLabel: string
}) {
  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        border: '1.5px dashed var(--admin-rule)',
        background: 'var(--card)',
        opacity: 0.7,
      }}
    >
      <PlaceholderRow label={homeLabel} />
      <div style={{ height: 1, background: 'var(--admin-rule)' }} />
      <PlaceholderRow label={awayLabel} />
    </div>
  )
}

function PlaceholderRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <span
        className="admin-display inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] shrink-0"
        style={{
          background: 'var(--admin-surface-2)',
          color: 'var(--muted-foreground)',
          border: '1px dashed var(--admin-rule)',
        }}
      >
        ?
      </span>
      <span className="truncate text-xs italic" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </span>
    </div>
  )
}
