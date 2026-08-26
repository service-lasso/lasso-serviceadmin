import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import {
  rotationProxyLifecycleEvidence,
  runtimeApiTimeoutMs,
  startServiceAdminServer,
} from '../runtime/server.js'
import {
  buildTransportDiagnostic,
  parseRotationProxyLifecycleDiagnostic,
  probeAdminReachability,
} from '../scripts/real-browser-transport-diagnostics.mjs'
import {
  brokerMetadataEndpointCount,
  brokerMetadataReadinessAttempts,
  brokerMetadataRequestOptions,
  brokerMetadataReservedLifecycleMs,
  cypressQualificationTimeoutMs,
  linkedRotationExecuteCount,
  linkedRotationResponseTimeoutMs,
  managedServiceStopReadinessAttempts,
  managedServiceStopReadinessWorstCaseMs,
  managedServiceStopMutationRequestOptions,
  managedServiceStopRequestOptions,
  realBrowserQualificationWorstCaseMs,
} from '../scripts/real-browser-qualification-budget.mjs'
import {
  buildQualificationFailureDiagnostic,
  classifyQualificationFailure,
  createQualificationProgressRecorder,
  parseQualificationProgressDiagnostic,
  qualificationProgressPhases,
} from '../scripts/real-browser-qualification-progress.mjs'

