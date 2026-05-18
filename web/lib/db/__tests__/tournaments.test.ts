import { describe, it, expect, vi } from 'vitest'
import { getTournament, updateTournament } from '../tournaments'

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
