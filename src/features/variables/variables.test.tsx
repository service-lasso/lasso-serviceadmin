import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useServices: () => ({
    data: [
      {
        id: '@serviceadmin',
        name: 'Service Admin',
        environmentVariables: [
          {
            key: 'SERVICE_LASSO_API_BASE_URL',
            value: 'http://127.0.0.1:17883',
            templateValue: '${runtime.API_BASE_URL}',
            scope: 'service',
            secret: false,
            source: '@serviceadmin/service.json',
          },
          {
            key: 'SERVICE_LASSO_SESSION_SECRET',
            value: 'super-secret-session-value',
            templateValue: '${serviceadmin.SESSION_SECRET}',
            scope: 'service',
            secret: true,
            source: '@serviceadmin/service.json',
          },
        ],
      },
      {
        id: '@worker',
        name: 'Worker Service',
        environmentVariables: [
          {
            key: 'WORKER_QUEUE_URL',
            value: 'https://queue.internal/jobs',
            templateValue: undefined,
            scope: 'global',
            secret: false,
            source: 'workspace/env',
          },
        ],
      },
    ],
    isLoading: false,
  }),
}))

describe('variables page', () => {
  it('renders the variables table without a nested environment card wrapper', async () => {
    await renderRoute('/variables')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Variables$/i })
      ).toBeVisible()
    })

    expect(screen.queryByText('Environment variables')).not.toBeInTheDocument()
    expect(screen.queryByText(/variable rows shown/i)).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /key/i })).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: /resolved value/i })
    ).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: /template value/i })
    ).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /source/i })).toBeVisible()
    expect(screen.getAllByRole('button', { name: /^Scope/i })[0]).toBeVisible()
    expect(screen.getAllByRole('button', { name: /^Source/i })[0]).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: /^Visibility/i })[0]
    ).toBeVisible()
    expect(screen.getByText('SERVICE_LASSO_API_BASE_URL')).toBeVisible()
    expect(screen.getByText('http://127.0.0.1:17883')).toBeVisible()
    expect(screen.getByText('${runtime.API_BASE_URL}')).toBeVisible()
    expect(screen.getAllByText('••••••••')).toHaveLength(2)
    expect(
      screen.queryByText('super-secret-session-value')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('${serviceadmin.SESSION_SECRET}')
    ).not.toBeInTheDocument()

    const scrollRegion = screen.getByTestId('variables-table-scroll-region')
    expect(scrollRegion).toHaveClass('flex-1')
    expect(scrollRegion).toHaveClass('overflow-auto')
    expect(scrollRegion).toHaveClass('min-h-[320px]')
    expect(screen.getByRole('button', { name: /next page/i })).toBeVisible()
  })

  it('uses the shared table search and URL-backed pagination state', async () => {
    const user = userEvent.setup()
    const { router } = await renderRoute('/variables?page=2&pageSize=1')

    await waitFor(() => {
      expect(screen.getByText('SERVICE_LASSO_SESSION_SECRET')).toBeVisible()
    })
    expect(
      screen.queryByText('SERVICE_LASSO_API_BASE_URL')
    ).not.toBeInTheDocument()
    expect(screen.getAllByText(/Page 2 of 3/i)[0]).toBeVisible()
    expect(
      screen.queryByText('super-secret-session-value')
    ).not.toBeInTheDocument()

    await user.type(
      screen.getByPlaceholderText(/Search variable keys/i),
      'worker'
    )
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: 'worker' })
    })
    expect(screen.getByText('WORKER_QUEUE_URL')).toBeVisible()
    expect(screen.getByText('Not recorded')).toBeVisible()
    expect(
      screen.queryByText('SERVICE_LASSO_API_BASE_URL')
    ).not.toBeInTheDocument()
  })

  it('can search by the source template value without indexing secret templates', async () => {
    const user = userEvent.setup()
    await renderRoute('/variables')

    await user.type(
      screen.getByPlaceholderText(/Search variable keys/i),
      'runtime.API_BASE_URL'
    )

    await waitFor(() => {
      expect(screen.getByText('SERVICE_LASSO_API_BASE_URL')).toBeVisible()
    })
    expect(screen.queryByText('WORKER_QUEUE_URL')).not.toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText(/Search variable keys/i))
    await user.type(
      screen.getByPlaceholderText(/Search variable keys/i),
      'serviceadmin.SESSION_SECRET'
    )

    await waitFor(() => {
      expect(
        screen.getByText('No variables match the current filters.')
      ).toBeVisible()
    })
    expect(
      screen.queryByText('${serviceadmin.SESSION_SECRET}')
    ).not.toBeInTheDocument()
  })
})
