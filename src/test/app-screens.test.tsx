import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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

  it('shows unread Inbox count in primary navigation', async () => {
    await renderRoute('/')

    expect(
      await screen.findByRole('link', { name: /^Inbox, 3 unread$/i })
    ).toBeVisible()
  })

  it('shows compact empty setup state on service details', async () => {
    const user = userEvent.setup()
    await renderRoute('/services/service-admin')

    await user.click(await screen.findByRole('tab', { name: /Setup/i }))

    expect(
      await screen.findByText(/No setup steps are declared for this service/i)
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
    expect(
      screen.getByRole('link', { name: /Open Workflow/i })
    ).toBeVisible()
  })
})
