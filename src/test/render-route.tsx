import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router'
import { act, render } from '@testing-library/react'
import { vi } from 'vitest'

type RenderRouteOptions = {
  firstRunSetupGate?: boolean
  stubData?: boolean
}

export async function renderRoute(
  path: string,
  options: RenderRouteOptions = {}
) {
  const stubData = options.stubData !== false
  vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', stubData ? 'true' : 'false')

  const { routeTree } = await import('@/routeTree.gen')

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const history = createMemoryHistory({
    initialEntries: [path],
  })

  const router = createRouter({
    routeTree,
    history,
    context: {
      queryClient,
      firstRunSetupGate: options.firstRunSetupGate ?? false,
    },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  let view: ReturnType<typeof render>

  await act(async () => {
    view = render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )

    await router.load()
    await Promise.resolve()
  })

  return {
    ...view!,
    queryClient,
    router,
  }
}
