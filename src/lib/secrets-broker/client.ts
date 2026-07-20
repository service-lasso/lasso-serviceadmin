import {
  isServiceAdminStubModeEnabled,
  serviceLassoApiBaseUrl,
} from '@/lib/service-lasso-dashboard/stub'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'

export type SecretsBrokerLiveState =
  | 'ready'
  | 'loading'
  | 'unavailable'
  | 'setup-needed'
  | 'locked'
  | 'auth-required'
  | 'policy-denied'
  | 'unsupported'
  | 'degraded'
  | 'audit-unavailable'

export type SecretsBrokerSourceState =
  | 'ready'
  | 'setup-needed'
  | 'locked'
  | 'auth-required'
  | 'policy-denied'
  | 'unsupported'
  | 'degraded'
  | 'unavailable'

export type SecretsBrokerSourceStatus = {
  id: string
  label: string
  provider: string
  state: SecretsBrokerSourceState
  reason: string
  lifecycleState: string
  outcome: string
  nextAction: string
  enabled: boolean
  critical: boolean
  priority: number
  namespaces: string[]
  capabilityNames: string[]
  capabilities: Record<string, boolean>
  operations: SecretsBrokerOperationCapability[]
}

export type SecretsBrokerRouteName =
  | 'status'
  | 'state'
  | 'capabilities'
  | 'sources'
  | 'providerCapabilities'
  | 'providerConfig'
  | 'telemetry'
  | 'events'

export type SecretsBrokerRouteState =
  | 'ready'
  | 'unsupported'
  | 'denied'
  | 'unavailable'

export const secretsBrokerSupportedContractRange = '>=1.0.0 <2.0.0'

export type SecretsBrokerContractCompatibilityState =
  | 'compatible'
  | 'missing'
  | 'malformed'
  | 'unsupported'
  | 'not-applicable'

export type SecretsBrokerContractCompatibility = {
  state: SecretsBrokerContractCompatibilityState
  observedVersion: string
  supportedRange: string
  reason: string
  nextAction: string
}

export type SecretsBrokerOperationMaturity =
  | 'unavailable'
  | 'planned'
  | 'read-only'
  | 'dry-run'
  | 'executable'
  | 'validated'
  | 'unknown'

export type SecretsBrokerOperationClassification =
  | 'read'
  | 'mutation'
  | 'unknown'

export type SecretsBrokerOperationCapability = {
  operationId: string
  method: string
  path: string
  maturity: SecretsBrokerOperationMaturity
  rawMaturity: string
  classification: SecretsBrokerOperationClassification
  authenticationRequired: boolean
  policyRequired: boolean
  auditRequired: boolean
  scope: string
  providerKinds: string[]
  limitationCode: string
  reasonCode: string
  nextAction: string
  valid: boolean
}

export type SecretsBrokerOperationManifestState =
  | 'ready'
  | 'not-required'
  | 'missing'
  | 'malformed'
  | 'unsupported'
  | 'not-applicable'

export type SecretsBrokerOperationManifestCompatibility = {
  state: SecretsBrokerOperationManifestState
  observedVersion: string
  reason: string
  nextAction: string
}

export type SecretsBrokerProviderCapability = {
  providerKind: string
  displayName: string
  supported: boolean
  capabilities: string[]
  operations: SecretsBrokerOperationCapability[]
  limitations: string[]
}

export type SecretsBrokerProviderStatus = {
  providerId: string
  providerKind: string
  displayName: string
  state: string
  outcome: string
  nextAction: string
  auditStatus: string
  namespaces: string[]
  capabilities: string[]
  operations: SecretsBrokerOperationCapability[]
}

export type SecretsBrokerOverview = {
  state: SecretsBrokerLiveState
  summary: string
  service: DashboardService | null
  checkedAt: string
  sourceCount: number
  sources: SecretsBrokerSourceStatus[]
  capabilities: Record<string, boolean>
  telemetryAvailable: boolean
  auditAvailable: boolean
  apiVersion: string
  contractVersion: string
  brokerVersion: string
  brokerState: string
  outcome: string
  nextAction: string
  brokerOutcome: string
  brokerNextAction: string
  contractCompatibility: SecretsBrokerContractCompatibility
  manifestVersion: string
  operationManifest: SecretsBrokerOperationManifestCompatibility
  operations: SecretsBrokerOperationCapability[]
  endpointCapabilities: string[]
  featureCapabilities: string[]
  providerCapabilities: SecretsBrokerProviderCapability[]
  providers: SecretsBrokerProviderStatus[]
  routes: Record<SecretsBrokerRouteName, SecretsBrokerRouteState>
  stubMode: boolean
}

export type SecretsBrokerManagedSecret = {
  id: string
  ref: string
  name: string
  sourceId: string
  providerKind: string
  ownerServiceId: string
  workspaceId: string
  state: string
  outcome: string
  capabilities: string[]
  policy: string
  auditStatus: string
  valueSearch: string
}

export type SecretsBrokerManagedSecretsResult = {
  state: SecretsBrokerLiveState
  summary: string
  query: string
  valueSearch: boolean
  results: SecretsBrokerManagedSecret[]
  checkedAt: string
  stubMode: boolean
}

export type SecretsBrokerSecretDryRunAction =
  | 'edit'
  | 'reset'
  | 'delete'
  | 'policy'

export type SecretsBrokerSecretDryRunRequest = {
  action: SecretsBrokerSecretDryRunAction
  ref: string
  serviceId?: string
  reason?: string
  requestId?: string
}

export type SecretsBrokerSecretApplyRequest = {
  action: SecretsBrokerSecretDryRunAction
  ref: string
  operationId: string
  serviceId?: string
  reason: string
  requestId?: string
}

export type SecretsBrokerSecretRevealRequest = {
  ref: string
  serviceId?: string
  reason: string
  requestId?: string
}

export type SecretsBrokerSecretDryRunResult = {
  state: SecretsBrokerLiveState
  summary: string
  requestId: string
  operationId: string
  ref: string
  operation: string
  mode: string
  outcome: string
  applied: boolean
  requiresConfirmation: boolean
  auditStatus: string
  nextAction: string
  affectedRefs: string[]
  affectedServices: string[]
  lockoutActive: boolean
  retryAfterSeconds: number
  stubMode: boolean
}

export type SecretsBrokerSecretRevealResult = {
  state: SecretsBrokerLiveState
  summary: string
  requestId: string
  ref: string
  operation: string
  mode: string
  outcome: string
  auditStatus: string
  nextAction: string
  ttlSeconds: number
  valueStatus: string
  affectedRefs: string[]
  affectedServices: string[]
  lockoutActive: boolean
  retryAfterSeconds: number
  stubMode: boolean
}

export type SecretsBrokerSecretOperationStatusResult = {
  state: SecretsBrokerLiveState
  summary: string
  operationId: string
  ref: string
  operation: string
  status: string
  outcome: string
  terminal: boolean
  retrySafe: boolean
  auditStatus: string
  correlationId: string
  nextAction: string
  checkedAt: string
  stubMode: boolean
}

export type SecretsBrokerAuditEventMetadata = {
  id: string
  event: string
  actorType: string
  actorId: string
  outcome: string
  policyDecision: string
  tamperEvidence: string
  recordedAt: string
  summary: string
}

export type SecretsBrokerAuditEventsResult = {
  state: SecretsBrokerLiveState
  summary: string
  events: SecretsBrokerAuditEventMetadata[]
  checkedAt: string
  rawMaterialReturned: boolean
  stubMode: boolean
}

type RuntimeServiceResponse = {
  service?: DashboardService | null
}

type RawBrokerStatusResponse = {
  serviceId?: unknown
  apiVersion?: unknown
  version?: unknown
  state?: unknown
  ready?: unknown
  checkedAt?: unknown
  description?: unknown
}

type RawBrokerStateResponse = {
  serviceId?: unknown
  apiVersion?: unknown
  state?: unknown
  ready?: unknown
  outcome?: unknown
  keyState?: unknown
  nextAction?: unknown
}

type RawBrokerCapabilitiesResponse = {
  serviceId?: unknown
  apiVersion?: unknown
  contractVersion?: unknown
  manifestVersion?: unknown
  version?: unknown
  endpoints?: unknown
  features?: unknown
  futureFeatures?: unknown
  outcomes?: unknown
  operations?: unknown
}

type RawBrokerSource = {
  sourceId?: unknown
  kind?: unknown
  displayName?: unknown
  enabled?: unknown
  critical?: unknown
  priority?: unknown
  state?: unknown
  outcome?: unknown
  nextAction?: unknown
  lifecycle?: unknown
  namespaces?: unknown
  capabilities?: unknown
  operations?: unknown
}

