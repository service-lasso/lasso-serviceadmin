import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  initializeQualificationCustody,
  readQualificationCustody,
  requiredRuntimePaths,
} from './qualification-custody.mjs'

test('initializes one hash-only custody receipt for three distinct owned paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'service-admin-custody-'))
  try {
    const workspace = path.join(root, 'workspace')
    const environment = {
      SERVICE_LASSO_WORKSPACE_ROOT: workspace,
      SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(
        workspace,
        '.service-lasso',
        'instances.json'
      ),
      SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(
        workspace,
        '.service-lasso',
        'host-ports.json'
      ),
      SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH: path.join(
        root,
        'receipt.json'
      ),
    }
    const receipt = await initializeQualificationCustody({ environment })
    assert.equal(receipt.state, 'initialized')
    assert.equal(receipt.runtimePathHashes.length, 3)
    assert.deepEqual(
      await readQualificationCustody(
        environment.SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH
      ),
      receipt
    )
    const serialized = await readFile(
      environment.SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH,
      'utf8'
    )
    assert.equal(serialized.includes(root), false)
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
        SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(root, 'one.json'),
        SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(root, 'one.json'),
      }),
    /unique/
  )
  assert.throws(
    () =>
      requiredRuntimePaths({
        SERVICE_LASSO_WORKSPACE_ROOT: root,
        SERVICE_LASSO_INSTANCE_REGISTRY_PATH: path.join(root, 'one.json'),
        SERVICE_LASSO_HOST_PORT_REGISTRY_PATH: path.join(
          os.tmpdir(),
          'outside.json'
        ),
      }),
    /owned by its workspace/
  )
})
