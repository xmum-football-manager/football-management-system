'use client'

import { useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { RDGroupsPanel } from '../rd-groups/RDGroupsPanel'
import { FixturesPanel } from '../fixtures/FixturesPanel'
import { FixtureSchedulerPanel } from '../rd-fixtures/FixtureSchedulerPanel'
import { GenerateGroupFixturesButton } from '../rd-fixtures/GenerateGroupFixturesButton'
import type { MatchWithTeams, TournamentStatus } from '@/lib/supabase/types'

type Step = 'draw' | 'fixtures'

interface Props {
  tournamentId: string
  // Draw step
  teams: Array<{
    id: string
    name: string
    group_label: string | null
    players: Array<{ id: string; name: string; jersey_number: number | null }>
  }>
  numGroups: number
  teamsPerGroup: number | null
  canManageGroups: boolean
  // Fixtures step
  matches: MatchWithTeams[]
  startDate: string
  endDate: string
  minutesPerHalf: number
  halftimeEnabled: boolean
  halftimeMinutes: number | null
  tournamentStatus: TournamentStatus
  numGroupsForPanel: number | null
  advancePerGroup: number | null
  knockoutQualifiers: string[] | null
  isAdmin: boolean
  canEdit: boolean
  canGenerate: boolean
  showScheduler: boolean
  // Step status
  allGroupsAssigned: boolean
  allGroupsFull: boolean
  fixturesExist: boolean
  allFixturesScheduled: boolean
}

type StepStatus = 'done' | 'current' | 'upcoming' | 'locked'

interface StepDef {
  id: Step
  label: string
  status: StepStatus
  lockReason?: string
}

export function GroupsStepper({
  tournamentId,
  teams,
  numGroups,
  teamsPerGroup,
  canManageGroups,
  matches,
  startDate,
  endDate,
  minutesPerHalf,
  halftimeEnabled,
  halftimeMinutes,
  tournamentStatus,
  numGroupsForPanel,
  advancePerGroup,
  knockoutQualifiers,
  isAdmin,
  canEdit,
  canGenerate,
  showScheduler,
  allGroupsAssigned,
  allGroupsFull,
  fixturesExist,
  allFixturesScheduled,
}: Props) {
  const drawDone = allGroupsAssigned && allGroupsFull
  const fixturesDone = fixturesExist && allFixturesScheduled

  const initialStep: Step = drawDone ? 'fixtures' : 'draw'
  const [activeStep, setActiveStep] = useState<Step>(initialStep)

  const steps: StepDef[] = [
    {
      id: 'draw',
      label: 'Draw',
      status: drawDone ? 'done' : 'current',
    },
    {
      id: 'fixtures',
      label: 'Fixtures',
      status: !drawDone
        ? 'locked'
        : fixturesDone
        ? 'done'
        : activeStep === 'fixtures'
        ? 'current'
        : 'upcoming',
      lockReason: !drawDone ? 'Assign all teams to groups first.' : undefined,
    },
  ]

  function canNavigateTo(step: StepDef) {
    return step.status !== 'locked'
  }

  const simplifiedTeams = teams.map((t) => ({
    id: t.id,
    name: t.name,
    group_label: t.group_label,
  }))

  return (
    <div className="space-y-4">
      {/* Sub-stepper header */}
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-1">
            <button
              onClick={() => canNavigateTo(step) && setActiveStep(step.id)}
              disabled={!canNavigateTo(step)}
              className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                color:
                  step.status === 'locked'
                    ? 'var(--muted-foreground)'
                    : activeStep === step.id
                    ? 'var(--admin-lime)'
                    : step.status === 'done'
                    ? 'var(--muted-foreground)'
                    : 'var(--muted-foreground)',
                background:
                  activeStep === step.id
                    ? 'color-mix(in srgb, var(--admin-lime) 10%, transparent)'
                    : 'transparent',
                opacity: step.status === 'locked' ? 0.5 : 1,
                cursor: canNavigateTo(step) ? 'pointer' : 'not-allowed',
              }}
              title={step.lockReason}
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
        ))}
      </div>

      {/* Step content */}
      {activeStep === 'draw' && (
        <RDGroupsPanel
          tournamentId={tournamentId}
          initialTeams={teams.map((t) => ({
            id: t.id,
            name: t.name,
            group_label: t.group_label,
          }))}
          numGroups={numGroups}
          teamsPerGroup={teamsPerGroup}
          canEdit={canManageGroups}
        />
      )}

      {activeStep === 'fixtures' && (
        <div className="space-y-5">
          {canGenerate && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                All groups are ready. Generate the round-robin fixtures for each group.
              </p>
              <GenerateGroupFixturesButton tournamentId={tournamentId} />
            </div>
          )}
          {showScheduler && (
            <FixtureSchedulerPanel
              tournamentId={tournamentId}
              initialMatches={matches}
              startDate={startDate}
              endDate={endDate}
              minutesPerHalf={minutesPerHalf}
              halftimeEnabled={halftimeEnabled}
              halftimeMinutes={halftimeMinutes}
            />
          )}
          <FixturesPanel
            tournamentId={tournamentId}
            tournamentStart={startDate}
            tournamentEnd={endDate}
            tournamentFormat="round_robin"
            tournamentStatus={tournamentStatus}
            isAdmin={isAdmin}
            teams={simplifiedTeams}
            matches={matches}
            canEdit={canEdit}
            canAssignGroups={false}
            numGroups={numGroupsForPanel}
            advancePerGroup={advancePerGroup}
            knockoutQualifiers={knockoutQualifiers}
            knockoutSlots={0}
            hideTabs
          />
        </div>
      )}
    </div>
  )
}
