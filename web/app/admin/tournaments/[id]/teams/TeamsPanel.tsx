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
import { ChevronDown, ChevronRight, Plus, Trash2, Loader2, Lock, Download, Upload } from 'lucide-react'
import {
  addTeamAction,
  deleteTeamAction,
  addPlayerAction,
  deletePlayerAction,
  importTeamsCsvAction,
} from './actions'
import { parseTeamsCsv } from '@/lib/csv'
import type { TournamentFormat } from '@/lib/supabase/types'

const SAMPLE_CSV_ROWS = [
  ['Eagles','Oliver Bennett','GK','1'],['Eagles','Liam Carter','DEF','2'],['Eagles','Noah Harrison','DEF','3'],
  ['Eagles','James Mitchell','DEF','4'],['Eagles','William Turner','DEF','5'],['Eagles','Benjamin Foster','MID','6'],
  ['Eagles','Lucas Edwards','MID','7'],['Eagles','Henry Collins','MID','8'],['Eagles','Alexander Stewart','MID','10'],
  ['Eagles','Daniel Morris','MID','11'],['Eagles','Mason Rogers','FWD','9'],['Eagles','Ethan Reed','FWD','12'],
  ['Eagles','Jack Bailey','FWD','13'],['Eagles','Sebastian Cooper','DEF','14'],['Eagles','Aiden Richardson','MID','15'],
  ['Eagles','Matthew Cox','FWD','16'],['Eagles','Joseph Ward','GK','17'],['Eagles','David Torres','DEF','18'],
  ['Eagles','Luke Peterson','MID','19'],['Eagles','Ryan Gray','FWD','20'],
  ['Lions','Elijah Hughes','GK','1'],['Lions','Nathan Price','DEF','2'],['Lions','Isaac Flores','DEF','3'],
  ['Lions','Caleb Sanders','DEF','4'],['Lions','Joshua Jenkins','DEF','5'],['Lions','Andrew Russell','MID','6'],
  ['Lions','Christopher Simmons','MID','7'],['Lions','Dylan Powell','MID','8'],['Lions','Zachary Long','MID','10'],
  ['Lions','Nicholas Patterson','MID','11'],['Lions','Tyler Hughes','FWD','9'],['Lions','Brandon Flores','FWD','12'],
  ['Lions','Austin Washington','FWD','13'],['Lions','Kevin Butler','DEF','14'],['Lions','Justin Barnes','MID','15'],
  ['Lions','Robert Ross','FWD','16'],['Lions','Jonathan Henderson','GK','17'],['Lions','Samuel Coleman','DEF','18'],
  ['Lions','Patrick Jenkins','MID','19'],['Lions','Eric Perry','FWD','20'],
  ['Tigers','Brian Powell','GK','1'],['Tigers','Raymond Long','DEF','2'],['Tigers','Gregory Patterson','DEF','3'],
  ['Tigers','Frank Hughes','DEF','4'],['Tigers','Raymond Washington','DEF','5'],['Tigers','Gerald Butler','MID','6'],
  ['Tigers','Harold Barnes','MID','7'],['Tigers','Walter Ross','MID','8'],['Tigers','Arthur Henderson','MID','10'],
  ['Tigers','Vincent Coleman','MID','11'],['Tigers','Roy Perry','FWD','9'],['Tigers','Eugene Powell','FWD','12'],
  ['Tigers','Russell Long','FWD','13'],['Tigers','Louis Patterson','DEF','14'],['Tigers','Albert Hughes','MID','15'],
  ['Tigers','Clarence Washington','FWD','16'],['Tigers','Fred Butler','GK','17'],['Tigers','Herbert Barnes','DEF','18'],
  ['Tigers','Earl Ross','MID','19'],['Tigers','Leroy Henderson','FWD','20'],
  ['Wolves','Edwin Coleman','GK','1'],['Wolves','Cecil Perry','DEF','2'],['Wolves','Ivan Powell','DEF','3'],
  ['Wolves','Marvin Long','DEF','4'],['Wolves','Alvin Patterson','DEF','5'],['Wolves','Glen Hughes','MID','6'],
  ['Wolves','Melvin Washington','MID','7'],['Wolves','Chester Butler','MID','8'],['Wolves','Wilbur Barnes','MID','10'],
  ['Wolves','Sherman Ross','MID','11'],['Wolves','Lester Henderson','FWD','9'],['Wolves','Floyd Coleman','FWD','12'],
  ['Wolves','Harvey Perry','FWD','13'],['Wolves','Reginald Powell','DEF','14'],['Wolves','Clifford Long','MID','15'],
  ['Wolves','Virgil Patterson','FWD','16'],['Wolves','Herman Hughes','GK','17'],['Wolves','Milton Washington','DEF','18'],
  ['Wolves','Elmer Butler','MID','19'],['Wolves','Homer Barnes','FWD','20'],
  ['Hawks','Salvatore Ross','GK','1'],['Hawks','Dominic Henderson','DEF','2'],['Hawks','Marco Coleman','DEF','3'],
  ['Hawks','Angelo Perry','DEF','4'],['Hawks','Enzo Powell','DEF','5'],['Hawks','Luca Long','MID','6'],
  ['Hawks','Matteo Patterson','MID','7'],['Hawks','Giovanni Hughes','MID','8'],['Hawks','Leonardo Washington','MID','10'],
  ['Hawks','Francesco Butler','MID','11'],['Hawks','Alessandro Barnes','FWD','9'],['Hawks','Roberto Ross','FWD','12'],
  ['Hawks','Stefano Henderson','FWD','13'],['Hawks','Antonio Coleman','DEF','14'],['Hawks','Federico Perry','MID','15'],
  ['Hawks','Claudio Powell','FWD','16'],['Hawks','Sergio Long','GK','17'],['Hawks','Fabio Patterson','DEF','18'],
  ['Hawks','Bruno Hughes','MID','19'],['Hawks','Emilio Washington','FWD','20'],
  ['Falcons','Carlos Butler','GK','1'],['Falcons','Miguel Barnes','DEF','2'],['Falcons','Pablo Ross','DEF','3'],
  ['Falcons','Diego Henderson','DEF','4'],['Falcons','Javier Coleman','DEF','5'],['Falcons','Alejandro Perry','MID','6'],
  ['Falcons','Fernando Powell','MID','7'],['Falcons','Ricardo Long','MID','8'],['Falcons','Eduardo Patterson','MID','10'],
  ['Falcons','Manuel Hughes','MID','11'],['Falcons','Andres Washington','FWD','9'],['Falcons','Rafael Butler','FWD','12'],
  ['Falcons','Sergio Barnes','FWD','13'],['Falcons','Alvaro Ross','DEF','14'],['Falcons','Raul Henderson','MID','15'],
  ['Falcons','Hector Coleman','FWD','16'],['Falcons','Oscar Perry','GK','17'],['Falcons','Ivan Powell','DEF','18'],
  ['Falcons','Victor Long','MID','19'],['Falcons','Emilio Patterson','FWD','20'],
  ['Panthers','Kai Hughes','GK','1'],['Panthers','Finn Washington','DEF','2'],['Panthers','Leo Butler','DEF','3'],
  ['Panthers','Max Barnes','DEF','4'],['Panthers','Axel Ross','DEF','5'],['Panthers','Soren Henderson','MID','6'],
  ['Panthers','Erik Coleman','MID','7'],['Panthers','Lars Perry','MID','8'],['Panthers','Mikkel Powell','MID','10'],
  ['Panthers','Bjorn Long','MID','11'],['Panthers','Rasmus Patterson','FWD','9'],['Panthers','Magnus Hughes','FWD','12'],
  ['Panthers','Niels Washington','FWD','13'],['Panthers','Henrik Butler','DEF','14'],['Panthers','Oskar Barnes','MID','15'],
  ['Panthers','Viggo Ross','FWD','16'],['Panthers','Tobias Henderson','GK','17'],['Panthers','Valentin Coleman','DEF','18'],
  ['Panthers','Emil Perry','MID','19'],['Panthers','Lukas Powell','FWD','20'],
  ['Sharks','Hamid Long','GK','1'],['Sharks','Yusuf Patterson','DEF','2'],['Sharks','Omar Hughes','DEF','3'],
  ['Sharks','Ibrahim Washington','DEF','4'],['Sharks','Khalid Butler','DEF','5'],['Sharks','Hassan Barnes','MID','6'],
  ['Sharks','Ali Ross','MID','7'],['Sharks','Tariq Henderson','MID','8'],['Sharks','Bilal Coleman','MID','10'],
  ['Sharks','Kareem Perry','MID','11'],['Sharks','Jamal Powell','FWD','9'],['Sharks','Malik Long','FWD','12'],
  ['Sharks','Rashid Patterson','FWD','13'],['Sharks','Idris Hughes','DEF','14'],['Sharks','Farouk Washington','MID','15'],
  ['Sharks','Suleiman Butler','FWD','16'],['Sharks','Mustafa Barnes','GK','17'],['Sharks','Samir Ross','DEF','18'],
  ['Sharks','Nabil Henderson','MID','19'],['Sharks','Ziad Coleman','FWD','20'],
] as const

