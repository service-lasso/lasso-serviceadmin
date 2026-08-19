import { expect, test, type Page } from '@playwright/test'

async function expectActivePageIdentity(page: Page, identity: string) {
  await expect(page.getByTestId('active-page-identity')).toHaveAccessibleName(
    `Current page: ${identity}`
  )
}

test('dashboard renders and starts stopped services', async ({ page }) => {
  await page.goto('/')

  await expectActivePageIdentity(page, 'Dashboard')
  await expect(page.getByText('Runtime health', { exact: true })).toBeVisible()
  await expect(page.getByText('Broker ready', { exact: true })).toBeVisible()
  await expect(page.getByText('Broker lockouts', { exact: true })).toBeVisible()
  await expect(page.getByText('1 stopped, 1 degraded')).toBeVisible()
  await expect(page.getByText('2/4')).toBeVisible()
  await expect(page.getByText('Dagu').first()).toBeVisible()
  await expect(page.getByText('Stopped').first()).toBeVisible()

  await page.getByRole('button', { name: /start services/i }).click()

  await expect(page.getByText('3/4')).toBeVisible()
  await expect(
    page.getByRole('link', { name: /dagu add favorite running/i })
  ).toBeVisible()
})

test('services table filters and opens service detail', async ({ page }) => {
  await page.goto('/services')

  await expectActivePageIdentity(page, 'Services')
  const header = page.locator('header')
  await expect(header.getByTestId('page-toolbar')).toBeVisible()
  await expect(page.locator('main').getByTestId('page-toolbar')).toHaveCount(0)
  await expect(
    header.getByRole('button', { name: 'Start all', exact: true })
  ).toBeVisible()
  await header.getByRole('button', { name: 'Links', exact: true }).click()
  await expect(
    page.getByRole('menuitem', { name: 'Open Help Center: Service actions' })
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Toggle theme' })).toBeVisible()
  const identity = header.getByTestId('active-page-identity')
  const toolbar = header.getByTestId('page-toolbar')
  const links = header.getByRole('button', { name: 'Links', exact: true })
  const themeSwitch = page.getByRole('button', { name: 'Toggle theme' })
  const startAll = header.getByRole('button', {
    name: 'Start all',
    exact: true,
  })
  const identityBox = await identity.boundingBox()
  const toolbarBox = await toolbar.boundingBox()
  const startBox = await startAll.boundingBox()
  const linksBox = await links.boundingBox()
  const themeBox = await themeSwitch.boundingBox()
  const leadingRight = await header.evaluate((element) => {
    const row = element.firstElementChild
    const leading = row?.firstElementChild
    if (!leading) {
      return 0
    }
    return leading.getBoundingClientRect().right
  })
  expect(identityBox).toBeTruthy()
  expect(toolbarBox).toBeTruthy()
  expect(startBox).toBeTruthy()
  expect(linksBox).toBeTruthy()
  expect(themeBox).toBeTruthy()
  if (identityBox && toolbarBox && startBox && linksBox && themeBox) {
    const emptyCenter = (leadingRight + toolbarBox.x) / 2
    const titleCenter = identityBox.x + identityBox.width / 2
    expect(Math.abs(titleCenter - emptyCenter)).toBeLessThan(24)
    expect(Math.abs(startBox.y - linksBox.y)).toBeLessThan(8)
    expect(linksBox.x).toBeLessThan(themeBox.x)
  }
  await expect(
    page.getByRole('button', { name: 'Start all', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Start all', exact: true })
  ).toHaveClass(/text-emerald-600/)
  await expect(
    page.getByRole('button', { name: 'Start all', exact: true })
  ).not.toHaveClass(/bg-emerald-600/)
  await expect(
    page.getByRole('button', { name: 'Stop all', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Stop all', exact: true })
  ).toHaveClass(/text-red-600/)
  await expect(
    page.getByRole('button', { name: 'Stop all', exact: true })
  ).not.toHaveClass(/bg-red-600/)
  await expect(
    page.getByRole('button', { name: 'Restart all', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Restart all', exact: true })
  ).toHaveClass(/text-red-600/)
  await expect(
    page.getByRole('button', { name: 'Restart all', exact: true })
  ).not.toHaveClass(/bg-red-600/)
  await expect(
    page.getByRole('button', { name: 'Start Traefik', exact: true })
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Start Traefik', exact: true })
  ).toHaveClass(/text-emerald-600/)
  await expect(
    page.getByRole('button', { name: 'Start Traefik', exact: true })
  ).toHaveClass(/disabled:text-muted-foreground/)
  await expect(
    page.getByRole('button', { name: 'Stop Traefik', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Stop Traefik', exact: true })
  ).toHaveClass(/text-red-600/)
  await expect(
    page.getByRole('button', { name: 'Restart Traefik', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Restart Traefik', exact: true })
  ).toHaveClass(/text-red-600/)

  await page
    .getByPlaceholder(
      'Search services and open details from the matching row...'
    )
    .fill('Traefik')

  await page.getByRole('button', { name: 'Stop Traefik', exact: true }).click()
  await expect(page.getByText('Stopped', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Start Traefik', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Stop Traefik', exact: true })
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Restart Traefik', exact: true })
  ).toBeDisabled()

  await page.getByRole('button', { name: 'Start Traefik', exact: true }).click()
  await expect(page.getByText('Running', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Start Traefik', exact: true })
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Stop Traefik', exact: true })
  ).toBeEnabled()

  await page
    .getByPlaceholder(
      'Search services and open details from the matching row...'
    )
    .fill('Service Admin')

  await expect(page.getByText('Service Admin UI')).toBeVisible()
  await expect(page.getByText('Traefik')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Start Service Admin UI', exact: true })
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Stop Service Admin UI', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', {
      name: 'Restart Service Admin UI',
      exact: true,
    })
  ).toHaveCount(0)

  await page.getByRole('link', { name: /details/i }).click()
  await expect(page).toHaveURL(/\/services\/%40serviceadmin$/)
  await expect(
    page.getByRole('heading', { name: 'Service Admin UI' })
  ).toBeVisible()
  await expect(
    page.getByText('Operator dashboard for Service Lasso')
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Start service', exact: true })
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Start service', exact: true })
  ).toHaveAttribute('title', 'Start service unavailable for Service Admin UI')
  await expect(
    page.getByRole('button', { name: 'Stop service', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Stop service', exact: true })
  ).toHaveClass(/text-red-600/)
  await expect(
    page.getByRole('button', { name: 'Stop service', exact: true })
  ).not.toHaveClass(/bg-red-600/)
  await expect(
    page.getByRole('button', { name: 'Restart service', exact: true })
  ).toBeDisabled()
  await page.getByRole('tab', { name: /variables/i }).click()
  await expect(page.getByText('VITE_SERVICE_LASSO_API_BASE_URL')).toBeVisible()
})

test('service detail variables table keeps long values inside their columns', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/services/@serviceadmin')
  await page.getByRole('tab', { name: /variables/i }).click()

  const table = page.getByTestId('service-detail-variables-table')
  const row = table
    .locator('tbody tr')
    .filter({ hasText: 'SERVICE_LASSO_RUNTIME_CONFIG_PATH' })

  await expect(row).toBeVisible()

  const cells = row.locator('td')
  const cellBoxes = await cells.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
      }
    })
  )

  expect(cellBoxes[1].right).toBeLessThanOrEqual(cellBoxes[2].left + 1)
  expect(cellBoxes[2].right).toBeLessThanOrEqual(cellBoxes[3].left + 1)
  expect(cellBoxes[3].right).toBeLessThanOrEqual(cellBoxes[4].left + 1)

  const valueElement = row.getByTestId('service-detail-variable-value')
  const valueFitsColumn = await valueElement.evaluate((element) => {
    const styles = window.getComputedStyle(element)
    return (
      styles.textOverflow === 'ellipsis' &&
      (styles.whiteSpace === 'nowrap' ||
        element.scrollHeight <= element.clientHeight + 1)
    )
  })
  expect(valueFitsColumn).toBe(true)

  await expect(row.getByTestId('service-detail-variable-actions')).toBeVisible()
  const viewVariableLink = row.getByRole('link', { name: 'View variable' })
  await expect(viewVariableLink).toBeVisible()
  await expect(viewVariableLink).toHaveAttribute(
    'href',
    /\/variables\?service=%40serviceadmin&key=/
  )
})

test('service detail variables table can search, filter by scope, and paginate', async ({
  page,
}) => {
  await page.goto('/services/@serviceadmin?tab=variables')

  const table = page.getByTestId('service-detail-variables-table')
  await expect(table).toBeVisible()
  await expect(
    page.getByPlaceholder('Search keys, visible values, scope, or sources...')
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Scope$/i }).first()
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Source$/i }).first()
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /next page/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /next page/i })).toBeDisabled()
  await expect(page.getByText('Rows per page')).toBeVisible()

  await page
    .getByPlaceholder('Search keys, visible values, scope, or sources...')
    .fill('RUNTIME_CONFIG')
  await expect(
    table
      .locator('tbody tr')
      .filter({ hasText: 'SERVICE_LASSO_RUNTIME_CONFIG_PATH' })
  ).toBeVisible()
  await expect(page.getByText('VITE_SERVICE_LASSO_API_BASE_URL')).toHaveCount(0)

  await page.getByRole('button', { name: /^Reset$/i }).click()
  await page
    .getByRole('button', { name: /^Scope$/i })
    .first()
    .click()
  await page
    .locator('[data-slot="command-item"]')
    .filter({ hasText: 'Global' })
    .click()
  await expect(page.getByText('SERVICE_LASSO_ROOT')).toBeVisible()
  await expect(page.getByText('VITE_SERVICE_LASSO_API_BASE_URL')).toHaveCount(0)
  await expect(table.getByText('global').first()).toBeVisible()
})

test('service detail tabs are deep-linkable and restore through browser history', async ({
  page,
}) => {
  await page.goto('/services/@serviceadmin?tab=variables')

  await expect(
    page.getByRole('heading', { name: 'Service Admin UI' })
  ).toBeVisible()
  await expect(page.getByRole('tab', { name: /variables/i })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByText('VITE_SERVICE_LASSO_API_BASE_URL')).toBeVisible()

  await page.getByRole('tab', { name: /logs/i }).click()
  await expect(page).toHaveURL(/\/services\/%40serviceadmin\?tab=logs$/)

  await page.getByRole('tab', { name: /variables/i }).click()
  await expect(page).toHaveURL(/\/services\/%40serviceadmin\?tab=variables$/)

  await page.getByRole('link', { name: 'Open all variables' }).click()
  await expect(page).toHaveURL(/\/variables\?service=%40serviceadmin$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/services\/%40serviceadmin\?tab=variables$/)
  await expect(page.getByRole('tab', { name: /variables/i })).toHaveAttribute(
    'aria-selected',
    'true'
  )
})

test('runtime, network, installed, and variables tables render', async ({
  page,
}) => {
  await page.goto('/runtime')
  await expectActivePageIdentity(page, 'Runtime')
  await expect(page.getByText('Runtime status')).toHaveCount(0)
  await expect(
    page.getByRole('columnheader', { name: /service/i })
  ).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: /runtime/i })
  ).toBeVisible()
  await expect(page.getByText('Service Admin UI')).toBeVisible()

  await page.goto('/network')
  await expectActivePageIdentity(page, 'Network')
  await expect(page.getByText('Service endpoints')).toHaveCount(0)
  await expect(
    page.getByRole('columnheader', { name: /endpoint/i })
  ).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /url/i })).toBeVisible()
  await expect(page.getByText('http://localhost:17700')).toBeVisible()

  await page.goto('/installed')
  await expectActivePageIdentity(page, 'Installed')
  await expect(
    page.getByText('Installed services', { exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByRole('columnheader', { name: /service/i })
  ).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: /package/i })
  ).toBeVisible()
  await expect(
    page.getByRole('cell', { name: 'lasso-@serviceadmin', exact: true })
  ).toBeVisible()

  await page.goto('/variables')
  await expectActivePageIdentity(page, 'Variables')
  await expect(page.getByText('Environment variables')).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: /key/i })).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: /resolved value/i })
  ).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: /template value/i })
  ).toBeVisible()
  await expect(page.getByText('SERVICE_LASSO_ROOT').first()).toBeVisible()
})

