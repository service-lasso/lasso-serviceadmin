import { expect, test, type Page, type TestInfo } from '@playwright/test'

const sentinelPassword = 'kv-sentinel-alpha'
const usernameValue = 'db-user'
const loadFieldNamesReason = 'load field names'

const forbiddenSecretMaterialPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:bearer|token|api[_-]?key|client[_-]?secret|password)\s*[=:]\s*['"][^'"]{8,}/i,
  /(?:access|refresh|id)[_-]?token\s*[=:]\s*[^\s]{12,}/i,
]

/**
 * Browser proof for the KV-only Secrets page. CI and Release both run
 * `npm run test:ui`, so this file is the release-gated E2E coverage.
 */
async function expectNoBlankScreen(page: Page) {
  await expect(page.locator('main')).toBeVisible()
  await expect(page.locator('main')).not.toBeEmpty()
  await expect(
    page
      .getByRole('button', { name: /Service Lasso instance selector/i })
      .first()
  ).toBeVisible()
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

function json(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

function metadataBody() {
  return {
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
  }
}

function secretBody() {
  return {
    data: {
      data: {
        username: usernameValue,
        password: sentinelPassword,
      },
      metadata: {
        version: 1,
        created_time: '2026-08-18T00:00:00Z',
        deletion_time: '',
        destroyed: false,
      },
    },
  }
}

/**
 * Intercept Broker KV proxy calls so stub-mode Vite can exercise the live KV
 * editor without a running Core/Broker.
 */
async function installKvRoutes(page: Page) {
  const dataGets: Array<{ url: string; reason: string }> = []

  await page.route('**/api/services/**/proxy/v1/kv/**', async (route) => {
    const request = route.request()
    const url = request.url()
    const method = request.method()

    if (url.includes('/kv/metadata/') && url.includes('list=true')) {
      if (url.includes('/kv/metadata/services/node-sample-service')) {
        await route.fulfill(
          json({ data: { keys: ['sample.GENERATED_TOKEN'] } })
        )
        return
      }
      if (url.includes('/kv/metadata/services')) {
        await route.fulfill(json({ data: { keys: ['node-sample-service/'] } }))
        return
      }
      await route.fulfill(
        json({ data: { keys: ['apps/', 'db', 'services/'] } })
      )
      return
    }

    if (
      url.includes(
        '/kv/metadata/services/node-sample-service/sample.GENERATED_TOKEN'
      ) &&
      !url.includes('list=true')
    ) {
      await route.fulfill(json(metadataBody()))
      return
    }

    if (url.includes('/kv/metadata/db') && !url.includes('list=true')) {
      await route.fulfill(json(metadataBody()))
      return
    }

    if (
      url.includes(
        '/kv/data/services/node-sample-service/sample.GENERATED_TOKEN'
      ) &&
      (method === 'GET' || method === '')
    ) {
      const reason = request.headers()['x-secretsbroker-audit-reason'] ?? ''
      dataGets.push({ url, reason })
      await route.fulfill(
        json({
          data: {
            data: {
              value: sentinelPassword,
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
      return
    }

    if (url.includes('/kv/data/db') && (method === 'GET' || method === '')) {
      const reason = request.headers()['x-secretsbroker-audit-reason'] ?? ''
      dataGets.push({ url, reason })
      await route.fulfill(json(secretBody()))
      return
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ errors: [`unmocked KV URL ${url}`] }),
    })
  })

  return { dataGets }
}

/**
 * Mutable KV mock so add-field-then-save can assert PATCH merge without a live
 * Broker. Field names after save come from editor state, not list/metadata.
 */
async function installMutableKvRoutes(page: Page) {
  const stored: Record<string, string> = {
    username: usernameValue,
    password: sentinelPassword,
  }
  let version = 1
  const patches: string[] = []

  await page.route('**/api/services/**/proxy/v1/kv/**', async (route) => {
    const request = route.request()
    const url = request.url()
    const method = request.method()

    if (url.includes('/kv/metadata/') && url.includes('list=true')) {
      await route.fulfill(
        json({ data: { keys: ['apps/', 'db', 'services/'] } })
      )
      return
    }

    if (url.includes('/kv/metadata/db') && !url.includes('list=true')) {
      const versions: Record<
        string,
        {
          created_time: string
          deletion_time: string
          destroyed: boolean
        }
      > = {
        '1': {
          created_time: '2026-08-18T00:00:00Z',
          deletion_time: '',
          destroyed: false,
        },
      }
      if (version >= 2) {
        versions['2'] = {
          created_time: '2026-08-18T00:00:02Z',
          deletion_time: '',
          destroyed: false,
        }
      }
      await route.fulfill(
        json({
          data: {
            current_version: version,
            created_time: '2026-08-18T00:00:00Z',
            updated_time: '2026-08-18T00:00:00Z',
            versions,
          },
        })
      )
      return
    }

    if (url.includes('/kv/data/db') && method === 'PATCH') {
      const body = request.postData() ?? ''
      patches.push(body)
      if (body.includes('kv-test-field')) {
        stored['kv-test-field'] = sentinelPassword
      }
      version += 1
      await route.fulfill(
        json({
          data: {
            version,
            created_time: '2026-08-18T00:00:02Z',
            deletion_time: '',
            destroyed: false,
          },
        })
      )
      return
    }

    if (url.includes('/kv/data/db') && (method === 'GET' || method === '')) {
      await route.fulfill(
        json({
          data: {
            data: stored,
            metadata: {
              version,
              created_time: '2026-08-18T00:00:00Z',
              deletion_time: '',
              destroyed: false,
            },
          },
        })
      )
      return
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ errors: [`unmocked KV URL ${url}`] }),
    })
  })

  return { patches }
}

async function confirmAuditedReveal(page: Page, reason: string) {
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('Audit reason').fill(reason)
  await page.getByLabel('Confirm this controlled reveal').check()
  await page.getByRole('button', { name: 'Request reveal' }).click()
}

test.describe('KV-only Secrets page', () => {
  const consoleErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text())
      }
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

  test('renders KV store without the retired management catalog', async ({
    page,
  }) => {
    await installKvRoutes(page)
    await page.goto('/secrets-broker/secrets')
    await expectNoBlankScreen(page)
    await expectActivePageIdentity(page, 'Secrets')
    await expect(page.getByText('KV store')).toBeVisible()
    await expect(page.getByText('KV Path')).toBeVisible()
    await expect(page.getByText('KV Value')).toBeVisible()
    await expect(page.getByText(/OpenBao-compatible secrets/i)).toHaveCount(0)
    await expect(page.getByText('No values in the key list')).toHaveCount(0)
    await expect(page.getByText('local', { exact: true })).toHaveCount(0)
    await expect(page.getByText(/Operator queue/i)).toHaveCount(0)
    await expect(page.getByText(/Live secret metadata status/i)).toHaveCount(0)
    await expect(page.getByText(/Secrets management table/i)).toHaveCount(0)
    await expect(page.getByText(/SESSION_SIGNING_KEY/i)).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: /Simulate stub apply/i })
    ).toHaveCount(0)
    await expect(page.getByText(sentinelPassword)).toHaveCount(0)
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })

  test('lists KV keys without showing values until a per-row audited reveal', async ({
    page,
  }) => {
    const { dataGets } = await installKvRoutes(page)
    await page.goto('/secrets-broker/secrets')
    await expect(page.getByRole('button', { name: 'db' })).toBeVisible()
    await expect(page.getByText('No values in the key list')).toHaveCount(0)
    await expect(page.getByText(sentinelPassword)).toHaveCount(0)
    await expect(page.getByText(usernameValue)).toHaveCount(0)
    expect(dataGets).toEqual([])

    await page.getByRole('button', { name: 'db' }).click()
    await expect(page.getByLabel('Field 1 name')).toHaveValue('username')
    await expect(page.getByLabel('Field 2 name')).toHaveValue('password')
    await expect(page.getByText(sentinelPassword)).toHaveCount(0)
    await expect(page.getByText(usernameValue)).toHaveCount(0)
    expect(dataGets).toHaveLength(1)
    expect(dataGets[0]?.reason).toBe(loadFieldNamesReason)

    await page.getByRole('button', { name: 'Reveal password' }).click()
    await confirmAuditedReveal(page, 'need password for local restore')
    await expect(page.getByLabel('Field 2 value')).toHaveValue(sentinelPassword)
    await expect(page.getByLabel('Field 1 value')).toHaveValue('')
    await expect(page.getByText(usernameValue)).toHaveCount(0)

    await page.getByRole('button', { name: 'Reveal username' }).click()
    await confirmAuditedReveal(page, 'need username for local restore')
    await expect(page.getByLabel('Field 1 value')).toHaveValue(usernameValue)
    await expect(page.getByLabel('Field 2 value')).toHaveValue('')
    await expect(page.getByText(sentinelPassword)).toHaveCount(0)

    await page.getByRole('button', { name: 'Hide username' }).click()
    await expect(page.getByLabel('Field 1 value')).toHaveValue('')
    await expect(page.getByText(usernameValue)).toHaveCount(0)
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })

  test('rejects empty or secret-like audit reasons before a KV read', async ({
    page,
  }) => {
    const { dataGets } = await installKvRoutes(page)
    await page.goto('/secrets-broker/secrets')
    await page.getByRole('button', { name: 'db' }).click()
    await expect(page.getByLabel('Field 2 name')).toHaveValue('password')
    const hydrateGets = [...dataGets]
    expect(hydrateGets).toHaveLength(1)
    expect(hydrateGets[0]?.reason).toBe(loadFieldNamesReason)
    await page.getByRole('button', { name: 'Reveal password' }).click()
    await page.getByRole('button', { name: 'Request reveal' }).click()
    await expect(
      page.getByText('Enter an audit reason before revealing.')
    ).toBeVisible()

    await page.getByLabel('Audit reason').fill('password=SuperSecret1234')
    await page.getByLabel('Confirm this controlled reveal').check()
    await page.getByRole('button', { name: 'Request reveal' }).click()
    await expect(
      page.getByText('Audit reason cannot contain secret material.')
    ).toBeVisible()
    expect(dataGets).toEqual(hydrateGets)
    await expect(page.getByText(sentinelPassword)).toHaveCount(0)
    expect(consoleErrors).toEqual([])
  })

  test('keeps a newly added field name visible after save', async ({
    page,
  }) => {
    const { patches } = await installMutableKvRoutes(page)
    await page.goto('/secrets-broker/secrets')
    await page.getByRole('button', { name: 'db' }).click()
    await expect(page.getByLabel('Field 1 name')).toHaveValue('username')
    await expect(page.getByLabel('Field 2 name')).toHaveValue('password')

    await page.getByRole('button', { name: 'Add field' }).click()
    await page.getByLabel('Field 3 name').fill('kv-test-field')
    await page.getByLabel('Field 3 value').fill(sentinelPassword)
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Saved version 2.')).toBeVisible()
    await expect(page.getByLabel('Field 1 name')).toHaveValue('username')
    await expect(page.getByLabel('Field 2 name')).toHaveValue('password')
    await expect(page.getByLabel('Field 3 name')).toHaveValue('kv-test-field')
    await expect(page.getByLabel('Field 3 value')).toHaveValue('')
    await expect(page.getByText(sentinelPassword)).toHaveCount(0)
    expect(patches).toHaveLength(1)
    expect(patches[0]).toContain('kv-test-field')
    expect(patches[0]).not.toContain('username')
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })

  test('opens an icon-only reveal modal and cancels when clicking outside', async ({
    page,
  }) => {
    const { dataGets } = await installKvRoutes(page)
    await page.goto('/secrets-broker/secrets')
    await page.getByRole('button', { name: 'db' }).click()
    const revealButton = page.getByRole('button', { name: 'Reveal password' })
    await expect(revealButton).toBeVisible()
    await expect(revealButton).toHaveAttribute('aria-label', 'Reveal password')
    await expect(revealButton).toHaveText('')

    await revealButton.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(
      page.getByText(/Clicking outside this dialog cancels the reveal/i)
    ).toBeVisible()
    await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveClass(
      /backdrop-blur/
    )

    await page.locator('[data-slot="dialog-overlay"]').click({
      position: { x: 8, y: 8 },
      force: true,
    })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(dataGets).toHaveLength(1)
    expect(dataGets[0]?.reason).toBe(loadFieldNamesReason)
    await expect(page.getByText(sentinelPassword)).toHaveCount(0)
    expect(consoleErrors).toEqual([])
  })

  test('places Source outside the card and filters Path and Value panes', async ({
    page,
  }) => {
    await installKvRoutes(page)
    await page.goto('/secrets-broker/secrets')
    await expect(page.getByTestId('kv-source-chrome')).toBeVisible()
    await expect(
      page.getByTestId('kv-store-card').locator('#kv-source')
    ).toHaveCount(0)
    await expect(
      page.getByTestId('kv-source-chrome').locator('#kv-source')
    ).toHaveCount(1)
    await expect(page.getByTestId('kv-path-pane')).toBeVisible()
    await expect(page.getByTestId('kv-value-pane')).toBeVisible()
    await expect(
      page.getByTestId('kv-path-pane').getByRole('textbox', { name: 'KV path' })
    ).toBeVisible()
    await expect(
      page.getByTestId('kv-value-pane').getByRole('textbox', { name: 'KV path' })
    ).toHaveCount(0)
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByText(/OpenBao-compatible secrets/i)).toHaveCount(0)
    await expect(page.getByText('No values in the key list')).toHaveCount(0)
    await expect(page.getByText('local', { exact: true })).toHaveCount(0)

    await expect(page.getByRole('button', { name: 'apps/' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'db' })).toBeVisible()
    await page.getByLabel('Filter paths').fill('db')
    await expect(page.getByRole('button', { name: 'db' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'apps/' })).toHaveCount(0)

    await page.getByRole('button', { name: 'db' }).click()
    await expect(page.getByLabel('Field 1 name')).toHaveValue('username')
    await expect(page.getByLabel('Field 2 name')).toHaveValue('password')

    await page.getByLabel('Search keys').fill('pass')
    await expect(page.getByLabel('Field 2 name')).toHaveValue('password')
    await expect(page.getByLabel('Field 1 name')).toHaveCount(0)
    await expect(page.getByText(sentinelPassword)).toHaveCount(0)

    await page.getByRole('button', { name: 'Reveal password' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(
      page.getByText(/Clicking outside this dialog cancels the reveal/i)
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancel reveal' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText(sentinelPassword)).toHaveCount(0)
    expect(consoleErrors).toEqual([])
  })

  test('pastes a path in KV Path to navigate and hydrates masked field names', async ({
    page,
  }) => {
    const { dataGets } = await installKvRoutes(page)
    await page.goto('/secrets-broker/secrets')
    await expect(page.getByRole('button', { name: 'services/' })).toBeVisible()
    const pathBox = page.getByRole('textbox', { name: 'KV path' })
    await pathBox.fill('services/node-sample-service/sample.GENERATED_TOKEN')
    await pathBox.press('Enter')
    await expect(page.getByLabel('Field 1 name')).toHaveValue('value')
    await expect(
      page.getByRole('button', { name: '/ node-sample-service' })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'sample.GENERATED_TOKEN' })
    ).toBeVisible()
    await expect(page.getByLabel('Field 1 value')).toHaveValue('')
    await expect(page.getByText(sentinelPassword)).toHaveCount(0)
    expect(dataGets.length).toBeGreaterThan(0)
    expect(dataGets[dataGets.length - 1]?.reason).toBe(loadFieldNamesReason)
    await expectNoSecretMaterial(page)
    expect(consoleErrors).toEqual([])
  })
})
