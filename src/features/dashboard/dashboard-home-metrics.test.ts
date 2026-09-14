import { describe, expect, it } from 'vitest'
import type {
  DashboardService,
  DashboardSummary,
  FleetServiceMetrics,
} from '@/lib/service-lasso-dashboard/types'
import {
  deriveFleetMix,
  deriveGenerationLane,
  deriveLogVolume,
  deriveProblemRows,
  deriveTraefikStrip,
  formatFleetMixDescription,
  formatInboxUnread,
  formatListenPortSummary,
  formatOperatorInstant,
  sanitizeHomeDisplayText,
  uniqueListenPorts,
  withheldHomeText,
} from './dashboard-home-metrics'

function service(overrides: Partial<DashboardService> = {}): DashboardService {
  return {
    id: 'echo-service',
    name: 'Echo Service',
    status: 'running',
    favorite: false,
    note: 'ready',
    links: [{ label: 'Docs', url: 'https://example.test/docs', kind: 'docs' }],
    installed: true,
    role: 'sample',
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '1m',
      lastCheckAt: '2026-08-19T10:26:00.000Z',
      lastRestartAt: '2026-08-19T09:54:00.000Z',
      summary: 'ready',
    },
    endpoints: [
      {
        label: 'Local API',
        url: 'http://127.0.0.1:4010',
        bind: '127.0.0.1',
        port: 4010,
        protocol: 'http',
        exposure: 'local',
      },
      {
        label: 'Docs',
        url: 'https://example.test/docs',
        bind: '127.0.0.1',
        port: 4010,
        protocol: 'https',
        exposure: 'public',
      },
    ],
    metadata: {
      serviceType: 'app',
      runtime: 'direct',
      version: '0.1.0',
      build: 'test',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [],
    recentLogs: [],
    actions: [],
    ...overrides,
  }
}

function summaryWith(services: DashboardService[]): DashboardSummary {
  return {
    runtime: {
      status: 'warning',
      lastReloadedAt: '2026-08-19T10:26:00.000Z',
      warningCount: 1,
    },
    servicesTotal: services.length,
    servicesRunning: services.filter((entry) => entry.status === 'running')
      .length,
    servicesAvailable: services.filter((entry) => entry.status === 'available')
      .length,
    servicesStopped: services.filter((entry) => entry.status === 'stopped')
      .length,
    servicesDegraded: services.filter((entry) => entry.status === 'degraded')
      .length,
    networkExposureCount: 36,
    installedCount: services.filter((entry) => entry.installed).length,
    favorites: [],
    others: services,
    warnings: [],
    problemServices: services.filter(
      (entry) => entry.status === 'stopped' || entry.status === 'degraded'
    ),
  }
}

