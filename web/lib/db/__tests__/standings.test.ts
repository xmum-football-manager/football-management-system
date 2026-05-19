import { describe, it, expect, vi } from 'vitest'
import { getTournamentStandings, getTeamStanding } from '../standings'

function mockListClient(response: { data: unknown; error: unknown }) {
  const eq = vi.fn().mockResolvedValue(response)
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any
}

function mockSingleClient(response: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(response)
  const innerEq = vi.fn().mockReturnValue({ single })
  const outerEq = vi.fn().mockReturnValue({ eq: innerEq })
  const select = vi.fn().mockReturnValue({ eq: outerEq })
  const from = vi.fn().mockReturnValue({ select })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any
}

describe('standings DAL', () => {
  it('getTournamentStandings returns rows on success', async () => {
    const rows = [{ team_id: 'a', points: 6 }]
    const client = mockListClient({ data: rows, error: null })
    expect(await getTournamentStandings(client, 'tr1')).toEqual(rows)
  })

  it('getTournamentStandings throws on error', async () => {
    const client = mockListClient({ data: null, error: { message: 'boom' } })
    await expect(getTournamentStandings(client, 'tr1')).rejects.toThrow('boom')
  })

  it('getTeamStanding returns row on success', async () => {
    const row = { team_id: 'a', points: 3 }
    const client = mockSingleClient({ data: row, error: null })
    expect(await getTeamStanding(client, 'a', 'tr1')).toEqual(row)
  })

  it('getTeamStanding returns null on PGRST116', async () => {
    const client = mockSingleClient({ data: null, error: { code: 'PGRST116', message: 'no row' } })
    expect(await getTeamStanding(client, 'a', 'tr1')).toBeNull()
  })

  it('getTeamStanding throws on other errors', async () => {
    const client = mockSingleClient({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
    await expect(getTeamStanding(client, 'a', 'tr1')).rejects.toThrow('relation does not exist')
  })
})
