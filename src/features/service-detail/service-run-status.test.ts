import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import {
  extractPidFromHealthText,
  formatProcessId,
  readStructuredRunStatus,
  resolveServiceRunStatus,
} from './service-run-status'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function service(overrides: Partial<DashboardService> = {}): DashboardService {
  return {
    id: 'node-sample-service',
    name: 'Node Sample Service',
    status: 'running',
    favorite: false,
    note: 'All required healthchecks passed.',
    installed: true,
    links: [],
    role: 'sample',
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '3m',
      lastCheckAt: '2026-08-19T11:18:14.669Z',
      lastRestartAt: '2026-08-19T11:18:14.669Z',
      summary: 'All required healthchecks passed.',
    },
    endpoints: [],
    metadata: {
      serviceType: 'sample',
      runtime: 'node',
      version: 'demo',
      build: 'local',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [],
    recentLogs: [],
    actions: [],
    ...overrides,
  }
}

describe('service run status identity', () => {
  it('formats only positive integer pids', () => {
    expect(formatProcessId(4242)).toBe('4242')
    expect(formatProcessId(null)).toBeUndefined()
    expect(formatProcessId(0)).toBeUndefined()
    expect(formatProcessId(-1)).toBeUndefined()
    expect(formatProcessId(12.5)).toBeUndefined()
  })

  it('does not scrape pid from HTTP aggregate health prose', () => {
    expect(extractPidFromHealthText(service())).toBeUndefined()
  })

  it('reads structured dashboard pid and runId without scraping prose', () => {
    const fields = readStructuredRunStatus(
      service({
        runtimeHealth: {
          state: 'running',
          health: 'healthy',
          uptime: '3m',
          lastCheckAt: '2026-08-19T11:18:14.669Z',
          lastRestartAt: '2026-08-19T11:18:14.669Z',
          summary: 'All required healthchecks passed.',
          pid: 18821,
          runId: '2026-08-19T11-18-14-669Z',
        },
      })
    )

    expect(fields.state).toBe('running')
    expect(fields.started).toBe('2026-08-19T11:18:14.669Z')
    expect(fields.pid).toBe('18821')
    expect(fields.runId).toBe('2026-08-19T11-18-14-669Z')
  })

  it('loads pid from metrics when dashboard omitted the field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')

        if (parsed.pathname === '/api/services/node-sample-service/metrics') {
          return new Response(
            JSON.stringify({
              metrics: {
                process: {
                  running: true,
                  pid: 18821,
                },
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (parsed.pathname === '/api/services/node-sample-service/logs') {
          return new Response(
            JSON.stringify({
              logs: {
                runId: '2026-08-19T11-18-14-669Z',
              },
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

    const fields = await resolveServiceRunStatus(service())

    expect(fields.pid).toBe('18821')
    expect(fields.runId).toBe('2026-08-19T11-18-14-669Z')
  })

  it('leaves pid empty for a stopped service with no recorded process', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not found', { status: 404 }))
    )

    const fields = await resolveServiceRunStatus(
      service({
        status: 'stopped',
        runtimeHealth: {
          state: 'stopped',
          health: 'critical',
          uptime: '0m',
          lastCheckAt: '2026-08-19T12:00:00.000Z',
          lastRestartAt: '2026-08-19T11:18:14.669Z',
          summary: 'Service is not running.',
          pid: null,
          runId: null,
        },
      })
    )

    expect(fields.state).toBe('stopped')
    expect(fields.pid).toBeUndefined()
  })
})
