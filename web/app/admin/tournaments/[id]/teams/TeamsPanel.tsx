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
import { ChevronDown, ChevronRight, Plus, Trash2, Loader2, Lock, AlertCircle, Pencil, Check, X } from 'lucide-react'
import {
  addTeamAction,
  deleteTeamAction,
  addPlayerAction,
  updatePlayerAction,
  deletePlayerAction,
  setTeamLogoAction,
  setPlayerPhotoAction,
} from './actions'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { mediaUrl } from '@/lib/storage'
import { removeImage } from '@/lib/storage-client'
import type { TournamentFormat } from '@/lib/supabase/types'
import { CsvImport } from './CsvImport'

interface PlayerData {
  id: string
  name: string
  jersey_number: number | null
  photo_path: string | null
}

interface TeamData {
  id: string
  name: string
  group_label: string | null
  logo_path: string | null
  players: PlayerData[]
}

interface Props {
  tournamentId: string
  initialTeams: TeamData[]
  canEdit: boolean
  // Adding players stays allowed after a match goes live (rosters can grow);
  // only deletions lock. Falls back to canEdit when a caller doesn't set it.
  canAddPlayers?: boolean
  minPlayersPerTeam: number
  format: TournamentFormat
  phase?: 'rd' | 'ko'
  readinessMessage?: string | null
}

export function TeamsPanel({
  tournamentId,
  initialTeams,
  canEdit,
  canAddPlayers,
  minPlayersPerTeam,
  format,
  phase,
  readinessMessage,
}: Props) {
  const addPlayersAllowed = canAddPlayers ?? canEdit
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

  async function handleTeamLogo(team: TeamData, path: string | null) {
    const r = await setTeamLogoAction(team.id, tournamentId, path)
    if ('error' in r) {
      toast.error(r.error)
      if (path) void removeImage(path)
      return
    }
    if (team.logo_path) void removeImage(team.logo_path)
    router.refresh()
  }

  const showGroups = format === 'round_robin_knockout'
  const showCsvImport = !(phase === 'ko' && format === 'round_robin_knockout')

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
          <Lock className="h-3 w-3" />
          {addPlayersAllowed
            ? 'A match has gone live — you can still add players and change logos/photos, but deleting players or teams is locked.'
            : 'Teams are locked — the tournament is finished. Logos and photos can still be changed.'}
        </div>
      )}

{canEdit && showCsvImport && (
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
                  {t.logo_path && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(t.logo_path)!}
                      alt=""
                      className="h-6 w-6 rounded-full border object-cover"
                    />
                  )}
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
                    {/* Images stay editable even when the team list is locked */}
                    <div className="pt-3">
                      <ImageUpload
                        label="Team logo"
                        value={t.logo_path}
                        folder="team-logos"
                        maxDim={512}
                        onUploaded={(path) => handleTeamLogo(t, path)}
                        onRemove={() => handleTeamLogo(t, null)}
                      />
                    </div>
                    <PlayerList
                      tournamentId={tournamentId}
                      players={t.players}
                      canEdit={canEdit}
                      canEditPlayers={addPlayersAllowed}
                    />
                    {addPlayersAllowed && (
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
  canEditPlayers,
}: {
  tournamentId: string
  players: PlayerData[]
  canEdit: boolean
  canEditPlayers: boolean
}) {
  if (players.length === 0) {
    return <div className="text-sm text-muted-foreground">No players yet.</div>
  }
  return (
    <ul className="divide-y -mx-4">
      {players.map((p) => (
        <PlayerRow
          key={p.id}
          player={p}
          tournamentId={tournamentId}
          canEdit={canEdit}
          canEditPlayers={canEditPlayers}
        />
      ))}
    </ul>
  )
}

function PlayerRow({
  player,
  tournamentId,
  canEdit,
  canEditPlayers,
}: {
  player: PlayerData
  tournamentId: string
  canEdit: boolean
  canEditPlayers: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(player.name)
  const [num, setNum] = useState(player.jersey_number?.toString() ?? '')

  async function handlePhoto(path: string | null) {
    const r = await setPlayerPhotoAction(player.id, tournamentId, path)
    if ('error' in r) {
      toast.error(r.error)
      if (path) void removeImage(path)
      return
    }
    if (player.photo_path) void removeImage(player.photo_path)
    router.refresh()
  }

  function saveEdit() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Player name is required.')
      return
    }
    startTransition(async () => {
      // Same player row → recorded goals/cards are preserved; only the name/number change.
      const r = await updatePlayerAction({
        playerId: player.id,
        name: trimmed,
        jersey_number: num ? Number(num) : null,
        tournamentId,
      })
      if ('error' in r) toast.error(r.error)
      else {
        setEditing(false)
        router.refresh()
      }
    })
  }

  function cancelEdit() {
    setName(player.name)
    setNum(player.jersey_number?.toString() ?? '')
    setEditing(false)
  }

  return (
    <li className="flex items-center gap-3 px-4 py-2">
      {/* Photos stay editable even when the team list is locked */}
      <ImageUpload
        value={player.photo_path}
        folder="player-photos"
        maxDim={512}
        size="sm"
        title="Player photo"
        onUploaded={(path) => handlePhoto(path)}
        onRemove={() => handlePhoto(null)}
      />
      {editing ? (
        <>
          <Input
            className="w-12"
            type="number"
            min={0}
            max={99}
            value={num}
            onChange={(e) => setNum(e.target.value)}
            disabled={pending}
            aria-label="Jersey number"
          />
          <Input
            className="flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            autoFocus
            aria-label="Player name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit()
              else if (e.key === 'Escape') cancelEdit()
            }}
          />
          <Button variant="ghost" size="sm" disabled={pending} onClick={saveEdit} title="Save">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={cancelEdit} title="Cancel">
            <X className="h-3 w-3" />
          </Button>
        </>
      ) : (
        <>
          <span className="font-mono w-8 text-sm text-muted-foreground">
            {player.jersey_number ?? '—'}
          </span>
          <span className="flex-1 truncate text-sm">{player.name}</span>
          {canEditPlayers && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setEditing(true)}
              title="Edit name / number"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deletePlayerAction(player.id, tournamentId)
                  if ('error' in r) toast.error(r.error)
                  else router.refresh()
                })
              }
              title="Delete player"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </>
      )}
    </li>
  )
}

function AddPlayerForm({ teamId, tournamentId }: { teamId: string; tournamentId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [num, setNum] = useState('')
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
        tournamentId,
      })
      if ('error' in r) toast.error(r.error)
      else {
        setName('')
        setNum('')
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-2 pt-2">
      <Input
        className="col-span-8"
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
      <Button type="submit" className="col-span-2" disabled={pending || !name.trim()}>
        <Plus className="h-4 w-4" />
        Add
      </Button>
    </form>
  )
}

