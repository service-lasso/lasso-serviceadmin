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
    for (const deleteButton of screen.getAllByRole('button', {
      name: /Delete/i,
    })) {
      expect(deleteButton).toBeDisabled()
    }

    await user.click(
      screen.getByRole('button', { name: /Reveal SESSION_SIGNING_KEY/i })
    )
    await user.click(screen.getByRole('button', { name: /^Reveal value$/i }))

    expect(
      await screen.findByText(/Audit reason is required before reveal/i)
    ).toBeVisible()

    await user.type(
      screen.getByLabelText(/Audit reason/i),
      'Operator troubleshooting'
    )
    await user.click(screen.getByRole('button', { name: /^Reveal value$/i }))

    const dialog = await screen.findByRole('dialog', {
      name: /Reveal secret/i,
    })
    expect(await within(dialog).findByText(revealFixture)).toBeVisible()

    await user.click(
      within(dialog).getByRole('button', { name: /Clear reveal/i })
    )
    expect(screen.queryByText(revealFixture)).toBeNull()
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
