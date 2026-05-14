# Tournament Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-form `/admin/tournaments/new` page with a 5-step wizard that captures match rules, format-conditional fields, and player attribution settings, and persist them via 11 new columns on the `tournaments` table.

**Architecture:** Wizard state is held in a `'use client'` `TournamentWizard` orchestrator component; each step is an isolated component receiving `{ value, onChange, errors }`. Validation runs per-step in a shared `lib/wizard-validation.ts` lib (unit-tested). A Next.js server action (`actions.ts`) performs the final validated INSERT. The edit page is extended to show the new fields pre-lock and read-only post-lock using the existing `canEditFormat` lock predicate.

**Tech Stack:** Next.js App Router, Supabase (Postgres + client SDK), Tailwind CSS, shadcn/ui (admin surface), Vitest (unit tests), pnpm

---

## File Map

| Path | Action | Responsibility |
|------|--------|---------------|
| `web/supabase/migrations/20260513000000_tournament_wizard_columns.sql` | **Create** | Additive migration: 11 new columns + check constraints + backfill |
| `web/lib/supabase/types.ts` | **Modify** | Extend `Tournament` interface with new columns; add `KnockoutStartRound`, `SeedingMethod` types |
| `web/lib/wizard-validation.ts` | **Create** | `WizardFormValue`, `WizardErrors`, `DEFAULT_WIZARD_FORM`, `validateStep()` |
| `web/__tests__/wizard-validation.test.ts` | **Create** | Unit tests for all validators |
| `web/app/admin/tournaments/new/actions.ts` | **Create** | `createTournament` server action — validates + inserts |
| `web/app/admin/tournaments/new/WizardField.tsx` | **Create** | Shared `Field` wrapper + `inputClass` used by all step components |
| `web/app/admin/tournaments/new/WizardStepShell.tsx` | **Create** | Progress indicator + Back/Next chrome |
| `web/app/admin/tournaments/new/Step1BasicInfo.tsx` | **Create** | Name, description, location, dates |
| `web/app/admin/tournaments/new/Step2Format.tsx` | **Create** | Format radio + conditional RR/KO fields |
| `web/app/admin/tournaments/new/Step3MatchRules.tsx` | **Create** | Halftime toggle, durations, penalty flag |
| `web/app/admin/tournaments/new/Step4PointsScoring.tsx` | **Create** | Win/draw/loss inputs + require_goal_player |
| `web/app/admin/tournaments/new/Step5Review.tsx` | **Create** | Read-only summary with Edit jump links |
| `web/app/admin/tournaments/new/TournamentWizard.tsx` | **Create** | Orchestrates step state, calls server action |
| `web/app/admin/tournaments/new/page.tsx` | **Modify** | Replaced: render `<TournamentWizard />` only |
| `web/app/admin/tournaments/[id]/edit/page.tsx` | **Modify** | Add wizard fields (editable pre-lock, read-only post-lock) |

---

## Task 1: DB Migration

**Files:**
- Create: `web/supabase/migrations/20260513000000_tournament_wizard_columns.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Add tournament wizard configuration columns
alter table tournaments
  add column if not exists halftime_enabled       boolean not null default true,
  add column if not exists minutes_per_half       integer,
  add column if not exists halftime_minutes       integer,
  add column if not exists extra_time_minutes     integer,
  add column if not exists penalty_shootout_enabled boolean not null default false,
  add column if not exists require_goal_player    boolean not null default false,
  add column if not exists num_groups             integer,
  add column if not exists teams_per_group        integer,
  add column if not exists advance_per_group      integer,
  add column if not exists knockout_start_round   text,
  add column if not exists seeding_method         text;

alter table tournaments
  add constraint tournaments_knockout_start_round_check
    check (knockout_start_round is null or
           knockout_start_round in ('top_32','top_16','top_8','semi','final')),
  add constraint tournaments_seeding_method_check
    check (seeding_method is null or
           seeding_method in ('by_standings','manual','random'));

-- Backfill existing rows so minutes_per_half can be NOT NULL
update tournaments
  set minutes_per_half = 45,
      halftime_minutes = 15
  where minutes_per_half is null;

alter table tournaments
  alter column minutes_per_half set not null;
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
cd web && pnpm supabase db push
```

Expected: `Applied 1 migration.`
If Supabase is not running locally: `pnpm supabase start` first, then re-run.

- [ ] **Step 3: Verify columns exist**

```bash
cd web && pnpm supabase db diff --linked | head -5
```

Expected: no diff (schema matches migration).

