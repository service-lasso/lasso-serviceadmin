import { defineConfig } from 'cypress'
import { createQualificationProgressRecorder } from './scripts/real-browser-qualification-progress.mjs'

export default defineConfig({
  allowCypressEnv: false,
  video: false,
  screenshotOnRunFailure: true,
  e2e: {
    baseUrl: 'http://127.0.0.1:4173',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: false,
    setupNodeEvents(on, config) {
      const progress = createQualificationProgressRecorder({
        enabled: String(config.env.qualificationProgress) === '1',
        write: (line) => process.stderr.write(line),
      })
      on('before:spec', (spec) => progress.setSpecPath(spec.absolute))
      on('after:spec', () => progress.setSpecPath(undefined))
      on('task', {
        qualificationCheckpoint(phase) {
          progress.record(phase)
          return null
        },
      })
      return config
    },
  },
})
