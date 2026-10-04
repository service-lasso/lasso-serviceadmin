import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import { createServiceAdminServer, runtimeApiTimeoutMs, sourceAdmissionProxyPolicy } from '../runtime/server.js'
import { sourceAdmissionFixtureUpstream, verifySourceAdmissionProxy, verifyGenericBodyProxy } from '../scripts/source-admission-proxy-fixtures.mjs'

test('SA-P1..SA-P6 original native HTTP producer contract', { timeout: 150_000 }, async () => {
  const records = []
  let mode = 'normal'
  const upstream = http.createServer((request, response) => sourceAdmissionFixtureUpstream(request, response, (row) => records.push(row), () => mode))
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const proxy = createServiceAdminServer({ runtimeApiBaseUrl: `http://127.0.0.1:${upstream.address().port}` })
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve))
  try {
    await verifySourceAdmissionProxy({ baseUrl: `http://127.0.0.1:${proxy.address().port}`, records, setMode: (value) => { mode = value } })
  } finally {
    await new Promise((resolve) => proxy.close(resolve))
    await new Promise((resolve) => upstream.close(resolve))
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