- [ ] **Step 4: Commit**

```bash
git add web/supabase/migrations/20260513000000_tournament_wizard_columns.sql
git commit -m "feat: add tournament wizard columns to tournaments table"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `web/lib/supabase/types.ts`

- [ ] **Step 1: Add new type aliases and extend the Tournament interface**

In `web/lib/supabase/types.ts`, add after the existing type aliases at the top:

```ts
export type KnockoutStartRound = 'top_32' | 'top_16' | 'top_8' | 'semi' | 'final'
export type SeedingMethod = 'by_standings' | 'manual' | 'random'
```

Then extend the `Tournament` interface with these fields after `first_match_scheduled_at`:

```ts
  halftime_enabled: boolean
  minutes_per_half: number
  halftime_minutes: number | null
  extra_time_minutes: number | null
  penalty_shootout_enabled: boolean
  require_goal_player: boolean
  num_groups: number | null
  teams_per_group: number | null
  advance_per_group: number | null
  knockout_start_round: KnockoutStartRound | null
  seeding_method: SeedingMethod | null
```

Full updated `Tournament` interface:

```ts
export interface Tournament {
  id: string
  name: string
  description: string | null
  location: string | null
  start_date: string
  end_date: string
  format: TournamentFormat
  points_win: number
  points_draw: number
  points_loss: number
  status: TournamentStatus
  first_match_scheduled_at: string | null
  halftime_enabled: boolean
  minutes_per_half: number
  halftime_minutes: number | null
  extra_time_minutes: number | null
  penalty_shootout_enabled: boolean
  require_goal_player: boolean
  num_groups: number | null
  teams_per_group: number | null
  advance_per_group: number | null
  knockout_start_round: KnockoutStartRound | null
  seeding_method: SeedingMethod | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no output (no errors). If there are errors in existing files that reference `Tournament`, they are pre-existing — do not fix them in this task.

- [ ] **Step 3: Commit**

```bash
git add web/lib/supabase/types.ts
git commit -m "feat: extend Tournament type with wizard configuration fields"
```

---

## Task 3: Wizard Validation Library + Tests

**Files:**
- Create: `web/lib/wizard-validation.ts`
- Create: `web/__tests__/wizard-validation.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `web/__tests__/wizard-validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateStep, DEFAULT_WIZARD_FORM, type WizardFormValue } from '@/lib/wizard-validation'

const base: WizardFormValue = {
  ...DEFAULT_WIZARD_FORM,
  name: 'Spring Cup',
  start_date: '2026-06-01',
  end_date: '2026-06-15',
  num_groups: 2,
  teams_per_group: 4,
  advance_per_group: 2,
  knockout_start_round: 'top_8',
  seeding_method: 'by_standings',
  minutes_per_half: 45,
  halftime_minutes: 15,
  points_win: 1,
  points_draw: 0.5,
  points_loss: 0,
}

describe('validateStep 1 — Basic Info', () => {
  it('passes with valid data', () => {
    expect(validateStep(1, base)).toEqual({})
  })
  it('requires name', () => {
    expect(validateStep(1, { ...base, name: '' })).toHaveProperty('name')
  })
  it('requires start_date', () => {
    expect(validateStep(1, { ...base, start_date: '' })).toHaveProperty('start_date')
  })
  it('requires end_date', () => {
    expect(validateStep(1, { ...base, end_date: '' })).toHaveProperty('end_date')
  })
  it('rejects end_date before start_date', () => {
    expect(validateStep(1, { ...base, end_date: '2026-05-01' })).toHaveProperty('end_date')
  })
  it('allows end_date equal to start_date', () => {
    expect(validateStep(1, { ...base, end_date: '2026-06-01' })).toEqual({})
  })
})

describe('validateStep 2 — Format (round_robin)', () => {
  it('passes with valid round_robin data', () => {
    expect(validateStep(2, { ...base, format: 'round_robin' })).toEqual({})
  })
  it('requires num_groups for round_robin', () => {
    expect(validateStep(2, { ...base, format: 'round_robin', num_groups: '' })).toHaveProperty('num_groups')
  })
  it('requires teams_per_group >= 2', () => {
    expect(validateStep(2, { ...base, format: 'round_robin', teams_per_group: 1 })).toHaveProperty('teams_per_group')
  })
  it('does not require advance_per_group for round_robin-only', () => {
    expect(validateStep(2, { ...base, format: 'round_robin', advance_per_group: '' })).toEqual({})
  })
})