test('real-browser waits stay inside the unchanged qualification budget', async () => {
  assert.equal(cypressQualificationTimeoutMs, 720_000)
  assert.equal(linkedRotationExecuteCount, 2)
  assert.equal(linkedRotationResponseTimeoutMs, 120_000)
  assert.equal(brokerMetadataEndpointCount, 2)
  assert.equal(brokerMetadataReadinessAttempts, 5)
  assert.equal(brokerMetadataReservedLifecycleMs, 6 * 60_000)
  assert.equal(managedServiceStopReadinessAttempts, 5)
  assert.equal(managedServiceStopReadinessWorstCaseMs(), 54_000)
  assert.equal(
    brokerMetadataReservedLifecycleMs - managedServiceStopReadinessWorstCaseMs(),
    306_000
  )
  assert.equal(realBrowserQualificationWorstCaseMs(), 708_000)
  assert.ok(realBrowserQualificationWorstCaseMs() < cypressQualificationTimeoutMs)
  for (const endpoint of ['telemetry', 'events']) {
    assert.deepEqual(
      brokerMetadataRequestOptions(`/operations/${endpoint}`),
      {
        method: 'GET',
        url: `/operations/${endpoint}`,
        failOnStatusCode: false,
        retryOnNetworkFailure: false,
        timeout: 10_000,
      }
    )
  }
  assert.deepEqual(managedServiceStopRequestOptions('/api/services/broker'), {
    method: 'GET',
    url: '/api/services/broker',
    failOnStatusCode: false,
    retryOnNetworkFailure: false,
    timeout: 10_000,
  })
  assert.deepEqual(
    managedServiceStopMutationRequestOptions('/api/services/broker/stop'),
    {
      method: 'POST',
      url: '/api/services/broker/stop',
      body: { confirm: true },
      failOnStatusCode: true,
      retryOnNetworkFailure: false,
      retryOnStatusCodeFailure: false,
      timeout: 120_000,
    }
  )
  const lifecycleSource = await readFile(
    new URL(
      '../cypress/e2e/secrets-broker/real-lifecycle.cy.js',
      import.meta.url
    ),
    'utf8'
  )
  assert.equal(
    [...lifecycleSource.matchAll(/cy\.wait\('@executeLinkedRotation'/g)].length,
    1
  )
  assert.equal(
    [...lifecycleSource.matchAll(/cy\.wait\('@executeRollbackRotation'/g)]
      .length,
    1
  )
  assert.equal(
    [...lifecycleSource.matchAll(/responseTimeout: linkedRotationResponseTimeoutMs/g)]
      .length,
    2
  )
  assert.equal(
    [...lifecycleSource.matchAll(/waitForManagedServiceStopped\('@secretsbroker'\)/g)]
      .length,
    1
  )
  assert.equal(
    [
      ...lifecycleSource.matchAll(
        /managedServiceStopMutationRequestOptions\(\s*'\/api\/services\/%40secretsbroker\/stop'\s*\)/g
      ),
    ].length,
    1
  )
  assert.equal(
    [...lifecycleSource.matchAll(/cy\.wait\('@stoppedBrokerManagement'/g)].length,
    1
  )
  assert.equal(
    [
      ...lifecycleSource.matchAll(
        /expect\(response\?\.statusCode\)\.to\.be\.within\(400, 599\)/g
      ),
    ].length,
    1
  )
})

test('qualification progress is allowlisted, ordered, integral, and capped', () => {
  const writes = []
  let now = 1_000.5
  const recorder = createQualificationProgressRecorder({
    enabled: true,
    write: (line) => writes.push(line),
    now: () => now,
    maxEvents: 2,
  })
  recorder.setSpecPath(
    'C:/candidate/cypress/e2e/secrets-broker/real-lifecycle.cy.js'
  )
  now = 1_123.9
  assert.deepEqual(recorder.record('lifecycle_started'), {
    phase: 'lifecycle_started',
    elapsedMs: 123,
  })
  now = 1_456.2
  assert.deepEqual(recorder.record('committed_rotation_complete'), {
    phase: 'committed_rotation_complete',
    elapsedMs: 455,
  })
  assert.equal(recorder.record('rollback_fixture_armed'), null)
  assert.equal(writes.length, 2)
  assert.deepEqual(parseQualificationProgressDiagnostic(writes[1].trim()), {
    phase: 'committed_rotation_complete',
    elapsedMs: 455,
  })
  assert.equal(
    parseQualificationProgressDiagnostic(
      JSON.stringify({
        schema: 'service-admin.real-browser-progress.v1',
        phase: 'not_allowed',
        elapsedMs: 1,
      })
    ),
    null
  )
  assert.equal(qualificationProgressPhases.length, 7)

  const outOfOrder = createQualificationProgressRecorder({ enabled: true })
  outOfOrder.setSpecPath(
    'C:/candidate/cypress/e2e/secrets-broker/real-lifecycle.cy.js'
  )
  outOfOrder.record('rollback_fixture_armed')
  assert.throws(
    () => outOfOrder.record('committed_rotation_complete'),
    /invalid or out of order/
  )
})

test('qualification progress emits nothing when disabled or outside the lifecycle spec', () => {
  const writes = []
  const disabled = createQualificationProgressRecorder({
    enabled: false,
    write: (line) => writes.push(line),
  })
  disabled.setSpecPath(
    'C:/candidate/cypress/e2e/secrets-broker/real-lifecycle.cy.js'
  )
  assert.equal(disabled.record('lifecycle_started'), null)

  const otherSpec = createQualificationProgressRecorder({
    enabled: true,
    write: (line) => writes.push(line),
  })
  otherSpec.setSpecPath('C:/candidate/real-first-run.cy.js')
  assert.equal(otherSpec.record('lifecycle_started'), null)
  otherSpec.setSpecPath('C:/other-suite/real-lifecycle.cy.js')
  assert.equal(otherSpec.record('lifecycle_started'), null)
  assert.deepEqual(writes, [])
})

test('qualification failures retain only bounded phase and transport metadata', () => {
  assert.equal(classifyQualificationFailure({ timedOut: true }), 'timeout')
  assert.equal(
    classifyQualificationFailure({ exitCode: 1 }),
    'nonzero_exit'
  )
  assert.equal(classifyQualificationFailure({ exitCode: 0 }), null)
  assert.equal(
    classifyQualificationFailure({ exitCode: null }),
    'nonzero_exit'
  )
  assert.deepEqual(
    buildQualificationFailureDiagnostic({
      failure: 'timeout',
      progressEvents: [
        { phase: 'lifecycle_started', elapsedMs: 20 },
        { phase: 'rollback_rotation_complete', elapsedMs: 80_000 },
      ],
      transportDiagnostic: {
        phases: ['upstream_started', 'headers_received', 'body_received'],
        statuses: [200, 200],
        adminReachability: 'reachable',
      },
    }),
    {
      schema: 'service-admin.real-browser-qualification-diagnostic.v1',
      failure: 'timeout',
      lastPhase: 'rollback_rotation_complete',
      elapsedMs: 80_000,
      transportPhases: [
        'upstream_started',
        'headers_received',
        'body_received',
      ],
      statuses: [200, 200],
      adminReachability: 'reachable',
    }
  )
  assert.deepEqual(
    buildQualificationFailureDiagnostic({
      failure: 'nonzero_exit',
      transportDiagnostic: { adminReachability: 'unreachable' },
    }),
    {
      schema: 'service-admin.real-browser-qualification-diagnostic.v1',
      failure: 'nonzero_exit',
      lastPhase: 'not_started',
      elapsedMs: 0,
      transportPhases: [],
      statuses: [],
      adminReachability: 'unreachable',
    }
  )
})

async function listen(server, host = '127.0.0.1') {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, host, resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  return `http://${host}:${address.port}`
}

async function close(server) {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
}

test('packaged proxy binds loopback and normalizes only safe ingress identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'serviceadmin-runtime-'))
  await writeFile(path.join(root, 'index.html'), '<h1>Service Admin</h1>')
  let observed = null
  const upstream = http.createServer((request, response) => {
    observed = { headers: request.headers, url: request.url }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ auth: 'safe' }))
  })
  const upstreamUrl = await listen(upstream)
  const serviceAdmin = await startServiceAdminServer({
    host: '127.0.0.1',
    port: 0,
    distDir: root,
    runtimeApiBaseUrl: upstreamUrl,
  })
  const address = serviceAdmin.address()
  assert.ok(address && typeof address === 'object')

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/runtime/security`, {
      headers: {
        Authorization: 'Bearer browser-token-must-not-forward',
        Cookie: 'session=must-not-forward',
        'X-Forwarded-For': '192.0.2.40',
        'X-Service-Lasso-User': 'usr_trusted_operator',
        'X-Service-Lasso-Workspace': 'workspace-a',
        'X-Service-Lasso-Roles': 'operator, VIEWER, invalid role,operator',
        'X-Service-Lasso-Zitadel-User-Id': 'spoofed-normalized-user',
        'X-Service-Lasso-Client-Address': '127.0.0.1',
        'X-Service-Lasso-Proxy': 'spoofed-browser-proxy',
        'X-Service-Lasso-Trusted-Ingress': 'spoofed-browser-ingress',
      },
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { auth: 'safe' })
    assert.equal(observed.url, '/api/runtime/security')
    assert.equal(observed.headers['x-service-lasso-internal-proxy'], 'serviceadmin')
    assert.equal(observed.headers['x-service-lasso-proxy'], 'serviceadmin')
    assert.equal(observed.headers['x-service-lasso-trusted-ingress'], 'serviceadmin-loopback')
    assert.equal(observed.headers['x-service-lasso-client-address'], '192.0.2.40')
    assert.equal(observed.headers['x-service-lasso-zitadel-user-id'], 'usr_trusted_operator')
    assert.equal(observed.headers['x-service-lasso-workspace-id'], 'workspace-a')
    assert.equal(observed.headers['x-service-lasso-zitadel-roles'], 'operator,viewer')
    assert.equal(observed.headers.authorization, undefined)
    assert.equal(observed.headers.cookie, undefined)
    assert.equal(JSON.stringify(observed).includes('browser-token-must-not-forward'), false)
    assert.equal(JSON.stringify(observed).includes('spoofed-normalized-user'), false)
    assert.equal(JSON.stringify(observed).includes('spoofed-browser-proxy'), false)
    assert.equal(JSON.stringify(observed).includes('spoofed-browser-ingress'), false)
  } finally {
    await close(serviceAdmin)
    await close(upstream)
    await rm(root, { recursive: true, force: true })
  }
})

test('packaged proxy does not manufacture a trusted ingress marker from incomplete identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'serviceadmin-runtime-'))
  await writeFile(path.join(root, 'index.html'), '<h1>Service Admin</h1>')
  const observed = []
  const upstream = http.createServer((request, response) => {
    observed.push(request.headers)
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ auth: 'safe' }))
  })
  const upstreamUrl = await listen(upstream)
  const serviceAdmin = await startServiceAdminServer({
    host: '127.0.0.1',
    port: 0,
    distDir: root,
    runtimeApiBaseUrl: upstreamUrl,
  })
  const address = serviceAdmin.address()
  assert.ok(address && typeof address === 'object')

  try {
    for (const headers of [
      { 'X-Service-Lasso-User': 'usr_missing_client' },
      { 'X-Forwarded-For': '192.0.2.41' },
    ]) {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/runtime/security`, { headers })
      assert.equal(response.status, 200)
    }
    assert.equal(observed.length, 2)
    for (const headers of observed) {
      assert.equal(headers['x-service-lasso-trusted-ingress'], undefined)
      assert.equal(headers['x-service-lasso-proxy'], 'serviceadmin')
    }
  } finally {
    await close(serviceAdmin)
    await close(upstream)
    await rm(root, { recursive: true, force: true })
  }
})

