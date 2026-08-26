export const cypressQualificationTimeoutMs = 12 * 60_000
export const linkedRotationExecuteCount = 2
export const linkedRotationResponseTimeoutMs = 120_000
export const brokerMetadataReadinessAttempts = 5
export const brokerMetadataRequestTimeoutMs = 10_000
export const brokerMetadataRetryDelayMs = 1_000
export const brokerMetadataEndpointCount = 2
export const brokerMetadataReservedLifecycleMs = 6 * 60_000
export const managedServiceStopReadinessAttempts = 5
export const managedServiceStopRequestTimeoutMs = 10_000
export const managedServiceStopRetryDelayMs = 1_000
export const providerUiConvergenceAttempts = 3
export const providerReadinessAttempts = 3
export const providerReadinessRequestTimeoutMs = 8_000
export const providerReadinessRetryDelayMs = 1_000
export const providerReadinessCheckpointCount = 4
export const providerReadinessCallCount = 8
export const providerFinalLifecycleDiagnosticCount = 1
export const providerFinalLifecycleDiagnosticTimeoutMs = 5_000
export const providerReadinessDiagnosticEventCap = 64
export const providerReadinessOtherLifecycleReserveMs = 144_000

const providerUiConvergenceSchema = 'service-admin.provider-ui-convergence.v1'

const providerUiConvergenceCheckpoints = new Set([
  'single_migration',
  'unavailable_migration',
  'bulk_migration',
  'post_rotation',
])
const providerUiConvergenceComponents = new Set([
  'response_metadata',
  'row_render',
])
const providerUiConvergenceErrorCodes = new Set([
  'secrets_broker_not_ready',
  'security_not_configured',
  'unknown',
])

export function brokerMetadataRequestOptions(url) {
  return {
    method: 'GET',
    url,
    failOnStatusCode: false,
    retryOnNetworkFailure: false,
    timeout: brokerMetadataRequestTimeoutMs,
  }
}

export function managedServiceStopRequestOptions(url) {
  return {
    method: 'GET',
    url,
    failOnStatusCode: false,
    retryOnNetworkFailure: false,
    timeout: managedServiceStopRequestTimeoutMs,
  }
}

export function isManagedServiceStoppedResponse({ status, body }) {
  return status === 200 && body?.service?.lifecycle?.running === false
}

export function providerUiConvergenceDiagnostic({
  checkpoint,
  component,
  attempt,
  statusCode,
  errorCode,
  serviceRunning,
  serviceHealthy,
}) {
  const safe = normalizeProviderUiConvergenceEvidence({
    checkpoint,
    component,
    attempt,
    statusCode,
    errorCode,
    serviceRunning,
    serviceHealthy,
  })
  return `checkpoint=${safe.checkpoint}, component=${safe.component}, attempt=${safe.attempt}, status=${safe.statusCode}, errorCode=${safe.errorCode}, serviceRunning=${safe.serviceRunning}, serviceHealthy=${safe.serviceHealthy}`
}

function normalizeProviderUiConvergenceEvidence({
  checkpoint,
  component,
  attempt,
  statusCode,
  errorCode,
  serviceRunning,
  serviceHealthy,
} = {}) {
  const safeCheckpoint = providerUiConvergenceCheckpoints.has(checkpoint)
    ? checkpoint
    : 'unknown'
  const safeComponent = providerUiConvergenceComponents.has(component)
    ? component
    : 'unknown'
  const safeAttempt = Number.isInteger(attempt)
    ? Math.min(providerReadinessAttempts, Math.max(1, attempt))
    : providerReadinessAttempts
  const safeStatusCode =
    Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599
      ? statusCode
      : 'unavailable'
  const safeErrorCode = providerUiConvergenceErrorCodes.has(errorCode)
    ? errorCode
    : 'unknown'
  const safeServiceRunning =
    typeof serviceRunning === 'boolean' ? serviceRunning : 'unavailable'
  const safeServiceHealthy =
    typeof serviceHealthy === 'boolean' ? serviceHealthy : 'unavailable'
  return {
    checkpoint: safeCheckpoint,
    component: safeComponent,
    attempt: safeAttempt,
    statusCode: safeStatusCode,
    errorCode: safeErrorCode,
    serviceRunning: safeServiceRunning,
    serviceHealthy: safeServiceHealthy,
  }
}

export function providerUiConvergenceEvidence(options = {}) {
  const safe = normalizeProviderUiConvergenceEvidence(options)
  return {
    schema: providerUiConvergenceSchema,
    ...safe,
  }
}

