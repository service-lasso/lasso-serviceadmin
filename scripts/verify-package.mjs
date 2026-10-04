import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { lstat, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceAdmissionFixtureUpstream, verifySourceAdmissionProxy, verifyGenericBodyProxy, createSourceAdmissionLifetimeCollector } from './source-admission-proxy-fixtures.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const platform = process.argv.slice(2).find((argument) => argument !== '--') ?? process.platform
const assetName = platform === 'win32'
  ? '@serviceadmin-win32.zip'
  : `@serviceadmin-${platform}.tar.gz`
const assetPath = path.join(root, 'output', 'release', assetName)
const extractionRoot = await mkdtemp(path.join(os.tmpdir(), 'serviceadmin-package-'))

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server.address().port))
  })
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

async function reservePort() {
  const server = http.createServer()
  const port = await listen(server)
  await close(server)
  return port
}

async function auditExtracted(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    const info = await lstat(entryPath)
    assert.equal(info.isSymbolicLink(), false, `archive must not contain links: ${entry.name}`)
    if (info.isDirectory()) await auditExtracted(entryPath)
    else assert.equal(info.isFile(), true, `archive entry must be a regular file: ${entry.name}`)
  }
}

async function waitForResponse(url, child, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`packaged runtime exited with ${child.exitCode}`)
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('packaged runtime readiness timed out')
}

