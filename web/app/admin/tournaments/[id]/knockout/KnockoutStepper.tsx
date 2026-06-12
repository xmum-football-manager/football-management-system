'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Lock, RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { QualifiersStep } from './QualifiersStep'
import { BracketSetupView } from './BracketSetupView'
import { AdminBracketView } from '@/components/admin/AdminBracketView'
import { RescheduleDialog } from '@/components/admin/MatchViews'
import { resetKnockoutAction } from '../fixtures/actions'
import type { MatchWithTeams } from '@/lib/supabase/types'
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
  isAdmin: boolean
  canEdit: boolean
  tournamentStart: string
  tournamentEnd: string
}

export function KnockoutStepper({
  tournamentId,
  standings,
  savedQualifiers,
  advancePerGroup,
  numGroups,
  knockoutMatches,
  teams,
  isAdmin,
  canEdit,
  tournamentStart,
  tournamentEnd,
}: Props) {
  const router = useRouter()
  const [isResetting, startReset] = useTransition()
  const [reschedule, setReschedule] = useState<MatchWithTeams | null>(null)
  const qualifiersDone = (savedQualifiers?.length ?? 0) > 0
  const bracketExists = knockoutMatches.length > 0

  const initialStep: Step = qualifiersDone ? 'bracket' : 'qualifiers'
  const [activeStep, setActiveStep] = useState<Step>(initialStep)

  const steps: Array<{ id: Step; label: string; status: StepStatus; lockReason?: string }> = [
    {
      id: 'qualifiers',
      label: 'Qualifiers',
      status: qualifiersDone ? 'done' : 'current',
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

  const qualifiedTeams = teams.filter((t) => savedQualifiers?.includes(t.id) ?? false)

  function handleReset() {
    if (!confirm('Delete all knockout matches and start the bracket over?')) return
    startReset(async () => {
      const r = await resetKnockoutAction(tournamentId)
      if ('error' in r) {
        toast.error(r.error)
      } else {
        toast.success(`Bracket reset — ${r.deleted} match${r.deleted === 1 ? '' : 'es'} removed.`)
        router.refresh()
      }
    })
  }

  // Once bracket is created, collapse the setup and show the bracket view directly
  if (bracketExists) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <Check className="h-3 w-3 text-emerald-500" />
            <span>Qualifiers set</span>
            <span style={{ opacity: 0.35 }}>──</span>
            <Check className="h-3 w-3 text-emerald-500" />
            <span>Bracket scheduled</span>
          </div>
          {canEdit && (
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors hover:bg-red-100"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {isResetting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Reset bracket
            </button>
          )}
        </div>
        <AdminBracketView
          matches={knockoutMatches}
          bracketTeamCount={qualifiedTeams.length}
          onMatchClick={canEdit ? setReschedule : undefined}
        />
        {reschedule && (
          <RescheduleDialog
            match={reschedule}
            initialTime={reschedule.match_time ?? ''}
            tournamentId={tournamentId}
            tournamentStart={tournamentStart}
            tournamentEnd={tournamentEnd}
            onClose={() => setReschedule(null)}
          />
        )}
      </div>
    )
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
          isAdmin={isAdmin}
          bracketExists={bracketExists}
          onSaved={() => {
            router.refresh()
            setActiveStep('bracket')
          }}
        />
      )}

      {activeStep === 'bracket' && canEdit && (
        <BracketSetupView
          tournamentId={tournamentId}
          qualifiedTeams={qualifiedTeams}
          tournamentStart={tournamentStart}
          tournamentEnd={tournamentEnd}
          onCreated={() => router.refresh()}
        />
      )}
    </div>
  )
}
