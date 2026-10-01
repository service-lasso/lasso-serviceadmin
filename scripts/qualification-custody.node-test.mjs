import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  initializeQualificationCustody,
  finalizeAbsentQualificationCustody,
  readQualificationCustody,
  requiredRuntimePaths,
} from './qualification-custody.mjs'

test('initializes one hash-only custody receipt for three distinct owned paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'service-admin-custody-'))
  try {
    const external = path.join(root, 'external')
    const workspace = path.join(external, 'workspace')
    const registries = path.join(external, 'registries')
    const environment = {
      SERVICE_LASSO_WORKSPACE_ROOT: workspace,
      SERVICE_LASSO_QUALIFICATION_EXTERNAL_ROOT: external,
      SERVICE_LASSO_TEST_REGISTRIES_ROOT: registries,
      SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(
        registries,
        'instances.json'
      ),
      SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(
        registries,
        'host-ports.json'
      ),
      SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH: path.join(
        root,
        'closed-receipt.json'
      ),
      SERVICE_LASSO_QUALIFICATION_CUSTODY_INITIAL_RECEIPT_PATH: path.join(
        root,
        'initial-receipt.json'
      ),
    }
    const receipt = await initializeQualificationCustody({ environment })
    assert.equal(receipt.state, 'initialized')
    assert.equal(receipt.runtimePathHashes.length, 4)
    assert.deepEqual(
      await readQualificationCustody(
        environment.SERVICE_LASSO_QUALIFICATION_CUSTODY_INITIAL_RECEIPT_PATH
      ),
      receipt
    )
    const serialized = await readFile(
      environment.SERVICE_LASSO_QUALIFICATION_CUSTODY_INITIAL_RECEIPT_PATH,
      'utf8'
    )
    assert.equal(serialized.includes(root), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('finalizes an absent custody closure from the held initial receipt only once', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'service-admin-custody-finalize-'))
  try {
    const environment = {
      SERVICE_LASSO_WORKSPACE_ROOT: path.join(root, 'external', 'workspace'),
      SERVICE_LASSO_QUALIFICATION_EXTERNAL_ROOT: path.join(root, 'external'),
      SERVICE_LASSO_TEST_REGISTRIES_ROOT: path.join(root, 'external', 'registries'),
      SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(root, 'external', 'registries', 'instances.json'),
      SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(root, 'external', 'registries', 'host-ports.json'),
      SERVICE_LASSO_QUALIFICATION_CUSTODY_INITIAL_RECEIPT_PATH: path.join(root, 'initial.json'),
      SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH: path.join(root, 'closed.json'),
    }
    await initializeQualificationCustody({ environment })
    assert.equal(await finalizeAbsentQualificationCustody({ initialReceiptPath: environment.SERVICE_LASSO_QUALIFICATION_CUSTODY_INITIAL_RECEIPT_PATH, receiptPath: environment.SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH }), true)
    assert.equal(await finalizeAbsentQualificationCustody({ initialReceiptPath: environment.SERVICE_LASSO_QUALIFICATION_CUSTODY_INITIAL_RECEIPT_PATH, receiptPath: environment.SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH }), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects duplicate or unowned runtime registry paths', () => {
  const root = path.resolve(os.tmpdir(), 'service-admin-custody-invalid')
  assert.throws(
    () =>
      requiredRuntimePaths({
        SERVICE_LASSO_WORKSPACE_ROOT: root,
        SERVICE_LASSO_QUALIFICATION_EXTERNAL_ROOT: path.dirname(root),
        SERVICE_LASSO_TEST_REGISTRIES_ROOT: path.join(root, 'registries'),
        SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(root, 'registries', 'one.json'),
        SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(root, 'registries', 'one.json'),
      }),
    /unique/
  )
  assert.throws(
    () =>
      requiredRuntimePaths({
        SERVICE_LASSO_WORKSPACE_ROOT: root,
        SERVICE_LASSO_QUALIFICATION_EXTERNAL_ROOT: path.dirname(root),
        SERVICE_LASSO_TEST_REGISTRIES_ROOT: path.join(root, 'registries'),
        SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(root, 'registries', 'one.json'),
        SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(
          os.tmpdir(),
          'outside.json'
        ),
      }),
    /separate registries root/
  )
})

test('refuses reused, linked, or nonliteral external qualification paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'service-admin-custody-layout-'))
  try {
    const external = path.join(root, 'external')
    const environment = {
      SERVICE_LASSO_QUALIFICATION_EXTERNAL_ROOT: external,
      SERVICE_LASSO_WORKSPACE_ROOT: path.join(external, 'workspace'),
      SERVICE_LASSO_TEST_REGISTRIES_ROOT: path.join(external, 'registries'),
      SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(external, 'registries', 'instances.json'),
      SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(external, 'registries', 'host-ports.json'),
      SERVICE_LASSO_QUALIFICATION_CUSTODY_INITIAL_RECEIPT_PATH: path.join(root, 'initial.json'),
      SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH: path.join(root, 'closed.json'),
    }
    await initializeQualificationCustody({ environment })
    await assert.rejects(() => initializeQualificationCustody({ environment }), /absent/)
    await assert.rejects(
      () => initializeQualificationCustody({
        environment: { ...environment, SERVICE_LASSO_QUALIFICATION_EXTERNAL_ROOT: path.join(root, 'other') },
      }),
      /literal external/
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
