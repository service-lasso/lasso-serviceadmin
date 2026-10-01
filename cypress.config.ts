import { defineConfig } from 'cypress'
import { createProviderUiConvergenceRecorder } from './scripts/real-browser-qualification-budget.mjs'
import {
  createCypressRunSummaryRecorder,
  createLockedWrapperUiRecorder,
  createQualificationProgressRecorder,
  createRotationRehydrationRecorder,
  createTrustedUnlockDiagnosticRecorder,
} from './scripts/real-browser-qualification-progress.mjs'

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
      const providerUi = createProviderUiConvergenceRecorder({
        enabled: String(config.env.qualificationProgress) === '1',
        write: (line) => process.stderr.write(line),
      })
      const rotationRehydration = createRotationRehydrationRecorder({
        enabled: String(config.env.qualificationProgress) === '1',
        write: (line) => process.stderr.write(line),
      })
      const lockedWrapperUi = createLockedWrapperUiRecorder({
        enabled: String(config.env.qualificationProgress) === '1',
        write: (line) => process.stderr.write(line),
      })
      const cypressRunSummary = createCypressRunSummaryRecorder({
        enabled: String(config.env.qualificationProgress) === '1',
        write: (line) => process.stderr.write(line),
      })
      const trustedUnlock = createTrustedUnlockDiagnosticRecorder({
        enabled: String(config.env.qualificationProgress) === '1',
        write: (line) => process.stderr.write(line),
      })
      on('before:spec', (spec) => {
        progress.setSpecPath(spec.absolute)
        providerUi.setSpecPath(spec.absolute)
        rotationRehydration.setSpecPath(spec.absolute)
        lockedWrapperUi.setSpecPath(spec.absolute)
        cypressRunSummary.setSpecPath(spec.absolute)
        trustedUnlock.setSpecPath(spec.absolute)
      })
      on('after:spec', (_spec, results) => {
        progress.setSpecPath(undefined)
        providerUi.setSpecPath(undefined)
        rotationRehydration.setSpecPath(undefined)
        lockedWrapperUi.setSpecPath(undefined)
        trustedUnlock.record(results)
        trustedUnlock.setSpecPath(undefined)
      })
      on('after:run', (results) => {
        cypressRunSummary.record(results)
      })
      on('task', {
        trustedUnlockRealProviderControlEnabled() {
          return (
            String(config.env.trustedUnlockRealProviderControlFailure) === '1'
          )
        },
        qualificationCheckpoint(phase) {
          progress.record(phase)
          return null
        },
        providerUiConvergenceCheckpoint(diagnostic) {
          providerUi.record(diagnostic)
          return null
        },
        rotationRehydrationDiagnostic(diagnostic) {
          rotationRehydration.record(diagnostic)
          return null
        },
        lockedWrapperUiCheckpoint(diagnostic) {
          lockedWrapperUi.record(diagnostic)
          return null
        },
        trustedUnlockDiagnostic(diagnostic) {
          return trustedUnlock.retain(diagnostic)
        },
      })
      return config
    },
  },
})
