import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { writeSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  captureFirstRunChild,
  createPrivateFirstRunJournal,
  createFirstRunTerminalDiagnostic,
  firstRunTerminalDiagnosticSchema,
  parseSafeRunnerDiagnostic,
  privateCaptureLimits,
} from './first-run-terminal-diagnostic.mjs'

const candidate = Object.freeze({
  wrapperSha256: 'a'.repeat(64),
  verifierSha256: 'b'.repeat(64),
  harnessSha256: 'd'.repeat(64),
})
const run = 'c'.repeat(64)
const coreCandidate = Object.freeze({
  head: 'e'.repeat(40),
  tree: 'f'.repeat(40),
  run: 'c'.repeat(64),
})

function capture(script) {
  return captureFirstRunChild({
    spawnChild: spawn,
    command: process.execPath,
    // Keep the controlled child alive long enough for the mandatory native
    // birth observation; the production wrapper never adds a sleep or retry.
    args: ['-e', `setTimeout(() => { ${script} }, 3000)`],
    options: { stdio: ['ignore', 'pipe', 'pipe'] },
    platform: process.platform,
    run,
    candidate,
    coreCandidate,
  })
}

function stream() { return new EventEmitter() }
function controlledChild() { const child = new EventEmitter(); child.pid = 42; child.stdout = stream(); child.stderr = stream(); return child }
function journal() { const events = []; return { root: 'private-root', events, stdout: (bytes) => { events.push(['stdout', Buffer.from(bytes)]); return true }, stderr: (bytes) => { events.push(['stderr', Buffer.from(bytes)]); return true }, record: (value) => { events.push(['record', value]); return true }, close: (value) => { events.push(['close', value]); return '1'.repeat(64) }, fault: () => null } }
const tick = () => new Promise((resolve) => setImmediate(resolve))

test('projects a successful owned first child only after close and both EOFs', async () => {
  const result = await capture("process.stdout.write('ready\\n'); process.exit(0)")
  assert.equal(result.diagnostic.schema, firstRunTerminalDiagnosticSchema)
  assert.equal(result.diagnostic.mode, 'first_run')
  assert.equal(result.diagnostic.stage, 'terminal')
  assert.equal(result.diagnostic.state, 'closed')
  assert.equal(result.diagnostic.platform, process.platform)
  assert.equal(result.diagnostic.run, run)
  assert.deepEqual(result.diagnostic.candidate, candidate)
  assert.deepEqual(result.diagnostic.coreCandidate, coreCandidate)
  assert.equal(result.diagnostic.exitCode, 0)
  assert.equal(result.diagnostic.signal, null)
  assert.equal(result.diagnostic.naturalClose, true)
  assert.equal(result.diagnostic.stdoutEof, true)
  assert.equal(result.diagnostic.stderrEof, true)
  assert.equal(result.diagnostic.safeDiagnosticCode, 'unclassified')
  assert.deepEqual(result.diagnostic.privateCloseJournal.state, 'retained')
  assert.match(result.diagnostic.privateCloseJournal.sha256, /^[a-f0-9]{64}$/)
  assert.equal(await readFile(join(result.privateJournalRoot, 'stdout.bin'), 'utf8'), 'ready\n')
  assert.equal(
    (await readFile(join(result.privateJournalRoot, 'custody.json'), 'utf8')).includes('"event":"terminal"'),
    true
  )
  assert.equal(result.exitCode, 0)
  assert.equal(JSON.stringify(result.diagnostic).includes('ready'), false)
  for (const forbidden of ['path', 'pid', 'command', 'env', 'receipt']) {
    assert.equal(JSON.stringify(result.diagnostic).toLowerCase().includes(forbidden), false)
  }
})

test('retains early setup failure privately and projects only a bounded code', async () => {
  const result = await capture(
    "process.stderr.write(JSON.stringify({schema:'service-lasso.real-admin-browser-failure.v1',code:'runner_start_failed'})+'\\nprivate vault-token\\n'); process.exit(1)"
  )
  assert.equal(result.exitCode, 1)
  assert.equal(result.diagnostic.safeDiagnosticCode, 'runner_start_failed')
  assert.equal(JSON.stringify(result.diagnostic).includes('vault-token'), false)
})

