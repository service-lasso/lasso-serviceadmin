import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import { createServiceAdminServer, runtimeApiTimeoutMs, sourceAdmissionProxyPolicy, createSourceAdmissionDiagnosticWriter } from '../runtime/server.js'
import { sourceAdmissionFixtureUpstream, verifySourceAdmissionProxy, verifyGenericBodyProxy, createSourceAdmissionLifetimeCollector } from '../scripts/source-admission-proxy-fixtures.mjs'

test('SA-P1..SA-P6 original native HTTP producer contract', { timeout: 150_000 }, async () => {
  const records = []
  let mode = 'normal'
  const upstream = http.createServer((request, response) => sourceAdmissionFixtureUpstream(request, response, (row) => records.push(row), () => mode))
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const lifetime = createSourceAdmissionLifetimeCollector()
  const proxy = createServiceAdminServer({ runtimeApiBaseUrl: `http://127.0.0.1:${upstream.address().port}`, sourceAdmissionLifecycleDiagnostics: true })
  proxy.on('sourceAdmissionProxyLifecycle', lifetime.feed)
  proxy.on('sourceAdmissionProxyLifecycleFailure', lifetime.invalidate)
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  try {
    await verifySourceAdmissionProxy({ baseUrl: `http://127.0.0.1:${proxy.address().port}`, records, lifetime, setMode: (value) => { mode = value } })
  } finally {
    await new Promise((resolve) => proxy.close(resolve))
    await new Promise((resolve) => upstream.close(resolve))
    await proxy.sourceAdmissionDiagnosticsRetired
    lifetime.snapshot()
  }
})

test('SA-P5..SA-P6 independent generic body clocks and allocation recovery', { timeout: 45_000 }, async () => {
  // These original servers/records cannot borrow selected fixture mode or slots.
  const records = []
  const upstream = http.createServer((request, response) => sourceAdmissionFixtureUpstream(request, response, (row) => records.push(row), () => 'normal'))
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const proxy = createServiceAdminServer({ runtimeApiBaseUrl: `http://127.0.0.1:${upstream.address().port}` })
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  try {
    await verifyGenericBodyProxy({ baseUrl: `http://127.0.0.1:${proxy.address().port}`, records })
  } finally {
    await new Promise((resolve) => proxy.close(resolve))
    await new Promise((resolve) => upstream.close(resolve))
  }
})

test('selected budgets never widen generic route or method defaults', () => {
  const target = `/api/service-source-admission/stages/sas_${'a'.repeat(32)}/content`
  assert.equal(runtimeApiTimeoutMs('PUT', target), 40_000)
  assert.equal(runtimeApiTimeoutMs('POST', '/api/service-source-admission/preflights'), 10_000)
  assert.equal(runtimeApiTimeoutMs('POST', `/api/service-source-admission/preflights/sap_${'b'.repeat(32)}/commit`), 40_000)
  for (const near of [target + '?offset=0', target + '/extra', target.replace('sas_', 'SAS_'), target.replace('sas_', '%73as_')]) {
    assert.equal(sourceAdmissionProxyPolicy('PUT', near), null)
    assert.equal(runtimeApiTimeoutMs('PUT', near), 30_000)
  }
  assert.equal(sourceAdmissionProxyPolicy('POST', target), null)
  assert.equal(runtimeApiTimeoutMs('GET', target), 30_000)
  assert.equal(runtimeApiTimeoutMs('POST', '/api/ordinary'), 30_000)
})

// Prospective callback-owned diagnostic regression; injected native completions
// establish source ownership/error paths, not qualification of an actual pipe.
test('diagnostic asynchronous write failure invalidates evidence and retires', { timeout: 5_000 }, async () => {
  const lifetime = createSourceAdmissionLifetimeCollector()
  let nativeCallback
  const calls = []
  const writer = createSourceAdmissionDiagnosticWriter({
    enabled: true,
    onFailure: lifetime.invalidate,
    nativeWrite: (fd, bytes, offset, length, position, callback) => {
      calls.push({ fd, bytes, offset, length, position })
      nativeCallback = callback
    },
  })
  const line = '{"schema":"sa-lifetime.v1","seq":1,"request":1,"role":"one","phase":"acquired"}\n'
  lifetime.feed(line)
  assert.equal(writer.write(line), true)
  let retired = false
  const retirement = writer.retire().then(() => { retired = true })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(retired, false, 'actual pending callback must keep retirement open')
  assert.equal(calls[0].fd, 2)
  assert.deepEqual(calls[0].bytes, Buffer.from(line))
  await new Promise((resolve) => setImmediate(() => { nativeCallback(new Error('controlled async failure')); resolve() }))
  await retirement
  assert.equal(retired, true)
  assert.throws(() => lifetime.snapshot(), (error) => error.code === 'FIXTURE_LIFETIME_WRITE')
  assert.equal(writer.write(line), false)
  assert.equal(calls.length, 1, 'failed sink never retries or writes fabricated closure')
})

test('diagnostic partial writes retain exact bytes until ordered retirement', { timeout: 5_000 }, async () => {
  const pending = []
  const captured = []
  let failed = false
  const writer = createSourceAdmissionDiagnosticWriter({
    enabled: true, onFailure: () => { failed = true },
    nativeWrite: (fd, bytes, offset, length, position, callback) => {
      assert.equal(fd, 2)
      assert.equal(position, null)
      pending.push({ bytes, offset, length, callback })
    },
  })
  writer.write('first\n')
  writer.write('second\n')
  let retired = false
  const retirement = writer.retire().then(() => { retired = true })
  while (pending.length) {
    const part = pending.shift()
    const written = Math.min(2, part.length)
    captured.push(Buffer.from(part.bytes.subarray(part.offset, part.offset + written)))
    assert.equal(retired, false)
    await new Promise((resolve) => setImmediate(() => { part.callback(null, written); resolve() }))
  }
  await retirement
  assert.equal(failed, false)
  assert.deepEqual(Buffer.concat(captured), Buffer.from('first\nsecond\n'))
  assert.equal(retired, true)
})

test('diagnostic disabled writer and enabled server close retire without shared stream ownership', { timeout: 5_000 }, async () => {
  let calls = 0
  const writer = createSourceAdmissionDiagnosticWriter({ nativeWrite: () => { calls++ } })
  assert.equal(writer.write('disabled\n'), false)
  await writer.retire()
  assert.equal(calls, 0)
  const beforeErrorListeners = process.stderr.listenerCount('error')
  for (const enabled of [false, true]) {
    const proxy = createServiceAdminServer({ runtimeApiBaseUrl: 'http://127.0.0.1:1', sourceAdmissionLifecycleDiagnostics: enabled })
    await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
    await new Promise((resolve) => proxy.close(resolve))
    await proxy.sourceAdmissionDiagnosticsRetired
    assert.equal(process.stderr.listenerCount('error'), beforeErrorListeners, 'no shared Writable/global error ownership added')
  }
})