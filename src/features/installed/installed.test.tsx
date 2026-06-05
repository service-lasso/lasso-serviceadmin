import { renderRoute } from '@/test/render-route'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useServices: () => ({
    data: [
      {
        id: '@serviceadmin',
        name: 'Service Admin',
        installed: true,
        metadata: {
          runtime: '@node',
          version: '2026.6.5-b4f9a3e',
          packageId: 'service-lasso/lasso-serviceadmin',
          installPath: 'C:/service-lasso/services/@serviceadmin/runtime',
          configPath: 'C:/service-lasso/services/@serviceadmin/config',
          dataPath: 'C:/service-lasso/services/@serviceadmin/data',
        },
      },
    ],
    isLoading: false,
  }),
}))

describe('installed page', () => {
  it('renders the installed table without a nested services card wrapper', async () => {
    await renderRoute('/installed')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Installed$/i })
      ).toBeVisible()
    })

    expect(screen.queryByText('Installed services')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/package, version, and path details/i)
    ).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /service/i })).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: /installed/i })
    ).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /package/i })).toBeVisible()
    expect(screen.getByRole('link', { name: /Service Admin/i })).toBeVisible()
    expect(screen.getByText('2026.6.5-b4f9a3e')).toBeVisible()
  })
})
