import { waitForCapturedChildClose } from './captured-child-close.mjs'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  hasClosedOwnedProcessCustody,
  parseOwnedProcessCustody,
} from './qualification-owned-process-custody.mjs'
import {
  buildTransportDiagnostic,
  parseRotationProxyLifecycleDiagnostic,
  probeAdminReachability,
} from './real-browser-transport-diagnostics.mjs'
import {
  cypressQualificationTimeoutMs,
  parseProviderUiConvergenceEvidence,
  providerReadinessDiagnosticEventCap,
} from './real-browser-qualification-budget.mjs'
import {
  buildQualificationFailureDiagnostic,
  classifyQualificationFailure,
  parseCypressRunSummaryDiagnostic,
  parseCypressChildProvenance,
  parseLockedWrapperUiDiagnostic,
  parseQualificationProgressDiagnostic,
  parseRotationRehydrationDiagnostic,
  parseTrustedUnlockDiagnosticLine,
  qualificationProgressPhases,
} from './real-browser-qualification-progress.mjs'
import {
  readQualificationCustody,
  requiredRuntimePaths,
  sha256File,
  sha256Receipt,
  writeQualificationCustody,
} from './qualification-custody.mjs'
import {
  brokerAuditPath,
  noLeakEvidenceRoots,
  parseRuntimeInputs,
  rollbackProcessEvidencePath,
} from './real-browser-runtime-inputs.mjs'

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
const qualificationMode = ['first-run', 'lockout', 'stopped-lifecycle'].includes(
  process.env.SERVICE_LASSO_REAL_BROWSER_MODE
)
  ? process.env.SERVICE_LASSO_REAL_BROWSER_MODE
  : 'comprehensive'
const trustedUnlockRealProviderControl =
  process.env.SERVICE_LASSO_TRUSTED_UNLOCK_REAL_PROVIDER_CONTROL === '1'
