import { describe, it, expect, vi } from 'vitest'
import { getMatches, createMatch, updateMatchScore, transitionMatchStatus } from '../matches'

function mockClient(response: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(response)
  const eq = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(response), order, single: vi.fn().mockResolvedValue(response) })
  const select = vi.fn().mockReturnValue({ eq })
  const insert = vi.fn().mockResolvedValue(response)
  const update = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select, insert, update })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any
}

describe('matches DAL', () => {
  it('getMatches returns typed data when the query succeeds', async () => {
    const rows = [{ id: 'm1', tournament_id: 't1' }]
    const client = mockClient({ data: rows, error: null })
    const result = await getMatches(client, 't1')
    expect(result).toEqual(rows)
  })

  it('getMatches throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    await expect(getMatches(client, 't1')).rejects.toThrow('boom')
  })

  it('createMatch succeeds without throwing', async () => {
    const client = mockClient({ data: null, error: null })
    await expect(createMatch(client, 't1', 'h1', 'a1', '2026-01-01T10:00:00Z')).resolves.toBeUndefined()
  })

  it('createMatch throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'insert failed' } })
    await expect(createMatch(client, 't1', 'h1', 'a1', '2026-01-01T10:00:00Z')).rejects.toThrow('insert failed')
  })

  it('updateMatchScore succeeds without throwing', async () => {
    const client = mockClient({ data: null, error: null })
    await expect(updateMatchScore(client, 'm1', 2, 1)).resolves.toBeUndefined()
  })

  it('updateMatchScore throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'update failed' } })
    await expect(updateMatchScore(client, 'm1', 2, 1)).rejects.toThrow('update failed')
  })

  it('transitionMatchStatus succeeds without throwing', async () => {
    const client = mockClient({ data: null, error: null })
    await expect(transitionMatchStatus(client, 'm1', 'scheduled', 'live')).resolves.toBeUndefined()
  })

  it('transitionMatchStatus throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'transition failed' } })
    await expect(transitionMatchStatus(client, 'm1', 'scheduled', 'live')).rejects.toThrow('transition failed')
  })
})
