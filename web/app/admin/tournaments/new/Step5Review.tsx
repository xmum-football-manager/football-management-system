'use client'

import type { WizardFormValue } from '@/lib/wizard-validation'

const FORMAT_LABELS: Record<string, string> = {
  round_robin: 'Round Robin',
  round_robin_knockout: 'Round Robin + Knockout',
  knockout: 'Knockout Only',
}

const KNOCKOUT_ROUND_LABELS: Record<string, string> = {
  top_32: 'Top 32', top_16: 'Top 16', top_8: 'Top 8', semi: 'Semi-finals', final: 'Final',
}

const SEEDING_LABELS: Record<string, string> = {
  by_standings: 'By standings', manual: 'Manual', random: 'Random',
}

interface Props {
  value: WizardFormValue
  onEdit: (step: number) => void
}

function Section({ title, step, onEdit, children }: { title: string; step: number; onEdit: (s: number) => void; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <button
          type="button"
          onClick={() => onEdit(step)}
          className="text-xs text-green-600 hover:text-green-500 font-medium"
        >
          [Edit]
        </button>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium text-right">{value}</span>
    </div>
  )
}

export function Step5Review({ value, onEdit }: Props) {
  const hasRR = value.format === 'round_robin' || value.format === 'round_robin_knockout'
  const hasKO = value.format === 'knockout' || value.format === 'round_robin_knockout'
  const isHybrid = value.format === 'round_robin_knockout'

  return (
    <div className="space-y-4">
      <Section title="Basic Info" step={1} onEdit={onEdit}>
        <Row label="Name" value={value.name} />
        {value.description && <Row label="Description" value={value.description} />}
        <Row label="Location" value={value.location || '—'} />
        <Row label="Dates" value={`${value.start_date} → ${value.end_date}`} />
      </Section>

      <Section title="Format" step={2} onEdit={onEdit}>
        <Row label="Format" value={FORMAT_LABELS[value.format]} />
        {hasRR && <Row label="Groups" value={String(value.num_groups)} />}
        {hasRR && <Row label="Teams per group" value={String(value.teams_per_group)} />}
        {isHybrid && <Row label="Advance per group" value={String(value.advance_per_group)} />}
        {hasKO && <Row label="Knockout from" value={KNOCKOUT_ROUND_LABELS[value.knockout_start_round as string] ?? '—'} />}
        {hasKO && <Row label="Seeding" value={SEEDING_LABELS[value.seeding_method as string] ?? '—'} />}
      </Section>

      <Section title="Match Rules" step={3} onEdit={onEdit}>
        <Row label="Halftime break" value={value.halftime_enabled ? 'Yes' : 'No'} />
        <Row
          label="Duration"
          value={value.halftime_enabled
            ? `${value.minutes_per_half} min halves · ${value.halftime_minutes} min break`
            : `${value.minutes_per_half} min halves`}
        />
        {value.extra_time_minutes !== '' && Number(value.extra_time_minutes) > 0 && (
          <Row label="Extra time" value={`${value.extra_time_minutes} min`} />
        )}
        <Row label="Penalty shootout" value={value.penalty_shootout_enabled ? 'Enabled' : 'Disabled'} />
      </Section>

      <Section title="Points & Scoring" step={4} onEdit={onEdit}>
        <Row label="Points" value={`Win ${value.points_win} · Draw ${value.points_draw} · Loss ${value.points_loss}`} />
        <Row label="Player attribution" value={value.require_goal_player ? 'Required' : 'Optional'} />
      </Section>
    </div>
  )
}
