import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderRoute } from './render-route'

type ScreenCase = {
  path: string
  heading: RegExp
  title?: string
}

const appScreens: ScreenCase[] = [
  {
    path: '/',
    heading: /^Dashboard$/i,
    title: 'Service Admin - Dashboard',
  },
  {
    path: '/services',
    heading: /^Services$/i,
    title: 'Service Admin - Services',
  },
  {
    path: '/services/service-admin',
    heading: /^Service Admin UI$/i,
    title: 'Service Admin - Service - Service Admin UI',
  },
  {
    path: '/dependencies',
    heading: /^Dependencies$/i,
    title: 'Service Admin - Dependencies',
  },
  { path: '/apps', heading: /^App Integrations$/i },
  { path: '/chats', heading: /^Inbox$/i },
  {
    path: '/inbox',
    heading: /^Inbox$/i,
    title: 'Service Admin - Inbox',
  },
  { path: '/tasks', heading: /^Tasks$/i },
  { path: '/users', heading: /^User List$/i },
  {
    path: '/runtime',
    heading: /^Runtime$/i,
    title: 'Service Admin - Runtime',
  },
  {
    path: '/mcp',
    heading: /^MCP$/i,
    title: 'Service Admin - MCP',
  },
  {
    path: '/installed',
    heading: /^Installed$/i,
    title: 'Service Admin - Installed',
  },
  {
    path: '/variables',
    heading: /^Variables$/i,
    title: 'Service Admin - Variables',
  },
  {
    path: '/network',
    heading: /^Network$/i,
    title: 'Service Admin - Network',
  },
  {
    path: '/security',
    heading: /^Security$/i,
    title: 'Service Admin - Security',
  },
  {
    path: '/help-center',
    heading: /^Help Center$/i,
    title: 'Service Admin - Help Center',
  },
  { path: '/settings', heading: /^Profile$/i },
  { path: '/settings/account', heading: /^Account$/i },
  { path: '/settings/appearance', heading: /^Appearance$/i },
  { path: '/settings/display', heading: /^Display$/i },
  { path: '/settings/notifications', heading: /^Notifications$/i },
]

const catalogPackages = [
  {
    id: '@traefik',
    name: 'Traefik',
    summary: 'Approved edge routing package for Service Lasso.',
    repo: 'service-lasso/lasso-traefik',
    approved: true,
    tags: ['network', 'edge'],
    defaultVersion: 'v3.5.2',
    versions: [
      { version: 'v3.5.2', name: 'v3.5.2', prerelease: false },
      { version: 'v3.6.0-rc.1', name: 'v3.6.0 RC 1', prerelease: true },
    ],
  },
  {
    id: '@zitadel',
    name: 'Zitadel',
    summary: 'Approved identity provider package.',
    repo: 'service-lasso/lasso-zitadel',
    approved: true,
    tags: ['identity'],
    defaultVersion: 'v2.71.0',
    versions: ['v2.71.0', 'v2.70.0'],
  },
]

function mockCatalogApi() {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === '/api/catalog/packages') {
        return new Response(JSON.stringify({ packages: catalogPackages }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url === '/api/catalog/install' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: '@traefik',
                status: 'registered',
                message: 'Traefik was registered.',
              },
              {
                id: '@zitadel',
                status: 'conflict',
                message: 'Zitadel already exists.',
              },
            ],
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }

      return new Response('{}', { status: 404 })
    }
  )

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

