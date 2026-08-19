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

async function expectActivePageIdentity(page: Page, identity: string) {
  await expect(page.getByTestId('active-page-identity')).toHaveAccessibleName(
    `Current page: ${identity}`
  )
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

const kvSentinelValue = 'kv-sentinel-alpha'

type KvDataGet = {
  url: string
  auditReason: string
}

function jsonFulfill(payload: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  }
}

async function installKvHttpMocks(page: Page, dataGets: KvDataGet[]) {
  await page.route(
    (url) =>
      url.href.includes('/kv/metadata/') &&
      url.searchParams.get('list') === 'true',
    async (route) => {
      await route.fulfill(jsonFulfill({ data: { keys: ['apps/', 'db'] } }))
    }
  )

  await page.route(
    (url) =>
      url.href.includes('/kv/metadata/db') &&
      url.searchParams.get('list') !== 'true',
    async (route) => {
      await route.fulfill(
        jsonFulfill({
          data: {
            current_version: 1,
            created_time: '2026-08-18T00:00:00Z',
            updated_time: '2026-08-18T00:00:00Z',
            versions: {
              '1': {
                created_time: '2026-08-18T00:00:00Z',
                deletion_time: '',
                destroyed: false,
              },
            },
          },
        })
      )
    }
  )

  await page.route(
    (url) => url.href.includes('/kv/data/db'),
    async (route) => {
      const request = route.request()
      if (request.method() !== 'GET') {
        await route.continue()
        return
      }
      dataGets.push({
        url: request.url(),
        auditReason: request.headers()['x-secretsbroker-audit-reason'] ?? '',
      })
      await route.fulfill(
        jsonFulfill({
          data: {
            data: {
              username: 'db-user',
              password: kvSentinelValue,
            },
            metadata: {
              version: 1,
              created_time: '2026-08-18T00:00:00Z',
              deletion_time: '',
              destroyed: false,
            },
          },
        })
      )
    }
  )
}

async function expectCatalogCopyAbsent(page: Page) {
  await expect(page.getByText(/Operator queue/i)).toHaveCount(0)
  await expect(page.getByText(/Live secret metadata status/i)).toHaveCount(0)
  await expect(page.getByText(/Secrets management table/i)).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Simulate stub apply/i })
  ).toHaveCount(0)
  await expect(page.getByText(/SESSION_SIGNING_KEY/i)).toHaveCount(0)
  await expect(page.getByText(fakeRevealValue)).toHaveCount(0)
}

async function confirmAuditedReveal(page: Page, reason: string) {
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Audit reason').fill(reason)
  await page.getByLabel('Confirm this controlled reveal').check()
  await page.getByRole('button', { name: 'Request reveal' }).click()
}

async function expectFieldName(page: Page, index: number, name: string) {
  await expect(page.getByLabel(`Field ${index} name`)).toHaveValue(name)
}

async function expectFieldValue(page: Page, index: number, value: string) {
  await expect(page.getByLabel(`Field ${index} value`)).toHaveValue(value)
}

