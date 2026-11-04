import { expect, test, type Page, type Route } from '@playwright/test'

const serviceId = 'dagu'
const terminalUrl = `**/api/services/${serviceId}/terminal**`
const readyText = 'E2E-TUI READY'

type TerminalState = {
  serviceId: string
  available: boolean
  rows: number
  cols: number
  sequence: number
  childPid: number | null
  error: string | null
  readOnly: boolean
  reason: string | null
}

function state(overrides: Partial<TerminalState> = {}): TerminalState {
  return {
    serviceId,
    available: true,
    rows: 24,
    cols: 80,
    sequence: 0,
    childPid: 4242,
    error: null,
    readOnly: false,
    reason: null,
    ...overrides,
  }
}

function json(route: Route, value: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(value),
  })
}

async function installTerminalRoutes(
  page: Page,
  overrides: Partial<TerminalState> = {}
) {
  const inputBodies: string[] = []
  const inputTokens: (string | undefined)[] = []
  const resizeBodies: Array<{ rows: number; cols: number }> = []
  let outputServed = false

  await page.route(terminalUrl, async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    const method = request.method()

    if (method === 'GET' && pathname.endsWith('/terminal')) {
      return json(route, state(overrides))
    }

    if (method === 'POST' && pathname.endsWith('/terminal/attach')) {
      return json(route, {
        serviceId,
        sessionToken: 'e2e-session-token',
        readOnly: overrides.readOnly ?? false,
        rows: 24,
        cols: 80,
        expiresAt: Date.now() + 60_000,
      })
    }

    if (method === 'GET' && pathname.endsWith('/terminal/output')) {
      const after = Number(
        new URL(request.url()).searchParams.get('after') ?? '0'
      )
      if (after === 0 && !outputServed) {
        outputServed = true
        return json(route, {
          ...state(overrides),
          sequence: 1,
          data: Buffer.from(`${readyText}\r\n`).toString('base64'),
          truncated: false,
        })
      }
      return json(route, {
        ...state(overrides),
        sequence: Math.max(after, 1),
        data: '',
        truncated: false,
      })
    }

    if (method === 'POST' && pathname.endsWith('/terminal/input')) {
      const body = request.postDataJSON() as { data?: string }
      inputBodies.push(body.data ?? '')
      inputTokens.push(request.headers()['x-service-lasso-terminal-token'])
      return json(route, {
        serviceId,
        accepted: true,
        byteLength: body.data?.length ?? 0,
      })
    }

    if (method === 'POST' && pathname.endsWith('/terminal/resize')) {
      const body = request.postDataJSON() as { rows: number; cols: number }
      resizeBodies.push(body)
      return json(route, {
        serviceId,
        resized: true,
        rows: body.rows,
        cols: body.cols,
      })
    }

    return route.fulfill({ status: 404, body: 'not found' })
  })

  return {
    typedText: () =>
      Buffer.concat(
        inputBodies.map((value) => Buffer.from(value, 'base64'))
      ).toString('utf8'),
    inputCount: () => inputBodies.length,
    inputTokens,
    resizeBodies,
  }
}

async function openTerminalTab(page: Page) {
  await page.goto(`/services/${serviceId}?tab=terminal`)
  await expect(page.getByTestId('service-detail-terminal')).toBeVisible()
  await expect(page.locator('.xterm')).toBeVisible({ timeout: 15_000 })
}

test('terminal tab renders xterm output, forwards keys, resize, and the attach token', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const terminal = await installTerminalRoutes(page)

  await openTerminalTab(page)
  await expect(page.locator('.xterm')).toContainText(readyText, {
    timeout: 15_000,
  })

  await page.locator('.xterm').click()
  await page.keyboard.type('hello')
  await page.keyboard.press('Enter')
  await expect.poll(terminal.typedText).toContain('hello')

  expect(
    terminal.inputTokens.every((token) => token === 'e2e-session-token')
  ).toBe(true)

  terminal.resizeBodies.length = 0
  await page.setViewportSize({ width: 1080, height: 720 })
  await expect.poll(() => terminal.resizeBodies.length).toBeGreaterThan(0)
  expect(terminal.resizeBodies[0].rows).toBeGreaterThan(0)
  expect(terminal.resizeBodies[0].cols).toBeGreaterThan(0)

  expect(pageErrors).toEqual([])
})

test('read-only terminal renders output but never forwards input', async ({
  page,
}) => {
  const terminal = await installTerminalRoutes(page, { readOnly: true })

  await openTerminalTab(page)
  await expect(page.locator('.xterm')).toContainText(readyText, {
    timeout: 15_000,
  })

  await page.locator('.xterm').click()
  await page.keyboard.type('should-not-send')
  await page.waitForTimeout(500)

  expect(terminal.inputCount()).toBe(0)
})
