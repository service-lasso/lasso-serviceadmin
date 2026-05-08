import { expect, test, type Page, type TestInfo } from '@playwright/test'

const fakeRevealValue = 'DEMO_REVEAL_VALUE_42'

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
      if ((await page.locator('body').innerText()).includes(fakeRevealValue)) {
        await page.goto('/secrets-broker')
      }
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
    await page.getByRole('button', { name: /^Secrets Broker$/ }).click()
    await page.getByRole('link', { name: 'Overview / Setup' }).click()

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
      page.locator('main').getByText('Provider Connections', { exact: true })
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

  test('dedicated Secrets Broker navigation reaches each broker sub-page', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^Secrets Broker$/ }).click()

    const navLinks = [
      ['Overview / Setup', /\/secrets-broker$/],
      ['Sources / Backends', /\/secrets-broker#secret-sources$/],
      ['Provider Connections', /\/secrets-broker#provider-connections$/],
      ['Single Reveal', /\/secrets-broker#privileged-secret-reveal$/],
      ['Backup / Keys', /\/secrets-broker#backup-key-management$/],
      ['Workflow Boundaries', /\/secrets-broker#workflow-authoring-boundary$/],
      ['Topology', /\/secrets-broker#secrets-topology$/],
      ['Audit / Events', /\/secrets-broker#audit-events$/],
      ['Diagnostics', /\/secrets-broker#diagnostics$/],
    ] as const

    for (const [name, urlPattern] of navLinks) {
      await page
        .locator('[data-sidebar="menu-sub-button"]')
        .filter({ hasText: name })
        .first()
        .click()
      await expect(page).toHaveURL(urlPattern)
      await expectNoBlankScreen(page)
      await expectNoSecretMaterial(page)
    }

    await expect(
      page.getByRole('link', { name: 'Secret Inventory' })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Policy Simulation' })
    ).toBeVisible()
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

  test('reveals one broker secret only after explicit action and re-hides safely', async ({
    page,
  }) => {
    await page.goto('/secrets-broker#privileged-secret-reveal')
    await expectNoBlankScreen(page)
    await expect(
      page.getByText(/Privileged single-secret reveal/i)
    ).toBeVisible()
    await expect(page.getByText(/Value hidden by default/i)).toBeVisible()
    await expect(
      page.getByText('SESSION_SIGNING_KEY', { exact: true })
    ).toBeVisible()
    await expect(page.getByText(fakeRevealValue)).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: /Reveal secret value/i })
    ).toBeDisabled()

    const revealState = page.locator('#single-secret-reveal-state')
    for (const state of [
      'auth-required',
      'policy-denied',
      'broker-offline',
      'unconfigured',
      'audit-unavailable',
    ]) {
      await revealState.selectOption(state)
      await expect(
        page.getByRole('button', { name: /Reveal secret value/i })
      ).toBeDisabled()
      await expect(page.getByText(fakeRevealValue)).toHaveCount(0)
    }

    await revealState.selectOption('allowed')
    await expect(
      page.getByRole('button', { name: /Reveal secret value/i })
    ).toBeEnabled()
    await page.getByRole('button', { name: /Reveal secret value/i }).click()
    await expect(page.getByText(fakeRevealValue)).toBeVisible()
    await expect(
      page.getByText(/Audit event recorded: audit-reveal-001/i)
    ).toBeVisible()
    await expect(page).toHaveURL(/\/secrets-broker#privileged-secret-reveal$/)
    expect(page.url()).not.toContain(fakeRevealValue)
    expect(consoleErrors.join('\n')).not.toContain(fakeRevealValue)
    await expect(
      page.getByRole('button', { name: /Copy secret/i })
    ).toHaveCount(0)

    await page.getByRole('button', { name: /Expire reveal window/i }).click()
    await expect(
      page.getByText(/Reveal window expired; value re-hidden/i)
    ).toBeVisible()
    await expect(page.getByText(fakeRevealValue)).toHaveCount(0)
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })

  test('deep-links to broker surfaces and provider detail with safe metadata only', async ({
    page,
  }) => {
    const sections = [
      ['privileged-secret-reveal', /Privileged single-secret reveal/i],
      ['secret-sources', /Secret Sources \/ Backends/i],
      ['provider-connections', /Provider Connections/i],
      ['backup-key-management', /Backup, restore, and key management/i],
      ['workflow-authoring-boundary', /Workflow authoring boundary/i],
      ['secrets-topology', /Secrets Broker topology/i],
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
