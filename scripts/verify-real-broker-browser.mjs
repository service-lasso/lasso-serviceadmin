import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { lstat, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const coreRoot = requiredPath('SERVICE_LASSO_TEST_CORE_ROOT')
const brokerBinary = requiredPath('SERVICE_LASSO_TEST_BROKER_BINARY')
const platform = process.platform
const qualificationMode = ['first-run', 'lockout'].includes(
  process.env.SERVICE_LASSO_REAL_BROWSER_MODE
)
  ? process.env.SERVICE_LASSO_REAL_BROWSER_MODE
  : 'comprehensive'
const adminRoot = path.resolve(
  process.env.SERVICE_LASSO_TEST_ADMIN_ROOT ??
    path.join(root, 'output', 'package', `@serviceadmin-${platform}`)
)
const runnerPath = path.join(
  coreRoot,
  'tests',
  'fixtures',
  'real-admin-browser-runner.mjs'
)
const specPath = path.join(
  root,
  'cypress',
  'e2e',
  'secrets-broker',
  qualificationMode === 'lockout'
    ? 'real-lockout.cy.js'
    : qualificationMode === 'first-run'
      ? 'real-first-run.cy.js'
      : 'real-lifecycle.cy.js'
)
const require = createRequire(import.meta.url)
const cypressBin = path.join(
  path.dirname(require.resolve('cypress/package.json')),
  'bin',
  'cypress'
)

function requiredPath(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return path.resolve(value)
}

async function requireFile(filePath, label) {
  const info = await lstat(filePath)
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file.`)
  }
}

async function requireDirectory(directory, label) {
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a real directory.`)
  }
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.off('exit', onExit)
      reject(new Error('Child process exit timed out.'))
    }, timeoutMs)
    const onExit = (code) => {
      clearTimeout(timer)
      resolve(code)
    }
    child.once('exit', onExit)
  })
}

function waitForReady(runner, timeoutMs = 240_000) {
  let buffer = ''
  let bytes = 0
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Real browser runtime readiness timed out.')),
      timeoutMs
    )
    const settle = (callback, value) => {
      clearTimeout(timer)
      runner.stdout.off('data', onData)
      runner.off('exit', onExit)
      callback(value)
    }
    const onExit = (code) =>
      settle(
        reject,
        new Error(
          `Real browser runtime exited before readiness (${code ?? 'signal'}; ${runner.safeDiagnosticCode ?? 'unclassified'}).`
        )
      )
    const onData = (chunk) => {
      bytes += chunk.length
      if (bytes > 1_048_576) {
        settle(reject, new Error('Real browser runtime output exceeded its bound.'))
        return
      }
      buffer += chunk.toString('utf8')
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        try {
          const value = JSON.parse(line)
          if (value.contractVersion === 'service-lasso.real-admin-browser.v1') {
            settle(resolve, value)
            return
          }
        } catch {
          // Readiness output is a single JSON line; ignore bounded startup noise.
        }
      }
    }
    runner.stdout.on('data', onData)
    runner.once('exit', onExit)
  })
}

async function waitForRemoved(target, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await lstat(target)
    } catch (error) {
      if (error?.code === 'ENOENT') return
      throw error
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Real browser runtime did not remove its isolated workspace.')
}