test('fails before readiness without inventing a readiness result', async () => {
  const result = await capture('process.exit(1)')
  assert.equal(result.exitCode, 1)
  assert.equal(result.diagnostic.exitCode, 1)
  assert.equal(result.diagnostic.safeDiagnosticCode, 'unclassified')
  assert.equal(Object.hasOwn(result.diagnostic, 'ready'), false)
})

test('classifies a failed child birth as unresolved without inventing terminal facts', async () => {
  const result = await captureFirstRunChild({
    spawnChild() {
      throw new Error('private launch detail')
    },
    command: process.execPath,
    args: [],
    options: {},
    platform: process.platform,
    run,
    candidate,
    coreCandidate,
  })
  assert.equal(result.exitCode, 1)
  assert.equal(result.diagnostic.state, 'unresolved')
  assert.equal(result.diagnostic.exitCode, null)
  assert.equal(result.diagnostic.naturalClose, false)
  assert.equal(JSON.stringify(result.diagnostic).includes('private launch detail'), false)
})

test('waits for delayed stream delivery through owner close', async () => {
  const result = await capture(
    "setTimeout(() => { process.stderr.write('late private stream\\n'); process.exit(1) }, 20)"
  )
  assert.equal(result.exitCode, 1)
  assert.equal(result.diagnostic.naturalClose, true)
  assert.equal(result.diagnostic.stdoutEof, true)
  assert.equal(result.diagnostic.stderrEof, true)
  assert.equal(JSON.stringify(result.diagnostic).includes('late private stream'), false)
})

test('classifier accepts only an allowlisted non-secret diagnostic code', () => {
  assert.equal(
    parseSafeRunnerDiagnostic(
      JSON.stringify({
        schema: 'service-lasso.real-admin-browser-failure.v1',
        code: 'qualification_failed',
      })
    ),
    'qualification_failed'
  )
  assert.equal(
    parseSafeRunnerDiagnostic(
      JSON.stringify({
        schema: 'service-lasso.real-admin-browser-failure.v1',
        code: 'vault-token',
      })
    ),
    null
  )
})

test('rejects an invalid public projection instead of accepting private fields', () => {
  assert.throws(() =>
    createFirstRunTerminalDiagnostic({
      stage: 'terminal',
      platform: process.platform,
      run,
      candidate: { ...candidate, path: 'private-path' },
      coreCandidate,
      privateCloseJournal: { state: 'retained', sha256: '0'.repeat(64) },
      exitCode: 1,
      signal: null,
      naturalClose: true,
      stdoutEof: true,
      stderrEof: true,
      safeDiagnosticCode: 'unclassified',
    })
  )
})

test('keeps a spawned child observed after native birth failure until it closes and both pipes EOF', async () => {
  const child = controlledChild(); const held = journal()
  const pending = captureFirstRunChild({ spawnChild: () => child, command: 'private-command', args: [], options: {}, platform: process.platform, run, candidate, coreCandidate, journalFactory: () => held, birthObserver: () => { throw new Error('birth read failed') } })
  await tick(); assert.equal(held.events.some(([kind]) => kind === 'close'), false)
  child.emit('close', 1, null); child.stdout.emit('end'); child.stderr.emit('end')
  const result = await pending
  assert.equal(result.diagnostic.state, 'unresolved'); assert.equal(result.diagnostic.safeDiagnosticCode, 'runner_start_failed'); assert.equal(held.events.filter(([kind]) => kind === 'close').length, 1)
})

