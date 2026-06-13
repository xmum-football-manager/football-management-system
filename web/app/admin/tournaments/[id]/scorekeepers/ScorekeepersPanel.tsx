'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, UserPlus, Trash2 } from 'lucide-react'
import { assignScorekeeperAction, createAndAssignScorekeeperAction, removeScorekeeperAction } from './actions'
import { DEFAULT_PASSWORD } from '@/lib/users'

interface Match {
  id: string
  label: string
  time: string | null
}

interface Assignment {
  id: string
  email: string
  scope: 'tournament' | 'match'
  matchLabel: string | null
}

interface Props {
  tournamentId: string
  matches: Match[]
  assignments: Assignment[]
}

export function ScorekeepersPanel({ tournamentId, matches, assignments }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'assign' | 'create'>('assign')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(DEFAULT_PASSWORD)
  const [scope, setScope] = useState<'tournament' | 'match'>('tournament')
  const [matchId, setMatchId] = useState('')
  const [pending, startTransition] = useTransition()

  function resetForm() {
    setEmail('')
    setPassword(DEFAULT_PASSWORD)
    setMatchId('')
  }

  async function handleAssign(e: React.FormEvent) {
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
        resetForm()
        router.refresh()
      }
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (scope === 'match' && !matchId) {
      toast.error('Pick a match.')
      return
    }
    startTransition(async () => {
      const r = await createAndAssignScorekeeperAction({
        tournamentId,
        email: email.trim(),
        password,
        scope,
        matchId: scope === 'match' ? matchId : null,
      })
      if ('error' in r) {
        toast.error(r.error)
      } else if (r.alreadyExisted) {
        toast.success('Existing account found — assigned as scorekeeper')
        resetForm()
        router.refresh()
      } else {
        toast.success(`Account created — login: ${email.trim()} / ${password}`)
        resetForm()
        router.refresh()
      }
    })
  }

  async function handleRemove(id: string) {
    startTransition(async () => {
      const r = await removeScorekeeperAction(id, tournamentId)
      if ('error' in r) toast.error(r.error)
      else {
        toast.success('Removed.')
        router.refresh()
      }
    })
  }

  const scopePicker = (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Scope</legend>
      <div className="flex flex-col gap-2">
        <label className={`flex items-start gap-3 rounded-md border p-2.5 cursor-pointer ${scope === 'tournament' ? 'border-emerald-600 bg-emerald-50' : 'hover:bg-slate-50'}`}>
          <input
            type="radio"
            name="scope"
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
            name="scope"
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
  )

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Assign a scorekeeper</h3>

          {/* Mode toggle */}
          <div className="flex rounded-md border overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => { setMode('assign'); resetForm() }}
              className={`flex-1 px-3 py-1.5 transition-colors ${mode === 'assign' ? 'bg-emerald-600 text-white font-medium' : 'hover:bg-slate-50'}`}
            >
              Assign existing
            </button>
            <button
              type="button"
              onClick={() => { setMode('create'); resetForm() }}
              className={`flex-1 px-3 py-1.5 transition-colors border-l ${mode === 'create' ? 'bg-emerald-600 text-white font-medium' : 'hover:bg-slate-50'}`}
            >
              Create new
            </button>
          </div>

          {mode === 'assign' ? (
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
              </div>
              {scopePicker}
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Assign
              </Button>
            </form>
          ) : (
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sk-new-email">Email</Label>
                <Input
                  id="sk-new-email"
                  type="email"
                  placeholder="scorekeeper@club.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sk-new-password">Password</Label>
                <Input
                  id="sk-new-password"
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Pre-filled with the default. The user will be prompted to change it on first login.
                </p>
              </div>
              {scopePicker}
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create &amp; Assign
              </Button>
            </form>
          )}
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
                    onClick={() => handleRemove(a.id)}
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
