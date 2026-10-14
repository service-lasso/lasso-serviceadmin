import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { closeSuccessfulCoreRunner, hasAcceptedDirectOwnerClosure } from './direct-owner-terminal-acceptance.mjs'

// RC-005 SOURCE_ONLY_UNRUN. Actual source bodies, controlled I/O boundaries;
// no provider, native receipt authority, verifier startup or acceptance claim.
const verifier = (await readFile(new URL('./verify-real-broker-browser.mjs', import.meta.url), 'utf8')).replace(/\r\n/g, '\n').replace(/^ {2}/gm, '')
const custody = (await readFile(new URL('./qualification-custody.mjs', import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
function slice(source, start, end) {
  const a = source.indexOf(start)
  const b = source.indexOf(end, a)
  assert.ok(a >= 0 && b > a)
  return source.slice(a, b)
}
const retention = slice(verifier, 'let runFailure\n', '// Parent channels are owned')
const output = slice(verifier, '// Parent channels are owned', '\ntry {\nconst runner = spawn(')
const publish = slice(verifier, 'function publishSafeChildOutput(', '\nfunction observedParentPid(')
const earlierFinally = slice(verifier, '  if (cypress?.exitCode === null)', '\n}\n\nconst sourceHashes')
const sink = slice(verifier, 'const closureVerified =', '\nfunction cypressEnvironment()')
const result = slice(verifier, 'const qualificationResult =', '\n} catch (error) {\n  // Own the final failure sink:')
const outerCatch = verifier.slice(verifier.indexOf('} catch (error) {\n  // Own the final failure sink:') + 2).trimEnd()
const writerBody = slice(custody, 'export async function writeQualificationCustody(', '\nexport async function finalizeAbsentQualificationCustody').replace('export ', '')
const diagnostic = { lastPhase: 'provider_validation_complete', cypressRunSummary: { state: 'complete', totalFailed: 1 }, failure: 'nonzero_exit' }
const owner = (role, exitCode) => ({ role, exitCode, birth: 'observed', parentPid: 100,
  close: 'observed', signal: null, error: null, sourceSha256: 'a'.repeat(64) })

function prepare({ controlled, primaryPresent = false, primary, mode = 'success', target = 'diagnostic', writer = writeFile, receiptPath = 'unused', expired = false, probeFailure, earlierDiagnostic = true }) {
  const records = []
  const callbacks = []
  let writes = 0
  let reads = 0
  const events = []
  const streams = {}
  for (const name of ['stdout', 'stderr']) {
    streams[name] = Object.assign(new EventEmitter(), { write(bytes, callback) {
      const text = String(bytes)
      records.push({ name, text })
      const isTarget = target.startsWith('publication') ? text === 'safe-cypress-output'
        : target === 'result' ? text.includes('real-secrets-browser')
          : target === 'final-diagnostic' ? text.includes('final-custody-write-failure')
            : text.includes('provider_validation_complete')
      if (!isTarget || mode === 'success') { callback(); return true }
      events.push('target-write')
      if (mode === 'throw') throw channelError
      if (mode === 'callback-error') { queueMicrotask(() => callback(channelError)); return true }
      if (mode === 'event-error') { queueMicrotask(() => this.emit('error', channelError)); return true }
      if (mode === 'close') { queueMicrotask(() => this.emit('close')); return true }
      callbacks.push(callback)
      return mode !== 'backpressure'
    } })
  }
  const channelError = new Proxy({}, { get() { throw new Error('private output error inspected') } })
  const coreOwner = owner('core_runner', 0)
  coreOwner.close = 'pending'
  const runner = Object.assign(new EventEmitter(), { exitCode: null, signalCode: null,
    stdout: { readableEnded: false }, stderr: { readableEnded: false },
    send(message) {
      assert.deepEqual(message, { type: 'service-lasso-real-admin-shutdown' })
      events.push('core-close')
      queueMicrotask(() => {
        this.exitCode = 0
        this.stdout.readableEnded = true
        this.stderr.readableEnded = true
        coreOwner.close = 'observed'
        this.emit('close', 0)
      })
    } })
  const sandbox = vm.createContext({ process: { pid: 100, env: {}, ...streams }, Buffer, URL, path,
    performance: expired ? { now: () => Infinity } : performance, setTimeout, clearTimeout,
    runner, coreRunnerOwner: coreOwner, closeSuccessfulCoreRunner, hasAcceptedDirectOwnerClosure,
    cypress: { exitCode: controlled ? 1 : 0 }, cypressExit: controlled ? 1 : 0,
    cypressOutput: { exceeded: false,
      stdout: target === 'publication-stderr' ? [] : [Buffer.from('safe-cypress-output')],
      stderr: target === 'publication-stderr' ? [Buffer.from('safe-cypress-output')] : [] },
    cypressOutputChecked: true, cypressSucceeded: !controlled, forbiddenAuditMaterial: [],
    runtimeInputs: {}, coreSource: {}, verifyNoLeakEvidence: async () => {}, stderrEvidence: '', stderrBytes: 0,
    qualificationFailureKind: earlierDiagnostic ? 'nonzero_exit' : undefined, ready: { adminUrl: 'http://127.0.0.1' },
    probeAdminReachability: async () => { events.push('probe'); if (probeFailure) throw primary; return 'reachable' },
    buildQualificationFailureDiagnostic: () => diagnostic, buildTransportDiagnostic: () => ({}),
    qualificationProgressEvents: [], cypressChildEvents: [], cypressRunSummaryEvents: [],
    providerUiConvergenceEvents: [], lockedWrapperUiEvents: [], trustedUnlockDiagnostics: [],
    rotationRehydrationEvents: [], rotationProxyLifecycleEvents: [],
    verifyClosureReceipt: async () => { reads += 1; events.push('private-receipt') },
    nestedClosureVerified: true, nestedOwners: [], custodyOwners: [coreOwner, owner('cypress', controlled ? 1 : 0)],
    trustedUnlockRealProviderControl: controlled, controlledProviderFaultVerified: controlled,
    finalQualificationFailureDiagnostic: undefined, sourceHashes: { brokerBinary: 'a'.repeat(64) },
    initialCustody: { schema: 'fixture', runtimePathHashes: [] }, initialCustodyHash: 'fixture', custodyReceiptPath: receiptPath,
    writeFile: async (...args) => { writes += 1; events.push('exclusive-writer'); assert.equal(args[2].flag, 'wx'); return writer(...args) },
    primary, qualificationMode: 'comprehensive', platform: 'linux', adminRoot: 'packaged-admin', auditEventCount: 0, rollbackProcessVerified: false,
  })
  vm.runInContext(`${retention}\n${output}\n${publish}\n${writerBody}\n${primaryPresent ? 'retainRunFailure(primary)' : ''}`, sandbox)
  return { sandbox, streams, records, callbacks, channelError, events, writes: () => writes, reads: () => reads,
    run: () => vm.runInContext(`(async () => { try { ${target.startsWith('publication') ? 'publishSafeChildOutput(cypressOutput)' : ''}\n${earlierFinally}\nawait settleParentOutput()\n${sink}\n${result}\n} ${outerCatch} })()`, sandbox),
    evidence: () => vm.runInContext('({ runFailure, runFailurePresent, parentOutputFailures, pending: parentOutputPending.size, finalCustodyWriteFailure, finalCustodyWriteFailurePresent, finalCustodyDiagnosticFailure, finalCustodyDiagnosticFailurePresent, parentOutputDeadline })', sandbox) }
}

for (const controlled of [false, true]) {
  for (const target of ['publication', 'publication-stderr', 'diagnostic', 'result']) {
    for (const mode of ['throw', 'callback-error', 'event-error', 'close']) {
      test(`actual full output/caller/writer owns ${target}/${mode}, controlled=${controlled}`, async () => {
        for (const primary of [new Error('first'), Object.freeze(new Error('frozen first')), undefined, null, false, 0,
          new Proxy({}, { get() { throw new Error('primary getter inspected') } })]) {
          // Result output is reached only without an earlier failure; all other
          // channels exercise first-present identity through actual finally.
          const primaryPresent = target !== 'result'
          let saved
          const fixture = prepare({ controlled, primaryPresent, primary, target, mode,
            writer: async (_file, bytes) => { saved = JSON.parse(bytes) } })
          await fixture.run()
          const evidence = fixture.evidence()
          assert.equal(fixture.writes(), 1)
          assert.equal(fixture.reads(), 1)
          assert.ok(fixture.events.indexOf('core-close') < fixture.events.indexOf('exclusive-writer'))
          assert.equal(evidence.runFailurePresent, true)
          if (primaryPresent) assert.equal(evidence.runFailure, primary)
          if (mode !== 'close') assert.ok(evidence.parentOutputFailures.includes(fixture.channelError))
          assert.equal(fixture.sandbox.process.exitCode, 1)
          if (target !== 'result') assert.equal(saved.outcome, controlled ? 'controlled_failure_unverified' : 'positive_unverified')
          // A prior successful file/result prefix is provisional on later
          // channel failure, never a genuine exit-zero/EOF acceptance receipt.
          assert.ok(fixture.streams.stderr.listenerCount('error') > 0)
          assert.ok(fixture.streams.stdout.listenerCount('error') > 0)
          fixture.streams.stderr.emit('error', null)
          assert.equal(fixture.evidence().runFailure, evidence.runFailure)
          assert.equal(fixture.sandbox.process.exitCode, 1)
        }
      })
    }
  }
  test(`actual final-writer diagnostic owns every channel failure without raw reporting, controlled=${controlled}`, async () => {
    for (const mode of ['throw', 'callback-error', 'event-error', 'close', 'pending']) {
      for (const primary of [new Error('primary'), Object.freeze(new Error('frozen')), undefined, null]) {
        const sinkError = new Proxy({}, { get() { throw new Error('private sink inspected') } })
        const fixture = prepare({ controlled, target: 'final-diagnostic', mode, earlierDiagnostic: false,
          expired: mode === 'pending', primaryPresent: true, primary, writer: async () => { throw sinkError } })
        await fixture.run()
        assert.equal(fixture.writes(), 1)
        assert.equal(fixture.reads(), 1)
        assert.equal(fixture.evidence().runFailure, primary)
        assert.equal(fixture.evidence().runFailurePresent, true)
        assert.equal(fixture.evidence().finalCustodyWriteFailure, sinkError)
        assert.equal(fixture.sandbox.process.exitCode, 1)
        if (['throw', 'callback-error', 'event-error'].includes(mode)) {
          assert.equal(fixture.evidence().finalCustodyDiagnosticFailure, fixture.channelError)
        }
        for (const { text } of fixture.records) {
          const parsed = JSON.parse(text)
          assert.equal(parsed.state, 'unverified')
          assert.deepEqual(Object.keys(parsed).sort(), ['schema', 'state'])
        }
      }
    }
  })
  test(`actual earlier probe rejection preserves nullish primary and safe close/custody, controlled=${controlled}`, async () => {
    for (const primary of [undefined, null, new Error('probe')]) {
      const fixture = prepare({ controlled, primary, probeFailure: true, writer: async () => {} })
      await fixture.run()
      assert.equal(fixture.evidence().runFailurePresent, true)
      assert.equal(fixture.evidence().runFailure, primary)
      assert.equal(fixture.writes(), 1)
      assert.equal(fixture.reads(), 1)
    }
  })
  test(`pending actual writes spend only original remaining clock and retain listeners, controlled=${controlled}`, async () => {
    for (const target of ['publication', 'publication-stderr', 'diagnostic', 'result']) {
      const primary = Object.freeze(new Error('first'))
      const fixture = prepare({ controlled, target, mode: 'pending', expired: true,
        primaryPresent: target !== 'result', primary, writer: async () => {} })
      await fixture.run()
      assert.equal(fixture.writes(), 1)
      assert.equal(fixture.reads(), 1)
      assert.ok(fixture.evidence().pending > 0)
      assert.equal(fixture.sandbox.process.exitCode, 1)
      const original = fixture.evidence().runFailure
      fixture.callbacks.forEach((callback) => callback())
      fixture.streams.stdout.emit('error', fixture.channelError)
      assert.equal(fixture.evidence().runFailure, original)
      assert.ok(fixture.evidence().parentOutputFailures.includes(fixture.channelError))
      assert.ok(fixture.streams.stdout.listenerCount('error') > 0)
    }
  })
  test(`actual callback and drain are both required; drain alone cannot qualify, controlled=${controlled}`, async () => {
    for (const drainFirst of [false, true]) {
      const fixture = prepare({ controlled, mode: 'backpressure', writer: async () => {} })
      let completed = false
      const pending = fixture.run().then(() => { completed = true })
      while (fixture.callbacks.length === 0) await new Promise(setImmediate)
      if (drainFirst) fixture.streams.stderr.emit('drain')
      else fixture.callbacks[0]()
      await new Promise(setImmediate)
      assert.equal(completed, false)
      assert.equal(fixture.writes(), 0)
      if (drainFirst) fixture.callbacks[0]()
      else fixture.streams.stderr.emit('drain')
      await pending
      assert.equal(fixture.evidence().runFailurePresent, false)
      assert.equal(fixture.evidence().pending, 0)
      assert.equal(fixture.writes(), 1)
    }
  })
  test(`entire earlier finally and actual exclusive writer preserve partial/EEXIST, controlled=${controlled}`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'admin-output-lifetime-'))
    try {
      const receiptPath = path.join(directory, 'closed.json')
      const primary = Object.freeze(new Error('first'))
      const sinkError = new Proxy({}, { get() { throw new Error('sink inspected') } })
      const partial = Buffer.from('{"partial":')
      const fixture = prepare({ controlled, primaryPresent: true, primary, mode: 'event-error', receiptPath,
        writer: async (file, _bytes, options) => { await writeFile(file, partial, options); throw sinkError } })
      await fixture.run()
      assert.equal(fixture.evidence().runFailure, primary)
      assert.equal(fixture.evidence().finalCustodyWriteFailure, sinkError)
      assert.deepEqual(await readFile(receiptPath), partial)
      assert.equal(fixture.writes(), 1)
      const existing = prepare({ controlled, receiptPath })
      await existing.run()
      assert.equal(existing.evidence().finalCustodyWriteFailure.code, 'EEXIST')
      assert.deepEqual(await readFile(receiptPath), partial)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  test(`actual all-output completion permits unchanged result API, controlled=${controlled}`, async () => {
    let receipt
    const fixture = prepare({ controlled, writer: async (_file, bytes) => { receipt = JSON.parse(bytes) } })
    await fixture.run()
    assert.equal(fixture.evidence().runFailurePresent, false)
    assert.equal(fixture.evidence().parentOutputFailures.length, 0)
    assert.equal(fixture.evidence().pending, 0)
    assert.equal(receipt.outcome, controlled ? 'controlled_failure_observed' : 'positive_verified')
    const publicResult = JSON.parse(fixture.records.find(({ text }) => text.includes('real-secrets-browser')).text)
    assert.equal(publicResult.outcome, controlled ? 'controlled_failure_observed' : 'verified')
    assert.equal(fixture.sandbox.process.exitCode, undefined)
  })
}
