import { describe, it, expect, vi } from 'vitest'
import { createPlayer, updatePlayer, deletePlayer, createPlayersBatch } from '../players'

function mockClient(response: { data: unknown; error: unknown }) {
  const eq = vi.fn().mockResolvedValue(response)
  const insertResult = Object.assign(Promise.resolve(response), {
    select: vi.fn().mockResolvedValue(response),
  })
  const insert = vi.fn().mockReturnValue(insertResult)
  const update = vi.fn().mockReturnValue({ eq })
  const del = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(response) })
  const from = vi.fn().mockReturnValue({ insert, update, delete: del })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any
}

describe('players DAL', () => {
  it('createPlayer succeeds without throwing', async () => {
    const client = mockClient({ data: null, error: null })
    await expect(createPlayer(client, { team_id: 't1', name: 'Alice', jersey_number: 7, position: 'GK' })).resolves.toBeUndefined()
  })

  it('createPlayer throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'insert failed' } })
    await expect(createPlayer(client, { team_id: 't1', name: 'Alice', jersey_number: 7, position: 'GK' })).rejects.toThrow('insert failed')
  })

  it('updatePlayer succeeds without throwing', async () => {
    const client = mockClient({ data: null, error: null })
    await expect(updatePlayer(client, 'p1', { name: 'Bob', jersey_number: 10, position: 'FWD' })).resolves.toBeUndefined()
  })

  it('updatePlayer throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'update failed' } })
    await expect(updatePlayer(client, 'p1', { name: 'Bob', jersey_number: 10, position: 'FWD' })).rejects.toThrow('update failed')
  })

  it('deletePlayer succeeds without throwing', async () => {
    const client = mockClient({ data: null, error: null })
    await expect(deletePlayer(client, 'p1')).resolves.toBeUndefined()
  })

  it('deletePlayer throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'delete failed' } })
    await expect(deletePlayer(client, 'p1')).rejects.toThrow('delete failed')
  })

  it('createPlayersBatch succeeds without throwing', async () => {
    const client = mockClient({ data: null, error: null })
    const players = [
      { team_id: 't1', name: 'Alice', jersey_number: 7, position: 'GK' },
      { team_id: 't1', name: 'Bob', jersey_number: 10, position: null },
    ]
    await expect(createPlayersBatch(client, players)).resolves.toBeUndefined()
  })

  it('createPlayersBatch throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'batch insert failed' } })
    const players = [{ team_id: 't1', name: 'Alice', jersey_number: null, position: null }]
    await expect(createPlayersBatch(client, players)).rejects.toThrow('batch insert failed')
  })
})