describe('validateStep 2 — Format (round_robin_knockout)', () => {
  it('passes with valid hybrid data', () => {
    expect(validateStep(2, { ...base, format: 'round_robin_knockout' })).toEqual({})
  })
  it('requires advance_per_group for hybrid', () => {
    expect(validateStep(2, { ...base, format: 'round_robin_knockout', advance_per_group: '' })).toHaveProperty('advance_per_group')
  })
  it('requires knockout_start_round for hybrid', () => {
    expect(validateStep(2, { ...base, format: 'round_robin_knockout', knockout_start_round: '' })).toHaveProperty('knockout_start_round')
  })
  it('requires seeding_method for hybrid', () => {
    expect(validateStep(2, { ...base, format: 'round_robin_knockout', seeding_method: '' })).toHaveProperty('seeding_method')
  })
})

describe('validateStep 2 — Format (knockout)', () => {
  it('passes with valid knockout data', () => {
    expect(validateStep(2, { ...base, format: 'knockout' })).toEqual({})
  })
  it('does not require num_groups for knockout', () => {
    expect(validateStep(2, { ...base, format: 'knockout', num_groups: '' })).toEqual({})
  })
  it('requires knockout_start_round', () => {
    expect(validateStep(2, { ...base, format: 'knockout', knockout_start_round: '' })).toHaveProperty('knockout_start_round')
  })
})

describe('validateStep 3 — Match Rules', () => {
  it('passes with valid data', () => {
    expect(validateStep(3, base)).toEqual({})
  })
  it('requires minutes_per_half', () => {
    expect(validateStep(3, { ...base, minutes_per_half: '' })).toHaveProperty('minutes_per_half')
  })
  it('requires halftime_minutes when halftime_enabled', () => {
    expect(validateStep(3, { ...base, halftime_enabled: true, halftime_minutes: '' })).toHaveProperty('halftime_minutes')
  })
  it('does not require halftime_minutes when halftime disabled', () => {
    expect(validateStep(3, { ...base, halftime_enabled: false, halftime_minutes: '' })).toEqual({})
  })
})

describe('validateStep 4 — Points & Scoring', () => {
  it('passes with default 1/0.5/0', () => {
    expect(validateStep(4, base)).toEqual({})
  })
  it('rejects win equal to draw', () => {
    expect(validateStep(4, { ...base, points_win: 1, points_draw: 1 })).toHaveProperty('points_win')
  })
  it('rejects draw equal to loss', () => {
    expect(validateStep(4, { ...base, points_draw: 0, points_loss: 0 })).toHaveProperty('points_draw')
  })
  it('rejects win less than draw', () => {
    expect(validateStep(4, { ...base, points_win: 0, points_draw: 1 })).toHaveProperty('points_win')
  })
  it('requires win points', () => {
    expect(validateStep(4, { ...base, points_win: '' })).toHaveProperty('points_win')
  })
})
```

- [ ] **Step 2: Run tests to see them fail**

```bash
cd web && pnpm test -- wizard-validation
```

Expected: `FAIL __tests__/wizard-validation.test.ts` — module not found.

- [ ] **Step 3: Create the validation library**

Create `web/lib/wizard-validation.ts`:

```ts
import type { TournamentFormat } from '@/lib/supabase/types'

export type KnockoutStartRound = 'top_32' | 'top_16' | 'top_8' | 'semi' | 'final'
export type SeedingMethod = 'by_standings' | 'manual' | 'random'

export interface WizardFormValue {
  // Step 1
  name: string
  description: string
  location: string
  start_date: string
  end_date: string
  // Step 2
  format: TournamentFormat
  num_groups: number | ''
  teams_per_group: number | ''
  advance_per_group: number | ''
  knockout_start_round: KnockoutStartRound | ''
  seeding_method: SeedingMethod | ''
  // Step 3
  halftime_enabled: boolean
  minutes_per_half: number | ''
  halftime_minutes: number | ''
  extra_time_minutes: number | ''
  penalty_shootout_enabled: boolean
  // Step 4
  points_win: number | ''
  points_draw: number | ''
  points_loss: number | ''
  require_goal_player: boolean
}

export type WizardErrors = Partial<Record<keyof WizardFormValue, string>>

export const DEFAULT_WIZARD_FORM: WizardFormValue = {
  name: '',
  description: '',
  location: 'Xiamen University Malaysia, Football Field',
  start_date: '',
  end_date: '',
  format: 'round_robin',
  num_groups: '',
  teams_per_group: '',
  advance_per_group: '',
  knockout_start_round: '',
  seeding_method: '',
  halftime_enabled: true,
  minutes_per_half: 45,
  halftime_minutes: 15,
  extra_time_minutes: '',
  penalty_shootout_enabled: false,
  points_win: 1,
  points_draw: 0.5,
  points_loss: 0,
  require_goal_player: false,
}

