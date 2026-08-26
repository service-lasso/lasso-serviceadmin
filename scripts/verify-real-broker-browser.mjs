import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildTransportDiagnostic,
  parseRotationProxyLifecycleDiagnostic,
  probeAdminReachability,
} from './real-browser-transport-diagnostics.mjs'
import { cypressQualificationTimeoutMs } from './real-browser-qualification-budget.mjs'
import {
  buildQualificationFailureDiagnostic,
  classifyQualificationFailure,
  parseQualificationProgressDiagnostic,
  qualificationProgressPhases,
} from './real-browser-qualification-progress.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const coreRoot = requiredPath('SERVICE_LASSO_TEST_CORE_ROOT')
const brokerBinary = requiredPath('SERVICE_LASSO_TEST_BROKER_BINARY')
const platform = process.platform
const committedRotationCandidate =
  'browser-rotation-candidate-2026-08-14-verified'
const rollbackCandidate =
  '/private/service-lasso/browser-rollback-sentinel-2026-08-26'
const forbiddenAuditMaterial = [
  committedRotationCandidate,
  rollbackCandidate,
  'browser-edited-candidate-2026-08-14-verified',
  'browser-reset-candidate-2026-08-14-verified',
  'browser-vault-token-sentinel-2026-08-14',
  'Release browser qualification',
  'Release browser linked consumer qualification',
  'Release browser automatic rollback qualification',
  'Release browser verified Vault migration',
  'Release browser verified bulk Vault migration',
  'Real browser qualification active lockout recovery',
]
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