test.describe('Secrets Broker browser coverage', () => {
  const consoleErrors: string[] = []
  const kvDataGets: KvDataGet[] = []

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0
    kvDataGets.length = 0
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message)
    })
    await installKvHttpMocks(page, kvDataGets)
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
      const bodyText = await page.locator('body').innerText()
      if (
        bodyText.includes(fakeRevealValue) ||
        bodyText.includes(kvSentinelValue)
      ) {
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
    await expectActivePageIdentity(page, 'Overview')
    await expect(page.getByText(/@secretsbroker overview/i)).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'View providers' })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Add provider' })).toBeVisible()
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Audit', exact: true })
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
      ['Review', /\/secrets-broker\/review$/],
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

  test('treats Secrets as KV-only and reveals one field at a time after audit', async ({
    page,
  }) => {
    await page.goto('/secrets-broker/secrets')
    await expectNoBlankScreen(page)
    await expectActivePageIdentity(page, 'Secrets')
    await expect(page.getByText('KV store')).toBeVisible()
    await expectCatalogCopyAbsent(page)
    await expect(page.getByRole('button', { name: 'db' })).toBeVisible()
    await expect(page.getByText('No values in the key list')).toHaveCount(0)
    await expect(page.getByText(kvSentinelValue)).toHaveCount(0)
    await expectNoSecretMaterial(page)

    await page.getByRole('button', { name: 'db' }).click()
    await expect(page.getByText(kvSentinelValue)).toHaveCount(0)

    await page.getByRole('button', { name: 'Load fields' }).click()
    await confirmAuditedReveal(page, 'incident review for db credentials')
    await expectFieldName(page, 1, 'username')
    await expectFieldName(page, 2, 'password')
    await expectFieldValue(page, 1, '')
    await expectFieldValue(page, 2, '')
    expect(kvDataGets).toHaveLength(1)
    expect(kvDataGets[0]?.auditReason).toBe(
      'incident review for db credentials'
    )

    await page.getByRole('button', { name: 'Reveal password' }).click()
    await confirmAuditedReveal(page, 'need password for local restore')
    await expectFieldValue(page, 2, kvSentinelValue)
    await expectFieldValue(page, 1, '')
    expect(kvDataGets).toHaveLength(2)
    expect(kvDataGets[1]?.auditReason).toBe('need password for local restore')

    await page.getByRole('button', { name: 'Reveal username' }).click()
    await confirmAuditedReveal(page, 'need username for local restore')
    await expectFieldValue(page, 1, 'db-user')
    await expectFieldValue(page, 2, '')
    expect(kvDataGets).toHaveLength(3)
    expect(kvDataGets[2]?.auditReason).toBe('need username for local restore')

    await page.getByRole('button', { name: 'Hide username' }).click()
    await expectFieldValue(page, 1, '')
    await expectFieldValue(page, 2, '')
    expect(kvDataGets).toHaveLength(3)
    await expect(page.getByText(fakeRevealValue)).toHaveCount(0)
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })

  test('rejects empty or secret-like audit reasons without reading KV data', async ({
    page,
  }) => {
    await page.goto('/secrets-broker/secrets')
    await expectNoBlankScreen(page)
    await page.getByRole('button', { name: 'db' }).click()
    await page.getByRole('button', { name: 'Load fields' }).click()
    await page.getByRole('button', { name: 'Request reveal' }).click()
    await expect(
      page.getByText('Enter an audit reason before revealing.')
    ).toBeVisible()
    expect(kvDataGets).toEqual([])

    await page.getByLabel('Audit reason').fill('password=SuperSecret1234')
    await page.getByLabel('Confirm this controlled reveal').check()
    await page.getByRole('button', { name: 'Request reveal' }).click()
    await expect(
      page.getByText('Audit reason cannot contain secret material.')
    ).toBeVisible()
    expect(kvDataGets).toEqual([])
    await expect(page.getByText(kvSentinelValue)).toHaveCount(0)
    await expectFieldValue(page, 1, '')
    await page.getByRole('button', { name: 'Cancel reveal' }).click()
    await expect(page.getByText(fakeRevealValue)).toHaveCount(0)
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
    await expect(page.getByText(/Can my services start/i)).toBeVisible()
    await expect(
      page.getByText(/All startup-critical service refs resolve/i)
    ).toBeVisible()
    await expect(page.getByText(/Generated first-run secrets/i)).toBeVisible()

    await previewState.selectOption('degraded')
    await expect(page.getByText('@secretsbroker degraded')).toBeVisible()
    await expect(page.getByText(/source_auth_required/i).first()).toBeVisible()
    await expect(page.getByText(/Two services cannot start/i)).toBeVisible()
    await expect(
      page.getByText(/provider-owned reauthentication/i)
    ).toHaveCount(0)
    await expect(page.getByText(/broker-owned reauthentication/i)).toBeVisible()

    await previewState.selectOption('offline')
    await expect(page.getByText('@secretsbroker offline')).toBeVisible()
    await expect(page.getByText('API reachable', { exact: true })).toBeVisible()
    await expect(page.getByText('no', { exact: true }).first()).toBeVisible()
    await expect(
      page.getByText(/cannot confirm startup secret resolution/i)
    ).toBeVisible()

    await previewState.selectOption('unconfigured')
    await expect(page.getByText('@secretsbroker setup needed')).toBeVisible()
    await expect(
      page.getByText(/Add a local encrypted store/i).first()
    ).toBeVisible()
    await expect(
      page.getByText(/Initialize local encrypted store/i)
    ).toBeVisible()

    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })

  test('deep-links to broker surfaces and provider detail with safe metadata only', async ({
    page,
  }) => {
    const sections = [
      {
        path: '/secrets-broker/sources',
        identity: 'Providers',
      },
      {
        path: '/secrets-broker/configuration',
        identity: 'Configuration',
      },
      {
        path: '/secrets-broker/backup-keys',
        visibleText: /Local encrypted store/i,
      },
      {
        path: '/secrets-broker/topology',
        identity: 'Topology',
      },
      {
        path: '/secrets-broker/review',
        identity: 'Review',
      },
      {
        path: '/operations/audit-logging',
        identity: 'Audit',
      },
    ] as const

    for (const section of sections) {
      const { path } = section
      await page.goto(path)
      await expectNoBlankScreen(page)
      if ('identity' in section) {
        await expectActivePageIdentity(page, section.identity)
      }
      if ('visibleText' in section) {
        await expect(page.getByText(section.visibleText).first()).toBeVisible()
      }
      await expectNoSecretMaterial(page)
    }

    const removedRoutes = [
      ['/secrets-broker/provider-connections', /\/secrets-broker\/sources$/],
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
    await expectActivePageIdentity(page, 'Providers')
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
