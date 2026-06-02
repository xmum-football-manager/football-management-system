'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Plus } from 'lucide-react'
import { createManualKnockoutAction } from '../fixtures/actions'
import { teamInitials } from '@/lib/format'

interface Team {
  id: string
  name: string
}

interface Props {
  tournamentId: string
  qualifiedTeams: Team[]
  tournamentStart: string
  tournamentEnd: string
  onCreated: () => void
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Pairing {
  home: string
  away: string
  matchTime: string
}

function buildEmptyPairings(count: number): Pairing[] {
  return Array.from({ length: count }, () => ({ home: '', away: '', matchTime: '' }))
}

function assignedIds(pairings: Pairing[]): Set<string> {
  return new Set(pairings.flatMap((p) => [p.home, p.away].filter(Boolean)))
}

function allFilled(pairings: Pairing[]): boolean {
  return pairings.every((p) => p.home && p.away && p.matchTime)
}

export function BracketSetupView({ tournamentId, qualifiedTeams, tournamentStart, tournamentEnd, onCreated }: Props) {
  const matchCount = Math.floor(qualifiedTeams.length / 2)
  const [pairings, setPairings] = useState<Pairing[]>(() => buildEmptyPairings(matchCount))
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

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

  function savePairing(idx: number, pairing: Pairing) {
    const next = pairings.map((p, i) => (i === idx ? pairing : p))
    setPairings(next)
    setEditingIdx(null)
    if (allFilled(next)) {
      startTransition(async () => {
        const r = await createManualKnockoutAction(
          tournamentId,
          next.map((p) => ({
            home_team_id: p.home,
            away_team_id: p.away,
            match_time: p.matchTime ? new Date(p.matchTime).toISOString() : null,
          }))
        )
        if ('error' in r) toast.error(r.error)
        else {
          toast.success(`${r.created} knockout match${r.created === 1 ? '' : 'es'} created.`)
          onCreated()
        }
      })
    }
  }

  const minWidth = 168 + 24 + 240 + placeholderRounds.length * (220 + 24) + 24 + 200

  const editingPairing = editingIdx !== null ? pairings[editingIdx] : null

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
                {pairings.map((pairing, matchIdx) => {
                  const homeTeam = qualifiedTeams.find((t) => t.id === pairing.home)
                  const awayTeam = qualifiedTeams.find((t) => t.id === pairing.away)
                  const isFilled = !!(homeTeam && awayTeam && pairing.matchTime)
                  return (
                    <MatchSlot
                      key={matchIdx}
                      matchIdx={matchIdx}
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                      matchTime={pairing.matchTime}
                      isFilled={isFilled}
                      onClick={() => setEditingIdx(matchIdx)}
                    />
                  )
                })}
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
                <div className="flex flex-col justify-around h-full">
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
              <div className="flex flex-col justify-center h-full">
                <div
                  className="flex flex-col items-center rounded-lg p-5 text-center"
                  style={{ border: '1.5px dashed var(--admin-rule)' }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                    stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                  </svg>
                  <div className="admin-display mt-2" style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                    TBD
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isPending && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating bracket…
        </div>
      )}

      {editingIdx !== null && editingPairing !== null && (
        <MatchSetupDialog
          matchIdx={editingIdx}
          pairing={editingPairing}
          qualifiedTeams={qualifiedTeams}
          assigned={assigned}
          tournamentStart={tournamentStart}
          tournamentEnd={tournamentEnd}
          onSave={(p) => savePairing(editingIdx, p)}
          onClose={() => setEditingIdx(null)}
        />
      )}
    </div>
  )
}

