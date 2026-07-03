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
      page.getByRole('main').getByRole('link', { name: 'Audit' })
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
    await expect(page.getByText(/Reveal challenge lifecycle/i)).toBeVisible()
    await expect(page.getByLabel(/Reveal lifecycle state/i)).toBeVisible()
    await expect(
      page.getByText(/waiting for broker authorization/i)
    ).toBeVisible()
    await page.getByLabel(/Reveal lifecycle state/i).selectOption('authorized')
    await expect(
      page.getByText('authorized display metadata', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText(/reveal-session-reveal-serviceadmin/i)
    ).toBeVisible()
    await expect(
      page.getByText(/value remains outside table fixtures/i)
    ).toBeVisible()
    await page.getByLabel(/Reveal lifecycle state/i).selectOption('revoked')
    await expect(
      page.getByText(/display not opened because the challenge was revoked/i)
    ).toBeVisible()
    await page
      .getByLabel(/Reveal lifecycle state/i)
      .selectOption('audit-unavailable')
    await expect(
      page.getByText(
        /display blocked because audit persistence is unavailable/i
      )
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
    await expect(page.getByText(/Edit\/update safety preview/i)).toBeVisible()
    await expect(page.getByText(/edit preview blocked/i)).toBeVisible()
    await expect(
      page.getByText(/patch-edit-serviceadmin-session-signing-metadata/i)
    ).toBeVisible()
    await expect(
      page.getByText(/conflict-edit-serviceadmin-session-signing-metadata/i)
    ).toBeVisible()
    await expect(
      page.getByText(
        /update-rollback-edit-serviceadmin-session-signing-metadata/i
      )
    ).toBeVisible()
    await expect(page.getByText('rotationPolicyRef').first()).toBeVisible()
    await expect(page.getByText('providerCredential').first()).toBeVisible()
    await expect(
      page.getByText(/metadata diff contains field names/i)
    ).toBeVisible()
    await expect(
      page.getByText(/clear-value table editing is unavailable/i)
    ).toBeVisible()
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
      page
        .getByText(/recovery-delete-serviceadmin-session-signing-metadata/i)
        .first()
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
      .getByLabel(/Audit reason for stub preview/i)
      .fill('operator requested decommission preview')
    await page.getByLabel(/I confirm this is a stub preview/i).check()
    await page.getByLabel(/Result status/i).selectOption('applied')
    await page.getByRole('button', { name: /Simulate stub apply/i }).click()
    await expect(
      page.getByText(/Single-secret operation result: applied/i)
    ).toBeVisible()
    await expect(
      page.getByText(/Delete\/decommission impact evidence/i)
    ).toBeVisible()
    await expect(
      page
        .getByText(
          /impact-delete-serviceadmin-session-signing-applied-metadata/i
        )
        .first()
    ).toBeVisible()
    await expect(
      page
        .getByText(/recovery-delete-serviceadmin-session-signing-metadata/i)
        .first()
    ).toBeVisible()
    await expect(
      page.getByText(
        /restore or recreate only through a fresh audited broker recovery plan/i
      )
    ).toBeVisible()
    await expect(page.getByText(/requestBody/i).first()).toBeVisible()
    await expect(page.getByText(/responseBody/i).first()).toBeVisible()
    await expect(page.getByText(/recoveryMaterial/i).first()).toBeVisible()
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
    await expect(page.getByText(/policy preview ready/i)).toBeVisible()
    await expect(
      page.getByText(
        'policy/openclaw/service-lasso/serviceadmin/least-privilege-single-ref',
        { exact: true }
      )
    ).toBeVisible()
    await expect(
      page
        .getByText(/rollback-policy-serviceadmin-session-signing-metadata/i)
        .first()
    ).toBeVisible()
    await expect(page.getByText(/@serviceadmin operator API/i)).toBeVisible()
    await expect(
      page.getByText(
        /policy preview never reads or writes the current secret value/i
      )
    ).toBeVisible()
    await page
      .getByLabel(/Audit reason for stub preview/i)
      .fill('operator requested least privilege policy assignment')
    await page.getByLabel(/I confirm this is a stub preview/i).check()
    await page.getByLabel(/Result status/i).selectOption('applied')
    await page.getByLabel(/Stub API state/i).selectOption('ready')
    await page.getByRole('button', { name: /Simulate stub apply/i }).click()
    await expect(
      page.getByText(/Policy assignment impact evidence/i)
    ).toBeVisible()
    await expect(
      page
        .getByText(
          /impact-policy-serviceadmin-session-signing-applied-metadata/i
        )
        .first()
    ).toBeVisible()
    await expect(
      page
        .getByText(/rollback-policy-serviceadmin-session-signing-metadata/i)
        .first()
    ).toBeVisible()
    await expect(
      page.getByText(/rollback requires a fresh audited policy assignment/i)
    ).toBeVisible()
    await expect(
      page.getByText(/policy impact keeps previous and target policy refs/i)
    ).toBeVisible()
    await page.getByRole('button', { name: /Cancel stub preview/i }).click()

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
    await expect(page.getByText(/Rotation safety preview/i)).toBeVisible()
    await expect(page.getByText(/rotation preview blocked/i)).toBeVisible()
    await expect(page.getByText(/No reveal required/i)).toBeVisible()
    await expect(
      page.getByText(/rotation-plan-reset-serviceadmin-session-signing/i)
    ).toBeVisible()
    await expect(
      page.getByText(/retry-window-reset-serviceadmin-session-signing/i)
    ).toBeVisible()
    await expect(
      page.getByText(/restart-serviceadmin-runtime-session-loader/i)
    ).toBeVisible()
    await expect(
      page.getByText(/dependent service restart and reload plan checked/i)
    ).toBeVisible()
    await expect(page.getByText(/generatedValue/i).first()).toBeVisible()
    await expect(page.getByText(/replacementValue/i).first()).toBeVisible()
    await expect(
      page.getByText(/operator can rotate without opening a controlled reveal/i)
    ).toBeVisible()
    await expect(
      page.getByText(/Single-secret operation history/i)
    ).toBeVisible()
    await expect(page.getByText(/Metadata-only submit envelope/i)).toBeVisible()
    await expect(
      page.getByText('Confirmation receipt', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText(/receipt-reset-serviceadmin-session-signing-blocked/i)
    ).toBeVisible()
    await expect(
      page.getByText(/confirmation receipt blocked before broker mutation/i)
    ).toBeVisible()
    await expect(
      page.getByText(/Route and storage leak evidence/i)
    ).toBeVisible()
    await expect(page.getByText(/No raw payload/i)).toBeVisible()
    await expect(page.getByText(/Omitted unsafe fields/i).first()).toBeVisible()
    await expect(page.getByText(/requestBodyEcho/i).first()).toBeVisible()
    await expect(page.getByText(/localStorage writes: none/i)).toBeVisible()
    await expect(page.getByText(/not copied into query strings/i)).toBeVisible()
    await expect(
      page.getByText(/no local storage or session storage/i)
    ).toBeVisible()
    await expect(page.getByText(/3 submitted/i)).toBeVisible()
    await expect(page.getByText(/audit reason required/i).first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Simulate stub apply/i })
    ).toBeDisabled()
    await page.getByLabel(/Stub API state/i).selectOption('ready')
    await page
      .getByLabel(/Audit reason for stub preview/i)
      .fill('operator requested preview')
    await page.getByLabel(/I confirm this is a stub preview/i).check()
    await expect(page.getByText(/Stub apply can be simulated/i)).toBeVisible()
    await expect(
      page.getByText(/receipt-reset-serviceadmin-session-signing-accepted/i)
    ).toBeVisible()
    await expect(
      page.getByText(/accepted as broker audit metadata/i)
    ).toBeVisible()
    await expect(page.getByText(/confirmation receipt accepted/i)).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Simulate stub apply/i })
    ).toBeEnabled()
    await page.getByLabel(/Stub API state/i).selectOption('success')
    await expect(page.getByText(/Stub apply success/i).last()).toBeVisible()
    await page.getByLabel(/Stub API state/i).selectOption('failure')
    await expect(page.getByText(/Stub apply failure/i).last()).toBeVisible()
    await page.getByRole('button', { name: /Cancel stub preview/i }).click()
    await expect(page.getByText(/cancelled by operator/i).first()).toBeVisible()
    await expect(
      page.getByText(/Single-secret operation result: cancelled/i)
    ).toBeVisible()
    await expect(
      page.getByText(/cancelled by operator before broker mutation/i)
    ).toBeVisible()
    await expect(
      page.getByText(/terminal operator cancellation/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/cancelled preview recovery creates a fresh dry-run/i)
    ).toBeVisible()

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
    await expect(page.getByText(/Export and copy guardrail/i)).toBeVisible()
    await expect(page.getByText(/Raw export blocked/i)).toBeVisible()
    await expect(
      page.getByText(/spreadsheet-style payload export are unavailable/i)
    ).toBeVisible()
    await expect(page.getByText(/Blocked export fields/i)).toBeVisible()
    await expect(
      page.getByText(/metadata export is scoped to the selected ref/i)
    ).toBeVisible()
    await expect(page.getByText(/Broker status monitor/i)).toBeVisible()
    await expect(
      page
        .getByText(/GET \/v1\/management\/secret-operations\/\{operationId\}/i)
        .first()
    ).toBeVisible()
    await expect(
      page.getByText(/poll every 5 seconds until broker terminal metadata/i)
    ).toBeVisible()
    await expect(
      page.getByText(/pending broker terminal status/i).first()
    ).toBeVisible()
    await expect(page.getByText(/Fresh preview first/i)).toBeVisible()
    await expect(
      page
        .getByText(/idem-reset-serviceadmin-session-signing-metadata-submit/i)
        .first()
    ).toBeVisible()
    await expect(
      page
        .getByText(/corr-reset-serviceadmin-session-signing-metadata-submit/i)
        .first()
    ).toBeVisible()
    await expect(page.getByText(/Replay and idempotency guard/i)).toBeVisible()
    await expect(page.getByText(/No cross-ref replay/i)).toBeVisible()
    await expect(
      page.getByText(
        /plan-fp-reset-serviceadmin-session-signing-metadata-only/i
      )
    ).toBeVisible()
    await expect(
      page.getByText(/cross-ref replay rejected before broker mutation/i)
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
    await expect(page.getByText(/Recovery and retry decision/i)).toBeVisible()
    await expect(
      page
        .getByText(/recovery-reset-serviceadmin-session-signing-submitted/i)
        .first()
    ).toBeVisible()
    await expect(page.getByText(/Retry blocked/i).first()).toBeVisible()
    await expect(
      page.getByText(/wait for broker terminal status before any retry/i)
    ).toBeVisible()
    await expect(page.getByText(/Allowed recovery fields/i)).toBeVisible()
    await expect(page.getByText(/Omitted recovery fields/i)).toBeVisible()
    await expect(
      page.getByText(/recovery decisions are derived from typed broker/i)
    ).toBeVisible()
    await expect(page.getByText(/Operator handoff packet/i)).toBeVisible()
    await expect(page.getByText(/Shareable metadata/i)).toBeVisible()
    await expect(
      page
        .getByText(/handoff-reset-serviceadmin-session-signing-submitted/i)
        .first()
    ).toBeVisible()
    await expect(page.getByText(/Shareable evidence refs/i)).toBeVisible()
    await expect(page.getByText(/Allowed handoff fields/i)).toBeVisible()
    await expect(page.getByText(/Omitted handoff fields/i)).toBeVisible()
    await expect(
      page.getByText(
        /handoff evidence can be copied into issue or audit notes/i
      )
    ).toBeVisible()
    await expect(
      page.getByText('Owner action ticket', { exact: true })
    ).toBeVisible()
    await expect(
      page
        .getByText(/owner-action-reset-serviceadmin-session-signing-submitted/i)
        .first()
    ).toBeVisible()
    await expect(page.getByText(/Metadata only/i).first()).toBeVisible()
    await expect(
      page.getByText(/watch broker status endpoint until terminal metadata/i)
    ).toBeVisible()
    await expect(page.getByText(/Allowed ticket fields/i)).toBeVisible()
    await expect(page.getByText(/Omitted ticket fields/i)).toBeVisible()
    await expect(
      page.getByText(
        /owner action tickets are generated from the safe handoff/i
      )
    ).toBeVisible()
    await expect(
      page.getByText('Operator closure review', { exact: true })
    ).toBeVisible()
    await expect(
      page
        .getByText(
          /closure-review-reset-serviceadmin-session-signing-submitted/i
        )
        .first()
    ).toBeVisible()
    await expect(
      page.getByText(/wait for broker terminal metadata/i).first()
    ).toBeVisible()
    await expect(page.getByText(/Retained evidence refs/i)).toBeVisible()
    await expect(page.getByText(/Allowed closure fields/i)).toBeVisible()
    await expect(page.getByText(/Omitted closure fields/i)).toBeVisible()
    await expect(
      page.getByText(
        /pending operations remain open until broker terminal metadata arrives/i
      )
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
    await expect(
      page.getByText(/operator review can close/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/Allowed after audit acknowledgement/i)
    ).toBeVisible()
    await expect(
      page.getByText(
        /operator review may close after terminal metadata and audit receipt acknowledgement/i
      )
    ).toBeVisible()
    await expect(page.getByText(/2 submitted/i)).toBeVisible()
    await expect(page.getByText(/2 shown/i)).toBeVisible()
    await expect(page.getByText(/Allowed history fields/i)).toBeVisible()
    await expect(page.getByText(/Omitted history fields/i)).toBeVisible()
    await expect(page.getByText(/Safe history evidence/i)).toBeVisible()
    await expect(
      page.getByText(/history filters operate on refs, operation ids/i)
    ).toBeVisible()
    await page.getByLabel(/History outcome/i).selectOption('applied')
    await expect(page.getByText(/1 shown/i)).toBeVisible()
    await expect(page.getByText(/broker applied/i).first()).toBeVisible()
    await page
      .getByLabel(/History search/i)
      .fill('audit-reset-serviceadmin-session-signing-2')
    await expect(
      page.getByText(/history search matched metadata-only operation/i)
    ).toBeVisible()
    await page.getByLabel(/History action/i).selectOption('delete')
    await expect(
      page.getByText(/No metadata-only history entries match/i)
    ).toBeVisible()
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
      page.getByText(/paused for broker reauthentication/i).first()
    ).toBeVisible()
    await expect(page.getByText('Audit receipt', { exact: true })).toBeVisible()
    await expect(
      page
        .getByText(
          /audit-receipt-reset-serviceadmin-session-signing-auth-required/i
        )
        .first()
    ).toBeVisible()
    await expect(page.getByText(/safe-audit-\d{5}/i).first()).toBeVisible()
    await expect(page.getByText(/Safe receipt fields/i)).toBeVisible()
    await expect(page.getByText(/Omitted receipt artifacts/i)).toBeVisible()
    await expect(
      page.getByText(
        /audit receipts are derived from operation ids, refs, typed outcomes/i
      )
    ).toBeVisible()
    await expect(
      page.getByText(
        /receipt checksum proves the metadata set reviewed without hashing/i
      )
    ).toBeVisible()
    await expect(
      page
        .getByText(
          /owner-action-reset-serviceadmin-session-signing-auth-required/i
        )
        .first()
    ).toBeVisible()
    await expect(page.getByText(/provider owner/i).first()).toBeVisible()
    await expect(
      page.getByText(/owner acknowledgement required before another broker/i)
    ).toBeVisible()
    await expect(
      page.getByText(
        /fresh broker preview is required after owner action before any mutation retry/i
      )
    ).toBeVisible()
    await expect(
      page.getByText(/owner action required before close/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/Blocked until required checks complete/i)
    ).toBeVisible()
    await expect(
      page.getByText(
        /blocked operations stay open until owner action and a fresh preview are completed/i
      )
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
      page
        .getByText(
          /provider-recovery-reset-serviceadmin-session-signing-metadata/i
        )
        .first()
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
    await page.getByLabel(/Result status/i).selectOption('failed')
    await page.getByLabel(/Stub API state/i).selectOption('ready')
    await page.getByRole('button', { name: /Simulate stub apply/i }).click()
    await expect(
      page.getByText(/Single-secret operation result: failed/i)
    ).toBeVisible()
    await expect(
      page.getByText(/failed with broker-owned safe error metadata/i)
    ).toBeVisible()
    await expect(
      page.getByText('Broker failure evidence', { exact: true })
    ).toBeVisible()
    await expect(
      page
        .getByText(
          /broker-failure-reset-serviceadmin-session-signing-metadata/i
        )
        .first()
    ).toBeVisible()
    await expect(page.getByText(/provider_retryable_safe_error/i)).toBeVisible()
    await expect(
      page.getByText(/Metadata-only safe failure evidence/i)
    ).toBeVisible()
    await expect(page.getByText(/terminal safe failure/i).first()).toBeVisible()
    await expect(
      page.getByText(/retry-reset-serviceadmin-session-signing/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/retry only with the same operation id/i).first()
    ).toBeVisible()
    await expect(page.getByText(/8 submitted/i)).toBeVisible()
    await page.getByRole('button', { name: /Cancel stub preview/i }).click()
    await expect(
      page.getByText(/Single-secret operation result: cancelled/i)
    ).toBeVisible()
    await expect(
      page.getByText(
        /cancelled preview: operator stopped before broker mutation/i
      )
    ).toBeVisible()
    await expect(
      page.getByText(/terminal operator cancellation/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/cancellation evidence contains typed operator intent/i)
    ).toBeVisible()
    await expect(page.getByText(/9 submitted/i)).toBeVisible()
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
    await expect(
      page.getByText(/restore audit persistence/i).first()
    ).toBeVisible()
    await expect(page.getByText(/Bulk campaign closure review/i)).toBeVisible()
    await expect(page.getByText(/operator review remains open/i)).toBeVisible()
    await expect(
      page.getByText(
        /blocked campaigns stay open until policy, auth, audit, provider, or stale-plan recovery creates a fresh plan/i
      )
    ).toBeVisible()
    await expect(page.getByText(/Allowed closure fields/i)).toBeVisible()
    await expect(page.getByText(/Omitted closure fields/i)).toBeVisible()
    await expect(page.getByText(/Bulk campaign owner handoff/i)).toBeVisible()
    await expect(page.getByText(/audit-recovery/i)).toBeVisible()
    await expect(page.getByText(/audit operator/i)).toBeVisible()
    await expect(
      page
        .getByText(
          /restore audit persistence before creating a fresh campaign preview/i
        )
        .first()
    ).toBeVisible()
    await expect(
      page.getByText('Owner action ticket', { exact: true })
    ).toBeVisible()
    await expect(page.getByText(/Allowed handoff fields/i)).toBeVisible()
    await expect(page.getByText(/Omitted ticket fields/i)).toBeVisible()
    await expect(
      page.getByText(/Bulk recovery checklist/i).first()
    ).toBeVisible()
    await expect(page.getByText(/fresh-preview-required/i)).toBeVisible()
    await expect(
      page
        .getByText(
          /fresh campaign preview and revalidation are mandatory before another mutation submit/i
        )
        .first()
    ).toBeVisible()
    await expect(page.getByText(/Omitted checklist fields/i)).toBeVisible()
    await expect(
      page.getByText(/diagnosticPayloadsWithBodies/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/bulkSpreadsheetPayload/i).first()
    ).toBeVisible()
    await expect(page.getByText(/storedMutationPayload/i)).toBeVisible()
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
      page.getByText(/request least-privilege policy approval/i).first()
    ).toBeVisible()
    await expect(page.getByText(/policy-review/i)).toBeVisible()
    await expect(page.getByText(/policy approver/i)).toBeVisible()
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
      page.getByText(/complete provider reauthentication/i).first()
    ).toBeVisible()
    await expect(page.getByText(/provider-auth/i)).toBeVisible()
    await expect(page.getByText(/provider owner/i)).toBeVisible()
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
    await expect(page.getByText(/provider-recovery/i)).toBeVisible()
    await expect(page.getByText(/provider operator/i)).toBeVisible()
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
      ['/operations/audit-logging', /^Audit$/i],
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
    await expect(page.getByText(/No configured providers match/i)).toBeVisible()
    await expect(page.getByText(/DEMO_REVEAL_VALUE_42/i)).toHaveCount(0)
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })
})
