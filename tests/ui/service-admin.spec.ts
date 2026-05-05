import { expect, test } from '@playwright/test'

test('dashboard renders and starts stopped services', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Runtime health', { exact: true })).toBeVisible()
  await expect(page.getByText('1 stopped, 1 degraded')).toBeVisible()
  await expect(page.getByText('3/5')).toBeVisible()
  await expect(page.getByText('Dagu').first()).toBeVisible()
  await expect(page.getByText('Stopped').first()).toBeVisible()

  await page.getByRole('button', { name: /start services/i }).click()

  await expect(page.getByText('4/5')).toBeVisible()
  await expect(
    page.getByRole('link', { name: /dagu add favorite running/i })
  ).toBeVisible()
})

test('services table filters and opens service detail', async ({ page }) => {
  await page.goto('/services')

  await expect(page.getByRole('heading', { name: 'Services' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Start all', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Start all', exact: true })
  ).toHaveClass(/hover:bg-emerald-600/)
  await expect(
    page.getByRole('button', { name: 'Stop all', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Stop all', exact: true })
  ).toHaveClass(/hover:bg-red-600/)
  await expect(
    page.getByRole('button', { name: 'Restart all', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Restart all', exact: true })
  ).toHaveClass(/hover:bg-red-600/)
  await expect(
    page.getByRole('button', { name: 'Start Traefik', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Start Traefik', exact: true })
  ).toHaveClass(/hover:bg-emerald-600/)
  await expect(
    page.getByRole('button', { name: 'Stop Traefik', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Stop Traefik', exact: true })
  ).toHaveClass(/hover:bg-red-600/)
  await expect(
    page.getByRole('button', { name: 'Restart Traefik', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Restart Traefik', exact: true })
  ).toHaveClass(/hover:bg-red-600/)

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

  await page.getByRole('button', { name: 'Start Traefik', exact: true }).click()
  await expect(page.getByText('Running', { exact: true })).toBeVisible()

  await page
    .getByPlaceholder(
      'Search services and open details from the matching row...'
    )
    .fill('Service Admin')

  await expect(page.getByText('Service Admin UI')).toBeVisible()
  await expect(page.getByText('Traefik')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Start Service Admin UI', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Stop Service Admin UI', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', {
      name: 'Restart Service Admin UI',
      exact: true,
    })
  ).toBeEnabled()

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
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Start service', exact: true })
  ).toHaveClass(/hover:bg-emerald-600/)
  await expect(
    page.getByRole('button', { name: 'Stop service', exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Stop service', exact: true })
  ).toHaveClass(/hover:bg-red-600/)
  await page.getByRole('tab', { name: /variables/i }).click()
  await expect(page.getByText('VITE_SERVICE_LASSO_API_BASE_URL')).toBeVisible()
})

test('runtime, network, installed, and variables tables render', async ({
  page,
}) => {
  await page.goto('/runtime')
  await expect(page.getByRole('heading', { name: 'Runtime' })).toBeVisible()
  await expect(page.getByText('Runtime status')).toBeVisible()
  await expect(page.getByText('Service Admin UI')).toBeVisible()

  await page.goto('/network')
  await expect(page.getByRole('heading', { name: 'Network' })).toBeVisible()
  await expect(page.getByText('Service endpoints')).toBeVisible()
  await expect(page.getByText('http://localhost:17700')).toBeVisible()

  await page.goto('/installed')
  await expect(page.getByRole('heading', { name: 'Installed' })).toBeVisible()
  await expect(page.getByText('Installed services')).toBeVisible()
  await expect(
    page.getByRole('cell', { name: 'lasso-@serviceadmin', exact: true })
  ).toBeVisible()

  await page.goto('/variables')
  await expect(page.getByRole('heading', { name: 'Variables' })).toBeVisible()
  await expect(page.getByText('Environment variables')).toBeVisible()
  await expect(page.getByText('SERVICE_LASSO_ROOT').first()).toBeVisible()
})
