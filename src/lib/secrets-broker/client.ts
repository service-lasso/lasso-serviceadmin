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
  capabilities: Record<string, boolean>
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

type RuntimeServiceResponse = {
  service?: DashboardService | null
}

type RawBrokerSource = {
  id?: unknown
  name?: unknown
  label?: unknown
  provider?: unknown
  type?: unknown
  state?: unknown
  status?: unknown
  reason?: unknown
  message?: unknown
  capabilities?: unknown
}

type RawBrokerSourcesResponse = {
  status?: unknown
  state?: unknown
  summary?: unknown
  reason?: unknown
  sources?: unknown
  capabilities?: unknown
  telemetry?: unknown
  audit?: unknown
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
  if (!isRecord(value)) {
    return {}
  }

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

function normalizeSourceState(value: unknown): SecretsBrokerSourceState {
  const normalized = optionalString(value)?.toLowerCase().replace(/_/g, '-')

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

  if (normalized === 'missing' || normalized === 'unconfigured') {
    return 'setup-needed'
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
  sources: SecretsBrokerSourceStatus[],
  capabilities: Record<string, boolean>
): SecretsBrokerLiveState {
  const normalizedStatus = optionalString(brokerStatus)
    ?.toLowerCase()
    .replace(/_/g, '-')

  if (service.status === 'stopped') {
    return 'unavailable'
  }

  if (service.status === 'degraded') {
    return 'degraded'
  }

  if (normalizedStatus === 'audit-unavailable') {
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

  const blockingSource = sources.find((source) => source.state !== 'ready')
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
    const id =
      optionalString(source.id) ??
      optionalString(source.name) ??
      `source-${index + 1}`
    const provider =
      optionalString(source.provider) ??
      optionalString(source.type) ??
      'unknown'
    const state = normalizeSourceState(source.state ?? source.status)

    return {
      id,
      label: optionalString(source.label) ?? id,
      provider,
      state,
      reason:
        optionalString(source.reason) ??
        optionalString(source.message) ??
        `${provider} source reported ${state}.`,
      capabilities: normalizeCapabilities(source.capabilities),
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

  if (normalizedStatus === 'locked') return 'locked'
  if (normalizedStatus === 'auth-required') return 'auth-required'
  if (normalizedStatus === 'policy-denied') return 'policy-denied'
  if (normalizedStatus === 'unsupported') return 'unsupported'
  if (normalizedStatus === 'audit-unavailable') return 'audit-unavailable'

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

function buildUnsupportedOverview(
  service: DashboardService,
  checkedAt: string,
  status?: number
): SecretsBrokerOverview {
  return {
    state: 'unsupported',
    summary:
      status === 404
        ? 'Secrets Broker live source status route is not exposed by the runtime yet.'
        : 'Secrets Broker live source status route is unavailable.',
    service,
    checkedAt,
    sourceCount: 0,
    sources: [],
    capabilities: {
      sourcesStatus: false,
      managementSecrets: false,
      providerConfig: false,
      reveal: false,
      mutation: false,
    },
    telemetryAvailable: false,
    auditAvailable: false,
    stubMode: false,
  }
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
          capabilities: {
            reveal: false,
            mutation: false,
            dryRun: true,
          },
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
      stubMode: false,
    }
  }

  try {
    const brokerStatus = await fetchJson<RawBrokerSourcesResponse>(
      `/api/services/${encodeServiceId('@secretsbroker')}/proxy/v1/sources/status`
    )
    const sources = normalizeSources(brokerStatus.sources)
    const capabilities = {
      sourcesStatus: true,
      ...normalizeCapabilities(brokerStatus.capabilities),
    }
    const telemetryAvailable =
      isRecord(brokerStatus.telemetry) &&
      brokerStatus.telemetry.available === true
    const auditAvailable =
      isRecord(brokerStatus.audit) && brokerStatus.audit.available === true

    return {
      state: normalizeOverviewState(
        service,
        brokerStatus.state ?? brokerStatus.status,
        sources,
        capabilities
      ),
      summary:
        optionalString(brokerStatus.summary) ??
        optionalString(brokerStatus.reason) ??
        'Secrets Broker live metadata was read from the runtime proxy.',
      service,
      checkedAt,
      sourceCount: sources.length,
      sources,
      capabilities,
      telemetryAvailable,
      auditAvailable,
      stubMode: false,
    }
  } catch (error) {
    const status =
      error instanceof Error && 'status' in error
        ? (error as HttpJsonError).status
        : undefined

    return buildUnsupportedOverview(service, checkedAt, status)
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
