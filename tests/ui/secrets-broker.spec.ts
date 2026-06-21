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
  await expect(
    page
      .getByRole('button', { name: /Service Lasso instance selector/i })
      .first()
  ).toBeVisible()
  await expect(page.getByText(/not signed in/i)).toHaveCount(0)
  await expect(page.getByText(/no active session/i)).toHaveCount(0)
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
    await page.getByRole('link', { name: 'Overview' }).click()

    await expect(page).toHaveURL(/\/secrets-broker$/)
    await expectNoBlankScreen(page)
    await expect(
      page.getByRole('heading', { name: /^Overview$/i })
    ).toBeVisible()
    await expect(page.getByText(/@secretsbroker overview/i)).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'View providers' })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add provider' })).toBeVisible()
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Audit Logging' })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'View provider status' })
    ).toBeVisible()
    await expectNoSecretMaterial(page)
    await expect(page.getByText(/raw values hidden/i).first()).toBeVisible()
    expect(consoleErrors).toEqual([])
  })

  test('dedicated Secrets Broker navigation reaches each broker sub-page', async ({
    page,
  }) => {
    await page.goto('/')

    const navLinks = [
      ['Overview', /\/secrets-broker$/],
      ['Secrets', /\/secrets-broker\/secrets$/],
      ['Providers', /\/secrets-broker\/sources$/],
      ['Topology', /\/secrets-broker\/topology$/],
    ] as const

    await expect(
      page
        .locator('[data-sidebar="menu-button"]')
        .filter({ hasText: 'Backup / Keys' })
    ).toHaveCount(0)
    await expect(
      page
        .locator('[data-sidebar="menu-button"]')
        .filter({ hasText: 'Operational Controls' })
    ).toHaveCount(0)

    for (const [name, urlPattern] of navLinks) {
      await page
        .locator('[data-sidebar="menu-button"]')
        .filter({ hasText: name })
        .first()
        .click()
      await expect(page).toHaveURL(urlPattern)
      await expectNoBlankScreen(page)
      await expectNoSecretMaterial(page)
    }

    expect(consoleErrors).toEqual([])
  })

  test('covers the Secrets sub-page table search and safe action previews', async ({
    page,
  }) => {
    await page.goto('/secrets-broker/secrets')
    await expectNoBlankScreen(page)
    await expect(page.getByRole('heading', { name: /^Secrets$/ })).toBeVisible()
    await expect(page.getByText(/Operator queue/i)).toBeVisible()
    await expect(page.getByText(/Find a ref/i)).toBeVisible()
    await expect(page.getByText(/Pick row action/i)).toBeVisible()
    await expect(page.getByText(/Dry-run before apply/i)).toBeVisible()
    await expect(page.getByText(/Preview actions/i)).toBeVisible()
    await expect(page.getByText(/Stub preview · values hidden/i)).toBeVisible()
    await expect(page.getByText(/SESSION_SIGNING_KEY/i).first()).toBeVisible()
    await expect(page.getByText(/ZITADEL_CLIENT_CREDENTIAL/i)).toBeVisible()
    await expect(
      page.getByText(/Readiness: 5 ready \/ 0 blocked/i).first()
    ).toBeVisible()

    await page.getByPlaceholder(/Search secret metadata/i).fill('payments')
    await expect(page.getByText(/PAYMENTS_SIGNING_REF/i)).toBeVisible()
    await expect(page.getByText(/Metadata matches: 1/i)).toBeVisible()
    await expect(
      page.getByText(/Readiness: 0 ready \/ 5 blocked/i)
    ).toBeVisible()

    await page.getByLabel(/Broker-backed value search/i).fill('session')
    await expect(page.getByText(/Value search unsupported/i)).toBeVisible()
    await page
      .getByRole('button', { name: /Simulate supported value search/i })
      .click()
    await expect(
      page.getByText(/Value search supported: 1 safe ref metadata match/i)
    ).toBeVisible()

    await page.getByPlaceholder(/Search secret metadata/i).fill('')
    await expect(page.getByText(/SESSION_SIGNING_KEY/i).first()).toBeVisible()

    await page
      .getByRole('button', { name: /Controlled reveal/i })
      .first()
      .click()
    await expect(page.getByText(/Uses the #38 reveal pattern/i)).toBeVisible()
    await page
      .getByRole('button', { name: /Edit\/update dry-run/i })
      .first()
      .click()
    await expect(
      page.getByText(/dry-run required before apply|blocked: ref unavailable/i)
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: /Apply disabled until dry-run preview is accepted/i,
      })
    ).toBeDisabled()
    await page
      .getByRole('button', { name: /Delete dry-run/i })
      .first()
      .click()
    await expect(
      page.getByText(/Delete dry-run for SESSION_SIGNING_KEY/i)
    ).toBeVisible()
    await expect(
      page.getByText(/delete preview required before apply/i)
    ).toBeVisible()
    await expect(
      page.getByText(/dependent service references and recovery guidance/i)
    ).toBeVisible()
    await expect(page.getByText(/recoveryPlanRef/i)).toBeVisible()
    await page
      .getByRole('button', { name: /Apply policy preview/i })
      .first()
      .click()
    await expect(
      page.getByText(/target policy assignment diff checked/i)
    ).toBeVisible()
    await expect(page.getByText(/targetPolicyRef/i)).toBeVisible()

    await page.getByPlaceholder(/Search secret metadata/i).fill('payments')
    await page.getByRole('button', { name: /Delete dry-run/ }).click()
    await expect(page.getByText(/Selected action readiness/i)).toBeVisible()
    await expect(page.getByText(/blocked fail closed/i).first()).toBeVisible()
    await expect(page.getByText(/ref unavailable/i).first()).toBeVisible()
    await expect(
      page.getByText(/delete dry-run unsupported/i).first()
    ).toBeVisible()

    await page.getByPlaceholder(/Search secret metadata/i).fill('')
    await page
      .getByRole('button', { name: /Reset\/rotate dry-run/i })
      .first()
      .click()
    await expect(page.getByText(/Single-secret preview gate/i)).toBeVisible()
    await expect(
      page.getByText(/Single-secret operation history/i)
    ).toBeVisible()
    await expect(page.getByText(/0 submitted/i)).toBeVisible()
    await expect(page.getByText(/audit reason required/i).first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Simulate stub apply/i })
    ).toBeDisabled()
    await page
      .getByLabel(/Audit reason for stub preview/i)
      .fill('operator requested preview')
    await page.getByLabel(/I confirm this is a stub preview/i).check()
    await expect(page.getByText(/Stub apply can be simulated/i)).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Simulate stub apply/i })
    ).toBeEnabled()
    await page.getByLabel(/Stub API state/i).selectOption('success')
    await expect(page.getByText(/Stub apply success/i).last()).toBeVisible()
    await page.getByLabel(/Stub API state/i).selectOption('failure')
    await expect(page.getByText(/Stub apply failure/i).last()).toBeVisible()
    await page.getByRole('button', { name: /Cancel stub preview/i }).click()
    await expect(page.getByText(/cancelled by operator/i)).toBeVisible()

    await expect(page.getByText(/DEMO_REVEAL_VALUE_42/i)).toHaveCount(0)
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })

  test('submits a single-secret rotate preview without revealing the value', async ({
    page,
  }) => {
    await page.goto('/secrets-broker/secrets')
    await expectNoBlankScreen(page)

    await page
      .getByRole('button', { name: /Reset\/rotate dry-run/i })
      .first()
      .click()
    await expect(
      page.getByText(/Reset\/rotate dry-run for SESSION_SIGNING_KEY/i)
    ).toBeVisible()
    await page
      .getByLabel(/Audit reason for stub preview/i)
      .fill('operator requested rotation preview')
    await page.getByLabel(/I confirm this is a stub preview/i).check()
    await page.getByRole('button', { name: /Simulate stub apply/i }).click()

    await expect(
      page.getByText(/Single-secret operation result: submitted/i)
    ).toBeVisible()
    await expect(page.getByText(/1 submitted/i)).toBeVisible()
    await expect(page.getByText(/audit-reset-serviceadmin/i)).toBeVisible()
    await expect(page.getByText(/submitted to broker/i).first()).toBeVisible()
    await expect(page.getByText(/raw value was not revealed/i)).toBeVisible()
    await expect(
      page.getByText(/rotation can be requested without controlled reveal/i)
    ).toBeVisible()
    await expect(
      page.getByText(/rotation retry is operation-id scoped/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/retry only by operation id/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/track rotation operation id until provider status/i)
    ).toBeVisible()
    await page.getByLabel(/Result status/i).selectOption('applied')
    await page.getByLabel(/Stub API state/i).selectOption('ready')
    await page.getByRole('button', { name: /Simulate stub apply/i }).click()
    await expect(
      page.getByText(/Single-secret operation result: applied/i)
    ).toBeVisible()
    await expect(page.getByText(/broker applied/i).first()).toBeVisible()
    await expect(
      page.getByText(/operation settled with broker success metadata/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/no retry needed after broker success/i).first()
    ).toBeVisible()
    await expect(page.getByText(/2 submitted/i)).toBeVisible()
    await expect(page.getByText(/DEMO_REVEAL_VALUE_42/i)).toHaveCount(0)
    await expectNoSecretMaterial(page)
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
      ['/secrets-broker/sources', /Secrets Broker providers/i],
      ['/secrets-broker/backup-keys', /Local encrypted store/i],
      ['/secrets-broker/topology', /Secrets Broker topology/i],
      ['/operations/audit-logging', /Audit Logging/i],
    ] as const

    for (const [path, label] of sections) {
      await page.goto(path)
      await expectNoBlankScreen(page)
      await expect(page.getByText(label).first()).toBeVisible()
      await expectNoSecretMaterial(page)
    }

    const removedRoutes = [
      ['/secrets-broker/provider-connections', /\/secrets-broker\/sources$/],
      ['/secrets-broker/configuration', /\/secrets-broker\/sources$/],
      ['/secrets-broker/diagnostics', /\/secrets-broker\/sources$/],
      ['/secrets-broker/secret-inventory', /\/secrets-broker\/sources$/],
      ['/secrets-broker/workflow-boundaries', /\/secrets-broker\/sources$/],
      ['/secrets-broker/single-reveal', /\/secrets-broker\/secrets$/],
      ['/secrets-broker/operational-controls', /\/operations\/audit-logging$/],
      ['/secrets-broker/policy-simulation', /\/operations\/audit-logging$/],
      ['/secrets-broker/audit-events', /\/operations\/audit-logging$/],
    ] as const

    for (const [path, urlPattern] of removedRoutes) {
      await page.goto(path)
      await expect(page).toHaveURL(urlPattern)
      await expectNoBlankScreen(page)
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
    await expect(
      page.getByText(/Single-connection edit and rotation workflow/i)
    ).toBeVisible()
    await page.getByLabel(/Workflow state/i).selectOption('dry-run-denied')
    await expect(page.getByText(/Dry-run denied by policy/i)).toBeVisible()
    await page.getByLabel(/Workflow state/i).selectOption('auth-required')
    await expect(page.getByText(/Provider auth required/i)).toBeVisible()
    await page.getByLabel(/Workflow state/i).selectOption('backend-unavailable')
    await expect(
      page.getByText(/Backend unavailable or unsupported/i)
    ).toBeVisible()
    await page.getByLabel(/Workflow state/i).selectOption('audit-unavailable')
    await expect(
      page.getByText(/Audit unavailable \/ apply blocked/i).last()
    ).toBeVisible()
    await page.getByLabel(/Workflow state/i).selectOption('apply-ready')
    await page.getByLabel(/Audit reason/i).fill('rotate after approval')
    await page.getByLabel(/Confirm connection id/i).fill('local-default')
    await expect(
      page.getByRole('button', { name: /Apply single-connection rotation/i })
    ).toBeEnabled()
    await page.getByRole('button', { name: /Cancel operation/i }).click()
    await expect(page.getByText(/Operation cancelled/i)).toBeVisible()
    await page.getByLabel(/Workflow state/i).selectOption('apply-failed')
    await expect(
      page.getByText(/Apply failure status feedback/i).last()
    ).toBeVisible()
    await expect(
      page.getByText(/DETERMINISTIC_FAKE_ROTATION_VALUE_81/i)
    ).toHaveCount(0)
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })

  test('covers Providers page actions and add-provider setup dialog', async ({
    page,
  }) => {
    await page.goto('/secrets-broker/sources')
    await expectNoBlankScreen(page)
    await expect(
      page.getByRole('heading', { name: /Secrets Broker providers/i })
    ).toBeVisible()
    await expect(page.getByText(/Local encrypted store/i).first()).toBeVisible()

    await page.getByRole('button', { name: /^Actions$/i }).click()
    await page.getByRole('menuitem', { name: /Test connection/i }).click()
    await expect(page.getByText(/Provider connection test/i)).toBeVisible()
    await expect(
      page.getByText(/latest metadata test failed closed/i)
    ).toBeVisible()
    await expect(
      page.getByText(/refs, namespaces, state, and audit metadata only/i)
    ).toBeVisible()

    await page.getByRole('button', { name: /^Actions$/i }).click()
    await page.getByRole('menuitem', { name: /Reconnect/i }).click()
    await expect(page.getByText(/Provider reconnect workflow/i)).toBeVisible()
    await expect(
      page.getByText(/raw provider credentials are never entered here/i)
    ).toBeVisible()

    await page.getByRole('button', { name: /^Add provider$/i }).click()
    await expect(
      page.getByRole('dialog', { name: /^Add provider$/i })
    ).toBeVisible()
    await expect(page.getByText(/Environment provider/i)).toBeVisible()
    await expect(page.getByText(/AWS Secrets Manager CLI/i)).toBeVisible()
    await page.getByRole('button', { name: /Environment provider/i }).click()
    await expect(page.getByText(/Add provider metadata setup/i)).toBeVisible()
    await expect(page.getByText(/setup preview ready/i)).toBeVisible()
    await expect(
      page.getByText(/provider credentials stay outside Service Admin/i)
    ).toBeVisible()

    await page.getByPlaceholder(/Search providers/i).fill('aws')
    await expect(page.getByText(/No enabled providers match/i)).toBeVisible()
    await expect(page.getByText(/DEMO_REVEAL_VALUE_42/i)).toHaveCount(0)
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })
})
