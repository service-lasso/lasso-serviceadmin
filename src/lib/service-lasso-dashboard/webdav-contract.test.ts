import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeWebDAVInventory } from './webdav-contract'

export const inventoryFixture = {
  serviceId: '@secretsbroker',
  outcome: 'ready',
  state: 'listening',
  generatedAt: '2026-10-08T00:00:00Z',
  capacityBytes: 67108864,
  usedBytes: 12,
  activeGrants: 1,
  fileCount: 1,
  downloads: 2,
  servedBytes: 24,
  files: [
    {
      grantId: 'a'.repeat(32),
      workspaceId: 'local',
      serviceId: 'echo-webdav',
      path: 'demo-config.json',
      sizeBytes: 12,
      createdAt: '2026-10-08T00:00:00Z',
      downloads: 2,
      servedBytes: 24,
      lastAccessAt: '2026-10-08T00:01:00Z',
    },
  ],
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})
describe('WebDAV inventory management contract', () => {
  it('loads paginated metadata through Core', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(inventoryFixture), {
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { fetchBrokerWebDAV } = await import('./stub')
    expect((await fetchBrokerWebDAV('100')).files[0].downloads).toBe(2)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://runtime.test/api/services/%40secretsbroker/operations/webdav?limit=100&cursor=100'
    )
    await expect(fetchBrokerWebDAV('-1')).rejects.toThrow(
      'Invalid inventory cursor'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('rejects secret fields, capability URLs, malformed owners, counts and pagination', () => {
    for (const fixture of [
      { ...inventoryFixture, token: 'private' },
      { ...inventoryFixture, usedBytes: -1 },
      { ...inventoryFixture, usedBytes: 67108865 },
      { ...inventoryFixture, nextCursor: '-1' },
      { ...inventoryFixture, state: 'public' },
      {
        ...inventoryFixture,
        files: [{ ...inventoryFixture.files[0], content: 'private' }],
      },
      {
        ...inventoryFixture,
        files: [
          { ...inventoryFixture.files[0], path: 'http://127.0.0.1/token' },
        ],
      },
      {
        ...inventoryFixture,
        files: [{ ...inventoryFixture.files[0], path: '../key' }],
      },
      {
        ...inventoryFixture,
        files: [
          {
            ...inventoryFixture.files[0],
            serviceId: 'Bearer private-token-value',
          },
        ],
      },
      {
        ...inventoryFixture,
        files: [{ ...inventoryFixture.files[0], downloads: NaN }],
      },
    ])
      expect(() => normalizeWebDAVInventory(fixture)).toThrow()
  })
  it('reports stopped/empty inventory explicitly', () => {
    expect(
      normalizeWebDAVInventory({
        ...inventoryFixture,
        state: 'stopped',
        outcome: 'unavailable',
        usedBytes: 0,
        activeGrants: 0,
        fileCount: 0,
        downloads: 0,
        servedBytes: 0,
        files: [],
      })
    ).toMatchObject({ state: 'stopped', files: [] })
  })
  it('propagates rejected authentication without substituting demo data', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{}', {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    const { fetchBrokerWebDAV } = await import('./stub')
    await expect(fetchBrokerWebDAV()).rejects.toThrow()
  })
})
