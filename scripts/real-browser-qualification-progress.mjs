import { providerReadinessDiagnosticMaxAttempts } from './real-browser-qualification-budget.mjs'

const progressSchema = 'service-admin.real-browser-progress.v1'
const failureSchema = 'service-admin.real-browser-qualification-diagnostic.v1'
const cypressChildSchema = 'service-admin.cypress-child-exit.v1'
const rotationRehydrationSchema =
  'service-admin.rotation-rehydration-response.v1'
const cypressChildErrorCodes = new Set([
  'EACCES',
  'EAGAIN',
  'EMFILE',
  'ENFILE',
  'ENOENT',
  'ENOMEM',
  'EPERM',
  'UNKNOWN',
])

export const qualificationProgressPhases = Object.freeze([
  'lifecycle_started',
  'committed_rotation_complete',
  'rollback_fixture_armed',
  'rollback_rotation_complete',
  'metadata_ready',
  'rollback_rehydrated',
  'provider_validation_complete',
  'broker_restart_rehydrated',
  'wrapper_locked',
  'wrapper_recovery_complete',
  'acceptance_complete',
])

export const stoppedLifecycleQualificationProgressPhases = Object.freeze([
  'stopped_lifecycle_started',
  'stopped_broker_stopped',
  'stopped_inventory_unavailable',
  'stopped_broker_recovered',
  'stopped_lifecycle_complete',
])

const allQualificationProgressPhases = new Set([
  ...qualificationProgressPhases,
  ...stoppedLifecycleQualificationProgressPhases,
])
const providerCheckpoints = new Set([
  'single_migration',
  'single_migration_apply',
  'policy_denied_migration_apply',
  'unavailable_migration',
  'unavailable_migration_apply',
  'bulk_migration',
  'post_rotation',
])
const providerComponents = new Set(['response_metadata', 'row_render'])
const rotationRehydrationTransports = new Set([
  'response_received',
  'response_absent',
])

function safeRotationRehydrationDiagnostic(value) {
  if (
    !rotationRehydrationTransports.has(value?.transport) ||
    typeof value?.responsePresent !== 'boolean' ||
    (value.responsePresent && value.transport !== 'response_received') ||
    (!value.responsePresent && value.transport !== 'response_absent') ||
    (value.responsePresent &&
      !(
        Number.isInteger(value?.statusCode) &&
        value.statusCode >= 100 &&
        value.statusCode <= 599
      )) ||
    (!value.responsePresent && value?.statusCode !== 'unavailable')
  ) {
    return null
  }
  return {
    responsePresent: value.responsePresent,
    statusCode: value.statusCode,
    transport: value.transport,
  }
}

export function parseRotationRehydrationDiagnostic(line) {
  if (typeof line !== 'string' || line.length > 256) return null
  let value
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (
    value?.schema !== rotationRehydrationSchema ||
    Object.keys(value).sort().join(',') !==
      'responsePresent,schema,statusCode,transport'
  ) {
    return null
  }
  return safeRotationRehydrationDiagnostic(value)
}

export function createRotationRehydrationRecorder({
  enabled = false,
  write = () => undefined,
} = {}) {
  let active = false
  let recorded = false
  return {
    setSpecPath(specPath) {
      active =
        enabled === true &&
        /cypress[\\/]e2e[\\/]secrets-broker[\\/]real-lifecycle\.cy\.js$/.test(
          typeof specPath === 'string' ? specPath : ''
        )
      recorded = false
    },
    record(diagnostic) {
      if (!active || recorded) return null
      const safeDiagnostic = safeRotationRehydrationDiagnostic(diagnostic)
      if (!safeDiagnostic) {
        throw new Error('Rotation rehydration diagnostic is invalid.')
      }
      write(
        JSON.stringify({
          schema: rotationRehydrationSchema,
          ...safeDiagnostic,
        }) + '\n'
      )
      recorded = true
      return safeDiagnostic
    },
  }
}