const custodyReceiptPath = requiredPath(
  'SERVICE_LASSO_QUALIFICATION_CUSTODY_RECEIPT_PATH'
)
const initialCustodyReceiptPath = requiredPath(
  'SERVICE_LASSO_QUALIFICATION_CUSTODY_INITIAL_RECEIPT_PATH'
)
const ownedProcessEventsPath = requiredPath(
  'SERVICE_LASSO_QUALIFICATION_OWNED_PROCESS_EVENTS_PATH'
)
requiredRuntimePaths()
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
      : qualificationMode === 'stopped-lifecycle'
        ? 'real-stopped-lifecycle.cy.js'
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
          if (value.contractVersion === 'service-lasso.real-admin-browser.v2') {
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

async function verifyBrokerAudit(runtimeInputs) {
  const auditPath = brokerAuditPath(runtimeInputs)
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
      : ['first-run', 'stopped-lifecycle'].includes(qualificationMode)
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
  runtimeInputs,
  runtimeDiagnostics,
  { requireComplete = false } = {}
) {
  const evidenceRoots = noLeakEvidenceRoots(runtimeInputs, qualificationMode)
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

async function verifyRollbackProcessEvidence(runtimeInputs) {
  const evidencePath = rollbackProcessEvidencePath(runtimeInputs)
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
const initialCustody = await readQualificationCustody(initialCustodyReceiptPath)
const initialCustodyHash = await sha256Receipt(initialCustodyReceiptPath)
const custodyOwners = []
function retainOwnedProcess(role, child, sourceSha256) {
  const pid = Number.isInteger(child.pid) && child.pid > 0 ? child.pid : null
  let born = false
  if (pid !== null) {
    try {
      process.kill(pid, 0)
      born = true
    } catch {}
  }
  const owner = {
    role,
    parent: 'verifier',
    pid,
    sourceSha256,
    birth: born ? 'observed' : 'unverified',
    close: 'pending',
    exitCode: 'unavailable',
    signal: 'unavailable',
  }
  custodyOwners.push(owner)
  child.once('close', (exitCode, signal) => {
    owner.close = 'observed'
    owner.exitCode = Number.isInteger(exitCode) && exitCode >= 0 ? exitCode : null
    owner.signal =
      signal === null || ['SIGINT', 'SIGTERM'].includes(signal)
        ? signal
        : 'other'
  })
  return owner
}

async function readOwnedProcessCustody(eventPath, expected) {
  let bytes
  try {
    bytes = await readFile(eventPath)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  return parseOwnedProcessCustody(bytes, expected)
}

const ownedSourceHashes = {
  brokerBinary: await sha256File(brokerBinary),
  coreRunner: await sha256File(runnerPath),
  adminRuntime: await sha256File(path.join(adminRoot, 'runtime', 'server.js')),
  cypressLauncher: await sha256File(cypressBin),
}
const nestedExpectedSources = {
  broker_binary: {
    sourceSha256: ownedSourceHashes.brokerBinary,
    executableSha256: ownedSourceHashes.brokerBinary,
  },
  admin_runtime: {
    sourceSha256: ownedSourceHashes.adminRuntime,
    executableSha256: await sha256File(process.execPath),
  },
}
const ownedProcessObserver = path.join(
  root,
  'scripts',
  'qualification-owned-process-observer.cjs'
)

const runner = spawn(process.execPath, [runnerPath], {
  cwd: coreRoot,
  env: {
    ...process.env,
    SERVICE_LASSO_TEST_BROKER_BINARY: brokerBinary,
    SERVICE_LASSO_TEST_ADMIN_ROOT: adminRoot,
    SERVICE_LASSO_TEST_ROTATION_PROXY_LIFECYCLE: '1',
    SERVICE_LASSO_QUALIFICATION_OWNED_PROCESS_EVENTS_PATH: ownedProcessEventsPath,
    SERVICE_LASSO_QUALIFICATION_BROKER_SHA256: ownedSourceHashes.brokerBinary,
    SERVICE_LASSO_QUALIFICATION_ADMIN_RUNTIME_SHA256: ownedSourceHashes.adminRuntime,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require=${ownedProcessObserver}`.trim(),
  },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
})
retainOwnedProcess('core_runner', runner, ownedSourceHashes.coreRunner)
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
let runtimeInputs
let cypress
let cypressOutput
let cypressOutputChecked = false
let cypressSucceeded = false
let qualificationFailureKind
const qualificationProgressEvents = []
const cypressChildEvents = []
const cypressRunSummaryEvents = []
const providerUiConvergenceEvents = []
const rotationRehydrationEvents = []
const lockedWrapperUiEvents = []
const trustedUnlockDiagnostics = []
let runFailure
let auditEventCount = 0
let rollbackProcessVerified = false
let finalQualificationFailureDiagnostic
try {
  ready = await waitForReady(runner)
  if (!['darwin', 'linux', 'win32'].includes(ready.platform)) {
    throw new Error('Real browser runtime returned an invalid platform.')
  }
  runtimeInputs = parseRuntimeInputs(ready)
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
      '--require',
      path.join(root, 'scripts', 'cypress-child-exit-preload.cjs'),
      cypressBin,
      'run',
      '--browser',
      'electron',
      '--config',
      `baseUrl=${adminUrl.origin},video=false,screenshotOnRunFailure=false`,
      '--env',
      `testControlUrl=${controlUrl.origin}${controlUrl.pathname},qualificationPlatform=${ready.platform},qualificationProgress=1${
        trustedUnlockRealProviderControl
          ? ',trustedUnlockRealProviderControlFailure=1'
          : ''
      }`,
      '--spec',
      specPath,
    ],
    {
      cwd: root,
      env: cypressEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  retainOwnedProcess('cypress', cypress, ownedSourceHashes.cypressLauncher)
  cypressOutput = captureBoundedChildOutput(cypress)
  captureQualificationProgress(
    cypress,
    qualificationProgressEvents,
    providerUiConvergenceEvents,
    rotationRehydrationEvents,
    lockedWrapperUiEvents,
    trustedUnlockDiagnostics
  )
  captureCypressRunSummary(cypress, cypressRunSummaryEvents)
  captureCypressChildProvenance(cypress, cypressChildEvents)
  let cypressExit
  try {
    cypressExit = await waitForCapturedChildClose(
      cypress,
      cypressQualificationTimeoutMs
    )
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
    if (!trustedUnlockRealProviderControl) {
      throw new Error(`Real Broker browser qualification failed (${cypressExit}).`)
    }
  } else if (trustedUnlockRealProviderControl) {
    throw new Error(
      'Controlled real provider-validation receipt path unexpectedly passed.'
    )
  }
  cypressSucceeded = !trustedUnlockRealProviderControl
  if (qualificationMode === 'comprehensive' && cypressSucceeded) {
    await verifyRollbackProcessEvidence(runtimeInputs)
    rollbackProcessVerified = true
  }
  if (cypressSucceeded) {
    auditEventCount = await verifyBrokerAudit(runtimeInputs)
  }
} catch (error) {
  runFailure = error
} finally {
  if (cypress?.exitCode === null) {
    runFailure = new Error('Cypress did not close at its qualification deadline.')
  }
  if (cypressOutput && !cypressOutputChecked) {
    try {
      cypressOutputChecked = true
      publishSafeChildOutput(cypressOutput)
    } catch (error) {
      runFailure = error
    }
  }
  if (runtimeInputs) {
    try {
      await verifyNoLeakEvidence(
        runtimeInputs,
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
    finalQualificationFailureDiagnostic = buildQualificationFailureDiagnostic({
      failure: qualificationFailureKind,
      progressEvents: qualificationProgressEvents,
      cypressChildEvents,
      cypressRunSummary: cypressRunSummaryEvents.at(-1),
      providerUiDiagnostic: providerUiConvergenceEvents.at(-1),
      lockedWrapperUiDiagnostic: lockedWrapperUiEvents.at(-1),
      trustedUnlockDiagnostic: trustedUnlockDiagnostics.at(-1),
      rotationRehydrationDiagnostic: rotationRehydrationEvents.at(-1),
      transportDiagnostic: buildTransportDiagnostic(
        rotationProxyLifecycleEvents,
        adminReachability
      ),
    })
    process.stderr.write(`${JSON.stringify(finalQualificationFailureDiagnostic)}\n`)
  }
  if (runner.exitCode === null) {
    runner.send({ type: 'service-lasso-real-admin-shutdown' })
    try {
      await waitForCapturedChildClose(runner, 180_000)
    } catch {
      runFailure = new Error('Owned Core browser runner did not close after shutdown.')
    }
  }
  if (ready?.tempRoot) {
    try {
      await waitForRemoved(path.resolve(ready.tempRoot))
    } catch (error) {
      runFailure = error
    }
  }
}

const sourceHashes = ownedSourceHashes
let nestedOwners = []
try {
  nestedOwners = await readOwnedProcessCustody(
    ownedProcessEventsPath,
    nestedExpectedSources
  )
} catch (error) {
  runFailure = error
}
const nestedClosureVerified = hasClosedOwnedProcessCustody(nestedOwners)
const closureVerified =
  runFailure === undefined &&
  cypressOutput?.exceeded !== true &&
  nestedClosureVerified &&
  custodyOwners.length === 2 &&
  custodyOwners.every(
    (owner) =>
      owner.birth === 'observed' &&
      owner.close === 'observed' &&
      Number.isInteger(owner.exitCode) &&
      owner.exitCode >= 0 &&
      owner.signal === null &&
      /^[a-f0-9]{64}$/.test(owner.sourceSha256)
  )
const publicOwnerSummary = [
  ...custodyOwners.map(({ role, birth, close, exitCode, signal }) => ({
    role,
    birth,
    close,
    exitCode,
    signal,
  })),
  ...nestedOwners
    .filter((record) => record.event === 'close')
    .map(({ role, exitCode, signal }) => ({
      role,
      birth: 'observed',
      close: 'observed',
      exitCode,
      signal,
    })),
]
const controlledReceipt = finalQualificationFailureDiagnostic?.trustedUnlock
const controlledCausal = controlledReceipt?.causal
const controlledObserved =
  finalQualificationFailureDiagnostic?.lastPhase === 'provider_validation_complete' &&
  controlledReceipt?.receipt?.schema === 'service-admin.trusted-unlock-receipt.v1' &&
  controlledReceipt.receipt.status === 'observed' &&
  controlledReceipt.receipt.present === true &&
  controlledReceipt.receipt.verified === false &&
  controlledReceipt.receipt.localRoot === false &&
  controlledReceipt.receipt.loading === false &&
  controlledReceipt.receipt.unavailable === true &&
  controlledCausal?.schema === 'service-admin.trusted-identity-causal.v2' &&
  Number.isInteger(controlledCausal.sequence) &&
  controlledCausal.sequence >= 1 &&
  controlledCausal.request === 'transport_failed' &&
  controlledCausal.contract === 'unobserved' &&
  controlledCausal.query === 'failed' &&
  controlledCausal.render === 'unavailable' &&
  finalQualificationFailureDiagnostic?.cypressRunSummary?.state === 'complete' &&
  finalQualificationFailureDiagnostic.cypressRunSummary.totalFailed === 1 &&
  finalQualificationFailureDiagnostic.failure === 'nonzero_exit' &&
  closureVerified
await writeQualificationCustody(custodyReceiptPath, {
  schema: initialCustody.schema,
  state: 'closed',
  mode: trustedUnlockRealProviderControl ? 'controlled_negative' : 'positive',
  outcome: trustedUnlockRealProviderControl
    ? controlledObserved
      ? 'controlled_failure_observed'
      : 'controlled_failure_unverified'
    : cypressSucceeded
      ? 'positive_verified'
      : 'positive_unverified',
  causal: trustedUnlockRealProviderControl
    ? controlledObserved
      ? 'provider_validation_transport_failure'
      : 'unverified'
    : 'not_applicable',
  runtimePathHashes: initialCustody.runtimePathHashes,
  initialReceiptSha256: initialCustodyHash,
  sourceHashes,
  sourceBindings: [
    { role: 'core_runner', owner: 'core_runner', sha256: sourceHashes.coreRunner },
    { role: 'cypress_launcher', owner: 'cypress', sha256: sourceHashes.cypressLauncher },
    { role: 'broker_binary', owner: 'core_runner', sha256: sourceHashes.brokerBinary },
    { role: 'admin_runtime', owner: 'core_runner', sha256: sourceHashes.adminRuntime },
  ],
  // PID, parent PID, nonce, executable identity, and the raw sidecar stay in
  // the private runner.  The retained receipt exposes only typed completion.
  owners: publicOwnerSummary,
})

if (trustedUnlockRealProviderControl) {
  if (!controlledObserved) {
    throw new Error(
      'Controlled real provider-validation receipt did not reach the closed final Node failure sink.'
    )
  }
}

if (runFailure) throw runFailure

function cypressEnvironment() {
  const environment = { ...process.env }
  // Electron launchers interpret this machine-level developer override and
  // become plain Node processes, which disables Cypress's browser protocol.
  delete environment.ELECTRON_RUN_AS_NODE
  return environment
}

function captureQualificationProgress(
  child,
  target,
  providerUiTarget,
  rotationRehydrationTarget,
  lockedWrapperUiTarget,
  trustedUnlockTarget
) {
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
      const providerUiEvent = parseProviderUiConvergenceEvidence(line)
      if (
        providerUiEvent &&
        providerUiTarget.length < providerReadinessDiagnosticEventCap
      ) {
        providerUiTarget.push(providerUiEvent)
      }
      const rotationRehydration = parseRotationRehydrationDiagnostic(line)
      if (rotationRehydration && rotationRehydrationTarget.length < 1) {
        rotationRehydrationTarget.push(rotationRehydration)
      }
      const lockedWrapperUiEvent = parseLockedWrapperUiDiagnostic(line)
      if (lockedWrapperUiEvent && lockedWrapperUiTarget.length < 1) {
        lockedWrapperUiTarget.push(lockedWrapperUiEvent)
      }
      const trustedUnlockDiagnostic = parseTrustedUnlockDiagnosticLine(line)
      if (trustedUnlockDiagnostic && trustedUnlockTarget.length < 1) {
        trustedUnlockTarget.push(trustedUnlockDiagnostic)
      }
    }
  })
}

function captureCypressChildProvenance(child, target) {
  let buffer = ''
  child.stderr.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    if (buffer.length > 256) buffer = ''
    for (const line of lines) {
      const event = parseCypressChildProvenance(line)
      if (event && target.length < 16) target.push(event)
    }
  })
}

function captureCypressRunSummary(child, target) {
  let buffer = ''
  child.stderr.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    if (buffer.length > 256) buffer = ''
    for (const line of lines) {
      const summary = parseCypressRunSummaryDiagnostic(line)
      if (summary && target.length < 1) target.push(summary)
    }
  })
}

const qualificationResult =
  trustedUnlockRealProviderControl
    ? controlledObserved
      ? {
          schema: 'service-lasso.real-secrets-browser-controlled-result.v1',
          qualificationMode,
          outcome: 'controlled_failure_observed',
          platform,
          causalReceipt: 'closed_native_custody',
        }
      : {
          schema: 'service-lasso.real-secrets-browser-controlled-result.v1',
          qualificationMode,
          outcome: 'controlled_failure_unverified',
          platform,
          causalReceipt: 'closure_unverified',
        }
    : cypressSucceeded && closureVerified
      ? {
          schema: 'service-lasso.real-secrets-browser-result.v1',
          qualificationMode,
          outcome: 'verified',
          platform,
          coreRevision: process.env.SERVICE_LASSO_TEST_CORE_REVISION ?? 'local',
          brokerRevision: process.env.SERVICE_LASSO_TEST_BROKER_REVISION ?? 'local',
          brokerSha256: sourceHashes.brokerBinary,
          adminArtifact: path.basename(adminRoot),
          auditEventCount,
          rollbackProcessVerified,
        }
      : {
          schema: 'service-lasso.real-secrets-browser-result.v1',
          qualificationMode,
          outcome: 'unverified',
          platform,
        }
process.stdout.write(
  `${JSON.stringify(
    qualificationResult
  )}\n`
)
