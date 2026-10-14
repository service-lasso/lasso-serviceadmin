// Prospective ownership regressions: real IO and explicitly labelled adapters.
// They never qualify a compiler, image or protected paused native fixture.
import assert from 'node:assert/strict'
import { ChildProcess } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  prepareReceiverEvidenceDirectory,
  receiverEvidenceDestinations,
} from '../scripts/source-admission-fixture-destinations.mjs'
import {
  observeOriginalClose,
  ownCopy,
} from '../scripts/source-admission-linux-owned-process.mjs'

// Prospective original IO with deliberately delayed callback delivery. The
// adapter is a source ordering test, never native compiler/image qualification.
test(
  'child exit flush retains multi-chunk original bytes through delayed partial writes',
  { timeout: 10000 },
  async () => {
    assert.equal(process.versions.node, '22.23.2')
    const parent = await mkdtemp(path.join(os.tmpdir(), 'sa-exit-flush-'))
    const output = path.join(parent, 'stdout.raw')
    const fd = fs.openSync(output, 'wx', 0o600)
    const owner = { failed: false }
    const facts = {}
    const processFacts = {}
    const pipeFacts = {}
    const child = new ChildProcess()
    const originalProcess = observeOriginalClose(child._handle, processFacts)
    let exit = null
    child.on('error', () => {
      owner.failed = true
    })
    child.on('exit', (code, signal) => {
      exit = { code, signal }
    })
    const script =
      'const fs=require("node:fs");for(let i=0;i<32;i++)fs.writeSync(1,Buffer.alloc(4096,i))'
    child.spawn({
      file: process.execPath,
      args: [process.execPath, '-e', script],
      envPairs: [],
      stdio: ['ignore', 'pipe', 'ignore'],
      detached: false,
    })
    const originalPipe = observeOriginalClose(child.stdout._handle, pipeFacts)
    let writes = 0
    const copy = ownCopy(
      child.stdout,
      fd,
      facts,
      owner,
      (originalFD, bytes, offset, length, position, done) => {
        writes++
        fs.write(
          originalFD,
          bytes,
          offset,
          Math.min(length, 4096),
          position,
          (error, count) => setTimeout(() => done(error, count), 40)
        )
      }
    )
    while (!(
      exit &&
      processFacts.nativeCallback &&
      pipeFacts.nativeCallback &&
      copy.snapshot().terminal
    )) {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    const observed = copy.snapshot()
    assert.deepEqual(exit, { code: 0, signal: null })
    assert.equal(owner.failed, false)
    assert.equal(observed.eof, true)
    assert.equal(observed.writePending, false)
    assert.equal(observed.retainedChunks, 0)
    assert.ok(observed.observedChunks > 1)
    assert.ok(observed.deferredResumes > 0)
    assert.ok(writes > observed.observedChunks)
    const expected = Buffer.concat(
      Array.from({ length: 32 }, (_, i) => Buffer.alloc(4096, i))
    )
    assert.equal(observed.observedBytes, expected.length)
    assert.equal(observed.bytes, expected.length)
    assert.equal(
      observed.sha256,
      crypto.createHash('sha256').update(expected).digest('hex')
    )
    fs.fsyncSync(fd)
    fs.closeSync(fd)
    assert.deepEqual(await readFile(output), expected)
    assert.ok(originalProcess && originalPipe)
    // Keep original output. This is not the protected paused native fixture PASS.
  }
)

test(
  'real destination failure retains original buffers without inventing EOF',
  { timeout: 10000 },
  async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'sa-write-error-'))
    const input = path.join(parent, 'input.raw')
    const bytes = Buffer.from([0, 160, 255, 10])
    await writeFile(input, bytes, { flag: 'wx' })
    const readOnly = fs.openSync(input, 'r')
    const reader = fs.createReadStream(input, { highWaterMark: 2 })
    const owner = { failed: false }
    const copy = ownCopy(reader, readOnly, {}, owner)
    while (!copy.snapshot().terminal)
      await new Promise((resolve) => setTimeout(resolve, 5))
    assert.equal(owner.failed, true)
    assert.equal(copy.snapshot().failed, true)
    assert.equal(copy.snapshot().eof, false)
    assert.equal(copy.snapshot().writePending, false)
    assert.equal(copy.snapshot().bytes, 0)
    assert.ok(copy.retained.length > 0)
    assert.deepEqual(copy.retained[0], bytes.subarray(0, 2))
    fs.closeSync(readOnly)
    assert.deepEqual(await readFile(input), bytes)
  }
)

