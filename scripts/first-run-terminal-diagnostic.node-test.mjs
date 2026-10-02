import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  captureFirstRunChild,
  createFirstRunTerminalDiagnostic,
  firstRunTerminalDiagnosticSchema,
  parseSafeRunnerDiagnostic,
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
