import { expect, test } from '@playwright/test'

test('Broker RAM files page lists fixture metadata and supports service/search filters', async ({
  page,
}, testInfo) => {
  await page.goto('/secrets-broker/webdav')
  await expect(
    page.getByRole('heading', { name: 'RAM files', exact: true })
  ).toBeVisible()
  await expect(page.getByTestId('broker-webdav')).toBeVisible()
  await expect(
    page.getByText('demo-config.json', { exact: true })
  ).toBeVisible()
  await expect(page.getByText('Listening · loopback only')).toBeVisible()
  await expect(page.getByText('48 B / 64.0 MiB')).toBeVisible()
  await page.getByRole('button', { name: 'echo-webdav', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Search WebDAV files' })
    .fill('missing')
  await expect(page.getByText('No matching files on this page.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Search WebDAV files' }).fill('')
  await page
    .getByRole('combobox', { name: 'Sort WebDAV files' })
    .selectOption('downloads')
  await page.getByRole('button', { name: 'Refresh files' }).click()
  await expect(
    page.getByText('demo-config.json', { exact: true })
  ).toBeVisible()
  await expect(
    page
      .getByTestId('broker-webdav')
      .getByRole('button', { name: /upload|download/i })
  ).toHaveCount(0)
  const desktop = testInfo.outputPath('webdav-desktop.png')
  await page.screenshot({ path: desktop, fullPage: true })
  await testInfo.attach('RAM WebDAV desktop', {
    path: desktop,
    contentType: 'image/png',
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByText('demo-config.json', { exact: true })
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  const mobile = testInfo.outputPath('webdav-mobile.png')
  await page.screenshot({ path: mobile, fullPage: true })
  await testInfo.attach('RAM WebDAV mobile', {
    path: mobile,
    contentType: 'image/png',
  })
})
