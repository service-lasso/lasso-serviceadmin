// Prospective ownership regressions only; native callbacks below are test doubles.
// They never qualify an actual process, pipe, compiler, image or socket.
import test from 'node:test'
import assert from 'node:assert/strict'
import { observeOriginalClose } from '../scripts/source-admission-linux-owned-process.mjs'

test('original close observer preserves receiver, callback arguments and later retirement', () => {
  let callback
  let requests = 0
  const handle = { close(fn) { assert.equal(this, handle); requests++; callback = fn } }
  const facts = {}
  observeOriginalClose(handle, facts)
  let originalCallback = 0
  handle.close(function (value) { assert.equal(this, handle); assert.equal(value, 7); originalCallback++ })
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
  const handle = { close(fn) { callback = fn } }
  const facts = {}
  observeOriginalClose(handle, facts)
  handle.close(() => { throw new Error('fixed regression failure') })
  callback.call(handle)
  assert.equal(facts.nativeCallback, true)
  assert.equal(facts.callbackFailed, true)
})

test('missing and wrong-receiver originals do not produce native callback evidence', () => {
  assert.throws(() => observeOriginalClose(null, {}), /FIXTURE_SENDER_LINUX_OWNERSHIP/)
  const facts = {}
  const handle = { close() { throw new Error('must not call') } }
  observeOriginalClose(handle, facts)
  handle.close.call({})
  assert.equal(facts.requestFailed, true)
  assert.equal(facts.requested, false)
  assert.equal(facts.nativeCallback, false)
})
