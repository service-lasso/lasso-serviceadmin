import { chromium } from '@playwright/test'

export default async function globalSetup(config) {
  const baseURL = config.projects[0]?.use?.baseURL
  if (typeof baseURL !== 'string') {
    throw new Error('Playwright baseURL is required for UI qualification.')
  }

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(baseURL, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    const fixture = await page.evaluate(async () => {
      const dashboard = await import('/src/lib/service-lasso-dashboard/stub.ts')
      const setup = await dashboard.fetchFirstRunSetupState()
      return {
        stubMode: dashboard.isServiceAdminStubModeEnabled(),
        setupState: setup.state,
      }
    })
    if (!fixture.stubMode || fixture.setupState !== 'not_required') {
      throw new Error(
        `UI qualification requires the setup-complete fixture; received ${JSON.stringify(fixture)}.`
      )
    }
    await page.getByTestId('active-page-identity').waitFor({
      state: 'visible',
      timeout: 30_000,
    })
  } finally {
    await browser.close()
  }
}
