import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startServiceAdminServer } from '../runtime/server.js'

const adminRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
)
const coreRoot = path.resolve(process.env.SERVICE_LASSO_CORE_DIR ?? '')
assert.ok(
  process.env.SERVICE_LASSO_CORE_DIR,
  'Set SERVICE_LASSO_CORE_DIR to a built Core checkout.'
)
assert.equal(
  process.platform,
  'linux',
  'This real browser proof currently requires Linux.'
)
const revision = (root) =>
  execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
const source = { admin: revision(adminRoot), core: revision(coreRoot) }
const oldTag = 'candidate-2026.11.27-6a057bc'
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const scratch = await mkdtemp(
  path.join(tmpdir(), 'admin-pinned-release-browser-')
)
const output = process.env.SERVICE_LASSO_BROWSER_EVIDENCE_DIR
  ? path.resolve(process.env.SERVICE_LASSO_BROWSER_EVIDENCE_DIR)
  : path.join(scratch, 'evidence')
await mkdir(output, { recursive: true, mode: 0o700 })
process.umask(0o077)
const importCore = (relative) =>
  import(pathToFileURL(path.join(coreRoot, 'dist', relative)).href)
const { startPinnedReleaseE2eStack } = await import(
  pathToFileURL(path.join(coreRoot, 'scripts/pinned-release-e2e-stack.mjs'))
    .href
)
const { discoverServices } = await importCore(
  'runtime/discovery/discoverServices.js'
)
const { resolveActivatedOperatorExecutable } = await importCore(
  'runtime/updates/pinned-operator-release.js'
)
const getJson = async (url, init) => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(180_000),
  })
  assert.equal(
    response.status,
    200,
    `Unexpected HTTP status ${response.status}`
  )
  return await response.json()
}
const closed = async (port) => {
  await new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    socket.once('connect', () => {
      socket.destroy()
      reject(new Error('Owned listener remained open.'))
    })
    socket.once('error', resolve)
  })
}
let stack, admin, browser, corePort, adminPort
let failure
const receipt = {
  source,
  previous: oldTag,
  platform: process.platform,
  metadataTransport:
    process.env.SERVICE_LASSO_E2E_METADATA_TRANSPORT ?? 'direct-public-github',
}
try {
  stack = await startPinnedReleaseE2eStack({ previousTuiTag: oldTag })
  const { servicesRoot, workspaceRoot } = stack
  const origin = new URL(stack.apiUrl).origin
  corePort = Number(new URL(origin).port)
  const initial = (await getJson(origin + '/api/runtime/instance')).instance
  const manifestPath = path.join(servicesRoot, '@tui', 'service.json')
  const bytes = await readFile(manifestPath)
  await stack.verifyHealthy()
  admin = await startServiceAdminServer({
    port: 0,
    host: '127.0.0.1',
    runtimeApiBaseUrl: origin,
    distDir: path.join(adminRoot, 'dist'),
  })
  adminPort = admin.address().port
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const installRequests = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/pinned-release/install'))
      installRequests.push(request.postDataJSON())
  })
  await page.goto(`http://127.0.0.1:${adminPort}/services/%40tui`, {
    waitUntil: 'domcontentloaded',
  })
  await page
    .getByRole('button', { name: 'Continue as local-root', exact: true })
    .click()
  const checkButton = page.getByRole('button', {
    name: 'Check new releases',
    exact: true,
  })
  await checkButton.waitFor({ state: 'visible', timeout: 30_000 })
  await checkButton.click()
  const available = page.getByText(/^Available release /)
  await available.waitFor({ state: 'visible', timeout: 60_000 })
  const nextTag = (await available.textContent()).slice(
    'Available release '.length
  )
  assert.match(nextTag, /^candidate-\d{4}\.\d{1,2}\.\d{1,2}-[a-f0-9]{7}$/)
  assert.notEqual(nextTag, oldTag)
  await page
    .getByRole('button', { name: 'Install release', exact: true })
    .click()
  const dialog = page.getByRole('alertdialog')
  assert.ok(
    (await dialog.textContent()).includes(`Replace ${oldTag} with ${nextTag}`)
  )
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  assert.equal(installRequests.length, 0)
  const service = (await discoverServices(servicesRoot)).find(
    (row) => row.manifest.id === '@tui'
  )
  assert.equal(await resolveActivatedOperatorExecutable(service), null)
  await page.screenshot({
    path: path.join(output, 'release-available.png'),
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Install release', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: 'Install release', exact: true })
    .click()
  await page
    .getByRole('status')
    .filter({ hasText: `Installed ${nextTag}.` })
    .waitFor({ state: 'visible', timeout: 120_000 })
  assert.deepEqual(installRequests, [{ tag: nextTag, confirm: true }])
  await page.screenshot({
    path: path.join(output, 'release-installed.png'),
    fullPage: true,
  })
  await checkButton.click()
  await page
    .getByRole('status')
    .filter({ hasText: 'The installed release is current.' })
    .waitFor({ state: 'visible', timeout: 60_000 })
  const binary = await resolveActivatedOperatorExecutable(service)
  assert.ok(binary)
  const launched = spawnSync(
    process.execPath,
    [path.join(coreRoot, 'dist/cli.js'), 'tui', '--help'],
    {
      cwd: coreRoot,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        ...stack.env,
        SERVICE_LASSO_SERVICES_ROOT: servicesRoot,
        SERVICE_LASSO_WORKSPACE_ROOT: workspaceRoot,
      },
    }
  )
  assert.equal(launched.status, 2)
  assert.match(launched.stderr, /Usage of /)
  assert.deepEqual(await readFile(manifestPath), bytes)
  assert.equal(
    (await getJson(origin + '/api/runtime/instance')).instance.generationId,
    initial.generationId
  )
  await page.goto(`http://127.0.0.1:${adminPort}/services/%40cli`, {
    waitUntil: 'domcontentloaded',
  })
  await page
    .getByRole('button', { name: 'Check new releases', exact: true })
    .click()
  await page
    .getByRole('status')
    .filter({ hasText: 'The installed release is current.' })
    .waitFor({ state: 'visible', timeout: 60_000 })
  await page.screenshot({
    path: path.join(output, 'cli-current.png'),
    fullPage: true,
  })
  await stack.verifyHealthy()
  Object.assign(receipt, {
    installed: nextTag,
    browserCheck: true,
    cliCurrentCheck: true,
    cancelPreservedActivation: true,
    confirmedInstall: true,
    installRequests: 1,
    currentAfterInstall: true,
    originalManifestUnchanged: true,
    coreGenerationPreserved: true,
    fiveHealthyDaemons: true,
    providersNotRunning: true,
    launcherExit: launched.status,
    executableSha256: digest(await readFile(binary)),
  })
} catch (error) {
  failure = error
} finally {
  const cleanup = await Promise.allSettled([
    browser?.close(),
    admin &&
      (async () => {
        admin.closeIdleConnections()
        await new Promise((resolve) => admin.close(resolve))
      })(),
    stack?.close(),
  ])
  const listenerChecks = await Promise.allSettled([
    adminPort && closed(adminPort),
    corePort && closed(corePort),
  ])
  const cleanupErrors = [...cleanup, ...listenerChecks].filter(
    (result) => result.status === 'rejected'
  )
  receipt.ownedListenersClosed = Boolean(
    adminPort && corePort && cleanupErrors.length === 0
  )
  receipt.passed = failure === undefined && cleanupErrors.length === 0
  await writeFile(
    path.join(output, 'receipt.json'),
    JSON.stringify(receipt, null, 2) + '\n'
  )
  if (failure === undefined && cleanupErrors.length)
    failure = cleanupErrors[0].reason
}
if (failure !== undefined) throw failure
console.log(JSON.stringify({ ...receipt, evidence: output }))
