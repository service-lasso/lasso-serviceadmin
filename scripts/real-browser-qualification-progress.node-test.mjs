import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildQualificationFailureDiagnostic,
  createCypressRunSummaryRecorder,
  parseCypressRunSummaryDiagnostic,
} from './real-browser-qualification-progress.mjs'

test('records one lifecycle-only Cypress run summary without private input', () => {
  const records = []
  const recorder = createCypressRunSummaryRecorder({
    enabled: true,
    write: (line) => records.push(JSON.parse(line)),
  })
  recorder.setSpecPath('/private/cypress/e2e/secrets-broker/real-lifecycle.cy.js')
  recorder.record({
    totalTests: 1,
    totalPassed: 1,
    totalFailed: 0,
    totalPending: 0,
    totalSkipped: 0,
    spec: { name: 'PRIVATE_SENTINEL' },
  })
  recorder.record({
    totalTests: 99,
    totalPassed: 99,
    totalFailed: 0,
    totalPending: 0,
    totalSkipped: 0,
  })
  assert.deepEqual(records, [
    {
      schema: 'service-admin.cypress-run-summary.v1',
      state: 'complete',
      totalTests: 1,
      totalPassed: 1,
      totalFailed: 0,
      totalPending: 0,
      totalSkipped: 0,
    },
  ])
  assert.equal(JSON.stringify(records).includes('PRIVATE_SENTINEL'), false)
})

test('does not observe another spec and tolerates unavailable results or a sink failure', () => {
  const records = []
  const inactive = createCypressRunSummaryRecorder({
    enabled: true,
    write: (line) => records.push(JSON.parse(line)),
  })
  inactive.setSpecPath('/private/cypress/e2e/secrets-broker/real-first-run.cy.js')
  assert.equal(inactive.record(null), null)
  assert.deepEqual(records, [])

  const active = createCypressRunSummaryRecorder({
    enabled: true,
    write: () => {
      throw new Error('sink failure')
    },
  })
  active.setSpecPath('/private/cypress/e2e/secrets-broker/real-lifecycle.cy.js')
  assert.doesNotThrow(() => active.record({ totalTests: 'PRIVATE_SENTINEL' }))
})

test('parses only fixed Cypress summaries and carries unavailable state into failure evidence', () => {
  assert.deepEqual(
    parseCypressRunSummaryDiagnostic(
      JSON.stringify({
        schema: 'service-admin.cypress-run-summary.v1',
        state: 'complete',
        totalTests: 1,
        totalPassed: 1,
        totalFailed: 0,
        totalPending: 0,
        totalSkipped: 0,
      })
    ),
    {
      state: 'complete',
      totalTests: 1,
      totalPassed: 1,
      totalFailed: 0,
      totalPending: 0,
      totalSkipped: 0,
    }
  )
  assert.equal(
    parseCypressRunSummaryDiagnostic(
      JSON.stringify({
        schema: 'service-admin.cypress-run-summary.v1',
        state: 'complete',
        totalTests: 1,
        totalPassed: 1,
        totalFailed: 0,
        totalPending: 0,
        totalSkipped: 0,
        error: 'PRIVATE_SENTINEL',
      })
    ),
    null
  )
  assert.deepEqual(
    buildQualificationFailureDiagnostic({
      failure: 'nonzero_exit',
      cypressRunSummary: { state: 'unavailable' },
      transportDiagnostic: {},
    }).cypressRunSummary,
    { state: 'unavailable' }
  )
})
