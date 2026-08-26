import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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