async function verifyBrokerAudit(tempRoot) {
  const auditPath = path.join(
    tempRoot,
    'workspace',
    '.service-lasso',
    'secretsbroker',
    'audit.jsonl'
  )
  const bytes = await readFile(auditPath)
  if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024) {
    throw new Error('Real Broker audit evidence was empty or exceeded its bound.')
  }
  const text = bytes.toString('utf8')
  for (const forbidden of [
    'browser-rotation-candidate-2026-08-14-verified',
    'browser-edited-candidate-2026-08-14-verified',
    'browser-reset-candidate-2026-08-14-verified',
    'browser-vault-token-sentinel-2026-08-14',
    'Release browser qualification',
    'Release browser linked consumer qualification',
    'Release browser verified Vault migration',
    'Release browser verified bulk Vault migration',
    'Real browser qualification active lockout recovery',
  ]) {
    if (text.includes(forbidden)) {
      throw new Error('Real Broker audit evidence retained request secret or reason material.')
    }
  }
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0 || lines.length > 4096) {
    throw new Error('Real Broker audit event count was invalid.')
  }
  const allowedFields = new Set([
    'ts', 'requestId', 'operation', 'serviceId', 'actorKind', 'ref', 'refHash',
    'providerId', 'sourceId', 'policyId', 'keyId', 'outcome', 'reasonCode',
    'state', 'auditStatus', 'previousHash', 'eventHash', 'chainStatus',
  ])
  const events = lines.map((line) => JSON.parse(line))
  let previousHash = 'genesis'
  for (const event of events) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new Error('Real Broker audit event was not an object.')
    }
    if (Object.keys(event).some((field) => !allowedFields.has(field))) {
      throw new Error('Real Broker audit event exceeded the metadata-only schema.')
    }
    const hashInput = { ...event }
    delete hashInput.eventHash
    delete hashInput.chainStatus
    const expectedHash = `sha256:${createHash('sha256')
      .update(JSON.stringify(hashInput))
      .digest('hex')}`
    if (
      typeof event.operation !== 'string' ||
      typeof event.outcome !== 'string' ||
      event.auditStatus !== 'audit_recorded' ||
      event.chainStatus !== 'chained' ||
      !/^sha256:[a-f0-9]{64}$/.test(event.eventHash) ||
      event.eventHash !== expectedHash ||
      event.previousHash !== previousHash
    ) {
      throw new Error('Real Broker audit chain metadata was invalid or discontinuous.')
    }
    previousHash = event.eventHash
  }
  const operations = new Set(events.map((event) => event.operation))
  const requiredOperations =
    qualificationMode === 'lockout'
      ? ['local_api_auth', 'local_api_lockout', 'lockout_clear']
      : qualificationMode === 'first-run'
        ? ['key_initialize', 'vault_created', 'setup_completed', 'writeback_capture']
      : [
    'credential_rotation_dry_run',
    'rotation_stage',
    'rotation_activate',
    'management_create_apply',
    'management_edit_dry_run',
    'management_edit_apply',
    'management_reset_dry_run',
    'management_reset_apply',
    'management_policy_preview',
    'management_reveal',
    'management_decommission_apply',
    'management_decommission_restore',
    'backup_create',
    'backup_verify',
    'backup_restore',
    'key_rotate',
    'provider_config_validate',
    'provider_migration_dry_run',
    'provider_migration_apply_authorized',
    'provider_migration_apply',
    'bulk_campaign_create',
    'bulk_campaign_revalidate',
    'bulk_campaign_apply_authorized',
    'bulk_campaign_item_apply',
    'bulk_campaign_apply',
    'lockout_clear',
  ]
  for (const required of requiredOperations) {
    if (!operations.has(required)) {
      throw new Error(`Real Broker audit evidence omitted required operation ${required}.`)
    }
  }
  return events.length
}

await requireDirectory(coreRoot, 'Core root')
await requireDirectory(adminRoot, 'Packaged Admin root')
await requireFile(brokerBinary, 'Broker binary')
await requireFile(runnerPath, 'Core browser runner')
await requireFile(path.join(adminRoot, 'runtime', 'server.js'), 'Admin runtime')
await requireFile(path.join(adminRoot, 'dist', 'index.html'), 'Admin UI entrypoint')
await requireFile(specPath, 'Cypress lifecycle spec')

