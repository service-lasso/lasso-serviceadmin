import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import { ServiceRunStatusCards } from './service-run-status-cards'

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
      pid: 18821,
      runId: '2026-08-19T11-18-14-669Z',
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

describe('ServiceRunStatusCards', () => {
  it('renders State, Started, PID, and Run from structured dashboard fields', () => {
    render(<ServiceRunStatusCards service={service()} />)

    const strip = screen.getByTestId('service-detail-overview-run-status')

    expect(within(strip).getByText('State')).toBeVisible()
    expect(within(strip).getByText('running')).toBeVisible()
    expect(within(strip).getByText('Started')).toBeVisible()
    expect(within(strip).getByText('2026-08-19T11:18:14.669Z')).toBeVisible()
    expect(within(strip).getByText('PID')).toBeVisible()
    expect(within(strip).getByText('18821')).toBeVisible()
    expect(within(strip).getByText('Run')).toBeVisible()
    expect(within(strip).getByText('2026-08-19T11-18-14-669Z')).toBeVisible()
    expect(within(strip).queryByText('Not recorded')).not.toBeInTheDocument()
  })

  it('fills PID from metrics when dashboard health prose has no pid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url, 'http://localhost')

        if (parsed.pathname === '/api/services/node-sample-service/metrics') {
          return new Response(
            JSON.stringify({
              metrics: { process: { pid: 4242 } },
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
              logs: { runId: 'node-sample-run-1' },
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

    render(
      <ServiceRunStatusCards
        service={service({
          runtimeHealth: {
            state: 'running',
            health: 'healthy',
            uptime: '3m',
            lastCheckAt: '2026-08-19T11:18:14.669Z',
            lastRestartAt: '2026-08-19T11:18:14.669Z',
            summary: 'All required healthchecks passed.',
          },
        })}
      />
    )

    await waitFor(() => {
      expect(
        within(
          screen.getByTestId('service-detail-overview-run-status')
        ).getByText('4242')
      ).toBeVisible()
    })

    expect(screen.getByText('node-sample-run-1')).toBeVisible()
  })
})
