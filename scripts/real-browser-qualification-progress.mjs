import { providerReadinessDiagnosticMaxAttempts } from './real-browser-qualification-budget.mjs'

const progressSchema = 'service-admin.real-browser-progress.v1'
const failureSchema = 'service-admin.real-browser-qualification-diagnostic.v1'

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

const phaseIndex = new Map(
  qualificationProgressPhases.map((phase, index) => [phase, index])
)
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
    !phaseIndex.has(value.phase) ||
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
  let startedAt = 0
  let lastIndex = -1
  let emitted = 0

  return {
    setSpecPath(specPath) {
      active =
        enabled === true &&
        typeof specPath === 'string' &&
        /(?:^|[\\/])cypress[\\/]e2e[\\/]secrets-broker[\\/]real-lifecycle\.cy\.js$/.test(
          specPath
        )
      startedAt = active ? now() : 0
      lastIndex = -1
      emitted = 0
    },
    record(phase) {
      if (!active || emitted >= maxEvents) return null
      const nextIndex = phaseIndex.get(phase)
      if (nextIndex === undefined || nextIndex <= lastIndex) {
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
  providerUiDiagnostic,
  transportDiagnostic,
}) {
  if (!['timeout', 'nonzero_exit'].includes(failure)) {
    throw new Error('Qualification failure kind is invalid.')
  }
  const boundedProgress = progressEvents
    .slice(0, qualificationProgressPhases.length)
    .filter(
      (event) =>
        phaseIndex.has(event?.phase) &&
        Number.isInteger(event?.elapsedMs) &&
        event.elapsedMs >= 0
    )
  const lastProgress = boundedProgress.at(-1)
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
  return {
    schema: failureSchema,
    failure,
    lastPhase: lastProgress?.phase ?? 'not_started',
    elapsedMs: lastProgress?.elapsedMs ?? 0,
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
