import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderRoute } from './render-route'

type ScreenCase = {
  path: string
  heading?: RegExp
  title?: string
}

type HeaderIdentityCase = {
  path: string
  identity: string
  removedHeading: RegExp
  removedCopy?: RegExp
}

const appScreens: ScreenCase[] = [
  {
    path: '/',
    title: 'Service Admin - Dashboard',
  },
  {
    path: '/services',
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
    title: 'Service Admin - Dependencies',
  },
  {
    path: '/service-routes',
    title: 'Service Admin - Service Routes',
  },
  {
    path: '/runtime',
    title: 'Service Admin - Runtime',
  },
  {
    path: '/installed',
    title: 'Service Admin - Installed',
  },
  {
    path: '/variables',
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
    path: '/secrets-broker/configuration',
    heading: /^Configuration$/i,
    title: 'Service Admin - Secrets Broker Configuration',
  },
  {
    path: '/secrets-broker/topology',
    title: 'Service Admin - Secrets Broker Topology',
  },
  {
    path: '/operations/telemetry',
    title: 'Service Admin - Operations Telemetry',
  },
  {
    path: '/operations/audit-logging',
    title: 'Service Admin - Operations Audit',
  },
  {
    path: '/auth-session',
    heading: /^Trusted SSO identity context$/i,
    title: 'Service Admin - Trusted SSO Identity',
  },
  {
    path: '/network',
    title: 'Service Admin - Network',
  },
  {
    path: '/help-center',
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
  ['/secrets-broker/diagnostics', '/secrets-broker/sources'],
  ['/secrets-broker/secret-inventory', '/secrets-broker/sources'],
  ['/secrets-broker/workflow-boundaries', '/secrets-broker/sources'],
  ['/secrets-broker/single-reveal', '/secrets-broker/secrets'],
  ['/secrets-broker/operational-controls', '/operations/audit-logging'],
  ['/secrets-broker/policy-simulation', '/operations/audit-logging'],
  ['/secrets-broker/audit-events', '/operations/audit-logging'],
  ['/support-bundle', '/secrets-broker/sources'],
] as const

const removedTemplateRoutes = [
  ['/apps', '/services'],
  ['/chats', '/operations/audit-logging'],
  ['/tasks', '/runtime'],
  ['/users', '/auth-session'],
] as const

const compatibleSecretsBrokerRoutes: ScreenCase[] = [
  {
    path: '/secrets-broker/backup-keys',
    heading: /^Local encrypted store$/i,
    title: 'Service Admin - Local Encrypted Store',
  },
]

const headerIdentityRoutes: HeaderIdentityCase[] = [
  {
    path: '/',
    identity: 'Dashboard',
    removedHeading: /^Dashboard$/i,
    removedCopy: /Monitor runtime health, launch service actions/i,
  },
  {
    path: '/services',
    identity: 'Services',
    removedHeading: /^Services$/i,
    removedCopy:
      /Manage Service Lasso services, inspect runtime state, and open the detail view/i,
  },
  {
    path: '/dependencies',
    identity: 'Dependencies',
    removedHeading: /^Dependencies$/i,
    removedCopy: /inspect dependency topology/i,
  },
  {
    path: '/service-routes',
    identity: 'Routes',
    removedHeading: /^Service routes$/i,
    removedCopy: /Inspect each service endpoint/i,
  },
  {
    path: '/runtime',
    identity: 'Runtime',
    removedHeading: /^Runtime$/i,
    removedCopy: /Runtime state, health, and check history/i,
  },
  {
    path: '/installed',
    identity: 'Installed',
    removedHeading: /^Installed$/i,
    removedCopy: /Installed services and paths/i,
  },
  {
    path: '/variables',
    identity: 'Variables',
    removedHeading: /^Variables$/i,
    removedCopy: /Shared and service-local values/i,
  },
  {
    path: '/secrets-broker/topology',
    identity: 'Topology',
    removedHeading: /^Secrets Broker topology$/i,
    removedCopy: /Service variables, SecretRef mappings/i,
  },
  {
    path: '/operations/telemetry',
    identity: 'Telemetry',
    removedHeading: /^Telemetry$/i,
    removedCopy: /Service Lasso runtime and Secrets Broker telemetry status/i,
  },
  {
    path: '/operations/audit-logging',
    identity: 'Audit',
    removedHeading: /^Audit$/i,
    removedCopy: /Metadata-only operation events/i,
  },
  {
    path: '/network',
    identity: 'Network',
    removedHeading: /^Network$/i,
    removedCopy: /Endpoints and exposure facts/i,
  },
  {
    path: '/help-center',
    identity: 'Help Center',
    removedHeading: /^Help Center$/i,
    removedCopy: /Guides and runbooks/i,
  },
]

describe('app screens', () => {
  it.each(appScreens)('renders $path', async ({ path, heading, title }) => {
    await renderRoute(path)

    if (heading) {
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: heading })).toBeVisible()
      })
    }

    if (title) {
      await waitFor(() => {
        expect(document.title).toBe(title)
      })
    }
  })

  it.each(headerIdentityRoutes)(
    'moves $identity page identity into the header without a duplicated body heading',
    async ({ path, identity, removedHeading, removedCopy }) => {
      await renderRoute(path)

      await waitFor(() => {
        expect(screen.getByTestId('active-page-identity')).toHaveAccessibleName(
          `Current page: ${identity}`
        )
      })

      expect(
        screen.queryByRole('heading', { name: removedHeading })
      ).not.toBeInTheDocument()

      if (removedCopy) {
        expect(screen.queryByText(removedCopy)).not.toBeInTheDocument()
      }
    }
  )

  it.each(removedSecretsBrokerRoutes)(
    'redirects removed Secrets Broker route %s to %s',
    async (path, redirectedPath) => {
      const { router } = await renderRoute(path)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(redirectedPath)
      })
    }
  )

  it.each(removedTemplateRoutes)(
    'redirects removed template route %s to %s',
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