export function parseQualificationProgressDiagnostic(line) {
  if (typeof line !== 'string' || line.length > 256) return null
  let value
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (
    value?.schema !== progressSchema ||
    !allQualificationProgressPhases.has(value.phase) ||
    !Number.isInteger(value.elapsedMs) ||
    value.elapsedMs < 0 ||
    value.elapsedMs > 24 * 60 * 60_000
  ) {
    return null
  }
  const keys = Object.keys(value)
  if (!keys.every((key) => ['schema', 'phase', 'elapsedMs'].includes(key))) {
    return null
  }
  return { phase: value.phase, elapsedMs: value.elapsedMs }
}

export function parseCypressChildProvenance(line) {
  if (typeof line !== 'string' || line.length > 256) return null
  let value
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (
    value?.schema !== cypressChildSchema ||
    !['smoke_test', 'run'].includes(value.phase) ||
    !['spawn', 'spawn_throw', 'error', 'exit', 'close'].includes(value.event)
  ) {
    return null
  }
  if (value.event === 'spawn') {
    if (Object.keys(value).sort().join(',') !== 'event,phase,schema') return null
    return { phase: value.phase, event: value.event }
  }
  if (['spawn_throw', 'error'].includes(value.event)) {
    if (
      Object.keys(value).sort().join(',') !== 'errorCode,event,phase,schema' ||
      (value.errorCode !== 'unavailable' &&
        !cypressChildErrorCodes.has(value.errorCode))
    ) {
      return null
    }
    return {
      phase: value.phase,
      event: value.event,
      errorCode: value.errorCode,
    }
  }
  if (
    Object.keys(value).sort().join(',') !== 'event,exitCode,phase,schema,signal' ||
    !(
      value.exitCode === null ||
      value.exitCode === 'unavailable' ||
      (Number.isInteger(value.exitCode) &&
        value.exitCode >= 0 &&
        value.exitCode <= 255)
    ) ||
    ![null, 'SIGINT', 'SIGTERM', 'SIGKILL', 'other'].includes(value.signal)
  ) {
    return null
  }
  return {
    phase: value.phase,
    event: value.event,
    exitCode: value.exitCode,
    signal: value.signal,
  }
}

export function createQualificationProgressRecorder({
  enabled = false,
  write = () => undefined,
  now = () => Date.now(),
  maxEvents = qualificationProgressPhases.length,
} = {}) {
  if (
    !Number.isInteger(maxEvents) ||
    maxEvents < 1 ||
    maxEvents > qualificationProgressPhases.length
  ) {
    throw new Error('Qualification progress event cap is invalid.')
  }
  let active = false
  let activePhases = qualificationProgressPhases
  let startedAt = 0
  let lastIndex = -1
  let emitted = 0

  return {
    setSpecPath(specPath) {
      const normalizedSpecPath = typeof specPath === 'string' ? specPath : ''
      if (
        /cypress[\\/]e2e[\\/]secrets-broker[\\/]real-lifecycle\.cy\.js$/.test(
          normalizedSpecPath
        )
      ) {
        activePhases = qualificationProgressPhases
      } else if (
        /cypress[\\/]e2e[\\/]secrets-broker[\\/]real-stopped-lifecycle\.cy\.js$/.test(
          normalizedSpecPath
        )
      ) {
        activePhases = stoppedLifecycleQualificationProgressPhases
      } else {
        activePhases = []
      }
      active = enabled === true && activePhases.length > 0
      startedAt = active ? now() : 0
      lastIndex = -1
      emitted = 0
    },
    record(phase) {
      if (!active || emitted >= Math.min(maxEvents, activePhases.length)) {
        return null
      }
      const nextIndex = activePhases.indexOf(phase)
      if (nextIndex < 0 || nextIndex <= lastIndex) {
        throw new Error(
          'Qualification progress phase was invalid or out of order.'
        )
      }
      const evidence = {
        schema: progressSchema,
        phase,
        elapsedMs: Math.max(0, Math.trunc(now() - startedAt)),
      }
      write(`${JSON.stringify(evidence)}\n`)
      lastIndex = nextIndex
      emitted += 1
      return { phase: evidence.phase, elapsedMs: evidence.elapsedMs }
    },
  }
}