export function validateStep(step: number, v: WizardFormValue): WizardErrors {
  if (step === 1) return validateStep1(v)
  if (step === 2) return validateStep2(v)
  if (step === 3) return validateStep3(v)
  if (step === 4) return validateStep4(v)
  return {}
}

function validateStep1(v: WizardFormValue): WizardErrors {
  const e: WizardErrors = {}
  if (!v.name.trim()) e.name = 'Tournament name is required'
  if (!v.start_date) e.start_date = 'Start date is required'
  if (!v.end_date) e.end_date = 'End date is required'
  if (v.start_date && v.end_date && v.end_date < v.start_date) e.end_date = 'End date must be on or after start date'
  return e
}

function validateStep2(v: WizardFormValue): WizardErrors {
  const e: WizardErrors = {}
  const hasRR = v.format === 'round_robin' || v.format === 'round_robin_knockout'
  const hasKO = v.format === 'knockout' || v.format === 'round_robin_knockout'
  const isHybrid = v.format === 'round_robin_knockout'
  if (hasRR) {
    if (v.num_groups === '' || Number(v.num_groups) < 1) e.num_groups = 'At least 1 group required'
    if (v.teams_per_group === '' || Number(v.teams_per_group) < 2) e.teams_per_group = 'At least 2 teams per group required'
    if (isHybrid && (v.advance_per_group === '' || Number(v.advance_per_group) < 1)) e.advance_per_group = 'At least 1 advancing team per group required'
  }
  if (hasKO) {
    if (!v.knockout_start_round) e.knockout_start_round = 'Select a knockout starting round'
    if (!v.seeding_method) e.seeding_method = 'Select a seeding method'
  }
  return e
}

function validateStep3(v: WizardFormValue): WizardErrors {
  const e: WizardErrors = {}
  if (v.minutes_per_half === '' || Number(v.minutes_per_half) < 1) e.minutes_per_half = 'Minutes per half is required'
  if (v.halftime_enabled && (v.halftime_minutes === '' || Number(v.halftime_minutes) < 1)) e.halftime_minutes = 'Halftime duration is required'
  return e
}

function validateStep4(v: WizardFormValue): WizardErrors {
  const e: WizardErrors = {}
  if (v.points_win === '') { e.points_win = 'Win points required'; return e }
  if (v.points_draw === '') { e.points_draw = 'Draw points required'; return e }
  if (v.points_loss === '') { e.points_loss = 'Loss points required'; return e }
  if (Number(v.points_win) <= Number(v.points_draw)) e.points_win = 'Win must be greater than draw'
  if (Number(v.points_draw) <= Number(v.points_loss)) e.points_draw = 'Draw must be greater than loss'
  return e
}
```

- [ ] **Step 4: Run tests to see them pass**

```bash
cd web && pnpm test -- wizard-validation
```

Expected: all tests pass. `30 passed`.

- [ ] **Step 5: Commit**

```bash
git add web/lib/wizard-validation.ts web/__tests__/wizard-validation.test.ts
git commit -m "feat: wizard validation library with unit tests"
```

---

## Task 4: createTournament Server Action

**Files:**
- Create: `web/app/admin/tournaments/new/actions.ts`

- [ ] **Step 1: Create the server action**

Create `web/app/admin/tournaments/new/actions.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { validateStep, type WizardFormValue } from '@/lib/wizard-validation'
import type { WizardErrors } from '@/lib/wizard-validation'

export type CreateTournamentResult =
  | { id: string; serverError: null; errors: null; failedStep: null }
  | { id: null; serverError: string | null; errors: WizardErrors | null; failedStep: number | null }

