import { screen, waitFor } from '@testing-library/react'
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
    path: '/services/@serviceadmin',
    heading: /^Service Admin UI$/i,
    title: 'Service Admin - Service - Service Admin UI',
  },
  {
    path: '/fleet-overview',
    heading: /^Fleet overview planning$/i,
    title: 'Service Admin - Fleet Overview',
  },
  {
    path: '/dependencies',
    heading: /^Dependencies$/i,
    title: 'Service Admin - Dependencies',
  },
  {
    path: '/service-routes',
    heading: /^Service routes$/i,
    title: 'Service Admin - Service Routes',
  },
  { path: '/apps', heading: /^App Integrations$/i },
  { path: '/chats', heading: /^Inbox$/i },
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
    path: '/secrets-broker',
    heading: /^Overview$/i,
    title: 'Service Admin - Secrets Broker Overview',
  },
  {
    path: '/secrets-broker/sources',
    heading: /^Secrets Broker providers$/i,
    title: 'Service Admin - Secrets Broker Providers',
  },
  {
    path: '/secrets-broker/operational-controls',
    heading: /^Secrets Broker operational controls$/i,
    title: 'Service Admin - Secrets Broker Operational Controls',
  },
  {
    path: '/secrets-broker/topology',
    heading: /^Secrets Broker topology$/i,
    title: 'Service Admin - Secrets Broker Topology',
  },
  {
    path: '/secrets-broker/audit-events',
    heading: /^Secrets Broker audit events$/i,
    title: 'Service Admin - Secrets Broker Audit Events',
  },
  {
    path: '/operations/telemetry',
    heading: /^Telemetry$/i,
    title: 'Service Admin - Operations Telemetry',
  },
  {
    path: '/operations/audit-logging',
    heading: /^Audit Logging$/i,
    title: 'Service Admin - Operations Audit Logging',
  },
  {
    path: '/auth-session',
    heading: /^Trusted SSO identity context$/i,
    title: 'Service Admin - Trusted SSO Identity',
  },
  {
    path: '/network',
    heading: /^Network$/i,
    title: 'Service Admin - Network',
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

const removedSecretsBrokerRoutes = [
  ['/secrets-broker/provider-connections', '/secrets-broker/sources'],
  ['/secrets-broker/configuration', '/secrets-broker/sources'],
  ['/secrets-broker/diagnostics', '/secrets-broker/sources'],
  ['/secrets-broker/secret-inventory', '/secrets-broker/sources'],
  ['/secrets-broker/workflow-boundaries', '/secrets-broker/sources'],
  ['/secrets-broker/single-reveal', '/secrets-broker/secrets'],
  ['/secrets-broker/policy-simulation', '/secrets-broker/operational-controls'],
  ['/support-bundle', '/secrets-broker/sources'],
] as const

const compatibleSecretsBrokerRoutes: ScreenCase[] = [
  {
    path: '/secrets-broker/backup-keys',
    heading: /^Local encrypted store$/i,
    title: 'Service Admin - Local Encrypted Store',
  },
]

describe('app screens', () => {
  it.each(appScreens)('renders $path', async ({ path, heading, title }) => {
    await renderRoute(path)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: heading })).toBeVisible()
    })

    if (title) {
      await waitFor(() => {
        expect(document.title).toBe(title)
      })
    }
  })

  it.each(removedSecretsBrokerRoutes)(
    'redirects removed Secrets Broker route %s to %s',
    async (path, redirectedPath) => {
      const { router } = await renderRoute(path)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(redirectedPath)
      })
    }
  )

  it.each(compatibleSecretsBrokerRoutes)(
    'keeps legacy Secrets Broker route $path compatible',
    async ({ path, heading, title }) => {
      await renderRoute(path)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: heading })).toBeVisible()
      })

      if (title) {
        await waitFor(() => {
          expect(document.title).toBe(title)
        })
      }
    }
  )
})
