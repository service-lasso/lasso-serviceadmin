import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useServices: () => ({
    data: [
      {
        id: '@serviceadmin',
        name: 'Service Admin',
        endpoints: [
          {
            label: 'ui',
            url: 'http://127.0.0.1:17700',
            bind: '0.0.0.0',
            port: 17700,
            protocol: 'http',
            exposure: 'local',
          },
        ],
      },
    ],
    isLoading: false,
  }),
}))

describe('network page', () => {
  it('renders the network table without a nested endpoints card wrapper', async () => {
    await renderRoute('/network')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^Network$/i })).toBeVisible()
    })

    expect(screen.queryByText('Service endpoints')).not.toBeInTheDocument()
    expect(screen.queryByText(/endpoints shown/i)).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /service/i })).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: /endpoint/i })
    ).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /url/i })).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: /exposure/i })
    ).toBeVisible()
    expect(screen.getByRole('link', { name: /Service Admin/i })).toBeVisible()
    expect(screen.getByText('http://127.0.0.1:17700')).toBeVisible()
  })
})