type RawBrokerSourcesResponse = {
  serviceId?: unknown
  apiVersion?: unknown
  sourceConfig?: unknown
  sources?: unknown
}

type RawProviderCapability = {
  providerKind?: unknown
  displayName?: unknown
  supported?: unknown
  capabilities?: unknown
  operations?: unknown
  limitations?: unknown
}

type RawProviderCapabilitiesResponse = {
  serviceId?: unknown
  apiVersion?: unknown
  outcome?: unknown
  capabilities?: unknown
  manifestVersion?: unknown
}

type RawProviderStatus = {
  providerId?: unknown
  providerKind?: unknown
  displayName?: unknown
  state?: unknown
  outcome?: unknown
  nextAction?: unknown
  auditStatus?: unknown
  namespaces?: unknown
  capabilities?: unknown
  operations?: unknown
}

type RawProviderConfigStatusResponse = {
  serviceId?: unknown
  apiVersion?: unknown
  outcome?: unknown
  currentProvider?: unknown
  providers?: unknown
  manifestVersion?: unknown
}

type RawTelemetryResponse = {
  serviceId?: unknown
  apiVersion?: unknown
  contractVersion?: unknown
  outcome?: unknown
}

type RawEventsResponse = {
  serviceId?: unknown
  apiVersion?: unknown
  outcome?: unknown
  safety?: unknown
}

type RawManagedSecret = {
  id?: unknown
  ref?: unknown
  name?: unknown
  sourceId?: unknown
  providerKind?: unknown
  ownerServiceId?: unknown
  workspaceId?: unknown
  state?: unknown
  outcome?: unknown
  capabilities?: unknown
  policy?: unknown
  auditStatus?: unknown
  valueSearch?: unknown
}

type RawManagedSecretsResponse = {
  query?: unknown
  valueSearch?: unknown
  outcome?: unknown
  status?: unknown
  summary?: unknown
  reason?: unknown
  results?: unknown
}

type RawManagedSecretDryRunResponse = {
  requestId?: unknown
  operationId?: unknown
  ref?: unknown
  operation?: unknown
  mode?: unknown
  outcome?: unknown
  applied?: unknown
  requiresConfirmation?: unknown
  auditStatus?: unknown
  nextAction?: unknown
  affectedRefs?: unknown
  affectedServices?: unknown
  lockoutActive?: unknown
  retryAfterSeconds?: unknown
}

type RawManagedSecretRevealResponse = RawManagedSecretDryRunResponse & {
  ttlSeconds?: unknown
}

type RawManagedSecretOperationStatusResponse = {
  operationId?: unknown
  ref?: unknown
  operation?: unknown
  status?: unknown
  outcome?: unknown
  terminal?: unknown
  retrySafe?: unknown
  auditStatus?: unknown
  correlationId?: unknown
  nextAction?: unknown
  checkedAt?: unknown
}

type RawAuditEventResponse = {
  id?: unknown
  event?: unknown
  eventType?: unknown
  type?: unknown
  actorType?: unknown
  actorId?: unknown
  actor?: unknown
  outcome?: unknown
  policyDecision?: unknown
  policy?: unknown
  tamperEvidence?: unknown
  chainStatus?: unknown
  recordedAt?: unknown
  timestamp?: unknown
  summary?: unknown
  normalizedReason?: unknown
  reason?: unknown
}

type RawAuditEventsResponse = {
  state?: unknown
  status?: unknown
  outcome?: unknown
  summary?: unknown
  reason?: unknown
  events?: unknown
  results?: unknown
  rawMaterialReturned?: unknown
}

type HttpJsonError = Error & {
  status?: number
}

function encodeServiceId(serviceId: string) {
  return encodeURIComponent(serviceId)
}