test('does not substitute child error for close or delayed stdout EOF', async () => {
  const child = controlledChild(); const held = journal()
  const pending = captureFirstRunChild({ spawnChild: () => child, command: 'private-command', args: [], options: {}, platform: process.platform, run, candidate, coreCandidate, journalFactory: () => held, birthObserver: () => ({ held: true }) })
  child.emit('error', new Error('private child error')); child.stderr.emit('end'); await tick(); assert.equal(held.events.some(([kind]) => kind === 'close'), false)
  child.emit('close', 1, null); await tick(); assert.equal(held.events.some(([kind]) => kind === 'close'), false); child.stdout.emit('end')
  const result = await pending
  assert.equal(result.diagnostic.state, 'unresolved'); assert.equal(result.diagnostic.stdoutEof, true); assert.equal(result.diagnostic.stderrEof, true)
})

test('projects missing and errored streams as failed, never as clean EOF', async () => {
  const child = controlledChild(); child.stderr = null; const held = journal()
  const pending = captureFirstRunChild({ spawnChild: () => child, command: 'private-command', args: [], options: {}, platform: process.platform, run, candidate, coreCandidate, journalFactory: () => held, birthObserver: () => ({ held: true }) })
  child.stdout.emit('error', new Error('stream failed')); child.emit('close', 1, null)
  const result = await pending
  assert.equal(result.diagnostic.state, 'unresolved'); assert.equal(result.diagnostic.stdoutEof, false); assert.equal(result.diagnostic.stderrEof, false)
})

test('drains oversized no-newline output without retaining beyond the private quotas', async () => {
  const child = controlledChild(); const held = journal(); const limits = { rawBytesPerStream: 8, pendingTextBytes: 4 }
  const pending = captureFirstRunChild({ spawnChild: () => child, command: 'private-command', args: [], options: {}, platform: process.platform, run, candidate, coreCandidate, journalFactory: () => held, birthObserver: () => ({ held: true }), limits })
  child.stdout.emit('data', Buffer.from('0123456789-no-newline')); child.stdout.emit('data', Buffer.alloc(32, 120)); child.stderr.emit('end'); child.stdout.emit('end'); child.emit('close', 0, null)
  const result = await pending
  assert.equal(Buffer.concat(held.events.filter(([kind]) => kind === 'stdout').map(([, bytes]) => bytes)).length, 8); assert.equal(result.diagnostic.state, 'unresolved'); assert.equal(held.events.some(([, value]) => value?.event === 'capture_bound_overflow'), true); assert.deepEqual(Object.keys(privateCaptureLimits).sort(), ['journalBytes', 'pendingTextBytes', 'rawBytesPerStream'])
})

test('loops partial private writes and makes writer faults unavailable rather than synthetic commitments', () => {
  let calls = 0
  const partial = createPrivateFirstRunJournal('private-command', [], {}, { writeSync(fd, bytes, offset, length) { calls += 1; return writeSync(fd, bytes, offset, Math.min(length, 1)) } })
  partial.record({ event: 'partial-write' }); assert.match(partial.close({ event: 'terminal' }), /^[a-f0-9]{64}$/); assert.ok(calls > 2)
  assert.throws(() => createPrivateFirstRunJournal('private-command', [], {}, { writeSync() { throw new Error('disk fault') } }))
})

test('keeps spawn throws, signals, and private values out of the public terminal projection', async () => {
  const held = journal()
  const spawnFailure = await captureFirstRunChild({ spawnChild: () => { throw new Error('secret spawn detail') }, command: 'private-command', args: ['secret'], options: {}, platform: process.platform, run, candidate, coreCandidate, journalFactory: () => held })
  assert.equal(spawnFailure.diagnostic.privateCloseJournal.state, 'retained'); assert.equal(JSON.stringify(spawnFailure.diagnostic).includes('secret'), false)
  const child = controlledChild(); const signalPending = captureFirstRunChild({ spawnChild: () => child, command: 'private-command', args: [], options: {}, platform: process.platform, run, candidate, coreCandidate, journalFactory: journal, birthObserver: () => ({ held: true }) })
  child.stdout.emit('end'); child.stderr.emit('end'); child.emit('close', null, 'SIGTERM')
  const signalled = await signalPending
  assert.equal(signalled.diagnostic.signal, 'SIGTERM'); assert.equal(signalled.diagnostic.state, 'unresolved')
})
