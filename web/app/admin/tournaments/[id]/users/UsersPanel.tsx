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
import { Loader2, UserPlus, Trash2 } from 'lucide-react'
import {
  assignOrganizerAction,
  removeOrganizerAction,
  assignScorekeeperAction,
  removeScorekeeperAction,
} from './actions'

interface Match {
  id: string
  label: string
  time: string
}

interface ScorekeeperAssignment {
  id: string
  email: string
  scope: 'tournament' | 'match'
  matchLabel: string | null
}

interface Props {
  tournamentId: string
  isAdmin: boolean
  organizers: { id: string; email: string }[]
  matches: Match[]
  scorekeeperAssignments: ScorekeeperAssignment[]
}

export function UsersPanel({
  tournamentId,
  isAdmin,
  organizers,
  matches,
  scorekeeperAssignments,
}: Props) {
  return (
    <div className="space-y-8">
      {isAdmin && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Organizers</h2>
            <p className="text-xs text-muted-foreground">
              Organizers can manage this tournament&apos;s teams, fixtures, and scores.
            </p>
          </div>
          <OrganizersSection tournamentId={tournamentId} organizers={organizers} />
        </section>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Scorekeepers</h2>
          <p className="text-xs text-muted-foreground">
            Scorekeepers can enter match scores during the tournament.
          </p>
        </div>
        <ScorekeepersSection
          tournamentId={tournamentId}
          matches={matches}
          assignments={scorekeeperAssignments}
        />
      </section>
    </div>
  )
}

function OrganizersSection({
  tournamentId,
  organizers,
}: {
  tournamentId: string
  organizers: { id: string; email: string }[]
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pending, startTransition] = useTransition()

  function handleAssign(e: React.FormEvent) {
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
    <Card>
      <CardContent className="p-4 space-y-3">
        <form onSubmit={handleAssign} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="org-email" className="sr-only">Email</Label>
            <Input
              id="org-email"
              type="email"
              placeholder="organizer@club.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </div>
          <Button type="submit" disabled={pending || !email.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Assign
          </Button>
        </form>
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
  )
}

function ScorekeepersSection({
  tournamentId,
  matches,
  assignments,
}: {
  tournamentId: string
  matches: Match[]
  assignments: ScorekeeperAssignment[]
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [scope, setScope] = useState<'tournament' | 'match'>('tournament')
  const [matchId, setMatchId] = useState('')
  const [pending, startTransition] = useTransition()

  function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (scope === 'match' && !matchId) {
      toast.error('Pick a match.')
      return
    }
    startTransition(async () => {
      const r = await assignScorekeeperAction({
        tournamentId,
        email: email.trim(),
        scope,
        matchId: scope === 'match' ? matchId : null,
      })
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Scorekeeper assigned.')
        setEmail('')
        setMatchId('')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Assign a scorekeeper</h3>
          <form onSubmit={handleAssign} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sk-email">Email</Label>
              <Input
                id="sk-email"
                type="email"
                placeholder="scorekeeper@club.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The user must already have a scorekeeper account.
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Scope</legend>
              <div className="flex flex-col gap-2">
                <label className={`flex items-start gap-3 rounded-md border p-2.5 cursor-pointer ${scope === 'tournament' ? 'border-emerald-600 bg-emerald-50' : 'hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="sk-scope"
                    className="mt-1"
                    checked={scope === 'tournament'}
                    onChange={() => setScope('tournament')}
                  />
                  <div>
                    <div className="text-sm font-medium">Entire tournament</div>
                    <div className="text-xs text-muted-foreground">Scores any match in this tournament.</div>
                  </div>
                </label>
                <label className={`flex items-start gap-3 rounded-md border p-2.5 cursor-pointer ${scope === 'match' ? 'border-emerald-600 bg-emerald-50' : 'hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="sk-scope"
                    className="mt-1"
                    checked={scope === 'match'}
                    onChange={() => setScope('match')}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Specific match</div>
                    <div className="text-xs text-muted-foreground">Only the chosen match.</div>
                    {scope === 'match' && (
                      <div className="mt-2">
                        <Select value={matchId} onValueChange={setMatchId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pick a match" />
                          </SelectTrigger>
                          <SelectContent>
                            {matches.length === 0 ? (
                              <SelectItem value="__none__" disabled>
                                No scheduled matches
                              </SelectItem>
                            ) : (
                              matches.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.label}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </fieldset>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Assign
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Current Assignments ({assignments.length})
        </h3>
        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No scorekeepers assigned yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3">
                  <span className="flex-1 truncate font-medium text-sm">{a.email}</span>
                  {a.scope === 'tournament' ? (
                    <Badge variant="info">Tournament-wide</Badge>
                  ) : (
                    <Badge variant="outline">{a.matchLabel ?? 'Match'}</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-700 hover:bg-red-50"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await removeScorekeeperAction(a.id, tournamentId)
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
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
