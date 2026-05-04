import { describe, it, expect } from 'vitest'

const VALID_ROLES = ['organizer', 'scorekeeper']

function isValidRole(role: string): boolean {
  return VALID_ROLES.includes(role)
}

describe('user create route — role validation', () => {
  it('accepts organizer role', () => {
    expect(isValidRole('organizer')).toBe(true)
  })

  it('accepts scorekeeper role', () => {
    expect(isValidRole('scorekeeper')).toBe(true)
  })

  it('rejects admin role', () => {
    expect(isValidRole('admin')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidRole('')).toBe(false)
  })

  it('rejects arbitrary strings', () => {
    expect(isValidRole('superuser')).toBe(false)
  })
})
