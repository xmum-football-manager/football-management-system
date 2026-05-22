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
import { Loader2, Archive, CheckCircle2, Trash2, UserPlus } from 'lucide-react'
import {
  archiveTournamentAction,
  finishTournamentAction,
  deleteTournamentAction,
  assignOrganizerAction,
  removeOrganizerAction,
} from './actions'
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
