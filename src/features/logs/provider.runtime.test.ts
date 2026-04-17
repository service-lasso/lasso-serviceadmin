import { beforeEach, describe, expect, it, vi } from 'vitest'

const service = {
  id: '@serviceadmin',
  metadata: {
    logPath:
      'C:\\projects\\service-lasso\\lasso-@serviceadmin\\logs\\@serviceadmin.log',
  },
} as const

describe('logs provider configured api mode', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('requests log info and chunk reads from the configured api base url', async () => {
    vi.doMock('@/lib/service-lasso-dashboard/stub', () => ({
      serviceLassoApiBaseUrl: 'http://api.test',
    }))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            serviceId: '@serviceadmin',
            type: 'default',
            path: 'C:\\runtime\\@serviceadmin.log',
            availableTypes: ['default'],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            serviceId: '@serviceadmin',
            type: 'default',
            path: 'C:\\runtime\\@serviceadmin.log',
            totalLines: 140,
            start: 40,
            end: 140,
            hasMore: true,
            nextBefore: 40,
            limit: 100,
            lines: Array.from(
              { length: 100 },
              (_, index) => `line ${index + 41}`
            ),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )

    vi.stubGlobal('fetch', fetchMock)

    const { fetchServiceLogChunk, fetchServiceLogInfo } =
      await import('./provider')

    const info = await fetchServiceLogInfo(service as never, 'default')
    const chunk = await fetchServiceLogChunk(service as never, 'default')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://api.test/api/services/log-info?service=@serviceadmin&type=default'
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://api.test/api/logs/read?service=@serviceadmin&type=default&limit=100'
    )

    expect(info.path).toBe('C:\\runtime\\@serviceadmin.log')
    expect(chunk.lines).toHaveLength(100)
    expect(chunk.nextBefore).toBe(40)
  })

  it('fails cleanly when the runtime api returns non-json content', async () => {
    vi.doMock('@/lib/service-lasso-dashboard/stub', () => ({
      serviceLassoApiBaseUrl: 'http://api.test',
    }))

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<!doctype html><html><body>wrong</body></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          })
      )
    )

    const { fetchServiceLogChunk } = await import('./provider')

    await expect(
      fetchServiceLogChunk(service as never, 'default')
    ).rejects.toThrow('Live logs are unavailable right now.')
  })
})
