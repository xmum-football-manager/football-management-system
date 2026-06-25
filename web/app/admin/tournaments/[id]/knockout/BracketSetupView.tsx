'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, X } from 'lucide-react'
import { createManualKnockoutAction } from '../fixtures/actions'
import { teamInitials } from '@/lib/format'
import { malaysiaInputToISO } from '@/lib/tz'

interface Team {
  id: string
  name: string
}

interface Props {
  tournamentId: string
  qualifiedTeams: Team[]
  tournamentStart: string  // YYYY-MM-DD
  tournamentEnd: string    // YYYY-MM-DD
  onCreated: () => void
}

const TIME_OPTIONS: string[] = Array.from({ length: 34 }, (_, i) => {
  const totalMins = 360 + i * 30 // 06:00 to 22:30
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

function buildDayOptions(start: string, end: string): { label: string; date: string }[] {
  const options: { label: string; date: string }[] = []
  // Work purely with date strings (YYYY-MM-DD) to avoid timezone shifts
  const startParts = start.split('-').map(Number)
  const endParts = end.split('-').map(Number)
  let [y, m, d] = startParts
  const [ey, em, ed] = endParts
  let day = 1
  while (
    y < ey || (y === ey && m < em) || (y === ey && m === em && d <= ed)
  ) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    options.push({ label: `Day ${day}`, date: dateStr })
    day++
    d++
    // Roll over days within month (simplified: use Date for month boundary)
    const next = new Date(y, m - 1, d)
    y = next.getFullYear()
    m = next.getMonth() + 1
    d = next.getDate()
  }
  return options
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

/** Build the later-round slot structure from round-0 match count. */
function buildLaterRounds(matchCount: number): { homeLabel: string; awayLabel: string }[][] {
  const rounds: { homeLabel: string; awayLabel: string }[][] = []
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
    rounds.push(round)
    prevMatchNums = newMatchNums
  }
  return rounds
}

export function BracketSetupView({ tournamentId, qualifiedTeams, tournamentStart, tournamentEnd, onCreated }: Props) {
  const matchCount = Math.floor(qualifiedTeams.length / 2)
  const [pairings, setPairings] = useState<Pairing[]>(() => buildEmptyPairings(matchCount))
  const [openPicker, setOpenPicker] = useState<{ matchIdx: number; slot: 'home' | 'away' } | null>(null)
  const [isPending, startTransition] = useTransition()
  const handleClosePicker = useCallback(() => setOpenPicker(null), [])

  const laterRoundSlots = buildLaterRounds(matchCount)
  // laterRoundTimes[roundIdx][matchIdx] = datetime-local string or ''
  const [laterRoundTimes, setLaterRoundTimes] = useState<string[][]>(
    () => laterRoundSlots.map((round) => round.map(() => ''))
  )

  const assigned = assignedIds(pairings)
  const dayOptions = buildDayOptions(tournamentStart, tournamentEnd)

  function setLaterTime(roundIdx: number, matchIdx: number, value: string) {
    setLaterRoundTimes((prev) =>
      prev.map((round, ri) =>
        ri === roundIdx ? round.map((t, mi) => (mi === matchIdx ? value : t)) : round
      )
    )
  }

  const allLaterTimesFilled = laterRoundSlots.length === 0 ||
    laterRoundTimes.every((round) => round.every((t) => !!t))

  // Each round must be scheduled after the round that feeds it. Datetime-local
  // strings (YYYY-MM-DDTHH:mm) compare chronologically as plain strings.
  const chronologyError = (() => {
    if (!allFilled(pairings) || !allLaterTimesFilled) return null
    let prevMax = pairings.map((p) => p.matchTime).reduce((a, b) => (a > b ? a : b), '')
    for (let ri = 0; ri < laterRoundTimes.length; ri++) {
      const times = laterRoundTimes[ri]
      if (times.some((t) => t <= prevMax)) {
        return `Round ${ri + 2} must be scheduled after Round ${ri + 1}.`
      }
      prevMax = times.reduce((a, b) => (a > b ? a : b), '')
    }
    return null
  })()

  function submit() {
    startTransition(async () => {
      const r = await createManualKnockoutAction(
        tournamentId,
        pairings.map((p) => ({
          home_team_id: p.home,
          away_team_id: p.away,
          match_time: p.matchTime ? malaysiaInputToISO(p.matchTime) : null,
        })),
        laterRoundTimes.map((round) =>
          round.map((t) => (t ? malaysiaInputToISO(t) : null))
        ),
      )
      if ('error' in r) toast.error(r.error)
      else {
        toast.success(`${r.created} knockout match${r.created === 1 ? '' : 'es'} created.`)
        onCreated()
      }
    })
  }

  const minWidth = 168 + 24 + 240 + laterRoundSlots.length * (220 + 24) + 24 + 200

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border bg-card p-6" style={{ borderColor: 'var(--admin-rule)' }}>
        <div style={{ minWidth }}>
          <div className="flex gap-6 items-stretch">
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
                          {teamInitials(t.name)}
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
              <div className="flex flex-col gap-5">
                {pairings.map((pairing, matchIdx) => (
                  <MatchCard
                    key={matchIdx}
                    matchIdx={matchIdx}
                    pairing={pairing}
                    qualifiedTeams={qualifiedTeams}
                    assigned={assigned}
                    dayOptions={dayOptions}
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

            {/* Later round columns — with scheduling */}
            {laterRoundSlots.map((round, roundIdx) => (
              <div key={roundIdx} style={{ width: 220, flexShrink: 0 }}>
                <div
                  className="admin-tab text-center mb-4"
                  style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted-foreground)', height: 16 }}
                >
                  Round {roundIdx + 2}
                </div>
                <div className="flex flex-col justify-around h-full gap-5">
                  {round.map((slot, matchIdx) => (
                    <LaterRoundCard
                      key={matchIdx}
                      homeLabel={slot.homeLabel}
                      awayLabel={slot.awayLabel}
                      matchTime={laterRoundTimes[roundIdx]?.[matchIdx] ?? ''}
                      dayOptions={dayOptions}
                      onSetTime={(value) => setLaterTime(roundIdx, matchIdx, value)}
                    />
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
              <div className="flex flex-col justify-center h-full">
                <div
                  className="flex flex-col items-center rounded-lg p-5 text-center"
                  style={{
                    border: '1.5px dashed var(--admin-rule)',
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

      <div className="flex flex-col items-end gap-2">
        {chronologyError && <p className="text-xs text-red-600">{chronologyError}</p>}
        <Button
          onClick={submit}
          disabled={!allFilled(pairings) || !allLaterTimesFilled || !!chronologyError || isPending || matchCount === 0}
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
  dayOptions,
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
  dayOptions: { label: string; date: string }[]
  openPicker: { matchIdx: number; slot: 'home' | 'away' } | null
  onOpenPicker: (v: { matchIdx: number; slot: 'home' | 'away' }) => void
  onClosePicker: () => void
  onSetSlot: (slot: 'home' | 'away', teamId: string) => void
  onClearSlot: (slot: 'home' | 'away') => void
  onSetTime: (value: string) => void
}) {
  const [pendingDate, setPendingDate] = useState(
    () => pairing.matchTime ? pairing.matchTime.slice(0, 10) : ''
  )
  const [pendingTime, setPendingTime] = useState(
    () => pairing.matchTime ? pairing.matchTime.slice(11, 16) : ''
  )

  function handleDayChange(date: string) {
    setPendingDate(date)
    onSetTime(date && pendingTime ? `${date}T${pendingTime}` : '')
  }

  function handleTimeChange(time: string) {
    setPendingTime(time)
    onSetTime(pendingDate && time ? `${pendingDate}T${time}` : '')
  }

  const inputStyle = {
    border: '1px solid var(--admin-rule)',
    background: 'var(--admin-surface-2)',
    color: 'var(--foreground)',
    outline: 'none',
  }

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
      <div className="flex gap-2 px-3 py-2.5">
        <select
          value={pendingDate}
          onChange={(e) => handleDayChange(e.target.value)}
          className="flex-1 rounded text-xs px-2 py-1"
          style={inputStyle}
        >
          <option value="">Day…</option>
          {dayOptions.map((opt) => (
            <option key={opt.date} value={opt.date}>{opt.label}</option>
          ))}
        </select>
        <select
          value={pendingTime}
          onChange={(e) => handleTimeChange(e.target.value)}
          className="w-24 rounded text-xs px-2 py-1"
          style={inputStyle}
        >
          <option value="">Time…</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function LaterRoundCard({
  homeLabel,
  awayLabel,
  matchTime,
  dayOptions,
  onSetTime,
}: {
  homeLabel: string
  awayLabel: string
  matchTime: string
  dayOptions: { label: string; date: string }[]
  onSetTime: (value: string) => void
}) {
  // Hold the half-finished day/time selection locally (like Round 1's MatchCard) so
  // picking a day before a time — or vice versa — sticks instead of resetting. Only
  // a complete day+time is pushed up to parent state as a combined value.
  const [pendingDate, setPendingDate] = useState(() => (matchTime ? matchTime.slice(0, 10) : ''))
  const [pendingTime, setPendingTime] = useState(() => (matchTime ? matchTime.slice(11, 16) : ''))

  function handleDayChange(date: string) {
    setPendingDate(date)
    onSetTime(date && pendingTime ? `${date}T${pendingTime}` : '')
  }

  function handleTimeChange(time: string) {
    setPendingTime(time)
    onSetTime(pendingDate && time ? `${pendingDate}T${time}` : '')
  }

  const inputStyle = {
    border: '1px solid var(--admin-rule)',
    background: 'var(--admin-surface-2)',
    color: 'var(--foreground)',
    outline: 'none',
  }

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        border: '1px solid var(--admin-rule)',
        background: 'var(--card)',
        opacity: 0.85,
      }}
    >
      <PlaceholderRow label={homeLabel} />
      <div style={{ height: 1, background: 'var(--admin-rule)' }} />
      <PlaceholderRow label={awayLabel} />
      <div style={{ height: 1, background: 'var(--admin-rule)' }} />
      <div className="flex gap-2 px-3 py-2.5">
        <select
          value={pendingDate}
          onChange={(e) => handleDayChange(e.target.value)}
          className="flex-1 rounded text-xs px-2 py-1"
          style={inputStyle}
        >
          <option value="">Day…</option>
          {dayOptions.map((opt) => (
            <option key={opt.date} value={opt.date}>{opt.label}</option>
          ))}
        </select>
        <select
          value={pendingTime}
          onChange={(e) => handleTimeChange(e.target.value)}
          className="w-24 rounded text-xs px-2 py-1"
          style={inputStyle}
        >
          <option value="">Time…</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
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
        <div className="flex items-center gap-2 px-3 py-3">
          <span
            className="admin-display inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] shrink-0"
            style={{
              background: 'var(--admin-surface-2)',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--admin-rule)',
            }}
          >
            {teamInitials(team.name)}
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
          className="w-full text-left px-3 py-3 text-xs"
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
                  {teamInitials(t.name)}
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

function PlaceholderRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-3">
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
