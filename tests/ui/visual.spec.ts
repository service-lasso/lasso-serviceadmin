import { expect, test, type Page, type Route } from '@playwright/test'

const serviceId = 'dagu'
const terminalUrl = `**/api/services/${serviceId}/terminal**`
const readyText = 'E2E-TUI READY'

type Screen = {
  name: string
  path: string
  ready: (page: Page) => Promise<void>
}

const screens: Screen[] = [
  {
    name: 'dashboard',
    path: '/',
    ready: async (page) => {
      await expect(
        page.getByText('Runtime health', { exact: true })
      ).toBeVisible()
    },
  },
  {
    name: 'services',
    path: '/services',
    ready: async (page) => {
      await expect(page.getByTestId('data-table-scroll-region')).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Start all', exact: true })
      ).toBeVisible()
    },
  },
  {
    name: 'service-detail',
    path: '/services/@serviceadmin',
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { name: 'Service Admin UI' })
      ).toBeVisible()
    },
  },
  {
    name: 'operations-telemetry',
    path: '/operations/telemetry',
    ready: async (page) => {
      await expect(
        page.getByText('Service Lasso signals', { exact: true })
      ).toBeVisible()
    },
  },
  {
    name: 'settings-appearance',
    path: '/settings/appearance',
    ready: async (page) => {
      await expect(
        page.getByRole('heading', { name: 'Appearance' })
      ).toBeVisible()
    },
  },
]

function json(route: Route, value: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(value),
  })
}

async function installTerminalRoutes(page: Page) {
  await page.route(terminalUrl, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    const method = request.method()
    const state = {
      serviceId,
      available: true,
      rows: 24,
      cols: 80,
      sequence: 0,
      childPid: 4242,
      error: null,
      readOnly: false,
      reason: null,
    }

    if (method === 'GET' && pathname.endsWith('/terminal')) {
      return json(route, state)
    }

    if (method === 'POST' && pathname.endsWith('/terminal/attach')) {
      return json(route, {
        serviceId,
        sessionToken: 'visual-session-token',
        readOnly: false,
        rows: 24,
        cols: 80,
        expiresAt: Date.now() + 60_000,
      })
    }

    if (method === 'GET' && pathname.endsWith('/terminal/output')) {
      const after = Number(
        new URL(request.url()).searchParams.get('after') ?? '0'
      )
      if (after === 0) {
        return json(route, {
          ...state,
          sequence: 1,
          data: Buffer.from(`${readyText}\r\n`).toString('base64'),
          truncated: false,
        })
      }
      return json(route, {
        ...state,
        sequence: after,
        data: '',
        truncated: false,
      })
    }

    if (method === 'POST' && pathname.endsWith('/terminal/input')) {
      return json(route, { serviceId, accepted: true, byteLength: 0 })
    }

    if (method === 'POST' && pathname.endsWith('/terminal/resize')) {
      return json(route, {
        serviceId,
        resized: true,
        rows: state.rows,
        cols: state.cols,
      })
    }

    return route.fulfill({ status: 404, body: 'not found' })
  })
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

test.describe('visual regression', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  for (const screen of screens) {
    test(`${screen.name} matches the committed Linux baseline`, async ({
      page,
    }) => {
      await page.goto(screen.path)
      await screen.ready(page)
      await settle(page)
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveScreenshot(`${screen.name}.png`, {
        fullPage: true,
      })
    })
  }

  test('terminal matches the committed Linux baseline', async ({ page }) => {
    await installTerminalRoutes(page)
    await page.goto(`/services/${serviceId}?tab=terminal`)

    const terminal = page.getByTestId('service-detail-terminal')
    await expect(terminal).toBeVisible()
    await expect(page.locator('.xterm')).toContainText(readyText, {
      timeout: 15_000,
    })
    await page.addStyleTag({
      content: '.xterm-cursor { visibility: hidden !important; }',
    })
    await settle(page)
    await expect(terminal).toHaveScreenshot('terminal.png')
  })
})
