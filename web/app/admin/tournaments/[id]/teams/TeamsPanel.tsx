'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ChevronDown, ChevronRight, Plus, Trash2, Loader2, Lock, AlertCircle } from 'lucide-react'
import {
  addTeamAction,
  deleteTeamAction,
  addPlayerAction,
  deletePlayerAction,
} from './actions'
import { CsvImport } from './CsvImport'
import type { TournamentFormat } from '@/lib/supabase/types'

interface PlayerData {
  id: string
  name: string
  jersey_number: number | null
  position: string | null
}

interface TeamData {
  id: string
  name: string
  group_label: string | null
  players: PlayerData[]
}

interface Props {
  tournamentId: string
  initialTeams: TeamData[]
  canEdit: boolean
  minPlayersPerTeam: number
  format: TournamentFormat
  readinessMessage?: string | null
}

export function TeamsPanel({
  tournamentId,
  initialTeams,
  canEdit,
  minPlayersPerTeam,
  format,
  readinessMessage,
}: Props) {
  const router = useRouter()
  const [newTeam, setNewTeam] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  function toggle(id: string) {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpen(next)
  }

  async function handleAddTeam(e: React.FormEvent) {
    e.preventDefault()
    const name = newTeam.trim()
    if (!name) return
    startTransition(async () => {
      const r = await addTeamAction(tournamentId, name)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Team added.')
        setNewTeam('')
        router.refresh()
      }
    })
  }

  async function handleDeleteTeam(id: string) {
    startTransition(async () => {
      const r = await deleteTeamAction(id, tournamentId)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Team deleted.')
        router.refresh()
      }
    })
  }

  const showGroups = format === 'round_robin_knockout'

  return (
    <div className="space-y-5">
      {readinessMessage && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" />
          {readinessMessage}
        </div>
      )}

      {!canEdit && (
        <div className="rounded-md border bg-amber-50 border-amber-200 px-3 py-2 text-xs text-amber-900 flex items-center gap-2">
          <Lock className="h-3 w-3" /> Teams are locked — a match has gone live or the tournament is finished.
        </div>
      )}

      {showGroups && (
        <div
          className="rounded-md border bg-emerald-50/60 border-emerald-200 px-3 py-2 text-xs text-emerald-900"
        >
          Group assignment now lives on the <span className="font-semibold">Fixtures</span> tab →
          Groups view.
        </div>
      )}

      {canEdit && (
        <Card>
          <CardContent className="p-4">
            <CsvImport
              tournamentId={tournamentId}
              disabled={initialTeams.length > 0}
            />
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleAddTeam} className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="team-name" className="sr-only">Team name</Label>
                <Input
                  id="team-name"
                  placeholder="New team name"
                  value={newTeam}
                  onChange={(e) => setNewTeam(e.target.value)}
                  disabled={pending}
                />
              </div>
              <Button type="submit" disabled={pending || !newTeam.trim()}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Team
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {initialTeams.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No teams yet. Add some teams above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {initialTeams.map((t) => {
            const isOpen = open.has(t.id)
            const short = t.players.length < minPlayersPerTeam
            return (
              <Card key={t.id}>
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-semibold flex-1 truncate">{t.name}</span>
                  {showGroups && t.group_label && (
                    <Badge variant="outline" className="text-[10px]">
                      Group {t.group_label}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {t.players.length} player{t.players.length === 1 ? '' : 's'}
                  </span>
                  {short && (
                    <Badge variant="warning" className="text-[10px]">
                      &lt; {minPlayersPerTeam}
                    </Badge>
                  )}
                </button>
                {isOpen && (
                  <CardContent className="p-4 pt-0 border-t space-y-3">
                    <PlayerList
                      tournamentId={tournamentId}
                      players={t.players}
                      canEdit={canEdit}
                    />
                    {canEdit && (
                      <AddPlayerForm teamId={t.id} tournamentId={tournamentId} />
                    )}
                    {canEdit && (
                      <div className="flex justify-end pt-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" /> Delete team
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {t.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes the team and its {t.players.length} player{t.players.length === 1 ? '' : 's'}. Cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleDeleteTeam(t.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PlayerList({
  tournamentId,
  players,
  canEdit,
}: {
  tournamentId: string
  players: PlayerData[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  if (players.length === 0) {
    return <div className="text-sm text-muted-foreground">No players yet.</div>
  }
  return (
    <ul className="divide-y -mx-4">
      {players.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-2">
          <span className="font-mono w-8 text-sm text-muted-foreground">
            {p.jersey_number ?? '—'}
          </span>
          <span className="flex-1 truncate text-sm">{p.name}</span>
          {p.position && (
            <span className="text-xs text-muted-foreground uppercase tracking-wide">{p.position}</span>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deletePlayerAction(p.id, tournamentId)
                  if ('error' in r) toast.error(r.error)
                  else router.refresh()
                })
              }
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const

function AddPlayerForm({ teamId, tournamentId }: { teamId: string; tournamentId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [num, setNum] = useState('')
  const [pos, setPos] = useState('')
  const [pending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    startTransition(async () => {
      const r = await addPlayerAction({
        team_id: teamId,
        name: trimmedName,
        jersey_number: num ? Number(num) : null,
        position: pos.trim() || null,
        tournamentId,
      })
      if ('error' in r) toast.error(r.error)
      else {
        setName('')
        setNum('')
        setPos('')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-2 pt-2">
      <Input
        className="col-span-6"
        placeholder="Player name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
      />
      <Input
        className="col-span-2"
        type="number"
        placeholder="#"
        min={0}
        max={99}
        value={num}
        onChange={(e) => setNum(e.target.value)}
        disabled={pending}
      />
      <Select value={pos} onValueChange={setPos} disabled={pending}>
        <SelectTrigger className="col-span-2">
          <SelectValue placeholder="Pos" />
        </SelectTrigger>
        <SelectContent>
          {POSITIONS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" className="col-span-2" disabled={pending || !name.trim()}>
        <Plus className="h-4 w-4" />
        Add
      </Button>
    </form>
  )
}

