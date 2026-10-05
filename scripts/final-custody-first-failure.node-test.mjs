import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { closeSuccessfulCoreRunner, hasAcceptedDirectOwnerClosure } from './direct-owner-terminal-acceptance.mjs'

// RC-005 SOURCE_ONLY_UNRUN. These actual source slices do not run the provider,
// Cypress or verifier startup and cannot supply qualification/native authority.
const verifier = (await readFile(new URL('./verify-real-broker-browser.mjs', import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const custody = (await readFile(new URL('./qualification-custody.mjs', import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
function slice(source, start, end) {
  const a = source.indexOf(start)
  const b = source.indexOf(end, a)
  assert.ok(a >= 0 && b > a)
  return source.slice(a, b)
}
const actualRetention = slice(verifier, 'let runFailure\n', 'let auditEventCount')
const actualCaller = slice(verifier, '  try {\n    await closeSuccessfulCoreRunner(runner, coreRunnerOwner)', '\n}\n\nconst sourceHashes')
const actualFinalSink = slice(verifier, 'const closureVerified =', '\nfunction cypressEnvironment()')
const actualWriter = slice(custody, 'export async function writeQualificationCustody(', '\nexport async function finalizeAbsentQualificationCustody').replace('export ', '')
const owner = (role, exitCode = 0) => ({ role, exitCode, birth: 'observed', parentPid: 100,
  close: 'observed', signal: null, error: null, sourceSha256: 'a'.repeat(64) })
const diagnostic = { lastPhase: 'provider_validation_complete', cypressRunSummary: { state: 'complete', totalFailed: 1 }, failure: 'nonzero_exit' }
function prepare({ controlled, receiptPath, writer = writeFile, primaryPresent = false, primary, coreExit = 0, diagnosticError }) {
  const coreOwner = owner('core_runner', coreExit)
  const runner = Object.assign(new EventEmitter(), { exitCode: coreExit, signalCode: null,
    stdout: { readableEnded: true }, stderr: { readableEnded: true },
    send() { throw new Error('already exited child must not receive shutdown') } })
  let reads = 0
  const records = []
  const sandbox = vm.createContext({ runner, coreRunnerOwner: coreOwner,
    closeSuccessfulCoreRunner, hasAcceptedDirectOwnerClosure, primary,
    runtimeInputs: {}, coreSource: {}, verifyClosureReceipt: async () => { reads += 1 },
    cypressOutput: { exceeded: false }, nestedClosureVerified: true, nestedOwners: [],
    custodyOwners: [coreOwner, owner('cypress', controlled ? 1 : 0)],
    process: { pid: 100, stderr: Object.assign(new EventEmitter(), {
      write(record) { if (diagnosticError) throw diagnosticError; records.push(record) },
    }) },
    trustedUnlockRealProviderControl: controlled, controlledProviderFaultVerified: controlled,
    finalQualificationFailureDiagnostic: controlled ? diagnostic : undefined,
    cypressExit: controlled ? 1 : 0, cypressSucceeded: !controlled,
    custodyReceiptPath: receiptPath, initialCustody: { schema: 'fixture', runtimePathHashes: [] },
    initialCustodyHash: 'fixture', sourceHashes: {}, writeFile: writer,
  })
  vm.runInContext(`${actualRetention}\n${actualWriter}\n${primaryPresent ? 'retainRunFailure(primary)' : ''}`, sandbox)
  return { sandbox, records, reads: () => reads,
    run: () => vm.runInContext(`(async () => { ${actualCaller}\n${actualFinalSink} })()`, sandbox),
    evidence: () => vm.runInContext('({ runFailure, runFailurePresent, finalCustodyWriteFailure, finalCustodyWriteFailurePresent, finalCustodyDiagnosticFailure, finalCustodyDiagnosticFailurePresent })', sandbox) }
}
async function thrown(promise) {
  try { await promise; return { present: false } } catch (value) { return { present: true, value } }
}
for (const controlled of [false, true]) {
  test(`actual final writer retains all first thrown values and secondary errors, controlled=${controlled}`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'admin-final-sink-'))
    try {
      for (const code of ['EIO', 'EACCES', 'ENOSPC']) {
        for (const primary of [Object.freeze(new Error('original provider failure')), undefined, null, false, 0, 'original']) {
          const sinkError = Object.assign(new Error('private path and sink details'), { code })
          let writes = 0
          const fixture = prepare({ controlled, receiptPath: path.join(root, 'absent.json'), primaryPresent: true, primary,
            writer: async (_file, _bytes, options) => { writes += 1; assert.equal(options.flag, 'wx'); throw sinkError } })
          const result = await thrown(fixture.run())
          assert.equal(result.present, true)
          assert.equal(result.value, primary)
          assert.equal(writes, 1)
          assert.equal(fixture.reads(), 1)
          const evidence = fixture.evidence()
          assert.equal(evidence.finalCustodyWriteFailurePresent, true)
          assert.equal(evidence.finalCustodyWriteFailure, sinkError)
          assert.equal(evidence.runFailure, primary)
          assert.deepEqual(fixture.records.map(JSON.parse), [{ schema: 'service-lasso.final-custody-write-failure.v1', state: 'unverified' }])
        }
      }
      // Arbitrary thrown objects must never be inspected, even for an error code.
      const hostile = new Proxy({}, { get() { throw new Error('error getter inspected') } })
      const primary = new Error('first')
      const fixture = prepare({ controlled, primaryPresent: true, primary, receiptPath: path.join(root, 'hostile.json'), writer: async () => { throw hostile } })
      assert.equal((await thrown(fixture.run())).value, primary)
      assert.equal(fixture.evidence().finalCustodyWriteFailure, hostile)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  test(`actual caller Core error stays primary after final writer error, controlled=${controlled}`, async () => {
    const sinkError = new Error('sink')
    const fixture = prepare({ controlled, coreExit: 1, receiptPath: 'unused', writer: async () => { throw sinkError } })
    const result = await thrown(fixture.run())
    assert.equal(result.present, true)
    assert.match(result.value.message, /successful captured terminal closure/)
    assert.equal(result.value, fixture.evidence().runFailure)
    assert.equal(fixture.evidence().finalCustodyWriteFailure, sinkError)
  })
  test(`actual writer failure becomes first without prior failure, controlled=${controlled}`, async () => {
    for (const sinkError of [new Error('sink first'), undefined, null]) {
      const fixture = prepare({ controlled, receiptPath: 'unused', writer: async () => { throw sinkError } })
      const result = await thrown(fixture.run())
      assert.equal(result.present, true)
      assert.equal(result.value, sinkError)
      assert.equal(fixture.evidence().runFailurePresent, true)
    }
  })
  test(`actual writer preserves partial and existing bytes, controlled=${controlled}`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'admin-partial-sink-'))
    try {
      const receiptPath = path.join(root, 'closed.json')
      const primary = new Error('first provider failure')
      const sinkError = Object.assign(new Error('partial sink'), { code: 'EIO' })
      let writes = 0
      const partial = Buffer.from('{"partial":')
      const fixture = prepare({ controlled, receiptPath, primaryPresent: true, primary,
        writer: async (file, _bytes, options) => { writes += 1; await writeFile(file, partial, options); throw sinkError } })
      assert.equal((await thrown(fixture.run())).value, primary)
      assert.deepEqual(await readFile(receiptPath), partial)
      assert.equal(writes, 1)
      const existing = prepare({ controlled, receiptPath })
      const failure = await thrown(existing.run())
      assert.equal(failure.present, true)
      assert.equal(failure.value.code, 'EEXIST')
      assert.deepEqual(await readFile(receiptPath), partial)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  test(`actual final writer stays pending and cannot resolve success, controlled=${controlled}`, async () => {
    let rejectWrite
    let entered
    const started = new Promise((resolve) => { entered = resolve })
    const sinkError = new Error('pending sink rejection')
    const fixture = prepare({ controlled, receiptPath: 'unused', writer: () => {
      entered(); return new Promise((_resolve, reject) => { rejectWrite = reject })
    } })
    let settled = false
    const completion = thrown(fixture.run()).then((result) => { settled = true; return result })
    await started
    await new Promise(setImmediate)
    assert.equal(settled, false)
    rejectWrite(sinkError)
    assert.equal((await completion).value, sinkError)
  })
  test(`diagnostic-channel failure never masks primary, controlled=${controlled}`, async () => {
    const primary = new Error('first')
    const sinkError = new Error('sink')
    const diagnosticError = new Error('captured stderr unavailable')
    const fixture = prepare({ controlled, primaryPresent: true, primary, diagnosticError,
      receiptPath: 'unused', writer: async () => { throw sinkError } })
    assert.equal((await thrown(fixture.run())).value, primary)
    assert.equal(fixture.evidence().finalCustodyDiagnosticFailure, diagnosticError)
    assert.equal(fixture.evidence().finalCustodyWriteFailure, sinkError)
    assert.equal(fixture.records.length, 0)
    assert.equal(fixture.evidence().finalCustodyDiagnosticFailurePresent, true)
    const asyncFixture = prepare({ controlled, primaryPresent: true, primary,
      receiptPath: 'unused', writer: async () => { throw sinkError } })
    assert.equal((await thrown(asyncFixture.run())).value, primary)
    asyncFixture.sandbox.process.stderr.emit('error', diagnosticError)
    assert.equal(asyncFixture.evidence().finalCustodyDiagnosticFailure, diagnosticError)
    assert.equal(asyncFixture.evidence().runFailure, primary)
  })
  test(`actual exclusive writer success preserves verified mode and rejects prior nullish failure, controlled=${controlled}`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'admin-final-success-'))
    try {
      for (const primaryPresent of [false, true]) {
        const receiptPath = path.join(root, `${primaryPresent}.json`)
        const fixture = prepare({ controlled, receiptPath, primaryPresent, primary: undefined })
        const result = await thrown(fixture.run())
        assert.equal(result.present, primaryPresent)
        const receipt = JSON.parse(await readFile(receiptPath, 'utf8'))
        assert.equal(receipt.outcome, controlled
          ? primaryPresent ? 'controlled_failure_unverified' : 'controlled_failure_observed'
          : primaryPresent ? 'positive_unverified' : 'positive_verified')
      }
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}
