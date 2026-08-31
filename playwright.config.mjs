import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.UI_TEST_PORT ?? 4175)
const chromiumChannel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL

export default defineConfig({
  testDir: './tests/ui',
  globalSetup: './tests/ui/global-setup.mjs',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm exec vite --mode ui-test --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      SERVICE_ADMIN_UI_TEST: 'true',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumChannel ? { channel: chromiumChannel } : {}),
      },
    },
  ],
})