const runner = spawn(process.execPath, [runnerPath], {
  cwd: coreRoot,
  env: {
    ...process.env,
    SERVICE_LASSO_TEST_BROKER_BINARY: brokerBinary,
    SERVICE_LASSO_TEST_ADMIN_ROOT: adminRoot,
  },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
})
let stderrBytes = 0
let stderrBuffer = ''
runner.stderr.on('data', (chunk) => {
  stderrBytes = Math.min(1_048_577, stderrBytes + chunk.length)
  if (stderrBuffer.length > 65_536) return
  stderrBuffer += chunk.toString('utf8')
  const lines = stderrBuffer.split(/\r?\n/)
  stderrBuffer = lines.pop() ?? ''
  for (const line of lines) {
    try {
      const diagnostic = JSON.parse(line)
      if (
        diagnostic?.schema === 'service-lasso.real-admin-browser-failure.v1' &&
        typeof diagnostic.code === 'string' &&
        /^[a-z0-9_]{1,64}$/.test(diagnostic.code)
      ) {
        runner.safeDiagnosticCode = diagnostic.code
      }
    } catch {
      // Child stderr is never echoed; only the bounded typed diagnostic is retained.
    }
  }
})

let ready
let cypress
let auditEventCount = 0
try {
  ready = await waitForReady(runner)
  if (!['darwin', 'linux', 'win32'].includes(ready.platform)) {
    throw new Error('Real browser runtime returned an invalid platform.')
  }
  const adminUrl = new URL(ready.adminUrl)
  const controlUrl = new URL(ready.controlUrl)
  if (
    adminUrl.protocol !== 'http:' ||
    adminUrl.hostname !== '127.0.0.1' ||
    adminUrl.pathname !== '/'
  ) {
    throw new Error('Real browser runtime returned an unsafe Admin URL.')
  }
  if (
    controlUrl.protocol !== 'http:' ||
    controlUrl.hostname !== '127.0.0.1' ||
    controlUrl.pathname !== '/__service_lasso_test'
  ) {
    throw new Error('Real browser runtime returned an unsafe control URL.')
  }
  cypress = spawn(
    process.execPath,
    [
      cypressBin,
      'run',
      '--browser',
      'electron',
      '--config',
      `baseUrl=${adminUrl.origin},video=false,screenshotOnRunFailure=false`,
      '--env',
      `testControlUrl=${controlUrl.origin}${controlUrl.pathname},qualificationPlatform=${ready.platform}`,
      '--spec',
      specPath,
    ],
    {
      cwd: root,
      env: cypressEnvironment(),
      stdio: 'inherit',
    }
  )
  const cypressExit = await waitForExit(cypress, 12 * 60_000)
  if (cypressExit !== 0) {
    throw new Error(`Real Broker browser qualification failed (${cypressExit}).`)
  }
  auditEventCount = await verifyBrokerAudit(path.resolve(ready.tempRoot))
} finally {
  if (cypress?.exitCode === null) cypress.kill('SIGKILL')
  if (runner.exitCode === null) {
    runner.send({ type: 'service-lasso-real-admin-shutdown' })
    try {
      await waitForExit(runner, 180_000)
    } catch {
      runner.kill('SIGKILL')
      await waitForExit(runner, 10_000).catch(() => undefined)
    }
  }
  if (ready?.tempRoot) await waitForRemoved(path.resolve(ready.tempRoot))
}

function cypressEnvironment() {
  const environment = { ...process.env }
  // Electron launchers interpret this machine-level developer override and
  // become plain Node processes, which disables Cypress's browser protocol.
  delete environment.ELECTRON_RUN_AS_NODE
  return environment
}

if (stderrBytes > 1_048_576) {
  throw new Error('Real browser runtime diagnostic output exceeded its bound.')
}
const brokerSha256 = createHash('sha256')
  .update(await readFile(brokerBinary))
  .digest('hex')
process.stdout.write(
  `${JSON.stringify({
    schema: 'service-lasso.real-secrets-browser-result.v1',
    qualificationMode,
    outcome: 'verified',
    platform,
    coreRevision: process.env.SERVICE_LASSO_TEST_CORE_REVISION ?? 'local',
    brokerRevision: process.env.SERVICE_LASSO_TEST_BROKER_REVISION ?? 'local',
    brokerSha256,
    adminArtifact: path.basename(adminRoot),
    auditEventCount,
  })}\n`
)
