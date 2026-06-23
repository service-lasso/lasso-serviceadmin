import { renderRoute } from '@/test/render-route'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildMetadataTableRows } from './metadata-table'

vi.mock('@/lib/service-lasso-dashboard/client', async () => {
  const stub = await vi.importActual<
    typeof import('@/lib/service-lasso-dashboard/stub')
  >('@/lib/service-lasso-dashboard/stub')

  return {
    buildServiceLogUrl: stub.buildStubServiceLogUrl,
    fetchDashboardService: stub.fetchDashboardService,
    fetchDashboardSummary: stub.fetchDashboardSummary,
    fetchServices: stub.fetchServices,
    runDashboardAction: stub.runDashboardAction,
    serviceLassoApiBaseUrl: stub.serviceLassoApiBaseUrl,
  }
})

describe('service detail overview metadata table', () => {
  it('renders runtime metadata under the overview summary without a duplicate metadata tab', async () => {
    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    expect(screen.queryByRole('tab', { name: /metadata/i })).toBeNull()

    const metadataRegion = screen.getByTestId(
      'service-detail-overview-metadata'
    )
    const metadataTable = within(metadataRegion).getByTestId(
      'service-detail-metadata-table'
    )

    expect(within(metadataRegion).getByText('Metadata')).toBeVisible()
    expect(
      within(metadataTable).getByRole('columnheader', { name: 'Key' })
    ).toBeVisible()
    expect(within(metadataTable).getByText('Package')).toBeVisible()
    expect(within(metadataTable).getByText('lasso-@serviceadmin')).toBeVisible()
    expect(within(metadataTable).getByText('Install path')).toBeVisible()
    expect(
      within(metadataTable).getAllByText(
        'C:\\projects\\service-lasso\\lasso-@serviceadmin'
      )[0]
    ).toBeVisible()
  })

  it('keeps full metadata values available for wrapped or truncated table cells', async () => {
    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    const metadataTable = screen.getByTestId('service-detail-metadata-table')
    const configPathCell = within(metadataTable).getByText(
      'C:\\projects\\service-lasso\\lasso-@serviceadmin\\vite.config.ts'
    )

    expect(configPathCell).toHaveAttribute(
      'title',
      'C:\\projects\\service-lasso\\lasso-@serviceadmin\\vite.config.ts'
    )
  })

  it('omits empty metadata fields for a compact empty state', () => {
    expect(
      buildMetadataTableRows({
        serviceType: 'app',
        runtime: 'node',
        version: '1.0.0',
        build: 'build-id',
      })
    ).toEqual([])
  })
})

describe('service detail quick actions', () => {
  it('keeps jump actions in the header and removes duplicate log-panel actions', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    const quickActions = within(
      screen.getByTestId('service-detail-quick-actions')
    )

    expect(quickActions.getByRole('link', { name: /logs/i })).toHaveAttribute(
      'href',
      '/logs?service=%40serviceadmin'
    )
    expect(
      quickActions.getByRole('link', { name: /dependencies/i })
    ).toHaveAttribute('href', '/dependencies?service=%40serviceadmin')
    expect(
      quickActions.getByRole('link', { name: /variables/i })
    ).toHaveAttribute('href', '/variables?service=%40serviceadmin')
    expect(
      quickActions.getByRole('link', { name: /network/i })
    ).toHaveAttribute('href', '/network')
    expect(
      quickActions.getByRole('link', { name: /runtime/i })
    ).toHaveAttribute('href', '/runtime?service=%40serviceadmin')

    await user.click(screen.getByRole('tab', { name: /logs/i }))

    expect(screen.queryByRole('link', { name: /open live logs/i })).toBeNull()
    expect(
      screen.queryByRole('link', { name: /open dependencies/i })
    ).toBeNull()
    expect(
      screen.queryByRole('link', { name: /open network view/i })
    ).toBeNull()
    expect(
      screen.queryByRole('link', { name: /open runtime view/i })
    ).toBeNull()
    expect(screen.getByText('Diagnostics + recent logs')).toBeVisible()
  })

  it('opens a full config JSON modal with secret values redacted', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    await user.click(
      screen.getByRole('button', { name: /view full config json/i })
    )

    const dialog = screen.getByRole('dialog', { name: /full config json/i })
    const configJson = within(dialog).getByTestId(
      'service-detail-full-config-json'
    )

    expect(configJson).toHaveTextContent('"id": "@serviceadmin"')
    expect(configJson).toHaveTextContent('"favorite": true')
    expect(configJson).toHaveTextContent('"templateValue"')
    expect(configJson).toHaveTextContent('SESSION_SECRET')
    expect(configJson).toHaveTextContent('[redacted by Service Admin]')
    expect(configJson).not.toHaveTextContent(
      'secret://@serviceadmin/SESSION_SECRET'
    )
    expect(configJson).not.toHaveTextContent(
      'secret://openclaw/anthropic/api_key'
    )

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /full config json/i })
      ).toBeNull()
    })
  })
})

describe('service detail endpoints table', () => {
  it('renders actual endpoint URLs with open, copy, and route inventory actions', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    await renderRoute('/services/@serviceadmin')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /^Service Admin UI$/i })
      ).toBeVisible()
    })

    await user.click(screen.getByRole('tab', { name: /endpoints/i }))

    const localUrlCell = screen.getByText('http://localhost:17700')
    const localEndpointRow = localUrlCell.closest('tr')
    expect(localEndpointRow).not.toBeNull()
    const row = within(localEndpointRow as HTMLTableRowElement)

    expect(row.getByText('Local UI')).toBeVisible()
    expect(row.getByText('HTTP')).toBeVisible()
    expect(row.getByText('0.0.0.0')).toBeVisible()
    expect(row.getByText('17700')).toBeVisible()
    expect(row.getByText('local')).toBeVisible()
    expect(localUrlCell).toBeVisible()

    expect(
      row.getByRole('link', { name: 'Open Local UI endpoint' })
    ).toHaveAttribute('href', 'http://localhost:17700')

    await user.click(row.getByRole('button', { name: 'Copy Local UI URL' }))
    expect(writeText).toHaveBeenCalledWith('http://localhost:17700')

    expect(
      row.getByRole('link', { name: 'Open Local UI in route inventory' })
    ).toHaveAttribute(
      'href',
      expect.stringContaining('route=http%3A%2F%2Flocalhost%3A17700')
    )
  })
})
