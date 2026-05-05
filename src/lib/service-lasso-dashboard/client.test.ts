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
      status === 'running'
        ? `${name} is verified by the runtime API.`
        : `${name} is not running.`,
    installed: true,
    links: [{ label: 'Local', url: 'http://127.0.0.1', kind: 'local' }],
    runtimeHealth: {
      state: status,
      health: status === 'running' ? 'healthy' : 'critical',
      uptime: status === 'running' ? '3m' : '0m',
      lastCheckAt: '2026-04-16T16:00:03.000Z',
      lastRestartAt:
        status === 'running' ? '2026-04-16T16:00:00.000Z' : undefined,
      summary:
        status === 'running'
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
  const problemServices = services.filter((item) => item.status !== 'running')

  return {
    runtime: {
      status: problemServices.length === 0 ? 'healthy' : 'warning',
      lastReloadedAt: '2026-04-16T16:00:03.000Z',
      warningCount: problemServices.length,
    },
    servicesTotal: services.length,
    servicesRunning: services.filter((item) => item.status === 'running')
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

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
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
