import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardService, DashboardSummary, ServiceStatus } from './types'

function service(
  id: string,
  name: string,
  status: ServiceStatus,
  recentLogs: string[] = []
): DashboardService {
  return {
    id,
    name,
    status,
    favorite: id === '@traefik' || id === '@serviceadmin',
    role: `${name} role`,
    note:
      status === 'running' || status === 'available'
        ? `${name} is verified by the runtime API.`
        : `${name} is not running.`,
    installed: true,
    links: [{ label: 'Local', url: 'http://127.0.0.1', kind: 'local' }],
    runtimeHealth: {
      state: status,
      health:
        status === 'running' || status === 'available' ? 'healthy' : 'critical',
      uptime: status === 'running' ? '3m' : '0m',
      lastCheckAt: '2026-04-16T16:00:03.000Z',
      lastRestartAt:
        status === 'running' ? '2026-04-16T16:00:00.000Z' : undefined,
      summary:
        status === 'running' || status === 'available'
          ? `${name} process and health check are up.`
          : `${name} process is stopped.`,
    },
    endpoints: [
      {
        label: 'Local',
        url: 'http://127.0.0.1',
        bind: '127.0.0.1',
        port: 8080,
        protocol: 'http',
        exposure: 'local',
      },
    ],
    metadata: {
      serviceType: 'core',
      runtime: 'service-lasso',
      version: '2026.4.16-test',
      build: 'test-build',
      logPath: `C:\\runtime\\${id}.log`,
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [
      {
        key: 'SERVICE_LASSO_ROOT',
        value: 'C:\\service-lasso',
        scope: 'global',
        source: '.env',
      },
    ],
    recentLogs: recentLogs.map((message) => ({
      timestamp: '2026-04-16T16:00:01.001Z',
      level: 'info',
      source: 'app',
      message,
    })),
    actions: [
      { id: 'start', label: 'Start', kind: 'start' },
      { id: 'stop', label: 'Stop', kind: 'stop' },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
    ],
  }
}

function summary(services: DashboardService[]): DashboardSummary {
  const favorites = services.filter((item) => item.favorite)
  const others = services.filter((item) => !item.favorite)
  const problemServices = services.filter(
    (item) => item.status !== 'running' && item.status !== 'available'
  )

  return {
    runtime: {
      status: problemServices.length === 0 ? 'healthy' : 'warning',
      lastReloadedAt: '2026-04-16T16:00:03.000Z',
      warningCount: problemServices.length,
    },
    servicesTotal: services.length,
    servicesRunning: services.filter((item) => item.status === 'running')
      .length,
    servicesAvailable: services.filter((item) => item.status === 'available')
      .length,
    servicesStopped: services.filter((item) => item.status === 'stopped')
      .length,
    servicesDegraded: services.filter((item) => item.status === 'degraded')
      .length,
    networkExposureCount: services.length,
    installedCount: services.length,
    favorites,
    others,
    warnings: problemServices.map((item) => `${item.name} is not healthy.`),
    problemServices,
  }
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('service lasso dashboard runtime client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('uses live runtime dashboard status instead of stub service status', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const services = [
      service('@traefik', 'Traefik', 'stopped', [
        'Traefik process is not currently running.',
      ]),
      service('@serviceadmin', 'Service Admin', 'running', [
        'Service Admin UI process is serving requests.',
      ]),
      service('service-broker', 'Service Broker', 'running', [
        'Service Broker API process is accepting requests.',
      ]),
    ]

    const fetchMock = vi.fn(async (url: string) => {
      if (url === 'http://runtime.test/api/dashboard') {
        return jsonResponse({ summary: summary(services) })
      }

      if (url === 'http://runtime.test/api/dashboard/services') {
        return jsonResponse({ services })
      }

      if (url === 'http://runtime.test/api/dashboard/services/%40traefik') {
        return jsonResponse({ service: services[0] })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const {
      buildServiceLogUrl,
      fetchDashboardService,
      fetchDashboardSummary,
      fetchServices,
    } = await import('./client')

    const runtimeSummary = await fetchDashboardSummary()
    const runtimeServices = await fetchServices()
    const traefik = await fetchDashboardService('@traefik')

    expect(runtimeSummary.servicesRunning).toBe(2)
    expect(runtimeSummary.servicesStopped).toBe(1)
    expect(runtimeSummary.problemServices.map((item) => item.id)).toEqual([
      '@traefik',
    ])
    expect(runtimeServices.map((item) => [item.id, item.status])).toEqual([
      ['@traefik', 'stopped'],
      ['@serviceadmin', 'running'],
      ['service-broker', 'running'],
    ])
    expect(traefik?.runtimeHealth.health).toBe('critical')
    expect(buildServiceLogUrl('@traefik')).toBe(
      'http://runtime.test/api/logs/read?service=%40traefik&type=default'
    )
  })

  it('uses the runtime service telemetry route for service-scoped telemetry previews', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const telemetry = {
      serviceId: '@secretsbroker',
      signals: [
        {
          kind: 'span',
          name: 'service_lasso.service.lifecycle',
          traceId: 'f2d1412190c7ec276ca474894c82eb27',
          spanId: '5a2ae73908a7986d',
          traceparent:
            '00-f2d1412190c7ec276ca474894c82eb27-5a2ae73908a7986d-01',
          correlationId: 'sl-85a59ffe07646ec3',
          attributes: {
            'service.id': '@secretsbroker',
            'service.version': '2026.6.26-test',
            'service.operation.outcome': 'healthy',
          },
        },
      ],
    }

    const fetchMock = vi.fn(async (url: string) => {
      if (
        url === 'http://runtime.test/api/services/%40secretsbroker/telemetry'
      ) {
        return jsonResponse({ telemetry })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const { fetchServiceTelemetryPreview } = await import('./client')

    await expect(
      fetchServiceTelemetryPreview('@secretsbroker')
    ).resolves.toEqual(telemetry)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://runtime.test/api/services/%40secretsbroker/telemetry',
      undefined
    )
  })

  it('uses same-origin runtime API by default instead of dashboard stubs', async () => {
    const services = [service('@archive', 'Archive Runtime', 'available')]
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/dashboard') {
        return jsonResponse({ summary: summary(services) })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const { fetchDashboardSummary } = await import('./client')

    const runtimeSummary = await fetchDashboardSummary()

    expect(runtimeSummary.servicesTotal).toBe(1)
    expect(runtimeSummary.servicesAvailable).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/dashboard', undefined)
  })

  it('uses dashboard stubs only when the explicit dev flag is enabled', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'true')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { fetchDashboardSummary } = await import('./client')

    const runtimeSummary = await fetchDashboardSummary()

    expect(runtimeSummary.servicesTotal).toBe(4)
    expect(runtimeSummary.problemServices.map((item) => item.id)).toEqual([
      'zitadel',
      'dagu',
    ])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('runs bulk start through the runtime action API before refreshing dashboard status', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const stoppedServices = [
      service('@traefik', 'Traefik', 'stopped'),
      service('@serviceadmin', 'Service Admin', 'running'),
      service('service-broker', 'Service Broker', 'running'),
    ]
    const runningServices = stoppedServices.map((item) => ({
      ...item,
      status: 'running' as const,
      runtimeHealth: {
        ...item.runtimeHealth,
        state: 'running' as const,
        health: 'healthy' as const,
      },
    }))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          action: 'startAll',
          ok: true,
          results: [],
          skipped: [],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ summary: summary(runningServices) })
      )

    vi.stubGlobal('fetch', fetchMock)

    const { runDashboardAction } = await import('./client')

    const runtimeSummary = await runDashboardAction('start-services')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://runtime.test/api/runtime/actions/startAll',
      { method: 'POST' }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://runtime.test/api/dashboard',
      undefined
    )
    expect(runtimeSummary.servicesRunning).toBe(3)
    expect(runtimeSummary.problemServices).toEqual([])
  })

  it('reloads runtime through the runtime action API before refreshing dashboard status', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const warningServices = [
      service('@traefik', 'Traefik', 'stopped'),
      service('@serviceadmin', 'Service Admin', 'running'),
    ]
    const healthyServices = warningServices.map((item) => ({
      ...item,
      status: 'running' as const,
      runtimeHealth: {
        ...item.runtimeHealth,
        state: 'running' as const,
        health: 'healthy' as const,
      },
    }))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          action: 'reload',
          ok: true,
          results: [],
          skipped: [],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ summary: summary(healthyServices) })
      )

    vi.stubGlobal('fetch', fetchMock)

    const { runDashboardAction } = await import('./client')

    const runtimeSummary = await runDashboardAction('reload-runtime')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://runtime.test/api/runtime/actions/reload',
      { method: 'POST' }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://runtime.test/api/dashboard',
      undefined
    )
    expect(runtimeSummary.runtime.status).toBe('healthy')
    expect(runtimeSummary.problemServices).toEqual([])
  })

  it('surfaces runtime API error details from failed reload responses', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          detail: 'Reload blocked because @nginx has invalid health config.',
        },
        { status: 409 }
      )
    )

    vi.stubGlobal('fetch', fetchMock)

    const { runDashboardAction } = await import('./client')

    await expect(runDashboardAction('reload-runtime')).rejects.toThrow(
      'Service Lasso runtime API returned 409: Reload blocked because @nginx has invalid health config.'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('runs stop-all and restart-all through runtime orchestration endpoints', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const runningServices = [
      service('@traefik', 'Traefik', 'running'),
      service('@serviceadmin', 'Service Admin', 'running'),
      service('service-broker', 'Service Broker', 'running'),
    ]
    const stoppedServices = runningServices.map((item) => ({
      ...item,
      status: 'stopped' as const,
      runtimeHealth: {
        ...item.runtimeHealth,
        state: 'stopped' as const,
        health: 'critical' as const,
      },
    }))

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          action: 'stopAll',
          ok: true,
          results: [],
          skipped: [],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ summary: summary(stoppedServices) })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          action: 'stopAll',
          ok: true,
          results: [],
          skipped: [],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          action: 'startAll',
          ok: true,
          results: [],
          skipped: [],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ summary: summary(runningServices) })
      )

    vi.stubGlobal('fetch', fetchMock)

    const { runDashboardAction } = await import('./client')

    const stoppedSummary = await runDashboardAction('stop-services')
    const restartedSummary = await runDashboardAction('restart-services')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://runtime.test/api/runtime/actions/stopAll',
      { method: 'POST' }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://runtime.test/api/runtime/actions/stopAll',
      { method: 'POST' }
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'http://runtime.test/api/runtime/actions/startAll',
      { method: 'POST' }
    )
    expect(stoppedSummary.servicesStopped).toBe(3)
    expect(restartedSummary.servicesRunning).toBe(3)
  })

  it('runs per-service lifecycle actions through service runtime endpoints', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const services = [
      service('@traefik', 'Traefik', 'running'),
      service('@serviceadmin', 'Service Admin', 'running'),
      service('service-broker', 'Service Broker', 'running'),
    ]

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          action: 'restart',
          serviceId: '@traefik',
          ok: true,
        })
      )
      .mockResolvedValueOnce(jsonResponse({ summary: summary(services) }))

    vi.stubGlobal('fetch', fetchMock)

    const { runDashboardAction } = await import('./client')

    const runtimeSummary = await runDashboardAction({
      kind: 'service-lifecycle',
      serviceId: '@traefik',
      action: 'restart',
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://runtime.test/api/services/%40traefik/restart',
      { method: 'POST' }
    )
    expect(runtimeSummary.servicesRunning).toBe(3)
  })
})
