import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { lstat, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
  const listing = spawnSync(tarCommand, ['-tf', assetPath], { encoding: 'utf8' })
  assert.equal(listing.status, 0, listing.stderr)
  const entries = listing.stdout.split(/\r?\n/).filter(Boolean).map((entry) => entry.replace(/^\.\//, ''))
  for (const required of ['dist/index.html', 'runtime/server.js', 'service.json']) {
    assert.equal(entries.includes(required), true, `archive is missing ${required}`)
  }
  for (const entry of entries) {
    assert.equal(path.isAbsolute(entry), false, `absolute archive entry: ${entry}`)
    assert.equal(entry.split(/[\\/]+/).includes('..'), false, `escaping archive entry: ${entry}`)
    assert.equal(entry.split(/[\\/]+/).includes('node_modules'), false, `dependency tree leaked: ${entry}`)
    assert.equal(path.basename(entry).startsWith('.env'), false, `environment file leaked: ${entry}`)
  }

  const extraction = spawnSync(tarCommand, ['-xf', assetPath, '-C', extractionRoot], { encoding: 'utf8' })
  assert.equal(extraction.status, 0, extraction.stderr)
  await auditExtracted(extractionRoot)
  const manifest = JSON.parse(await readFile(path.join(extractionRoot, 'service.json'), 'utf8'))
  assert.equal(manifest.id, '@serviceadmin')
  assert.equal(manifest.env.SERVICE_HOST, '127.0.0.1')
  assert.deepEqual(manifest.execconfig.args, ['runtime/server.js'])

  let observedRequest = null
  upstream = http.createServer((request, response) => {
    observedRequest = { headers: request.headers, url: request.url }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ contractVersion: 'service-lasso.auth-status.v1', ok: true }))
  })
  const upstreamPort = await listen(upstream)
  const serviceAdminPort = await reservePort()
  const stdout = []
  const stderr = []
  child = spawn(process.execPath, [path.join(extractionRoot, 'runtime', 'server.js')], {
    cwd: extractionRoot,
    env: {
      ...process.env,
      SERVICE_HOST: '127.0.0.1',
      SERVICE_PORT: String(serviceAdminPort),
      SERVICE_LASSO_API_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => { if (stdout.join('').length < 65_536) stdout.push(String(chunk)) })
  child.stderr.on('data', (chunk) => { if (stderr.join('').length < 65_536) stderr.push(String(chunk)) })

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
  assert.equal(observedRequest.headers['x-service-lasso-client-address'], '192.0.2.51')
  assert.equal(observedRequest.headers['x-service-lasso-zitadel-user-id'], 'usr_release_operator')
  assert.equal(observedRequest.headers['x-service-lasso-workspace-id'], 'workspace-release')
  assert.equal(JSON.stringify({ observedRequest, stdout, stderr }).includes('browser-secret-must-not-forward'), false)
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
