import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { TournamentCardItem } from './TournamentCardItem'
import type { Tournament } from '@/lib/supabase/types'

const meta: Meta<typeof TournamentCardItem> = {
  component: TournamentCardItem,
}
export default meta

type Story = StoryObj<typeof TournamentCardItem>

const baseTournament: Tournament = {
  id: 'tour-1',
  name: 'Summer Invitational 2026',
  description: 'Annual summer 7-a-side tournament',
  location: 'Kuala Lumpur',
  start_date: '2026-06-01',
  end_date: '2026-06-07',
  format: 'round_robin_knockout',
  points_win: 3,
  points_draw: 1,
  points_loss: 0,
  status: 'active',
  first_match_scheduled_at: '2026-06-01T08:00:00+08:00',
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
}

export const Active: Story = {
  args: {
    tournament: baseTournament,
    badge: {
      bg: 'rgba(163,230,53,0.12)',
      border: 'rgba(163,230,53,0.3)',
      color: '#a3e635',
      label: 'Active',
    },
    rail: 'var(--brand-lime)',
    dateRange: '1 Jun – 7 Jun 2026',
    formatLabel: 'Round Robin + Knockout',
  },
}

export const Setup: Story = {
  args: {
    tournament: { ...baseTournament, id: 'tour-2', name: 'Ramadan Cup 2026', status: 'setup', location: null },
    badge: {
      bg: 'rgba(148,163,184,0.12)',
      border: 'rgba(148,163,184,0.3)',
      color: '#94a3b8',
      label: 'Setup',
    },
    rail: 'var(--ink-500)',
    dateRange: '15 Mar – 22 Mar 2026',
    formatLabel: 'Knockout',
  },
}

export const Finished: Story = {
  args: {
    tournament: { ...baseTournament, id: 'tour-3', name: 'Champions League 2025', status: 'finished', location: 'Petaling Jaya' },
    badge: {
      bg: 'rgba(99,102,241,0.12)',
      border: 'rgba(99,102,241,0.3)',
      color: '#818cf8',
      label: 'Finished',
    },
    rail: '#818cf8',
    dateRange: '10 Nov – 17 Nov 2025',
    formatLabel: 'Round Robin',
  },
}