export async function createTournament(value: WizardFormValue): Promise<CreateTournamentResult> {
  for (let step = 1; step <= 4; step++) {
    const errors = validateStep(step, value)
    if (Object.keys(errors).length > 0) {
      return { id: null, serverError: null, errors, failedStep: step }
    }
  }

  const supabase = await createClient()
  const hasRR = value.format === 'round_robin' || value.format === 'round_robin_knockout'
  const hasKO = value.format === 'knockout' || value.format === 'round_robin_knockout'
  const isHybrid = value.format === 'round_robin_knockout'

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name: value.name.trim(),
      description: value.description.trim() || null,
      location: value.location.trim() || null,
      start_date: value.start_date,
      end_date: value.end_date,
      format: value.format,
      halftime_enabled: value.halftime_enabled,
      minutes_per_half: Number(value.minutes_per_half),
      halftime_minutes: value.halftime_enabled ? Number(value.halftime_minutes) : null,
      extra_time_minutes: value.extra_time_minutes !== '' ? Number(value.extra_time_minutes) : null,
      penalty_shootout_enabled: value.penalty_shootout_enabled,
      points_win: Number(value.points_win),
      points_draw: Number(value.points_draw),
      points_loss: Number(value.points_loss),
      require_goal_player: value.require_goal_player,
      num_groups: hasRR ? Number(value.num_groups) : null,
      teams_per_group: hasRR ? Number(value.teams_per_group) : null,
      advance_per_group: isHybrid ? Number(value.advance_per_group) : null,
      knockout_start_round: hasKO ? value.knockout_start_round || null : null,
      seeding_method: hasKO ? value.seeding_method || null : null,
    })
    .select('id')
    .single()

  if (error) return { id: null, serverError: error.message, errors: null, failedStep: null }
  return { id: data.id, serverError: null, errors: null, failedStep: null }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && pnpm tsc --noEmit 2>&1 | grep "actions.ts"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/new/actions.ts
git commit -m "feat: createTournament server action with full payload validation"
```

---

## Task 5: Shared Wizard UI Primitives

**Files:**
- Create: `web/app/admin/tournaments/new/WizardField.tsx`
- Create: `web/app/admin/tournaments/new/WizardStepShell.tsx`

- [ ] **Step 1: Create WizardField**

Create `web/app/admin/tournaments/new/WizardField.tsx`:

```tsx
export const inputClass =
  'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent'

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create WizardStepShell**

Create `web/app/admin/tournaments/new/WizardStepShell.tsx`:

