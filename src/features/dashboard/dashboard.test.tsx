import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardSummary } from '@/lib/service-lasso-dashboard/types'

const hookMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  useDashboardAction: vi.fn(),
  useDashboardService: vi.fn(),
  useDashboardSummary: vi.fn(),
  useServices: vi.fn(),
  useFavoriteFeatureState: vi.fn(),
  useToggleFavorite: vi.fn(),
}))

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useDashboardAction: hookMocks.useDashboardAction,
  useDashboardService: hookMocks.useDashboardService,
  useDashboardSummary: hookMocks.useDashboardSummary,
  useServices: hookMocks.useServices,
  useFavoriteFeatureState: hookMocks.useFavoriteFeatureState,
  useToggleFavorite: hookMocks.useToggleFavorite,
}))

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
})
