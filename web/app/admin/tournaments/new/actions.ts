'use server'

import { createClient } from '@/lib/supabase/server'
import { createTournament as createTournamentDal } from '@/lib/db/tournaments'
import { validateStep, type WizardFormValue, type WizardErrors } from '@/lib/wizard-validation'

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

  try {
    const { id } = await createTournamentDal(supabase, {
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
    return { id, serverError: null, errors: null, failedStep: null }
  } catch (e) {
    return { id: null, serverError: e instanceof Error ? e.message : 'Failed to create tournament', errors: null, failedStep: null }
  }
}
