import { renderRoute } from '@/test/render-route'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetStubServicesForTest,
  __setStubServicesForTest,
} from '@/lib/service-lasso-dashboard/stub'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import { buildMetadataTableRows } from './metadata-table'

vi.mock('@/lib/service-lasso-dashboard/client', async () => {
  const stub = await vi.importActual<
    typeof import('@/lib/service-lasso-dashboard/stub')
  >('@/lib/service-lasso-dashboard/stub')

  return {
    buildServiceLogUrl: stub.buildStubServiceLogUrl,
    fetchDashboardService: stub.fetchDashboardService,
    fetchDashboardSummary: stub.fetchDashboardSummary,
    fetchServiceConfigDocument: stub.fetchServiceConfigDocument,
    fetchServices: stub.fetchServices,
    runDashboardAction: stub.runDashboardAction,
    saveServiceConfigDocument: stub.saveServiceConfigDocument,
    serviceLassoApiBaseUrl: stub.serviceLassoApiBaseUrl,
  }
})

vi.mock('@monaco-editor/react', () => ({
  DiffEditor: ({
    original,
    modified,
  }: {
    original?: string
    modified?: string
  }) => (
    <div aria-label='server.json backup diff editor' role='region'>
      <pre data-testid='server-json-diff-original'>{original ?? ''}</pre>
      <pre data-testid='server-json-diff-modified'>{modified ?? ''}</pre>
    </div>
  ),
  default: ({
    value,
    onChange,
  }: {
    value?: string
    onChange?: (value?: string) => void
  }) => (
    <textarea
      aria-label='server.json editor'
      value={value ?? ''}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
  ),
}))