export function parseProviderUiConvergenceEvidence(line) {
  if (typeof line !== 'string' || line.length > 256) return null
  let value
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (
    value?.schema !== providerUiConvergenceSchema ||
    !providerUiConvergenceCheckpoints.has(value.checkpoint) ||
    !providerUiConvergenceComponents.has(value.component) ||
    !Number.isInteger(value.attempt) ||
    value.attempt < 1 ||
    value.attempt > providerReadinessAttempts ||
    !(
      value.statusCode === 'unavailable' ||
      (Number.isInteger(value.statusCode) &&
        value.statusCode >= 100 &&
        value.statusCode <= 599)
    ) ||
    !providerUiConvergenceErrorCodes.has(value.errorCode) ||
    !(
      value.serviceRunning === 'unavailable' ||
      typeof value.serviceRunning === 'boolean'
    ) ||
    !(
      value.serviceHealthy === 'unavailable' ||
      typeof value.serviceHealthy === 'boolean'
    ) ||
    !Object.keys(value).every((key) =>
      [
        'schema',
        'checkpoint',
        'component',
        'attempt',
        'statusCode',
        'errorCode',
        'serviceRunning',
        'serviceHealthy',
      ].includes(key)
    )
  ) {
    return null
  }
  return {
    checkpoint: value.checkpoint,
    component: value.component,
    attempt: value.attempt,
    statusCode: value.statusCode,
    errorCode: value.errorCode,
    serviceRunning: value.serviceRunning,
    serviceHealthy: value.serviceHealthy,
  }
}

export function createProviderUiConvergenceRecorder({
  enabled = false,
  write = () => undefined,
  maxEvents = providerReadinessDiagnosticEventCap,
} = {}) {
  if (
    !Number.isInteger(maxEvents) ||
    maxEvents < 1 ||
    maxEvents > providerReadinessDiagnosticEventCap
  ) {
    throw new Error('Provider UI convergence event cap is invalid.')
  }
  let active = false
  let emitted = 0
  return {
    setSpecPath(specPath) {
      active =
        enabled === true &&
        typeof specPath === 'string' &&
        /(?:^|[\\/])cypress[\\/]e2e[\\/]secrets-broker[\\/]real-lifecycle\.cy\.js$/.test(
          specPath
        )
      emitted = 0
    },
    record(options) {
      if (!active || emitted >= maxEvents) return null
      const evidence = providerUiConvergenceEvidence(options)
      write(`${JSON.stringify(evidence)}\n`)
      emitted += 1
      return {
        checkpoint: evidence.checkpoint,
        component: evidence.component,
        attempt: evidence.attempt,
        statusCode: evidence.statusCode,
        errorCode: evidence.errorCode,
        serviceRunning: evidence.serviceRunning,
        serviceHealthy: evidence.serviceHealthy,
      }
    },
  }
}

export function providerReadinessRequestOptions(url) {
  return {
    method: 'GET',
    url,
    failOnStatusCode: false,
    retryOnNetworkFailure: false,
    retryOnStatusCodeFailure: false,
    timeout: providerReadinessRequestTimeoutMs,
  }
}

export function providerFinalLifecycleDiagnosticRequestOptions(url) {
  return {
    method: 'GET',
    url,
    failOnStatusCode: false,
    retryOnNetworkFailure: false,
    retryOnStatusCodeFailure: false,
    timeout: providerFinalLifecycleDiagnosticTimeoutMs,
  }
}

export function providerReadinessErrorCode(body) {
  const candidate =
    typeof body?.error?.code === 'string'
      ? body.error.code
      : typeof body?.code === 'string'
        ? body.code
        : 'unknown'
  return providerUiConvergenceErrorCodes.has(candidate) ? candidate : 'unknown'
}

export function providerLifecycleDiagnostic(body) {
  return {
    serviceRunning:
      typeof body?.service?.lifecycle?.running === 'boolean'
        ? body.service.lifecycle.running
        : 'unavailable',
    serviceHealthy:
      typeof body?.service?.health?.healthy === 'boolean'
        ? body.service.health.healthy
        : 'unavailable',
  }
}

export function managedServiceStopMutationRequestOptions(url) {
  return {
    method: 'POST',
    url,
    body: { confirm: true },
    failOnStatusCode: true,
    retryOnNetworkFailure: false,
    retryOnStatusCodeFailure: false,
    timeout: 120_000,
  }
}

export function managedServiceStopReadinessWorstCaseMs() {
  return (
    managedServiceStopReadinessAttempts * managedServiceStopRequestTimeoutMs +
    (managedServiceStopReadinessAttempts - 1) * managedServiceStopRetryDelayMs
  )
}

export function providerReadinessWorstCaseMs() {
  return (
    providerReadinessAttempts * providerReadinessRequestTimeoutMs +
    (providerReadinessAttempts - 1) * providerReadinessRetryDelayMs
  )
}

export function providerReadinessReservedLifecycleMs() {
  return providerReadinessCallCount * providerReadinessWorstCaseMs()
}

export function realBrowserQualificationWorstCaseMs() {
  const perEndpointMs =
    brokerMetadataReadinessAttempts * brokerMetadataRequestTimeoutMs +
    (brokerMetadataReadinessAttempts - 1) * brokerMetadataRetryDelayMs
  return (
    providerReadinessReservedLifecycleMs() +
    providerFinalLifecycleDiagnosticCount *
      providerFinalLifecycleDiagnosticTimeoutMs +
    providerReadinessOtherLifecycleReserveMs +
    linkedRotationExecuteCount * linkedRotationResponseTimeoutMs +
    brokerMetadataEndpointCount * perEndpointMs
  )
}
