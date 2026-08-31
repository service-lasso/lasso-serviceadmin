import { renderRoute } from '@/test/render-route'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DashboardService,
  DashboardSummary,
} from '@/lib/service-lasso-dashboard/types'

const hookMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  useDashboardAction: vi.fn(),
  useDashboardService: vi.fn(),
  useDashboardSummary: vi.fn(),
  useBrokerTelemetry: vi.fn(),
  useInboxCounts: vi.fn(),
  useFleetMetrics: vi.fn(),
  useRuntimeInstanceHome: vi.fn(),
  useNetworkHome: vi.fn(),
  useServices: vi.fn(),
  useFavoriteFeatureState: vi.fn(),
  useToggleFavorite: vi.fn(),
}))

vi.mock('@/lib/service-lasso-dashboard/hooks', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/service-lasso-dashboard/hooks')>()
  return {
    ...actual,
    useDashboardAction: hookMocks.useDashboardAction,
    useDashboardService: hookMocks.useDashboardService,
    useDashboardSummary: hookMocks.useDashboardSummary,
    useBrokerTelemetry: hookMocks.useBrokerTelemetry,
    useInboxCounts: hookMocks.useInboxCounts,
    useFleetMetrics: hookMocks.useFleetMetrics,
    useRuntimeInstanceHome: hookMocks.useRuntimeInstanceHome,
    useNetworkHome: hookMocks.useNetworkHome,
    useServices: hookMocks.useServices,
    useFavoriteFeatureState: hookMocks.useFavoriteFeatureState,
    useToggleFavorite: hookMocks.useToggleFavorite,
  }
})

function echoService(): DashboardService {
  return {
    id: 'echo-service',
    name: 'Echo Service',
    status: 'running',
    favorite: false,
    role: 'sample',
    note: 'ready',
    installed: true,
    links: [{ label: 'Local', url: 'http://127.0.0.1:8080', kind: 'local' }],
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '1m',
      lastCheckAt: '2026-06-20T00:00:00.000Z',
      summary: 'ready',
    },
    endpoints: [],
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
  }
}

function summary(): DashboardSummary {
  return {
    runtime: {
      status: 'warning',
      lastReloadedAt: '2026-06-20T00:00:00.000Z',
      warningCount: 2,
    },
    servicesTotal: 0,
    servicesRunning: 0,
    servicesAvailable: 0,
    servicesStopped: 0,
    servicesDegraded: 0,
    networkExposureCount: 0,
    installedCount: 0,
    favorites: [],
    others: [],
    warnings: [],
    problemServices: [],
  }
}

function mockHomeQueries() {
  hookMocks.useInboxCounts.mockReturnValue({
    data: { unread: 3 },
    isError: false,
    isLoading: false,
  })
  hookMocks.useFleetMetrics.mockReturnValue({
    data: [],
    isError: false,
    isLoading: false,
  })
  hookMocks.useRuntimeInstanceHome.mockReturnValue({
    data: {
      phase: 'running',
      activeGenerationId: 'gen-test',
      classification: 'selected',
      staleCount: 0,
    },
    isError: false,
    isLoading: false,
  })
  hookMocks.useNetworkHome.mockReturnValue({
    data: [],
    isError: false,
    isLoading: false,
  })
}

