import { beforeEach, describe, expect, it, vi } from 'vitest'

const service = {
  id: '@serviceadmin',
  metadata: {
    logPath:
      'C:\\projects\\service-lasso\\lasso-@serviceadmin\\logs\\@serviceadmin.log',
  },
} as const

describe('logs provider relative api mode', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('requests log info and log chunks through relative api routes when no api base is configured', async () => {
    vi.doMock('@/lib/service-lasso-dashboard/stub', () => ({
      serviceLassoApiBaseUrl: null,
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
            totalLines: 122,
            start: 22,
            end: 122,
            hasMore: true,
            nextBefore: 22,
            limit: 100,
            lines: Array.from(
              { length: 100 },
              (_, index) => `line ${index + 23}`
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
      '/api/services/log-info?service=%40serviceadmin&type=default'
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/logs/read?service=%40serviceadmin&type=default&limit=100'
    )

    expect(info.path).toBe('C:\\runtime\\@serviceadmin.log')
    expect(chunk.limit).toBe(100)
    expect(chunk.lines).toHaveLength(100)
    expect(chunk.hasMore).toBe(true)
  })
})