test('help center, logs, tables, and providers chrome', async ({ page }) => {
  await page.goto('/help-center')
  await expectActivePageIdentity(page, 'Help Center')
  const header = page.locator('header')
  await expect(header.getByRole('link', { name: 'Services' })).toBeVisible()
  await expect(page.locator('main a[href="/services"]')).toHaveCount(0)
  await expect(page.getByPlaceholder(/Search docs/i)).toBeVisible()
  await expect(page.getByTestId('help-doc-card').first()).toBeVisible()
  await page.getByPlaceholder(/Search docs/i).fill('packaging')
  await expect(
    page.getByRole('heading', {
      name: /Service Admin Packaging and Release Artifacts/i,
    })
  ).toBeVisible()

  await page.goto('/logs')
  await expectActivePageIdentity(page, 'Logs')
  await expect(page.getByText('Selected service')).toHaveCount(0)
  await expect(page.getByText('Viewer mode')).toHaveCount(0)
  await expect(page.getByText('Log entries')).toBeVisible()

  await page.goto('/services')
  const servicesScroll = page.getByTestId('data-table-scroll-region')
  await expect(servicesScroll).toBeVisible()
  await expect(page.getByRole('button', { name: /next page/i })).toBeVisible()
  const paginationBox = await page
    .getByRole('button', { name: /next page/i })
    .boundingBox()
  const scrollBox = await servicesScroll.boundingBox()
  expect(scrollBox).toBeTruthy()
  expect(paginationBox).toBeTruthy()
  if (scrollBox && paginationBox) {
    expect(paginationBox.y).toBeGreaterThan(scrollBox.y)
  }

  await page.goto('/secrets-broker/sources')
  await expectActivePageIdentity(page, 'Providers')
  await expect(page.getByText('Live provider source metadata')).toHaveCount(0)
  await expect(page.getByTestId('data-table-scroll-region')).toBeVisible()
})
