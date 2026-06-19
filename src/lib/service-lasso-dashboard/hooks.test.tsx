import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDashboardAction } from './hooks'
import type { DashboardSummary } from './types'

const mocks = vi.hoisted(() => ({
  runDashboardAction: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}))

vi.mock('./client', () => ({
  buildServiceLogUrl: vi.fn(),
  fetchDashboardService: vi.fn(),
  fetchDashboardSummary: vi.fn(),
  fetchServices: vi.fn(),
  runDashboardAction: mocks.runDashboardAction,
}))

function summary(): DashboardSummary {
  return {
    runtime: {
      status: 'healthy',
      lastReloadedAt: '2026-06-20T00:00:00.000Z',
      warningCount: 0,
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

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useDashboardAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a success toast after runtime reload refreshes dashboard data', async () => {
    mocks.runDashboardAction.mockResolvedValueOnce(summary())

    const { result } = renderHook(() => useDashboardAction(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('reload-runtime')
    })

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Runtime reloaded and health data refreshed.'
    )
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('shows the specific runtime API error when runtime reload fails', async () => {
    mocks.runDashboardAction.mockRejectedValueOnce(
      new Error(
        'Service Lasso runtime API returned 409: Reload blocked because @nginx has invalid health config.'
      )
    )

    const { result } = renderHook(() => useDashboardAction(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync('reload-runtime')
      ).rejects.toThrow(
        'Reload blocked because @nginx has invalid health config.'
      )
    })

    expect(mocks.toastError).toHaveBeenCalledWith(
      'Service Lasso runtime API returned 409: Reload blocked because @nginx has invalid health config.'
    )
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })

  it('shows a success toast after start services refreshes dashboard data', async () => {
    mocks.runDashboardAction.mockResolvedValueOnce(summary())

    const { result } = renderHook(() => useDashboardAction(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('start-services')
    })

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Start services request accepted. Services status refreshed.'
    )
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('shows the specific runtime API error when start services fails', async () => {
    mocks.runDashboardAction.mockRejectedValueOnce(
      new Error(
        'Service Lasso runtime API returned 503: startAll failed because @postgres did not reach healthy state.'
      )
    )

    const { result } = renderHook(() => useDashboardAction(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync('start-services')
      ).rejects.toThrow('@postgres did not reach healthy state')
    })

    expect(mocks.toastError).toHaveBeenCalledWith(
      'Service Lasso runtime API returned 503: startAll failed because @postgres did not reach healthy state.'
    )
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
  })
})
