import { describe, it, expect, vi } from 'vitest'
import { getTeams, createTeam, renameTeam, deleteTeam, getTournamentStatus, getTeamWithPlayers } from '../teams'

function mockClient(response: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(response)
  const order = vi.fn().mockResolvedValue(response)
  const selectInChain = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order, single }), order })
  const eq = vi.fn().mockResolvedValue(response)
  // insert is awaitable AND has .select for createTeamsBatch
  const insertResult = Object.assign(Promise.resolve(response), {
    select: vi.fn().mockResolvedValue(response),
  })
  const insert = vi.fn().mockReturnValue(insertResult)
  const update = vi.fn().mockReturnValue({ eq })
  const del = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue(response) })
  const from = vi.fn().mockReturnValue({ select: selectInChain, insert, update, delete: del })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any
}

describe('teams DAL', () => {
  it('getTeams returns typed data when the query succeeds', async () => {
    const rows = [{ id: 't1', tournament_id: 'tr1', players: [] }]
    const client = mockClient({ data: rows, error: null })
    const result = await getTeams(client, 'tr1')
    expect(result).toEqual(rows)
  })

  it('getTeams throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'db error' } })
    await expect(getTeams(client, 'tr1')).rejects.toThrow('db error')
  })

  it('createTeam succeeds without throwing', async () => {
    const client = mockClient({ data: null, error: null })
    await expect(createTeam(client, 'tr1', 'Team A')).resolves.toBeUndefined()
  })

  it('createTeam throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'insert failed' } })
    await expect(createTeam(client, 'tr1', 'Team A')).rejects.toThrow('insert failed')
  })

  it('deleteTeam succeeds without throwing', async () => {
    const client = mockClient({ data: null, error: null })
    await expect(deleteTeam(client, 't1')).resolves.toBeUndefined()
  })

  it('deleteTeam throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'delete failed' } })
    await expect(deleteTeam(client, 't1')).rejects.toThrow('delete failed')
  })

  it('renameTeam succeeds without throwing', async () => {
    const client = mockClient({ data: null, error: null })
    await expect(renameTeam(client, 't1', 'New Name')).resolves.toBeUndefined()
  })

  it('renameTeam throws when the query errors', async () => {
    const client = mockClient({ data: null, error: { message: 'update failed' } })
    await expect(renameTeam(client, 't1', 'New Name')).rejects.toThrow('update failed')
  })

  it('getTournamentStatus returns status when the query succeeds', async () => {
    const client = mockClient({ data: { status: 'active' }, error: null })
    const result = await getTournamentStatus(client, 'tr1')
    expect(result).toBe('active')
  })

  it('getTournamentStatus returns null on PGRST116 (not found)', async () => {
    const client = mockClient({ data: null, error: { code: 'PGRST116', message: 'not found' } })
    await expect(getTournamentStatus(client, 'tr1')).resolves.toBeNull()
  })

  it('getTournamentStatus throws on non-PGRST116 errors', async () => {
    const client = mockClient({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
    await expect(getTournamentStatus(client, 'tr1')).rejects.toThrow('relation does not exist')
  })
})

function mockChainedEqSingle(response: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(response)
  const innerEq = vi.fn().mockReturnValue({ single })
  const outerEq = vi.fn().mockReturnValue({ eq: innerEq })
  const select = vi.fn().mockReturnValue({ eq: outerEq })
  const from = vi.fn().mockReturnValue({ select })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any
}

describe('getTeamWithPlayers', () => {
  it('returns the team when found', async () => {
    const team = { id: 't1', tournament_id: 'tr1', players: [] }
    const client = mockChainedEqSingle({ data: team, error: null })
    expect(await getTeamWithPlayers(client, 't1', 'tr1')).toEqual(team)
  })

  it('returns null on PGRST116 (no row)', async () => {
    const client = mockChainedEqSingle({ data: null, error: { code: 'PGRST116', message: 'no row' } })
    expect(await getTeamWithPlayers(client, 't1', 'tr1')).toBeNull()
  })

  it('throws on other errors', async () => {
    const client = mockChainedEqSingle({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
    await expect(getTeamWithPlayers(client, 't1', 'tr1')).rejects.toThrow('relation does not exist')
  })
})
