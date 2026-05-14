'use client'

import { Field, inputClass } from './WizardField'
import type { WizardFormValue, WizardErrors } from '@/lib/wizard-validation'

interface Props {
  value: WizardFormValue
  onChange: (patch: Partial<WizardFormValue>) => void
  errors: WizardErrors
}

export function Step1BasicInfo({ value, onChange, errors }: Props) {
  return (
    <>
      <Field label="Tournament Name *" error={errors.name}>
        <input
          type="text"
          value={value.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Spring Cup 2026"
          className={inputClass}
        />
      </Field>

      <Field label="Description" error={errors.description}>
        <textarea
          value={value.description}
          onChange={e => onChange({ description: e.target.value })}
          rows={3}
          placeholder="Optional description"
          className={inputClass}
        />
      </Field>

      <Field label="Location" error={errors.location}>
        <input
          type="text"
          value={value.location}
          onChange={e => onChange({ location: e.target.value })}
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date *" error={errors.start_date}>
          <input
            type="date"
            value={value.start_date}
            onChange={e => onChange({ start_date: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="End Date *" error={errors.end_date}>
          <input
            type="date"
            value={value.end_date}
            onChange={e => onChange({ end_date: e.target.value })}
            min={value.start_date || undefined}
            className={inputClass}
          />
        </Field>
      </div>
    </>
  )
}
