'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Lock, RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { QualifiersStep } from './QualifiersStep'
import { BracketSetupView } from './BracketSetupView'
import { AdminBracketView } from '@/components/admin/AdminBracketView'
import { RescheduleDialog } from '@/components/admin/MatchViews'
import { resetKnockoutAction, updateFirstRoundPairingAction } from '../fixtures/actions'
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
  const [editPairing, setEditPairing] = useState<MatchWithTeams | null>(null)
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
          onMatchClick={canEdit ? (m) => {
            const isFirstRound = m.home_source_match_id === null && m.away_source_match_id === null
            if (isFirstRound) setEditPairing(m)
            else setReschedule(m)
          } : undefined}
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
        {editPairing && (
          <EditPairingDialog
            match={editPairing}
            qualifiedTeams={qualifiedTeams}
            tournamentId={tournamentId}
            onClose={() => setEditPairing(null)}
            onSaved={() => { setEditPairing(null); router.refresh() }}
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

interface EditPairingDialogProps {
  match: MatchWithTeams
  qualifiedTeams: Array<{ id: string; name: string; group_label: string | null }>
  tournamentId: string
  onClose: () => void
  onSaved: () => void
}

function EditPairingDialog({ match, qualifiedTeams, tournamentId, onClose, onSaved }: EditPairingDialogProps) {
  const [homeId, setHomeId] = useState(match.home_team_id ?? '')
  const [awayId, setAwayId] = useState(match.away_team_id ?? '')
  const [isPending, startTransition] = useTransition()

  const selectStyle = {
    border: '1px solid var(--admin-rule)',
    background: 'var(--admin-surface-2)',
    color: 'var(--foreground)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 13,
    width: '100%',
  }

  function handleSave() {
    startTransition(async () => {
      const r = await updateFirstRoundPairingAction(tournamentId, match.id, homeId, awayId)
      if ('error' in r) toast.error(r.error)
      else { toast.success('Pairing updated.'); onSaved() }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-xl p-6 space-y-4"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--admin-rule)',
          minWidth: 320,
        }}
      >
        <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          Edit First-Round Pairing
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>
              Home team
            </label>
            <select value={homeId} onChange={(e) => setHomeId(e.target.value)} style={selectStyle}>
              <option value="">Select…</option>
              {qualifiedTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted-foreground)' }}>
              Away team
            </label>
            <select value={awayId} onChange={(e) => setAwayId(e.target.value)} style={selectStyle}>
              <option value="">Select…</option>
              {qualifiedTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs"
            style={{ color: 'var(--muted-foreground)', border: '1px solid var(--admin-rule)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!homeId || !awayId || isPending}
            className="rounded px-3 py-1.5 text-xs font-medium"
            style={{
              background: 'var(--admin-lime)',
              color: 'black',
              opacity: (!homeId || !awayId || isPending) ? 0.5 : 1,
            }}
          >
            {isPending && <Loader2 className="inline mr-1 h-3 w-3 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
