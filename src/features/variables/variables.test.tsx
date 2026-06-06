import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
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
            scope: 'service',
            secret: false,
            source: '@serviceadmin/service.json',
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
    expect(screen.getByRole('columnheader', { name: /value/i })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /source/i })).toBeVisible()
    expect(screen.getByText('SERVICE_LASSO_API_BASE_URL')).toBeVisible()
    expect(screen.getByText('http://127.0.0.1:17883')).toBeVisible()

    const scrollRegion = screen.getByTestId('variables-table-scroll-region')
    expect(scrollRegion).toHaveClass('flex-1')
    expect(scrollRegion).toHaveClass('overflow-auto')
    expect(scrollRegion).toHaveClass('min-h-[320px]')
    expect(screen.getByRole('button', { name: /next page/i })).toBeVisible()
  })
})
