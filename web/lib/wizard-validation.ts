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