// A clickable bracket-style match slot
function MatchSlot({
  matchIdx,
  homeTeam,
  awayTeam,
  matchTime,
  isFilled,
  onClick,
}: {
  matchIdx: number
  homeTeam: Team | undefined
  awayTeam: Team | undefined
  matchTime: string
  isFilled: boolean
  onClick: () => void
}) {
  const timeDisplay = matchTime
    ? new Date(matchTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : null

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-md overflow-hidden text-left transition-all"
      style={{
        border: isFilled ? '1px solid var(--admin-lime)' : '1.5px dashed var(--admin-rule)',
        background: 'var(--card)',
        cursor: 'pointer',
      }}
      title={isFilled ? 'Click to edit this match' : 'Click to set up this match'}
    >
      <SlotRow team={homeTeam} placeholder={`Home — match ${matchIdx + 1}`} isFilled={isFilled} />
      <div style={{ height: 1, background: 'var(--admin-rule)' }} />
      <SlotRow team={awayTeam} placeholder={`Away — match ${matchIdx + 1}`} isFilled={isFilled} />
      {isFilled && timeDisplay ? (
        <div
          className="flex items-center gap-1.5 px-3 py-1.5"
          style={{
            borderTop: '1px solid var(--admin-rule)',
            background: 'var(--admin-lime-wash)',
          }}
        >
          <span className="admin-mono text-[10px]" style={{ color: 'var(--admin-lime)' }}>
            {timeDisplay}
          </span>
        </div>
      ) : (
        <div
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ borderTop: '1px solid var(--admin-rule)' }}
        >
          <Plus className="h-3 w-3" style={{ color: 'var(--admin-lime)' }} />
          <span className="admin-mono text-[10px]" style={{ color: 'var(--admin-lime)' }}>
            Set up match
          </span>
        </div>
      )}
    </button>
  )
}

function SlotRow({ team, placeholder, isFilled }: { team: Team | undefined; placeholder: string; isFilled: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <span
        className="admin-display inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] shrink-0"
        style={{
          background: team ? 'var(--admin-surface-2)' : 'transparent',
          color: team ? 'var(--muted-foreground)' : 'var(--muted-foreground)',
          border: team ? '1px solid var(--admin-rule)' : '1px dashed var(--admin-rule)',
        }}
      >
        {team ? teamInitials(team.name) : '?'}
      </span>
      <span
        className="truncate text-xs"
        style={{
          color: team ? 'var(--foreground)' : 'var(--muted-foreground)',
          fontStyle: team ? 'normal' : 'italic',
        }}
      >
        {team ? team.name : placeholder}
      </span>
    </div>
  )
}

// Popup dialog to configure a single match
function MatchSetupDialog({
  matchIdx,
  pairing,
  qualifiedTeams,
  assigned,
  tournamentStart,
  tournamentEnd,
  onSave,
  onClose,
}: {
  matchIdx: number
  pairing: Pairing
  qualifiedTeams: Team[]
  assigned: Set<string>
  tournamentStart: string
  tournamentEnd: string
  onSave: (p: Pairing) => void
  onClose: () => void
}) {
  const [home, setHome] = useState(pairing.home)
  const [away, setAway] = useState(pairing.away)
  const [time, setTime] = useState(() =>
    pairing.matchTime ? toLocalDatetime(new Date(pairing.matchTime).toISOString()) : ''
  )

  const minDatetime = `${tournamentStart}T00:00`
  const maxDatetime = `${tournamentEnd}T23:59`

  // Available teams: unassigned + the teams already in this pairing's slots
  const availableForHome = qualifiedTeams.filter(
    (t) => !assigned.has(t.id) || t.id === pairing.home || t.id === away,
  )
  const availableForAway = qualifiedTeams.filter(
    (t) => !assigned.has(t.id) || t.id === pairing.away || t.id === home,
  )

  const canSave = home && away && home !== away && time

  function handleSave() {
    if (!canSave) return
    onSave({ home, away, matchTime: time })
  }

  const selectStyle = {
    border: '1px solid var(--admin-rule)',
    background: 'var(--admin-surface-2)',
    color: 'var(--foreground)',
    outline: 'none',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 13,
    width: '100%',
  } as const

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set up Match {matchIdx + 1}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Home team */}
          <div className="space-y-1.5">
            <label className="admin-tab text-[11px] tracking-wider text-muted-foreground">
              Home Team
            </label>
            <select value={home} onChange={(e) => setHome(e.target.value)} style={selectStyle}>
              <option value="">Select home team…</option>
              {availableForHome.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Away team */}
          <div className="space-y-1.5">
            <label className="admin-tab text-[11px] tracking-wider text-muted-foreground">
              Away Team
            </label>
            <select value={away} onChange={(e) => setAway(e.target.value)} style={selectStyle}>
              <option value="">Select away team…</option>
              {availableForAway.map((t) => (
                <option key={t.id} value={t.id} disabled={t.id === home}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Kickoff time */}
          <div className="space-y-1.5">
            <Label htmlFor="match-kickoff">Kickoff time</Label>
            <Input
              id="match-kickoff"
              type="datetime-local"
              value={time}
              min={minDatetime}
              max={maxDatetime}
              onChange={(e) => setTime(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Must be within {tournamentStart} – {tournamentEnd}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PlaceholderCard({ homeLabel, awayLabel }: { homeLabel: string; awayLabel: string }) {
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
