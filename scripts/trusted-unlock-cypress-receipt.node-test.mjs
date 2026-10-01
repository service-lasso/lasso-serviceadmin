import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildQualificationFailureDiagnostic,
  parseTrustedUnlockDiagnosticLine,
} from './real-browser-qualification-progress.mjs'

test('closed parser and final sink remain a surrogate contract guard', () => {
  const receipt = {
    schema: 'service-admin.trusted-unlock-diagnostic.v2',
    receipt: {
      schema: 'service-admin.trusted-unlock-receipt.v1',
      status: 'observed',
      present: true,
      verified: false,
      localRoot: false,
      loading: false,
      unavailable: true,
    },
    causal: {
      schema: 'service-admin.trusted-identity-causal.v2',
      sequence: 1,
      request: 'transport_failed',
      contract: 'unobserved',
      query: 'failed',
      render: 'unavailable',
    },
  }
  const parsed = parseTrustedUnlockDiagnosticLine(JSON.stringify(receipt))
  assert.deepEqual(parsed, receipt)
  assert.deepEqual(
    buildQualificationFailureDiagnostic({
      failure: 'nonzero_exit',
      trustedUnlockDiagnostic: parsed,
    }).trustedUnlock,
    receipt
  )
})