test('packaged proxy gives consumer-converging rotation a bounded cross-platform window', () => {
  assert.equal(runtimeApiTimeoutMs('POST', '/api/services/%40secretsbroker/restart'), 120_000)
  assert.equal(runtimeApiTimeoutMs('POST', '/api/services/sample/start'), 120_000)
  assert.equal(runtimeApiTimeoutMs('POST', '/api/secrets/rotation/execute'), 300_000)
  assert.equal(runtimeApiTimeoutMs('POST', '/api/setup/bootstrap'), 180_000)
  assert.equal(runtimeApiTimeoutMs('GET', '/api/services/sample/restart'), 30_000)
  assert.equal(runtimeApiTimeoutMs('GET', '/api/secrets/rotation/execute'), 30_000)
  assert.equal(runtimeApiTimeoutMs('POST', '/api/services/sample/secrets/reveal'), 30_000)
})

test('rotation proxy lifecycle evidence is bounded to safe metadata', async () => {
  assert.deepEqual(rotationProxyLifecycleEvidence('headers_received', 200), {
    schema: 'service-admin.rotation-proxy-lifecycle.v1',
    phase: 'headers_received',
    status: 200,
  })
  assert.deepEqual(rotationProxyLifecycleEvidence('downstream_closed'), {
    schema: 'service-admin.rotation-proxy-lifecycle.v1',
    phase: 'downstream_closed',
  })
  assert.equal(rotationProxyLifecycleEvidence('raw_response', 200), null)

  const parsed = parseRotationProxyLifecycleDiagnostic(
    JSON.stringify(rotationProxyLifecycleEvidence('body_received', 200))
  )
  assert.deepEqual(parsed, { phase: 'body_received', status: 200 })
  assert.equal(
    parseRotationProxyLifecycleDiagnostic(
      JSON.stringify({
        schema: 'service-admin.rotation-proxy-lifecycle.v1',
        phase: 'body_received',
        status: 200,
        url: 'must-not-be-retained',
      })
    ),
    null
  )
  assert.equal(
    parseRotationProxyLifecycleDiagnostic(
      JSON.stringify({
        schema: 'service-admin.rotation-proxy-lifecycle.v1',
        phase: 'body_received',
        status: 999,
      })
    ),
    null
  )

  assert.equal(
    await probeAdminReachability('http://127.0.0.1:17700', async () => ({
      body: null,
    })),
    'reachable'
  )
  assert.equal(
    await probeAdminReachability('http://127.0.0.1:17700', async () => {
      throw new Error('connection closed')
    }),
    'unreachable'
  )
  assert.deepEqual(
    buildTransportDiagnostic(
      [
        { phase: 'upstream_started' },
        { phase: 'headers_received', status: 200 },
        { phase: 'raw_body', status: 200, value: 'must-not-be-retained' },
      ],
      'reachable'
    ),
    {
      schema: 'service-admin.real-browser-transport-diagnostic.v1',
      phases: ['upstream_started', 'headers_received'],
      statuses: [200],
      adminReachability: 'reachable',
    }
  )
})