describe('Dashboard runtime health action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookMocks.useDashboardSummary.mockReturnValue({
      data: summary(),
      isError: false,
      isLoading: false,
    })
    hookMocks.useServices.mockReturnValue({
      data: [],
      isLoading: false,
    })
    hookMocks.useDashboardService.mockReturnValue({
      data: null,
      isLoading: false,
    })
    hookMocks.useFavoriteFeatureState.mockReturnValue({ enabled: true })
    hookMocks.useToggleFavorite.mockReturnValue({ mutateAsync: vi.fn() })
    hookMocks.useBrokerTelemetry.mockReturnValue({
      data: {
        counters: {
          activeLockouts: 0,
        },
      },
      isError: false,
      isLoading: false,
    })
    mockHomeQueries()
  })

  it('runs the reload runtime action from the runtime health card', async () => {
    hookMocks.useDashboardAction.mockReturnValue({
      isPending: false,
      mutate: hookMocks.mutate,
      variables: undefined,
    })

    await renderRoute('/')
    await userEvent.click(
      screen.getByRole('button', { name: /Reload runtime/i })
    )

    expect(hookMocks.mutate).toHaveBeenCalledWith('reload-runtime')
  })

  it('runs the start services action from the services card', async () => {
    hookMocks.useDashboardAction.mockReturnValue({
      isPending: false,
      mutate: hookMocks.mutate,
      variables: undefined,
    })

    await renderRoute('/')
    await userEvent.click(
      screen.getByRole('button', { name: /Start services/i })
    )

    expect(hookMocks.mutate).toHaveBeenCalledWith('start-services')
  })

  it('shows a disabled progress state while runtime reload is pending', async () => {
    hookMocks.useDashboardAction.mockReturnValue({
      isPending: true,
      mutate: hookMocks.mutate,
      variables: 'reload-runtime',
    })

    await renderRoute('/')

    expect(
      screen.getByRole('button', { name: /Reloading runtime/i })
    ).toBeDisabled()
  })

  it('shows a disabled progress state while services are starting', async () => {
    hookMocks.useDashboardAction.mockReturnValue({
      isPending: true,
      mutate: hookMocks.mutate,
      variables: 'start-services',
    })

    await renderRoute('/')

    expect(
      screen.getByRole('button', { name: /Starting services/i })
    ).toBeDisabled()
  })

  it('lets the operator favorite a service from the dashboard card', async () => {
    const mutateAsync = vi.fn()
    const echo = echoService()
    hookMocks.useToggleFavorite.mockReturnValue({ mutateAsync })
    hookMocks.useDashboardAction.mockReturnValue({
      isPending: false,
      mutate: hookMocks.mutate,
      variables: undefined,
    })
    hookMocks.useDashboardSummary.mockReturnValue({
      data: {
        ...summary(),
        runtime: {
          status: 'healthy',
          lastReloadedAt: '2026-06-20T00:00:00.000Z',
          warningCount: 0,
        },
        servicesTotal: 1,
        servicesRunning: 1,
        others: [echo],
      },
      isError: false,
      isLoading: false,
    })

    await renderRoute('/')
    await userEvent.click(screen.getByRole('button', { name: 'Add favorite' }))

    expect(mutateAsync).toHaveBeenCalledWith('echo-service')
  })
})

