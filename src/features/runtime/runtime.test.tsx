import { expectActivePageIdentity } from '@/test/page-identity'
import { renderRoute } from '@/test/render-route'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useServices: () => ({
    data: [
      {
        id: '@serviceadmin',
        name: 'Service Admin',
        role: '@node',
        status: 'running',
        runtimeHealth: {
          health: 'healthy',
          summary: 'Managed Service Admin runtime is healthy.',
          uptime: '14m',
          lastCheckAt: '2026-06-05 21:40',
          lastRestartAt: '2026-06-05 21:26',
        },
      },
    ],
    isLoading: false,
  }),
}))

describe('runtime page', () => {
  it('renders the runtime table without a nested status card wrapper', async () => {
    await renderRoute('/runtime')

    await expectActivePageIdentity('Runtime')

    expect(screen.queryByText('Runtime status')).not.toBeInTheDocument()
    expect(screen.queryByText(/services shown/i)).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /service/i })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /runtime/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /Service Admin/i })).toBeVisible()
    expect(
      screen.getByText('Managed Service Admin runtime is healthy.')
    ).toBeVisible()
  })
})
