import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { absoluteOwnedPath, readHeldJsonFile, readHeldRegularFile } from './held-receipt-reader.mjs'

test('held reader accepts only a bounded regular file beneath its exact owner root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'held-receipt-'))
  try {
    const evidence = path.join(root, 'evidence')
    await mkdir(evidence)
    await writeFile(path.join(evidence, 'receipt.json'), '{"state":"ready"}')
    const { bytes, value } = await readHeldJsonFile({ root: evidence, literalPath: 'receipt.json', label: 'Private receipt', maxBytes: 128 })
    assert.equal(bytes.toString('utf8'), '{"state":"ready"}')
    assert.equal(value.state, 'ready')
    assert.equal(absoluteOwnedPath(evidence, 'receipt.json', 'Private receipt'), path.join(evidence, 'receipt.json'))
    assert.throws(() => absoluteOwnedPath(evidence, '../replacement.json', 'Private receipt'), /outside/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('held reader rejects linked, replaced, oversized, and malformed receipts without disclosing file contents', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'held-receipt-negative-'))
  try {
    const evidence = path.join(root, 'evidence')
    const outside = path.join(root, 'outside')
    await Promise.all([mkdir(evidence), mkdir(outside)])
    await writeFile(path.join(outside, 'receipt.json'), '{"secret":"not surfaced"}')
    await symlink(path.join(outside, 'receipt.json'), path.join(evidence, 'receipt.json'), 'file')
    await assert.rejects(
      () => readHeldRegularFile({ root: evidence, literalPath: 'receipt.json', label: 'Private receipt', maxBytes: 128 }),
      /held descriptor/
    )
    await rm(path.join(evidence, 'receipt.json'))
    await writeFile(path.join(evidence, 'receipt.json'), 'x'.repeat(129))
    await assert.rejects(
      () => readHeldRegularFile({ root: evidence, literalPath: 'receipt.json', label: 'Private receipt', maxBytes: 128 }),
      /held descriptor/
    )
    await rename(path.join(evidence, 'receipt.json'), path.join(evidence, 'replaced.json'))
    await writeFile(path.join(evidence, 'receipt.json'), '{')
    await assert.rejects(
      () => readHeldJsonFile({ root: evidence, literalPath: 'receipt.json', label: 'Private receipt', maxBytes: 128 }),
      /valid bounded JSON/
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
