'use client'

import { Field, inputClass } from './WizardField'
import type { WizardFormValue, WizardErrors, KnockoutStartRound, SeedingMethod } from '@/lib/wizard-validation'

const FORMAT_OPTIONS = [
  { value: 'round_robin', label: 'Round Robin (League)' },
  { value: 'round_robin_knockout', label: 'Round Robin + Knockout' },
  { value: 'knockout', label: 'Knockout Only' },
] as const

const KNOCKOUT_ROUND_OPTIONS: { value: KnockoutStartRound; label: string }[] = [
  { value: 'top_32', label: 'Top 32' },
  { value: 'top_16', label: 'Top 16' },
  { value: 'top_8', label: 'Top 8' },
  { value: 'semi', label: 'Semi-finals' },
  { value: 'final', label: 'Final' },
]

const SEEDING_OPTIONS: { value: SeedingMethod; label: string; description: string }[] = [
  { value: 'by_standings', label: 'By standings', description: 'Seed by points, then goal difference' },
  { value: 'manual', label: 'Manual', description: 'Assign seeds on the bracket page later' },
  { value: 'random', label: 'Random', description: 'Shuffle qualified teams randomly' },
]

interface Props {
  value: WizardFormValue
  onChange: (patch: Partial<WizardFormValue>) => void
  errors: WizardErrors
}

export function Step2Format({ value, onChange, errors }: Props) {
  const hasRR = value.format === 'round_robin' || value.format === 'round_robin_knockout'
  const hasKO = value.format === 'knockout' || value.format === 'round_robin_knockout'
  const isHybrid = value.format === 'round_robin_knockout'

  function handleFormatChange(fmt: string) {
    onChange({
      format: fmt as WizardFormValue['format'],
      num_groups: '',
      teams_per_group: '',
      advance_per_group: '',
      knockout_start_round: '',
      seeding_method: '',
    })
  }

  return (
    <>
      <Field label="Format *" error={errors.format}>
        <div className="space-y-2 mt-1">
          {FORMAT_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="format"
                value={opt.value}
                checked={value.format === opt.value}
                onChange={() => handleFormatChange(opt.value)}
                className="accent-green-600"
              />
              <span className="text-sm text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </Field>

      {hasRR && (
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group Stage</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Number of groups *" error={errors.num_groups}>
              <input
                type="number"
                min={1}
                value={value.num_groups}
                onChange={e => onChange({ num_groups: e.target.value === '' ? '' : Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Teams per group *" error={errors.teams_per_group}>
              <input
                type="number"
                min={2}
                value={value.teams_per_group}
                onChange={e => onChange({ teams_per_group: e.target.value === '' ? '' : Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
          </div>
          {isHybrid && (
            <Field label="Teams advancing per group *" error={errors.advance_per_group}>
              <input
                type="number"
                min={1}
                value={value.advance_per_group}
                onChange={e => onChange({ advance_per_group: e.target.value === '' ? '' : Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
          )}
        </div>
      )}

      {hasKO && (
        <div className="border-t border-slate-100 pt-4 space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Knockout Stage</p>
          <Field label="Knockout starts at *" error={errors.knockout_start_round}>
            <select
              value={value.knockout_start_round}
              onChange={e => onChange({ knockout_start_round: e.target.value as KnockoutStartRound | '' })}
              className={inputClass}
            >
              <option value="">Select round…</option>
              {KNOCKOUT_ROUND_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Seeding method *" error={errors.seeding_method}>
            <div className="space-y-2 mt-1">
              {SEEDING_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="seeding_method"
                    value={opt.value}
                    checked={value.seeding_method === opt.value}
                    onChange={() => onChange({ seeding_method: opt.value })}
                    className="accent-green-600 mt-0.5"
                  />
                  <div>
                    <p className="text-sm text-slate-700 font-medium">{opt.label}</p>
                    <p className="text-xs text-slate-400">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </Field>
        </div>
      )}
    </>
  )
}
