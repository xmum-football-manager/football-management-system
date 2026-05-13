'use client'

import { Field, inputClass } from './WizardField'
import type { WizardFormValue, WizardErrors } from '@/lib/wizard-validation'

interface Props {
  value: WizardFormValue
  onChange: (patch: Partial<WizardFormValue>) => void
  errors: WizardErrors
}

export function Step4PointsScoring({ value, onChange, errors }: Props) {
  const hasPointsError = errors.points_win || errors.points_draw || errors.points_loss

  return (
    <>
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">Points System *</p>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Win" error={errors.points_win}>
            <input
              type="number"
              step="0.5"
              value={value.points_win}
              onChange={e => onChange({ points_win: e.target.value === '' ? '' : Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label="Draw" error={errors.points_draw}>
            <input
              type="number"
              step="0.5"
              value={value.points_draw}
              onChange={e => onChange({ points_draw: e.target.value === '' ? '' : Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
          <Field label="Loss" error={errors.points_loss}>
            <input
              type="number"
              step="0.5"
              value={value.points_loss}
              onChange={e => onChange({ points_loss: e.target.value === '' ? '' : Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
        {!hasPointsError && (
          <p className="text-xs text-slate-400 mt-2">Must satisfy: Win &gt; Draw &gt; Loss</p>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value.require_goal_player}
          onChange={e => onChange({ require_goal_player: e.target.checked })}
          className="accent-green-600 mt-0.5"
        />
        <div>
          <p className="text-sm text-slate-700 font-medium">Require player attribution for goals</p>
          <p className="text-xs text-slate-400">When checked, scorekeepers must select a player for every goal.</p>
        </div>
      </label>
    </>
  )
}