async function readBoundedRegularFile(
  filePath,
  maxBytes,
  label,
  { allowEmpty = false } = {}
) {
  const info = await lstat(filePath)
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file.`)
  }
  if ((!allowEmpty && info.size === 0) || info.size > maxBytes) {
    throw new Error(`${label} was empty or exceeded its bound.`)
  }
  const bytes = await readFile(filePath)
  if ((!allowEmpty && bytes.length === 0) || bytes.length > maxBytes) {
    throw new Error(`${label} changed outside its bound while being read.`)
  }
  return bytes
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
  const bytes = await readBoundedRegularFile(
    auditPath,
    4 * 1024 * 1024,
    'Real Broker audit evidence'
  )
  const text = bytes.toString('utf8')
  for (const forbidden of forbiddenAuditMaterial) {
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
  const requiredOperations = (
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
     'rotation_rollback',
    ]
  ).filter(
    (operation) => operation !== 'key_rotate' || platform === 'win32'
  )
  for (const required of requiredOperations) {
    if (!operations.has(required)) {
      throw new Error(`Real Broker audit evidence omitted required operation ${required}.`)
    }
  }
  return events.length
}

async function listBoundedEvidenceFiles(directory, files = [], depth = 0) {
  if (depth > 8 || files.length > 256) {
    throw new Error('Real browser evidence file traversal exceeded its bound.')
  }
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return files
    throw error
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error('Real browser evidence contained an unsafe symbolic link.')
    }
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await listBoundedEvidenceFiles(entryPath, files, depth + 1)
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
    if (files.length > 256) {
      throw new Error('Real browser evidence file count exceeded its bound.')
    }
  }
  return files
}

async function verifyNoLeakEvidence(
  tempRoot,
  runtimeDiagnostics,
  { requireComplete = false } = {}
) {
  const evidenceRoots =
    qualificationMode === 'comprehensive'
      ? [
          {
            directory: path.join(
              tempRoot,
              'services',
              'sample-service',
              'logs'
            ),
            allowEmptyFiles: true,
          },
          {
            directory: path.join(
              tempRoot,
              'workspace',
              '.service-lasso',
              'secret-rotations'
            ),
            allowEmptyFiles: false,
          },
        ]
      : []
  let totalBytes = 0
  for (const { directory, allowEmptyFiles } of evidenceRoots) {
    if (requireComplete) {
      await requireDirectory(directory, 'Real browser no-leak evidence root')
    }
    const evidenceFiles = await listBoundedEvidenceFiles(directory)
    if (requireComplete && evidenceFiles.length === 0) {
      throw new Error('Real browser no-leak evidence root was empty.')
    }
    for (const filePath of evidenceFiles) {
      const bytes = await readBoundedRegularFile(
        filePath,
        4 * 1024 * 1024,
        'Real browser no-leak evidence file',
        { allowEmpty: allowEmptyFiles }
      )
      totalBytes += bytes.length
      if (totalBytes > 8 * 1024 * 1024) {
        throw new Error('Real browser evidence bytes exceeded their bound.')
      }
      const text = bytes.toString('utf8')
      if (forbiddenAuditMaterial.some((value) => text.includes(value))) {
        throw new Error('Real browser evidence retained private rollback material.')
      }
    }
  }
  if (
    forbiddenAuditMaterial.some((value) => runtimeDiagnostics.includes(value))
  ) {
    throw new Error('Real browser runtime diagnostics retained private rollback material.')
  }
  for (const captureRoot of [
    path.join(root, 'cypress', 'screenshots'),
    path.join(root, 'cypress', 'videos'),
  ]) {
    if ((await listBoundedEvidenceFiles(captureRoot)).length > 0) {
      throw new Error('Real browser qualification retained a browser capture.')
    }
  }
}

async function verifyRollbackProcessEvidence(tempRoot) {
  const evidencePath = path.join(
    tempRoot,
    'services',
    'sample-service',
    '.state',
    'browser-broker-evidence.json'
  )
  const evidence = JSON.parse(
    (
      await readBoundedRegularFile(
        evidencePath,
        1024,
        'Real rollback process evidence'
      )
    ).toString('utf8')
  )
  if (
    !evidence ||
    typeof evidence !== 'object' ||
    Array.isArray(evidence) ||
    Object.keys(evidence).sort().join(',') !== 'digest,present' ||
    evidence.present !== true ||
    evidence.digest !==
      createHash('sha256').update(committedRotationCandidate).digest('hex')
  ) {
    throw new Error(
      'Real rollback process did not rematerialize the committed secret digest.'
    )
  }
}

function captureBoundedChildOutput(child, maxBytes = 4 * 1024 * 1024) {
  const capture = {
    bytes: 0,
    exceeded: false,
    stdout: [],
    stderr: [],
  }
  const collect = (target) => (chunk) => {
    capture.bytes += chunk.length
    if (capture.bytes > maxBytes) {
      capture.exceeded = true
      child.kill('SIGKILL')
      return
    }
    capture[target].push(Buffer.from(chunk))
  }
  child.stdout.on('data', collect('stdout'))
  child.stderr.on('data', collect('stderr'))
  return capture
}

function publishSafeChildOutput(capture) {
  if (capture.exceeded) {
    throw new Error('Cypress output exceeded its safe evidence bound.')
  }
  const stdout = Buffer.concat(capture.stdout)
  const stderr = Buffer.concat(capture.stderr)
  const combined = `${stdout.toString('utf8')}\n${stderr.toString('utf8')}`
  if (forbiddenAuditMaterial.some((value) => combined.includes(value))) {
    throw new Error('Cypress output retained private rollback material.')
  }
  if (stdout.length > 0) process.stdout.write(stdout)
  if (stderr.length > 0) process.stderr.write(stderr)
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
    SERVICE_LASSO_TEST_ROTATION_PROXY_LIFECYCLE: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
})
const rotationProxyLifecycleEvents = []
let stderrBytes = 0
let stderrBuffer = ''
let stderrEvidence = ''
runner.stderr.on('data', (chunk) => {
  stderrBytes = Math.min(1_048_577, stderrBytes + chunk.length)
  if (stderrEvidence.length <= 1_048_576) {
    stderrEvidence += chunk.toString('utf8')
  }
  if (stderrBuffer.length > 65_536) return
  stderrBuffer += chunk.toString('utf8')
  const lines = stderrBuffer.split(/\r?\n/)
  stderrBuffer = lines.pop() ?? ''
  for (const line of lines) {
    const lifecycleEvent = parseRotationProxyLifecycleDiagnostic(line)
    if (lifecycleEvent && rotationProxyLifecycleEvents.length < 16) {
      rotationProxyLifecycleEvents.push(lifecycleEvent)
    }
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
let cypressOutput
let cypressOutputChecked = false
let cypressSucceeded = false
let qualificationFailureKind
const qualificationProgressEvents = []
let runFailure
let auditEventCount = 0
let rollbackProcessVerified = false
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
      `testControlUrl=${controlUrl.origin}${controlUrl.pathname},qualificationPlatform=${ready.platform},qualificationProgress=1`,
      '--spec',
      specPath,
    ],
    {
      cwd: root,
      env: cypressEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  cypressOutput = captureBoundedChildOutput(cypress)
  captureQualificationProgress(cypress, qualificationProgressEvents)
  let cypressExit
  try {
    cypressExit = await waitForExit(cypress, cypressQualificationTimeoutMs)
  } catch (error) {
    qualificationFailureKind = classifyQualificationFailure({ timedOut: true })
    throw error
  }
  cypressOutputChecked = true
  publishSafeChildOutput(cypressOutput)
  if (cypressExit !== 0) {
    qualificationFailureKind = classifyQualificationFailure({
      exitCode: cypressExit,
    })
    throw new Error(`Real Broker browser qualification failed (${cypressExit}).`)
  }
  cypressSucceeded = true
  if (qualificationMode === 'comprehensive') {
    await verifyRollbackProcessEvidence(path.resolve(ready.tempRoot))
    rollbackProcessVerified = true
  }
  auditEventCount = await verifyBrokerAudit(path.resolve(ready.tempRoot))
} catch (error) {
  runFailure = error
} finally {
  if (cypress?.exitCode === null) {
    cypress.kill('SIGKILL')
    await waitForExit(cypress, 10_000).catch(() => undefined)
  }
  if (cypressOutput && !cypressOutputChecked) {
    try {
      cypressOutputChecked = true
      publishSafeChildOutput(cypressOutput)
    } catch (error) {
      runFailure = error
    }
  }
  if (ready?.tempRoot) {
    try {
      await verifyNoLeakEvidence(
        path.resolve(ready.tempRoot),
        stderrEvidence,
        { requireComplete: cypressSucceeded }
      )
    } catch (error) {
      runFailure = error
    }
  }
  if (stderrBytes > 1_048_576) {
    runFailure = new Error(
      'Real browser runtime diagnostic output exceeded its bound.'
    )
  }
  if (qualificationFailureKind && ready) {
    const adminReachability = await probeAdminReachability(
      new URL(ready.adminUrl).origin
    )
    process.stderr.write(
      `${JSON.stringify(
        buildQualificationFailureDiagnostic({
          failure: qualificationFailureKind,
          progressEvents: qualificationProgressEvents,
          transportDiagnostic: buildTransportDiagnostic(
            rotationProxyLifecycleEvents,
            adminReachability
          ),
        })
      )}\n`
    )
  }
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

if (runFailure) throw runFailure

function cypressEnvironment() {
  const environment = { ...process.env }
  // Electron launchers interpret this machine-level developer override and
  // become plain Node processes, which disables Cypress's browser protocol.
  delete environment.ELECTRON_RUN_AS_NODE
  return environment
}

function captureQualificationProgress(child, target) {
  let buffer = ''
  child.stderr.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    if (buffer.length > 256) buffer = ''
    for (const line of lines) {
      const event = parseQualificationProgressDiagnostic(line)
      if (event && target.length < qualificationProgressPhases.length) {
        target.push(event)
      }
    }
  })
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
    rollbackProcessVerified,
  })}\n`
)
