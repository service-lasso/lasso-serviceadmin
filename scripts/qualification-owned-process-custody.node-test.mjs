import assert from 'node:assert/strict'
import test from 'node:test'

import {
  hasClosedOwnedProcessCustody,
  parseOwnedProcessCustody,
} from './qualification-owned-process-custody.mjs'

const broker = 'a'.repeat(64)
const admin = 'b'.repeat(64)
const node = 'c'.repeat(64)
const expected = {
  broker_binary: { sourceSha256: broker, executableSha256: broker },
  admin_runtime: { sourceSha256: admin, executableSha256: node },
}

function record(role, event, { pid, parentPid, ownerNonce, sourceSha256, executableSha256 }) {
  const base = { role, event, pid, parentPid, ownerNonce, sourceSha256, executableSha256 }
  return event === 'birth' ? base : { ...base, exitCode: 0, signal: null }
}

function validRecords() {
  return [
    record('broker_binary', 'birth', {
      pid: 101,
      parentPid: 91,
      ownerNonce: '1'.repeat(32),
      sourceSha256: broker,
      executableSha256: broker,
    }),
    record('admin_runtime', 'birth', {
      pid: 102,
      parentPid: 91,
      ownerNonce: '2'.repeat(32),
      sourceSha256: admin,
      executableSha256: node,
    }),
    record('broker_binary', 'close', {
      pid: 101,
      parentPid: 91,
      ownerNonce: '1'.repeat(32),
      sourceSha256: broker,
      executableSha256: broker,
    }),
    record('admin_runtime', 'close', {
      pid: 102,
      parentPid: 91,
      ownerNonce: '2'.repeat(32),
      sourceSha256: admin,
      executableSha256: node,
    }),
  ]
}

function parse(records) {
  return parseOwnedProcessCustody(Buffer.from(`${records.map(JSON.stringify).join('\n')}\n`), expected)
}

test('accepts only nonce-bound actual child birth and close pairs', () => {
  const records = parse(validRecords())
  assert.equal(records.length, 4)
  assert.equal(hasClosedOwnedProcessCustody(records), true)
})

test('rejects cross-paired, stale, recycled, duplicate, and arbitrary records', () => {
  const cases = [
    (records) => ({ ...records[2], ownerNonce: '2'.repeat(32) }),
    (records) => ({ ...records[3], pid: 999 }),
    (records) => ({ ...records[0] }),
    () => ({ event: 'birth', role: 'arbitrary' }),
  ]
  for (const mutate of cases) {
    const records = validRecords()
    records.push(mutate(records))
    assert.deepEqual(parse(records), [])
  }
})
