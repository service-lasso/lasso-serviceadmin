import { expect, test, type Page } from '@playwright/test'

type SetupFixture = {
  state: string
  setupMode: boolean
  vault: { required: boolean; ready: boolean }
  trustBoundary: {
    bindHost: string
    localOnly: boolean
    localhostBootstrapAllowed: boolean
    remoteBootstrapAllowed: boolean
    setupTokenConfigured: boolean
    blockers: string[]
  }
}

const setupRequired: SetupFixture = {
  state: 'setup_required',
  setupMode: true,
  vault: { required: true, ready: false },
  trustBoundary: {
    bindHost: '127.0.0.1',
    localOnly: true,
    localhostBootstrapAllowed: true,
    remoteBootstrapAllowed: false,
    setupTokenConfigured: false,
    blockers: [],
  },
}

async function renderSetup(page: Page, fixture: SetupFixture) {
  await page.addInitScript((value) => {
    ;(
      globalThis as { __SERVICE_ADMIN_FIRST_RUN_SETUP__?: unknown }
    ).__SERVICE_ADMIN_FIRST_RUN_SETUP__ = value
  }, fixture)
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Service Lasso first-run setup' })
  ).toBeVisible()
}

test('first-run setup gate bootstraps the broker and opens the app', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await renderSetup(page, setupRequired)
  await expect(
    page.getByText('Setup required', { exact: true }).first()
  ).toBeVisible()
  await expect(page.getByText('Recreate required')).toHaveCount(0)

  const initialize = page.getByRole('button', {
    name: /Initialize Secrets Broker/i,
  })
  await expect(initialize).toBeEnabled()
  await initialize.click()

  await expect(page.getByTestId('active-page-identity')).toBeVisible({
    timeout: 15_000,
  })
  await expect(
    page.getByRole('heading', { name: 'Service Lasso first-run setup' })
  ).toHaveCount(0)
  expect(pageErrors).toEqual([])
})

test('first-run setup blocks bootstrap when the trust boundary forbids it', async ({
  page,
}) => {
  await renderSetup(page, {
    ...setupRequired,
    trustBoundary: {
      ...setupRequired.trustBoundary,
      localOnly: false,
      localhostBootstrapAllowed: false,
      remoteBootstrapAllowed: false,
      blockers: ['setup_token_required_for_remote_bind'],
    },
  })

  await expect(page.getByText('Bootstrap blocked')).toBeVisible()
  await expect(
    page.getByText(
      'Remote setup requires an operator-configured one-time setup token.'
    )
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Initialize Secrets Broker/i })
  ).toBeDisabled()
})

test('first-run setup requires the one-time remote setup token', async ({
  page,
}) => {
  await renderSetup(page, {
    ...setupRequired,
    trustBoundary: {
      ...setupRequired.trustBoundary,
      localOnly: false,
      localhostBootstrapAllowed: false,
      remoteBootstrapAllowed: true,
      setupTokenConfigured: true,
    },
  })

  const initialize = page.getByRole('button', {
    name: /Initialize Secrets Broker/i,
  })
  const token = page.getByLabel('One-time setup token')
  await expect(token).toBeVisible()
  await expect(initialize).toBeDisabled()

  await token.fill('remote-setup-token')
  await expect(initialize).toBeEnabled()
})

test('first-run setup explains the lost-key recreate path', async ({
  page,
}) => {
  await renderSetup(page, { ...setupRequired, state: 'lost_key' })

  await expect(page.getByText('Recreate required').first()).toBeVisible()
  await expect(page.getByText('Lost key requires store recreate')).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: /Initialize Secrets Broker from a new store/i,
    })
  ).toBeVisible()
})
