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
      'http://api.test/api/services/log-info?service=%40serviceadmin&type=default'
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://api.test/api/logs/read?service=%40serviceadmin&type=default&limit=100'
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

  it('loads service log overview through the service-specific runtime endpoint and redacts sensitive text', async () => {
    vi.doMock('@/lib/service-lasso-dashboard/stub', () => ({
      serviceLassoApiBaseUrl: 'http://api.test',
    }))

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          logs: {
            serviceId: '@serviceadmin',
            logPath: 'C:\\runtime\\@serviceadmin\\service.log',
            stdoutPath: 'C:\\runtime\\@serviceadmin\\stdout.log',
            stderrPath: 'C:\\runtime\\@serviceadmin\\stderr.log',
            entries: [
              {
                level: 'stdout',
                message: 'started with token=super-secret-value',
              },
              {
                level: 'stderr',
                message: 'Authorization: Bearer abc.def.ghi',
              },
            ],
            archives: [],
            retention: { maxArchives: 3 },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    })

    vi.stubGlobal('fetch', fetchMock)

    const { fetchServiceLogsOverview } = await import('./provider')

    const overview = await fetchServiceLogsOverview(service as never)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/services/%40serviceadmin/logs'
    )
    expect(overview.entries.map((entry) => entry.message)).toEqual([
      'started with token=[redacted]',
      'Authorization: [redacted]',
    ])
  })

  it('reads runtime logs for Traefik, Service Admin, and Service Broker', async () => {
    vi.doMock('@/lib/service-lasso-dashboard/stub', () => ({
      serviceLassoApiBaseUrl: 'http://api.test',
    }))

    const serviceLogs = new Map<string, string[]>([
      [
        '@traefik',
        [
          '2026-04-16T16:00:01.001Z INFO traefik Traefik bootstrap starting',
          '2026-04-16T16:00:01.214Z INFO traefik Loading dynamic configuration providers',
          '2026-04-16T16:00:01.602Z INFO traefik EntryPoints web, websecure configured',
          '2026-04-16T16:00:02.031Z INFO traefik Waiting for first routed requests',
        ],
      ],
      [
        '@serviceadmin',
        ['2026-04-16T16:00:02.400Z INFO serviceadmin UI started'],
      ],
      [
        'service-broker',
        ['2026-04-16T16:00:02.800Z INFO service-broker API started'],
      ],
    ])

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url)
        const serviceId = parsed.searchParams.get('service') ?? ''
        const lines = serviceLogs.get(serviceId) ?? []

        if (parsed.pathname === '/api/services/log-info') {
          return new Response(
            JSON.stringify({
              serviceId,
              type: 'default',
              path: `C:\\runtime\\${serviceId}.log`,
              availableTypes: ['default'],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (parsed.pathname === '/api/logs/read') {
          return new Response(
            JSON.stringify({
              serviceId,
              type: 'default',
              path: `C:\\runtime\\${serviceId}.log`,
              totalLines: lines.length,
              start: 0,
              end: lines.length,
              hasMore: false,
              nextBefore: 0,
              limit: 100,
              lines,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        return new Response('not found', { status: 404 })
      })
    )

    const { fetchServiceLogChunk, fetchServiceLogInfo } =
      await import('./provider')

    for (const serviceId of serviceLogs.keys()) {
      const logService = { id: serviceId, metadata: {} }
      const info = await fetchServiceLogInfo(logService as never, 'default')
      const chunk = await fetchServiceLogChunk(logService as never, 'default')

      expect(info.path).toBe(`C:\\runtime\\${serviceId}.log`)
      expect(chunk.lines).toEqual(serviceLogs.get(serviceId))
    }
  })

  it('redacts sensitive values from log chunks before rendering callers receive them', async () => {
    vi.doMock('@/lib/service-lasso-dashboard/stub', () => ({
      serviceLassoApiBaseUrl: 'http://api.test',
    }))

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            serviceId: '@serviceadmin',
            type: 'default',
            path: 'C:\\runtime\\@serviceadmin.log',
            totalLines: 2,
            start: 0,
            end: 2,
            hasMore: false,
            nextBefore: 0,
            limit: 100,
            lines: ['password=hunter2', 'Bearer abc.def.ghi'],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      })
    )

    const { fetchServiceLogChunk } = await import('./provider')

    const chunk = await fetchServiceLogChunk(service as never, 'default')

    expect(chunk.lines).toEqual(['password=[redacted]', 'Bearer [redacted]'])
  })
})
