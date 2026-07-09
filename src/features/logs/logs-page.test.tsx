import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'

function service(
  id: string,
  name: string,
  status: DashboardService['status'],
  overrides: Partial<DashboardService> = {}
): DashboardService {
  return {
    id,
    name,
    status,
    favorite: false,
    note: `${name} test service`,
    links: [],
    installed: true,
    role: 'runtime service',
    runtimeHealth: {
      state: status,
      health: status === 'running' ? 'healthy' : 'warning',
      uptime: '14m',
      lastCheckAt: '2026-06-18T07:25:00Z',
      summary: `${name} is available in test metadata.`,
    },
    endpoints: [],
    metadata: {
      serviceType: 'runtime',
      runtime: 'test',
      version: 'test',
      build: 'test',
      logPath: `/services/${id}/service.log`,
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [],
    recentLogs: [],
    actions: [{ id: 'open_logs', label: 'Open logs', kind: 'open_logs' }],
    ...overrides,
  }
}

const logPageServices = [
  service('@python', 'Python Provider', 'available', {
    role: 'provider',
    metadata: {
      serviceType: 'provider',
      runtime: 'package',
      version: '3.12',
      build: 'test',
    },
  }),
  service('@serviceadmin', 'Service Admin UI', 'running'),
  service('@traefik', 'Traefik', 'running'),
]

vi.mock('@/lib/service-lasso-dashboard/hooks', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/service-lasso-dashboard/hooks')
  >('@/lib/service-lasso-dashboard/hooks')

  return {
    ...actual,
    useServices: () => ({
      data: logPageServices,
      isLoading: false,
    }),
  }
})