function brokerService(
  overrides: Partial<DashboardService> = {}
): DashboardService {
  return {
    id: '@secretsbroker',
    name: 'Secrets Broker',
    status: 'running',
    favorite: false,
    note: 'Local encrypted KV',
    links: [],
    installed: true,
    role: 'secrets-broker',
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '1h',
      lastCheckAt: '2026-08-19T10:26:00.000Z',
      summary: 'Healthy',
    },
    endpoints: [],
    metadata: {
      serviceType: 'core',
      runtime: 'node',
      version: 'test',
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

describe('Dashboard Secrets Broker chips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hookMocks.useDashboardAction.mockReturnValue({
      isPending: false,
      mutate: hookMocks.mutate,
      variables: undefined,
    })
    hookMocks.useServices.mockReturnValue({
      data: [],
      isLoading: false,
    })
    hookMocks.useDashboardService.mockReturnValue({
      data: null,
      isLoading: false,
    })
    hookMocks.useFavoriteFeatureState.mockReturnValue({ enabled: true })
    hookMocks.useToggleFavorite.mockReturnValue({ mutateAsync: vi.fn() })
    mockHomeQueries()
  })

  it('shows Broker ready and lockout counts without secret values', async () => {
    hookMocks.useDashboardSummary.mockReturnValue({
      data: {
        ...summary(),
        others: [brokerService()],
      },
      isError: false,
      isLoading: false,
    })
    hookMocks.useBrokerTelemetry.mockReturnValue({
      data: {
        counters: {
          activeLockouts: 2,
        },
      },
      isError: false,
      isLoading: false,
    })

    await renderRoute('/')

    expect(screen.getByText('Broker ready')).toBeVisible()
    expect(screen.getByLabelText('Broker ready Ready')).toHaveTextContent(
      'Ready'
    )
    expect(screen.getByText('Broker lockouts')).toBeVisible()
    expect(screen.getByLabelText('Broker lockout count 2')).toHaveTextContent(
      '2'
    )
    expect(
      screen.getAllByRole('link', { name: 'Open Secrets' })[0]
    ).toHaveAttribute('href', '/secrets-broker/secrets')
    expect(screen.queryByText(/supersecret/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/password=/i)).not.toBeInTheDocument()
  })

  it('replaces link-count exposure with listen ports and named failure detail', async () => {
    const stopped = echoService()
    stopped.status = 'stopped'
    stopped.note = 'process-ready failed'
    stopped.installed = false
    stopped.runtimeHealth.lastRestartAt = '2026-08-19T09:54:00.000Z'
    stopped.runtimeHealth.state = 'stopped'
    stopped.runtimeHealth.health = 'critical'
    stopped.endpoints = [
      {
        label: 'Local',
        url: 'http://127.0.0.1:8080',
        bind: '127.0.0.1',
        port: 8080,
        protocol: 'http',
        exposure: 'local',
      },
    ]
    const running = echoService()
    running.id = '@traefik'
    running.name = 'Traefik'
    running.status = 'running'
    running.endpoints = [
      {
        label: 'Web',
        url: 'http://127.0.0.1:19080',
        bind: '0.0.0.0',
        port: 19080,
        protocol: 'http',
        exposure: 'local',
      },
    ]
    hookMocks.useDashboardSummary.mockReturnValue({
      data: {
        ...summary(),
        others: [running],
        problemServices: [stopped],
        warnings: ['Echo Service is not healthy.'],
      },
      isError: false,
      isLoading: false,
    })
    hookMocks.useBrokerTelemetry.mockReturnValue({
      data: {
        counters: {
          activeLockouts: 0,
        },
      },
      isError: false,
      isLoading: false,
    })
    hookMocks.useFleetMetrics.mockReturnValue({
      data: [
        {
          serviceId: 'echo-service',
          running: false,
          crashCount: 1,
          lastTermination: 'crashed',
          stdoutLines: 4,
          stderrLines: 2,
        },
      ],
      isError: false,
      isLoading: false,
    })

    await renderRoute('/')

    expect(screen.getByText('Listen ports')).toBeVisible()
    expect(screen.getByLabelText('Listen ports 1')).toHaveTextContent('1')
    expect(screen.queryByText('Network exposure')).not.toBeInTheDocument()
    expect(screen.getByText('Inbox unread')).toBeVisible()
    expect(screen.getByLabelText('Inbox unread 3')).toHaveTextContent('3')
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Open Inbox' })
    ).toHaveAttribute('href', '/inbox')
    expect(screen.getByText('Generation lane')).toBeVisible()
    expect(screen.getByLabelText('Traefik running')).toBeVisible()
    expect(screen.getByText('Log volume')).toBeVisible()
    expect(screen.getByText('process-ready failed')).toBeVisible()
    expect(screen.getByText(/Last start 2026-08-19 09:54 UTC/)).toBeVisible()
    expect(screen.getByText(/Not installed/)).toBeVisible()
    expect(screen.getByText('Crashed')).toBeVisible()
    expect(screen.queryByText(/supersecret/i)).not.toBeInTheDocument()
  })

  it('shows Unavailable when @secretsbroker is missing from the dashboard payload', async () => {
    hookMocks.useDashboardSummary.mockReturnValue({
      data: summary(),
      isError: false,
      isLoading: false,
    })
    hookMocks.useBrokerTelemetry.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
    })

    await renderRoute('/')

    expect(screen.getByLabelText('Broker ready Unavailable')).toHaveTextContent(
      'Unavailable'
    )
    expect(screen.getByLabelText('Broker lockout count —')).toHaveTextContent(
      '—'
    )
  })
})