```tsx
'use client'

const STEP_LABELS = ['Basic Info', 'Format', 'Match Rules', 'Points', 'Review'] as const

interface Props {
  currentStep: number
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  children: React.ReactNode
}

export function WizardStepShell({
  currentStep,
  onBack,
  onNext,
  nextLabel = 'Next →',
  nextDisabled,
  children,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-start justify-between mb-6">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1
          const done = step < currentStep
          const active = step === currentStep
          return (
            <div key={step} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${active ? 'bg-green-600 text-white' : done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}
              >
                {done ? '✓' : step}
              </div>
              <span className={`text-xs text-center ${active ? 'text-green-700 font-medium' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="space-y-5">{children}</div>

      <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg transition-colors"
        >
          {currentStep === 1 ? '← Dashboard' : '← Back'}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/new/WizardField.tsx web/app/admin/tournaments/new/WizardStepShell.tsx
git commit -m "feat: wizard shared UI primitives (Field, WizardStepShell)"
```

---

## Task 6: Step1BasicInfo

**Files:**
- Create: `web/app/admin/tournaments/new/Step1BasicInfo.tsx`

- [ ] **Step 1: Create Step1BasicInfo**

Create `web/app/admin/tournaments/new/Step1BasicInfo.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add web/app/admin/tournaments/new/Step1BasicInfo.tsx
git commit -m "feat: wizard Step1BasicInfo component"
```

---

## Task 7: Step2Format

**Files:**
- Create: `web/app/admin/tournaments/new/Step2Format.tsx`

- [ ] **Step 1: Create Step2Format**

Create `web/app/admin/tournaments/new/Step2Format.tsx`:

```tsx
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
      <Field label="Format *" error={undefined}>
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
            {errors.seeding_method && <p className="text-xs text-red-600 mt-1">{errors.seeding_method}</p>}
          </Field>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/admin/tournaments/new/Step2Format.tsx
git commit -m "feat: wizard Step2Format with conditional RR/knockout fields"
```

---

## Task 8: Step3MatchRules

**Files:**
- Create: `web/app/admin/tournaments/new/Step3MatchRules.tsx`

- [ ] **Step 1: Create Step3MatchRules**

Create `web/app/admin/tournaments/new/Step3MatchRules.tsx`:

```tsx
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
          {[true, false].map(yes => (
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
```

- [ ] **Step 2: Commit**

```bash
git add web/app/admin/tournaments/new/Step3MatchRules.tsx
git commit -m "feat: wizard Step3MatchRules component"
```

---

## Task 9: Step4PointsScoring

**Files:**
- Create: `web/app/admin/tournaments/new/Step4PointsScoring.tsx`

- [ ] **Step 1: Create Step4PointsScoring**

Create `web/app/admin/tournaments/new/Step4PointsScoring.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add web/app/admin/tournaments/new/Step4PointsScoring.tsx
git commit -m "feat: wizard Step4PointsScoring component"
```

---

## Task 10: Step5Review

**Files:**
- Create: `web/app/admin/tournaments/new/Step5Review.tsx`

- [ ] **Step 1: Create Step5Review**

Create `web/app/admin/tournaments/new/Step5Review.tsx`:

```tsx
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
          Edit
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
```

- [ ] **Step 2: Commit**

```bash
git add web/app/admin/tournaments/new/Step5Review.tsx
git commit -m "feat: wizard Step5Review read-only summary component"
```

---

## Task 11: TournamentWizard Orchestrator + Replace page.tsx

**Files:**
- Create: `web/app/admin/tournaments/new/TournamentWizard.tsx`
- Modify: `web/app/admin/tournaments/new/page.tsx`

- [ ] **Step 1: Create TournamentWizard**

Create `web/app/admin/tournaments/new/TournamentWizard.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WizardStepShell } from './WizardStepShell'
import { Step1BasicInfo } from './Step1BasicInfo'
import { Step2Format } from './Step2Format'
import { Step3MatchRules } from './Step3MatchRules'
import { Step4PointsScoring } from './Step4PointsScoring'
import { Step5Review } from './Step5Review'
import { createTournament } from './actions'
import { validateStep, DEFAULT_WIZARD_FORM, type WizardFormValue, type WizardErrors } from '@/lib/wizard-validation'
import { toast } from '@/components/Toast'

export function TournamentWizard() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(1)
  const [value, setValue] = useState<WizardFormValue>(DEFAULT_WIZARD_FORM)
  const [errors, setErrors] = useState<WizardErrors>({})

  function patch(p: Partial<WizardFormValue>) {
    setValue(v => ({ ...v, ...p }))
    setErrors(e => {
      const next = { ...e }
      for (const k of Object.keys(p) as (keyof WizardFormValue)[]) delete next[k]
      return next
    })
  }

  function handleNext() {
    if (step < 5) {
      const errs = validateStep(step, value)
      if (Object.keys(errs).length > 0) { setErrors(errs); return }
      setErrors({})
      setStep(s => s + 1)
    } else {
      // Step 5: submit
      startTransition(async () => {
        const result = await createTournament(value)
        if (result.errors && result.failedStep) {
          setErrors(result.errors)
          setStep(result.failedStep)
          toast.error('Please fix the highlighted fields.')
          return
        }
        if (result.serverError || !result.id) {
          toast.error(result.serverError ?? 'Failed to create tournament')
          return
        }
        router.push(`/admin/tournaments/${result.id}`)
      })
    }
  }

  function handleBack() {
    if (step === 1) { router.push('/admin'); return }
    setErrors({})
    setStep(s => s - 1)
  }

  const stepProps = { value, onChange: patch, errors }

  return (
    <WizardStepShell
      currentStep={step}
      onBack={handleBack}
      onNext={handleNext}
      nextLabel={step === 5 ? (isPending ? 'Creating…' : 'Create Tournament') : 'Next →'}
      nextDisabled={isPending}
    >
      {step === 1 && <Step1BasicInfo {...stepProps} />}
      {step === 2 && <Step2Format {...stepProps} />}
      {step === 3 && <Step3MatchRules {...stepProps} />}
      {step === 4 && <Step4PointsScoring {...stepProps} />}
      {step === 5 && <Step5Review value={value} onEdit={n => { setErrors({}); setStep(n) }} />}
    </WizardStepShell>
  )
}
```

- [ ] **Step 2: Replace page.tsx**

Replace the entire content of `web/app/admin/tournaments/new/page.tsx` with:

```tsx
import Link from 'next/link'
import { TournamentWizard } from './TournamentWizard'

export default function NewTournamentPage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="font-bold text-slate-900">New Tournament</span>
          <div className="w-24" />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <TournamentWizard />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Run the full test suite to check for regressions**

```bash
cd web && pnpm test
```

Expected: all previously-passing tests still pass.

- [ ] **Step 4: Verify TypeScript**

```bash
cd web && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors in the new files.

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/new/TournamentWizard.tsx web/app/admin/tournaments/new/page.tsx
git commit -m "feat: 5-step TournamentWizard replaces single-form new tournament page"
```

---

## Task 12: Edit Page — New Fields + Lock Behavior

**Files:**
- Modify: `web/app/admin/tournaments/[id]/edit/page.tsx`

The edit page already uses `canEditFormat` to gate the existing format + points fields. We extend it to also gate the new wizard fields under the same predicate.

- [ ] **Step 1: Add new form state fields**

In `edit/page.tsx`, update the `form` state object to include wizard fields. Replace the existing `useState` for `form`:

```ts
const [form, setForm] = useState({
  name: '',
  description: '',
  location: '',
  start_date: '',
  end_date: '',
  format: 'round_robin' as TournamentFormat,
  // Points: stored as raw numbers (not preset index) for the edit page
  points_win: 1,
  points_draw: 0.5,
  points_loss: 0,
  // Wizard fields
  halftime_enabled: true,
  minutes_per_half: 45,
  halftime_minutes: 15 as number | '',
  extra_time_minutes: '' as number | '',
  penalty_shootout_enabled: false,
  require_goal_player: false,
  num_groups: '' as number | '',
  teams_per_group: '' as number | '',
  advance_per_group: '' as number | '',
  knockout_start_round: '' as string,
  seeding_method: '' as string,
})
```

Add `TournamentFormat` to the imports at the top:

```ts
import type { Tournament, TournamentFormat } from '@/lib/supabase/types'
```

- [ ] **Step 2: Populate wizard fields when loading the tournament**

In the `load()` function inside `useEffect`, after `setForm({...})`, populate the wizard fields from `t`:

```ts
setForm({
  name: t.name,
  description: t.description ?? '',
  location: t.location ?? '',
  start_date: t.start_date,
  end_date: t.end_date,
  format: t.format,
  points_win: t.points_win,
  points_draw: t.points_draw,
  points_loss: t.points_loss,
  halftime_enabled: t.halftime_enabled,
  minutes_per_half: t.minutes_per_half,
  halftime_minutes: t.halftime_minutes ?? '',
  extra_time_minutes: t.extra_time_minutes ?? '',
  penalty_shootout_enabled: t.penalty_shootout_enabled,
  require_goal_player: t.require_goal_player,
  num_groups: t.num_groups ?? '',
  teams_per_group: t.teams_per_group ?? '',
  advance_per_group: t.advance_per_group ?? '',
  knockout_start_round: t.knockout_start_round ?? '',
  seeding_method: t.seeding_method ?? '',
})
```

Remove the `matchPreset` / `pointsPreset` index pattern from the load function — points are now stored as raw numbers.

- [ ] **Step 3: Update the patch object in handleSubmit**

Remove the preset-based points logic and replace with direct values. In `handleSubmit`, update the `if (!formatLocked)` block:

```ts
if (!formatLocked) {
  patch.format = form.format
  patch.points_win = form.points_win
  patch.points_draw = form.points_draw
  patch.points_loss = form.points_loss
  patch.halftime_enabled = form.halftime_enabled
  patch.minutes_per_half = Number(form.minutes_per_half)
  patch.halftime_minutes = form.halftime_enabled ? Number(form.halftime_minutes) : null
  patch.extra_time_minutes = form.extra_time_minutes !== '' ? Number(form.extra_time_minutes) : null
  patch.penalty_shootout_enabled = form.penalty_shootout_enabled
  patch.require_goal_player = form.require_goal_player
  const hasRR = form.format === 'round_robin' || form.format === 'round_robin_knockout'
  const hasKO = form.format === 'knockout' || form.format === 'round_robin_knockout'
  const isHybrid = form.format === 'round_robin_knockout'
  patch.num_groups = hasRR ? Number(form.num_groups) : null
  patch.teams_per_group = hasRR ? Number(form.teams_per_group) : null
  patch.advance_per_group = isHybrid ? Number(form.advance_per_group) : null
  patch.knockout_start_round = hasKO ? form.knockout_start_round || null : null
  patch.seeding_method = hasKO ? form.seeding_method || null : null
}
```

- [ ] **Step 4: Add wizard fields to the form JSX**

In the form, after the existing Format field block and before the submit button, add wizard field sections gated by `formatLocked`.

Replace the existing Points System block (the radio presets) with this full block:

```tsx
{/* Points System */}
<div className="border-t border-slate-100 pt-4 space-y-4">
  <div className="flex items-center justify-between">
    <p className="text-sm font-semibold text-slate-700">Points System</p>
    {formatLocked && <p className="text-xs text-slate-400">Locked after first match scheduled.</p>}
  </div>
  <div className="grid grid-cols-3 gap-4">
    {(['points_win', 'points_draw', 'points_loss'] as const).map(field => (
      <div key={field}>
        <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">
          {field.replace('points_', '')}
        </label>
        {formatLocked ? (
          <input type="number" value={form[field]} disabled className={inputClass} />
        ) : (
          <input
            type="number"
            step="0.5"
            value={form[field]}
            onChange={e => update(field, Number(e.target.value))}
            className={inputClass}
          />
        )}
      </div>
    ))}
  </div>
</div>

{/* Match Rules */}
<div className="border-t border-slate-100 pt-4 space-y-4">
  <div className="flex items-center justify-between">
    <p className="text-sm font-semibold text-slate-700">Match Rules</p>
    {formatLocked && <p className="text-xs text-slate-400">Locked after first match scheduled.</p>}
  </div>
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Time per half (min)</label>
      <input
        type="number"
        min={1}
        value={form.minutes_per_half}
        disabled={formatLocked}
        onChange={e => update('minutes_per_half', Number(e.target.value))}
        className={inputClass}
      />
    </div>
    {form.halftime_enabled && (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Halftime duration (min)</label>
        <input
          type="number"
          min={1}
          value={form.halftime_minutes}
          disabled={formatLocked}
          onChange={e => update('halftime_minutes', e.target.value === '' ? '' : Number(e.target.value))}
          className={inputClass}
        />
      </div>
    )}
  </div>
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">Extra time duration (min)</label>
    <input
      type="number"
      min={0}
      value={form.extra_time_minutes}
      disabled={formatLocked}
      onChange={e => update('extra_time_minutes', e.target.value === '' ? '' : Number(e.target.value))}
      placeholder="0 or blank = none"
      className={inputClass}
    />
  </div>
  <label className={`flex items-center gap-3 ${formatLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
    <input
      type="checkbox"
      checked={form.penalty_shootout_enabled}
      disabled={formatLocked}
      onChange={e => update('penalty_shootout_enabled', e.target.checked)}
      className="accent-green-600"
    />
    <span className="text-sm text-slate-700">Penalty shootout as tiebreaker (best of 5)</span>
  </label>
  <label className={`flex items-center gap-3 ${formatLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
    <input
      type="checkbox"
      checked={form.require_goal_player}
      disabled={formatLocked}
      onChange={e => update('require_goal_player', e.target.checked)}
      className="accent-green-600"
    />
    <span className="text-sm text-slate-700">Require player attribution for goals</span>
  </label>
</div>
```

- [ ] **Step 5: Remove POINTS_PRESETS and matchPreset from edit/page.tsx**

The preset radio buttons and `matchPreset` function are no longer used. Delete:
- The `POINTS_PRESETS` constant
- The `matchPreset` function
- The preset radio JSX block (replaced in Step 4)

- [ ] **Step 6: Run the full test suite**

```bash
cd web && pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: Verify TypeScript**

```bash
cd web && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add web/app/admin/tournaments/[id]/edit/page.tsx
git commit -m "feat: edit page — wizard fields editable pre-lock, read-only post-lock (FR-28)"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| 5-step wizard structure | Tasks 5–11 |
| Step 1: Basic Info fields | Task 6 |
| Step 2: Format radio + conditional RR fields | Task 7 |
| Step 2: Conditional KO fields + seeding method | Task 7 |
| Step 3: Halftime toggle, durations, penalty flag | Task 8 |
| Step 4: Points with win>draw>loss validation | Task 9 |
| Step 4: require_goal_player toggle | Task 9 |
| Step 5: Read-only review with Edit jump links | Task 10 |
| Conditional fields unmount on format change | Task 7 (`handleFormatChange` clears values) |
| createTournament server action | Task 4 |
| DB migration: 11 columns + backfill | Task 1 |
| TypeScript types updated | Task 2 |
| Validation unit-tested | Task 3 |
| Edit page: new fields + post-lock read-only | Task 12 |
| FR-28: lock predicate reuses `canEditFormat` | Task 12 (uses `formatLocked`) |

**Placeholder scan:** No TBDs, TODOs, or incomplete steps. All code blocks are complete. ✓

**Type consistency:** `WizardFormValue` defined in Task 3, imported in Tasks 4, 6–11. `WizardErrors` used consistently as `Partial<Record<keyof WizardFormValue, string>>`. `createTournament` return type `CreateTournamentResult` defined in Task 4 and consumed in Task 11. ✓
