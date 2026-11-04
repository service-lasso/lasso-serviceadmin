import { expect, test } from '@playwright/test'

test('service setup steps render and run from the setup tab', async ({
  page,
}) => {
  await page.goto('/services/dagu?tab=setup')

  await expect(
    page.getByText('Setup steps', { exact: true }).first()
  ).toBeVisible()
  await expect(
    page.getByText('generate-certificate', { exact: true }).first()
  ).toBeVisible()
  await expect(
    page.getByText('Generate local TLS material required by the service.')
  ).toBeVisible()
  await expect(
    page.getByText('Prepare runtime cache directories.')
  ).toBeVisible()

  const runAll = page.getByRole('button', { name: 'Run all', exact: true })
  await expect(runAll).toBeEnabled()
  await expect(page.getByLabel('Force rerun')).toBeVisible()

  await runAll.click()
  await expect(page.getByText('Setup completed for "dagu".')).toBeVisible({
    timeout: 10_000,
  })
})

test('service setup can run a manual step and update its status', async ({
  page,
}) => {
  await page.goto('/services/zitadel?tab=setup')

  await expect(
    page.getByText('seed-admin', { exact: true }).first()
  ).toBeVisible()
  await expect(
    page.getByText('Create the initial administrator realm user.')
  ).toBeVisible()
  await expect(page.getByText('manual-only').first()).toBeVisible()

  await page
    .getByRole('button', { name: 'Run step', exact: true })
    .first()
    .click()
  await expect(page.getByText('Setup completed for "zitadel".')).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('Succeeded').first()).toBeVisible()
})

test('service access tab renders mapped groups and permission grants', async ({
  page,
}) => {
  await page.goto('/services/%40traefik?tab=access')

  await expect(page.getByText('Last-owner protection')).toBeVisible()
  await expect(page.getByText('Platform Owners').first()).toBeVisible()
  await expect(page.getByText('Release Operators').first()).toBeVisible()
  await expect(page.getByText('Backup Readers').first()).toBeVisible()
  await expect(page.getByText('Runtime owner').first()).toBeVisible()
  await expect(page.getByText('Run service action').first()).toBeVisible()
  await expect(page.getByText('Read service backups').first()).toBeVisible()

  const revokeButtons = page.getByRole('button', {
    name: 'Revoke',
    exact: true,
  })
  await expect(revokeButtons).toHaveCount(3)
  await expect(revokeButtons.first()).toBeDisabled()
})

test('service config editor renders and saves a validated edit', async ({
  page,
}) => {
  await page.goto('/services/dagu?tab=config')

  await expect(page.getByTestId('service-config-editor')).toBeVisible()
  await expect(
    page.getByText('server.json editor', { exact: true })
  ).toBeVisible()
  await expect(page.getByText('Valid JSON').first()).toBeVisible()
  await expect(page.getByText('Saved').first()).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Backup history' })
  ).toBeVisible()

  const save = page.getByRole('button', { name: 'Save', exact: true })
  await expect(save).toBeDisabled()

  // Drive the Monaco model directly so the edit is deterministic across
  // Chromium and WebKit instead of depending on each engine's input surface.
  await page.waitForFunction(() => {
    const monaco = (
      window as unknown as {
        monaco?: {
          editor?: {
            getModels?: () => Array<{ getValue: () => string }>
          }
        }
      }
    ).monaco
    return Boolean(
      monaco?.editor
        ?.getModels?.()
        .some((model) => model.getValue().includes('"id": "dagu"'))
    )
  })
  await page
    .getByPlaceholder('Describe the operator change')
    .fill('e2e audit reason')

  // Retry the model edit until the controlled editor reports the change. A
  // late config load can otherwise reset the content and clear the dirty flag.
  await expect
    .poll(
      async () => {
        await page.evaluate(() => {
          const monaco = (
            window as unknown as {
              monaco?: {
                editor?: {
                  getModels?: () => Array<{
                    getValue: () => string
                    setValue: (value: string) => void
                  }>
                }
              }
            }
          ).monaco
          const model = monaco?.editor
            ?.getModels?.()
            .find((candidate) => candidate.getValue().includes('"id": "dagu"'))
          if (!model) throw new Error('Monaco model not available')
          model.setValue(`${model.getValue().trimEnd()} `)
        })
        return save.isEnabled()
      },
      { timeout: 15_000, intervals: [250, 500, 1000, 2000] }
    )
    .toBe(true)
  await save.click()

  await expect(
    page.getByText('server.json saved with backup history.')
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Saved').first()).toBeVisible()
})

test('service setup tab shows the empty state when no steps are declared', async ({
  page,
}) => {
  await page.goto('/services/%40serviceadmin?tab=setup')

  await expect(
    page.getByText('No setup steps are declared for this service.')
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Run all', exact: true })
  ).toBeDisabled()
})
