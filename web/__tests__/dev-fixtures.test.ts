import { describe, it, expect } from 'vitest'
import { MOCK_TOURNAMENTS } from '@/lib/dev-fixtures'

describe('dev-fixtures — MOCK_TOURNAMENTS', () => {
  it('exports exactly 2 tournaments', () => {
    expect(MOCK_TOURNAMENTS).toHaveLength(2)
  })

  describe('first tournament (dev-1)', () => {
    const tournament = MOCK_TOURNAMENTS[0]

    it('has id dev-1', () => {
      expect(tournament.id).toBe('dev-1')
    })

    it('has status active', () => {
      expect(tournament.status).toBe('active')
    })

    it('has format round_robin', () => {
      expect(tournament.format).toBe('round_robin')
    })

    it('has location XMUM Sports Hall', () => {
      expect(tournament.location).toBe('XMUM Sports Hall')
    })

    it('has a non-empty name', () => {
      expect(tournament.name).toBeTruthy()
      expect(typeof tournament.name).toBe('string')
    })

    it('has a non-empty start_date', () => {
      expect(tournament.start_date).toBeTruthy()
      expect(typeof tournament.start_date).toBe('string')
    })

    it('has a non-empty end_date', () => {
      expect(tournament.end_date).toBeTruthy()
      expect(typeof tournament.end_date).toBe('string')
    })

    it('has points_win = 3', () => {
      expect(tournament.points_win).toBe(3)
    })

    it('has points_draw = 1', () => {
      expect(tournament.points_draw).toBe(1)
    })

    it('has points_loss = 0', () => {
      expect(tournament.points_loss).toBe(0)
    })

    it('has a non-empty created_at', () => {
      expect(tournament.created_at).toBeTruthy()
      expect(typeof tournament.created_at).toBe('string')
    })

    it('has a non-empty updated_at', () => {
      expect(tournament.updated_at).toBeTruthy()
      expect(typeof tournament.updated_at).toBe('string')
    })
  })

  describe('second tournament (dev-2)', () => {
    const tournament = MOCK_TOURNAMENTS[1]

    it('has id dev-2', () => {
      expect(tournament.id).toBe('dev-2')
    })

    it('has status setup', () => {
      expect(tournament.status).toBe('setup')
    })

    it('has format knockout', () => {
      expect(tournament.format).toBe('knockout')
    })

    it('has location Field B', () => {
      expect(tournament.location).toBe('Field B')
    })

    it('has a non-empty name', () => {
      expect(tournament.name).toBeTruthy()
      expect(typeof tournament.name).toBe('string')
    })

    it('has a non-empty start_date', () => {
      expect(tournament.start_date).toBeTruthy()
      expect(typeof tournament.start_date).toBe('string')
    })

    it('has a non-empty end_date', () => {
      expect(tournament.end_date).toBeTruthy()
      expect(typeof tournament.end_date).toBe('string')
    })

    it('has points_win = 3', () => {
      expect(tournament.points_win).toBe(3)
    })

    it('has points_draw = 1', () => {
      expect(tournament.points_draw).toBe(1)
    })

    it('has points_loss = 0', () => {
      expect(tournament.points_loss).toBe(0)
    })

    it('has a non-empty created_at', () => {
      expect(tournament.created_at).toBeTruthy()
      expect(typeof tournament.created_at).toBe('string')
    })

    it('has a non-empty updated_at', () => {
      expect(tournament.updated_at).toBeTruthy()
      expect(typeof tournament.updated_at).toBe('string')
    })
  })

  describe('all tournaments', () => {
    it('all have required fields with non-empty values', () => {
      MOCK_TOURNAMENTS.forEach((tournament) => {
        expect(tournament.id).toBeTruthy()
        expect(tournament.name).toBeTruthy()
        expect(tournament.start_date).toBeTruthy()
        expect(tournament.end_date).toBeTruthy()
        expect(tournament.format).toBeTruthy()
        expect(tournament.status).toBeTruthy()
        expect(tournament.points_win).toBeDefined()
        expect(tournament.created_at).toBeTruthy()
        expect(tournament.updated_at).toBeTruthy()
      })
    })

    it('all have points_win = 3, points_draw = 1, points_loss = 0', () => {
      MOCK_TOURNAMENTS.forEach((tournament) => {
        expect(tournament.points_win).toBe(3)
        expect(tournament.points_draw).toBe(1)
        expect(tournament.points_loss).toBe(0)
      })
    })
  })
})