test('rotation proxy reports response lifecycle without request or response material', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'serviceadmin-runtime-'))
  await writeFile(path.join(root, 'index.html'), '<h1>Service Admin</h1>')
  const privateMaterial = 'private-rotation-material-must-not-be-retained'
  const upstream = http.createServer(async (request, response) => {
    for await (const _chunk of request) {
      // Consume the request before returning the typed result.
    }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ outcome: 'rolled_back' }))
  })
  const upstreamUrl = await listen(upstream)
  const lifecycleLines = []
  const originalStderrWrite = process.stderr.write
  process.stderr.write = function (chunk, ...args) {
    const line = String(chunk)
    if (line.includes('service-admin.rotation-proxy-lifecycle.v1')) {
      lifecycleLines.push(line.trim())
      return true
    }
    return originalStderrWrite.call(process.stderr, chunk, ...args)
  }
  const serviceAdmin = await startServiceAdminServer({
    host: '127.0.0.1',
    port: 0,
    distDir: root,
    runtimeApiBaseUrl: upstreamUrl,
    rotationProxyLifecycleDiagnostics: true,
  })
  const address = serviceAdmin.address()
  assert.ok(address && typeof address === 'object')

  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/secrets/rotation/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: privateMaterial }),
      }
    )
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { outcome: 'rolled_back' })
    const deadline = Date.now() + 1_000
    while (
      !lifecycleLines.some((line) => line.includes('downstream_closed')) &&
      Date.now() < deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    const lifecycleEvents = lifecycleLines.map((line) => JSON.parse(line))
    assert.deepEqual(
      lifecycleEvents.map(({ phase }) => phase),
      [
        'upstream_started',
        'headers_received',
        'body_received',
        'downstream_closed',
      ]
    )
    assert.deepEqual(
      lifecycleEvents.flatMap(({ status }) =>
        status === undefined ? [] : [status]
      ),
      [200, 200]
    )
    assert.equal(JSON.stringify(lifecycleEvents).includes(privateMaterial), false)
    assert.equal(JSON.stringify(lifecycleEvents).includes('/api/'), false)
  } finally {
    process.stderr.write = originalStderrWrite
    await close(serviceAdmin)
    await close(upstream)
    await rm(root, { recursive: true, force: true })
  }
})

test('packaged runtime refuses a non-loopback listener and non-loopback core origin', async () => {
  await assert.rejects(
    startServiceAdminServer({
      host: '0.0.0.0',
      port: 0,
      runtimeApiBaseUrl: 'http://127.0.0.1:17883',
    }),
    /loopback host/i
  )
  await assert.rejects(
    startServiceAdminServer({
      host: '127.0.0.1',
      port: 0,
      runtimeApiBaseUrl: 'http://192.0.2.10:17883',
    }),
    /loopback origin/i
  )
})

test('static serving is confined and carries browser hardening headers', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'serviceadmin-static-'))
  await writeFile(path.join(root, 'index.html'), '<h1>Service Admin safe shell</h1>')
  const server = await startServiceAdminServer({
    host: '127.0.0.1',
    port: 0,
    distDir: root,
    runtimeApiBaseUrl: 'http://127.0.0.1:9',
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/../../outside`)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /Service Admin safe shell/)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(response.headers.get('x-frame-options'), 'DENY')
    assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/)
  } finally {
    await close(server)
    await rm(root, { recursive: true, force: true })
  }
})
