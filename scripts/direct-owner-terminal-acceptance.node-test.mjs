import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { closeSuccessfulCoreRunner, hasAcceptedDirectOwnerClosure } from './direct-owner-terminal-acceptance.mjs'

// RC-004 SOURCE_ONLY_UNRUN until entire paired review and complete admission.
const verifier = (await readFile(new URL('./verify-real-broker-browser.mjs', import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const owner = (role, exitCode = 0) => ({ role, exitCode, birth: 'observed',
  parentPid: 100, close: 'observed', signal: null, error: null, sourceSha256: 'a'.repeat(64) })
const diagnostic = { lastPhase: 'provider_validation_complete',
  cypressRunSummary: { state: 'complete', totalFailed: 1 }, failure: 'nonzero_exit' }
const context = { parentPid: 100, cypressExit: 0, controlledNegative: false }
function child(exitCode = 0, signalCode = null) {
  return Object.assign(new EventEmitter(), { exitCode, signalCode,
    stdout: { readableEnded: true }, stderr: { readableEnded: true },
    send() { throw new Error('already exited child must not receive shutdown') } })
}
const start = verifier.indexOf('  try {\n    await closeSuccessfulCoreRunner(runner, coreRunnerOwner)')
const end = verifier.indexOf('\n}\n\nconst sourceHashes', start)
assert.ok(start >= 0 && end > start)
const actualCaller = verifier.slice(start, end)
async function caller(runner, coreRunnerOwner, primary) {
  let receiptReads = 0
  const sandbox = vm.createContext({ runner, coreRunnerOwner, closeSuccessfulCoreRunner,
    runFailure: primary, runtimeInputs: {}, coreSource: {},
    verifyClosureReceipt: async () => { receiptReads += 1 } })
  await vm.runInContext(`(async () => { ${actualCaller} })()`, sandbox)
  return { failure: sandbox.runFailure, receiptReads }
}
for (const [label, runner, retained] of [
  ['closed original plus copy retirement failure', child(1), owner('core_runner', 1)],
  ['unknown exit', child(NaN), owner('core_runner', null)],
  ['signal', child(null, 'SIGTERM'), { ...owner('core_runner', null), signal: 'SIGTERM' }],
  ['close error with exit zero', child(0), { ...owner('core_runner'), error: new Error('close error') }],
  ['copy retirement pending without observed close', child(0), { ...owner('core_runner'), close: 'pending' }],
]) {
  test(`actual caller rejects ${label} despite genuine original receipt`, async () => {
    const result = await caller(runner, retained)
    assert.match(result.failure.message, /successful captured terminal closure/)
    assert.equal(result.receiptReads, 1)
    const prior = new Error('original primary failure')
    assert.equal((await caller(runner, retained, prior)).failure, prior)
    assert.equal(hasAcceptedDirectOwnerClosure([retained, owner('cypress')], context), false)
  })
}
test('actual caller accepts Core zero and genuine captured close', async () => {
  assert.equal((await caller(child(), owner('core_runner'))).failure, undefined)
  assert.equal(hasAcceptedDirectOwnerClosure([owner('core_runner'), owner('cypress')], context), true)
})
test('controlled Cypress nonzero is accepted only in its exact verified case', () => {
  const controlled = { ...context, controlledNegative: true, cypressExit: 1,
    controlledProviderFaultVerified: true, failureDiagnostic: diagnostic }
  const owners = [owner('core_runner'), owner('cypress', 1)]
  assert.equal(hasAcceptedDirectOwnerClosure(owners, controlled), true)
  for (const change of [{ cypressExit: 2 }, { controlledProviderFaultVerified: false },
    { failureDiagnostic: undefined }, { controlledNegative: false }]) {
    assert.equal(hasAcceptedDirectOwnerClosure(owners, { ...controlled, ...change }), false)
  }
  assert.equal(hasAcceptedDirectOwnerClosure([owner('core_runner', 1), owner('cypress', 1)], controlled), false)
  assert.equal(hasAcceptedDirectOwnerClosure([owner('cypress', 1), owner('cypress', 1)], controlled), false)
})
test('actual verifier connects role acceptance to final custody, preserving gates', () => {
  assert.match(verifier, /const closureVerified =\s*runFailure === undefined &&\s*cypressOutput\?\.exceeded !== true &&\s*nestedClosureVerified &&\s*hasAcceptedDirectOwnerClosure/)
  assert.match(verifier, /child\.on\('error', \(error\) => \{ owner\.error \?\?= error \}\)/)
  assert.match(verifier, /controlledProviderFaultVerified &&\s*closureVerified/)
})