describe('logs page operator states', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('explains an empty current log while still showing runtime overview entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')

        if (parsed.pathname === '/api/services/log-info') {
          return new Response(
            JSON.stringify({
              serviceId: '@serviceadmin',
              type: 'default',
              path: 'C:\\runtime\\@serviceadmin\\service.log',
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
              serviceId: '@serviceadmin',
              type: 'default',
              path: 'C:\\runtime\\@serviceadmin\\service.log',
              totalLines: 0,
              start: 0,
              end: 0,
              hasMore: false,
              nextBefore: 0,
              limit: 100,
              lines: [],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (parsed.pathname === '/api/services/%40serviceadmin/logs') {
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
                    message:
                      '@serviceadmin listening on http://0.0.0.0:17700 token=hidden-value',
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
        }

        return new Response('not found', { status: 404 })
      })
    )

    await renderRoute('/logs?service=@serviceadmin')

    await waitFor(() => {
      expect(screen.getByText('Runtime log overview')).toBeVisible()
    })

    expect(screen.getByText('No current log entries yet')).toBeVisible()
    expect(
      screen.getByText(/@serviceadmin listening on http:\/\/0\.0\.0\.0:17700/)
    ).toBeVisible()
    expect(screen.getByText(/token=\[redacted\]/)).toBeVisible()
  })

  it('exposes Logs actions from the services table', async () => {
    await renderRoute('/services')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Services' })).toBeVisible()
    })

    await waitFor(() => {
      expect(screen.getByText('Service Admin UI')).toBeVisible()
    })

    const logLinks = screen
      .getAllByRole('link', { name: /^Logs$/i })
      .map((link) => link.getAttribute('href'))

    expect(logLinks).toContain('/logs?service=%40serviceadmin')
  })

  it('keeps service selection usable when loaded from an encoded provider service URL', async () => {
    const user = userEvent.setup()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')
        const serviceId = parsed.searchParams.get('service') ?? ''

        if (parsed.pathname === '/api/services/log-info') {
          return new Response(
            JSON.stringify({
              serviceId,
              type: 'default',
              path: serviceId === '@python' ? null : `/logs/${serviceId}.log`,
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
              path: serviceId === '@python' ? null : `/logs/${serviceId}.log`,
              totalLines: serviceId === '@python' ? 0 : 1,
              start: 0,
              end: serviceId === '@python' ? 0 : 1,
              hasMore: false,
              nextBefore: 0,
              limit: 100,
              lines:
                serviceId === '@python'
                  ? []
                  : [
                      '2026-06-18T07:25:00Z INFO serviceadmin listening token=[redacted]',
                    ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (parsed.pathname.startsWith('/api/services/')) {
          const encodedServiceId = parsed.pathname
            .replace('/api/services/', '')
            .replace('/logs', '')
          const overviewServiceId = decodeURIComponent(encodedServiceId)

          return new Response(
            JSON.stringify({
              logs: {
                serviceId: overviewServiceId,
                logPath:
                  overviewServiceId === '@python'
                    ? undefined
                    : `/logs/${overviewServiceId}.log`,
                entries: [],
                archives: [],
                retention: { maxArchives: 3 },
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

    const { router } = await renderRoute('/logs?service=%40python')

    await waitFor(() => {
      expect(
        screen.getByText('Provider service has no daemon log entries')
      ).toBeVisible()
    })

    await user.click(screen.getByText('Service Admin UI'))

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        service: '@serviceadmin',
      })
    })

    expect(screen.getByText('@serviceadmin')).toBeVisible()

    await user.click(screen.getByText('Python Provider'))

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        service: '@python',
      })
    })

    expect(
      screen.getByText('Provider service has no daemon log entries')
    ).toBeVisible()
    expect(screen.queryByText(/token=hidden-value/i)).not.toBeInTheDocument()
  })

  it('uses runtime source tabs for all stdout stderr and additional log views', async () => {
    const user = userEvent.setup()
    const requestedTypes: string[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')
        const serviceId = parsed.searchParams.get('service') ?? ''
        const type = parsed.searchParams.get('type') ?? 'default'

        if (parsed.pathname === '/api/services/log-info') {
          return new Response(
            JSON.stringify({
              serviceId,
              type: 'default',
              path: 'C:\\runtime\\@serviceadmin\\service.log',
              available: true,
              availableTypes: ['default', 'stdout', 'stderr', 'access'],
              sources: [
                {
                  stream: 'stdout',
                  label: 'stdout',
                  runId: 'run-320',
                  path: 'C:\\runtime\\@serviceadmin\\stdout.log',
                  available: true,
                  cursor: 'stdout-cursor',
                  offset: 10,
                },
                {
                  stream: 'stderr',
                  label: 'stderr',
                  runId: 'run-320',
                  path: 'C:\\runtime\\@serviceadmin\\stderr.log',
                  available: true,
                },
                {
                  id: 'access',
                  label: 'Access log',
                  fileName: 'access.log',
                  path: 'C:\\runtime\\@serviceadmin\\access.log',
                  available: true,
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (parsed.pathname === '/api/logs/read') {
          requestedTypes.push(type)
          return new Response(
            JSON.stringify({
              serviceId,
              type,
              path: `C:\\runtime\\@serviceadmin\\${type}.log`,
              source: {
                stream: type,
                label: type === 'access' ? 'Access log' : type,
                runId: 'run-320',
              },
              totalLines: 1,
              start: 0,
              end: 1,
              hasMore: false,
              nextBefore: 0,
              limit: 100,
              lines: [
                type === 'default'
                  ? '2026-07-09T13:00:00Z stdout ready\n2026-07-09T13:00:01Z stderr warning'
                  : `2026-07-09T13:00:00Z ${type} source line`,
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (parsed.pathname === '/api/services/%40serviceadmin/logs') {
          return new Response(
            JSON.stringify({
              logs: {
                serviceId: '@serviceadmin',
                logPath: 'C:\\runtime\\@serviceadmin\\service.log',
                stdoutPath: 'C:\\runtime\\@serviceadmin\\stdout.log',
                stderrPath: 'C:\\runtime\\@serviceadmin\\stderr.log',
                entries: [],
                archives: [],
                retention: { maxArchives: 3 },
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

    const { router } = await renderRoute(
      '/logs?service=%40serviceadmin&source=stderr'
    )

    await waitFor(() => {
      expect(requestedTypes).toContain('stderr')
    })

    expect(screen.getByRole('tab', { name: 'All' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'stdout' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'stderr' })).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Access log' })).toBeVisible()
    expect(
      screen.getAllByText('C:\\runtime\\@serviceadmin\\stderr.log').length
    ).toBeGreaterThan(0)
    expect(screen.getByText('Run: run-320')).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'stdout' }))

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        service: '@serviceadmin',
        source: 'stdout',
      })
      expect(requestedTypes).toContain('stdout')
    })

    expect(screen.getByText('Cursor: stdout-cursor')).toBeVisible()
    expect(screen.getByText('Offset: 10')).toBeVisible()

    await user.click(screen.getByRole('tab', { name: 'Access log' }))

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        service: '@serviceadmin',
        source: 'access',
      })
      expect(requestedTypes).toContain('access')
    })
  })

  it('shows unavailable and failed log source states explicitly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')
        const serviceId = parsed.searchParams.get('service') ?? ''
        const type = parsed.searchParams.get('type') ?? 'default'

        if (parsed.pathname === '/api/services/log-info') {
          return new Response(
            JSON.stringify({
              serviceId,
              type: 'default',
              path: 'C:\\runtime\\@serviceadmin\\service.log',
              available: true,
              availableTypes: ['default', 'error'],
              sources: [
                {
                  id: 'error',
                  label: 'Error log',
                  path: null,
                  available: false,
                },
              ],
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
              type,
              path: null,
              available: type !== 'error',
              totalLines: 0,
              start: 0,
              end: 0,
              hasMore: false,
              nextBefore: 0,
              limit: 100,
              lines: [],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (parsed.pathname === '/api/services/%40serviceadmin/logs') {
          return new Response(
            JSON.stringify({
              logs: {
                serviceId: '@serviceadmin',
                logPath: 'C:\\runtime\\@serviceadmin\\service.log',
                entries: [],
                archives: [],
                retention: { maxArchives: 3 },
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

    await renderRoute('/logs?service=%40serviceadmin&source=error')

    await waitFor(() => {
      expect(
        screen.getByText('Selected log source is unavailable')
      ).toBeVisible()
    })
    expect(screen.getByText(/Selected source:/)).toBeVisible()
    expect(screen.getByRole('tab', { name: 'Error log' })).toBeVisible()

    vi.restoreAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')

        if (parsed.pathname === '/api/services/log-info') {
          return new Response(
            JSON.stringify({
              serviceId: '@serviceadmin',
              type: 'default',
              path: 'C:\\runtime\\@serviceadmin\\service.log',
              availableTypes: ['default'],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (parsed.pathname === '/api/logs/read') {
          return new Response('upstream unavailable', { status: 503 })
        }

        return new Response(
          JSON.stringify({
            logs: {
              serviceId: '@serviceadmin',
              entries: [],
              archives: [],
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      })
    )

    await renderRoute('/logs?service=%40serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByText('Unable to load log content right now.')
      ).toBeVisible()
    })
  })
})
