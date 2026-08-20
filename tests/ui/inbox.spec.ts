import { expect, test, type Page } from '@playwright/test'

async function expectActivePageIdentity(page: Page, identity: string) {
  await expect(page.getByTestId('active-page-identity')).toHaveAccessibleName(
    `Current page: ${identity}`
  )
}

test('inbox lists unread notices, marks them read, and deep-links to a service', async ({
  page,
}) => {
  await page.goto('/')

  await expectActivePageIdentity(page, 'Dashboard')
  await expect(
    page.getByRole('link', { name: 'Inbox, 4 unread', exact: true })
  ).toBeVisible()
  await expect(page.getByTestId('inbox-header-chip')).toHaveAccessibleName(
    'Open Inbox, 4 unread'
  )

  await page.getByTestId('inbox-header-chip').click()
  await expectActivePageIdentity(page, 'Inbox')
  await expect(page).toHaveTitle('Service Admin - Inbox')
  await expect(
    page.getByRole('heading', { name: 'Update available: @traefik' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Service health degraded: dagu' })
  ).toBeVisible()
  await expect(page.getByText(/operator\.json/i)).toHaveCount(0)

  const updateCard = page.getByTestId(
    'inbox-item-inbox-update-available-traefik'
  )
  await updateCard.getByRole('button', { name: 'Mark read' }).click()
  await expect(
    page.getByRole('heading', { name: 'Update available: @traefik' })
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'Read', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Update available: @traefik' })
  ).toBeVisible()

  await page.getByRole('button', { name: 'Unread', exact: true }).click()
  const healthCard = page.getByTestId('inbox-item-inbox-service-health-dagu')
  await healthCard.getByRole('link', { name: 'Open service' }).click()
  await expect(page).toHaveURL(/\/services\/dagu$/)
  await expect(page.getByRole('heading', { name: /^Dagu$/i })).toBeVisible()
})

test('inbox deep-links workflow notices to the service log viewer', async ({
  page,
}) => {
  await page.goto('/inbox')

  await expectActivePageIdentity(page, 'Inbox')
  const workflowCard = page.getByTestId(
    'inbox-item-inbox-workflow-failed-serviceadmin'
  )
  await workflowCard.getByRole('link', { name: 'Open logs' }).click()
  await expect(page).toHaveURL(/\/logs\?service=(%40|@)serviceadmin/)
  await expectActivePageIdentity(page, 'Logs')
})

test('inbox hides a notice and restores it from Hidden', async ({ page }) => {
  await page.goto('/inbox')

  await expectActivePageIdentity(page, 'Inbox')
  const runtimeCard = page.getByTestId('inbox-item-inbox-system-startup')
  await runtimeCard.getByRole('button', { name: 'Hide' }).click()
  await expect(
    page.getByRole('heading', { name: 'Runtime startup' })
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'Hidden (1)' }).click()
  await expect(
    page.getByRole('heading', { name: 'Runtime startup' })
  ).toBeVisible()

  const hiddenCard = page.getByTestId('inbox-item-inbox-system-startup')
  await hiddenCard.getByRole('button', { name: 'Restore' }).click()
  await expect(
    page.getByRole('heading', { name: 'Runtime startup' })
  ).toHaveCount(0)

  await page.getByRole('button', { name: 'Unread', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Runtime startup' })
  ).toBeVisible()
})
