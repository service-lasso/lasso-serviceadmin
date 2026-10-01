import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildQualificationFailureDiagnostic,
  createCypressRunSummaryRecorder,
  createTrustedUnlockDiagnosticRecorder,
  parseCypressRunSummaryDiagnostic,
  parseTrustedUnlockDiagnosticLine,
} from './real-browser-qualification-progress.mjs'

test('records one closed causal diagnostic only for an actual Cypress failure', () => {
  const records = []
  const recorder = createTrustedUnlockDiagnosticRecorder({
    enabled: true,
    write: (line) => records.push(line.trim()),
  })
  recorder.setSpecPath('/private/cypress/e2e/secrets-broker/real-lifecycle.cy.js')
  const diagnostic = {
    schema: 'service-admin.trusted-unlock-diagnostic.v2',
    receipt: {
      schema: 'service-admin.trusted-unlock-receipt.v1',
      status: 'observed',
      present: true,
      verified: false,
      localRoot: false,
      loading: true,
      unavailable: false,
    },
    causal: {
      schema: 'service-admin.trusted-identity-causal.v2',
      sequence: 1,
      request: 'response_delivered',
      contract: 'parsed',
      query: 'settled',
      render: 'unlocked',
    },
  }
  assert.deepEqual(recorder.retain(diagnostic), diagnostic)
  assert.equal(recorder.retain(diagnostic), null)
  const result = { tests: [{ state: 'failed' }] }
  assert.deepEqual(recorder.record(result), diagnostic)
  assert.equal(recorder.record(result), null)
  assert.deepEqual(records.map(parseTrustedUnlockDiagnosticLine), [diagnostic])
  assert.deepEqual(
    buildQualificationFailureDiagnostic({
      failure: 'nonzero_exit',
      trustedUnlockDiagnostic: diagnostic,
    }).trustedUnlock,
    diagnostic
  )
  assert.equal(JSON.stringify(records).includes('original failure'), false)
  assert.equal(
    parseTrustedUnlockDiagnosticLine(
      JSON.stringify({ ...diagnostic, private: 'PRIVATE' })
    ),
    null
  )
  const successRecorder = createTrustedUnlockDiagnosticRecorder({ enabled: true })
  successRecorder.setSpecPath('/private/cypress/e2e/secrets-broker/real-lifecycle.cy.js')
  successRecorder.retain(diagnostic)
  assert.equal(successRecorder.record({ tests: [{ state: 'passed' }] }), null)
})

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

test('does not observe another spec and records one unavailable lifecycle summary for null or malformed results', () => {
  const records = []
  const inactive = createCypressRunSummaryRecorder({
    enabled: true,
    write: (line) => records.push(JSON.parse(line)),
  })
  inactive.setSpecPath('/private/cypress/e2e/secrets-broker/real-first-run.cy.js')
  assert.equal(inactive.record(null), null)
  assert.deepEqual(records, [])

  for (const result of [null, { totalTests: 'PRIVATE_SENTINEL' }]) {
    const lifecycleRecords = []
    const active = createCypressRunSummaryRecorder({
      enabled: true,
      write: (line) => lifecycleRecords.push(JSON.parse(line)),
    })
    active.setSpecPath('/private/cypress/e2e/secrets-broker/real-lifecycle.cy.js')
    assert.deepEqual(active.record(result), { state: 'unavailable' })
    active.record({
      totalTests: 1,
      totalPassed: 1,
      totalFailed: 0,
      totalPending: 0,
      totalSkipped: 0,
    })
    assert.deepEqual(lifecycleRecords, [
      { schema: 'service-admin.cypress-run-summary.v1', state: 'unavailable' },
    ])
    assert.equal(JSON.stringify(lifecycleRecords).includes('PRIVATE_SENTINEL'), false)
  }
})

test('tolerates Cypress run-summary sink failure', () => {
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
