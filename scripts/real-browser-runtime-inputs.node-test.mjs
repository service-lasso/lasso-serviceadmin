import assert from 'node:assert/strict'
import test from 'node:test'

import {
  brokerAuditPath,
  noLeakEvidenceRoots,
  parseRuntimeInputs,
  rollbackProcessEvidencePath,
} from './real-browser-runtime-inputs.mjs'

test('explicit runtime inputs keep workspace, services, evidence, and support custody distinct', () => {
  const inputs = parseRuntimeInputs({
    runtimeInputs: {
      workspaceRoot: 'C:/qualification/workspace',
      servicesRoot: 'C:/qualification/services',
      evidenceRoot: 'C:/qualification/evidence',
      supportRoot: 'C:/qualification/support',
    },
  })
  assert.equal(brokerAuditPath(inputs), 'C:\\qualification\\workspace\\.service-lasso\\secretsbroker\\audit.jsonl')
  assert.equal(rollbackProcessEvidencePath(inputs), 'C:\\qualification\\services\\sample-service\\.state\\browser-broker-evidence.json')
  assert.deepEqual(
    noLeakEvidenceRoots(inputs, 'comprehensive').map(({ directory }) => directory),
    [
      'C:\\qualification\\services\\sample-service\\logs',
      'C:\\qualification\\workspace\\.service-lasso\\secret-rotations',
    ]
  )
  assert.deepEqual(noLeakEvidenceRoots(inputs, 'first-run'), [])
})

test('runtime input contract rejects a temp-root substitute and incomplete roots', () => {
  assert.throws(
    () => parseRuntimeInputs({ tempRoot: 'C:/qualification' }),
    /explicit runtime inputs/
  )
  assert.throws(
    () =>
      parseRuntimeInputs({
        runtimeInputs: { workspaceRoot: 'C:/qualification/workspace' },
      }),
    /incomplete runtime input contract/
  )
})
