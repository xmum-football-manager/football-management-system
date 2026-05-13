'use client'

import { Field, inputClass } from './WizardField'
import type { WizardFormValue, WizardErrors } from '@/lib/wizard-validation'

interface Props {
  value: WizardFormValue
  onChange: (patch: Partial<WizardFormValue>) => void
  errors: WizardErrors
}

export function Step3MatchRules({ value, onChange, errors }: Props) {
  return (
    <>
      <Field label="Halftime break *" error={undefined}>
        <div className="flex gap-6 mt-1">
          {([true, false] as const).map(yes => (
            <label key={String(yes)} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="halftime_enabled"
                checked={value.halftime_enabled === yes}
                onChange={() => onChange({ halftime_enabled: yes, halftime_minutes: yes ? 15 : '' })}
                className="accent-green-600"
              />
              <span className="text-sm text-slate-700">{yes ? 'Yes' : 'No'}</span>
            </label>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Time per half (min) *" error={errors.minutes_per_half}>
          <input
            type="number"
            min={1}
            value={value.minutes_per_half}
            onChange={e => onChange({ minutes_per_half: e.target.value === '' ? '' : Number(e.target.value) })}
            className={inputClass}
          />
        </Field>

        {value.halftime_enabled && (
          <Field label="Halftime duration (min) *" error={errors.halftime_minutes}>
            <input
              type="number"
              min={1}
              value={value.halftime_minutes}
              onChange={e => onChange({ halftime_minutes: e.target.value === '' ? '' : Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        )}
      </div>

      <Field label="Extra time duration (min)" error={errors.extra_time_minutes}>
        <input
          type="number"
          min={0}
          value={value.extra_time_minutes}
          onChange={e => onChange({ extra_time_minutes: e.target.value === '' ? '' : Number(e.target.value) })}
          placeholder="0 or blank = no extra time"
          className={inputClass}
        />
      </Field>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value.penalty_shootout_enabled}
          onChange={e => onChange({ penalty_shootout_enabled: e.target.checked })}
          className="accent-green-600 mt-0.5"
        />
        <div>
          <p className="text-sm text-slate-700 font-medium">Penalty shootout as tiebreaker (best of 5)</p>
          <p className="text-xs text-slate-400">Stored as a config flag. Live shootout flow is managed separately.</p>
        </div>
      </label>
    </>
  )
}
