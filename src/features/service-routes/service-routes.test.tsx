import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useServices: () => ({
    data: [
      {
        id: '@traefik',
        name: 'Traefik',
        status: 'running',
        endpoints: [
          {
            label: 'Local dashboard',
            url: 'https://traefik.localtest.me',
            bind: '127.0.0.1',
            port: 443,
            protocol: 'https',
            exposure: 'public',
          },
        ],
      },
    ],
    isLoading: false,
  }),
}))

describe('service routes page', () => {
  it('renders service endpoint inventory without secret material', async () => {
    await renderRoute('/service-routes')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service routes$/i })
      ).toBeVisible()
    })

    expect(screen.queryByText('Route inventory')).not.toBeInTheDocument()
    expect(screen.queryByText('LAN routes')).not.toBeInTheDocument()
    expect(screen.queryByText('Local endpoints')).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /service/i })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /route/i })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /url/i })).toBeVisible()
    expect(screen.getByText('Local dashboard')).toBeVisible()
    expect(screen.getByText('https://traefik.localtest.me')).toBeVisible()
    expect(screen.queryByText(/secret:\/\//i)).not.toBeInTheDocument()
    expect(screen.queryByText(/SESSION_SECRET/i)).not.toBeInTheDocument()
  })
})
