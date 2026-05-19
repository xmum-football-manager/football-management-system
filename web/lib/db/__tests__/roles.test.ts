import { describe, it, expect, vi } from 'vitest'
import { assignScorekeeper, removeScorekeeper, assignOrganizer, removeOrganizer } from '../roles'

function mockClient({
  rpcResult,
  mutationResult,
}: {
  rpcResult: { data: unknown; error: unknown }
  mutationResult: { data: unknown; error: unknown }
}) {
  const rpc = vi.fn().mockResolvedValue(rpcResult)

  // Build a chainable query builder that resolves to mutationResult at any depth
  function makeChain(): object {
    const resolved = Promise.resolve(mutationResult)
    const chain: Record<string, unknown> = {
      eq: vi.fn(),
      is: vi.fn(),
      then: resolved.then.bind(resolved),
      catch: resolved.catch.bind(resolved),
      finally: resolved.finally.bind(resolved),
    }
    chain.eq = vi.fn().mockReturnValue(chain)
    chain.is = vi.fn().mockReturnValue(chain)
    return chain
  }

  const del = vi.fn().mockReturnValue(makeChain())
  const upsert = vi.fn().mockResolvedValue(mutationResult)
  const insert = vi.fn().mockResolvedValue(mutationResult)

  const from = vi.fn().mockReturnValue({ delete: del, upsert, insert })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { rpc, from } as any
}

describe('roles DAL', () => {
  describe('assignScorekeeper', () => {
    it('resolves without throwing when both rpc and insert succeed', async () => {
      const client = mockClient({
        rpcResult: { data: 'user-123', error: null },
        mutationResult: { data: null, error: null },
      })
      await expect(
        assignScorekeeper(client, 'sk@example.com', 'tourn-1', null)
      ).resolves.not.toThrow()
    })

    it('throws when the user is not found (rpc returns null userId)', async () => {
      const client = mockClient({
        rpcResult: { data: null, error: null },
        mutationResult: { data: null, error: null },
      })
      await expect(
        assignScorekeeper(client, 'nobody@example.com', 'tourn-1', 'match-1')
      ).rejects.toThrow('User not found')
    })

    it('throws when the rpc itself errors', async () => {
      const client = mockClient({
        rpcResult: { data: null, error: { message: 'rpc failed' } },
        mutationResult: { data: null, error: null },
      })
      await expect(
        assignScorekeeper(client, 'sk@example.com', 'tourn-1', null)
      ).rejects.toThrow('User not found')
    })

    it('throws when the insert errors', async () => {
      const client = mockClient({
        rpcResult: { data: 'user-123', error: null },
        mutationResult: { data: null, error: { message: 'insert failed' } },
      })
      await expect(
        assignScorekeeper(client, 'sk@example.com', 'tourn-1', null)
      ).rejects.toThrow('insert failed')
    })
  })

  describe('removeScorekeeper', () => {
    it('resolves without throwing on success', async () => {
      const client = mockClient({
        rpcResult: { data: null, error: null },
        mutationResult: { data: null, error: null },
      })
      await expect(
        removeScorekeeper(client, 'user-123', 'tourn-1', null)
      ).resolves.not.toThrow()
    })

    it('throws when the delete errors', async () => {
      const client = mockClient({
        rpcResult: { data: null, error: null },
        mutationResult: { data: null, error: { message: 'delete failed' } },
      })
      await expect(
        removeScorekeeper(client, 'user-123', 'tourn-1', 'match-1')
      ).rejects.toThrow('delete failed')
    })
  })

  describe('assignOrganizer', () => {
    it('resolves without throwing on success', async () => {
      const client = mockClient({
        rpcResult: { data: 'user-456', error: null },
        mutationResult: { data: null, error: null },
      })
      await expect(
        assignOrganizer(client, 'org@example.com', 'tourn-1')
      ).resolves.not.toThrow()
    })

    it('throws when user is not found', async () => {
      const client = mockClient({
        rpcResult: { data: null, error: null },
        mutationResult: { data: null, error: null },
      })
      await expect(
        assignOrganizer(client, 'nobody@example.com', 'tourn-1')
      ).rejects.toThrow('User not found')
    })

    it('throws when the upsert errors', async () => {
      const client = mockClient({
        rpcResult: { data: 'user-456', error: null },
        mutationResult: { data: null, error: { message: 'upsert failed' } },
      })
      await expect(
        assignOrganizer(client, 'org@example.com', 'tourn-1')
      ).rejects.toThrow('upsert failed')
    })
  })

  describe('removeOrganizer', () => {
    it('resolves without throwing on success', async () => {
      const client = mockClient({
        rpcResult: { data: null, error: null },
        mutationResult: { data: null, error: null },
      })
      await expect(
        removeOrganizer(client, 'user-456', 'tourn-1')
      ).resolves.not.toThrow()
    })

    it('throws when the delete errors', async () => {
      const client = mockClient({
        rpcResult: { data: null, error: null },
        mutationResult: { data: null, error: { message: 'delete failed' } },
      })
      await expect(
        removeOrganizer(client, 'user-456', 'tourn-1')
      ).rejects.toThrow('delete failed')
    })
  })
})
