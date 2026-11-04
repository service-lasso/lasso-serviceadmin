import { expect, test } from '@playwright/test'

test('operations telemetry renders signals, safety boundary, and filters', async ({
  page,
}) => {
  await page.goto('/operations/telemetry')

  await expect(
    page.getByText('Service Lasso signals', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText('Secrets Broker signals', { exact: true })
  ).toBeVisible()
  await expect(page.getByText('Safety boundary', { exact: true })).toBeVisible()
  await expect(
    page.getByPlaceholder('Search telemetry signals...')
  ).toBeVisible()

  await expect(page.getByText('Core telemetry exporter').first()).toBeVisible()
  await expect(
    page.getByText('Telemetry allowlist redaction').first()
  ).toBeVisible()
})

test('operations audit renders the fixture source, summary, and audit rows', async ({
  page,
}) => {
  await page.goto('/operations/audit-logging')

  await expect(page.getByText('Data source', { exact: true })).toBeVisible()
  await expect(page.getByText('Audit events', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Durable operator actions', { exact: true })
  ).toBeVisible()
  await expect(page.getByText('Chain status', { exact: true })).toBeVisible()
  await expect(page.getByText('Raw material', { exact: true })).toBeVisible()

  await expect(page.getByText('Fixture preview').first()).toBeVisible()
  await expect(page.getByPlaceholder('Search audit events...')).toBeVisible()

  await expect(page.getByText('runtime reload').first()).toBeVisible()
  await expect(page.getByText('service lifecycle start').first()).toBeVisible()
  await expect(page.getByText('service config save').first()).toBeVisible()
})

test('settings startup toggles the runtime autostart preference', async ({
  page,
}) => {
  await page.goto('/settings/startup')

  await expect(page.getByRole('heading', { name: 'Startup' })).toBeVisible()
  const autostart = page.getByRole('switch', {
    name: 'Start enabled services automatically',
  })
  await expect(autostart).toBeChecked()

  await autostart.click()
  await expect(autostart).not.toBeChecked()

  await autostart.click()
  await expect(autostart).toBeChecked()
})

test('settings appearance submits font and theme preferences', async ({
  page,
}) => {
  await page.goto('/settings/appearance')

  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()

  await page.locator('select').selectOption('manrope')
  await page.getByText('Dark', { exact: true }).last().click()
  await page.getByRole('button', { name: 'Update preferences' }).click()

  await expect(
    page.getByText('You submitted the following values:')
  ).toBeVisible()
  await expect(page.getByText('"font": "manrope"').first()).toBeVisible()
  await expect(page.getByText('"theme": "dark"').first()).toBeVisible()
})
