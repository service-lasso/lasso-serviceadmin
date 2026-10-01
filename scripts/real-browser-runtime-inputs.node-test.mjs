import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  brokerAuditPath,
  noLeakEvidenceRoots,
  parseExpectedRuntimeInputs,
  rollbackProcessEvidencePath,
  validateExpectedRuntimeFilesystem,
} from './real-browser-runtime-inputs.mjs'

function environment(overrides = {}) {
  return {
    SERVICE_LASSO_TEST_WORKSPACE_ROOT: 'C:/qualification/workspace',
    SERVICE_LASSO_TEST_SERVICES_ROOT: 'C:/qualification/services',
    SERVICE_LASSO_TEST_EVIDENCE_ROOT: 'C:/qualification/evidence',
    SERVICE_LASSO_TEST_SUPPORT_ROOT: 'C:/qualification/support',
    SERVICE_LASSO_INSTANCE_REGISTRY_PATH: 'C:/qualification/workspace/.service-lasso/instances.json',
    SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: 'C:/qualification/workspace/.service-lasso/host-ports.json',
    ...overrides,
  }
}

test('caller-owned runtime inputs keep workspace, services, evidence, and support custody distinct', () => {
  const inputs = parseExpectedRuntimeInputs(environment())
  assert.deepEqual(inputs, {
    workspaceRoot: 'C:\\qualification\\workspace',
    servicesRoot: 'C:\\qualification\\services',
    evidenceRoot: 'C:\\qualification\\evidence',
    supportRoot: 'C:\\qualification\\support',
    instanceRegistryPath: 'C:\\qualification\\workspace\\.service-lasso\\instances.json',
    hostPortRegistryPath: 'C:\\qualification\\workspace\\.service-lasso\\host-ports.json',
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

test('caller-owned runtime inputs reject relative paths', () => {
  assert.throws(
    () =>
      parseExpectedRuntimeInputs(
        environment({ SERVICE_LASSO_TEST_WORKSPACE_ROOT: 'qualification/workspace' })
      ),
    /absolute path/
  )
})

test('caller-owned runtime inputs reject equal and nested roots', () => {
  assert.throws(
    () =>
      parseExpectedRuntimeInputs(
        environment({ SERVICE_LASSO_TEST_SERVICES_ROOT: 'C:/qualification/workspace' })
      ),
    /distinct and non-overlapping/
  )
  assert.throws(
    () =>
      parseExpectedRuntimeInputs(
        environment({ SERVICE_LASSO_TEST_EVIDENCE_ROOT: 'C:/qualification/workspace/evidence' })
      ),
    /distinct and non-overlapping/
  )
})

test('caller-owned runtime inputs require direct real roots and absent registry files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'runtime-inputs-'))
  try {
    const workspace = path.join(root, 'workspace')
    const services = path.join(root, 'services')
    const evidence = path.join(root, 'evidence')
    const support = path.join(root, 'support')
    await Promise.all([workspace, services, evidence, support].map((directory) => mkdir(directory)))
    await mkdir(path.join(workspace, '.service-lasso'))
    const inputs = await validateExpectedRuntimeFilesystem({
      SERVICE_LASSO_TEST_WORKSPACE_ROOT: workspace,
      SERVICE_LASSO_TEST_SERVICES_ROOT: services,
      SERVICE_LASSO_TEST_EVIDENCE_ROOT: evidence,
      SERVICE_LASSO_TEST_SUPPORT_ROOT: support,
      SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(workspace, '.service-lasso', 'instances.json'),
      SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(workspace, '.service-lasso', 'host-ports.json'),
    })
    assert.equal(inputs.workspaceRoot, workspace)
    assert.equal(inputs.servicesRoot, services)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
