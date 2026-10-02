import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'vitest'
import {
  createTrustedUnlockObservation,
  createTrustedIdentityCausalReceipt,
  createTrustedUnlockDiagnostic,
  parseTrustedUnlockDiagnostic,
  createTrustedUnlockReceipt,
  observeTrustedUnlockFailure,
} from './trusted-unlock-diagnostic.mjs'

test('closed receipt uses own primitive fields and preserves the original failure', () => {
  const inherited = Object.create({ verified: true })
  Object.assign(inherited, {
    localRoot: false,
    loading: true,
    unavailable: false,
  })
  Object.defineProperty(inherited, 'verified', {
    enumerable: true,
    get: () => true,
  })
  assert.deepEqual(createTrustedUnlockReceipt(inherited), {
    schema: 'service-admin.trusted-unlock-receipt.v1',
    status: 'observed',
    present: true,
    verified: false,
    localRoot: false,
    loading: true,
    unavailable: false,
  })

  const emitter = new EventEmitter()
  const observation = createTrustedUnlockObservation()
  observation.begin()
  let retained = null
  observeTrustedUnlockFailure(
    emitter,
    observation,
    () => ({}),
    () => inherited,
    (receipt) => { retained = receipt }
  )
  const original = new Error('original assertion')
  assert.throws(() => emitter.emit('fail', original), (error) => error === original)
  assert.deepEqual(retained, createTrustedUnlockReceipt(inherited))
  assert.equal(JSON.stringify(retained).includes('PRIVATE'), false)
  assert.equal(emitter.listenerCount('fail'), 0)
})

test('causal receipt retains only fixed phase categories', () => {
  const receipt = createTrustedIdentityCausalReceipt({
    sequence: 1,
    request: 'response_delivered',
    contract: 'parsed',
    query: 'settled',
    render: 'loading',
    private: 'PRIVATE',
  })
  assert.deepEqual(receipt, {
    schema: 'service-admin.trusted-identity-causal.v2',
    sequence: 1,
    request: 'response_delivered',
    contract: 'parsed',
    query: 'settled',
    render: 'loading',
  })
  assert.equal(createTrustedIdentityCausalReceipt({ sequence: 1, request: 'PRIVATE' }), null)
})

test('closed receipt rejects hostile and zero-state input', () => {
  const zero = createTrustedUnlockReceipt({})
  assert.deepEqual(zero, {
    schema: 'service-admin.trusted-unlock-receipt.v1',
    status: 'observed',
    present: false,
    verified: false,
    localRoot: false,
    loading: false,
    unavailable: false,
  })
  assert.equal(zero.present, false)
  assert.equal(createTrustedUnlockReceipt({ private: 'PRIVATE' }).present, false)
})

test('failure retains the original error, closes its observer and excludes private fields', () => {
  const emitter = new EventEmitter()
  const observation = createTrustedUnlockObservation()
  observation.begin()
  const token = observation.started()
  observation.responded(token, 503)
  observation.causalSnapshot({
    sequence: 1,
    request: 'response_delivered',
    contract: 'parsed',
    query: 'settled',
    render: 'loading',
  })
  observeTrustedUnlockFailure(emitter, observation, () => ({
    verifiedMarkerPresent: false, unavailableMarkerPresent: true, private: 'PRIVATE',
    get localRootButtonPresent() { throw new Error('PRIVATE') },
  }))
  const error = new Error('original assertion')
  assert.throws(() => emitter.emit('fail', error), (actual) => actual === error)
  assert.match(error.message, /^original assertion\n/)
  const metadata = JSON.parse(error.message.split('\n')[1])
  assert.equal(metadata.phase, 'marker_discovery')
  assert.equal(metadata.httpStatus, 503)
  assert.equal(metadata.unavailableMarkerPresent, true)
  assert.equal(metadata.localRootButtonPresent, null)
  assert.deepEqual(metadata.causal, {
    schema: 'service-admin.trusted-identity-causal.v2',
    sequence: 1,
    request: 'response_delivered',
    contract: 'parsed',
    query: 'settled',
    render: 'loading',
  })
  assert.doesNotMatch(JSON.stringify(metadata), /PRIVATE/)
  assert.equal(emitter.listenerCount('fail'), 0)
  assert.equal(observation.isActive(), false)
})

test('causal diagnostic accepts only the versioned exact-key envelope', () => {
  const receipt = createTrustedUnlockReceipt({ loading: true })
  const causal = createTrustedIdentityCausalReceipt({
    sequence: 1,
    request: 'response_delivered',
    contract: 'parsed',
    query: 'settled',
    render: 'unlocked',
  })
  const diagnostic = createTrustedUnlockDiagnostic(receipt, causal)
  assert.deepEqual(parseTrustedUnlockDiagnostic(diagnostic), diagnostic)
  assert.equal(parseTrustedUnlockDiagnostic({ ...diagnostic, private: 'PRIVATE' }), null)
  assert.equal(
    parseTrustedUnlockDiagnostic({
      ...diagnostic,
      causal: { ...causal, query: 'PRIVATE' },
    }),
    null
  )
  assert.equal(
    parseTrustedUnlockDiagnostic({
      ...diagnostic,
      causal: { ...causal, duplicate: true },
    }),
    null
  )
  assert.deepEqual(
    parseTrustedUnlockDiagnostic(JSON.parse(JSON.stringify(diagnostic))),
    diagnostic
  )
})

test('successful cleanup cannot annotate an unrelated failure or accept late responses', () => {
  const emitter = new EventEmitter()
  const observation = createTrustedUnlockObservation()
  observation.begin()
  const token = observation.started()
  const complete = observeTrustedUnlockFailure(emitter, observation, () => { throw new Error('must not run') })
  complete()
  observation.responded(token, 200)
  const error = new Error('unrelated')
  assert.equal(emitter.emit('fail', error), false)
  assert.equal(error.message, 'unrelated')
  assert.equal(observation.snapshot({}).requestState, 'pending')
})

test('verified-marker failures distinguish pending, superseded and absent request observations', () => {
  const observation = createTrustedUnlockObservation()
  assert.equal(observation.snapshot({}).requestState, 'unobserved')
  observation.begin()
  const stale = observation.started()
  const current = observation.started()
  observation.responded(stale, 200)
  assert.equal(observation.snapshot({}).requestState, 'pending')
  observation.responded(current, 999)
  observation.verifying()
  assert.equal(observation.snapshot({}).phase, 'verified_marker')
  assert.equal(observation.snapshot({}).httpStatus, null)
})

test('hostile observation cannot replace a frozen original failure', () => {
  const emitter = new EventEmitter()
  const observation = createTrustedUnlockObservation()
  observation.begin()
  observeTrustedUnlockFailure(emitter, observation, () => { throw new Error('PRIVATE') })
  const error = Object.freeze(new Error('original'))
  assert.throws(() => emitter.emit('fail', error), (actual) => actual === error)
  assert.equal(error.message, 'original')
  assert.equal(emitter.listenerCount('fail'), 0)
})