function buildSampleCsv(): string {
  const header = 'team,player_name,position,jersey_number'
  const rows = SAMPLE_CSV_ROWS.map((r) => r.join(',')).join('\n')
  return `${header}\n${rows}`
}

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
}

export function TeamsPanel({
  tournamentId,
  initialTeams,
  canEdit,
  minPlayersPerTeam,
  format,
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
          <CardContent className="p-4 space-y-3">
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
            <div className="flex gap-2 pt-1 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const csv = buildSampleCsv()
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'teams-sample.csv'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <Download className="h-4 w-4" /> Sample CSV
              </Button>
              <CsvImportButton tournamentId={tournamentId} />
            </div>
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

function CsvImportButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text !== 'string') return
      const { rows, errors } = parseTeamsCsv(text)
      if (errors.length > 0 && rows.length === 0) {
        toast.error(errors[0])
        return
      }
      if (rows.length === 0) {
        toast.error('No valid rows found in CSV.')
        return
      }
      startTransition(async () => {
        const r = await importTeamsCsvAction(tournamentId, rows)
        if ('error' in r) {
          toast.error(r.error)
        } else {
          toast.success(`${r.teamsCreated} team${r.teamsCreated !== 1 ? 's' : ''}, ${r.playersAdded} player${r.playersAdded !== 1 ? 's' : ''} imported.`)
          router.refresh()
        }
        if (errors.length > 0) {
          toast.warning(`${errors.length} row${errors.length !== 1 ? 's' : ''} skipped — check console for details.`)
          console.warn('CSV import skipped rows:', errors)
        }
      })
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground focus-within:ring-1 focus-within:ring-ring">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      Import CSV
      <input type="file" accept=".csv" className="sr-only" onChange={handleFile} disabled={pending} />
    </label>
  )
}

