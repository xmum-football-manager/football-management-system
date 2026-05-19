import { describe, it, expect, vi } from 'vitest'
import {
  getTournament,
  updateTournament,
  getActiveTournaments,
  getAllTournaments,
  getTournamentsByIds,
  getAllUserRoles,
  pingTournaments,
} from '../tournaments'

function mockClient(response: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(response)
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(response) })
  const from = vi.fn().mockReturnValue({ select, update })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any
}

describe('tournaments DAL', () => {
  it('getTournament returns typed data when the query succeeds', async () => {
    const client = mockClient({ data: { id: 't1', name: 'Cup' }, error: null })
    const result = await getTournament(client, 't1')
    expect(result).toEqual({ id: 't1', name: 'Cup' })
  })

  it('getTournament throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    await expect(getTournament(client, 't1')).rejects.toThrow('boom')
  })

  it('updateTournament accepts a typed patch and awaits the result', async () => {
    const client = mockClient({ data: null, error: null })
    await updateTournament(client, 't1', { name: 'Renamed' })
    expect(client.from).toHaveBeenCalledWith('tournaments')
  })

  it('updateTournament throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    await expect(updateTournament(client, 't1', { name: 'Renamed' })).rejects.toThrow('boom')
  })
})

function mockListClient(response: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(response)
  const inFn = vi.fn().mockReturnValue({ order })
  const limit = vi.fn().mockResolvedValue(response)
  // select itself must be awaitable for getAllUserRoles (no further chain)
  const selectResult = Object.assign(Promise.resolve(response), {
    in: inFn,
    order,
    limit,
  })
  const select = vi.fn().mockReturnValue(selectResult)
  const from = vi.fn().mockReturnValue({ select })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any
}

describe('tournaments DAL list queries', () => {
  it('getActiveTournaments returns the rows', async () => {
    const rows = [{ id: 't1' }, { id: 't2' }]
    const client = mockListClient({ data: rows, error: null })
    const result = await getActiveTournaments(client)
    expect(result).toEqual(rows)
  })

  it('getActiveTournaments throws on error', async () => {
    const client = mockListClient({ data: null, error: { message: 'boom' } })
    await expect(getActiveTournaments(client)).rejects.toThrow('boom')
  })

  it('getAllTournaments returns the rows ordered', async () => {
    const rows = [{ id: 't1' }]
    const client = mockListClient({ data: rows, error: null })
    expect(await getAllTournaments(client)).toEqual(rows)
  })

  it('getTournamentsByIds short-circuits on empty array', async () => {
    const client = mockListClient({ data: null, error: { message: 'should not be called' } })
    const result = await getTournamentsByIds(client, [])
    expect(result).toEqual([])
    expect(client.from).not.toHaveBeenCalled()
  })

  it('getTournamentsByIds returns rows when given ids', async () => {
    const rows = [{ id: 't1' }]
    const client = mockListClient({ data: rows, error: null })
    expect(await getTournamentsByIds(client, ['t1'])).toEqual(rows)
  })

  it('getAllUserRoles returns the rows', async () => {
    const rows = [{ user_id: 'u1', role: 'admin', tournament_id: null }]
    const client = mockListClient({ data: rows, error: null })
    expect(await getAllUserRoles(client)).toEqual(rows)
  })

  it('pingTournaments resolves on success', async () => {
    const client = mockListClient({ data: [], error: null })
    await expect(pingTournaments(client)).resolves.toBeUndefined()
  })

  it('pingTournaments throws on error', async () => {
    const client = mockListClient({ data: null, error: { message: 'boom' } })
    await expect(pingTournaments(client)).rejects.toThrow('boom')
  })
})