describe('dashboard home metrics', () => {
  it('collapses duplicate binds and ignores docs links for listen ports', () => {
    const ports = uniqueListenPorts([
      service(),
      service({
        id: 'echo-lan',
        endpoints: [
          {
            label: 'LAN API',
            url: 'http://192.168.1.10:4010',
            bind: '0.0.0.0',
            port: 4010,
            protocol: 'http',
            exposure: 'lan',
          },
        ],
      }),
    ])

    expect(ports).toEqual([
      {
        port: 4010,
        bind: '127.0.0.1',
        serviceId: 'echo-service',
        serviceName: 'Echo Service',
      },
    ])
    expect(formatListenPortSummary(ports)).toBe('4010')
  })

  it('splits crashed stopped services out of the stopped count', () => {
    const mix = deriveFleetMix(
      summaryWith([
        service(),
        service({ id: '@node', name: 'Node', status: 'available' }),
        service({
          id: '@serviceadmin',
          name: 'Service Admin',
          status: 'stopped',
        }),
      ]),
      [
        {
          serviceId: '@serviceadmin',
          running: false,
          crashCount: 1,
          lastTermination: 'crashed',
          stdoutLines: 1,
          stderrLines: 0,
        },
      ]
    )

    expect(mix).toEqual({
      running: 1,
      available: 1,
      stopped: 0,
      degraded: 0,
      crashed: 1,
      total: 3,
    })
    expect(formatFleetMixDescription(mix)).toBe(
      '1 available, 0 stopped, 0 degraded, 1 crashed'
    )
  })

  it('shows named failure note, last start, and not-installed', () => {
    const rows = deriveProblemRows(
      summaryWith([
        service({
          id: 'node-sample-service',
          name: 'node-sample-service',
          status: 'stopped',
          note: 'never started',
          installed: false,
          runtimeHealth: {
            state: 'stopped',
            health: 'critical',
            uptime: '0m',
            lastCheckAt: '2026-08-19T10:26:00.000Z',
            summary: 'missing',
          },
        }),
      ]),
      null
    )

    expect(rows).toEqual([
      {
        id: 'node-sample-service',
        name: 'node-sample-service',
        status: 'stopped',
        note: 'never started',
        lastStart: null,
        installed: false,
        crashed: false,
      },
    ])
    expect(formatOperatorInstant('2026-08-19T09:54:00.000Z')).toBe(
      '2026-08-19 09:54 UTC'
    )
  })

  it('counts Traefik live backends from other running listens', () => {
    const strip = deriveTraefikStrip(
      summaryWith([
        service({
          id: '@traefik',
          name: 'Traefik',
          endpoints: [
            {
              label: 'Web',
              url: 'http://127.0.0.1:19080',
              bind: '0.0.0.0',
              port: 19080,
              protocol: 'http',
              exposure: 'local',
            },
          ],
        }),
        service({ id: '@secretsbroker', name: 'Secrets Broker' }),
      ]),
      [
        {
          serviceId: '@traefik',
          label: 'reserved CMS',
          port: 18443,
          bind: '0.0.0.0',
          kind: 'https',
        },
      ]
    )

    expect(strip.status).toBe('running')
    expect(strip.entrypoints).toEqual([19080])
    expect(strip.liveBackendCount).toBe(1)
    expect(strip.reservedEmptyCount).toBe(1)
  })

  it('treats stderr line counts as volume, not an app error', () => {
    const metrics: FleetServiceMetrics[] = [
      {
        serviceId: '@secretsbroker',
        running: true,
        crashCount: 0,
        lastTermination: null,
        stdoutLines: 0,
        stderrLines: 12,
      },
    ]

    expect(deriveLogVolume(metrics)).toEqual({
      available: true,
      stdoutLines: 0,
      stderrLines: 12,
      servicesWithStderr: 1,
    })
    expect(formatInboxUnread(null)).toBe('—')
    expect(formatInboxUnread(0)).toBe('0')
    expect(formatInboxUnread(23)).toBe('23')
  })

  it('returns zeros for an empty fleet', () => {
    const mix = deriveFleetMix(summaryWith([]), [])

    expect(mix).toEqual({
      running: 0,
      available: 0,
      stopped: 0,
      degraded: 0,
      crashed: 0,
      total: 0,
    })
    expect(uniqueListenPorts([])).toEqual([])
    expect(deriveProblemRows(summaryWith([]), [])).toEqual([])
  })

  it('keeps an all-running fleet free of crashed and stopped counts', () => {
    const mix = deriveFleetMix(
      summaryWith([service(), service({ id: '@traefik', name: 'Traefik' })]),
      [
        {
          serviceId: 'echo-service',
          running: true,
          crashCount: 0,
          lastTermination: null,
          stdoutLines: 2,
          stderrLines: 0,
        },
        {
          serviceId: '@traefik',
          running: true,
          crashCount: 0,
          lastTermination: null,
          stdoutLines: 1,
          stderrLines: 0,
        },
      ]
    )

    expect(mix).toEqual({
      running: 2,
      available: 0,
      stopped: 0,
      degraded: 0,
      crashed: 0,
      total: 2,
    })
    expect(deriveProblemRows(summaryWith([service()]), null)).toEqual([])
  })

  it('splits mixed crashed and cleanly stopped services', () => {
    const mix = deriveFleetMix(
      summaryWith([
        service(),
        service({
          id: '@serviceadmin',
          name: 'Service Admin',
          status: 'stopped',
        }),
        service({ id: 'node-sample', name: 'Node sample', status: 'stopped' }),
      ]),
      [
        {
          serviceId: '@serviceadmin',
          running: false,
          crashCount: 1,
          lastTermination: 'crashed',
          stdoutLines: 1,
          stderrLines: 4,
        },
        {
          serviceId: 'node-sample',
          running: false,
          crashCount: 0,
          lastTermination: 'stopped',
          stdoutLines: 0,
          stderrLines: 0,
        },
      ]
    )

    expect(mix).toEqual({
      running: 1,
      available: 0,
      stopped: 1,
      degraded: 0,
      crashed: 1,
      total: 3,
    })
  })

  it('marks Traefik missing when the service is absent', () => {
    const strip = deriveTraefikStrip(summaryWith([service()]), [])

    expect(strip).toEqual({
      available: false,
      status: 'missing',
      entrypoints: [],
      liveBackendCount: 0,
      reservedEmptyCount: 0,
    })
  })

  it('treats unavailable metrics as unknown crash and log volume, not zeros that look proven', () => {
    const mix = deriveFleetMix(
      summaryWith([
        service({
          id: '@serviceadmin',
          name: 'Service Admin',
          status: 'stopped',
        }),
      ]),
      null
    )

    expect(mix.stopped).toBe(1)
    expect(mix.crashed).toBe(0)
    expect(deriveLogVolume(null)).toEqual({
      available: false,
      stdoutLines: 0,
      stderrLines: 0,
      servicesWithStderr: 0,
    })
  })

  it('withholds secret-looking notes and filesystem paths', () => {
    expect(sanitizeHomeDisplayText('process-ready failed')).toBe(
      'process-ready failed'
    )
    expect(sanitizeHomeDisplayText('password=hunter2-home-sentinel')).toBe(
      withheldHomeText
    )
    expect(
      sanitizeHomeDisplayText('missing install at C:\\service-lasso\\app')
    ).toBe(withheldHomeText)
    expect(
      deriveProblemRows(
        summaryWith([
          service({
            id: 'leaky',
            name: 'Leaky',
            status: 'stopped',
            note: 'token=abcd.efgh.ijkl-unsafe',
            installed: false,
          }),
        ]),
        null
      )[0]?.note
    ).toBe(withheldHomeText)
  })

  it('keeps fleet mix counts after a refresh of the same snapshot', () => {
    const snapshot = summaryWith([
      service(),
      service({ id: '@node', name: 'Node', status: 'available' }),
      service({
        id: '@serviceadmin',
        name: 'Service Admin',
        status: 'stopped',
      }),
    ])
    const metrics: FleetServiceMetrics[] = [
      {
        serviceId: '@serviceadmin',
        running: false,
        crashCount: 1,
        lastTermination: 'crashed',
        stdoutLines: 1,
        stderrLines: 0,
      },
    ]
    const first = deriveFleetMix(snapshot, metrics)
    const refreshed = deriveFleetMix(
      structuredClone(snapshot),
      structuredClone(metrics)
    )

    expect(refreshed).toEqual(first)
    expect(deriveGenerationLane(null).available).toBe(false)
  })
})