let child
let upstream
try {
  const tarCommand = platform === 'win32' ? 'tar.exe' : 'tar'
  const listing = spawnSync(tarCommand, ['-tf', assetName], {
    cwd: path.dirname(assetPath),
    encoding: 'utf8',
  })
  assert.equal(listing.status, 0, listing.stderr)
  const entries = listing.stdout.split(/\r?\n/).filter(Boolean).map((entry) => entry.replace(/^\.\//, ''))
  for (const required of ['dist/index.html', 'runtime/server.js', 'service.json']) {
    assert.equal(entries.includes(required), true, `archive is missing ${required}`)
  }
  const sbomName = `serviceadmin-${platform}.cdx.json`
  assert.equal(entries.includes(sbomName), true, `archive is missing ${sbomName}`)
  for (const entry of entries) {
    assert.equal(path.isAbsolute(entry), false, `absolute archive entry: ${entry}`)
    assert.equal(entry.split(/[\\/]+/).includes('..'), false, `escaping archive entry: ${entry}`)
    assert.equal(entry.split(/[\\/]+/).includes('node_modules'), false, `dependency tree leaked: ${entry}`)
    assert.equal(path.basename(entry).startsWith('.env'), false, `environment file leaked: ${entry}`)
  }

  const extraction = spawnSync(tarCommand, ['-xf', assetName, '-C', extractionRoot], {
    cwd: path.dirname(assetPath),
    encoding: 'utf8',
  })
  assert.equal(extraction.status, 0, extraction.stderr)
  await auditExtracted(extractionRoot)
  assert.deepEqual(
    await readFile(path.join(extractionRoot, 'runtime', 'server.js')),
    await readFile(path.join(root, 'runtime', 'server.js')),
    'packaged proxy must contain the exact selected source bytes'
  )
  const manifest = JSON.parse(await readFile(path.join(extractionRoot, 'service.json'), 'utf8'))
  const embeddedSbomBytes = await readFile(path.join(extractionRoot, sbomName))
  const sidecarSbomBytes = await readFile(path.join(root, 'output', 'release', sbomName))
  assert.deepEqual(sidecarSbomBytes, embeddedSbomBytes, 'SBOM sidecar must exactly match the archive SBOM')
  const sbom = JSON.parse(embeddedSbomBytes.toString('utf8'))
  assert.equal(sbom.bomFormat, 'CycloneDX')
  assert.equal(sbom.specVersion, '1.6')
  assert.equal(sbom.metadata.component.type, 'application')
  assert.equal(sbom.metadata.component.name, '@service-lasso/service-admin')
  assert.equal(sbom.metadata.component.version, manifest.version)
  assert.equal(Array.isArray(sbom.components) && sbom.components.length > 0, true)
  assert.equal(JSON.stringify(sbom).includes(root), false, 'SBOM must not contain build-host paths')
  assert.equal(manifest.id, '@serviceadmin')
  assert.equal(manifest.version, '1.0.0-rc.1')
  assert.equal(manifest.env.SERVICE_HOST, '127.0.0.1')
  assert.deepEqual(manifest.execconfig.args, ['runtime/server.js'])
  for (const target of ['win32', 'linux', 'darwin']) {
    assert.deepEqual(manifest.artifact.platforms[target].checksum, {
      algorithm: 'sha256',
      assetName: 'SHA256SUMS.txt',
    })
  }
  assert.equal(manifest.artifact.checksum, undefined, 'checksum policy must be platform-scoped for Core consumption')

  let observedRequest = null
  const sourceAdmissionRecords = []
  let sourceAdmissionMode = 'normal'
  upstream = http.createServer((request, response) => {
    sourceAdmissionFixtureUpstream(request, response, (record) => {
      observedRequest = { headers: record.headers, url: record.url }
      sourceAdmissionRecords.push(record)
    }, () => sourceAdmissionMode)
  })
  const upstreamPort = await listen(upstream)
  const serviceAdminPort = await reservePort()
  const stdout = []
  const stderr = []
  let stderrBytes = 0
  let stderrOverflow = false
  const lifetime = createSourceAdmissionLifetimeCollector()
  assert.ok(path.isAbsolute(process.env.SERVICE_LASSO_TEST_SENDER_ARTIFACT_ROOT ?? ''), 'qualification sender artifact ROOT required')
  assert.match(process.env.SERVICE_LASSO_TEST_SENDER_ARTIFACT_ROOT_SHA256 ?? '', /^[a-f0-9]{64}$/, 'qualification sender artifact ROOT byte pin required')
  child = spawn(process.execPath, [path.join(extractionRoot, 'runtime', 'server.js')], {
    cwd: extractionRoot,
    env: {
      ...process.env,
      SERVICE_LASSO_TEST_SOURCE_PROXY_LIFETIME: '1',
      SERVICE_LASSO_TEST_SENDER_ARTIFACT_ROOT: process.env.SERVICE_LASSO_TEST_SENDER_ARTIFACT_ROOT,
      SERVICE_LASSO_TEST_SENDER_ARTIFACT_ROOT_SHA256: process.env.SERVICE_LASSO_TEST_SENDER_ARTIFACT_ROOT_SHA256,
      SERVICE_HOST: '127.0.0.1',
      SERVICE_PORT: String(serviceAdminPort),
      SERVICE_LASSO_API_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => { if (stdout.join('').length < 65_536) stdout.push(String(chunk)) })
  child.stderr.on('data', (chunk) => {
    // Preserve original extracted-child bytes in the admitted parent capture.
    // Exact bounded accumulation rejects overflow rather than treating truncation as proof.
    process.stderr.write(chunk)
    lifetime.feed(chunk)
    stderrBytes += chunk.length
    if (stderrBytes > 65_536) { stderrOverflow = true; return }
    stderr.push(String(chunk))
  })

  const shell = await waitForResponse(`http://127.0.0.1:${serviceAdminPort}/`, child)
  assert.match(await shell.text(), /<html/i)
  const api = await fetch(`http://127.0.0.1:${serviceAdminPort}/api/runtime/security`, {
    headers: {
      authorization: 'Bearer browser-secret-must-not-forward',
      cookie: 'session=browser-secret-must-not-forward',
      'x-forwarded-for': '192.0.2.51',
      'x-service-lasso-user': 'usr_release_operator',
      'x-service-lasso-workspace': 'workspace-release',
    },
  })
  assert.equal(api.status, 200)
  assert.equal(observedRequest.url, '/api/runtime/security')
  assert.equal(observedRequest.headers.authorization, undefined)
  assert.equal(observedRequest.headers.cookie, undefined)
  assert.equal(observedRequest.headers['x-service-lasso-internal-proxy'], 'serviceadmin')
  assert.equal(observedRequest.headers['x-service-lasso-proxy'], 'serviceadmin')
  assert.equal(observedRequest.headers['x-service-lasso-trusted-ingress'], 'serviceadmin-loopback')
  assert.equal(observedRequest.headers['x-service-lasso-client-address'], '192.0.2.51')
  assert.equal(observedRequest.headers['x-service-lasso-zitadel-user-id'], 'usr_release_operator')
  assert.equal(observedRequest.headers['x-service-lasso-user'], 'usr_release_operator')
  assert.equal(observedRequest.headers['x-service-lasso-actor'], 'usr_release_operator')
  assert.equal(observedRequest.headers['x-service-lasso-workspace-id'], 'workspace-release')
  assert.equal(JSON.stringify({ observedRequest, stdout, stderr }).includes('browser-secret-must-not-forward'), false)
  await verifySourceAdmissionProxy({
    baseUrl: `http://127.0.0.1:${serviceAdminPort}`,
    records: sourceAdmissionRecords,
    lifetime,
    setMode: (value) => { sourceAdmissionMode = value },
  })
  // Package verification has no source-test150s wrapper. Preserve both shared
  // cases on the original extracted child, sequentially with normal mode.
  sourceAdmissionMode = 'normal'
  await verifyGenericBodyProxy({
    baseUrl: `http://127.0.0.1:${serviceAdminPort}`,
    records: sourceAdmissionRecords,
    lifetime,
  })
  assert.equal(JSON.stringify({ observedRequest, stdout, stderr }).includes('browser-secret-must-not-forward'), false)
  assert.equal(stderrOverflow, false, 'original child stderr must be fully bounded and retained')
  lifetime.snapshot()
  process.stdout.write(`${JSON.stringify({ assetName, runtime: 'verified', identityProxy: 'verified' })}\n`)
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  if (upstream) await close(upstream)
  await rm(extractionRoot, { recursive: true, force: true })
}
