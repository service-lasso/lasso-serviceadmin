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
    await expect(
      page.getByText(/Controlled reveal challenge preview/i)
    ).toBeVisible()
    await expect(page.getByText(/reveal challenge blocked/i)).toBeVisible()
    await expect(
      page.getByText(/challenge-reveal-serviceadmin-session-signing-metadata/i)
    ).toBeVisible()
    await expect(
      page.getByText(/audit-reveal-serviceadmin-session-signing-preview/i)
    ).toBeVisible()
    await expect(
      page.getByText(/no reveal window is opened while blocked/i)
    ).toBeVisible()
    await expect(
      page.getByText(/value stays hidden until the broker returns/i)
    ).toBeVisible()
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
    await expect(page.getByText(/recoveryPlanRef/i).first()).toBeVisible()
    await expect(
      page.getByText(/Delete\/decommission safety preview/i)
    ).toBeVisible()
    await expect(page.getByText(/decommission preview blocked/i)).toBeVisible()
    await expect(page.getByText(/audit reason required/i).first()).toBeVisible()
    await expect(
      page.getByText(/recovery-delete-serviceadmin-session-signing-metadata/i)
    ).toBeVisible()
    await expect(
      page.getByText(/tombstone-delete-serviceadmin-session-signing-metadata/i)
    ).toBeVisible()
    await expect(
      page.getByText(/@serviceadmin runtime session loader/i)
    ).toBeVisible()
    await expect(
      page.getByText(/current secret value is not read/i)
    ).toBeVisible()
    await page
      .getByRole('button', { name: /Apply policy preview/i })
      .first()
      .click()
    await expect(
      page.getByText(/target policy assignment diff checked/i).first()
    ).toBeVisible()
    await expect(
      page.getByText('targetPolicyRef', { exact: true }).first()
    ).toBeVisible()
    await expect(
      page.getByText(/Policy assignment safety preview/i)
    ).toBeVisible()
    await expect(page.getByText(/policy preview blocked/i)).toBeVisible()
    await expect(
      page.getByText(
        'policy/openclaw/service-lasso/serviceadmin/least-privilege-single-ref',
        { exact: true }
      )
    ).toBeVisible()
    await expect(
      page.getByText(/rollback-policy-serviceadmin-session-signing-metadata/i)
    ).toBeVisible()
    await expect(page.getByText(/@serviceadmin operator API/i)).toBeVisible()
    await expect(
      page.getByText(
        /policy preview never reads or writes the current secret value/i
      )
    ).toBeVisible()

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
    await expect(page.getByText(/Metadata-only submit envelope/i)).toBeVisible()
    await expect(page.getByText(/No raw payload/i)).toBeVisible()
    await expect(page.getByText(/Omitted unsafe fields/i)).toBeVisible()
    await expect(page.getByText(/requestBodyEcho/i)).toBeVisible()
    await expect(page.getByText(/not copied into query strings/i)).toBeVisible()
    await expect(
      page.getByText(/no local storage or session storage/i)
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
    await expect(page.getByText(/Operation audit timeline/i)).toBeVisible()
    await expect(page.getByText(/Dry-run preview recorded/i)).toBeVisible()
    await expect(page.getByText(/Apply gate evaluated/i)).toBeVisible()
    await expect(page.getByText(/Broker status callback/i)).toBeVisible()
    await expect(page.getByText(/Audit sink retention/i)).toBeVisible()
    await expect(page.getByText(/serviceadmin-ui/i)).toBeVisible()
    await expect(page.getByText(/@secretsbroker/i).first()).toBeVisible()
    await expect(
      page.getByText(/callback evidence stores typed outcome/i)
    ).toBeVisible()
    await expect(
      page.getByText(/audit-reset-serviceadmin/i).first()
    ).toBeVisible()
    await expect(page.getByText(/submitted to broker/i).first()).toBeVisible()
    await expect(page.getByText(/raw value was not revealed/i)).toBeVisible()
    await expect(
      page.getByText(/rotation can be requested without controlled reveal/i)
    ).toBeVisible()
    await expect(page.getByText(/Metadata-only submit envelope/i)).toBeVisible()
    await expect(page.getByText(/Broker status monitor/i)).toBeVisible()
    await expect(
      page.getByText(
        /GET \/v1\/management\/secret-operations\/\{operationId\}/i
      )
    ).toBeVisible()
    await expect(
      page.getByText(/poll every 5 seconds until broker terminal metadata/i)
    ).toBeVisible()
    await expect(
      page.getByText(/pending broker terminal status/i).first()
    ).toBeVisible()
    await expect(page.getByText(/Fresh preview first/i)).toBeVisible()
    await expect(
      page.getByText(/idem-reset-serviceadmin-session-signing-metadata-submit/i)
    ).toBeVisible()
    await expect(
      page.getByText(/corr-reset-serviceadmin-session-signing-metadata-submit/i)
    ).toBeVisible()
    await expect(page.getByText(/rotationReason/i).first()).toBeVisible()
    await expect(page.getByText(/providerCredentials/i).first()).toBeVisible()
    await expect(
      page.getByText(/allowlisted from the dry-run plan fields only/i)
    ).toBeVisible()
    await expect(
      page
        .getByText(/audit-reset-serviceadmin-session-signing-preview/i)
        .first()
    ).toBeVisible()
    await expect(
      page
        .getByText(/corr-reset-serviceadmin-session-signing-submitted/i)
        .first()
    ).toBeVisible()
    await expect(
      page.getByText(/recorded and waiting for broker terminal status/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/allowlisted fields only: ref, action/i)
    ).toBeVisible()
    await expect(
      page.getByText(/dependent service restart remains pending/i).first()
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
    await expect(page.getByText(/terminal success/i).first()).toBeVisible()
    await expect(
      page.getByText(/polling stopped after terminal metadata/i)
    ).toBeVisible()
    await expect(
      page.getByText(/no retry needed after broker success/i).first()
    ).toBeVisible()
    await expect(page.getByText(/2 submitted/i)).toBeVisible()
    await page.getByLabel(/Result status/i).selectOption('policy-denied')
    await page.getByLabel(/Stub API state/i).selectOption('ready')
    await page.getByRole('button', { name: /Simulate stub apply/i }).click()
    await expect(
      page.getByText(/Single-secret operation result: policy-denied/i)
    ).toBeVisible()
    await expect(page.getByText(/no value was read or written/i)).toBeVisible()
    await expect(
      page.getByText(/policy denial is fail-closed/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/request least-privilege policy approval/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/fresh plan required before any retry/i).first()
    ).toBeVisible()
    await expect(page.getByText(/3 submitted/i)).toBeVisible()
    await page.getByLabel(/Result status/i).selectOption('auth-required')
    await page.getByLabel(/Stub API state/i).selectOption('ready')
    await page.getByRole('button', { name: /Simulate stub apply/i }).click()
    await expect(
      page.getByText(/Single-secret operation result: auth-required/i)
    ).toBeVisible()
    await expect(page.getByText(/auth required/i).first()).toBeVisible()
    await expect(
      page.getByText(
        /requires fresh operator authentication before source access/i
      )
    ).toBeVisible()
    await expect(
      page.getByText(/provider reauthentication must complete/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/broker-owned provider reauthentication required/i)
    ).toBeVisible()
    await expect(
      page.getByText('Provider auth challenge', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText(
        /auth-challenge-reset-serviceadmin-session-signing-metadata/i
      )
    ).toBeVisible()
    await expect(
      page.getByText(/Broker-owned challenge metadata only/i)
    ).toBeVisible()
    await expect(
      page.getByText(/provider reauthentication happens outside Service Admin/i)
    ).toBeVisible()
    await expect(
      page.getByText(/paused for broker reauthentication/i)
    ).toBeVisible()
    await expect(page.getByText(/4 submitted/i)).toBeVisible()
    await page.getByLabel(/Result status/i).selectOption('audit-unavailable')
    await page.getByLabel(/Stub API state/i).selectOption('ready')
    await page.getByRole('button', { name: /Simulate stub apply/i }).click()
    await expect(
      page.getByText(/Single-secret operation result: audit-unavailable/i)
    ).toBeVisible()
    await expect(page.getByText(/stub audit outage metadata/i)).toBeVisible()
    await expect(
      page.getByText(/mutation failed closed/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/blocked because audit persistence is unavailable/i)
    ).toBeVisible()
    await expect(
      page.getByText(/terminal audit unavailable/i).first()
    ).toBeVisible()
    await expect(page.getByText(/audit blocked/i).first()).toBeVisible()
    await expect(
      page.getByText(/restore audit sink availability/i).first()
    ).toBeVisible()
    await expect(page.getByText(/5 submitted/i)).toBeVisible()
    await page.getByLabel(/Result status/i).selectOption('provider-unavailable')
    await page.getByLabel(/Stub API state/i).selectOption('ready')
    await page.getByRole('button', { name: /Simulate stub apply/i }).click()
    await expect(
      page.getByText(/Single-secret operation result: provider-unavailable/i)
    ).toBeVisible()
    await expect(
      page.getByText(/provider connector is unavailable or unsupported/i)
    ).toBeVisible()
    await expect(
      page.getByText(/provider outage is fail-closed/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/provider status: connector unavailable or unsupported/i)
    ).toBeVisible()
    await expect(
      page.getByText('Provider recovery evidence', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText(
        /provider-recovery-reset-serviceadmin-session-signing-metadata/i
      )
    ).toBeVisible()
    await expect(
      page.getByText(/Broker-owned recovery metadata only/i)
    ).toBeVisible()
    await expect(
      page.getByText(/terminal provider unavailable/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/provider recovery happens in broker/i)
    ).toBeVisible()
    await expect(page.getByText(/6 submitted/i)).toBeVisible()
    await page.getByLabel(/Result status/i).selectOption('stale-plan')
    await page.getByLabel(/Stub API state/i).selectOption('ready')
    await page.getByRole('button', { name: /Simulate stub apply/i }).click()
    await expect(
      page.getByText(/Single-secret operation result: stale-plan/i)
    ).toBeVisible()
    await expect(
      page.getByText(/dry-run plan token expired before final broker/i)
    ).toBeVisible()
    await expect(
      page
        .getByText(/stale plan recovery requires a fresh audited preview/i)
        .first()
    ).toBeVisible()
    await expect(
      page.getByText(/stale preview: broker rejected/i)
    ).toBeVisible()
    await expect(
      page.getByText(/terminal stale-plan rejection/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/stale-plan recovery creates a new dry-run/i)
    ).toBeVisible()
    await expect(page.getByText(/7 submitted/i)).toBeVisible()
    await expect(page.getByText(/DEMO_REVEAL_VALUE_42/i)).toHaveCount(0)
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })

  test('shows bulk campaign audit auth policy-denied and provider-unavailable apply outcomes without secret material', async ({
    page,
  }) => {
    await page.goto('/secrets-broker/secrets')
    await expectNoBlankScreen(page)

    await expect(page.getByText(/Bulk campaign dry-run planner/i)).toBeVisible()
    await page
      .getByRole('button', { name: /Generate bulk dry-run plan/i })
      .click()
    await expect(
      page.getByText(/Campaign confirmation and revalidation/i)
    ).toBeVisible()
    await page
      .getByLabel(/Campaign audit reason/i)
      .fill('operator requested bulk audit outage coverage')
    await page
      .getByLabel(/Explicit confirmation/i)
      .fill('CONFIRM HIGH RISK CAMPAIGN')
    await page.getByRole('button', { name: /Revalidate dry-run/i }).click()
    await expect(page.getByText(/revalidation passed/i).first()).toBeVisible()

    await page
      .getByLabel(/Apply result mode/i)
      .selectOption('audit-unavailable')
    await expect(
      page.getByRole('button', { name: /Apply bulk campaign/i })
    ).toBeEnabled()
    await page.getByRole('button', { name: /Apply bulk campaign/i }).click()

    await expect(
      page.getByText(/Campaign apply result: audit_unavailable/i)
    ).toBeVisible()
    await expect(page.getByText(/Audit 1/i)).toBeVisible()
    await expect(
      page.getByText(/campaign-level audit unavailable/i)
    ).toBeVisible()
    await expect(page.getByText(/audit-unavailable/i).first()).toBeVisible()
    await expect(
      page.getByText(/campaign audit unavailable; item mutation not applied/i)
    ).toBeVisible()
    await expect(page.getByText(/restore audit persistence/i)).toBeVisible()
    await expect(page.getByText(/DEMO_REVEAL_VALUE_42/i)).toHaveCount(0)
    await expectNoSecretMaterial(page)

    await page.getByLabel(/Apply result mode/i).selectOption('policy-denied')
    await page.getByRole('button', { name: /Apply bulk campaign/i }).click()

    await expect(
      page.getByText(/Campaign apply result: policy_denied/i)
    ).toBeVisible()
    await expect(page.getByText(/Denied 1/i)).toBeVisible()
    await expect(
      page.getByText(/broker policy denied item mutation/i)
    ).toBeVisible()
    await expect(
      page.getByText(
        /campaign audit recorded; policy denied and item mutation not applied/i
      )
    ).toBeVisible()
    await expect(
      page.getByText(/request least-privilege policy approval/i)
    ).toBeVisible()
    await expect(page.getByText(/DEMO_REVEAL_VALUE_42/i)).toHaveCount(0)
    await expectNoSecretMaterial(page)

    await page.getByLabel(/Apply result mode/i).selectOption('auth-required')
    await page.getByRole('button', { name: /Apply bulk campaign/i }).click()

    await expect(
      page.getByText(/Campaign apply result: auth_required/i)
    ).toBeVisible()
    await expect(page.getByText(/Auth 2/i)).toBeVisible()
    await expect(
      page.getByText(/provider reauthentication required/i)
    ).toBeVisible()
    await expect(
      page
        .getByText(
          /campaign audit recorded; provider auth required and item mutation not applied/i
        )
        .first()
    ).toBeVisible()
    await expect(
      page.getByText(/complete provider reauthentication/i)
    ).toBeVisible()
    await expect(page.getByText(/DEMO_REVEAL_VALUE_42/i)).toHaveCount(0)
    await expectNoSecretMaterial(page)

    await page
      .getByLabel(/Apply result mode/i)
      .selectOption('provider-unavailable')
    await page.getByRole('button', { name: /Apply bulk campaign/i }).click()

    await expect(
      page.getByText(/Campaign apply result: provider_unavailable/i)
    ).toBeVisible()
    await expect(page.getByText(/Provider 1/i)).toBeVisible()
    await expect(
      page.getByText(/provider connector unavailable/i)
    ).toBeVisible()
    await expect(
      page.getByText(
        /campaign audit recorded; provider unavailable and item mutation not applied/i
      )
    ).toBeVisible()
    await expect(
      page.getByText(/restore provider connectivity/i).first()
    ).toBeVisible()
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
