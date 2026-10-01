import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  brokerAuditPath,
  noLeakEvidenceRoots,
  parseExpectedRuntimeInputs,
  parseRuntimeInputs,
  rollbackProcessEvidencePath,
  validateExpectedRuntimeFilesystem,
} from './real-browser-runtime-inputs.mjs'

function environment(overrides = {}) {
  return {
    SERVICE_LASSO_WORKSPACE_ROOT: 'C:/qualification/workspace',
    SERVICE_LASSO_TEST_SERVICES_ROOT: 'C:/qualification/services',
    SERVICE_LASSO_TEST_EVIDENCE_ROOT: 'C:/qualification/evidence',
    SERVICE_LASSO_TEST_SUPPORT_ROOT: 'C:/qualification/support',
    SERVICE_LASSO_TEST_REGISTRIES_ROOT: 'C:/qualification/registries',
    SERVICE_LASSO_INSTANCE_REGISTRY_PATH: 'C:/qualification/registries/instances.json',
    SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: 'C:/qualification/registries/host-ports.json',
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
    registriesRoot: 'C:\\qualification\\registries',
    instanceRegistryPath: 'C:\\qualification\\registries\\instances.json',
    hostPortRegistryPath: 'C:\\qualification\\registries\\host-ports.json',
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
        environment({ SERVICE_LASSO_WORKSPACE_ROOT: 'qualification/workspace' })
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
    const registries = path.join(root, 'registries')
    await Promise.all([workspace, services, evidence, support, registries].map((directory) => mkdir(directory)))
    const inputs = await validateExpectedRuntimeFilesystem({
      SERVICE_LASSO_WORKSPACE_ROOT: workspace,
      SERVICE_LASSO_TEST_SERVICES_ROOT: services,
      SERVICE_LASSO_TEST_EVIDENCE_ROOT: evidence,
      SERVICE_LASSO_TEST_SUPPORT_ROOT: support,
      SERVICE_LASSO_TEST_REGISTRIES_ROOT: registries,
      SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(registries, 'instances.json'),
      SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(registries, 'host-ports.json'),
    })
    assert.equal(inputs.workspaceRoot, workspace)
    assert.equal(inputs.servicesRoot, services)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('caller-owned registry inputs reject present files and linked ancestors', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'runtime-inputs-negative-'))
  try {
    const roots = ['workspace', 'services', 'evidence', 'support', 'registries']
    await Promise.all(roots.map((name) => mkdir(path.join(root, name))))
    const values = {
      SERVICE_LASSO_WORKSPACE_ROOT: path.join(root, 'workspace'),
      SERVICE_LASSO_TEST_SERVICES_ROOT: path.join(root, 'services'),
      SERVICE_LASSO_TEST_EVIDENCE_ROOT: path.join(root, 'evidence'),
      SERVICE_LASSO_TEST_SUPPORT_ROOT: path.join(root, 'support'),
      SERVICE_LASSO_TEST_REGISTRIES_ROOT: path.join(root, 'registries'),
      SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(root, 'registries', 'instances.json'),
      SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(root, 'registries', 'host-ports.json'),
    }
    await writeFile(values.SERVICE_LASSO_INSTANCE_REGISTRY_PATH, '{}')
    await assert.rejects(() => validateExpectedRuntimeFilesystem(values), /must be absent/)
    await rm(values.SERVICE_LASSO_INSTANCE_REGISTRY_PATH)
    await symlink(path.join(root, 'services'), path.join(root, 'registries', 'linked'), 'junction')
    values.SERVICE_LASSO_INSTANCE_REGISTRY_PATH = path.join(root, 'registries', 'linked', 'instances.json')
    await assert.rejects(() => validateExpectedRuntimeFilesystem(values), /direct absent file/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('runtime consumes fixed private receipt names and rejects public path aliases', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'runtime-private-receipts-'))
  try {
    const workspace = path.join(root, 'workspace')
    const services = path.join(root, 'services')
    const evidence = path.join(root, 'evidence')
    const support = path.join(root, 'support')
    const registries = path.join(root, 'registries')
    await Promise.all([workspace, services, evidence, support, registries].map((directory) => mkdir(directory)))
    const environment = {
      SERVICE_LASSO_WORKSPACE_ROOT: workspace,
      SERVICE_LASSO_TEST_SERVICES_ROOT: services,
      SERVICE_LASSO_TEST_EVIDENCE_ROOT: evidence,
      SERVICE_LASSO_TEST_SUPPORT_ROOT: support,
      SERVICE_LASSO_TEST_REGISTRIES_ROOT: registries,
      SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(registries, 'instances.json'),
      SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(registries, 'host-ports.json'),
    }
    const source = { head: 'a'.repeat(40), tree: 'b'.repeat(40) }
    const nonce = 'c'.repeat(64)
    const base = { private: true, nonce, source, runtimeInputs: { workspaceRoot: workspace, servicesRoot: services } }
    await writeFile(path.join(evidence, 'live-prelaunch-receipt.json'), JSON.stringify({ ...base, schema: 'service-lasso.real-admin-browser-live-prelaunch.v1', runner: { pid: 1, parentPid: 2, birth: 'observed', nativeIdentity: { size: 1, sha256: `sha256:${'d'.repeat(64)}` } }, assets: [] }))
    await writeFile(path.join(evidence, 'live-initial-receipt.json'), JSON.stringify({ ...base, schema: 'service-lasso.real-admin-browser-live-initial.v1', inputs: { workspaceRoot: workspace, instanceRegistryPath: environment.SERVICE_LASSO_INSTANCE_REGISTRY_PATH, hostPortRegistryPath: environment.SERVICE_LASSO_HOST_PORT_REGISTRY_PATH, servicesRoot: services, evidenceRoot: evidence, supportRoot: support } }))
    await writeFile(path.join(evidence, 'live-ready-receipt.json'), JSON.stringify({ ...base, schema: 'service-lasso.real-admin-browser-live-initial.v1', ownerCorrelation: { state: 'observed' }, ownedProcesses: { runner: { pid: 1 }, admin: { pid: 2, parentPid: 1 } } }))
    const ready = { liveReceipt: { schema: 'service-lasso.real-admin-browser-live-initial.v1', nonce } }
    assert.equal((await parseRuntimeInputs(ready, { environment, source })).workspaceRoot, workspace)
    await assert.rejects(() => parseRuntimeInputs({ liveReceipt: { ...ready.liveReceipt, initialPath: path.join(evidence, 'live-initial-receipt.json') } }, { environment, source }), /incomplete public live receipt/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