test(
  'real original read failure remains failed terminal evidence',
  { timeout: 10000 },
  async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'sa-read-error-'))
    const output = path.join(parent, 'stdout.raw')
    const fd = fs.openSync(output, 'wx', 0o600)
    const reader = fs.createReadStream(path.join(parent, 'absent-original'))
    const owner = { failed: false }
    const copy = ownCopy(reader, fd, {}, owner)
    while (!copy.snapshot().terminal)
      await new Promise((resolve) => setTimeout(resolve, 5))
    assert.equal(owner.failed, true)
    assert.equal(copy.snapshot().failed, true)
    assert.equal(copy.snapshot().end, false)
    assert.equal(copy.snapshot().eof, false)
    assert.equal(copy.snapshot().writePending, false)
    assert.equal(copy.snapshot().retainedChunks, 0)
    fs.closeSync(fd)
    assert.equal((await readFile(output)).length, 0)
  }
)

// Prospective real filesystem ownership, not native receiver acceptance.
test('distinct receiver destinations retain first output', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'sa-destinations-'))
  const destinations = {
    source: path.join(parent, 'source-original'),
    extracted: path.join(parent, 'extracted-original'),
  }
  const source = await prepareReceiverEvidenceDirectory(destinations, 'source')
  const original = Buffer.from([0, 160, 255, 10])
  const raw = path.join(source, 'receiver.stdout.raw')
  await writeFile(raw, original, { flag: 'wx' })
  const extracted = await prepareReceiverEvidenceDirectory(
    destinations,
    'extracted'
  )
  assert.notEqual(source, extracted)
  assert.deepEqual(await readFile(raw), original)
  await assert.rejects(
    prepareReceiverEvidenceDirectory(destinations, 'source'),
    /FIXTURE_RECEIVER_DESTINATION/
  )
  await assert.rejects(
    prepareReceiverEvidenceDirectory(destinations, 'extracted'),
    /FIXTURE_RECEIVER_DESTINATION/
  )
  assert.deepEqual(await readFile(raw), original)
  const aliased = { source, extracted: source }
  const nested = {
    source,
    extracted: path.join(source, 'nested'),
  }
  assert.throws(() => receiverEvidenceDestinations(aliased))
  assert.throws(() => receiverEvidenceDestinations(nested))
  // Preserve both fresh original outputs; never delete/reuse them for another run.
})

test('original close observer preserves receiver, callback arguments and later retirement', () => {
  let callback
  let requests = 0
  const handle = {
    close(fn) {
      assert.equal(this, handle)
      requests++
      callback = fn
    },
  }
  const facts = {}
  observeOriginalClose(handle, facts)
  let originalCallback = 0
  handle.close(function (value) {
    assert.equal(this, handle)
    assert.equal(value, 7)
    originalCallback++
  })
  assert.equal(requests, 1)
  assert.equal(facts.returned, true)
  assert.equal(facts.nativeCallback, false)
  callback.call(handle, 7)
  assert.equal(facts.nativeCallback, true)
  assert.equal(originalCallback, 1)
  handle.close()
  assert.equal(requests, 1)
  assert.equal(facts.requestFailed, true)
})

test('callback failure remains failed observation rather than a fabricated clean retirement', () => {
  let callback
  const handle = {
    close(fn) {
      callback = fn
    },
  }
  const facts = {}
  observeOriginalClose(handle, facts)
  handle.close(() => {
    throw new Error('fixed regression failure')
  })
  callback.call(handle)
  assert.equal(facts.nativeCallback, true)
  assert.equal(facts.callbackFailed, true)
})

test('missing and wrong-receiver originals do not produce native callback evidence', () => {
  assert.throws(
    () => observeOriginalClose(null, {}),
    /FIXTURE_SENDER_LINUX_OWNERSHIP/
  )
  const facts = {}
  const handle = {
    close() {
      throw new Error('must not call')
    },
  }
  observeOriginalClose(handle, facts)
  handle.close.call({})
  assert.equal(facts.requestFailed, true)
  assert.equal(facts.requested, false)
  assert.equal(facts.nativeCallback, false)
})
