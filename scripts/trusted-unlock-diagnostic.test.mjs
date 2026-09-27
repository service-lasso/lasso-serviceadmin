import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'vitest'
import { createTrustedUnlockObservation, observeTrustedUnlockFailure } from './trusted-unlock-diagnostic.mjs'

test('failure retains the original error, closes its observer and excludes private fields', () => {
  const emitter = new EventEmitter()
  const observation = createTrustedUnlockObservation()
  observation.begin()
  const token = observation.started()
  observation.responded(token, 503)
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
  assert.doesNotMatch(JSON.stringify(metadata), /PRIVATE/)
  assert.equal(emitter.listenerCount('fail'), 0)
  assert.equal(observation.isActive(), false)
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