export function buildQualificationFailureDiagnostic({
  failure,
  progressEvents = [],
  cypressChildEvents = [],
  providerUiDiagnostic,
  rotationRehydrationDiagnostic,
  transportDiagnostic,
}) {
  if (!['timeout', 'nonzero_exit'].includes(failure)) {
    throw new Error('Qualification failure kind is invalid.')
  }
  const boundedProgress = progressEvents
    .slice(0, qualificationProgressPhases.length)
    .filter(
      (event) =>
        allQualificationProgressPhases.has(event?.phase) &&
        Number.isInteger(event?.elapsedMs) &&
        event.elapsedMs >= 0
    )
  const lastProgress = boundedProgress.at(-1)
  const boundedCypressChildEvents = cypressChildEvents
    .slice(0, 16)
    .filter((event) => {
      const serialized = JSON.stringify({ schema: cypressChildSchema, ...event })
      return parseCypressChildProvenance(serialized) !== null
    })
  const safeProviderUiDiagnostic =
    providerCheckpoints.has(providerUiDiagnostic?.checkpoint) &&
    providerComponents.has(providerUiDiagnostic?.component) &&
    Number.isInteger(providerUiDiagnostic?.attempt) &&
    providerUiDiagnostic.attempt >= 1 &&
    providerUiDiagnostic.attempt <= providerReadinessDiagnosticMaxAttempts &&
    (providerUiDiagnostic.statusCode === 'unavailable' ||
      (Number.isInteger(providerUiDiagnostic.statusCode) &&
        providerUiDiagnostic.statusCode >= 100 &&
        providerUiDiagnostic.statusCode <= 599)) &&
    [
      'broker_unavailable',
      'secrets_broker_not_ready',
      'security_not_configured',
      'unknown',
    ].includes(providerUiDiagnostic.errorCode) &&
    (providerUiDiagnostic.serviceRunning === 'unavailable' ||
      typeof providerUiDiagnostic.serviceRunning === 'boolean') &&
    (providerUiDiagnostic.serviceHealthy === 'unavailable' ||
      typeof providerUiDiagnostic.serviceHealthy === 'boolean')
      ? {
          checkpoint: providerUiDiagnostic.checkpoint,
          component: providerUiDiagnostic.component,
          attempt: providerUiDiagnostic.attempt,
          statusCode: providerUiDiagnostic.statusCode,
          errorCode: providerUiDiagnostic.errorCode,
          serviceRunning: providerUiDiagnostic.serviceRunning,
          serviceHealthy: providerUiDiagnostic.serviceHealthy,
        }
      : null
  const safeRotationRehydration =
    safeRotationRehydrationDiagnostic(rotationRehydrationDiagnostic)
  return {
    schema: failureSchema,
    failure,
    lastPhase: lastProgress?.phase ?? 'not_started',
    elapsedMs: lastProgress?.elapsedMs ?? 0,
    cypressChildEvents: boundedCypressChildEvents,
    transportPhases: Array.isArray(transportDiagnostic?.phases)
      ? transportDiagnostic.phases.slice(0, 16)
      : [],
    statuses: Array.isArray(transportDiagnostic?.statuses)
      ? transportDiagnostic.statuses.slice(0, 16)
      : [],
    adminReachability:
      transportDiagnostic?.adminReachability === 'reachable'
        ? 'reachable'
        : 'unreachable',
    rotationRehydration: safeRotationRehydration,
    providerUi: safeProviderUiDiagnostic,
  }
}

export function classifyQualificationFailure(options = {}) {
  const { timedOut = false, exitCode } = options
  if (timedOut) return 'timeout'
  if (
    Object.prototype.hasOwnProperty.call(options, 'exitCode') &&
    exitCode !== 0
  ) {
    return 'nonzero_exit'
  }
  return null
}