afterEach(() => {
  __resetStubServicesForTest()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function buildNodeSampleService(): DashboardService {
  return {
    id: 'node-sample-service',
    name: 'Node Sample Service',
    status: 'running',
    favorite: false,
    role: 'Canonical terminal and logs validation target',
    note: 'Managed process is running with pid 4242.',
    installed: true,
    links: [{ label: 'Local', url: 'http://127.0.0.1:4020', kind: 'local' }],
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '3m',
      lastCheckAt: '2026-07-02T08:25:00Z',
      lastRestartAt: '2026-07-02T08:22:00Z',
      summary: 'Runtime process pid 4242 is healthy.',
    },
    endpoints: [
      {
        label: 'Local HTTP',
        url: 'http://127.0.0.1:4020',
        bind: '127.0.0.1',
        port: 4020,
        protocol: 'http',
        exposure: 'local',
      },
    ],
    metadata: {
      serviceType: 'sample',
      runtime: 'node',
      version: 'demo',
      build: 'local',
      packageId: '@service-lasso/node-sample-service',
      installPath:
        'C:\\projects\\service-lasso\\service-lasso\\services\\node-sample-service',
      configPath:
        'C:\\projects\\service-lasso\\service-lasso\\services\\node-sample-service\\service.json',
      logPath: 'C:\\runtime\\node-sample-service\\service.log',
      workPath:
        'C:\\projects\\service-lasso\\service-lasso\\services\\node-sample-service',
      profile: 'canonical-demo',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [],
    recentLogs: [
      {
        timestamp: '2026-07-02T08:22:00Z',
        level: 'info',
        source: 'stdout',
        message: 'node-sample-service starting',
      },
    ],
    actions: [
      { id: 'start', label: 'Start service', kind: 'start' },
      { id: 'stop', label: 'Stop service', kind: 'stop' },
      { id: 'restart', label: 'Restart service', kind: 'restart' },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
    ],
  }
}

describe('service detail overview metadata table', () => {
  it('renders runtime metadata under the overview summary without a duplicate metadata tab', async () => {
    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    expect(screen.queryByRole('tab', { name: /metadata/i })).toBeNull()

    const metadataRegion = screen.getByTestId(
      'service-detail-overview-metadata'
    )
    const metadataTable = within(metadataRegion).getByTestId(
      'service-detail-metadata-table'
    )

    expect(within(metadataRegion).getByText('Metadata')).toBeVisible()
    expect(
      within(metadataTable).getByRole('columnheader', { name: 'Key' })
    ).toBeVisible()
    expect(within(metadataTable).getByText('Package')).toBeVisible()
    expect(within(metadataTable).getByText('lasso-@serviceadmin')).toBeVisible()
    expect(within(metadataTable).getByText('Install path')).toBeVisible()
    expect(
      within(metadataTable).getAllByText(
        'C:\\projects\\service-lasso\\lasso-@serviceadmin'
      )[0]
    ).toBeVisible()
  })

  it('keeps full metadata values available for wrapped or truncated table cells', async () => {
    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    const metadataTable = screen.getByTestId('service-detail-metadata-table')
    const configPathCell = within(metadataTable).getByText(
      'C:\\projects\\service-lasso\\lasso-@serviceadmin\\vite.config.ts'
    )

    expect(configPathCell).toHaveAttribute(
      'title',
      'C:\\projects\\service-lasso\\lasso-@serviceadmin\\vite.config.ts'
    )
  })

  it('omits empty metadata fields for a compact empty state', () => {
    expect(
      buildMetadataTableRows({
        serviceType: 'app',
        runtime: 'node',
        version: '1.0.0',
        build: 'build-id',
      })
    ).toEqual([])
  })
})

describe('service detail quick actions', () => {
  it('keeps jump actions in the header and removes duplicate log-panel actions', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    const quickActions = within(
      screen.getByTestId('service-detail-quick-actions')
    )

    expect(
      quickActions.getByRole('link', { name: /open logs/i })
    ).toHaveAttribute('href', '/logs?service=%40serviceadmin')
    expect(
      quickActions.getByRole('link', { name: /open dependencies/i })
    ).toHaveAttribute('href', '/dependencies?service=%40serviceadmin')
    expect(
      quickActions.getByRole('link', { name: /open variables/i })
    ).toHaveAttribute('href', '/variables?service=%40serviceadmin')
    expect(
      quickActions.getByRole('link', { name: /open network/i })
    ).toHaveAttribute('href', '/network')
    expect(
      quickActions.getByRole('link', { name: /open runtime/i })
    ).toHaveAttribute('href', '/runtime?service=%40serviceadmin')
    expect(quickActions.queryByText(/^Logs$/i)).toBeNull()
    expect(quickActions.queryByText(/^Dependencies$/i)).toBeNull()
    expect(quickActions.queryByText(/^Variables$/i)).toBeNull()
    expect(quickActions.queryByText(/^Network$/i)).toBeNull()
    expect(quickActions.queryByText(/^Runtime$/i)).toBeNull()
    expect(
      quickActions.queryByRole('button', { name: /view full config json/i })
    ).toBeNull()

    await user.click(screen.getByRole('tab', { name: /logs/i }))

    const logsPanel = within(screen.getByRole('tabpanel'))

    expect(
      logsPanel.queryByRole('link', { name: /open live logs/i })
    ).toBeNull()
    expect(
      logsPanel.queryByRole('link', { name: /open dependencies/i })
    ).toBeNull()
    expect(
      logsPanel.queryByRole('link', { name: /open network view/i })
    ).toBeNull()
    expect(
      logsPanel.queryByRole('link', { name: /open runtime view/i })
    ).toBeNull()
    expect(screen.getByText('Diagnostics + recent logs')).toBeVisible()
  })

  it('links Node Sample Service details to the metadata-only secret journey', async () => {
    __setStubServicesForTest([buildNodeSampleService()])

    await renderRoute('/services/node-sample-service')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Node Sample Service$/i })
      ).toBeVisible()
    })

    const quickActions = within(
      screen.getByTestId('service-detail-quick-actions')
    )

    expect(
      quickActions.getByRole('link', { name: /open secret journey/i })
    ).toHaveAttribute(
      'href',
      '/secrets-broker#node-sample-secret-journey'
    )
  })

  it('keeps the Config tab focused on the server.json editor', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    await user.click(screen.getByRole('tab', { name: /config/i }))

    expect(screen.getByTestId('service-config-editor')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /view full config json/i })
    ).toBeNull()
    expect(screen.queryByText(/runtime safety/i)).toBeNull()
    expect(screen.queryByText(/resolved environment values/i)).toBeNull()
    expect(screen.queryByText(/provider credentials/i)).toBeNull()
    expect(screen.queryByText(/authorization headers/i)).toBeNull()
  })

  it('shows separate stdout and stderr run streams without leaking sensitive values', async () => {
    const user = userEvent.setup()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')
        const serviceId = parsed.searchParams.get('service') ?? '@serviceadmin'
        const type = parsed.searchParams.get('type') ?? 'default'

        if (parsed.pathname === '/api/services/log-info') {
          return new Response(
            JSON.stringify({
              serviceId,
              type,
              path: `C:\\runtime\\${serviceId}\\${type}.log`,
              availableTypes: ['default', 'stdout', 'stderr'],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (parsed.pathname === '/api/logs/read') {
          const lines =
            type === 'stderr'
              ? [
                  '2026-06-23T05:20:01Z ERROR startup password=hunter2',
                  '2026-06-23T05:20:02Z WARN retrying',
                ]
              : [
                  '2026-06-23T05:20:00Z INFO stdout server listening token=hidden-value',
                ]

          return new Response(
            JSON.stringify({
              serviceId,
              type,
              path: `C:\\runtime\\${serviceId}\\${type}.log`,
              totalLines: lines.length,
              start: 0,
              end: lines.length,
              hasMore: false,
              nextBefore: 0,
              limit: 80,
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

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    await user.click(screen.getByRole('tab', { name: /logs/i }))

    const streams = screen.getByTestId('service-detail-run-streams')

    await waitFor(() => {
      expect(within(streams).getByText('Stdout')).toBeVisible()
      expect(within(streams).getByText('Stderr')).toBeVisible()
    })

    expect(
      within(streams).getByTestId('service-detail-stdout-lines')
    ).toHaveTextContent(/stdout server listening/)
    expect(
      within(streams).getByTestId('service-detail-stderr-lines')
    ).toHaveTextContent(/ERROR startup/)
    expect(
      within(streams).getByTestId('service-detail-stdout-lines')
    ).toHaveTextContent(/token=\[redacted\]/)
    expect(
      within(streams).getByTestId('service-detail-stderr-lines')
    ).toHaveTextContent(/password=\[redacted\]/)
    expect(within(streams).queryByText(/hidden-value/)).not.toBeInTheDocument()
    expect(within(streams).queryByText(/hunter2/)).not.toBeInTheDocument()
  })

  it('shows runtime overview events when stdout and stderr stream files are empty', async () => {
    const user = userEvent.setup()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')
        const serviceId = parsed.searchParams.get('service') ?? '@serviceadmin'
        const type = parsed.searchParams.get('type') ?? 'default'

        if (parsed.pathname === '/api/services/log-info') {
          return new Response(
            JSON.stringify({
              serviceId,
              type,
              path: `C:\\runtime\\${serviceId}\\${type}.log`,
              available: true,
              availableTypes: ['default', 'stdout', 'stderr'],
              sources: [
                {
                  kind: 'current',
                  stream: 'stdout',
                  runId: 'run-1',
                  path: `C:\\runtime\\${serviceId}\\stdout.log`,
                  available: true,
                },
                {
                  kind: 'current',
                  stream: 'stderr',
                  runId: 'run-1',
                  path: `C:\\runtime\\${serviceId}\\stderr.log`,
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
          return new Response(
            JSON.stringify({
              serviceId,
              type,
              path: `C:\\runtime\\${serviceId}\\${type}.log`,
              available: true,
              totalLines: 0,
              start: 0,
              end: 0,
              hasMore: false,
              nextBefore: 0,
              limit: 80,
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
                runId: 'run-1',
                logPath: 'C:\\runtime\\@serviceadmin\\service.log',
                stdoutPath: 'C:\\runtime\\@serviceadmin\\stdout.log',
                stderrPath: 'C:\\runtime\\@serviceadmin\\stderr.log',
                entries: [
                  {
                    level: 'info',
                    message:
                      'serviceadmin:start token=review-secret should be redacted',
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

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    await user.click(screen.getByRole('tab', { name: /logs/i }))

    const overview = await screen.findByTestId('service-detail-log-overview')

    expect(within(overview).getByText('Runtime log overview')).toBeVisible()
    expect(within(overview).getByText('run-1')).toBeVisible()
    expect(within(overview).getByText(/serviceadmin:start/)).toBeVisible()
    expect(within(overview).getByText(/token=\[redacted\]/)).toBeVisible()
    expect(
      within(overview).queryByText(/review-secret/)
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByText(/No stdout entries are recorded/i).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/No stderr entries are recorded/i).length
    ).toBeGreaterThan(0)
  })

  it('renders the Terminal tab from safe stdout history without leaking values', async () => {
    const user = userEvent.setup()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')
        const serviceId = parsed.searchParams.get('service') ?? '@serviceadmin'

        if (parsed.pathname === '/api/services/log-info') {
          return new Response(
            JSON.stringify({
              serviceId,
              type: 'stdout',
              path: `C:\\runtime\\${serviceId}\\stdout.log`,
              available: true,
              availableTypes: ['default', 'stdout', 'stderr'],
              sources: [
                {
                  kind: 'current',
                  stream: 'stdout',
                  runId: 'run-2026-06-25T05-00-00Z',
                  path: `C:\\runtime\\${serviceId}\\stdout.log`,
                  available: true,
                },
              ],
              stdin: {
                available: false,
                reason: 'Provider does not expose stdin.',
              },
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
              type: 'stdout',
              path: `C:\\runtime\\${serviceId}\\stdout.log`,
              available: true,
              source: {
                kind: 'current',
                stream: 'stdout',
                runId: 'run-2026-06-25T05-00-00Z',
                path: `C:\\runtime\\${serviceId}\\stdout.log`,
                available: true,
              },
              totalLines: 2,
              start: 0,
              end: 2,
              hasMore: false,
              nextBefore: 0,
              cursor: '2',
              nextCursor: null,
              limit: 240,
              lines: [
                'service ready token=hidden-value',
                'listening on http://127.0.0.1:17700',
              ],
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

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    await user.click(screen.getByRole('tab', { name: /terminal/i }))

    const terminal = screen.getByTestId('service-detail-terminal-lines')
    const visibleTerminal = screen.getByTestId(
      'service-detail-terminal-visible-lines'
    )

    await waitFor(() => {
      expect(terminal).toHaveTextContent(/service ready/)
    })

    expect(visibleTerminal).toBeVisible()
    expect(visibleTerminal).toHaveTextContent(/service ready/)
    expect(visibleTerminal).toHaveTextContent(/listening on/)
    expect(visibleTerminal).toHaveTextContent(/token=\[redacted\]/)
    expect(visibleTerminal).not.toHaveTextContent(/hidden-value/)
    expect(terminal).toHaveTextContent(/token=\[redacted\]/)
    expect(terminal).not.toHaveTextContent(/hidden-value/)
    expect(screen.getByText('run-2026-06-25T05-00-00Z')).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: /terminal input/i })
    ).toBeDisabled()
    expect(screen.getByText(/Provider does not expose stdin/i)).toBeVisible()
  })

  it('validates Node Sample Service Terminal and Logs with safe stdout and stderr fixtures', async () => {
    const user = userEvent.setup()
    __setStubServicesForTest([buildNodeSampleService()])

    const stdoutLines = [
      'node-sample-service starting',
      'node-sample-service listening on 127.0.0.1:4020',
      'node-sample-service heartbeat count=1 uptimeMs=5000',
    ]
    const stderrLines = [
      'node-sample-service demo error message="canonical error"',
    ]

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const parsed = new URL(url, 'http://localhost')
      const serviceId =
        parsed.searchParams.get('service') ?? 'node-sample-service'
      const type = parsed.searchParams.get('type') ?? 'stdout'

      if (parsed.pathname === '/api/services/log-info') {
        return new Response(
          JSON.stringify({
            serviceId,
            type,
            path: `C:\\runtime\\node-sample-service\\${type}.log`,
            available: true,
            availableTypes: ['default', 'stdout', 'stderr'],
            sources: [
              {
                kind: 'current',
                stream: type,
                runId: 'node-sample-run-1',
                path: `C:\\runtime\\node-sample-service\\${type}.log`,
                available: true,
              },
            ],
            stdin: {
              available: true,
              provider: 'direct',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (parsed.pathname === '/api/logs/read') {
        const lines = type === 'stderr' ? stderrLines : stdoutLines

        return new Response(
          JSON.stringify({
            serviceId,
            type,
            path: `C:\\runtime\\node-sample-service\\${type}.log`,
            available: true,
            source: {
              kind: 'current',
              stream: type,
              runId: 'node-sample-run-1',
              path: `C:\\runtime\\node-sample-service\\${type}.log`,
              available: true,
            },
            totalLines: lines.length,
            start: 0,
            end: lines.length,
            hasMore: false,
            nextBefore: 0,
            cursor: String(lines.length),
            nextCursor: null,
            limit: Number(parsed.searchParams.get('limit') ?? '240'),
            lines,
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
              serviceId: 'node-sample-service',
              runId: 'node-sample-run-1',
              logPath: 'C:\\runtime\\node-sample-service\\service.log',
              stdoutPath: 'C:\\runtime\\node-sample-service\\stdout.log',
              stderrPath: 'C:\\runtime\\node-sample-service\\stderr.log',
              entries: [
                {
                  level: 'info',
                  message:
                    'node-sample-service demo log message="canonical normal"',
                },
                {
                  level: 'error',
                  message:
                    'node-sample-service demo error message="canonical error"',
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

      if (parsed.pathname === '/api/services/node-sample-service/stdin') {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toMatchObject({
          input: 'ping',
          stream: 'stdin',
          actor: 'service-admin-web',
        })
        stdoutLines.push('node-sample-service command pong')

        return new Response(
          JSON.stringify({
            serviceId: 'node-sample-service',
            accepted: true,
            auditId: 'node-sample-audit-1',
            message: 'Input accepted.',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      return new Response('not found', { status: 404 })
    })

    vi.stubGlobal('fetch', fetchMock)

    await renderRoute('/services/node-sample-service?tab=terminal')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Node Sample Service$/i })
      ).toBeVisible()
    })

    const visibleTerminal = await screen.findByTestId(
      'service-detail-terminal-visible-lines'
    )

    expect(visibleTerminal).toHaveTextContent(/node-sample-service starting/)
    expect(visibleTerminal).toHaveTextContent(/listening on 127\.0\.0\.1:4020/)
    expect(visibleTerminal).toHaveTextContent(/heartbeat count=1/)
    expect(screen.getByText('node-sample-run-1')).toBeVisible()

    const terminalInput = screen.getByRole('textbox', {
      name: /terminal input/i,
    })
    expect(terminalInput).toBeEnabled()

    await user.type(terminalInput, 'ping')
    await user.click(screen.getByRole('button', { name: /send input/i }))
    await screen.findByText('Input accepted.')
    await user.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => {
      expect(visibleTerminal).toHaveTextContent(/command pong/)
    })

    await user.click(screen.getByRole('tab', { name: /logs/i }))

    const streams = await screen.findByTestId('service-detail-run-streams')
    const overview = await screen.findByTestId('service-detail-log-overview')

    expect(within(overview).getByText('node-sample-run-1')).toBeVisible()
    expect(
      within(streams).getByTestId('service-detail-stdout-lines')
    ).toHaveTextContent(/demo log message="canonical normal"|command pong/)
    expect(
      within(streams).getByTestId('service-detail-stderr-lines')
    ).toHaveTextContent(/demo error message="canonical error"/)
    expect(
      screen.queryByText(/ACTUAL_SECRET|CLIENT_SECRET|PASSWORD=/)
    ).toBeNull()
  })

  it('keeps Terminal input disabled when the managed service is stopped', async () => {
    const user = userEvent.setup()

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')

        if (parsed.pathname === '/api/services/log-info') {
          return new Response(
            JSON.stringify({
              serviceId: 'dagu',
              type: 'stdout',
              path: 'C:\\runtime\\dagu\\stdout.log',
              available: true,
              availableTypes: ['default', 'stdout', 'stderr'],
              stdin: { available: true },
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
              serviceId: 'dagu',
              type: 'stdout',
              path: 'C:\\runtime\\dagu\\stdout.log',
              available: true,
              totalLines: 0,
              start: 0,
              end: 0,
              hasMore: false,
              nextBefore: 0,
              limit: 240,
              lines: [],
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

    await renderRoute('/services/dagu')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Dagu$/i })).toBeVisible()
    })

    await user.click(screen.getByRole('tab', { name: /terminal/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: /terminal input/i })
      ).toBeDisabled()
    })

    expect(screen.getByText(/managed process is not running/i)).toBeVisible()
  })

  it('sends Terminal input only through the managed stdin endpoint', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const parsed = new URL(url, 'http://localhost')
      const serviceId = parsed.searchParams.get('service') ?? '@serviceadmin'

      if (parsed.pathname === '/api/services/log-info') {
        return new Response(
          JSON.stringify({
            serviceId,
            type: 'stdout',
            path: `C:\\runtime\\${serviceId}\\stdout.log`,
            available: true,
            availableTypes: ['default', 'stdout', 'stderr'],
            stdin: {
              available: true,
              auditRequired: true,
              provider: 'direct',
            },
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
            type: 'stdout',
            path: `C:\\runtime\\${serviceId}\\stdout.log`,
            available: true,
            totalLines: 1,
            start: 0,
            end: 1,
            hasMore: false,
            nextBefore: 0,
            limit: 240,
            lines: ['interactive app ready'],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      if (
        parsed.pathname === '/api/services/%40serviceadmin/stdin' ||
        parsed.pathname === '/api/services/@serviceadmin/stdin'
      ) {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toMatchObject({
          input: 'status',
          stream: 'stdin',
          actor: 'service-admin-web',
        })

        return new Response(
          JSON.stringify({
            serviceId: '@serviceadmin',
            accepted: true,
            auditId: 'audit-1',
            message: 'Input accepted.',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      return new Response('not found', { status: 404 })
    })

    vi.stubGlobal('fetch', fetchMock)

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    await user.click(screen.getByRole('tab', { name: /terminal/i }))

    const terminalInput = await screen.findByRole('textbox', {
      name: /terminal input/i,
    })
    await user.type(terminalInput, 'status')
    await user.click(screen.getByRole('button', { name: /send input/i }))

    await waitFor(() => {
      expect(screen.getByText(/Input accepted/i)).toBeVisible()
    })

    expect(
      fetchMock.mock.calls.some(([url, init]) => {
        const parsed = new URL(String(url), 'http://localhost')
        return (
          parsed.pathname.endsWith('/stdin') &&
          init?.method === 'POST' &&
          String(init?.body).includes('"input":"status"')
        )
      })
    ).toBe(true)
  })
})

describe('service detail tab keyboard shortcuts', () => {
  it('opens a Service Details tab from the route search state', async () => {
    await renderRoute('/services/@serviceadmin?tab=variables')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    expect(screen.getByRole('tab', { name: /variables/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByText('VITE_SERVICE_LASSO_API_BASE_URL')).toBeVisible()
  })

  it('updates URL search state on tab changes and falls back from unknown tabs', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute('/services/@serviceadmin?tab=unknown')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    await user.click(screen.getByRole('tab', { name: /logs/i }))

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ tab: 'logs' })
    })

    await user.click(screen.getByRole('tab', { name: /overview/i }))

    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty('tab')
    })
  })

  it('uses Ctrl+1 through Ctrl+7 for the visible tab order', async () => {
    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    const shortcuts = [
      ['1', /overview/i],
      ['2', /dependencies/i],
      ['3', /endpoints/i],
      ['4', /variables/i],
      ['5', /config/i],
      ['6', /logs/i],
      ['7', /terminal/i],
    ] as const

    for (const [key, tabName] of shortcuts) {
      fireEvent.keyDown(document.body, { key, ctrlKey: true })
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: tabName })).toHaveAttribute(
          'aria-selected',
          'true'
        )
      })
    }

    expect(screen.getByRole('tab', { name: /overview.*\(1\)/i })).toBeVisible()
    expect(screen.getByRole('tab', { name: /logs.*\(6\)/i })).toBeVisible()
    expect(screen.getByRole('tab', { name: /terminal.*\(7\)/i })).toBeVisible()
    expect(
      screen.queryByRole('tab', { name: /overview.*ctrl\+1/i })
    ).not.toBeInTheDocument()
  })

  it('ignores unmodified number keys and Ctrl+number inside the config editor', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    fireEvent.keyDown(document.body, { key: '4' })
    expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    fireEvent.keyDown(document.body, { key: '5', ctrlKey: true })
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /config/i })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })

    const editor = await screen.findByRole('textbox', {
      name: /server\.json editor/i,
    })
    await user.click(editor)
    fireEvent.keyDown(editor, { key: '6', ctrlKey: true })

    expect(screen.getByRole('tab', { name: /config/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tab', { name: /logs/i })).toHaveAttribute(
      'aria-selected',
      'false'
    )
  })
})

describe('service detail server.json config editor', () => {
  it('loads server.json into the Config tab with backup metadata', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    await user.click(screen.getByRole('tab', { name: /config/i }))

    const editor = await screen.findByRole('textbox', {
      name: /server\.json editor/i,
    })

    await waitFor(() => {
      expect((editor as HTMLTextAreaElement).value).toContain(
        '"id": "@serviceadmin"'
      )
    })

    expect(screen.getByTestId('service-config-editor')).toBeVisible()
    expect(screen.getByText(/Valid JSON/i)).toBeVisible()
    expect(screen.getByText(/0 backups/i)).toBeVisible()
    expect(screen.getAllByText(/server\.json/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Runtime safety/i)).toBeNull()
    expect(screen.queryByText(/resolved environment values/i)).toBeNull()
    expect(screen.queryByText(/provider credentials/i)).toBeNull()
    expect(screen.queryByText(/authorization headers/i)).toBeNull()
  })

  it('blocks invalid JSON saves and dirty reloads until confirmed', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    await user.click(screen.getByRole('tab', { name: /config/i }))
    const editor = await screen.findByRole('textbox', {
      name: /server\.json editor/i,
    })

    await waitFor(() => {
      expect((editor as HTMLTextAreaElement).value).toContain(
        '"id": "@serviceadmin"'
      )
    })

    fireEvent.change(editor, { target: { value: '{bad-json' } })

    expect(screen.getByText(/Invalid JSON/i)).toBeVisible()
    expect(screen.getByRole('button', { name: /^Save$/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /^Reload$/i }))
    expect(
      screen.getByRole('dialog', {
        name: /Discard unsaved server\.json changes/i,
      })
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Keep editing/i }))
    expect(screen.getByText(/Invalid JSON/i)).toBeVisible()
  })

  it('saves valid JSON, records a backup, and compares the revision', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    await user.click(screen.getByRole('tab', { name: /config/i }))
    const editor = await screen.findByRole('textbox', {
      name: /server\.json editor/i,
    })

    await waitFor(() => {
      expect((editor as HTMLTextAreaElement).value).toContain(
        '"id": "@serviceadmin"'
      )
    })
    const nextConfig = JSON.stringify(
      {
        id: '@serviceadmin',
        name: 'Service Admin UI',
        description: 'Saved from config editor test',
        enabled: true,
      },
      null,
      2
    )

    fireEvent.change(editor, { target: { value: nextConfig } })
    await user.type(screen.getByLabelText(/Audit reason/i), 'test config save')
    await user.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/Saved server\.json and created a backup revision/i)
      ).toBeVisible()
    })

    expect(screen.getByText(/1 backups/i)).toBeVisible()
    expect(screen.getByText(/test config save/i)).toBeVisible()
    expect(screen.getAllByText(/Backup history/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Monaco diff editor/i)).toBeVisible()
    expect(
      screen.getByRole('region', { name: /server\.json backup diff editor/i })
    ).toBeVisible()
    expect(screen.getByText(/Modified: current editor buffer/i)).toBeVisible()
    expect(screen.getByTestId('server-json-diff-modified')).toHaveTextContent(
      /Saved from config editor test/i
    )
    expect(
      screen.queryByText(/config-backups\\server\.json/i)
    ).not.toBeInTheDocument()
  })
})

describe('service detail endpoints table', () => {
  it('renders actual endpoint URLs with open, copy, and route inventory actions', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    await user.click(screen.getByRole('tab', { name: /endpoints/i }))

    const localUrlCell = screen.getByText('http://localhost:17700')
    const localEndpointRow = localUrlCell.closest('tr')
    expect(localEndpointRow).not.toBeNull()
    const row = within(localEndpointRow as HTMLTableRowElement)

    expect(row.getByText('Local UI')).toBeVisible()
    expect(row.getByText('HTTP')).toBeVisible()
    expect(row.getByText('0.0.0.0')).toBeVisible()
    expect(row.getByText('17700')).toBeVisible()
    expect(row.getByText('local')).toBeVisible()
    expect(localUrlCell).toBeVisible()

    expect(
      row.getByRole('link', { name: 'Open Local UI endpoint' })
    ).toHaveAttribute('href', 'http://localhost:17700')

    await user.click(row.getByRole('button', { name: 'Copy Local UI URL' }))
    expect(writeText).toHaveBeenCalledWith('http://localhost:17700')

    expect(
      row.getByRole('link', { name: 'Open Local UI in route inventory' })
    ).toHaveAttribute(
      'href',
      expect.stringContaining('route=http%3A%2F%2Flocalhost%3A17700')
    )
  })
})