describe('app screens', () => {
  it.each(appScreens)('renders $path', async ({ path, heading, title }) => {
    await renderRoute(path)

    expect(await screen.findByRole('heading', { name: heading })).toBeVisible()

    if (title) {
      await waitFor(() => {
        expect(document.title).toBe(title)
      })
    }
  })

  it('shows compact empty setup state on service details', async () => {
    const user = userEvent.setup()
    await renderRoute('/services/service-admin')

    await user.click(await screen.findByRole('tab', { name: /Setup/i }))

    expect(
      await screen.findByText(/No setup steps are declared for this service/i)
    ).toBeVisible()
  })

  it('does not label default operator surfaces as stub data', async () => {
    const dashboard = await renderRoute('/')

    expect(
      await screen.findByRole('heading', { name: /^Dashboard$/i })
    ).toBeVisible()
    expect(screen.queryByText(/tracked by the stub/i)).toBeNull()
    expect(screen.queryByText(/dashboard stub/i)).toBeNull()
    dashboard.unmount()

    await renderRoute('/services/service-admin')

    expect(
      await screen.findByRole('heading', { name: /^Service Admin UI$/i })
    ).toBeVisible()
    expect(screen.queryByText(/current stub/i)).toBeNull()
  })

  it('opens the Add Service source chooser from services', async () => {
    const user = userEvent.setup()
    await renderRoute('/services')

    await user.click(
      await screen.findByRole('button', { name: /^Add Service$/i })
    )

    expect(
      await screen.findByRole('dialog', { name: /^Add Service$/i })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Service Catalog/i })
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Service Archive/i })
    ).toBeVisible()
    expect(screen.getByText(/built service package or archive/i)).toBeVisible()
    expect(screen.queryByText(/GitHub URL/i)).toBeNull()
    expect(screen.queryByText(/local folder/i)).toBeNull()
  })

  it('routes Add Service choices to catalog and archive panels', async () => {
    const user = userEvent.setup()
    mockCatalogApi()
    await renderRoute('/services')

    await user.click(
      await screen.findByRole('button', { name: /^Add Service$/i })
    )
    await user.click(screen.getByRole('button', { name: /Service Catalog/i }))

    const catalogDialog = await screen.findByRole('dialog', {
      name: /^Service Catalog$/i,
    })
    expect(catalogDialog).toBeVisible()
    expect(await within(catalogDialog).findByText('Traefik')).toBeVisible()
    expect(
      within(catalogDialog).getByLabelText(/Search Service Catalog/i)
    ).toBeVisible()
    expect(
      within(catalogDialog).getByRole('button', {
        name: /^Install selected$/i,
      })
    ).toBeDisabled()

    await user.click(
      within(catalogDialog).getByRole('button', { name: /Source choices/i })
    )
    await user.click(screen.getByRole('button', { name: /Service Archive/i }))

    expect(
      await screen.findByRole('dialog', { name: /^Service Archive$/i })
    ).toBeVisible()
    expect(screen.getByLabelText(/Built service archive/i)).toBeVisible()
    expect(
      screen.getByRole('button', { name: /Upload archive/i })
    ).toBeVisible()
    expect(screen.queryByText(/raw source/i)).toBeNull()
  })

  it('uploads Service Archive metadata and confirms import', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const endpoint = String(input)

      if (endpoint === '/api/service-archives/upload') {
        return new Response(
          JSON.stringify({
            uploadId: 'upload-123',
            service: {
              id: 'echo-import',
              displayName: 'Echo Import',
              version: '1.2.3',
            },
            trust: 'local archive',
            validation: {
              status: 'valid',
              messages: ['service.json passed validation.'],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (endpoint === '/api/service-archives/import') {
        return new Response(
          JSON.stringify({
            status: 'imported',
            serviceId: 'echo-import',
            serviceUrl: '/services/echo-import',
            message: 'Echo Import was added.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      return new Response(JSON.stringify({ message: 'Unexpected endpoint' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    await renderRoute('/services')

    await user.click(
      await screen.findByRole('button', { name: /^Add Service$/i })
    )
    await user.click(screen.getByRole('button', { name: /Service Archive/i }))
    await user.upload(
      screen.getByLabelText(/Built service archive/i),
      new File(['archive'], 'echo-import.zip', { type: 'application/zip' })
    )
    await user.click(screen.getByRole('button', { name: /^Upload archive$/i }))

    expect(await screen.findByText('echo-import')).toBeVisible()
    expect(screen.getByText('Echo Import')).toBeVisible()
    expect(screen.getByText('1.2.3')).toBeVisible()
    expect(screen.getByText(/Validation passed/i)).toBeVisible()
    expect(screen.queryByText(/conflict/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /^Import archive$/i }))

    expect(await screen.findByText(/Echo Import was added/i)).toBeVisible()
    expect(screen.getByRole('link', { name: /Open service/i })).toHaveAttribute(
      'href',
      '/services/echo-import'
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/service-archives/import',
      expect.objectContaining({
        body: JSON.stringify({ uploadId: 'upload-123' }),
        method: 'POST',
      })
    )
  })

  it('selects multiple catalog services, versions, and sends install payload', async () => {
    const user = userEvent.setup()
    const fetchMock = mockCatalogApi()
    await renderRoute('/services')

    await user.click(
      await screen.findByRole('button', { name: /^Add Service$/i })
    )
    await user.click(screen.getByRole('button', { name: /Service Catalog/i }))

    const catalogDialog = await screen.findByRole('dialog', {
      name: /^Service Catalog$/i,
    })
    expect(await within(catalogDialog).findByText('Traefik')).toBeVisible()
    expect(within(catalogDialog).getByText('Zitadel')).toBeVisible()

    await user.type(
      within(catalogDialog).getByLabelText(/Search Service Catalog/i),
      'edge'
    )

    expect(within(catalogDialog).getByText('Traefik')).toBeVisible()
    expect(within(catalogDialog).queryByText('Zitadel')).toBeNull()

    await user.clear(
      within(catalogDialog).getByLabelText(/Search Service Catalog/i)
    )
    await user.click(
      within(catalogDialog).getByRole('checkbox', { name: /Select Traefik/i })
    )
    await user.click(
      within(catalogDialog).getByRole('checkbox', { name: /Select Zitadel/i })
    )
    await user.selectOptions(
      within(catalogDialog).getByLabelText(/Traefik version/i),
      'v3.6.0-rc.1'
    )

    await user.click(
      within(catalogDialog).getByRole('button', {
        name: /^Install selected$/i,
      })
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/catalog/install',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            packages: [
              { id: '@traefik', version: 'v3.6.0-rc.1' },
              { id: '@zitadel', version: 'v2.71.0' },
            ],
          }),
        })
      )
    })
    expect(await within(catalogDialog).findByText('registered')).toBeVisible()
    expect(
      within(catalogDialog).getByText('Traefik was registered.')
    ).toBeVisible()
    expect(within(catalogDialog).getByText('conflict')).toBeVisible()
    expect(
      within(catalogDialog).getByText('Zitadel already exists.')
    ).toBeVisible()
  })

  it('shows succeeded and skipped setup steps on service details', async () => {
    const user = userEvent.setup()
    await renderRoute('/services/traefik')

    await user.click(await screen.findByRole('tab', { name: /Setup/i }))

    expect(await screen.findByText('generate-certificate')).toBeVisible()
    expect(await screen.findByText('prepare-cache')).toBeVisible()
    expect(await screen.findByText('Succeeded')).toBeVisible()
    expect(await screen.findByText('Skipped')).toBeVisible()
  })

  it('makes failed setup steps visually obvious on service details', async () => {
    const user = userEvent.setup()
    await renderRoute('/services/zitadel')

    await user.click(await screen.findByRole('tab', { name: /Setup/i }))

    expect(await screen.findByText('seed-admin')).toBeVisible()
    expect(screen.getAllByText(/failed/i).length).toBeGreaterThan(0)
    expect(await screen.findByText(/failed with exit code 1/i)).toBeVisible()
  })

  it('shows resolved endpoint fields on service details', async () => {
    const user = userEvent.setup()
    await renderRoute('/services/service-admin')

    await user.click(await screen.findByRole('tab', { name: /Endpoints/i }))

    expect(await screen.findByText('web')).toBeVisible()
    expect(screen.getByText('network')).toBeVisible()
    expect(screen.getByText('${endpoint.web.port}')).toBeVisible()
    expect(screen.getAllByText('manifest.endpoints').length).toBeGreaterThan(0)
  })

  it('surfaces endpoint resolution failures on service details', async () => {
    const user = userEvent.setup()
    await renderRoute('/services/zitadel')

    await user.click(await screen.findByRole('tab', { name: /Endpoints/i }))

    expect(await screen.findByText('OIDC discovery')).toBeVisible()
    expect(screen.getByText('failed')).toBeVisible()
    expect(
      screen.getByText(/readiness probe exceeded the latency budget/i)
    ).toBeVisible()
  })

  it('shows denied service action reasons on service details', async () => {
    await renderRoute('/services/service-admin')

    expect(
      await screen.findByRole('button', { name: /Stop service/i })
    ).toBeDisabled()
    expect(screen.getByText(/cannot stop its own UI process/i)).toBeVisible()
  })

  it('confirms elevated service actions before continuing', async () => {
    const user = userEvent.setup()
    await renderRoute('/services/traefik')

    await user.click(
      await screen.findByRole('button', { name: /Restart router/i })
    )

    expect(
      await screen.findByRole('alertdialog', {
        name: /Confirm elevated action/i,
      })
    ).toBeVisible()
    expect(screen.getByText(/briefly interrupts local routing/i)).toBeVisible()
  })

  it('shows security groups, permission risk, and generic provider mappings', async () => {
    const user = userEvent.setup()
    await renderRoute('/security')

    expect(
      await screen.findByText('Last-owner protection active')
    ).toBeVisible()
    expect(await screen.findByText('Owners')).toBeVisible()
    expect(screen.getByText('Backup maintainers')).toBeVisible()

    await user.click(screen.getByRole('tab', { name: /Permissions/i }))

    expect(screen.getAllByText('Critical').length).toBeGreaterThan(0)
    expect(screen.getByText('Zitadel, Generic OIDC')).toBeVisible()
  })

  it('shows metadata-only secret rotation impact plans', async () => {
    const user = userEvent.setup()
    await renderRoute('/security')

    await user.click(await screen.findByRole('tab', { name: /Rotations/i }))

    expect(await screen.findByText('Rotation Impact Plans')).toBeVisible()
    expect(screen.getByText('secrets/router/tls-cert')).toBeVisible()
    expect(screen.getByText(/rev-2026-04-11T10-18Z/)).toBeVisible()
    expect(screen.getByText('Restart edge router')).toBeVisible()
    expect(screen.getByText('Reload runtime metadata')).toBeVisible()
    expect(screen.getAllByText(/Remote provider/).length).toBeGreaterThan(0)
    expect(screen.getByText('Manual provider rotation')).toBeVisible()
    for (const button of screen.getAllByRole('button', {
      name: /Apply selected revision/i,
    })) {
      expect(button).toBeDisabled()
    }
    expect(screen.queryByText(/client secret/i)).toBeNull()
    expect(screen.queryByText(/secret value/i)).toBeNull()
  })

  it('shows bulk campaign dry-run plans without enabling apply or leaking values', async () => {
    const user = userEvent.setup()
    await renderRoute('/security')

    await user.click(await screen.findByRole('tab', { name: /Rotations/i }))

    expect(await screen.findByText('Bulk Campaign Planner')).toBeVisible()
    expect(
      await screen.findByText(/bulk-dry-run-2026-04-11T10-24Z/)
    ).toBeVisible()
    expect(
      screen.getByText('services/@serviceadmin/runtime/SESSION_SIGNING_KEY')
    ).toBeVisible()
    expect(
      screen.getByText('services/echo-service/env/API_TOKEN')
    ).toBeVisible()
    expect(screen.getAllByText('Dry run only').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: /Apply campaign/i })
    ).toBeDisabled()
    expect(screen.getByText('Provider authentication required.')).toBeVisible()
    expect(
      screen.getByText('Provider does not advertise bulk reset support.')
    ).toBeVisible()
    expect(screen.queryByText(/fixture-revealed-value/i)).toBeNull()
    expect(screen.queryByText(/secret value/i)).toBeNull()
    expect(screen.queryByText(/provider token/i)).toBeNull()
  })

  it('shows MCP settings, permissions, approvals, and safe diagnostics', async () => {
    const user = userEvent.setup()
    await renderRoute('/mcp')

    expect(await screen.findByText(/streamable-http/i)).toBeVisible()
    expect(screen.getByText('service-lasso-mcp 0.4.0')).toBeVisible()
    expect(screen.getByText('Administrator')).toBeVisible()
    expect(
      screen.getAllByText('mcp.confirmations.resolve').length
    ).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: /Approvals/i }))

    expect(screen.getByText('service.restart · traefik')).toBeVisible()
    expect(
      screen.getByText(/Restart request for the Traefik service/i)
    ).toBeVisible()
    expect(screen.queryByText(/bearer/i)).toBeNull()
    expect(screen.queryByText(/client secret/i)).toBeNull()
  })

  it('shows scoped service access grants on service details', async () => {
    const user = userEvent.setup()
    await renderRoute('/services/traefik')

    await user.click(await screen.findByRole('tab', { name: /Access/i }))

    expect(
      (await screen.findAllByText('Platform Owners')).length
    ).toBeGreaterThan(1)
    expect(screen.getAllByText('Release Operators').length).toBeGreaterThan(1)
    expect(screen.getByText('Traefik restart action')).toBeVisible()
    expect(screen.getByText('Runtime owner')).toBeVisible()
    expect(screen.getByText('Sensitive')).toBeVisible()
    expect(screen.getByText(/final removal/i)).toBeVisible()
  })

  it('reveals managed secret values only inside the explicit reveal boundary', async () => {
    const user = userEvent.setup()
    const revealFixture = 'fixture-revealed-value-425'

    await renderRoute('/services/secrets-broker')

    await user.click(await screen.findByRole('tab', { name: /Secrets/i }))

    expect(
      await screen.findByText(
        'services/@serviceadmin/runtime/SESSION_SIGNING_KEY'
      )
    ).toBeVisible()
    expect(screen.queryByText(revealFixture)).toBeNull()
    expect(
      screen.getByRole('button', {
        name: /Decommission SESSION_SIGNING_KEY/i,
      })
    ).toBeEnabled()

    await user.click(
      screen.getByRole('button', { name: /Reveal SESSION_SIGNING_KEY/i })
    )
    const revealDialog = await screen.findByRole('dialog', {
      name: /Reveal secret/i,
    })
    await user.click(
      within(revealDialog).getByLabelText(/Confirm secret reveal/i)
    )
    await user.click(
      within(revealDialog).getByRole('button', { name: /^Reveal value$/i })
    )

    expect(
      await screen.findByText(/Audit reason is required before reveal/i)
    ).toBeVisible()

    await user.type(
      within(revealDialog).getByLabelText(/Audit reason/i),
      'Operator troubleshooting'
    )
    await user.click(
      within(revealDialog).getByRole('button', { name: /^Reveal value$/i })
    )

    expect(await within(revealDialog).findByText(revealFixture)).toBeVisible()

    await user.click(
      within(revealDialog).getByRole('button', { name: /Clear reveal/i })
    )
    expect(screen.queryByText(revealFixture)).toBeNull()
  })

  it('creates a broker-generated secret through a signed no-overwrite plan', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/secrets-broker')
    await user.click(await screen.findByRole('tab', { name: /Secrets/i }))
    await user.click(
      await screen.findByRole('button', { name: /^Create secret$/i })
    )

    const dialog = await screen.findByRole('dialog', {
      name: /Create local secret/i,
    })
    await user.type(
      within(dialog).getByLabelText(/Secret reference/i),
      'services/sample/runtime/NEW_BROKER_TOKEN'
    )
    await user.type(
      within(dialog).getByLabelText(/Audit reason/i),
      'Approved initial provision'
    )
    expect(within(dialog).queryByLabelText(/Secret value/i)).toBeNull()
    await user.click(
      within(dialog).getByRole('button', { name: /Preview create/i })
    )
    expect(await within(dialog).findByText(/Signed plan ready/i)).toBeVisible()
    expect(within(dialog).getByText(/no overwrite/i)).toBeVisible()
    expect(within(dialog).queryByLabelText(/Secret value/i)).toBeNull()

    await user.click(within(dialog).getByLabelText(/Confirm secret create/i))
    await user.click(
      within(dialog).getByRole('button', { name: /^Create secret$/i })
    )
    expect(
      await within(dialog).findByText(/Secret created and audit recorded/i)
    ).toBeVisible()
    expect(within(dialog).queryByText(/fixture-revealed-value/i)).toBeNull()
  })

  it('decommissions and restores a local secret only through a signed dependency-clear plan', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/secrets-broker')
    await user.click(await screen.findByRole('tab', { name: /Secrets/i }))
    await user.click(
      await screen.findByRole('button', {
        name: /Decommission SESSION_SIGNING_KEY/i,
      })
    )

    const dialog = await screen.findByRole('dialog', {
      name: /Decommission secret/i,
    })
    await user.click(
      within(dialog).getByRole('button', { name: /Check dependencies/i })
    )
    expect(await within(dialog).findByText(/Signed plan ready/i)).toBeVisible()
    expect(within(dialog).getByText(/no dependencies/i)).toBeVisible()

    await user.type(
      within(dialog).getByLabelText(/Audit reason/i),
      'Approved secret retirement'
    )
    await user.click(
      within(dialog).getByLabelText(/Confirm secret decommission/i)
    )
    await user.click(
      within(dialog).getByRole('button', { name: /^Decommission secret$/i })
    )

    expect(
      await within(dialog).findByText(/encrypted tombstone is recoverable/i)
    ).toBeVisible()
    await user.click(within(dialog).getByLabelText(/Confirm secret restore/i))
    await user.click(
      within(dialog).getByRole('button', { name: /^Restore secret$/i })
    )
    expect(
      await within(dialog).findByText(/Secret restored and audit recorded/i)
    ).toBeVisible()
  })

  it('restores a persisted encrypted tombstone after inventory reload', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/secrets-broker')
    await user.click(await screen.findByRole('tab', { name: /Secrets/i }))
    expect(
      await screen.findByText('services/archive/runtime/RECOVERABLE_TOKEN')
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: /Restore RECOVERABLE_TOKEN/i })
    )

    const dialog = await screen.findByRole('dialog', {
      name: /^Restore secret$/i,
    })
    await user.type(
      within(dialog).getByLabelText(/Audit reason/i),
      'Approved recovery after reload'
    )
    await user.click(within(dialog).getByLabelText(/Confirm secret restore/i))
    await user.click(
      within(dialog).getByRole('button', { name: /^Restore secret$/i })
    )
    expect(
      await within(dialog).findByText(/Secret restored and audit recorded/i)
    ).toBeVisible()
  })

  it('shows policy capability truthfully without enabling a fake apply', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/secrets-broker')
    await user.click(await screen.findByRole('tab', { name: /Secrets/i }))
    await user.click(
      await screen.findByRole('button', {
        name: /Policy SESSION_SIGNING_KEY/i,
      })
    )

    const dialog = await screen.findByRole('dialog', {
      name: /Secret policy status/i,
    })
    expect(
      await within(dialog).findByText(/Policy apply unavailable/i)
    ).toBeVisible()
    expect(within(dialog).getByText(/Current binding:/i)).toBeVisible()
    expect(
      within(dialog).getByRole('button', { name: /Apply policy/i })
    ).toBeDisabled()
  })

  it('migrates a secret only after live capability preview and confirmation', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/secrets-broker')
    await user.click(await screen.findByRole('tab', { name: /Secrets/i }))
    await user.click(
      await screen.findByRole('button', {
        name: /Migrate SESSION_SIGNING_KEY/i,
      })
    )

    const dialog = await screen.findByRole('dialog', {
      name: /Migrate secret provider/i,
    })
    await user.type(
      within(dialog).getByLabelText(/Audit reason/i),
      'Approved provider migration'
    )
    await user.click(
      within(dialog).getByRole('button', { name: /Preview migration/i })
    )
    expect(
      await within(dialog).findByText(/Migration dry run ready/i)
    ).toBeVisible()
    const apply = within(dialog).getByRole('button', {
      name: /Apply migration/i,
    })
    expect(apply).toBeDisabled()
    await user.click(
      within(dialog).getByLabelText(/Confirm provider migration/i)
    )
    expect(apply).toBeEnabled()
    await user.click(apply)
    expect(
      await within(dialog).findByText(/Migration outcome: applied/i)
    ).toBeVisible()
  })

  it('rotates a local secret through preview, stage, activation, and rollback without rendering the value', async () => {
    const user = userEvent.setup()
    const replacement = 'rotation-value-must-never-render'

    await renderRoute('/services/secrets-broker')
    await user.click(await screen.findByRole('tab', { name: /Secrets/i }))
    await user.click(
      await screen.findByRole('button', {
        name: /Rotate SESSION_SIGNING_KEY/i,
      })
    )

    const dialog = await screen.findByRole('dialog', {
      name: /Rotate secret/i,
    })
    await user.type(
      within(dialog).getByLabelText(/Audit reason/i),
      'Approved versioned rotation'
    )
    await user.type(
      within(dialog).getByLabelText(/Replacement value/i),
      replacement
    )
    expect(within(dialog).queryByText(replacement)).toBeNull()

    await user.click(
      within(dialog).getByRole('button', { name: /Preview rotation/i })
    )
    expect(await within(dialog).findByText(/Rotation ready/i)).toBeVisible()
    await user.click(
      within(dialog).getByLabelText(/Confirm secret rotation transition/i)
    )
    await user.click(
      within(dialog).getByRole('button', { name: /Stage candidate/i })
    )
    expect(await within(dialog).findByText(/is staged/i)).toBeVisible()
    expect(within(dialog).queryByText(replacement)).toBeNull()

    await user.click(
      within(dialog).getByLabelText(/Confirm secret rotation transition/i)
    )
    await user.click(
      within(dialog).getByRole('button', {
        name: /Activate staged version/i,
      })
    )
    expect(await within(dialog).findByText(/is active/i)).toBeVisible()

    await user.click(
      within(dialog).getByLabelText(/Confirm secret rotation transition/i)
    )
    await user.click(within(dialog).getByRole('button', { name: /Roll back/i }))
    expect(
      await within(dialog).findByText(/Previous version restored/i)
    ).toBeVisible()
    expect(within(dialog).queryByText(replacement)).toBeNull()
  })

  it('edits a local managed secret only after dry-run and explicit confirmation', async () => {
    const user = userEvent.setup()
    const replacement = 'fixture-replacement-must-not-render'

    await renderRoute('/services/secrets-broker')
    await user.click(await screen.findByRole('tab', { name: /Secrets/i }))
    await user.click(
      await screen.findByRole('button', {
        name: /Edit SESSION_SIGNING_KEY/i,
      })
    )

    const dialog = await screen.findByRole('dialog', { name: /Edit secret/i })
    await user.click(
      within(dialog).getByRole('button', { name: /Preview mutation/i })
    )
    expect(
      await within(dialog).findByText(/Audit reason is required/i)
    ).toBeVisible()

    await user.type(
      within(dialog).getByLabelText(/Audit reason/i),
      'Approved credential replacement'
    )
    await user.type(
      within(dialog).getByLabelText(/Replacement value/i),
      replacement
    )
    await user.click(
      within(dialog).getByRole('button', { name: /Preview mutation/i })
    )

    expect(await within(dialog).findByText(/Dry run ready/i)).toBeVisible()
    const apply = within(dialog).getByRole('button', {
      name: /Apply mutation/i,
    })
    expect(apply).toBeDisabled()
    await user.click(within(dialog).getByLabelText(/Confirm secret mutation/i))
    expect(apply).toBeEnabled()
    await user.click(apply)

    expect(
      await within(dialog).findByText(/Mutation applied and audit recorded/i)
    ).toBeVisible()
    expect(within(dialog).queryByDisplayValue(replacement)).toBeNull()
    expect(document.body.textContent).not.toContain(replacement)
  })

  it('keeps remote and metadata-only secret mutation controls disabled', async () => {
    const user = userEvent.setup()

    await renderRoute('/services/secrets-broker')
    await user.click(await screen.findByRole('tab', { name: /Secrets/i }))

    expect(
      await screen.findByRole('button', { name: /Edit client-secret/i })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /Reset client-secret/i })
    ).toBeDisabled()
  })

  it('filters, searches, and opens runtime inbox messages', async () => {
    const user = userEvent.setup()
    await renderRoute('/inbox')

    expect(
      await screen.findByRole('button', {
        name: /Service Admin update downloaded/i,
      })
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Errors/i }))

    expect(
      await screen.findByRole('button', {
        name: /Zitadel readiness probe failed/i,
      })
    ).toBeVisible()
    expect(screen.queryByText(/Service Admin update downloaded/i)).toBeNull()

    await user.clear(screen.getByLabelText(/Search inbox/i))
    await user.type(screen.getByLabelText(/Search inbox/i), 'backup')
    await user.click(screen.getByRole('button', { name: /Workflow/i }))

    expect(
      await screen.findByRole('button', {
        name: /Backup workflow waiting for approval/i,
      })
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', {
        name: /Backup workflow waiting for approval/i,
      })
    )

    expect(screen.getByText(/paused before export/i)).toBeVisible()
    expect(screen.getByRole('link', { name: /Open Workflow/i })).toBeVisible()
  })
})
