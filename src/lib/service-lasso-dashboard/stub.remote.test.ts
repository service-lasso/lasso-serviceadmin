import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('service-lasso dashboard remote adapter', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('uses runtime dashboard routes when an api base url is configured', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://api.test')
    vi.stubEnv('VITE_SERVICE_LASSO_FAVORITES_ENABLED', 'true')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            summary: {
              runtime: {
                status: 'healthy',
                lastReloadedAt: '2026-04-22T10:00:00Z',
                warningCount: 0,
              },
              servicesTotal: 1,
              servicesRunning: 1,
              servicesStopped: 0,
              servicesDegraded: 0,
              networkExposureCount: 1,
              installedCount: 1,
              favorites: [],
              others: [],
              warnings: [],
              problemServices: [],
            },
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
            services: [
              {
                id: 'echo-service',
                name: 'Echo Service',
                status: 'running',
                favorite: false,
                note: 'ok',
                links: [],
                installed: true,
                role: 'node',
                runtimeHealth: {
                  state: 'running',
                  health: 'healthy',
                  uptime: '1m',
                  lastCheckAt: '2026-04-22T10:00:00Z',
                  lastRestartAt: '2026-04-22T09:59:00Z',
                  summary: 'ok',
                },
                endpoints: [],
                metadata: {
                  serviceType: 'app',
                  runtime: 'node',
                  version: '0.1.0',
                  build: 'test-build',
                },
                dependencies: [],
                dependents: [],
                environmentVariables: [],
                recentLogs: [],
                actions: [],
              },
            ],
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
            service: {
              id: 'echo-service',
              name: 'Echo Service',
              status: 'running',
              favorite: false,
              note: 'ok',
              links: [],
              installed: true,
              role: 'node',
              runtimeHealth: {
                state: 'running',
                health: 'healthy',
                uptime: '1m',
                lastCheckAt: '2026-04-22T10:00:00Z',
                lastRestartAt: '2026-04-22T09:59:00Z',
                summary: 'ok',
              },
              endpoints: [],
              metadata: {
                serviceType: 'app',
                runtime: 'node',
                version: '0.1.0',
                build: 'test-build',
              },
              dependencies: [],
              dependents: [],
              environmentVariables: [],
              recentLogs: [],
              actions: [],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )

    vi.stubGlobal('fetch', fetchMock)

    const { fetchDashboardService, fetchDashboardSummary, fetchServices } =
      await import('./stub')

    const summary = await fetchDashboardSummary()
    const services = await fetchServices()
    const service = await fetchDashboardService('echo-service')

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://api.test/api/dashboard')
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://api.test/api/dashboard/services'
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://api.test/api/dashboard/services/echo-service'
    )

    expect(summary.servicesTotal).toBe(1)
    expect(services).toHaveLength(1)
    expect(service?.id).toBe('echo-service')
  })

  it('posts runtime actions and refreshes summary when start-services is used with an api base url', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://api.test')
    vi.stubEnv('VITE_SERVICE_LASSO_FAVORITES_ENABLED', 'true')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            action: 'startAll',
            ok: true,
            results: [],
            skipped: [],
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
            summary: {
              runtime: {
                status: 'healthy',
                lastReloadedAt: '2026-04-22T10:01:00Z',
                warningCount: 0,
              },
              servicesTotal: 1,
              servicesRunning: 1,
              servicesStopped: 0,
              servicesDegraded: 0,
              networkExposureCount: 1,
              installedCount: 1,
              favorites: [],
              others: [],
              warnings: [],
              problemServices: [],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )

    vi.stubGlobal('fetch', fetchMock)

    const { runDashboardAction } = await import('./stub')
    const summary = await runDashboardAction('start-services')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://api.test/api/runtime/actions/startAll',
      { method: 'POST' }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://api.test/api/dashboard')
    expect(summary.servicesRunning).toBe(1)
  })
})
