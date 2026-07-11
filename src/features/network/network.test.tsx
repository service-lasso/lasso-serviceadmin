import { expectActivePageIdentity } from '@/test/page-identity'
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
          {
            label: 'api',
            url: 'http://127.0.0.1:17883/api',
            bind: '127.0.0.1',
            port: 17883,
            protocol: 'http',
            exposure: 'local',
          },
          {
            label: 'health',
            url: 'http://127.0.0.1:17883/api/health',
            bind: '127.0.0.1',
            port: 17883,
            protocol: 'http',
            exposure: 'local',
          },
        ],
      },
      {
        id: '@archive',
        name: 'Archive',
        endpoints: [
          {
            label: 'vendor download',
            url: 'https://www.7-zip.org/download.html',
            bind: 'metadata',
            port: 443,
            protocol: 'https',
            exposure: 'public',
          },
          {
            label: 'release asset',
            url: 'https://github.com/ip7z/7zip/releases/download/24.09/7z2409-x64.exe',
            bind: 'metadata',
            port: 443,
            protocol: 'https',
            exposure: 'public',
          },
          {
            label: 'docs',
            url: 'https://www.7-zip.org/',
            bind: 'metadata',
            port: 443,
            protocol: 'https',
            exposure: 'public',
          },
          {
            label: 'route',
            url: 'https://archive.service-lasso.local',
            bind: '0.0.0.0',
            port: 443,
            protocol: 'https',
            exposure: 'lan',
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

    await expectActivePageIdentity('Network')

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
    expect(
      screen.getAllByRole('link', { name: /Service Admin/i })[0]
    ).toBeVisible()
    expect(screen.getByText('http://127.0.0.1:17700')).toBeVisible()
  })

  it('only shows operator service endpoints in the network table', async () => {
    await renderRoute('/network')

    await waitFor(() => {
      expect(screen.getByText('http://127.0.0.1:17883/api')).toBeVisible()
    })

    expect(screen.getByText('http://127.0.0.1:17883/api/health')).toBeVisible()
    expect(
      screen.getByText('https://archive.service-lasso.local')
    ).toBeVisible()
    expect(screen.queryByText('https://www.7-zip.org/download.html')).toBeNull()
    expect(
      screen.queryByText(
        'https://github.com/ip7z/7zip/releases/download/24.09/7z2409-x64.exe'
      )
    ).toBeNull()
    expect(screen.queryByRole('cell', { name: /^docs$/i })).toBeNull()
  })
})
