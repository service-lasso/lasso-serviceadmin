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
    path: '/dependencies',
    heading: /^Dependencies$/i,
    title: 'Service Admin - Dependencies',
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
    heading: /^Secrets Broker setup$/i,
    title: 'Service Admin - Secrets Broker Setup',
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
})
