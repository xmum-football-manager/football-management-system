'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Check, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QualifiersStep } from './QualifiersStep'
import { FixturesPanel } from '../fixtures/FixturesPanel'
import { seedKnockoutBracketAction } from '../fixtures/actions'
import type { MatchWithTeams, TournamentStatus } from '@/lib/supabase/types'
import type { TeamStanding } from '@/lib/qualifiers'

type Step = 'qualifiers' | 'bracket'
type StepStatus = 'done' | 'current' | 'upcoming' | 'locked'

interface Props {
  tournamentId: string
  standings: TeamStanding[]
  savedQualifiers: string[] | null
  advancePerGroup: number
  numGroups: number
  knockoutMatches: MatchWithTeams[]
  teams: Array<{ id: string; name: string; group_label: string | null }>
  tournamentStart: string
  tournamentEnd: string
  tournamentStatus: TournamentStatus
  isAdmin: boolean
  canEdit: boolean
  knockoutSlots: number
  advancePerGroupForPanel: number | null
  knockoutQualifiers: string[] | null
  numGroupsForPanel: number | null
}

export function KnockoutStepper({
  tournamentId,
  standings,
  savedQualifiers,
  advancePerGroup,
  numGroups,
  knockoutMatches,
  teams,
  tournamentStart,
  tournamentEnd,
  tournamentStatus,
  isAdmin,
  canEdit,
  knockoutSlots,
  advancePerGroupForPanel,
  knockoutQualifiers,
  numGroupsForPanel,
}: Props) {
  const [pending, startTransition] = useTransition()
  const qualifiersDone = (savedQualifiers?.length ?? 0) > 0
  const bracketExists = knockoutMatches.length > 0

  const initialStep: Step = qualifiersDone ? 'bracket' : 'qualifiers'
  const [activeStep, setActiveStep] = useState<Step>(initialStep)

  const steps: Array<{ id: Step; label: string; status: StepStatus; lockReason?: string }> = [
    {
      id: 'qualifiers',
      label: 'Qualifiers',
      status: qualifiersDone
        ? 'done'
        : activeStep === 'qualifiers'
        ? 'current'
        : 'upcoming',
    },
    {
      id: 'bracket',
      label: 'Bracket',
      status: !qualifiersDone
        ? 'locked'
        : bracketExists
        ? 'done'
        : activeStep === 'bracket'
        ? 'current'
        : 'upcoming',
      lockReason: !qualifiersDone ? 'Save qualifiers first.' : undefined,
    },
  ]

  function seedBracket() {
    startTransition(async () => {
      const r = await seedKnockoutBracketAction(tournamentId)
      if ('error' in r) toast.error(r.error)
      else toast.success(`${r.seeded} knockout matches created.`)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const canNav = step.status !== 'locked'
          return (
            <div key={step.id} className="flex items-center gap-1">
              <button
                onClick={() => canNav && setActiveStep(step.id)}
                disabled={!canNav}
                title={step.lockReason}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  color: activeStep === step.id ? 'var(--admin-lime)' : 'var(--muted-foreground)',
                  background: activeStep === step.id ? 'color-mix(in srgb, var(--admin-lime) 10%, transparent)' : 'transparent',
                  opacity: step.status === 'locked' ? 0.5 : 1,
                  cursor: canNav ? 'pointer' : 'not-allowed',
                }}
              >
                {step.status === 'done' ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : step.status === 'locked' ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <span
                    className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{
                      background: activeStep === step.id ? 'var(--admin-lime)' : 'var(--muted-foreground)',
                      color: activeStep === step.id ? 'black' : 'var(--background)',
                    }}
                  >
                    {i + 1}
                  </span>
                )}
                {step.label}
              </button>
              {i < steps.length - 1 && (
                <span className="text-xs text-muted-foreground/40">──</span>
              )}
            </div>
          )
        })}
      </div>

      {activeStep === 'qualifiers' && (
        <QualifiersStep
          tournamentId={tournamentId}
          standings={standings}
          savedQualifiers={savedQualifiers}
          advancePerGroup={advancePerGroup}
          numGroups={numGroups}
          onSaved={() => setActiveStep('bracket')}
        />
      )}

      {activeStep === 'bracket' && (
        <div className="space-y-4">
          {!bracketExists && canEdit && (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                {knockoutSlots} qualifiers saved. Seed the bracket to generate first-round matches.
              </p>
              <Button size="sm" disabled={pending} onClick={seedBracket}>
                Seed bracket
              </Button>
            </div>
          )}
          <FixturesPanel
            tournamentId={tournamentId}
            tournamentStart={tournamentStart}
            tournamentEnd={tournamentEnd}
            tournamentFormat="knockout"
            tournamentStatus={tournamentStatus}
            isAdmin={isAdmin}
            teams={teams}
            matches={knockoutMatches}
            canEdit={canEdit}
            canAssignGroups={false}
            numGroups={numGroupsForPanel}
            advancePerGroup={advancePerGroupForPanel}
            knockoutQualifiers={knockoutQualifiers}
            knockoutSlots={knockoutSlots}
          />
        </div>
      )}
    </div>
  )
}
