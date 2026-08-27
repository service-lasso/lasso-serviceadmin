import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useServiceLifecycleAction } from './hooks'

const { runServiceLifecycleAction } = vi.hoisted(() => ({
  runServiceLifecycleAction: vi.fn(),
}))

vi.mock('./stub', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./stub')>()),
  runServiceLifecycleAction,
}))

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const invalidateQueries = vi
    .spyOn(queryClient, 'invalidateQueries')
    .mockResolvedValue()
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return { invalidateQueries, queryClient, wrapper }
}

const exactRefreshes = [
  { queryKey: ['service-lasso-dashboard'], exact: true },
  { queryKey: ['service-lasso-dashboard', 'services'], exact: true },
  { queryKey: ['service-lasso-dashboard', '@secretsbroker'], exact: true },
]

describe('lifecycle action query refresh', () => {
  afterEach(() => {
    runServiceLifecycleAction.mockReset()
  })

  it('refreshes only dashboard, list, and detail after success', async () => {
    runServiceLifecycleAction.mockResolvedValue({
      serviceId: '@secretsbroker',
      action: 'restart',
    })
    const { invalidateQueries, queryClient, wrapper } = createHarness()
    const { result } = renderHook(() => useServiceLifecycleAction(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        serviceId: '@secretsbroker',
        action: 'restart',
        confirm: true,
      })
    })

    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual(
      exactRefreshes
    )
    queryClient.clear()
  })

  it('refreshes the same bounded views after failure', async () => {
    runServiceLifecycleAction.mockRejectedValue(
      new Error('runtime unavailable')
    )
    const { invalidateQueries, queryClient, wrapper } = createHarness()
    const { result } = renderHook(() => useServiceLifecycleAction(), {
      wrapper,
    })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          serviceId: '@secretsbroker',
          action: 'reload' as never,
          confirm: true,
        })
      ).rejects.toThrow('runtime unavailable')
    })

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(3))
    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual(
      exactRefreshes
    )
    queryClient.clear()
  })
})
