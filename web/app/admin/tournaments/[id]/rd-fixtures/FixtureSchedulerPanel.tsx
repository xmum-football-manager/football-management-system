'use client'

import { useTransition, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, Clock, X } from 'lucide-react'
import type { MatchWithTeams } from '@/lib/supabase/types'
import { computeEndTime, getTournamentDays } from '@/lib/fixture-scheduling'
import { scheduleMatchAction } from '../fixtures/actions'

interface Props {
  tournamentId: string
  initialMatches: MatchWithTeams[]
  startDate: string
  endDate: string
  minutesPerHalf: number
  halftimeEnabled: boolean
  halftimeMinutes: number | null
}

function matchLabel(m: MatchWithTeams): string {
  const group = m.home_team.group_label
  const prefix = group ? `Group ${group}: ` : ''
  return `${prefix}${m.home_team.name} vs ${m.away_team.name}`
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function isoDateOf(isoString: string): string {
  return new Date(isoString).toISOString().split('T')[0]
}

export function FixtureSchedulerPanel({
  tournamentId,
  initialMatches,
  startDate,
  endDate,
  minutesPerHalf,
  halftimeEnabled,
  halftimeMinutes,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [matches, setMatches] = useState<MatchWithTeams[]>(initialMatches)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formDay, setFormDay] = useState('')
  const [formTime, setFormTime] = useState('')

  const days = getTournamentDays(startDate, endDate)

  const unscheduled = matches.filter((m) => m.match_time === null)
  const scheduled = matches.filter((m) => m.match_time !== null)

  // Group scheduled matches by date, sorted earliest first within each day
  const dayMap = new Map<string, MatchWithTeams[]>()
  for (const m of scheduled) {
    const date = isoDateOf(m.match_time!)
    if (!dayMap.has(date)) dayMap.set(date, [])
    dayMap.get(date)!.push(m)
  }
  for (const group of dayMap.values()) {
    group.sort((a, b) => a.match_time!.localeCompare(b.match_time!))
  }

  // Only show days that have scheduled matches
  const activeDays = days.filter((d) => dayMap.has(d.date))

  const endTime = formDay && formTime
    ? computeEndTime(formTime, minutesPerHalf, halftimeEnabled, halftimeMinutes)
    : null

  function openForm(matchId: string) {
    setEditingId(matchId)
    setFormDay(days[0]?.date ?? '')
    setFormTime('09:00')
  }

  function closeForm() {
    setEditingId(null)
    setFormDay('')
    setFormTime('')
  }

  function submitSchedule(matchId: string) {
    if (!formDay || !formTime) return
    const matchTime = `${formDay}T${formTime}:00`
    const prev = matches
    setMatches((ms) =>
      ms.map((m) => (m.id === matchId ? { ...m, match_time: matchTime } : m)),
    )
    closeForm()
    startTransition(async () => {
      const r = await scheduleMatchAction(matchId, tournamentId, matchTime)
      if ('error' in r) {
        toast.error(r.error)
        setMatches(prev)
      }
    })
  }

  function unscheduleMatch(matchId: string) {
    const prev = matches
    setMatches((ms) =>
      ms.map((m) => (m.id === matchId ? { ...m, match_time: null } : m)),
    )
    startTransition(async () => {
      const r = await scheduleMatchAction(matchId, tournamentId, null)
      if ('error' in r) {
        toast.error(r.error)
        setMatches(prev)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Unscheduled pool */}
      {unscheduled.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Unscheduled</span>
              <Badge variant="secondary">{unscheduled.length}</Badge>
            </div>
            {unscheduled.map((m) => (
              <div key={m.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{matchLabel(m)}</span>
                  {editingId !== m.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={pending}
                      onClick={() => openForm(m.id)}
                    >
                      <Calendar className="h-3 w-3 mr-1" /> Schedule
                    </Button>
                  )}
                </div>
                {editingId === m.id && (
                  <ScheduleForm
                    days={days}
                    formDay={formDay}
                    formTime={formTime}
                    endTime={endTime}
                    pending={pending}
                    onDayChange={setFormDay}
                    onTimeChange={setFormTime}
                    onConfirm={() => submitSchedule(m.id)}
                    onCancel={closeForm}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Day cards */}
      {activeDays.map((day) => {
        const dayMatches = dayMap.get(day.date) ?? []
        return (
          <Card key={day.date}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{day.label}</span>
                <Badge variant="secondary">{dayMatches.length}</Badge>
              </div>
              {dayMatches.map((m) => (
                <div key={m.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">
                      {matchLabel(m)}{' '}
                      <span className="text-muted-foreground">
                        · {formatTime(m.match_time!)} – {computeEndTime(
                          formatTime(m.match_time!),
                          minutesPerHalf,
                          halftimeEnabled,
                          halftimeMinutes,
                        )}
                      </span>
                    </span>
                    {editingId !== m.id && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={pending}
                          onClick={() => openForm(m.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={pending}
                          onClick={() => unscheduleMatch(m.id)}
                          aria-label={`Unschedule ${m.home_team.name} vs ${m.away_team.name}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {editingId === m.id && (
                    <ScheduleForm
                      days={days}
                      formDay={formDay}
                      formTime={formTime}
                      endTime={endTime}
                      pending={pending}
                      onDayChange={setFormDay}
                      onTimeChange={setFormTime}
                      onConfirm={() => submitSchedule(m.id)}
                      onCancel={closeForm}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}

      {unscheduled.length === 0 && scheduled.length > 0 && (
        <p className="text-xs text-emerald-700 font-medium">All fixtures scheduled.</p>
      )}
    </div>
  )
}

interface ScheduleFormProps {
  days: Array<{ label: string; date: string }>
  formDay: string
  formTime: string
  endTime: string | null
  pending: boolean
  onDayChange: (v: string) => void
  onTimeChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}

function ScheduleForm({
  days,
  formDay,
  formTime,
  endTime,
  pending,
  onDayChange,
  onTimeChange,
  onConfirm,
  onCancel,
}: ScheduleFormProps) {
  return (
    <div className="ml-0 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2">
      <Select value={formDay} onValueChange={onDayChange} disabled={pending}>
        <SelectTrigger className="w-40 h-7 text-xs">
          <SelectValue placeholder="Day…" />
        </SelectTrigger>
        <SelectContent>
          {days.map((d) => (
            <SelectItem key={d.date} value={d.date}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input
        type="time"
        value={formTime}
        onChange={(e) => onTimeChange(e.target.value)}
        disabled={pending}
        className="h-7 rounded-md border bg-background px-2 text-xs"
      />
      {endTime && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> ends {endTime}
        </span>
      )}
      <Button size="sm" className="h-7 text-xs" disabled={pending || !formDay || !formTime} onClick={onConfirm}>
        Confirm
      </Button>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
