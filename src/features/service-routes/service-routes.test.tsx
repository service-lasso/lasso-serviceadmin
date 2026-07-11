import { expectActivePageIdentity } from '@/test/page-identity'
import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'

const routeService = (overrides: Partial<DashboardService>): DashboardService =>
  ({
    id: '@traefik',
    name: 'Traefik',
    status: 'running',
    favorite: true,
    note: 'Ingress is healthy.',
    installed: true,
    role: 'Edge router',
    links: [],
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '4d',
      lastCheckAt: '2026-06-12T05:00:00Z',
      summary: 'Healthy',
    },
    endpoints: [
      {
        label: 'Local dashboard',
        url: 'https://traefik.localtest.me/dashboard',
        bind: '127.0.0.1',
        port: 443,
        protocol: 'https',
        exposure: 'public',
      },
    ],
    metadata: {
      serviceType: 'core-platform',
      runtime: 'docker',
      version: 'v3.1.2',
      build: 'sha256:traefik-demo',
      configPath: 'C:\\service-lasso\\traefik\\traefik.yml',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [
      {
        key: 'SESSION_SECRET',
        value: 'secret://services/admin/session',
        secret: true,
        scope: 'service',
        source: '@secretsbroker/local/default',
      },
    ],
    recentLogs: [],
    actions: [],
    ...overrides,
  }) satisfies DashboardService

const mockState = vi.hoisted(() => ({
  services: [] as DashboardService[],
}))

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useServices: () => ({
    data: mockState.services,
    isLoading: false,
  }),
}))

describe('service routes page', () => {
  beforeEach(() => {
    mockState.services = [routeService({})]
  })

  it('renders service endpoint inventory without secret material', async () => {
    await renderRoute('/service-routes')

    await expectActivePageIdentity('Routes')

    expect(screen.queryByText('Route inventory')).not.toBeInTheDocument()
    expect(screen.queryByText('LAN routes')).not.toBeInTheDocument()
    expect(screen.queryByText('Local endpoints')).not.toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: /^service$/i })
    ).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /^route$/i })).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: /host \/ path/i })
    ).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /target/i })).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: /config source/i })
    ).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /url/i })).toBeVisible()
    expect(screen.getByText('Local dashboard')).toBeVisible()
    expect(screen.getByText('traefik.localtest.me')).toBeVisible()
    expect(screen.getByText('/dashboard')).toBeVisible()
    expect(screen.getByText('@traefik:443')).toBeVisible()
    expect(screen.getByText('127.0.0.1:443')).toBeVisible()
    expect(screen.getAllByText('Traefik')).toHaveLength(2)
    expect(screen.getByText('traefik.yml via runtime metadata')).toBeVisible()
    expect(
      screen.getByText('https://traefik.localtest.me/dashboard')
    ).toBeVisible()
    expect(screen.queryByText(/secret:\/\//i)).not.toBeInTheDocument()
    expect(screen.queryByText(/SESSION_SECRET/i)).not.toBeInTheDocument()
  })

  it('renders an empty route inventory state', async () => {
    mockState.services = [routeService({ endpoints: [] })]

    await renderRoute('/service-routes')

    await waitFor(() => {
      expect(
        screen.getByText('No routes are available from runtime metadata.')
      ).toBeVisible()
    })
  })

  it('marks invalid and unavailable route rows safely', async () => {
    mockState.services = [
      routeService({
        id: '@invalid',
        name: 'Broken route',
        status: 'degraded',
        endpoints: [
          {
            label: 'Broken public route',
            url: 'not a route url',
            bind: '0.0.0.0',
            port: 17700,
            protocol: 'http',
            exposure: 'public',
          },
        ],
      }),
      routeService({
        id: 'dagu',
        name: 'Dagu',
        status: 'stopped',
        endpoints: [
          {
            label: 'Workflow UI',
            url: 'http://localhost:8082',
            bind: '127.0.0.1',
            port: 8082,
            protocol: 'http',
            exposure: 'local',
          },
        ],
      }),
    ]

    await renderRoute('/service-routes')

    await waitFor(() => {
      expect(screen.getByText('Invalid URL')).toBeVisible()
    })

    expect(screen.getByText('Invalid route')).toBeVisible()
    expect(screen.getByText('Unavailable')).toBeVisible()
    expect(screen.getByText('Service Lasso runtime')).toBeVisible()
    expect(screen.queryByText(/secret:\/\//i)).not.toBeInTheDocument()
  })
})
