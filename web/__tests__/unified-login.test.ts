import { describe, it, expect } from 'vitest'
import { hasRequiredRole } from '@/app/login/page'

describe('hasRequiredRole', () => {
  it('returns true when requiredRoles is null (scorekeeper tab — no role check)', () => {
    expect(hasRequiredRole([], null)).toBe(true)
  })

  it('returns true when user has the required role', () => {
    expect(hasRequiredRole(['admin'], ['admin'])).toBe(true)
  })

  it('returns true when user has one of multiple accepted roles', () => {
    expect(hasRequiredRole(['organizer'], ['organizer', 'admin'])).toBe(true)
  })

  it('returns false when user has no matching role', () => {
    expect(hasRequiredRole(['scorekeeper'], ['admin'])).toBe(false)
  })

  it('returns false when user has no roles at all', () => {
    expect(hasRequiredRole([], ['admin'])).toBe(false)
  })
})
