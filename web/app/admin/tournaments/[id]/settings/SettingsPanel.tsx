'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Loader2, Archive, CheckCircle2, Trash2, UserPlus, MapPin, Calendar } from 'lucide-react'
import {
  archiveTournamentAction,
  finishTournamentAction,
  deleteTournamentAction,
  assignOrganizerAction,
  removeOrganizerAction,
  updateTournamentImagesAction,
} from './actions'
import { ImageUpload } from '@/components/admin/ImageUpload'
import { removeImage } from '@/lib/storage-client'
import type { Tournament } from '@/lib/supabase/types'

interface Props {
  tournamentId: string
  tournament: Tournament
  isAdmin: boolean
  organizers: { id: string; email: string }[]
}

export function SettingsPanel({ tournamentId, tournament, isAdmin, organizers }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-5 max-w-3xl">
      <TournamentDetails tournament={tournament} />

      <BrandingCard tournamentId={tournamentId} tournament={tournament} />

      {isAdmin && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="font-semibold text-sm">Organizers</h3>
              <p className="text-xs text-muted-foreground">
                Organizers can manage this tournament&apos;s teams, fixtures, and scores.
              </p>
            </div>
            <AssignOrganizerForm tournamentId={tournamentId} />
            <div className="divide-y border-t">
              {organizers.length === 0 ? (
                <div className="py-3 text-sm text-muted-foreground">No organizers assigned.</div>
              ) : (
                organizers.map((o) => (
                  <div key={o.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex-1 truncate text-sm">{o.email}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-700 hover:bg-red-50"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await removeOrganizerAction(o.id, tournamentId)
                          if ('error' in r) toast.error(r.error)
                          else {
                            toast.success('Removed.')
                            router.refresh()
                          }
                        })
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-sm">Tournament status</h3>
          <p className="text-xs text-muted-foreground">
            Current status: <span className="font-medium text-foreground">{tournament.status}</span>.
          </p>
          <div className="flex gap-2 flex-wrap">
            {tournament.status === 'active' && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await finishTournamentAction(tournamentId)
                    if ('error' in r) toast.error(r.error)
                    else {
                      toast.success('Tournament marked finished.')
                      router.refresh()
                    }
                  })
                }
              >
                <CheckCircle2 className="h-4 w-4" /> Mark as Finished
              </Button>
            )}
            {tournament.status === 'finished' && isAdmin && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await archiveTournamentAction(tournamentId)
                    if ('error' in r) toast.error(r.error)
                    else {
                      toast.success('Archived.')
                      router.refresh()
                    }
                  })
                }
              >
                <Archive className="h-4 w-4" /> Archive
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-red-200">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-sm text-red-700">Danger zone</h3>
            <p className="text-xs text-muted-foreground">
              Deleting a tournament removes its teams, players, fixtures, and scores. This cannot be undone.
            </p>
            <DangerDelete tournamentName={tournament.name} tournamentId={tournamentId} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function BrandingCard({
  tournamentId,
  tournament,
}: {
  tournamentId: string
  tournament: Tournament
}) {
  const router = useRouter()

  async function save(
    patch: { logo_path: string | null } | { banner_path: string | null },
    oldPath: string | null,
    newPath: string | null,
  ) {
    const r = await updateTournamentImagesAction(tournamentId, patch)
    if ('error' in r) {
      toast.error(r.error)
      if (newPath) void removeImage(newPath)
      return
    }
    if (oldPath) void removeImage(oldPath)
    toast.success('Saved.')
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm">Branding</h3>
          <p className="text-xs text-muted-foreground">
            Logo and banner shown on the public tournament page.
          </p>
        </div>
        <div className="flex items-start gap-4">
          <ImageUpload
            label="Logo"
            value={tournament.logo_path}
            folder="tournament-logos"
            maxDim={512}
            onUploaded={(p) => save({ logo_path: p }, tournament.logo_path, p)}
            onRemove={() => save({ logo_path: null }, tournament.logo_path, null)}
          />
          <div className="flex-1">
            <ImageUpload
              label="Banner"
              shape="banner"
              value={tournament.banner_path}
              folder="tournament-banners"
              maxDim={1600}
              onUploaded={(p) => save({ banner_path: p }, tournament.banner_path, p)}
              onRemove={() => save({ banner_path: null }, tournament.banner_path, null)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AssignOrganizerForm({ tournamentId }: { tournamentId: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    startTransition(async () => {
      const r = await assignOrganizerAction(tournamentId, email.trim())
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Organizer assigned.')
        setEmail('')
        router.refresh()
      }
    })
  }
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1">
        <Label htmlFor="org-email" className="sr-only">Email</Label>
        <Input
          id="org-email"
          type="email"
          placeholder="organizer@club.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending || !email.trim()}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Assign
      </Button>
    </form>
  )
}

function formatLabel(f: string): string {
  switch (f) {
    case 'round_robin':
      return 'Round-robin'
    case 'knockout':
      return 'Knockout'
    case 'round_robin_knockout':
      return 'Group → Knockout'
    default:
      return f
  }
}

function knockoutStageLabel(round: string | null): string {
  switch (round) {
    case 'final':  return 'Final'
    case 'semi':   return 'Semi-final'
    case 'top_8':  return 'Quarter-final'
    case 'top_16': return 'Round of 16'
    case 'top_32': return 'Round of 32'
    default:       return '—'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function TournamentDetails({ tournament }: { tournament: Tournament }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h3 className="font-semibold text-sm">Tournament details</h3>

        <div className="space-y-3 text-sm">
          <DetailRow label="Name" value={tournament.name} />
          {tournament.description && (
            <DetailRow label="Description" value={tournament.description} />
          )}
          <DetailRow
            label="Dates"
            value={`${formatDate(tournament.start_date)} – ${formatDate(tournament.end_date)}`}
            icon={<Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
          />
          {tournament.location && (
            <DetailRow
              label="Venue"
              value={tournament.location}
              icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" />}
            />
          )}
          <DetailRow label="Format" value={formatLabel(tournament.format)} />
          {tournament.format === 'round_robin_knockout' && tournament.num_groups != null && (
            <DetailRow
              label="Group stage"
              value={`${tournament.num_groups} groups × ${tournament.teams_per_group ?? '?'} teams · top ${tournament.advance_per_group ?? '?'} advance`}
            />
          )}
          {tournament.format === 'round_robin_knockout' && (
            <DetailRow
              label="Knockout stage"
              value={knockoutStageLabel(tournament.knockout_start_round)}
            />
          )}
          <DetailRow
            label="Match length"
            value={`${tournament.minutes_per_half} min halves${tournament.halftime_enabled ? ` + ${tournament.halftime_minutes ?? '?'} min halftime` : ' (no halftime)'}`}
          />
          <DetailRow
            label="Points"
            value={`W ${tournament.points_win} / D ${tournament.points_draw} / L ${tournament.points_loss}`}
          />
          <DetailRow
            label="Min players per team"
            value={String(tournament.min_players_per_team)}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-36 shrink-0 text-xs text-muted-foreground pt-px">{label}</span>
      <span className="flex-1 text-sm flex items-center gap-1.5">
        {icon}
        {value}
      </span>
    </div>
  )
}

function DangerDelete({
  tournamentName,
  tournamentId,
}: {
  tournamentName: string
  tournamentId: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [pending, startTransition] = useTransition()

  const canDelete = confirm.trim() === tournamentName

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4" /> Delete tournament
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{tournamentName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            Type <span className="font-mono">{tournamentName}</span> to confirm. This permanently
            removes all teams, players, fixtures, and scores.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input
          autoFocus
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={tournamentName}
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canDelete || pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault()
              startTransition(async () => {
                const r = await deleteTournamentAction(tournamentId)
                if ('error' in r) toast.error(r.error)
                else {
                  toast.success('Tournament deleted.')
                  setOpen(false)
                  router.push('/admin')
                  router.refresh()
                }
              })
            }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Delete forever
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
