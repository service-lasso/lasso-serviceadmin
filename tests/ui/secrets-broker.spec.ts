import { expect, test, type Page, type TestInfo } from '@playwright/test'

const forbiddenSecretMaterialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:bearer|token|api[_-]?key|client[_-]?secret|password)\s*[=:]\s*['"][^'"]{8,}/i,
  /(?:access|refresh|id)[_-]?token\s*[=:]\s*[^\s]{12,}/i,
]

async function expectNoBlankScreen(page: Page) {
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('main')).not.toBeEmpty()
  await expect(page.getByText(/not signed in/i).first()).toBeVisible()
}

async function expectNoSecretMaterial(page: Page) {
  const visibleText = await page.locator('body').innerText()

  for (const pattern of forbiddenSecretMaterialPatterns) {
    expect(
      visibleText,
      `forbidden secret material pattern ${pattern}`
    ).not.toMatch(pattern)
  }
}

test.describe('Secrets Broker browser coverage', () => {
  const consoleErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message)
    })
  })

  test.afterEach(async ({ page }, testInfo: TestInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('route.txt', {
        body: page.url(),
        contentType: 'text/plain',
      })
      await testInfo.attach('console-errors.txt', {
        body: consoleErrors.join('\n') || '(none)',
        contentType: 'text/plain',
      })
      await testInfo.attach('failure-screenshot', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })
    }
  })

  test('loads the broker entry route from navigation without blank-screen errors', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /^Secrets Broker$/ }).click()

    await expect(page).toHaveURL(/\/secrets-broker$/)
    await expectNoBlankScreen(page)
    await expect(
      page.getByRole('heading', { name: /Secrets Broker setup/i })
    ).toBeVisible()
    await expect(page.getByText(/@secretsbroker overview/i)).toBeVisible()
    await expect(
      page.getByText('Secret Sources / Backends', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText('Provider Connections', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText('Audit and events', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText('Diagnostics and troubleshooting', { exact: true })
    ).toBeVisible()
    await expectNoSecretMaterial(page)
    await expect(page.getByText(/values hidden/i).first()).toBeVisible()
    await expect(page.getByText(/raw output scrubbed/i).first()).toBeVisible()
    expect(consoleErrors).toEqual([])
  })

  test('covers healthy degraded offline and unconfigured broker states', async ({
    page,
  }) => {
    await page.goto('/secrets-broker')
    await expectNoBlankScreen(page)

    const previewState = page.locator('#broker-overview-scenario')

    await previewState.selectOption('healthy')
    await expect(page.getByText('@secretsbroker healthy')).toBeVisible()
    await expect(page.getByText(/Broker API is reachable/i)).toBeVisible()

    await previewState.selectOption('degraded')
    await expect(page.getByText('@secretsbroker degraded')).toBeVisible()
    await expect(page.getByText(/source_auth_required/i).first()).toBeVisible()

    await previewState.selectOption('offline')
    await expect(page.getByText('@secretsbroker offline')).toBeVisible()
    await expect(page.getByText('API reachable', { exact: true })).toBeVisible()
    await expect(page.getByText('no', { exact: true }).first()).toBeVisible()

    await previewState.selectOption('unconfigured')
    await expect(page.getByText('@secretsbroker setup needed')).toBeVisible()
    await expect(
      page.getByText(/Add a local encrypted store/i).first()
    ).toBeVisible()

    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })

  test('deep-links to broker surfaces and provider detail with safe metadata only', async ({
    page,
  }) => {
    const sections = [
      ['secret-sources', /Secret Sources \/ Backends/i],
      ['provider-connections', /Provider Connections/i],
      ['audit-events', /Audit and events/i],
      ['diagnostics', /Diagnostics and troubleshooting/i],
    ] as const

    for (const [hash, label] of sections) {
      await page.goto(`/secrets-broker#${hash}`)
      await expectNoBlankScreen(page)
      await expect(page.getByText(label).first()).toBeVisible()
      await expectNoSecretMaterial(page)
    }

    await page.goto('/secrets-broker/local-default')
    await expectNoBlankScreen(page)
    await expect(
      page.getByRole('heading', { name: /Local default encrypted store/i })
    ).toBeVisible()
    await expect(page.getByText(/Safe metadata summary/i)).toBeVisible()
    await expect(page.getByText(/Secret material state/i)).toBeVisible()
    await expect(page.getByText(/Raw value: hidden/i)).toBeVisible()
    await expect(page.getByText(/Copy value: unavailable/i)).toBeVisible()
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })
})
