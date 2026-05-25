'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Loader2, Archive, CheckCircle2, Trash2 } from 'lucide-react'
import {
  archiveTournamentAction,
  finishTournamentAction,
  deleteTournamentAction,
} from './actions'
import type { Tournament } from '@/lib/supabase/types'

interface Props {
  tournamentId: string
  tournament: Tournament
  isAdmin: boolean
}

export function SettingsPanel({ tournamentId, tournament, isAdmin }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-5 max-w-3xl">
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