function buildApiUrl(pathname: string) {
  return `${serviceLassoApiBaseUrl}${pathname}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function requiredString(value: unknown, fallback: string) {
  return optionalString(value) ?? fallback
}

function optionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : false
}

function normalizeCapabilities(value: unknown) {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      normalizeStringList(value).map((capability) => [capability, true])
    )
  }

  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value).map(([key, capabilityValue]) => [
      key,
      Boolean(capabilityValue),
    ])
  )
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => optionalString(item))
    .filter((item): item is string => Boolean(item))
}

function optionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeToken(value: unknown) {
  return optionalString(value)?.toLowerCase().replace(/_/g, '-') ?? ''
}

const semanticContractVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

export function assessSecretsBrokerContractCompatibility(
  value: unknown
): SecretsBrokerContractCompatibility {
  const observedVersion = optionalString(value) ?? ''

  if (!observedVersion) {
    return {
      state: 'missing',
      observedVersion,
      supportedRange: secretsBrokerSupportedContractRange,
      reason: 'Secrets Broker did not report a contract version.',
      nextAction: 'upgrade_secrets_broker',
    }
  }

  const match = semanticContractVersionPattern.exec(observedVersion)
  if (!match) {
    return {
      state: 'malformed',
      observedVersion,
      supportedRange: secretsBrokerSupportedContractRange,
      reason: `Secrets Broker reported malformed contract version ${observedVersion}.`,
      nextAction: 'repair_or_upgrade_secrets_broker',
    }
  }

  const major = Number(match[1])
  if (major !== 1) {
    const nextAction =
      major > 1 ? 'upgrade_service_admin' : 'upgrade_secrets_broker'

    return {
      state: 'unsupported',
      observedVersion,
      supportedRange: secretsBrokerSupportedContractRange,
      reason: `Secrets Broker contract ${observedVersion} is not supported by this Service Admin release.`,
      nextAction,
    }
  }

  return {
    state: 'compatible',
    observedVersion,
    supportedRange: secretsBrokerSupportedContractRange,
    reason: `Secrets Broker contract ${observedVersion} is compatible.`,
    nextAction: '',
  }
}

function normalizeOperationCapabilities(
  value: unknown
): SecretsBrokerOperationCapability[] {
  if (!Array.isArray(value)) return []

  const maturities = new Set<SecretsBrokerOperationMaturity>([
    'unavailable',
    'planned',
    'read-only',
    'dry-run',
    'executable',
    'validated',
  ])
  const classifications = new Set<SecretsBrokerOperationClassification>([
    'read',
    'mutation',
  ])

  return value.filter(isRecord).map((item) => {
    const operationId = requiredString(item.operationId, '')
    const method = requiredString(item.method, '').toUpperCase()
    const path = requiredString(item.path, '')
    const rawMaturity = normalizeToken(item.maturity)
    const maturity = maturities.has(
      rawMaturity as SecretsBrokerOperationMaturity
    )
      ? (rawMaturity as SecretsBrokerOperationMaturity)
      : 'unknown'
    const rawClassification = normalizeToken(item.classification)
    const classification = classifications.has(
      rawClassification as SecretsBrokerOperationClassification
    )
      ? (rawClassification as SecretsBrokerOperationClassification)
      : 'unknown'
    const scope = requiredString(item.scope, '')
    const providerKinds = normalizeStringList(item.providerKinds)
    const limitationCode = requiredString(item.limitationCode, '')
    const reasonCode = requiredString(item.reasonCode, '')
    const nextAction = requiredString(item.nextAction, '')
    const valid =
      Boolean(operationId && method && path && scope) &&
      maturity !== 'unknown' &&
      classification !== 'unknown' &&
      typeof item.authenticationRequired === 'boolean' &&
      typeof item.policyRequired === 'boolean' &&
      typeof item.auditRequired === 'boolean' &&
      Array.isArray(item.providerKinds) &&
      Boolean(limitationCode && reasonCode && nextAction)

    return {
      operationId,
      method,
      path,
      maturity,
      rawMaturity,
      classification,
      authenticationRequired: optionalBoolean(item.authenticationRequired),
      policyRequired: optionalBoolean(item.policyRequired),
      auditRequired: optionalBoolean(item.auditRequired),
      scope,
      providerKinds,
      limitationCode,
      reasonCode,
      nextAction,
      valid,
    }
  })
}

export function assessSecretsBrokerOperationManifest(
  contractVersion: string,
  manifestVersionValue: unknown,
  operations: SecretsBrokerOperationCapability[]
): SecretsBrokerOperationManifestCompatibility {
  const contractMatch = semanticContractVersionPattern.exec(contractVersion)
  const manifestRequired =
    contractMatch !== null &&
    Number(contractMatch[1]) === 1 &&
    Number(contractMatch[2]) >= 1

  if (!manifestRequired) {
    return {
      state: 'not-required',
      observedVersion: optionalString(manifestVersionValue) ?? '',
      reason:
        'This compatible Broker contract predates the operation manifest.',
      nextAction: '',
    }
  }

  const observedVersion = optionalString(manifestVersionValue) ?? ''
  if (!observedVersion) {
    return {
      state: 'missing',
      observedVersion,
      reason: 'Secrets Broker did not report an operation manifest version.',
      nextAction: 'upgrade_secrets_broker',
    }
  }

  const manifestMatch = semanticContractVersionPattern.exec(observedVersion)
  if (!manifestMatch) {
    return {
      state: 'malformed',
      observedVersion,
      reason: `Secrets Broker reported malformed operation manifest version ${observedVersion}.`,
      nextAction: 'repair_or_upgrade_secrets_broker',
    }
  }

  const manifestMajor = Number(manifestMatch[1])
  if (manifestMajor !== 1) {
    return {
      state: 'unsupported',
      observedVersion,
      reason: `Secrets Broker operation manifest ${observedVersion} is not supported by this Service Admin release.`,
      nextAction:
        manifestMajor > 1 ? 'upgrade_service_admin' : 'upgrade_secrets_broker',
    }
  }

  if (!operations.some((operation) => operation.valid)) {
    return {
      state: 'malformed',
      observedVersion,
      reason:
        'Secrets Broker operation manifest has no valid operation records.',
      nextAction: 'repair_or_upgrade_secrets_broker',
    }
  }

  return {
    state: 'ready',
    observedVersion,
    reason: `Secrets Broker operation manifest ${observedVersion} is compatible.`,
    nextAction: '',
  }
}

function operationForRoute(
  operations: SecretsBrokerOperationCapability[],
  method: string,
  path: string
) {
  return operations.find(
    (operation) =>
      operation.valid && operation.method === method && operation.path === path
  )
}

function operationAllowsRead(
  operations: SecretsBrokerOperationCapability[],
  method: string,
  path: string
) {
  const operation = operationForRoute(operations, method, path)
  return Boolean(
    operation &&
    operation.classification === 'read' &&
    ['read-only', 'executable', 'validated'].includes(operation.maturity)
  )
}

function operationAllowsPlanning(
  operations: SecretsBrokerOperationCapability[],
  method: string,
  path: string
) {
  const operation = operationForRoute(operations, method, path)
  return Boolean(
    operation &&
    operation.classification === 'mutation' &&
    ['dry-run', 'executable', 'validated'].includes(operation.maturity)
  )
}

function operationAllowsMutation(
  operations: SecretsBrokerOperationCapability[],
  method: string,
  path: string
) {
  const operation = operationForRoute(operations, method, path)
  return Boolean(
    operation &&
    operation.classification === 'mutation' &&
    ['executable', 'validated'].includes(operation.maturity)
  )
}

function normalizeSourceState(
  lifecycleState: unknown,
  outcome?: unknown
): SecretsBrokerSourceState {
  const normalized = normalizeToken(lifecycleState)
  const normalizedOutcome = normalizeToken(outcome)

  if (
    normalized === 'ready' ||
    normalized === 'setup-needed' ||
    normalized === 'locked' ||
    normalized === 'auth-required' ||
    normalized === 'policy-denied' ||
    normalized === 'unsupported' ||
    normalized === 'degraded' ||
    normalized === 'unavailable'
  ) {
    return normalized
  }

  if (normalized === 'healthy' || normalized === 'available') {
    return 'ready'
  }

  if (normalized === 'connected') return 'ready'

  if (
    normalized === 'missing' ||
    normalized === 'unconfigured' ||
    normalizedOutcome === 'setup-needed'
  ) {
    return 'setup-needed'
  }

  if (normalized === 'denied' || normalizedOutcome === 'policy-denied') {
    return 'policy-denied'
  }

  if (
    normalized === 'auth-required' ||
    normalized === 'reconnect-required' ||
    normalized === 'revoked' ||
    normalizedOutcome === 'source-auth-required'
  ) {
    return 'auth-required'
  }

  if (normalized === 'disabled' || normalizedOutcome === 'disabled') {
    return 'unsupported'
  }

  if (normalized === 'config-error' || normalized === 'degraded') {
    return 'degraded'
  }

  return 'unavailable'
}

function sourceStateToOverviewState(
  state: SecretsBrokerSourceState
): SecretsBrokerLiveState {
  if (state === 'ready') return 'ready'
  return state
}

function normalizeOverviewState(
  service: DashboardService,
  brokerStatus: unknown,
  brokerOutcome: unknown,
  sources: SecretsBrokerSourceStatus[],
  capabilities: Record<string, boolean>
): SecretsBrokerLiveState {
  const normalizedStatus = normalizeToken(brokerStatus)
  const normalizedOutcome = normalizeToken(brokerOutcome)

  if (service.status === 'stopped') {
    return 'unavailable'
  }

  if (service.status === 'degraded') {
    return 'degraded'
  }

  if (
    normalizedStatus === 'audit-unavailable' ||
    normalizedOutcome === 'audit-unavailable'
  ) {
    return 'audit-unavailable'
  }

  if (
    normalizedStatus === 'locked' ||
    normalizedStatus === 'auth-required' ||
    normalizedStatus === 'policy-denied' ||
    normalizedStatus === 'unsupported' ||
    normalizedStatus === 'degraded' ||
    normalizedStatus === 'setup-needed' ||
    normalizedStatus === 'unavailable'
  ) {
    return normalizedStatus
  }

  const contractState = normalizedStatus || normalizedOutcome
  if (contractState === 'source-auth-required') return 'auth-required'
  if (contractState === 'setup-needed') return 'setup-needed'

  const blockingSource = sources.find(
    (source) => source.enabled && source.critical && source.state !== 'ready'
  )
  if (blockingSource) {
    return sourceStateToOverviewState(blockingSource.state)
  }

  if (capabilities.sourcesStatus === false) {
    return 'unsupported'
  }

  return 'ready'
}

function normalizeManagedSecretsState(value: unknown): SecretsBrokerLiveState {
  const normalized = optionalString(value)?.toLowerCase().replace(/_/g, '-')

  if (normalized === 'ready' || normalized === 'success') return 'ready'
  if (normalized === 'loading' || normalized === 'pending') return 'loading'
  if (normalized === 'unconfigured' || normalized === 'missing') {
    return 'setup-needed'
  }

  if (
    normalized === 'unavailable' ||
    normalized === 'setup-needed' ||
    normalized === 'locked' ||
    normalized === 'auth-required' ||
    normalized === 'policy-denied' ||
    normalized === 'unsupported' ||
    normalized === 'degraded' ||
    normalized === 'audit-unavailable'
  ) {
    return normalized
  }

  return 'degraded'
}

function normalizeSources(value: unknown): SecretsBrokerSourceStatus[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map((source: RawBrokerSource, index) => {
    const id = optionalString(source.sourceId) ?? `source-${index + 1}`
    const provider = optionalString(source.kind) ?? 'unknown'
    const lifecycle = isRecord(source.lifecycle) ? source.lifecycle : {}
    const lifecycleState = requiredString(
      lifecycle.state ?? source.state,
      'unavailable'
    )
    const outcome = requiredString(
      lifecycle.outcome ?? source.outcome,
      'source_unavailable'
    )
    const nextAction = requiredString(
      lifecycle.nextAction ?? source.nextAction,
      ''
    )
    const capabilityNames = normalizeStringList(source.capabilities)
    const advertisedCapabilities = normalizeCapabilities(capabilityNames)
    const state = normalizeSourceState(lifecycleState, outcome)

    return {
      id,
      label: optionalString(source.displayName) ?? id,
      provider,
      state,
      reason: nextAction
        ? `${outcome}; next action: ${nextAction}.`
        : `${provider} source reported ${outcome}.`,
      lifecycleState,
      outcome,
      nextAction,
      enabled: source.enabled === true,
      critical: source.critical === true,
      priority: optionalNumber(source.priority),
      namespaces: normalizeStringList(source.namespaces),
      capabilityNames,
      capabilities: {
        ...advertisedCapabilities,
        reveal: advertisedCapabilities.reveal === true,
        mutation:
          advertisedCapabilities['write/update'] === true ||
          advertisedCapabilities['rotate/reset'] === true ||
          advertisedCapabilities.policy === true,
        write: advertisedCapabilities['write/update'] === true,
        reset: advertisedCapabilities['rotate/reset'] === true,
      },
      operations: normalizeOperationCapabilities(source.operations),
    }
  })
}

const sourceMutationRoutes = [
  '/v1/management/secrets/edit/apply',
  '/v1/management/secrets/reset/apply',
  '/v1/management/secrets/policy/apply',
] as const

function gateSourceCapabilitiesByManifest(
  source: SecretsBrokerSourceStatus,
  useManifest: boolean
): SecretsBrokerSourceStatus {
  if (!useManifest) return source

  const write = operationAllowsMutation(
    source.operations,
    'POST',
    '/v1/management/secrets/edit/apply'
  )
  const reset = operationAllowsMutation(
    source.operations,
    'POST',
    '/v1/management/secrets/reset/apply'
  )
  const policy = operationAllowsMutation(
    source.operations,
    'POST',
    '/v1/management/secrets/policy/apply'
  )
  const reveal = operationAllowsRead(
    source.operations,
    'POST',
    '/v1/management/secrets/reveal'
  )

  return {
    ...source,
    capabilities: {
      ...Object.fromEntries(
        Object.keys(source.capabilities).map((capability) => [
          capability,
          false,
        ])
      ),
      reveal,
      mutation: write || reset || policy,
      write,
      reset,
      policy,
    },
  }
}

function normalizeProviderCapabilities(
  value: unknown
): SecretsBrokerProviderCapability[] {
  if (!Array.isArray(value)) return []

  return value.filter(isRecord).map((item) => {
    const capability = item as RawProviderCapability
    const providerKind = requiredString(capability.providerKind, 'unknown')

    return {
      providerKind,
      displayName: requiredString(capability.displayName, providerKind),
      supported: capability.supported === true,
      capabilities: normalizeStringList(capability.capabilities),
      operations: normalizeOperationCapabilities(capability.operations),
      limitations: normalizeStringList(capability.limitations),
    }
  })
}

function normalizeProviderStatuses(
  value: unknown
): SecretsBrokerProviderStatus[] {
  if (!Array.isArray(value)) return []

  return value.filter(isRecord).map((item) => {
    const provider = item as RawProviderStatus
    const providerId = requiredString(provider.providerId, 'unknown')
    const providerKind = requiredString(provider.providerKind, 'unknown')

    return {
      providerId,
      providerKind,
      displayName: requiredString(provider.displayName, providerId),
      state: requiredString(provider.state, 'unavailable'),
      outcome: requiredString(provider.outcome, 'source_unavailable'),
      nextAction: requiredString(provider.nextAction, ''),
      auditStatus: requiredString(provider.auditStatus, 'audit_unavailable'),
      namespaces: normalizeStringList(provider.namespaces),
      capabilities: normalizeStringList(provider.capabilities),
      operations: normalizeOperationCapabilities(provider.operations),
    }
  })
}

function normalizeManagedSecrets(value: unknown): SecretsBrokerManagedSecret[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map((secret: RawManagedSecret, index) => {
    const ref = requiredString(secret.ref, `secret-metadata-${index + 1}`)
    const name = requiredString(secret.name, ref)

    return {
      id: requiredString(secret.id, ref),
      ref,
      name,
      sourceId: requiredString(secret.sourceId, 'unknown-source'),
      providerKind: requiredString(secret.providerKind, 'unknown-provider'),
      ownerServiceId: requiredString(secret.ownerServiceId, 'unknown-service'),
      workspaceId: requiredString(secret.workspaceId, 'unknown-workspace'),
      state: requiredString(secret.state, 'unknown'),
      outcome: requiredString(secret.outcome, 'unknown'),
      capabilities: normalizeStringList(secret.capabilities),
      policy: requiredString(secret.policy, 'policy-unavailable'),
      auditStatus: requiredString(secret.auditStatus, 'audit-unavailable'),
      valueSearch: requiredString(secret.valueSearch, 'unsupported'),
    }
  })
}

function normalizeAuditEvents(
  value: unknown
): SecretsBrokerAuditEventMetadata[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((event): SecretsBrokerAuditEventMetadata => {
      const rawEvent = event as RawAuditEventResponse
      const actor = optionalString(rawEvent.actor)

      return {
        id:
          optionalString(rawEvent.id) ??
          optionalString(rawEvent.event) ??
          'audit-event',
        event:
          optionalString(rawEvent.eventType) ??
          optionalString(rawEvent.type) ??
          optionalString(rawEvent.event) ??
          'audit_event',
        actorType: requiredString(rawEvent.actorType, 'unknown'),
        actorId:
          optionalString(rawEvent.actorId) ??
          actor?.replace(/^[^:]+:\s*/, '') ??
          'unknown',
        outcome: requiredString(rawEvent.outcome, 'unavailable'),
        policyDecision:
          optionalString(rawEvent.policyDecision) ??
          optionalString(rawEvent.policy) ??
          'policy metadata unavailable',
        tamperEvidence:
          optionalString(rawEvent.chainStatus) ??
          optionalString(rawEvent.tamperEvidence) ??
          'unavailable',
        recordedAt:
          optionalString(rawEvent.recordedAt) ??
          optionalString(rawEvent.timestamp) ??
          new Date(0).toISOString(),
        summary:
          optionalString(rawEvent.summary) ??
          optionalString(rawEvent.normalizedReason) ??
          optionalString(rawEvent.reason) ??
          'Secrets Broker audit metadata returned without raw material.',
      }
    })
}

function normalizeDryRunState(outcome: string): SecretsBrokerLiveState {
  const normalized = outcome.toLowerCase().replace(/_/g, '-')

  if (normalized === 'dry-run-ready' || normalized === 'ready') return 'ready'
  if (normalized === 'locked' || normalized === 'lockout-active')
    return 'locked'
  if (normalized === 'source-auth-required') return 'auth-required'
  if (normalized === 'policy-denied') return 'policy-denied'
  if (normalized === 'unsupported') return 'unsupported'
  if (normalized === 'audit-unavailable') return 'audit-unavailable'
  if (normalized === 'invalid-ref' || normalized === 'missing-ref') {
    return 'unsupported'
  }

  return 'degraded'
}

function dryRunEndpointForAction(action: SecretsBrokerSecretDryRunAction) {
  if (action === 'policy') {
    return '/api/services/%40secretsbroker/proxy/v1/management/secrets/policy/preview'
  }

  return `/api/services/%40secretsbroker/proxy/v1/management/secrets/${action}/dry-run`
}

function applyEndpointForAction(action: SecretsBrokerSecretDryRunAction) {
  if (action === 'policy') {
    return '/api/services/%40secretsbroker/proxy/v1/management/secrets/policy/apply'
  }

  return `/api/services/%40secretsbroker/proxy/v1/management/secrets/${action}/apply`
}

function dryRunModeForAction(action: SecretsBrokerSecretDryRunAction) {
  return action === 'policy' ? 'preview' : 'dry-run'
}

function normalizeDryRunResponse(
  payload: RawManagedSecretDryRunResponse,
  request: Required<SecretsBrokerSecretDryRunRequest>
): SecretsBrokerSecretDryRunResult {
  const outcome = requiredString(payload.outcome, 'degraded')
  const mode = requiredString(payload.mode, dryRunModeForAction(request.action))
  const operationId = requiredString(payload.operationId, request.requestId)

  return {
    state: normalizeDryRunState(outcome),
    summary:
      outcome === 'dry_run_ready'
        ? 'Live broker dry-run returned safe metadata and did not apply a mutation.'
        : 'Live broker dry-run failed closed with safe metadata only.',
    requestId: requiredString(payload.requestId, request.requestId),
    operationId,
    ref: requiredString(payload.ref, request.ref),
    operation: requiredString(payload.operation, request.action),
    mode,
    outcome,
    applied: optionalBoolean(payload.applied),
    requiresConfirmation: optionalBoolean(payload.requiresConfirmation),
    auditStatus: requiredString(payload.auditStatus, 'audit-unavailable'),
    nextAction: requiredString(payload.nextAction, 'inspect_status'),
    affectedRefs: normalizeStringList(payload.affectedRefs),
    affectedServices: normalizeStringList(payload.affectedServices),
    lockoutActive: optionalBoolean(payload.lockoutActive),
    retryAfterSeconds: optionalNumber(payload.retryAfterSeconds),
    stubMode: false,
  }
}

function normalizeRevealResponse(
  payload: RawManagedSecretRevealResponse,
  request: Required<SecretsBrokerSecretRevealRequest>
): SecretsBrokerSecretRevealResult {
  const outcome = requiredString(payload.outcome, 'degraded')
  const state = normalizeDryRunState(outcome)

  return {
    state,
    summary:
      state === 'ready'
        ? 'Live broker controlled reveal returned a time-limited result; Service Admin kept metadata only.'
        : 'Live broker controlled reveal failed closed with safe metadata only.',
    requestId: requiredString(payload.requestId, request.requestId),
    ref: requiredString(payload.ref, request.ref),
    operation: requiredString(payload.operation, 'reveal'),
    mode: requiredString(payload.mode, 'apply'),
    outcome,
    auditStatus: requiredString(payload.auditStatus, 'audit-unavailable'),
    nextAction: requiredString(payload.nextAction, 'review_reveal_metadata'),
    ttlSeconds: optionalNumber(payload.ttlSeconds),
    valueStatus:
      state === 'ready'
        ? 'discarded_by_service_admin_after_metadata_mapping'
        : 'not_available',
    affectedRefs: normalizeStringList(payload.affectedRefs),
    affectedServices: normalizeStringList(payload.affectedServices),
    lockoutActive: optionalBoolean(payload.lockoutActive),
    retryAfterSeconds: optionalNumber(payload.retryAfterSeconds),
    stubMode: false,
  }
}

function normalizeOperationStatusState(
  status: string,
  outcome: string
): SecretsBrokerLiveState {
  const normalizedStatus = status.toLowerCase().replace(/_/g, '-')
  const normalizedOutcome = outcome.toLowerCase().replace(/_/g, '-')

  if (
    normalizedStatus === 'succeeded' ||
    normalizedStatus === 'success' ||
    normalizedStatus === 'applied' ||
    normalizedOutcome === 'success' ||
    normalizedOutcome === 'applied'
  ) {
    return 'ready'
  }

  if (
    normalizedStatus === 'pending' ||
    normalizedStatus === 'running' ||
    normalizedStatus === 'submitted' ||
    normalizedStatus === 'accepted' ||
    normalizedStatus === 'queued' ||
    normalizedOutcome === 'pending' ||
    normalizedOutcome === 'running'
  ) {
    return 'loading'
  }

  if (normalizedStatus === 'locked' || normalizedOutcome === 'locked') {
    return 'locked'
  }

  if (
    normalizedStatus === 'auth-required' ||
    normalizedStatus === 'source-auth-required' ||
    normalizedOutcome === 'auth-required' ||
    normalizedOutcome === 'source-auth-required'
  ) {
    return 'auth-required'
  }

  if (
    normalizedStatus === 'policy-denied' ||
    normalizedOutcome === 'policy-denied'
  ) {
    return 'policy-denied'
  }

  if (
    normalizedStatus === 'unsupported' ||
    normalizedOutcome === 'unsupported'
  ) {
    return 'unsupported'
  }

  if (
    normalizedStatus === 'audit-unavailable' ||
    normalizedOutcome === 'audit-unavailable'
  ) {
    return 'audit-unavailable'
  }

  return 'degraded'
}

function normalizeOperationStatusResponse(
  payload: RawManagedSecretOperationStatusResponse,
  operationId: string
): SecretsBrokerSecretOperationStatusResult {
  const status = requiredString(payload.status, 'unknown')
  const outcome = requiredString(payload.outcome, status)
  const state = normalizeOperationStatusState(status, outcome)

  return {
    state,
    summary:
      state === 'ready'
        ? 'Live broker operation status returned terminal safe metadata.'
        : 'Live broker operation status returned safe metadata without secret material.',
    operationId: requiredString(payload.operationId, operationId),
    ref: requiredString(payload.ref, 'unknown-ref'),
    operation: requiredString(payload.operation, 'unknown-operation'),
    status,
    outcome,
    terminal: optionalBoolean(payload.terminal),
    retrySafe: optionalBoolean(payload.retrySafe),
    auditStatus: requiredString(payload.auditStatus, 'audit-unavailable'),
    correlationId: requiredString(payload.correlationId, 'unavailable'),
    nextAction: requiredString(payload.nextAction, 'inspect_status'),
    checkedAt: requiredString(payload.checkedAt, new Date().toISOString()),
    stubMode: false,
  }
}

async function fetchJson<T>(pathname: string, init?: RequestInit) {
  const response = await fetch(buildApiUrl(pathname), init)
  const contentType = response.headers.get('content-type') ?? ''

  if (!response.ok) {
    const error = new Error(
      `Service Lasso runtime API returned ${response.status}.`
    ) as HttpJsonError
    error.status = response.status
    throw error
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('Service Lasso runtime API returned non-JSON content.')
  }

  return (await response.json()) as T
}

async function postJson<T>(pathname: string, body: unknown) {
  return fetchJson<T>(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

type BrokerRouteResult<T> = {
  state: SecretsBrokerRouteState
  payload: T | null
  status?: number
}

const unavailableRoutes: Record<
  SecretsBrokerRouteName,
  SecretsBrokerRouteState
> = {
  status: 'unavailable',
  state: 'unavailable',
  capabilities: 'unavailable',
  sources: 'unavailable',
  providerCapabilities: 'unavailable',
  providerConfig: 'unavailable',
  telemetry: 'unavailable',
  events: 'unavailable',
}

function emptyOverviewContract() {
  return {
    apiVersion: '',
    contractVersion: '',
    brokerVersion: '',
    brokerState: 'unavailable',
    outcome: 'source_unavailable',
    nextAction: '',
    brokerOutcome: 'source_unavailable',
    brokerNextAction: '',
    contractCompatibility: assessSecretsBrokerContractCompatibility(null),
    manifestVersion: '',
    operationManifest: {
      state: 'missing' as const,
      observedVersion: '',
      reason: 'Secrets Broker operation manifest is unavailable.',
      nextAction: 'upgrade_secrets_broker',
    },
    operations: [] as SecretsBrokerOperationCapability[],
    endpointCapabilities: [] as string[],
    featureCapabilities: [] as string[],
    providerCapabilities: [] as SecretsBrokerProviderCapability[],
    providers: [] as SecretsBrokerProviderStatus[],
    routes: { ...unavailableRoutes },
  }
}

function routeStateForStatus(status?: number): SecretsBrokerRouteState {
  if (status === 401 || status === 403 || status === 423) return 'denied'
  if (status === 404 || status === 405 || status === 501) return 'unsupported'
  return 'unavailable'
}

async function fetchBrokerRoute<T>(
  pathname: string
): Promise<BrokerRouteResult<T>> {
  try {
    return { state: 'ready', payload: await fetchJson<T>(pathname) }
  } catch (error) {
    const status =
      error instanceof Error && 'status' in error
        ? (error as HttpJsonError).status
        : undefined

    return { state: routeStateForStatus(status), payload: null, status }
  }
}

function advertisedRoute(
  endpoints: string[],
  method: string,
  path: string
): boolean {
  return endpoints.some((endpoint) => {
    const separator = endpoint.indexOf(' ')
    if (separator < 1) return false

    const methods = endpoint.slice(0, separator).split('|')
    if (!methods.includes(method)) return false

    const pathExpression = endpoint.slice(separator + 1)
    const alternatives = pathExpression.split('|')
    const first = alternatives[0] ?? ''
    const prefix = first.slice(0, first.lastIndexOf('/') + 1)
    const paths = alternatives.map((alternative, index) =>
      index === 0 || alternative.startsWith('/')
        ? alternative
        : `${prefix}${alternative}`
    )

    return paths.includes(path)
  })
}

function essentialRouteState(
  routes: Record<SecretsBrokerRouteName, SecretsBrokerRouteState>
): SecretsBrokerLiveState | null {
  const essential = [
    routes.status,
    routes.state,
    routes.capabilities,
    routes.sources,
  ]

  if (essential.includes('denied')) return 'policy-denied'
  if (essential.includes('unsupported')) return 'unsupported'
  if (essential.includes('unavailable')) return 'unavailable'
  return null
}

export async function fetchSecretsBrokerOverview(): Promise<SecretsBrokerOverview> {
  const checkedAt = new Date().toISOString()

  if (isServiceAdminStubModeEnabled()) {
    return {
      state: 'ready',
      summary:
        'Explicit Service Admin stub mode is enabled; broker metadata is deterministic fixture data.',
      service: null,
      checkedAt,
      sourceCount: 1,
      sources: [
        {
          id: '@secretsbroker/local/default',
          label: 'Local encrypted store',
          provider: 'local',
          state: 'ready',
          reason: 'Local fixture source is ready in explicit stub mode.',
          lifecycleState: 'connected',
          outcome: 'ready',
          nextAction: '',
          enabled: true,
          critical: true,
          priority: 0,
          namespaces: ['*'],
          capabilityNames: ['read', 'health'],
          capabilities: {
            reveal: false,
            mutation: false,
            dryRun: true,
          },
          operations: [],
        },
      ],
      capabilities: {
        sourcesStatus: true,
        managementSecrets: false,
        providerConfig: false,
        reveal: false,
        mutation: false,
      },
      telemetryAvailable: false,
      auditAvailable: false,
      ...emptyOverviewContract(),
      contractCompatibility: {
        state: 'not-applicable',
        observedVersion: '',
        supportedRange: secretsBrokerSupportedContractRange,
        reason: 'Explicit stub mode does not use a live Broker contract.',
        nextAction: '',
      },
      operationManifest: {
        state: 'not-applicable',
        observedVersion: '',
        reason: 'Explicit stub mode does not use a live operation manifest.',
        nextAction: '',
      },
      stubMode: true,
    }
  }

  let service: DashboardService | null

  try {
    const payload = await fetchJson<RuntimeServiceResponse>(
      `/api/dashboard/services/${encodeServiceId('@secretsbroker')}`
    )
    service = payload.service ?? null
  } catch {
    return {
      state: 'unavailable',
      summary:
        'Service Lasso runtime service metadata for @secretsbroker is unavailable.',
      service: null,
      checkedAt,
      sourceCount: 0,
      sources: [],
      capabilities: {},
      telemetryAvailable: false,
      auditAvailable: false,
      ...emptyOverviewContract(),
      stubMode: false,
    }
  }

  if (!service) {
    return {
      state: 'setup-needed',
      summary:
        '@secretsbroker is not registered with the Service Lasso runtime.',
      service: null,
      checkedAt,
      sourceCount: 0,
      sources: [],
      capabilities: {},
      telemetryAvailable: false,
      auditAvailable: false,
      ...emptyOverviewContract(),
      stubMode: false,
    }
  }

  const brokerProxy = `/api/services/${encodeServiceId('@secretsbroker')}/proxy`
  const [
    statusResult,
    stateResult,
    capabilitiesResult,
    sourcesResult,
    providerCapabilitiesResult,
    providerConfigResult,
    telemetryResult,
    eventsResult,
  ] = await Promise.all([
    fetchBrokerRoute<RawBrokerStatusResponse>(`${brokerProxy}/status`),
    fetchBrokerRoute<RawBrokerStateResponse>(`${brokerProxy}/state`),
    fetchBrokerRoute<RawBrokerCapabilitiesResponse>(
      `${brokerProxy}/capabilities`
    ),
    fetchBrokerRoute<RawBrokerSourcesResponse>(
      `${brokerProxy}/v1/sources/status`
    ),
    fetchBrokerRoute<RawProviderCapabilitiesResponse>(
      `${brokerProxy}/v1/providers/capabilities`
    ),
    fetchBrokerRoute<RawProviderConfigStatusResponse>(
      `${brokerProxy}/v1/providers/config/status`
    ),
    fetchBrokerRoute<RawTelemetryResponse>(`${brokerProxy}/v1/telemetry`),
    fetchBrokerRoute<RawEventsResponse>(`${brokerProxy}/v1/events?limit=1`),
  ])

  const routes = {
    status: statusResult.state,
    state: stateResult.state,
    capabilities: capabilitiesResult.state,
    sources: sourcesResult.state,
    providerCapabilities: providerCapabilitiesResult.state,
    providerConfig: providerConfigResult.state,
    telemetry: telemetryResult.state,
    events: eventsResult.state,
  }
  const brokerStatus = statusResult.payload
  const brokerState = stateResult.payload
  const brokerCapabilities = capabilitiesResult.payload
  const brokerSources = sourcesResult.payload
  const providerCapabilityPayload = providerCapabilitiesResult.payload
  const providerConfigPayload = providerConfigResult.payload
  const telemetryPayload = telemetryResult.payload
  const eventsPayload = eventsResult.payload
  const contractCompatibility = assessSecretsBrokerContractCompatibility(
    brokerCapabilities?.contractVersion
  )
  const contractCompatible = contractCompatibility.state === 'compatible'
  const operations = normalizeOperationCapabilities(
    brokerCapabilities?.operations
  )
  const operationManifest = assessSecretsBrokerOperationManifest(
    contractCompatibility.observedVersion,
    brokerCapabilities?.manifestVersion,
    operations
  )
  const useOperationManifest = operationManifest.state !== 'not-required'
  const operationManifestCompatible =
    operationManifest.state === 'ready' ||
    operationManifest.state === 'not-required'
  const advertisedSources = normalizeSources(brokerSources?.sources)
  const manifestGatedSources = advertisedSources.map((source) =>
    gateSourceCapabilitiesByManifest(source, useOperationManifest)
  )
  const sources =
    contractCompatible && operationManifestCompatible
      ? manifestGatedSources
      : manifestGatedSources.map((source) => ({
          ...source,
          capabilities: Object.fromEntries(
            Object.keys(source.capabilities).map((capability) => [
              capability,
              false,
            ])
          ),
        }))
  const endpointCapabilities = normalizeStringList(
    brokerCapabilities?.endpoints
  )
  const featureCapabilities = normalizeStringList(brokerCapabilities?.features)
  const providerCapabilities = normalizeProviderCapabilities(
    providerCapabilityPayload?.capabilities
  )
  const providers = normalizeProviderStatuses(providerConfigPayload?.providers)
  const readySources = sources.filter(
    (source) => source.enabled && source.state === 'ready'
  )
  const hasReadySourceCapability = (capability: string) =>
    readySources.some((source) => source.capabilityNames.includes(capability))
  const hasLegacyMutationRoute =
    advertisedRoute(
      endpointCapabilities,
      'POST',
      '/v1/management/secrets/edit/apply'
    ) ||
    advertisedRoute(
      endpointCapabilities,
      'POST',
      '/v1/management/secrets/reset/apply'
    ) ||
    advertisedRoute(
      endpointCapabilities,
      'POST',
      '/v1/management/secrets/policy/apply'
    )
  const globalReadAvailable = (method: string, path: string) =>
    useOperationManifest
      ? operationAllowsRead(operations, method, path)
      : advertisedRoute(endpointCapabilities, method, path)
  const globalPlanningAvailable = (method: string, path: string) =>
    useOperationManifest
      ? operationAllowsPlanning(operations, method, path)
      : advertisedRoute(endpointCapabilities, method, path)
  const globalMutationAvailable = (method: string, path: string) =>
    useOperationManifest
      ? operationAllowsMutation(operations, method, path)
      : advertisedRoute(endpointCapabilities, method, path)
  const hasManifestMutation = readySources.some((source) =>
    sourceMutationRoutes.some(
      (path) =>
        globalMutationAvailable('POST', path) &&
        operationAllowsMutation(source.operations, 'POST', path)
    )
  )
  const advertisedCapabilities: Record<string, boolean> = {
    sourcesStatus:
      routes.sources === 'ready' &&
      globalReadAvailable('GET', '/v1/sources/status'),
    managementSecrets: globalReadAvailable('GET', '/v1/management/secrets'),
    providerConfig:
      routes.providerCapabilities === 'ready' &&
      routes.providerConfig === 'ready' &&
      providerCapabilityPayload?.outcome === 'ready' &&
      providerConfigPayload?.outcome === 'ready' &&
      globalPlanningAvailable('POST', '/v1/providers/config/validate') &&
      globalMutationAvailable('POST', '/v1/providers/config/apply'),
    reveal:
      globalReadAvailable('POST', '/v1/management/secrets/reveal') &&
      (useOperationManifest
        ? readySources.some((source) => source.capabilities.reveal)
        : hasReadySourceCapability('reveal')),
    mutation: useOperationManifest
      ? hasManifestMutation
      : hasLegacyMutationRoute &&
        (hasReadySourceCapability('write/update') ||
          hasReadySourceCapability('rotate/reset') ||
          hasReadySourceCapability('policy')),
  }
  const capabilities =
    contractCompatible && operationManifestCompatible
      ? advertisedCapabilities
      : Object.fromEntries(
          Object.keys(advertisedCapabilities).map((capability) => [
            capability,
            false,
          ])
        )
  const eventSafety = isRecord(eventsPayload?.safety)
    ? eventsPayload.safety
    : null
  const telemetryAvailable =
    contractCompatible &&
    operationManifestCompatible &&
    routes.telemetry === 'ready' &&
    globalReadAvailable('GET', '/v1/telemetry') &&
    !['unsupported', 'source_unavailable'].includes(
      requiredString(telemetryPayload?.outcome, 'source_unavailable')
    )
  const auditAvailable =
    contractCompatible &&
    operationManifestCompatible &&
    routes.events === 'ready' &&
    globalReadAvailable('GET', '/v1/events') &&
    requiredString(eventsPayload?.outcome, 'audit_unavailable') !==
      'audit_unavailable' &&
    eventSafety?.metadataOnly === true &&
    eventSafety.valueMaterialIncluded === false
  const routeFailure = essentialRouteState(routes)
  const contractFailure = routes.capabilities === 'ready' && !contractCompatible
  const operationManifestFailure =
    routes.capabilities === 'ready' &&
    contractCompatible &&
    !operationManifestCompatible
  const normalizedState = normalizeOverviewState(
    service,
    brokerState?.state ?? brokerStatus?.state,
    brokerState?.outcome,
    sources,
    capabilities
  )
  const state =
    routeFailure ??
    (contractFailure || operationManifestFailure
      ? 'unsupported'
      : normalizedState)
  const unavailableEssentialRoutes = (
    ['status', 'state', 'capabilities', 'sources'] as const
  ).filter((route) => routes[route] !== 'ready')
  const brokerOutcome = requiredString(
    brokerState?.outcome,
    'source_unavailable'
  )
  const brokerNextAction = requiredString(brokerState?.nextAction, '')
  const outcome =
    contractFailure || operationManifestFailure ? 'unsupported' : brokerOutcome
  const nextAction = contractFailure
    ? contractCompatibility.nextAction
    : operationManifestFailure
      ? operationManifest.nextAction
      : brokerNextAction
  const summary = routeFailure
    ? `Secrets Broker canonical contract is incomplete: ${unavailableEssentialRoutes
        .map((route) => `${route} (${routes[route]})`)
        .join(', ')}.`
    : contractFailure
      ? `${contractCompatibility.reason} Supported range: ${contractCompatibility.supportedRange}; next action: ${contractCompatibility.nextAction}.`
      : operationManifestFailure
        ? `${operationManifest.reason} Next action: ${operationManifest.nextAction}.`
        : brokerNextAction
          ? `Secrets Broker reported ${outcome}; next action: ${nextAction}.`
          : requiredString(
              brokerStatus?.description,
              `Secrets Broker reported ${outcome}.`
            )

  return {
    state,
    summary,
    service,
    checkedAt: requiredString(brokerStatus?.checkedAt, checkedAt),
    sourceCount: sources.length,
    sources,
    capabilities,
    telemetryAvailable,
    auditAvailable,
    apiVersion: requiredString(
      brokerCapabilities?.apiVersion ?? brokerState?.apiVersion,
      ''
    ),
    contractVersion: contractCompatibility.observedVersion,
    manifestVersion: operationManifest.observedVersion,
    brokerVersion: requiredString(
      brokerCapabilities?.version ?? brokerStatus?.version,
      ''
    ),
    brokerState: requiredString(
      brokerState?.state ?? brokerStatus?.state,
      'unavailable'
    ),
    outcome,
    nextAction,
    brokerOutcome,
    brokerNextAction,
    contractCompatibility,
    operationManifest,
    operations,
    endpointCapabilities,
    featureCapabilities,
    providerCapabilities,
    providers,
    routes,
    stubMode: false,
  }
}

export async function fetchSecretsBrokerManagedSecrets(
  search = ''
): Promise<SecretsBrokerManagedSecretsResult> {
  const checkedAt = new Date().toISOString()
  const query = search.trim()

  if (isServiceAdminStubModeEnabled()) {
    return {
      state: 'ready',
      summary:
        'Explicit Service Admin stub mode is enabled; live managed secret rows are not requested.',
      query,
      valueSearch: false,
      results: [],
      checkedAt,
      stubMode: true,
    }
  }

  const searchParam = query ? `?search=${encodeURIComponent(query)}` : ''

  try {
    const payload = await fetchJson<RawManagedSecretsResponse>(
      `/api/services/${encodeServiceId('@secretsbroker')}/proxy/v1/management/secrets${searchParam}`
    )
    const results = normalizeManagedSecrets(payload.results)
    const state = normalizeManagedSecretsState(
      payload.outcome ?? payload.status
    )

    return {
      state,
      summary:
        optionalString(payload.summary) ??
        optionalString(payload.reason) ??
        'Secrets Broker managed secret metadata was read from the runtime proxy.',
      query: optionalString(payload.query) ?? query,
      valueSearch: optionalBoolean(payload.valueSearch),
      results,
      checkedAt,
      stubMode: false,
    }
  } catch (error) {
    const status =
      error instanceof Error && 'status' in error
        ? (error as HttpJsonError).status
        : undefined

    return {
      state: status === 404 ? 'unsupported' : 'unavailable',
      summary:
        status === 404
          ? 'Secrets Broker managed secrets route is not exposed by the runtime yet.'
          : 'Secrets Broker managed secrets route is unavailable.',
      query,
      valueSearch: false,
      results: [],
      checkedAt,
      stubMode: false,
    }
  }
}

export async function fetchSecretsBrokerAuditEvents(): Promise<SecretsBrokerAuditEventsResult> {
  const checkedAt = new Date().toISOString()

  if (isServiceAdminStubModeEnabled()) {
    return {
      state: 'ready',
      summary:
        'Explicit Service Admin stub mode is enabled; live audit events are not requested.',
      events: [],
      checkedAt,
      rawMaterialReturned: false,
      stubMode: true,
    }
  }

  try {
    const payload = await fetchJson<RawAuditEventsResponse>(
      `/api/services/${encodeServiceId('@secretsbroker')}/proxy/v1/audit/events`
    )
    const events = normalizeAuditEvents(payload.events ?? payload.results)

    return {
      state: normalizeManagedSecretsState(
        payload.state ?? payload.status ?? payload.outcome
      ),
      summary:
        optionalString(payload.summary) ??
        optionalString(payload.reason) ??
        'Secrets Broker audit metadata was read from the runtime proxy.',
      events,
      checkedAt,
      rawMaterialReturned: payload.rawMaterialReturned === true,
      stubMode: false,
    }
  } catch (error) {
    const status =
      error instanceof Error && 'status' in error
        ? (error as HttpJsonError).status
        : undefined

    return {
      state: status === 404 ? 'unsupported' : 'unavailable',
      summary:
        status === 404
          ? 'Secrets Broker audit events route is not exposed by the runtime yet.'
          : 'Secrets Broker audit events route is unavailable.',
      events: [],
      checkedAt,
      rawMaterialReturned: false,
      stubMode: false,
    }
  }
}

export async function fetchSecretsBrokerSecretDryRun(
  request: SecretsBrokerSecretDryRunRequest
): Promise<SecretsBrokerSecretDryRunResult> {
  const ref = request.ref.trim()
  const serviceId = request.serviceId?.trim() || '@serviceadmin'
  const requestId =
    request.requestId?.trim() ||
    `service-admin-${request.action}-${Date.now().toString(36)}`
  const reason =
    request.reason?.trim() ||
    'Service Admin operator requested metadata-only dry-run preview.'
  const normalizedRequest: Required<SecretsBrokerSecretDryRunRequest> = {
    action: request.action,
    ref,
    serviceId,
    reason,
    requestId,
  }

  if (isServiceAdminStubModeEnabled()) {
    return {
      state: 'unsupported',
      summary:
        'Explicit Service Admin stub mode is enabled; live broker dry-run was not requested.',
      requestId,
      operationId: requestId,
      ref,
      operation: request.action,
      mode: dryRunModeForAction(request.action),
      outcome: 'stub_mode',
      applied: false,
      requiresConfirmation: false,
      auditStatus: 'stub-mode',
      nextAction: 'disable_stub_mode_for_live_dry_run',
      affectedRefs: ref ? [ref] : [],
      affectedServices: [serviceId],
      lockoutActive: false,
      retryAfterSeconds: 0,
      stubMode: true,
    }
  }

  if (!ref) {
    return {
      state: 'unsupported',
      summary: 'A managed secret ref is required before live dry-run preview.',
      requestId,
      operationId: requestId,
      ref: '',
      operation: request.action,
      mode: dryRunModeForAction(request.action),
      outcome: 'invalid_ref',
      applied: false,
      requiresConfirmation: false,
      auditStatus: 'audit-unavailable',
      nextAction: 'select_managed_secret_ref',
      affectedRefs: [],
      affectedServices: [serviceId],
      lockoutActive: false,
      retryAfterSeconds: 0,
      stubMode: false,
    }
  }

  try {
    const payload = await postJson<RawManagedSecretDryRunResponse>(
      dryRunEndpointForAction(request.action),
      {
        requestId,
        serviceId,
        ref,
        reason,
        confirm: false,
      }
    )

    return normalizeDryRunResponse(payload, normalizedRequest)
  } catch (error) {
    const status =
      error instanceof Error && 'status' in error
        ? (error as HttpJsonError).status
        : undefined

    return {
      state: status === 404 ? 'unsupported' : 'unavailable',
      summary:
        status === 404
          ? 'Secrets Broker live dry-run route is not exposed by the runtime yet.'
          : 'Secrets Broker live dry-run route is unavailable.',
      requestId,
      operationId: requestId,
      ref,
      operation: request.action,
      mode: dryRunModeForAction(request.action),
      outcome: status === 404 ? 'unsupported' : 'unavailable',
      applied: false,
      requiresConfirmation: false,
      auditStatus: 'audit-unavailable',
      nextAction:
        status === 404 ? 'inspect_capability' : 'retry_or_inspect_status',
      affectedRefs: ref ? [ref] : [],
      affectedServices: [serviceId],
      lockoutActive: false,
      retryAfterSeconds: 0,
      stubMode: false,
    }
  }
}

export async function submitSecretsBrokerSecretReveal(
  request: SecretsBrokerSecretRevealRequest
): Promise<SecretsBrokerSecretRevealResult> {
  const ref = request.ref.trim()
  const serviceId = request.serviceId?.trim() || '@serviceadmin'
  const reason = request.reason.trim()
  const requestId =
    request.requestId?.trim() ||
    `service-admin-reveal-${Date.now().toString(36)}`
  const normalizedRequest: Required<SecretsBrokerSecretRevealRequest> = {
    ref,
    serviceId,
    reason,
    requestId,
  }

  if (isServiceAdminStubModeEnabled()) {
    return {
      state: 'unsupported',
      summary:
        'Explicit Service Admin stub mode is enabled; live broker reveal was not requested.',
      requestId,
      ref: ref || 'stub-mode',
      operation: 'reveal',
      mode: 'apply',
      outcome: 'stub_mode',
      auditStatus: 'stub-mode',
      nextAction: 'disable_stub_mode_for_live_reveal',
      ttlSeconds: 0,
      valueStatus: 'not_requested',
      affectedRefs: ref ? [ref] : [],
      affectedServices: [serviceId],
      lockoutActive: false,
      retryAfterSeconds: 0,
      stubMode: true,
    }
  }

  if (!ref || !reason) {
    return {
      state: 'unsupported',
      summary:
        'A managed secret ref and audit reason are required before live reveal can be requested.',
      requestId,
      ref: ref || 'unknown-ref',
      operation: 'reveal',
      mode: 'apply',
      outcome: 'reveal_not_ready',
      auditStatus: 'audit-unavailable',
      nextAction: 'complete_reveal_gate',
      ttlSeconds: 0,
      valueStatus: 'not_requested',
      affectedRefs: ref ? [ref] : [],
      affectedServices: [serviceId],
      lockoutActive: false,
      retryAfterSeconds: 0,
      stubMode: false,
    }
  }

  try {
    const payload = await postJson<RawManagedSecretRevealResponse>(
      `/api/services/${encodeServiceId('@secretsbroker')}/proxy/v1/management/secrets/reveal`,
      {
        requestId,
        serviceId,
        ref,
        reason,
      }
    )

    return normalizeRevealResponse(payload, normalizedRequest)
  } catch (error) {
    const status =
      error instanceof Error && 'status' in error
        ? (error as HttpJsonError).status
        : undefined

    return {
      state: status === 404 ? 'unsupported' : 'unavailable',
      summary:
        status === 404
          ? 'Secrets Broker live reveal route is not exposed by the runtime yet.'
          : 'Secrets Broker live reveal route is unavailable.',
      requestId,
      ref,
      operation: 'reveal',
      mode: 'apply',
      outcome: status === 404 ? 'unsupported' : 'unavailable',
      auditStatus: 'audit-unavailable',
      nextAction:
        status === 404 ? 'inspect_capability' : 'retry_or_inspect_status',
      ttlSeconds: 0,
      valueStatus: 'not_available',
      affectedRefs: ref ? [ref] : [],
      affectedServices: [serviceId],
      lockoutActive: false,
      retryAfterSeconds: 0,
      stubMode: false,
    }
  }
}

export async function fetchSecretsBrokerSecretOperationStatus(
  operationId: string
): Promise<SecretsBrokerSecretOperationStatusResult> {
  const normalizedOperationId = operationId.trim()
  const checkedAt = new Date().toISOString()

  if (isServiceAdminStubModeEnabled()) {
    return {
      state: 'unsupported',
      summary:
        'Explicit Service Admin stub mode is enabled; live operation status was not requested.',
      operationId: normalizedOperationId,
      ref: 'stub-mode',
      operation: 'stub-mode',
      status: 'stub_mode',
      outcome: 'stub_mode',
      terminal: false,
      retrySafe: false,
      auditStatus: 'stub-mode',
      correlationId: 'stub-mode',
      nextAction: 'disable_stub_mode_for_live_status',
      checkedAt,
      stubMode: true,
    }
  }

  if (!normalizedOperationId) {
    return {
      state: 'unsupported',
      summary:
        'A broker operation id is required before live status can be read.',
      operationId: '',
      ref: 'unknown-ref',
      operation: 'unknown-operation',
      status: 'invalid_operation_id',
      outcome: 'invalid_operation_id',
      terminal: true,
      retrySafe: false,
      auditStatus: 'audit-unavailable',
      correlationId: 'unavailable',
      nextAction: 'select_operation_id',
      checkedAt,
      stubMode: false,
    }
  }

  try {
    const payload = await fetchJson<RawManagedSecretOperationStatusResponse>(
      `/api/services/${encodeServiceId('@secretsbroker')}/proxy/v1/management/secret-operations/${encodeURIComponent(normalizedOperationId)}`
    )

    return normalizeOperationStatusResponse(payload, normalizedOperationId)
  } catch (error) {
    const status =
      error instanceof Error && 'status' in error
        ? (error as HttpJsonError).status
        : undefined

    return {
      state: status === 404 ? 'unsupported' : 'unavailable',
      summary:
        status === 404
          ? 'Secrets Broker live operation status route is not exposed by the runtime yet.'
          : 'Secrets Broker live operation status route is unavailable.',
      operationId: normalizedOperationId,
      ref: 'unknown-ref',
      operation: 'unknown-operation',
      status: status === 404 ? 'unsupported' : 'unavailable',
      outcome: status === 404 ? 'unsupported' : 'unavailable',
      terminal: true,
      retrySafe: false,
      auditStatus: 'audit-unavailable',
      correlationId: 'unavailable',
      nextAction:
        status === 404 ? 'inspect_capability' : 'retry_or_inspect_status',
      checkedAt,
      stubMode: false,
    }
  }
}

export async function submitSecretsBrokerSecretApply(
  request: SecretsBrokerSecretApplyRequest
): Promise<SecretsBrokerSecretOperationStatusResult> {
  const ref = request.ref.trim()
  const operationId = request.operationId.trim()
  const serviceId = request.serviceId?.trim() || '@serviceadmin'
  const reason = request.reason.trim()
  const requestId =
    request.requestId?.trim() ||
    `service-admin-${request.action}-apply-${Date.now().toString(36)}`
  const checkedAt = new Date().toISOString()

  if (isServiceAdminStubModeEnabled()) {
    return {
      state: 'unsupported',
      summary:
        'Explicit Service Admin stub mode is enabled; live broker apply was not requested.',
      operationId,
      ref: ref || 'stub-mode',
      operation: request.action,
      status: 'stub_mode',
      outcome: 'stub_mode',
      terminal: true,
      retrySafe: false,
      auditStatus: 'stub-mode',
      correlationId: 'stub-mode',
      nextAction: 'disable_stub_mode_for_live_apply',
      checkedAt,
      stubMode: true,
    }
  }

  if (!ref || !operationId || !reason) {
    return {
      state: 'unsupported',
      summary:
        'A managed secret ref, broker operation id, and audit reason are required before live apply can be submitted.',
      operationId,
      ref: ref || 'unknown-ref',
      operation: request.action,
      status: 'apply_not_ready',
      outcome: 'apply_not_ready',
      terminal: true,
      retrySafe: false,
      auditStatus: 'audit-unavailable',
      correlationId: 'unavailable',
      nextAction: 'complete_apply_gate',
      checkedAt,
      stubMode: false,
    }
  }

  try {
    const payload = await postJson<RawManagedSecretOperationStatusResponse>(
      applyEndpointForAction(request.action),
      {
        requestId,
        serviceId,
        ref,
        operationId,
        reason,
        confirm: true,
      }
    )

    return normalizeOperationStatusResponse(payload, operationId)
  } catch (error) {
    const status =
      error instanceof Error && 'status' in error
        ? (error as HttpJsonError).status
        : undefined

    return {
      state: status === 404 ? 'unsupported' : 'unavailable',
      summary:
        status === 404
          ? 'Secrets Broker live apply route is not exposed by the runtime yet.'
          : 'Secrets Broker live apply route is unavailable.',
      operationId,
      ref,
      operation: request.action,
      status: status === 404 ? 'unsupported' : 'unavailable',
      outcome: status === 404 ? 'unsupported' : 'unavailable',
      terminal: true,
      retrySafe: false,
      auditStatus: 'audit-unavailable',
      correlationId: 'unavailable',
      nextAction:
        status === 404 ? 'inspect_capability' : 'retry_or_inspect_status',
      checkedAt,
      stubMode: false,
    }
  }
}
