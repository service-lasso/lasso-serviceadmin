/**
 * Live Secrets Broker operator client ported from Admin 478 (develop 417c7b5).
 * Isolated from the master dashboard stub so packaged master UI keeps its
 * existing secrets-broker pages while gaining 478 alias/lifecycle APIs.
 */
import { withLocalOperatorRequestInit } from './local-operator-session'
import {
  requireSafeBrokerIdentifier,
  sanitizeBrokerDisplayText,
  validateBrokerSearchInput,
  withheldBrokerText,
} from './secrets-safe-text'
import type {
  BrokerBulkCampaignItem,
  BrokerBulkCampaignRequest,
  BrokerBulkCampaignResult,
  BrokerEventFilters,
  BrokerEventsResult,
  BrokerLockoutClearRequest,
  BrokerLockoutClearResult,
  BrokerMigrationItem,
  BrokerMigrationRequest,
  BrokerMigrationResult,
  BrokerOperationCapability,
  BrokerProviderStatus,
  BrokerProviderStatusState,
  BrokerProviderValidationRequest,
  BrokerProviderValidationResult,
  BrokerLifecycleBackup,
  BrokerLifecycleBackupResult,
  BrokerLifecycleOperationRequest,
  BrokerLifecycleRestoreResult,
  BrokerLifecycleRotateResult,
  BrokerLifecycleStatus,
  BrokerTelemetry,
  CoreSecretRotationExecutionRequest,
  CoreSecretRotationExecutionState,
  CoreSecretRotationImpactPlan,
  SecretCreatePlan,
  SecretCreateRequest,
  SecretCreateResult,
  SecretDecommissionPlan,
  SecretDecommissionRequest,
  SecretDecommissionResult,
  SecretMutationRequest,
  SecretMutationResult,
  SecretPolicyPreviewRequest,
  SecretPolicyPreviewResult,
  SecretRevealRequest,
  SecretRevealResult,
  SecretRotationPreviewRequest,
  SecretRotationPreviewResult,
  SecretRotationVersionMetadata,
  SecretRotationVersionRequest,
  SecretRotationVersionResult,
  SecretsManagementState,
} from './types'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type RuntimeApiEnvironment = {
  DEV?: boolean
  VITE_SERVICE_LASSO_API_BASE_URL?: string
  VITE_SERVICE_LASSO_ENABLE_STUB_DATA?: string
}

export type RuntimeApiMode = 'local-dev' | 'packaged-runtime'

export type RuntimeApiUnavailableDetails = {
  mode: RuntimeApiMode
  path: string
  endpoint: string | null
  status: number | null
  contentType: string | null
  packagedProxyConfigured: boolean
  reason: 'missing_api_base_url' | 'fetch_failed' | 'http_error' | 'non_json'
}

export class RuntimeApiUnavailableError extends Error {
  readonly details: RuntimeApiUnavailableDetails

  constructor(details: RuntimeApiUnavailableDetails, cause?: unknown) {
    const endpoint = details.endpoint ?? details.path
    const metadata = [
      `path ${details.path}`,
      details.status == null ? null : `status ${details.status}`,
      details.contentType ? `content-type ${details.contentType}` : null,
    ]
      .filter(Boolean)
      .join(', ')
    super(
      `Service Lasso runtime API unavailable for ${endpoint}: ${details.reason}${
        metadata ? ` (${metadata})` : ''
      }.`
    )
    this.name = 'RuntimeApiUnavailableError'
    this.details = details
    if (cause) {
      Object.defineProperty(this, 'cause', {
        value: cause,
        configurable: true,
        writable: true,
      })
    }
  }
}

export function resolveRuntimeApiMode(
  env: RuntimeApiEnvironment = import.meta.env
): RuntimeApiMode {
  return env.DEV ? 'local-dev' : 'packaged-runtime'
}

export function resolveServiceLassoApiBaseUrl(
  env: RuntimeApiEnvironment = import.meta.env
) {
  const configured = env.VITE_SERVICE_LASSO_API_BASE_URL?.replace(/\/$/, '')
  if (configured) return configured
  return resolveRuntimeApiMode(env) === 'packaged-runtime' ? '' : null
}

export function isServiceLassoStubDataEnabled(
  env: RuntimeApiEnvironment = import.meta.env
) {
  return (
    resolveRuntimeApiMode(env) === 'local-dev' &&
    env.VITE_SERVICE_LASSO_ENABLE_STUB_DATA === 'true'
  )
}

export const serviceLassoApiBaseUrl = resolveServiceLassoApiBaseUrl()

export const serviceLassoStubDataEnabled = isServiceLassoStubDataEnabled()

const secretsBrokerServiceId = '@secretsbroker'

const secretsManagementFixture: SecretsManagementState = {
  serviceId: secretsBrokerServiceId,
  apiVersion: 'secretsbroker.local/v1',
  query: '',
  valueSearch: false,
  outcome: 'ready',
  results: [
    {
      ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
      name: 'SESSION_SIGNING_KEY',
      sourceId: 'local',
      providerKind: 'local-encrypted-store',
      ownerServiceId: '@serviceadmin',
      workspaceId: 'local',
      state: 'present',
      outcome: 'ready',
      capabilities: [
        'metadata',
        'reveal',
        'edit',
        'reset',
        'rotation',
        'decommission',
        'policy',
      ],
      policy: 'local-writeback-policy',
      auditStatus: 'audit_available',
      valueSearch: 'supported',
    },
    {
      ref: 'zitadel/traefik-oidc-auth/client-secret',
      name: 'client-secret',
      sourceId: 'vault-auth',
      providerKind: 'vault',
      ownerServiceId: '@traefik',
      workspaceId: 'local',
      state: 'auth_required',
      outcome: 'source_auth_required',
      capabilities: ['metadata'],
      policy: 'provider-policy',
      auditStatus: 'audit_unavailable',
      valueSearch: 'unsupported',
    },
    {
      ref: 'services/archive/runtime/RECOVERABLE_TOKEN',
      name: 'RECOVERABLE_TOKEN',
      sourceId: 'local',
      providerKind: 'local-encrypted-store',
      ownerServiceId: 'archive',
      workspaceId: 'local',
      state: 'decommissioned',
      outcome: 'decommissioned',
      capabilities: ['metadata', 'restore'],
      policy: 'local-writeback-policy',
      auditStatus: 'audit_available',
      valueSearch: 'unavailable',
      tombstone: {
        state: 'decommissioned',
        version: 'stub-tombstone-version-1',
        decommissionOperationId: 'stub-decommission-recoverable',
        decommissionedAt: '2026-08-14T00:00:00.000Z',
      },
    },
  ],
}

const brokerProviderStatusFixture: BrokerProviderStatusState = {
  serviceId: secretsBrokerServiceId,
  apiVersion: 'secretsbroker.local/v1',
  contractVersion: '1.0.0',
  manifestVersion: '1.0.0',
  outcome: 'ready',
  currentProvider: {
    providerId: 'local',
    providerKind: 'local-encrypted-store',
    displayName: 'Local encrypted store',
    state: 'ready',
    outcome: 'ready',
    credentialHandle: 'local-master-key',
    namespaces: ['services'],
    capabilities: ['read', 'migration_source'],
    operations: [],
    auditStatus: 'audit_available',
  },
  providers: [
    {
      providerId: 'local',
      providerKind: 'local-encrypted-store',
      displayName: 'Local encrypted store',
      state: 'ready',
      outcome: 'ready',
      credentialHandle: 'local-master-key',
      namespaces: ['services'],
      capabilities: ['read', 'migration_source'],
      operations: [],
      auditStatus: 'audit_available',
    },
    {
      providerId: 'vault-target',
      providerKind: 'vault',
      displayName: 'Vault migration target',
      state: 'ready',
      outcome: 'ready',
      credentialHandle: 'configured-ref-or-env',
      address: 'https://vault.example.invalid',
      namespaces: ['services'],
      capabilities: ['read', 'migration'],
      operations: [
        {
          operationId: 'post_v1_providers_migration_apply',
          method: 'POST',
          path: '/v1/providers/migration/apply',
          maturity: 'validated',
          classification: 'mutation',
          authenticationRequired: true,
          policyRequired: true,
          auditRequired: true,
          scope: 'provider-remote',
          completionMode: 'synchronous',
          limitationCode: 'runtime_auth_policy_audit_revalidated',
          reasonCode: 'validated',
          nextAction: 'execute_guarded_operation',
        },
      ],
      auditStatus: 'audit_available',
    },
  ],
}

function buildRuntimeEndpoint(path: string, apiBaseUrl: string) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export async function fetchRuntimeJson<T>(
  path: string,
  options?: {
    apiBaseUrl?: string | null
    mode?: RuntimeApiMode
    method?: string
    headers?: HeadersInit
    body?: BodyInit | null
  }
) {
  const apiBaseUrl =
    options?.apiBaseUrl === undefined
      ? serviceLassoApiBaseUrl
      : options.apiBaseUrl
  const mode = options?.mode ?? resolveRuntimeApiMode()
  const detailsBase = {
    mode,
    path,
    endpoint:
      apiBaseUrl == null ? null : buildRuntimeEndpoint(path, apiBaseUrl),
    status: null,
    contentType: null,
    packagedProxyConfigured: mode === 'packaged-runtime' && apiBaseUrl === '',
  } satisfies Omit<RuntimeApiUnavailableDetails, 'reason'>

  if (apiBaseUrl == null) {
    throw new RuntimeApiUnavailableError({
      ...detailsBase,
      reason: 'missing_api_base_url',
    })
  }

  let response: Response
  const endpoint = buildRuntimeEndpoint(path, apiBaseUrl)
  const requestDetails = {
    ...detailsBase,
    endpoint,
  }
  const requestInit: RequestInit = withLocalOperatorRequestInit({
    method: options?.method,
    headers: options?.headers,
    body: options?.body,
  })

  try {
    response = await fetch(endpoint, requestInit)
  } catch (error) {
    throw new RuntimeApiUnavailableError(
      {
        ...requestDetails,
        reason: 'fetch_failed',
      },
      error
    )
  }

  const contentType = response.headers.get('content-type')
  const responseDetails = {
    ...requestDetails,
    status: response.status,
    contentType,
  }

  if (!response.ok) {
    throw new RuntimeApiUnavailableError({
      ...responseDetails,
      reason: 'http_error',
    })
  }

  if (!contentType?.toLowerCase().includes('application/json')) {
    throw new RuntimeApiUnavailableError({
      ...responseDetails,
      reason: 'non_json',
    })
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new RuntimeApiUnavailableError(
      {
        ...responseDetails,
        reason: 'non_json',
      },
      error
    )
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}

function buildSecretsManagementApiPath(section: string, search?: string) {
  const path = `/api/services/${encodeURIComponent(secretsBrokerServiceId)}/secrets/${section}`
  if (!search?.trim()) return path
  return `${path}?search=${encodeURIComponent(search.trim())}`
}

function buildBrokerProviderApiPath(section: string) {
  return `/api/services/${encodeURIComponent(secretsBrokerServiceId)}/providers/${section}`
}

function buildBrokerLifecycleApiPath(section: string) {
  return `/api/services/${encodeURIComponent(secretsBrokerServiceId)}/lifecycle/${section}`
}

function buildBrokerOperationsApiPath(section: string) {
  return `/api/services/${encodeURIComponent(secretsBrokerServiceId)}/operations/${section}`
}

function requireRecord(value: unknown, message: string) {
  if (!isRecord(value)) throw new Error(message)
  return value
}

function requireIdentifierArray(
  value: unknown,
  field: string,
  options: { allowWildcard?: boolean } = {}
) {
  if (!Array.isArray(value)) {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  return value.map((item) =>
    options.allowWildcard && item === '*'
      ? '*'
      : requireSafeBrokerIdentifier(item, field)
  )
}

export function normalizeSecretsManagementState(
  payload: unknown
): SecretsManagementState {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid management response.'
  )
  if (!Array.isArray(input.results) || typeof input.valueSearch !== 'boolean') {
    throw new Error('Secrets Broker returned an invalid management response.')
  }

  return {
    serviceId: requireSafeBrokerIdentifier(input.serviceId, 'service id'),
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    query:
      typeof input.query === 'string'
        ? sanitizeBrokerDisplayText(input.query)
        : undefined,
    valueSearch: input.valueSearch,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    results: input.results.map((entry) => {
      const record = requireRecord(
        entry,
        'Secrets Broker returned an invalid managed secret record.'
      )
      const tombstone =
        record.tombstone === undefined
          ? undefined
          : (() => {
              const value = requireRecord(
                record.tombstone,
                'Secrets Broker returned invalid tombstone inventory metadata.'
              )
              if (
                value.state !== 'decommissioned' ||
                typeof value.version !== 'string' ||
                typeof value.decommissionOperationId !== 'string' ||
                typeof value.decommissionedAt !== 'string' ||
                Number.isNaN(Date.parse(value.decommissionedAt))
              ) {
                throw new Error(
                  'Secrets Broker returned invalid tombstone inventory metadata.'
                )
              }
              return {
                state: 'decommissioned',
                version: requireSafeBrokerIdentifier(
                  value.version,
                  'tombstone version'
                ),
                decommissionOperationId: requireSafeBrokerIdentifier(
                  value.decommissionOperationId,
                  'decommission operation id'
                ),
                decommissionedAt: value.decommissionedAt,
              }
            })()
      return {
        ref: requireSafeBrokerIdentifier(record.ref, 'secret ref'),
        name: requireSafeBrokerIdentifier(record.name, 'secret name'),
        sourceId: requireSafeBrokerIdentifier(record.sourceId, 'source id'),
        providerKind: requireSafeBrokerIdentifier(
          record.providerKind,
          'provider kind'
        ),
        ownerServiceId:
          record.ownerServiceId === undefined
            ? undefined
            : requireSafeBrokerIdentifier(
                record.ownerServiceId,
                'owner service id'
              ),
        workspaceId:
          record.workspaceId === undefined
            ? undefined
            : requireSafeBrokerIdentifier(record.workspaceId, 'workspace id'),
        state:
          sanitizeBrokerDisplayText(record.state) ?? '[missing broker state]',
        outcome:
          sanitizeBrokerDisplayText(record.outcome) ??
          '[missing broker outcome]',
        capabilities: requireIdentifierArray(
          record.capabilities,
          'secret capabilities'
        ),
        policy: sanitizeBrokerDisplayText(record.policy),
        auditStatus: sanitizeBrokerDisplayText(record.auditStatus),
        valueSearch: sanitizeBrokerDisplayText(record.valueSearch),
        tombstone,
      }
    }),
  }
}

function normalizeSecretRevealResponse(
  payload: unknown,
  request: SecretRevealRequest
): SecretRevealResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid reveal response.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.ref !== request.ref ||
    input.operation !== 'reveal' ||
    typeof input.value !== 'string' ||
    !input.value ||
    input.value.length > 1_048_576 ||
    !Number.isInteger(input.ttlSeconds) ||
    (input.ttlSeconds as number) < 1 ||
    (input.ttlSeconds as number) > 300
  ) {
    throw new Error('Secrets Broker returned an invalid reveal response.')
  }
  const metadata =
    input.metadata === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(
            requireRecord(
              input.metadata,
              'Secrets Broker returned invalid reveal metadata.'
            )
          ).map(([key, value]) => [
            requireSafeBrokerIdentifier(key, 'reveal metadata key'),
            sanitizeBrokerDisplayText(value) ?? '[missing broker metadata]',
          ])
        )

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    ref: request.ref,
    operation: 'reveal',
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    value: input.value,
    metadata,
    ttlSeconds: input.ttlSeconds as number,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
  }
}

export async function fetchSecretsManagementState(search = '') {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const safeSearch = validateBrokerSearchInput(search)
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('management', safeSearch)
    )
    return structuredClone(normalizeSecretsManagementState(payload))
  }

  const query = search.trim().toLowerCase()
  const results = query
    ? secretsManagementFixture.results.filter((record) =>
        [
          record.ref,
          record.name,
          record.sourceId,
          record.providerKind,
          record.ownerServiceId,
          record.outcome,
        ].some((value) => value?.toLowerCase().includes(query))
      )
    : secretsManagementFixture.results

  return structuredClone({
    ...secretsManagementFixture,
    query: search,
    results,
  })
}

export async function revealManagedSecret(
  request: SecretRevealRequest,
  auditContext?: {
    actorId: string
    actorKind: 'local-root' | 'zitadel' | 'local-token'
    workspaceId?: string
  }
) {
  await wait(120)

  const reason = request.reason.trim()
  if (!reason) {
    throw new Error('Audit reason is required before reveal.')
  }
  if (!request.confirm) {
    throw new Error('Explicit confirmation is required before reveal.')
  }

  if (!serviceLassoStubDataEnabled) {
    if (!auditContext) {
      throw new Error('A trusted runtime identity is required before reveal.')
    }
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('reveal'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: `service-admin-${Date.now()}`,
          serviceId: '@serviceadmin',
          ref: request.ref,
          reason,
          confirm: true,
          actor: auditContext,
        }),
      }
    )
    return structuredClone(normalizeSecretRevealResponse(payload, request))
  }

  const record = secretsManagementFixture.results.find(
    (item) => item.ref === request.ref
  )
  if (
    !record ||
    record.outcome !== 'ready' ||
    !record.capabilities.includes('reveal') ||
    record.auditStatus !== 'audit_available'
  ) {
    throw new Error('Secret reveal is not available for this record.')
  }

  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-reveal-${Date.now()}`,
    ref: request.ref,
    operation: 'reveal',
    outcome: 'ready',
    value: 'fixture-revealed-value-425',
    metadata: {
      sourceId: record.sourceId,
      providerKind: record.providerKind,
    },
    ttlSeconds: 60,
    auditStatus: 'audit_ready',
  } satisfies SecretRevealResult)
}

function normalizeSecretCreateResponse(
  payload: unknown,
  request: SecretCreateRequest,
  mode: 'dry-run' | 'apply'
): SecretCreateResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid create response.'
  )
  const planInput = input.plan
  let plan: SecretCreatePlan | undefined
  if (planInput !== undefined) {
    const candidate = requireRecord(
      planInput,
      'Secrets Broker returned an invalid create plan.'
    )
    if (
      candidate.ref !== request.ref ||
      candidate.operationId !== request.operationId ||
      candidate.generationMode !== request.generationMode ||
      candidate.expectedState !== 'missing' ||
      typeof candidate.expiresAt !== 'string' ||
      Number.isNaN(Date.parse(candidate.expiresAt)) ||
      typeof candidate.signature !== 'string' ||
      !candidate.signature.startsWith('hmac-sha256:')
    ) {
      throw new Error('Secrets Broker returned an invalid create plan.')
    }
    plan = {
      ref: request.ref,
      operationId: request.operationId,
      generationMode: request.generationMode,
      expectedState: 'missing',
      expiresAt: candidate.expiresAt,
      signature: candidate.signature,
    }
  }
  if (
    input.serviceId !== secretsBrokerServiceId ||
    typeof input.apiVersion !== 'string' ||
    typeof input.requestId !== 'string' ||
    input.operationId !== request.operationId ||
    input.ref !== request.ref ||
    input.operation !== 'create' ||
    input.mode !== mode ||
    input.generationMode !== request.generationMode ||
    typeof input.outcome !== 'string' ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean' ||
    typeof input.auditStatus !== 'string' ||
    typeof input.policyResult !== 'string' ||
    !Array.isArray(input.affectedRefs) ||
    !input.affectedRefs.every((item) => typeof item === 'string') ||
    !Array.isArray(input.affectedServices) ||
    !input.affectedServices.every((item) => typeof item === 'string') ||
    Object.prototype.hasOwnProperty.call(input, 'value')
  ) {
    throw new Error('Secrets Broker returned an invalid create response.')
  }
  if (mode === 'dry-run' && !plan) {
    throw new Error('Secrets Broker did not return a signed create plan.')
  }
  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    operationId: request.operationId,
    ref: request.ref,
    operation: 'create',
    mode,
    generationMode: request.generationMode,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: input.applied,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    policyResult:
      sanitizeBrokerDisplayText(input.policyResult) ??
      '[missing broker policy result]',
    nextAction:
      typeof input.nextAction === 'string'
        ? sanitizeBrokerDisplayText(input.nextAction)
        : undefined,
    plan,
    affectedRefs: requireIdentifierArray(input.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      input.affectedServices,
      'affected services'
    ),
  }
}

function validateSecretCreateRequest(
  request: SecretCreateRequest,
  apply: boolean
) {
  if (!request.ref.trim() || !request.operationId.trim()) {
    throw new Error('A secret reference and operation id are required.')
  }
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before create.')
  }
  if (
    request.generationMode === 'operator_supplied' &&
    apply &&
    !request.value?.trim()
  ) {
    throw new Error('A secret value is required for operator-supplied create.')
  }
  if (request.generationMode === 'broker_generated' && request.value) {
    throw new Error('Broker-generated create cannot include a secret value.')
  }
}

export async function previewManagedSecretCreate(request: SecretCreateRequest) {
  await wait(120)
  validateSecretCreateRequest(request, false)
  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('create/dry-run'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: `serviceadmin-create-preview-${Date.now()}`,
          serviceId: '@serviceadmin',
          ref: request.ref,
          operationId: request.operationId,
          generationMode: request.generationMode,
          reason: request.reason.trim(),
        }),
      }
    )
    return structuredClone(
      normalizeSecretCreateResponse(payload, request, 'dry-run')
    )
  }
  const plan: SecretCreatePlan = {
    ref: request.ref,
    operationId: request.operationId,
    generationMode: request.generationMode,
    expectedState: 'missing',
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    signature: 'hmac-sha256:stub-create-plan',
  }
  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-create-preview-${Date.now()}`,
    operationId: request.operationId,
    ref: request.ref,
    operation: 'create',
    mode: 'dry-run',
    generationMode: request.generationMode,
    outcome: 'dry_run_ready',
    applied: false,
    requiresConfirmation: true,
    auditStatus: 'audit_recorded',
    policyResult: 'allowed',
    nextAction: 'confirm_signed_plan_before_expiry',
    plan,
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretCreateResult)
}

export async function applyManagedSecretCreate(request: SecretCreateRequest) {
  await wait(120)
  validateSecretCreateRequest(request, true)
  if (!request.plan) {
    throw new Error('A signed create plan is required before apply.')
  }
  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('create/apply'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: `serviceadmin-create-apply-${Date.now()}`,
          serviceId: '@serviceadmin',
          ref: request.ref,
          operationId: request.operationId,
          generationMode: request.generationMode,
          reason: request.reason.trim(),
          confirm: true,
          ...(request.generationMode === 'operator_supplied'
            ? { value: request.value }
            : {}),
          plan: request.plan,
        }),
      }
    )
    return structuredClone(
      normalizeSecretCreateResponse(payload, request, 'apply')
    )
  }
  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-create-apply-${Date.now()}`,
    operationId: request.operationId,
    ref: request.ref,
    operation: 'create',
    mode: 'apply',
    generationMode: request.generationMode,
    outcome: 'applied',
    applied: true,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
    policyResult: 'allowed',
    nextAction: 'secret_created',
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretCreateResult)
}

function validateSecretMutationRequest(
  request: SecretMutationRequest,
  requireValue: boolean
) {
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before mutation.')
  }
  if (requireValue && !request.value?.trim()) {
    throw new Error('A replacement value is required before apply.')
  }
}

function secretMutationPath(
  operation: SecretMutationRequest['operation'],
  action: 'dry-run' | 'apply'
) {
  return buildSecretsManagementApiPath(`${operation}/${action}`)
}

function assertSecretMutationResponse(
  payload: unknown,
  request: SecretMutationRequest,
  mode: 'dry-run' | 'apply'
): SecretMutationResult {
  if (!isRecord(payload)) {
    throw new Error('Secrets Broker returned an invalid mutation response.')
  }
  const expectedMode = mode === 'apply' ? 'apply' : 'dry-run'
  if (
    payload.serviceId !== secretsBrokerServiceId ||
    typeof payload.apiVersion !== 'string' ||
    typeof payload.requestId !== 'string' ||
    payload.ref !== request.ref ||
    payload.operation !== request.operation ||
    payload.mode !== expectedMode ||
    typeof payload.outcome !== 'string' ||
    typeof payload.applied !== 'boolean' ||
    typeof payload.requiresConfirmation !== 'boolean' ||
    typeof payload.auditStatus !== 'string' ||
    !Array.isArray(payload.affectedRefs) ||
    !payload.affectedRefs.every((item) => typeof item === 'string') ||
    !Array.isArray(payload.affectedServices) ||
    !payload.affectedServices.every((item) => typeof item === 'string') ||
    Object.prototype.hasOwnProperty.call(payload, 'value')
  ) {
    throw new Error('Secrets Broker returned an invalid mutation response.')
  }

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: payload.apiVersion,
    requestId: payload.requestId,
    ref: request.ref,
    operation: request.operation,
    mode: expectedMode,
    outcome:
      sanitizeBrokerDisplayText(payload.outcome) ?? '[missing broker outcome]',
    applied: payload.applied,
    requiresConfirmation: payload.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(payload.auditStatus) ??
      '[missing broker audit status]',
    nextAction:
      typeof payload.nextAction === 'string'
        ? sanitizeBrokerDisplayText(payload.nextAction)
        : undefined,
    affectedRefs: requireIdentifierArray(payload.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      payload.affectedServices,
      'affected services'
    ),
  }
}

export async function previewManagedSecretMutation(
  request: SecretMutationRequest
) {
  await wait(120)
  validateSecretMutationRequest(request, false)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      secretMutationPath(request.operation, 'dry-run'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          reason: request.reason.trim(),
        }),
      }
    )
    return assertSecretMutationResponse(payload, request, 'dry-run')
  }

  const record = secretsManagementFixture.results.find(
    (item) => item.ref === request.ref
  )
  if (
    !record ||
    record.outcome !== 'ready' ||
    record.providerKind !== 'local-encrypted-store' ||
    !record.capabilities.includes(request.operation) ||
    record.auditStatus !== 'audit_available'
  ) {
    throw new Error('Secret mutation is not available for this record.')
  }

  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-${request.operation}-preview-${Date.now()}`,
    ref: request.ref,
    operation: request.operation,
    mode: 'dry-run',
    outcome: 'dry_run_ready',
    applied: false,
    requiresConfirmation: true,
    auditStatus: 'audit_ready',
    nextAction: 'confirm_and_apply_with_audit_reason',
    affectedRefs: [request.ref],
    affectedServices: record.ownerServiceId ? [record.ownerServiceId] : [],
  } satisfies SecretMutationResult)
}

export async function applyManagedSecretMutation(
  request: SecretMutationRequest
) {
  await wait(120)
  validateSecretMutationRequest(request, true)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      secretMutationPath(request.operation, 'apply'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          reason: request.reason.trim(),
          confirm: true,
          value: request.value,
        }),
      }
    )
    return assertSecretMutationResponse(payload, request, 'apply')
  }

  await previewManagedSecretMutation(request)
  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-${request.operation}-apply-${Date.now()}`,
    ref: request.ref,
    operation: request.operation,
    mode: 'apply',
    outcome: 'applied',
    applied: true,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretMutationResult)
}

function normalizeSecretPolicyPreviewResponse(
  payload: unknown,
  request: SecretPolicyPreviewRequest
): SecretPolicyPreviewResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid policy preview.'
  )
  const record = requireRecord(
    input.record,
    'Secrets Broker returned an invalid policy preview record.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.ref !== request.ref ||
    input.operation !== 'policy' ||
    input.mode !== 'preview' ||
    input.outcome !== 'unsupported' ||
    input.applied !== false ||
    input.requiresConfirmation !== false ||
    input.unsupportedCapability !== 'policy_binding_persistence' ||
    record.ref !== request.ref ||
    Object.prototype.hasOwnProperty.call(input, 'value') ||
    Object.prototype.hasOwnProperty.call(input, 'payload') ||
    Object.prototype.hasOwnProperty.call(record, 'value') ||
    Object.prototype.hasOwnProperty.call(record, 'payload')
  ) {
    throw new Error('Secrets Broker returned an invalid policy preview.')
  }

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    ref: request.ref,
    operation: 'policy',
    mode: 'preview',
    outcome: 'unsupported',
    applied: false,
    requiresConfirmation: false,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    nextAction:
      sanitizeBrokerDisplayText(input.nextAction) ??
      '[missing broker next action]',
    unsupportedCapability: 'policy_binding_persistence',
    currentPolicy: sanitizeBrokerDisplayText(record.policy),
    affectedRefs: requireIdentifierArray(input.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      input.affectedServices,
      'affected services'
    ),
  }
}

export async function previewManagedSecretPolicy(
  request: SecretPolicyPreviewRequest
) {
  await wait(120)
  requireSafeBrokerIdentifier(request.ref, 'secret ref')

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('policy/preview'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: request.ref }),
      }
    )
    return normalizeSecretPolicyPreviewResponse(payload, request)
  }

  const record = secretsManagementFixture.results.find(
    (item) => item.ref === request.ref
  )
  if (
    !record ||
    record.outcome !== 'ready' ||
    !record.capabilities.includes('policy') ||
    record.auditStatus !== 'audit_available'
  ) {
    throw new Error('Secret policy status is not available for this record.')
  }

  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-policy-preview-${Date.now()}`,
    ref: request.ref,
    operation: 'policy',
    mode: 'preview',
    outcome: 'unsupported',
    applied: false,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
    nextAction: 'wait_for_policy_binding_persistence',
    unsupportedCapability: 'policy_binding_persistence',
    currentPolicy: record.policy,
    affectedRefs: [request.ref],
    affectedServices: record.ownerServiceId ? [record.ownerServiceId] : [],
  } satisfies SecretPolicyPreviewResult)
}

function normalizeBrokerOperationCapability(
  value: unknown
): BrokerOperationCapability {
  const input = requireRecord(
    value,
    'Secrets Broker returned an invalid provider operation.'
  )
  if (
    typeof input.authenticationRequired !== 'boolean' ||
    typeof input.policyRequired !== 'boolean' ||
    typeof input.auditRequired !== 'boolean'
  ) {
    throw new Error('Secrets Broker returned an invalid provider operation.')
  }
  return {
    operationId: requireSafeBrokerIdentifier(
      input.operationId,
      'provider operation id'
    ),
    method: requireSafeBrokerIdentifier(input.method, 'provider method'),
    path: requireSafeBrokerIdentifier(input.path, 'provider operation path'),
    maturity: requireSafeBrokerIdentifier(
      input.maturity,
      'provider operation maturity'
    ),
    classification: requireSafeBrokerIdentifier(
      input.classification,
      'provider operation classification'
    ),
    authenticationRequired: input.authenticationRequired,
    policyRequired: input.policyRequired,
    auditRequired: input.auditRequired,
    scope: requireSafeBrokerIdentifier(input.scope, 'provider operation scope'),
    completionMode: requireSafeBrokerIdentifier(
      input.completionMode,
      'provider completion mode'
    ),
    limitationCode: requireSafeBrokerIdentifier(
      input.limitationCode,
      'provider limitation code',
      { allowEmpty: true }
    ),
    reasonCode: requireSafeBrokerIdentifier(
      input.reasonCode,
      'provider reason code',
      { allowEmpty: true }
    ),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'provider next action',
      { allowEmpty: true }
    ),
  }
}

function normalizeBrokerProviderStatus(value: unknown): BrokerProviderStatus {
  const input = requireRecord(
    value,
    'Secrets Broker returned an invalid provider status.'
  )
  if (!Array.isArray(input.operations)) {
    throw new Error('Secrets Broker returned an invalid provider status.')
  }
  return {
    providerId: requireSafeBrokerIdentifier(input.providerId, 'provider id'),
    providerKind: requireSafeBrokerIdentifier(
      input.providerKind,
      'provider kind'
    ),
    displayName:
      sanitizeBrokerDisplayText(input.displayName) ?? '[missing provider name]',
    state: sanitizeBrokerDisplayText(input.state) ?? '[missing provider state]',
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing provider outcome]',
    credentialHandle: sanitizeBrokerDisplayText(input.credentialHandle),
    address: sanitizeBrokerDisplayText(input.address),
    namespaces: requireIdentifierArray(
      input.namespaces,
      'provider namespaces',
      {
        allowWildcard: true,
      }
    ),
    capabilities: requireIdentifierArray(
      input.capabilities,
      'provider capabilities'
    ),
    operations: input.operations.map(normalizeBrokerOperationCapability),
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
  }
}

function assertNoProviderSecretFields(value: Record<string, unknown>) {
  const forbidden = new Set([
    'credentialvalue',
    'token',
    'password',
    'passphrase',
    'secret',
    'secretvalue',
    'value',
    'payload',
    'privatekey',
    'accesskey',
    'secretaccesskey',
    'sessiontoken',
  ])
  for (const field of Object.keys(value)) {
    if (forbidden.has(field.toLowerCase().replace(/[_-]/g, ''))) {
      throw new Error('Secrets Broker returned credential-bearing metadata.')
    }
  }
}

function assertNoBrokerSecretMaterial(value: unknown, depth = 0) {
  if (depth > 16) {
    throw new Error('Secrets Broker returned excessively nested metadata.')
  }
  if (Array.isArray(value)) {
    for (const item of value) assertNoBrokerSecretMaterial(item, depth + 1)
    return
  }
  if (!isRecord(value)) return
  assertNoProviderSecretFields(value)
  for (const nested of Object.values(value)) {
    assertNoBrokerSecretMaterial(nested, depth + 1)
  }
}

function requireBrokerCount(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  return value
}

function requireBrokerTimestamp(value: unknown, field: string) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  return value
}

function requireBrokerMetadata(value: unknown, field: string) {
  const normalized = sanitizeBrokerDisplayText(value)
  if (!normalized || normalized === withheldBrokerText) {
    throw new Error(`Secrets Broker returned invalid ${field}.`)
  }
  return normalized
}

function containsBrokerControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || code === 0x7f
  })
}

const brokerLockoutScopePattern =
  /^(?:local_api|management|writeback):[-A-Za-z0-9@._:/+~\\]{1,480}$/u

function requireBrokerLockoutScope(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('Secrets Broker returned an invalid lockout scope.')
  }
  const scope = value.trim()
  if (
    !brokerLockoutScopePattern.test(scope) ||
    containsBrokerControlCharacter(scope)
  ) {
    throw new Error('Secrets Broker returned an invalid lockout scope.')
  }
  return scope
}

export function normalizeBrokerTelemetry(payload: unknown): BrokerTelemetry {
  assertNoBrokerSecretMaterial(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid telemetry metadata.'
  )
  const counters = requireRecord(
    input.counters,
    'Secrets Broker returned invalid telemetry counters.'
  )
  const safety = requireRecord(
    input.safety,
    'Secrets Broker returned invalid telemetry safety metadata.'
  )
  if (
    !Array.isArray(counters.operations) ||
    !Array.isArray(counters.policyDecisions) ||
    !Array.isArray(counters.providerStates) ||
    !Array.isArray(counters.sourceStates) ||
    !Array.isArray(counters.auditRecords) ||
    safety.lowCardinalityLabels !== true ||
    safety.valueMaterialIncluded !== false
  ) {
    throw new Error('Secrets Broker telemetry failed its safety contract.')
  }

  const normalizeOutcomeCounter = (value: unknown) => {
    const record = requireRecord(
      value,
      'Secrets Broker returned an invalid telemetry outcome counter.'
    )
    return {
      outcome: requireBrokerMetadata(record.outcome, 'telemetry outcome'),
      count: requireBrokerCount(record.count, 'telemetry count'),
    }
  }
  const normalizeStateCounter = (value: unknown) => {
    const record = requireRecord(
      value,
      'Secrets Broker returned an invalid telemetry state counter.'
    )
    return {
      id: requireSafeBrokerIdentifier(record.id, 'telemetry state id'),
      state: requireBrokerMetadata(record.state, 'telemetry state'),
      outcome: requireBrokerMetadata(record.outcome, 'telemetry outcome'),
      count: requireBrokerCount(record.count, 'telemetry count'),
    }
  }

  return {
    serviceId: requireSafeBrokerIdentifier(
      input.serviceId,
      'telemetry service id'
    ) as '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(
      input.apiVersion,
      'telemetry API version'
    ),
    contractVersion: requireSafeBrokerIdentifier(
      input.contractVersion,
      'telemetry contract version'
    ),
    outcome: requireBrokerMetadata(input.outcome, 'telemetry outcome'),
    generatedAt: requireBrokerTimestamp(
      input.generatedAt,
      'telemetry timestamp'
    ),
    counters: {
      operations: counters.operations.map((value) => {
        const record = requireRecord(
          value,
          'Secrets Broker returned an invalid operation counter.'
        )
        return {
          operation: requireSafeBrokerIdentifier(
            record.operation,
            'telemetry operation'
          ),
          outcome: requireBrokerMetadata(
            record.outcome,
            'telemetry operation outcome'
          ),
          count: requireBrokerCount(record.count, 'telemetry operation count'),
        }
      }),
      policyDecisions: counters.policyDecisions.map(normalizeOutcomeCounter),
      localApiAuthFailures: requireBrokerCount(
        counters.localApiAuthFailures,
        'local API auth failure count'
      ),
      activeLockouts: requireBrokerCount(
        counters.activeLockouts,
        'active lockout count'
      ),
      providerStates: counters.providerStates.map(normalizeStateCounter),
      sourceStates: counters.sourceStates.map(normalizeStateCounter),
      auditRecords: counters.auditRecords.map((value) => {
        const record = requireRecord(
          value,
          'Secrets Broker returned an invalid audit counter.'
        )
        return {
          auditStatus: requireBrokerMetadata(
            record.auditStatus,
            'telemetry audit status'
          ),
          outcome: requireBrokerMetadata(
            record.outcome,
            'telemetry audit outcome'
          ),
          count: requireBrokerCount(record.count, 'telemetry audit count'),
        }
      }),
    },
    safety: {
      lowCardinalityLabels: true,
      valueMaterialIncluded: false,
    },
  }
}

export function normalizeBrokerEvents(payload: unknown): BrokerEventsResult {
  assertNoBrokerSecretMaterial(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid operational events.'
  )
  const safety = requireRecord(
    input.safety,
    'Secrets Broker returned invalid event safety metadata.'
  )
  if (
    !Array.isArray(input.events) ||
    safety.metadataOnly !== true ||
    safety.rawRefIncluded !== false ||
    safety.valueMaterialIncluded !== false
  ) {
    throw new Error(
      'Secrets Broker events failed their metadata-only contract.'
    )
  }
  const optionalIdentifier = (value: unknown, field: string) =>
    value === undefined || value === ''
      ? undefined
      : requireSafeBrokerIdentifier(value, field)
  return {
    serviceId: requireSafeBrokerIdentifier(
      input.serviceId,
      'event service id'
    ) as '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(
      input.apiVersion,
      'event API version'
    ),
    outcome: requireBrokerMetadata(input.outcome, 'event outcome'),
    generatedAt: requireBrokerTimestamp(input.generatedAt, 'event timestamp'),
    limit: requireBrokerCount(input.limit, 'event limit'),
    nextCursor: optionalIdentifier(input.nextCursor, 'event cursor'),
    events: input.events.map((value) => {
      const record = requireRecord(
        value,
        'Secrets Broker returned an invalid operational event.'
      )
      return {
        id: requireSafeBrokerIdentifier(record.id, 'event id'),
        ts: requireBrokerTimestamp(record.ts, 'event timestamp'),
        family: requireSafeBrokerIdentifier(record.family, 'event family'),
        severity: requireSafeBrokerIdentifier(
          record.severity,
          'event severity'
        ),
        operation: requireSafeBrokerIdentifier(
          record.operation,
          'event operation'
        ),
        serviceId: optionalIdentifier(record.serviceId, 'event service id'),
        providerId: optionalIdentifier(record.providerId, 'event provider id'),
        sourceId: optionalIdentifier(record.sourceId, 'event source id'),
        policyId: optionalIdentifier(record.policyId, 'event policy id'),
        keyId: optionalIdentifier(record.keyId, 'event key id'),
        refPrefix: optionalIdentifier(record.refPrefix, 'event ref prefix'),
        refHash: optionalIdentifier(record.refHash, 'event ref hash'),
        outcome: requireBrokerMetadata(record.outcome, 'event outcome'),
        requestId: optionalIdentifier(record.requestId, 'event request id'),
      }
    }),
    safety: {
      metadataOnly: true,
      rawRefIncluded: false,
      valueMaterialIncluded: false,
    },
  }
}

function buildBrokerEventQuery(filters: BrokerEventFilters) {
  const params = new URLSearchParams()
  for (const [name, raw] of Object.entries(filters)) {
    if (raw === undefined || raw === '') continue
    if (name === 'limit') {
      if (!Number.isInteger(raw) || Number(raw) < 1 || Number(raw) > 200) {
        throw new Error('Event limit must be an integer from 1 to 200.')
      }
    }
    const value = String(raw).trim()
    if (value.length > 256 || containsBrokerControlCharacter(value)) {
      throw new Error('Operational event filter contains unsafe input.')
    }
    params.set(name, value)
  }
  return params.size > 0 ? `?${params}` : ''
}

export async function fetchBrokerTelemetry(): Promise<BrokerTelemetry> {
  await wait(120)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      contractVersion: 'service-lasso.secretsbroker.telemetry-preview.v1',
      outcome: 'ready',
      generatedAt: new Date().toISOString(),
      counters: {
        operations: [],
        policyDecisions: [],
        localApiAuthFailures: 0,
        activeLockouts: 0,
        providerStates: [],
        sourceStates: [],
        auditRecords: [],
      },
      safety: { lowCardinalityLabels: true, valueMaterialIncluded: false },
    })
  }
  return normalizeBrokerTelemetry(
    await fetchRuntimeJson<unknown>(buildBrokerOperationsApiPath('telemetry'))
  )
}

export async function fetchBrokerEvents(
  filters: BrokerEventFilters = {}
): Promise<BrokerEventsResult> {
  await wait(120)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      generatedAt: new Date().toISOString(),
      limit: filters.limit ?? 25,
      events: [],
      safety: {
        metadataOnly: true,
        rawRefIncluded: false,
        valueMaterialIncluded: false,
      },
    })
  }
  return normalizeBrokerEvents(
    await fetchRuntimeJson<unknown>(
      `${buildBrokerOperationsApiPath('events')}${buildBrokerEventQuery(filters)}`
    )
  )
}

export async function clearBrokerLockout(
  request: BrokerLockoutClearRequest
): Promise<BrokerLockoutClearResult> {
  const scope = requireBrokerLockoutScope(request.scope)
  if (!request.reason.trim() || request.reason.trim().length > 256) {
    throw new Error('An audit reason is required to clear a lockout.')
  }
  const payload = serviceLassoStubDataEnabled
    ? {
        serviceId: '@secretsbroker',
        apiVersion: 'v1',
        operation: 'lockout_clear',
        outcome: 'not_found',
        cleared: false,
        lockoutScope: scope,
        auditStatus: 'audit_recorded',
        nextAction: 'check_lockout_scope',
      }
    : await fetchRuntimeJson<unknown>(
        buildSecretsManagementApiPath('lockouts/clear'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope,
            reason: request.reason.trim(),
            confirm: true,
          }),
        }
      )
  assertNoBrokerSecretMaterial(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid lockout response.'
  )
  if (
    input.operation !== 'lockout_clear' ||
    typeof input.cleared !== 'boolean' ||
    input.auditStatus !== 'audit_recorded'
  ) {
    throw new Error(
      'Secrets Broker lockout response failed its audit contract.'
    )
  }
  return {
    serviceId: requireSafeBrokerIdentifier(
      input.serviceId,
      'lockout service id'
    ) as '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(
      input.apiVersion,
      'lockout API version'
    ),
    requestId:
      input.requestId === undefined
        ? undefined
        : requireSafeBrokerIdentifier(input.requestId, 'lockout request id'),
    operation: 'lockout_clear',
    outcome: requireBrokerMetadata(input.outcome, 'lockout outcome'),
    cleared: input.cleared,
    lockoutScope: requireBrokerLockoutScope(input.lockoutScope),
    auditStatus: 'audit_recorded',
    nextAction:
      input.nextAction === undefined
        ? undefined
        : requireSafeBrokerIdentifier(input.nextAction, 'lockout next action'),
  }
}

export function providerSupportsMigrationApply(provider: BrokerProviderStatus) {
  return provider.operations.some(
    (operation) =>
      operation.path === '/v1/providers/migration/apply' &&
      (operation.maturity === 'validated' ||
        operation.maturity === 'executable')
  )
}

export async function fetchBrokerProviderStatus() {
  await wait(120)
  if (serviceLassoStubDataEnabled) {
    return structuredClone(brokerProviderStatusFixture)
  }
  const payload = await fetchRuntimeJson<unknown>(
    buildBrokerProviderApiPath('config/status')
  )
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid provider status response.'
  )
  if (!Array.isArray(input.providers)) {
    throw new Error(
      'Secrets Broker returned an invalid provider status response.'
    )
  }
  const providers = input.providers.map(normalizeBrokerProviderStatus)
  const currentProvider = normalizeBrokerProviderStatus(input.currentProvider)
  return {
    serviceId: requireSafeBrokerIdentifier(input.serviceId, 'service id'),
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    contractVersion: requireSafeBrokerIdentifier(
      input.contractVersion,
      'contract version'
    ),
    manifestVersion: requireSafeBrokerIdentifier(
      input.manifestVersion,
      'manifest version'
    ),
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    currentProvider,
    providers,
  } satisfies BrokerProviderStatusState
}

function normalizeProviderValidationResponse(
  payload: unknown,
  request: BrokerProviderValidationRequest
): BrokerProviderValidationResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid provider validation response.'
  )
  assertNoProviderSecretFields(input)
  const provider = normalizeBrokerProviderStatus(input.provider)
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.operation !== 'validate' ||
    input.applied !== false ||
    input.requiresConfirmation !== false ||
    provider.providerId !== request.providerId ||
    provider.providerKind !== request.providerKind
  ) {
    throw new Error(
      'Secrets Broker returned an invalid provider validation response.'
    )
  }
  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    operation: 'validate',
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: false,
    requiresConfirmation: false,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    provider,
  }
}

export async function validateBrokerProviderConfiguration(
  request: BrokerProviderValidationRequest
) {
  await wait(120)
  for (const [label, value] of [
    ['provider id', request.providerId],
    ['provider kind', request.providerKind],
  ] as const) {
    requireSafeBrokerIdentifier(value, label)
  }
  const displayName = sanitizeBrokerDisplayText(request.displayName)
  if (!displayName || displayName === withheldBrokerText) {
    throw new Error('Provider display name is invalid or unsafe.')
  }
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before provider validation.')
  }
  if (request.address) {
    const address = new URL(request.address)
    if (
      !['http:', 'https:'].includes(address.protocol) ||
      address.username ||
      address.password ||
      address.pathname !== '/' ||
      address.search ||
      address.hash
    ) {
      throw new Error('Provider address must be a safe HTTP(S) origin.')
    }
  }
  if (request.credentialRef) {
    requireSafeBrokerIdentifier(request.credentialRef, 'credential ref')
  }
  request.namespaces.forEach((namespace) => {
    if (namespace !== '*') {
      requireSafeBrokerIdentifier(namespace, 'provider namespace')
    }
  })

  if (serviceLassoStubDataEnabled) {
    const provider = brokerProviderStatusFixture.providers.find(
      (candidate) => candidate.providerId === request.providerId
    ) ?? {
      ...brokerProviderStatusFixture.providers[1],
      providerId: request.providerId,
      providerKind: request.providerKind,
      displayName,
    }
    return structuredClone({
      serviceId: secretsBrokerServiceId,
      apiVersion: brokerProviderStatusFixture.apiVersion,
      requestId: `stub-provider-validation-${Date.now()}`,
      operation: 'validate',
      outcome: 'ready',
      applied: false,
      requiresConfirmation: false,
      auditStatus: 'audit_recorded',
      provider,
    } satisfies BrokerProviderValidationResult)
  }

  const payload = await fetchRuntimeJson<unknown>(
    buildBrokerProviderApiPath('config/validate'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: `serviceadmin-provider-validate-${Date.now()}`,
        serviceId: '@serviceadmin',
        providerId: request.providerId,
        providerKind: request.providerKind,
        displayName,
        address: request.address,
        credentialRef: request.credentialRef,
        namespaces: request.namespaces,
        reason: request.reason.trim(),
        validationMode: 'connectivity_and_capabilities',
      }),
    }
  )
  return normalizeProviderValidationResponse(payload, request)
}

function normalizeBrokerMigrationItem(value: unknown): BrokerMigrationItem {
  const input = requireRecord(
    value,
    'Secrets Broker returned an invalid migration item.'
  )
  assertNoProviderSecretFields(input)
  return {
    ref: requireSafeBrokerIdentifier(input.ref, 'migration ref'),
    sourceProviderId: requireSafeBrokerIdentifier(
      input.sourceProviderId,
      'source provider id'
    ),
    targetProviderId: requireSafeBrokerIdentifier(
      input.targetProviderId,
      'target provider id'
    ),
    ownerServiceId: requireSafeBrokerIdentifier(
      input.ownerServiceId,
      'owner service id',
      { allowEmpty: true }
    ),
    state: requireSafeBrokerIdentifier(input.state, 'migration state'),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'migration outcome'),
    risk: requireSafeBrokerIdentifier(input.risk, 'migration risk'),
    expectedAction: requireSafeBrokerIdentifier(
      input.expectedAction,
      'migration expected action'
    ),
    policyResult: requireSafeBrokerIdentifier(
      input.policyResult,
      'migration policy result'
    ),
    auditRequirement: requireSafeBrokerIdentifier(
      input.auditRequirement,
      'migration audit requirement'
    ),
    recovery: requireSafeBrokerIdentifier(
      input.recovery,
      'migration recovery action'
    ),
  }
}

function normalizeBrokerMigrationResponse(
  payload: unknown,
  request: BrokerMigrationRequest,
  apply: boolean
): BrokerMigrationResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid migration response.'
  )
  assertNoProviderSecretFields(input)
  const expectedOperation = apply ? 'migration_apply' : 'migration_dry_run'
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.operationId !== request.operationId ||
    input.operation !== expectedOperation ||
    input.sourceProviderId !== request.sourceProviderId ||
    input.targetProviderId !== request.targetProviderId ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean' ||
    !Array.isArray(input.results)
  ) {
    throw new Error('Secrets Broker returned an invalid migration response.')
  }
  const results = input.results.map(normalizeBrokerMigrationItem)
  const requestedRefs = [...request.refs].sort()
  const returnedRefs = results.map((item) => item.ref).sort()
  if (JSON.stringify(requestedRefs) !== JSON.stringify(returnedRefs)) {
    throw new Error('Secrets Broker returned an invalid migration response.')
  }
  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    operationId: request.operationId,
    operation: expectedOperation,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: input.applied,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    sourceProviderId: request.sourceProviderId,
    targetProviderId: request.targetProviderId,
    results,
    rollback:
      sanitizeBrokerDisplayText(input.rollback) ??
      '[missing migration recovery guidance]',
  }
}

function validateBrokerMigrationRequest(request: BrokerMigrationRequest) {
  requireSafeBrokerIdentifier(request.operationId, 'migration operation id')
  requireSafeBrokerIdentifier(request.sourceProviderId, 'source provider id')
  requireSafeBrokerIdentifier(request.targetProviderId, 'target provider id')
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before provider migration.')
  }
  if (!request.refs.length) {
    throw new Error('At least one secret reference is required for migration.')
  }
  request.refs.forEach((ref) =>
    requireSafeBrokerIdentifier(ref, 'migration ref')
  )
}

async function runBrokerMigration(
  request: BrokerMigrationRequest,
  apply: boolean
) {
  await wait(120)
  validateBrokerMigrationRequest(request)
  if (serviceLassoStubDataEnabled) {
    const target = brokerProviderStatusFixture.providers.find(
      (provider) => provider.providerId === request.targetProviderId
    )
    const executable = Boolean(target && providerSupportsMigrationApply(target))
    const nowOutcome = apply
      ? executable
        ? 'applied'
        : 'unsupported'
      : 'dry_run_ready'
    return structuredClone({
      serviceId: secretsBrokerServiceId,
      apiVersion: brokerProviderStatusFixture.apiVersion,
      requestId: `stub-migration-${apply ? 'apply' : 'preview'}-${Date.now()}`,
      operationId: request.operationId,
      operation: apply ? 'migration_apply' : 'migration_dry_run',
      outcome: nowOutcome,
      applied: apply && executable,
      requiresConfirmation: !apply,
      auditStatus: 'audit_recorded',
      nextAction: executable
        ? 'verify_target_metadata'
        : 'select_executable_target',
      sourceProviderId: request.sourceProviderId,
      targetProviderId: request.targetProviderId,
      results: request.refs.map((ref) => ({
        ref,
        sourceProviderId: request.sourceProviderId,
        targetProviderId: request.targetProviderId,
        ownerServiceId: 'app',
        state: apply && executable ? 'migrated' : 'planned',
        outcome: apply && executable ? 'migrated' : 'dry_run_ready',
        risk: 'high',
        expectedAction: 'copy_value_inside_broker',
        policyResult: 'allowed',
        auditRequirement: 'required',
        recovery: 'retry_after_fix_or_restore_from_backup',
      })),
      rollback:
        'restore from encrypted backup or rerun after fixing provider state',
    } satisfies BrokerMigrationResult)
  }
  const payload = await fetchRuntimeJson<unknown>(
    buildBrokerProviderApiPath(`migration/${apply ? 'apply' : 'dry-run'}`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: `serviceadmin-migration-${Date.now()}`,
        serviceId: '@serviceadmin',
        operationId: request.operationId,
        sourceProviderId: request.sourceProviderId,
        targetProviderId: request.targetProviderId,
        refs: request.refs,
        reason: request.reason.trim(),
        confirm: apply,
      }),
    }
  )
  return normalizeBrokerMigrationResponse(payload, request, apply)
}

export function previewBrokerMigration(request: BrokerMigrationRequest) {
  return runBrokerMigration(request, false)
}

export function applyBrokerMigration(request: BrokerMigrationRequest) {
  return runBrokerMigration(request, true)
}

function normalizeBrokerBulkCampaignItem(
  value: unknown
): BrokerBulkCampaignItem {
  const input = requireRecord(
    value,
    'Secrets Broker returned an invalid bulk campaign item.'
  )
  assertNoProviderSecretFields(input)
  if (
    typeof input.applied !== 'boolean' ||
    typeof input.retrySafe !== 'boolean' ||
    typeof input.verified !== 'boolean'
  ) {
    throw new Error('Secrets Broker returned an invalid bulk campaign item.')
  }
  return {
    ref: requireSafeBrokerIdentifier(input.ref, 'campaign ref'),
    sourceId: requireSafeBrokerIdentifier(input.sourceId, 'campaign source id'),
    providerKind: requireSafeBrokerIdentifier(
      input.providerKind,
      'campaign provider kind'
    ),
    ownerServiceId: requireSafeBrokerIdentifier(
      input.ownerServiceId,
      'campaign owner service id',
      { allowEmpty: true }
    ),
    operation: requireSafeBrokerIdentifier(
      input.operation,
      'campaign operation'
    ),
    capabilityResult: requireSafeBrokerIdentifier(
      input.capabilityResult,
      'campaign capability result'
    ),
    policyResult: requireSafeBrokerIdentifier(
      input.policyResult,
      'campaign policy result'
    ),
    auditRequirement: requireSafeBrokerIdentifier(
      input.auditRequirement,
      'campaign audit requirement'
    ),
    risk: requireSafeBrokerIdentifier(input.risk, 'campaign risk'),
    expectedAction: requireSafeBrokerIdentifier(
      input.expectedAction,
      'campaign expected action'
    ),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'campaign outcome'),
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    idempotencyKey: requireSafeBrokerIdentifier(
      input.idempotencyKey,
      'campaign idempotency key'
    ),
    operationItemId: requireSafeBrokerIdentifier(
      input.operationItemId,
      'campaign item id'
    ),
    recovery: sanitizeBrokerDisplayText(input.recovery),
    targetProviderId:
      input.targetProviderId === undefined
        ? undefined
        : requireSafeBrokerIdentifier(
            input.targetProviderId,
            'campaign target provider id'
          ),
    providerAction: sanitizeBrokerDisplayText(input.providerAction),
    applied: input.applied,
    retrySafe: input.retrySafe,
    verified: input.verified,
    attempts:
      input.attempts === undefined
        ? undefined
        : requireLifecycleInteger(input.attempts, 'campaign attempt count'),
  }
}

function normalizeBrokerBulkCampaignResponse(
  payload: unknown,
  request: BrokerBulkCampaignRequest,
  mode: BrokerBulkCampaignResult['mode']
): BrokerBulkCampaignResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid bulk campaign response.'
  )
  assertNoProviderSecretFields(input)
  const summary = requireRecord(
    input.summary,
    'Secrets Broker returned an invalid bulk campaign summary.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.operationId !== request.operationId ||
    input.operation !== request.operation ||
    input.mode !== mode ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean' ||
    typeof input.requiresAuditReason !== 'boolean' ||
    typeof input.requiresRevalidation !== 'boolean' ||
    typeof input.durable !== 'boolean' ||
    !Array.isArray(input.results) ||
    !Array.isArray(input.affectedRefs) ||
    !Array.isArray(input.affectedServices)
  ) {
    throw new Error(
      'Secrets Broker returned an invalid bulk campaign response.'
    )
  }
  const results = input.results.map(normalizeBrokerBulkCampaignItem)
  const requestedRefs = [...request.refs].sort()
  const returnedRefs = [...(input.affectedRefs as unknown[])].map((ref) =>
    requireSafeBrokerIdentifier(ref, 'campaign affected ref')
  )
  if (JSON.stringify(requestedRefs) !== JSON.stringify(returnedRefs.sort())) {
    throw new Error(
      'Secrets Broker returned an invalid bulk campaign response.'
    )
  }
  const integer = (field: string) =>
    requireLifecycleInteger(summary[field], `campaign ${field}`)
  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    campaignId: requireSafeBrokerIdentifier(input.campaignId, 'campaign id'),
    planToken: requireSafeBrokerIdentifier(
      input.planToken,
      'campaign plan token'
    ),
    operationId: request.operationId,
    operation: request.operation,
    mode,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing campaign outcome]',
    applied: input.applied,
    requiresConfirmation: input.requiresConfirmation,
    requiresAuditReason: input.requiresAuditReason,
    requiresRevalidation: input.requiresRevalidation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    staleAfterSeconds: requireLifecycleInteger(
      input.staleAfterSeconds,
      'campaign staleness interval'
    ),
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    results,
    summary: {
      selectedCount: integer('selectedCount'),
      applicableCount: integer('applicableCount'),
      deniedCount: integer('deniedCount'),
      unsupportedCount: integer('unsupportedCount'),
      authRequiredCount: integer('authRequiredCount'),
      skippedCount: integer('skippedCount'),
      appliedCount: integer('appliedCount'),
      failedCount: integer('failedCount'),
      staleCount: integer('staleCount'),
      highRiskCount: integer('highRiskCount'),
    },
    affectedRefs: returnedRefs,
    affectedServices: (input.affectedServices as unknown[]).map((service) =>
      requireSafeBrokerIdentifier(service, 'campaign affected service')
    ),
    unsupportedFamilies: Array.isArray(input.unsupportedFamilies)
      ? input.unsupportedFamilies.map((family) =>
          requireSafeBrokerIdentifier(family, 'unsupported campaign family')
        )
      : undefined,
    durable: input.durable,
    maxConcurrency: requireLifecycleInteger(
      input.maxConcurrency,
      'campaign concurrency'
    ),
    backpressurePolicy: requireSafeBrokerIdentifier(
      input.backpressurePolicy,
      'campaign backpressure policy'
    ),
    createdAt: requireLifecycleDate(input.createdAt, 'campaign creation time')!,
    revalidatedAt: requireLifecycleDate(
      input.revalidatedAt,
      'campaign revalidation time',
      true
    ),
    updatedAt: requireLifecycleDate(input.updatedAt, 'campaign update time')!,
  }
}

function validateBrokerBulkCampaignRequest(request: BrokerBulkCampaignRequest) {
  requireSafeBrokerIdentifier(request.operationId, 'campaign operation id')
  requireSafeBrokerIdentifier(request.targetProviderId, 'target provider id')
  if (request.operation !== 'migrate_remap_provider') {
    throw new Error('Only provider migration campaigns are executable.')
  }
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before a bulk campaign.')
  }
  if (!request.refs.length || request.refs.length > 256) {
    throw new Error('A bulk campaign requires between 1 and 256 refs.')
  }
  request.refs.forEach((ref) =>
    requireSafeBrokerIdentifier(ref, 'campaign ref')
  )
}

async function runBrokerBulkCampaign(
  request: BrokerBulkCampaignRequest,
  mode: BrokerBulkCampaignResult['mode']
) {
  await wait(120)
  validateBrokerBulkCampaignRequest(request)
  if (serviceLassoStubDataEnabled) {
    const now = new Date().toISOString()
    const campaignId = request.campaignId ?? `stub-campaign-${Date.now()}`
    const apply = mode === 'apply'
    return structuredClone({
      serviceId: secretsBrokerServiceId,
      apiVersion: brokerProviderStatusFixture.apiVersion,
      requestId: `stub-campaign-${mode}-${Date.now()}`,
      campaignId,
      planToken: request.planToken ?? `stub-plan-${Date.now()}`,
      operationId: request.operationId,
      operation: request.operation,
      mode,
      outcome: apply ? 'applied' : 'dry_run_ready',
      applied: apply,
      requiresConfirmation: !apply,
      requiresAuditReason: !apply,
      requiresRevalidation: false,
      auditStatus: 'audit_recorded',
      staleAfterSeconds: 300,
      nextAction: apply ? 'verify_target_metadata' : 'confirm_exact_campaign',
      results: request.refs.map((ref, index) => ({
        ref,
        sourceId: 'local',
        providerKind: 'local-encrypted-store',
        ownerServiceId: 'app',
        operation: request.operation,
        capabilityResult: 'validated',
        policyResult: 'allowed',
        auditRequirement: 'required',
        risk: 'high',
        expectedAction: 'copy_value_inside_broker',
        outcome: apply ? 'migrated' : 'dry_run_ready',
        idempotencyKey: `stub-key-${index}`,
        operationItemId: `stub-item-${index}`,
        recovery: 'retry_after_fix_or_restore_from_backup',
        targetProviderId: request.targetProviderId,
        providerAction: 'write_and_verify',
        applied: apply,
        retrySafe: true,
        verified: apply,
        attempts: apply ? 1 : 0,
      })),
      summary: {
        selectedCount: request.refs.length,
        applicableCount: request.refs.length,
        deniedCount: 0,
        unsupportedCount: 0,
        authRequiredCount: 0,
        skippedCount: 0,
        appliedCount: apply ? request.refs.length : 0,
        failedCount: 0,
        staleCount: 0,
        highRiskCount: request.refs.length,
      },
      affectedRefs: [...request.refs].sort(),
      affectedServices: ['app'],
      durable: true,
      maxConcurrency: 1,
      backpressurePolicy: 'stop_on_provider_backpressure',
      createdAt: now,
      updatedAt: now,
    } satisfies BrokerBulkCampaignResult)
  }
  const payload = await fetchRuntimeJson<unknown>(
    buildSecretsManagementApiPath(`campaigns/${mode}`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: `serviceadmin-campaign-${mode}-${Date.now()}`,
        serviceId: '@serviceadmin',
        campaignId: request.campaignId ?? '',
        planToken: request.planToken ?? '',
        operationId: request.operationId,
        operation: request.operation,
        refs: request.refs,
        targetProviderId: request.targetProviderId,
        reason: request.reason.trim(),
        confirm: request.confirm === true,
        highRiskConfirm: request.highRiskConfirm ?? '',
      }),
    }
  )
  return normalizeBrokerBulkCampaignResponse(payload, request, mode)
}

export function createBrokerBulkCampaign(request: BrokerBulkCampaignRequest) {
  return runBrokerBulkCampaign(request, 'create')
}

export function revalidateBrokerBulkCampaign(
  request: BrokerBulkCampaignRequest
) {
  return runBrokerBulkCampaign(request, 'revalidate')
}

export function applyBrokerBulkCampaign(request: BrokerBulkCampaignRequest) {
  return runBrokerBulkCampaign(request, 'apply')
}

export function fetchBrokerBulkCampaignStatus(
  request: BrokerBulkCampaignRequest
) {
  return runBrokerBulkCampaign(request, 'status')
}

const forbiddenLifecycleFields = new Set([
  'token',
  'apitoken',
  'password',
  'passphrase',
  'masterkey',
  'privatekey',
  'credential',
  'credentialvalue',
  'secret',
  'secretvalue',
  'recoveryshare',
  'recoveryshares',
  'ciphertext',
  'payload',
  'nonce',
  'path',
])

function assertNoLifecycleSecretFields(value: unknown, depth = 0) {
  if (depth > 16 || value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => assertNoLifecycleSecretFields(item, depth + 1))
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, '')
    if (forbiddenLifecycleFields.has(normalized)) {
      throw new Error('Secrets Broker returned lifecycle secret material.')
    }
    assertNoLifecycleSecretFields(nested, depth + 1)
  }
}

function requireLifecycleInteger(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  return value
}

function requireLifecycleDate(value: unknown, field: string, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) {
    return undefined
  }
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  return value
}

function normalizeLifecycleBackup(value: unknown): BrokerLifecycleBackup {
  const input = requireRecord(
    value,
    'Secrets Broker returned invalid backup metadata.'
  )
  assertNoLifecycleSecretFields(input)
  if (
    input.schema !== 'service-lasso.secretsbroker.backup-metadata.v1' ||
    !['verified', 'invalid'].includes(String(input.verification))
  ) {
    throw new Error('Secrets Broker returned invalid backup metadata.')
  }
  const verification = input.verification as 'verified' | 'invalid'
  return {
    schema: 'service-lasso.secretsbroker.backup-metadata.v1',
    backupId: requireSafeBrokerIdentifier(input.backupId, 'backup id'),
    createdAt: requireLifecycleDate(
      input.createdAt,
      'backup creation time',
      verification === 'invalid'
    ),
    storeKeyId:
      verification === 'invalid' && !input.storeKeyId
        ? undefined
        : requireSafeBrokerIdentifier(input.storeKeyId, 'backup key id'),
    storeKeyVersion:
      verification === 'invalid' && !input.storeKeyVersion
        ? undefined
        : requireSafeBrokerIdentifier(
            input.storeKeyVersion,
            'backup key version'
          ),
    secretCount: requireLifecycleInteger(
      input.secretCount ?? 0,
      'secret count'
    ),
    sizeBytes: requireLifecycleInteger(input.sizeBytes ?? 0, 'backup size'),
    artifactHash:
      verification === 'invalid' && !input.artifactHash
        ? undefined
        : requireSafeBrokerIdentifier(input.artifactHash, 'artifact hash'),
    verification,
  }
}

function normalizeRecoveryPolicy(value: unknown) {
  if (value === undefined || value === null) return undefined
  const input = requireRecord(
    value,
    'Secrets Broker returned invalid recovery policy metadata.'
  )
  assertNoLifecycleSecretFields(input)
  if (
    !Array.isArray(input.shareFingerprints) ||
    (input.recipientFingerprints !== undefined &&
      !Array.isArray(input.recipientFingerprints))
  ) {
    throw new Error('Secrets Broker returned invalid recovery policy metadata.')
  }
  return {
    policyId: requireSafeBrokerIdentifier(input.policyId, 'recovery policy id'),
    keyId: requireSafeBrokerIdentifier(input.keyId, 'recovery key id'),
    keyVersion: requireSafeBrokerIdentifier(
      input.keyVersion,
      'recovery key version'
    ),
    threshold: requireLifecycleInteger(input.threshold, 'recovery threshold'),
    shareCount: requireLifecycleInteger(
      input.shareCount,
      'recovery share count'
    ),
    shareFingerprints: input.shareFingerprints.map((item) =>
      requireSafeBrokerIdentifier(item, 'recovery share fingerprint')
    ),
    recipientFingerprints: (input.recipientFingerprints ?? []).map((item) =>
      requireSafeBrokerIdentifier(item, 'recovery recipient fingerprint')
    ),
    createdAt: requireLifecycleDate(input.createdAt, 'recovery creation time')!,
    rotatedAt: requireLifecycleDate(
      input.rotatedAt,
      'recovery rotation time',
      true
    ),
    revokedAt: requireLifecycleDate(
      input.revokedAt,
      'recovery revocation time',
      true
    ),
    status: requireSafeBrokerIdentifier(input.status, 'recovery status'),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'recovery next action'
    ),
  }
}

function normalizeBrokerLifecycleStatus(
  payload: unknown
): BrokerLifecycleStatus {
  assertNoLifecycleSecretFields(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid lifecycle status.'
  )
  const key = requireRecord(
    input.key,
    'Secrets Broker returned invalid key status.'
  )
  const wrapper = requireRecord(
    input.wrapper,
    'Secrets Broker returned invalid wrapper status.'
  )
  const recovery = requireRecord(
    input.recovery,
    'Secrets Broker returned invalid recovery status.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    typeof key.available !== 'boolean' ||
    typeof wrapper.available !== 'boolean' ||
    typeof wrapper.supported !== 'boolean' ||
    !Array.isArray(input.backups)
  ) {
    throw new Error('Secrets Broker returned invalid lifecycle status.')
  }
  return {
    serviceId: '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'lifecycle outcome'),
    key: {
      available: key.available,
      keyId: key.keyId
        ? requireSafeBrokerIdentifier(key.keyId, 'key id')
        : undefined,
      keyVersion: key.keyVersion
        ? requireSafeBrokerIdentifier(key.keyVersion, 'key version')
        : undefined,
      secretCount: requireLifecycleInteger(key.secretCount, 'secret count'),
    },
    wrapper: {
      available: wrapper.available,
      supported: wrapper.supported,
      wrapperKind: requireSafeBrokerIdentifier(
        wrapper.wrapperKind,
        'wrapper kind'
      ),
      os: requireSafeBrokerIdentifier(wrapper.os, 'wrapper OS'),
      keyId: wrapper.keyId
        ? requireSafeBrokerIdentifier(wrapper.keyId, 'wrapper key id')
        : undefined,
      keyVersion: wrapper.keyVersion
        ? requireSafeBrokerIdentifier(wrapper.keyVersion, 'wrapper key version')
        : undefined,
      state: requireSafeBrokerIdentifier(wrapper.state, 'wrapper state'),
      nextAction: requireSafeBrokerIdentifier(
        wrapper.nextAction,
        'wrapper next action'
      ),
      failureReason: sanitizeBrokerDisplayText(wrapper.failureReason),
    },
    recovery: {
      outcome: requireSafeBrokerIdentifier(
        recovery.outcome,
        'recovery outcome'
      ),
      policy: normalizeRecoveryPolicy(recovery.policy),
      nextAction: requireSafeBrokerIdentifier(
        recovery.nextAction,
        'recovery next action'
      ),
    },
    backups: input.backups.map(normalizeLifecycleBackup),
    auditStatus: requireSafeBrokerIdentifier(
      input.auditStatus,
      'lifecycle audit status'
    ),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'lifecycle next action'
    ),
  }
}

function normalizeLifecycleBackupResult(
  payload: unknown
): BrokerLifecycleBackupResult {
  assertNoLifecycleSecretFields(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid backup result.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    typeof input.applied !== 'boolean' ||
    (input.backups !== undefined && !Array.isArray(input.backups))
  ) {
    throw new Error('Secrets Broker returned invalid backup result.')
  }
  return {
    serviceId: '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'backup outcome'),
    applied: input.applied,
    backup: input.backup ? normalizeLifecycleBackup(input.backup) : undefined,
    backups: Array.isArray(input.backups)
      ? input.backups.map(normalizeLifecycleBackup)
      : [],
    auditStatus: requireSafeBrokerIdentifier(
      input.auditStatus,
      'backup audit status'
    ),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'backup next action'
    ),
  }
}

function normalizeLifecycleRestoreResult(
  payload: unknown
): BrokerLifecycleRestoreResult {
  assertNoLifecycleSecretFields(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid restore result.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean'
  ) {
    throw new Error('Secrets Broker returned invalid restore result.')
  }
  return {
    serviceId: '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'restore outcome'),
    applied: input.applied,
    backup: input.backup ? normalizeLifecycleBackup(input.backup) : undefined,
    planToken: input.planToken
      ? requireSafeBrokerIdentifier(input.planToken, 'restore plan token')
      : undefined,
    planExpiresAt: requireLifecycleDate(
      input.planExpiresAt,
      'restore plan expiry',
      true
    ),
    expectedKeyId: input.expectedKeyId
      ? requireSafeBrokerIdentifier(input.expectedKeyId, 'expected key id')
      : undefined,
    expectedStoreHash: input.expectedStoreHash
      ? requireSafeBrokerIdentifier(
          input.expectedStoreHash,
          'expected store hash'
        )
      : undefined,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus: requireSafeBrokerIdentifier(
      input.auditStatus,
      'restore audit status'
    ),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'restore next action'
    ),
  }
}

function normalizeLifecycleRotateResult(
  payload: unknown
): BrokerLifecycleRotateResult {
  assertNoLifecycleSecretFields(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid key rotation result.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean'
  ) {
    throw new Error('Secrets Broker returned invalid key rotation result.')
  }
  return {
    serviceId: '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'rotation outcome'),
    applied: input.applied,
    rotatedAt: requireLifecycleDate(input.rotatedAt, 'rotation time', true),
    oldKeyId: input.oldKeyId
      ? requireSafeBrokerIdentifier(input.oldKeyId, 'old key id')
      : undefined,
    newKeyId: input.newKeyId
      ? requireSafeBrokerIdentifier(input.newKeyId, 'new key id')
      : undefined,
    keyVersion: input.keyVersion
      ? requireSafeBrokerIdentifier(input.keyVersion, 'key version')
      : undefined,
    secretCount: requireLifecycleInteger(input.secretCount, 'secret count'),
    requiresConfirmation: input.requiresConfirmation,
    auditStatus: requireSafeBrokerIdentifier(
      input.auditStatus,
      'rotation audit status'
    ),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'rotation next action'
    ),
  }
}

function validateLifecycleOperationRequest(
  request: BrokerLifecycleOperationRequest,
  requireBackup = false
) {
  requireSafeBrokerIdentifier(request.operationId, 'lifecycle operation id')
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before lifecycle operations.')
  }
  if (requireBackup && !request.backupId) {
    throw new Error('A backup selection is required.')
  }
  if (request.backupId) {
    requireSafeBrokerIdentifier(request.backupId, 'backup id')
  }
}

async function postBrokerLifecycle(
  section: string,
  request: BrokerLifecycleOperationRequest
) {
  return fetchRuntimeJson<unknown>(buildBrokerLifecycleApiPath(section), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

export async function fetchBrokerLifecycleStatus(): Promise<BrokerLifecycleStatus> {
  await wait(120)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      key: {
        available: true,
        keyId: 'mk-stub',
        keyVersion: 'v1',
        secretCount: 2,
      },
      wrapper: {
        available: true,
        supported: true,
        wrapperKind: 'local-stub',
        os: 'stub',
        keyId: 'mk-stub',
        keyVersion: 'v1',
        state: 'ready',
        nextAction: 'operate_normally',
      },
      recovery: {
        outcome: 'setup_needed',
        nextAction: 'enroll_recovery_policy',
      },
      backups: [],
      auditStatus: 'audit_recorded',
      nextAction: 'operate_normally',
    } satisfies BrokerLifecycleStatus)
  }
  return normalizeBrokerLifecycleStatus(
    await fetchRuntimeJson<unknown>(buildBrokerLifecycleApiPath('status'))
  )
}

export async function fetchBrokerLifecycleBackups(): Promise<BrokerLifecycleBackupResult> {
  await wait(120)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: false,
      backups: [],
      auditStatus: 'audit_recorded',
      nextAction: 'select_backup_or_create_new',
    } satisfies BrokerLifecycleBackupResult)
  }
  return normalizeLifecycleBackupResult(
    await fetchRuntimeJson<unknown>(buildBrokerLifecycleApiPath('backups'))
  )
}

export async function createBrokerLifecycleBackup(
  request: BrokerLifecycleOperationRequest
) {
  validateLifecycleOperationRequest(request)
  if (serviceLassoStubDataEnabled) {
    const now = new Date().toISOString()
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: true,
      backup: {
        schema: 'service-lasso.secretsbroker.backup-metadata.v1',
        backupId: `backup-stub-${Date.now()}`,
        createdAt: now,
        storeKeyId: 'mk-stub',
        storeKeyVersion: 'v1',
        secretCount: 2,
        sizeBytes: 4096,
        artifactHash: 'sha256-stub-metadata-only',
        verification: 'verified',
      },
      backups: [],
      auditStatus: 'audit_recorded',
      nextAction: 'retain_backup_separately_from_recovery_material',
    } satisfies BrokerLifecycleBackupResult)
  }
  return normalizeLifecycleBackupResult(
    await postBrokerLifecycle('backups/create', request)
  )
}

export async function verifyBrokerLifecycleBackup(
  request: BrokerLifecycleOperationRequest
) {
  validateLifecycleOperationRequest(request, true)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: false,
      backup: {
        schema: 'service-lasso.secretsbroker.backup-metadata.v1',
        backupId: request.backupId!,
        createdAt: new Date().toISOString(),
        storeKeyId: 'mk-stub',
        storeKeyVersion: 'v1',
        secretCount: 2,
        sizeBytes: 4096,
        artifactHash: 'sha256-stub-metadata-only',
        verification: 'verified',
      },
      backups: [],
      auditStatus: 'audit_recorded',
      nextAction: 'backup_verified',
    } satisfies BrokerLifecycleBackupResult)
  }
  return normalizeLifecycleBackupResult(
    await postBrokerLifecycle('backups/verify', request)
  )
}

export async function previewBrokerLifecycleRestore(
  request: BrokerLifecycleOperationRequest
) {
  validateLifecycleOperationRequest(request, true)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: false,
      planToken: 'stub-restore-plan',
      planExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      expectedKeyId: 'mk-stub',
      expectedStoreHash: 'sha256-stub-store',
      requiresConfirmation: true,
      auditStatus: 'audit_recorded',
      nextAction: 'confirm_exact_restore_plan',
    } satisfies BrokerLifecycleRestoreResult)
  }
  return normalizeLifecycleRestoreResult(
    await postBrokerLifecycle('restore/dry-run', { ...request, confirm: false })
  )
}

export async function applyBrokerLifecycleRestore(
  request: BrokerLifecycleOperationRequest
) {
  validateLifecycleOperationRequest(request, true)
  if (
    !request.confirm ||
    !request.planToken ||
    !request.expectedKeyId ||
    !request.expectedStoreHash
  ) {
    throw new Error('The exact confirmed restore plan is required.')
  }
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: true,
      requiresConfirmation: false,
      auditStatus: 'audit_recorded',
      nextAction: 'restart_and_verify_broker',
    } satisfies BrokerLifecycleRestoreResult)
  }
  return normalizeLifecycleRestoreResult(
    await postBrokerLifecycle('restore/apply', request)
  )
}

export async function rotateBrokerLifecycleKey(
  request: BrokerLifecycleOperationRequest
) {
  validateLifecycleOperationRequest(request)
  if (!request.confirm || !request.expectedKeyId) {
    throw new Error('Explicit confirmation and the expected key are required.')
  }
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: true,
      rotatedAt: new Date().toISOString(),
      oldKeyId: request.expectedKeyId,
      newKeyId: 'mk-stub-rotated',
      keyVersion: 'v2',
      secretCount: 2,
      requiresConfirmation: false,
      auditStatus: 'audit_recorded',
      nextAction: 'create_and_verify_rotated_backup',
    } satisfies BrokerLifecycleRotateResult)
  }
  return normalizeLifecycleRotateResult(
    await postBrokerLifecycle('key/rotate', request)
  )
}

function validateSecretDecommissionRequest(
  request: SecretDecommissionRequest,
  action: 'dry-run' | 'apply' | 'restore'
) {
  requireSafeBrokerIdentifier(request.ref, 'secret ref')
  requireSafeBrokerIdentifier(request.operationId, 'operation id')
  if (action !== 'dry-run' && !request.reason?.trim()) {
    throw new Error('Audit reason is required before decommission mutation.')
  }
  if (action === 'apply' && !request.plan) {
    throw new Error(
      'A fresh signed decommission plan is required before apply.'
    )
  }
  if (action === 'restore' && !request.expectedVersion?.trim()) {
    throw new Error('The tombstone version is required before restore.')
  }
}

function normalizeDecommissionPlan(
  value: unknown,
  request: SecretDecommissionRequest
): SecretDecommissionPlan {
  const plan = requireRecord(
    value,
    'Secrets Broker returned an invalid decommission plan.'
  )
  if (
    plan.ref !== request.ref ||
    plan.operationId !== request.operationId ||
    plan.dependencyStatus !== 'clear' ||
    typeof plan.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(plan.expiresAt)) ||
    typeof plan.signature !== 'string' ||
    !/^hmac-sha256:[A-Za-z0-9_-]{43}$/u.test(plan.signature) ||
    Object.prototype.hasOwnProperty.call(plan, 'value') ||
    Object.prototype.hasOwnProperty.call(plan, 'payload')
  ) {
    throw new Error('Secrets Broker returned an invalid decommission plan.')
  }

  return {
    ref: request.ref,
    operationId: request.operationId,
    expectedVersion: requireSafeBrokerIdentifier(
      plan.expectedVersion,
      'expected version'
    ),
    dependencyStatus: 'clear',
    dependencySnapshot: requireSafeBrokerIdentifier(
      plan.dependencySnapshot,
      'dependency snapshot'
    ),
    expiresAt: plan.expiresAt,
    signature: plan.signature,
  }
}

function normalizeSecretDecommissionResponse(
  payload: unknown,
  request: SecretDecommissionRequest,
  action: 'dry-run' | 'apply' | 'restore'
): SecretDecommissionResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid decommission response.'
  )
  const expectedOperation =
    action === 'restore' ? 'decommission_restore' : 'decommission'
  const expectedMode = action === 'dry-run' ? 'dry-run' : 'apply'
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.ref !== request.ref ||
    input.operationId !== request.operationId ||
    input.operation !== expectedOperation ||
    input.mode !== expectedMode ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean' ||
    typeof input.recoverable !== 'boolean' ||
    Object.prototype.hasOwnProperty.call(input, 'value')
  ) {
    throw new Error('Secrets Broker returned an invalid decommission response.')
  }

  const tombstone =
    input.tombstone === undefined
      ? undefined
      : (() => {
          const record = requireRecord(
            input.tombstone,
            'Secrets Broker returned invalid tombstone metadata.'
          )
          if (
            Object.prototype.hasOwnProperty.call(record, 'entry') ||
            Object.prototype.hasOwnProperty.call(record, 'value') ||
            Object.prototype.hasOwnProperty.call(record, 'payload') ||
            typeof record.decommissionedAt !== 'string' ||
            !Number.isFinite(Date.parse(record.decommissionedAt)) ||
            (record.restoredAt !== undefined &&
              (typeof record.restoredAt !== 'string' ||
                !Number.isFinite(Date.parse(record.restoredAt))))
          ) {
            throw new Error(
              'Secrets Broker returned invalid tombstone metadata.'
            )
          }
          return {
            state: requireSafeBrokerIdentifier(record.state, 'tombstone state'),
            version: requireSafeBrokerIdentifier(
              record.version,
              'tombstone version'
            ),
            decommissionOperationId: requireSafeBrokerIdentifier(
              record.decommissionOperationId,
              'decommission operation id'
            ),
            restoreOperationId:
              record.restoreOperationId === undefined
                ? undefined
                : requireSafeBrokerIdentifier(
                    record.restoreOperationId,
                    'restore operation id'
                  ),
            decommissionedAt: record.decommissionedAt,
            restoredAt:
              typeof record.restoredAt === 'string'
                ? record.restoredAt
                : undefined,
          }
        })()

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    operationId: request.operationId,
    ref: request.ref,
    operation: expectedOperation,
    mode: expectedMode,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: input.applied,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    policyResult:
      sanitizeBrokerDisplayText(input.policyResult) ??
      '[missing broker policy result]',
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    expectedVersion:
      input.expectedVersion === undefined
        ? undefined
        : requireSafeBrokerIdentifier(
            input.expectedVersion,
            'expected version'
          ),
    dependencyStatus:
      sanitizeBrokerDisplayText(input.dependencyStatus) ??
      '[missing dependency status]',
    dependencySnapshot:
      input.dependencySnapshot === undefined
        ? undefined
        : requireSafeBrokerIdentifier(
            input.dependencySnapshot,
            'dependency snapshot'
          ),
    dependencies: requireIdentifierArray(input.dependencies, 'dependencies'),
    recoverable: input.recoverable,
    plan:
      input.plan === undefined
        ? undefined
        : normalizeDecommissionPlan(input.plan, request),
    tombstone,
    affectedRefs: requireIdentifierArray(input.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      input.affectedServices,
      'affected services'
    ),
  }
}

export async function previewSecretDecommission(
  request: SecretDecommissionRequest
) {
  await wait(120)
  validateSecretDecommissionRequest(request, 'dry-run')

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('decommission/dry-run'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          operationId: request.operationId,
        }),
      }
    )
    return normalizeSecretDecommissionResponse(payload, request, 'dry-run')
  }

  const record = secretsManagementFixture.results.find(
    (item) => item.ref === request.ref
  )
  if (
    !record ||
    record.providerKind !== 'local-encrypted-store' ||
    !record.capabilities.includes('decommission')
  ) {
    throw new Error('Secret decommission is not available for this record.')
  }
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const plan = {
    ref: request.ref,
    operationId: request.operationId,
    expectedVersion: 'stub-version-1',
    dependencyStatus: 'clear',
    dependencySnapshot: `sha256:${'a'.repeat(64)}`,
    expiresAt,
    signature: `hmac-sha256:${'a'.repeat(43)}`,
  } satisfies SecretDecommissionPlan
  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-decommission-preview-${Date.now()}`,
    operationId: request.operationId,
    ref: request.ref,
    operation: 'decommission',
    mode: 'dry-run',
    outcome: 'dry_run_ready',
    applied: false,
    requiresConfirmation: true,
    auditStatus: 'audit_recorded',
    policyResult: 'allowed',
    nextAction: 'confirm_signed_plan_before_expiry',
    expectedVersion: plan.expectedVersion,
    dependencyStatus: 'clear',
    dependencySnapshot: plan.dependencySnapshot,
    dependencies: [],
    recoverable: true,
    plan,
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretDecommissionResult)
}

export async function applySecretDecommission(
  request: SecretDecommissionRequest
) {
  await wait(120)
  validateSecretDecommissionRequest(request, 'apply')

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('decommission/apply'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          operationId: request.operationId,
          reason: request.reason?.trim(),
          confirm: true,
          plan: request.plan,
        }),
      }
    )
    return normalizeSecretDecommissionResponse(payload, request, 'apply')
  }

  const preview = await previewSecretDecommission(request)
  const now = new Date().toISOString()
  return structuredClone({
    ...preview,
    requestId: `stub-decommission-apply-${Date.now()}`,
    mode: 'apply',
    outcome: 'applied',
    applied: true,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
    nextAction: 'retain_tombstone_until_recovery_window_expires',
    plan: undefined,
    tombstone: {
      state: 'decommissioned',
      version: request.plan?.expectedVersion ?? 'stub-version-1',
      decommissionOperationId: request.operationId,
      decommissionedAt: now,
    },
  } satisfies SecretDecommissionResult)
}

export async function restoreSecretDecommission(
  request: SecretDecommissionRequest
) {
  await wait(120)
  validateSecretDecommissionRequest(request, 'restore')

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('decommission/restore'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          operationId: request.operationId,
          reason: request.reason?.trim(),
          confirm: true,
          expectedVersion: request.expectedVersion,
        }),
      }
    )
    return normalizeSecretDecommissionResponse(payload, request, 'restore')
  }

  const now = new Date().toISOString()
  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-decommission-restore-${Date.now()}`,
    operationId: request.operationId,
    ref: request.ref,
    operation: 'decommission_restore',
    mode: 'apply',
    outcome: 'applied',
    applied: true,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
    policyResult: 'allowed',
    nextAction: 'secret_restored_from_encrypted_tombstone',
    expectedVersion: request.expectedVersion,
    dependencyStatus: 'clear',
    dependencies: [],
    recoverable: false,
    tombstone: {
      state: 'restored',
      version: request.expectedVersion ?? 'stub-version-1',
      decommissionOperationId: 'stub-original-decommission',
      restoreOperationId: request.operationId,
      decommissionedAt: now,
      restoredAt: now,
    },
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretDecommissionResult)
}

function normalizeRotationVersionMetadata(
  value: unknown
): SecretRotationVersionMetadata {
  const input = requireRecord(
    value,
    'Secrets Broker returned invalid rotation version metadata.'
  )
  const requiredTimes = ['createdAt', 'updatedAt'] as const
  for (const field of requiredTimes) {
    if (
      typeof input[field] !== 'string' ||
      !Number.isFinite(Date.parse(input[field] as string))
    ) {
      throw new Error(
        'Secrets Broker returned invalid rotation version metadata.'
      )
    }
  }
  const optionalTime = (field: 'stagedAt' | 'activatedAt' | 'retainedAt') => {
    const raw = input[field]
    if (raw === undefined) return undefined
    if (typeof raw !== 'string' || !Number.isFinite(Date.parse(raw))) {
      throw new Error(
        'Secrets Broker returned invalid rotation version metadata.'
      )
    }
    return raw
  }

  return {
    versionId: requireSafeBrokerIdentifier(input.versionId, 'version id'),
    sourceId: requireSafeBrokerIdentifier(input.sourceId, 'source id'),
    state: requireSafeBrokerIdentifier(input.state, 'version state'),
    fingerprint: requireSafeBrokerIdentifier(
      input.fingerprint,
      'version fingerprint'
    ),
    createdAt: input.createdAt as string,
    updatedAt: input.updatedAt as string,
    stagedAt: optionalTime('stagedAt'),
    activatedAt: optionalTime('activatedAt'),
    retainedAt: optionalTime('retainedAt'),
    operationId:
      input.operationId === undefined
        ? undefined
        : requireSafeBrokerIdentifier(input.operationId, 'operation id'),
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    policyResult:
      sanitizeBrokerDisplayText(input.policyResult) ??
      '[missing broker policy result]',
  }
}

function normalizeSecretRotationVersionResponse(
  payload: unknown,
  request: SecretRotationVersionRequest
): SecretRotationVersionResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid rotation response.'
  )
  const expectedOperation = `rotation_${request.action}`
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.ref !== request.ref ||
    input.operation !== expectedOperation ||
    input.mode !== request.action ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean' ||
    !Array.isArray(input.versions) ||
    Object.prototype.hasOwnProperty.call(input, 'value') ||
    Object.prototype.hasOwnProperty.call(input, 'payload')
  ) {
    throw new Error('Secrets Broker returned an invalid rotation response.')
  }

  const optionalVersion = (field: string) =>
    input[field] === undefined
      ? undefined
      : normalizeRotationVersionMetadata(input[field])

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    ref: request.ref,
    operation: expectedOperation as SecretRotationVersionResult['operation'],
    mode: request.action,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: input.applied,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    policyResult:
      sanitizeBrokerDisplayText(input.policyResult) ??
      '[missing broker policy result]',
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    activeVersionId:
      input.activeVersionId === undefined
        ? undefined
        : requireSafeBrokerIdentifier(input.activeVersionId, 'active version'),
    previousVersionId:
      input.previousVersionId === undefined
        ? undefined
        : requireSafeBrokerIdentifier(
            input.previousVersionId,
            'previous version'
          ),
    expectedCurrentVersion:
      input.expectedCurrentVersion === undefined
        ? undefined
        : requireSafeBrokerIdentifier(
            input.expectedCurrentVersion,
            'expected current version'
          ),
    currentVersion: optionalVersion('currentVersion'),
    stagedVersion: optionalVersion('stagedVersion'),
    previousVersion: optionalVersion('previousVersion'),
    versions: input.versions.map(normalizeRotationVersionMetadata),
    affectedRefs: requireIdentifierArray(input.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      input.affectedServices,
      'affected services'
    ),
  }
}

function normalizeSecretRotationPreviewResponse(
  payload: unknown,
  request: SecretRotationPreviewRequest
): SecretRotationPreviewResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid rotation preview.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.operationId !== request.operationId ||
    input.operation !== 'credential_rotation' ||
    input.mode !== 'dry-run' ||
    input.applied !== false ||
    typeof input.requiresConfirmation !== 'boolean' ||
    !Number.isInteger(input.staleAfterSeconds) ||
    (input.staleAfterSeconds as number) < 1 ||
    (input.staleAfterSeconds as number) > 3600 ||
    !Array.isArray(input.results) ||
    Object.prototype.hasOwnProperty.call(input, 'value')
  ) {
    throw new Error('Secrets Broker returned an invalid rotation preview.')
  }

  const results = input.results.map((value) => {
    const item = requireRecord(
      value,
      'Secrets Broker returned an invalid rotation preview item.'
    )
    if (item.ref !== request.ref || item.operationId !== request.operationId) {
      throw new Error(
        'Secrets Broker returned an invalid rotation preview item.'
      )
    }
    return {
      ref: request.ref,
      sourceId: requireSafeBrokerIdentifier(item.sourceId, 'source id'),
      providerKind: requireSafeBrokerIdentifier(
        item.providerKind,
        'provider kind'
      ),
      ownerServiceId: requireSafeBrokerIdentifier(
        item.ownerServiceId,
        'owner service id',
        { allowEmpty: true }
      ),
      capability: requireSafeBrokerIdentifier(item.capability, 'capability'),
      capabilityResult:
        sanitizeBrokerDisplayText(item.capabilityResult) ??
        '[missing capability result]',
      policyResult:
        sanitizeBrokerDisplayText(item.policyResult) ??
        '[missing policy result]',
      auditRequirement:
        sanitizeBrokerDisplayText(item.auditRequirement) ??
        '[missing audit requirement]',
      risk: sanitizeBrokerDisplayText(item.risk) ?? '[missing risk]',
      expectedAction:
        sanitizeBrokerDisplayText(item.expectedAction) ??
        '[missing expected action]',
      outcome:
        sanitizeBrokerDisplayText(item.outcome) ?? '[missing broker outcome]',
      nextAction: sanitizeBrokerDisplayText(item.nextAction),
      operationId: request.operationId,
      idempotencyKey: requireSafeBrokerIdentifier(
        item.idempotencyKey,
        'idempotency key'
      ),
    }
  })

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    operationId: request.operationId,
    operation: 'credential_rotation',
    mode: 'dry-run',
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: false,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    staleAfterSeconds: input.staleAfterSeconds as number,
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    results,
    affectedRefs: requireIdentifierArray(input.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      input.affectedServices,
      'affected services'
    ),
  }
}

export async function previewSecretRotation(
  request: SecretRotationPreviewRequest
) {
  await wait(120)
  requireSafeBrokerIdentifier(request.ref, 'secret ref')
  requireSafeBrokerIdentifier(request.operationId, 'operation id')
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before rotation preview.')
  }

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('rotation/dry-run'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId: request.operationId,
          refs: [request.ref],
          reason: request.reason.trim(),
        }),
      }
    )
    return normalizeSecretRotationPreviewResponse(payload, request)
  }

  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-rotation-preview-${Date.now()}`,
    operationId: request.operationId,
    operation: 'credential_rotation',
    mode: 'dry-run',
    outcome: 'dry_run_ready',
    applied: false,
    requiresConfirmation: true,
    auditStatus: 'audit_ready',
    staleAfterSeconds: 300,
    nextAction: 'confirm_and_stage_local_version',
    results: [
      {
        ref: request.ref,
        sourceId: 'local-store',
        providerKind: 'local-encrypted-store',
        ownerServiceId: 'app',
        capability: 'rotate/reset',
        capabilityResult: 'supported',
        policyResult: 'allowed',
        auditRequirement: 'required',
        risk: 'high',
        expectedAction: 'stage_then_activate',
        outcome: 'dry_run_ready',
        operationId: request.operationId,
        idempotencyKey: `sha256:${'d'.repeat(64)}`,
      },
    ],
    affectedRefs: [request.ref],
    affectedServices: ['app'],
  } satisfies SecretRotationPreviewResult)
}

function requireCoreRotationStringArray(value: unknown, field: string) {
  if (
    !Array.isArray(value) ||
    value.length > 256 ||
    !value.every(
      (entry) =>
        typeof entry === 'string' &&
        entry.length > 0 &&
        entry.length <= 512 &&
        Array.from(entry).every((character) => {
          const code = character.charCodeAt(0)
          return code > 31 && code !== 127
        })
    )
  ) {
    throw new Error(`Core returned invalid rotation ${field}.`)
  }
  return value as string[]
}

function assertNoCoreRotationSecretFields(value: unknown, depth = 0) {
  if (depth > 16 || value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((entry) => assertNoCoreRotationSecretFields(entry, depth + 1))
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, '')
    if (
      normalized === 'value' ||
      normalized === 'secretvalue' ||
      normalized === 'token' ||
      normalized === 'credential' ||
      normalized === 'payload' ||
      normalized === 'ciphertext'
    ) {
      throw new Error('Core returned secret material in rotation metadata.')
    }
    assertNoCoreRotationSecretFields(nested, depth + 1)
  }
}

function normalizeCoreRotationImpactPlan(
  value: unknown
): CoreSecretRotationImpactPlan {
  const input = requireRecord(value, 'Core returned an invalid rotation plan.')
  assertNoLifecycleSecretFields(input)
  if (
    typeof input.ref !== 'string' ||
    typeof input.planFingerprint !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(input.planFingerprint) ||
    !['ready', 'blocked'].includes(String(input.status)) ||
    input.confirmationRequired !== true ||
    input.valuePolicy !== 'metadata_only' ||
    !Array.isArray(input.services) ||
    input.services.length > 128 ||
    !Array.isArray(input.blockers)
  ) {
    throw new Error('Core returned an invalid rotation plan.')
  }
  const execution = requireRecord(
    input.execution,
    'Core returned invalid rotation execution metadata.'
  )
  const services = input.services.map((value) => {
    const service = requireRecord(
      value,
      'Core returned invalid rotation service metadata.'
    )
    if (
      typeof service.serviceId !== 'string' ||
      !['direct', 'dependent'].includes(String(service.role)) ||
      !['restart', 'reload', 'action', 'manual', 'none'].includes(
        String(service.action)
      ) ||
      typeof service.reason !== 'string' ||
      typeof service.required !== 'boolean'
    ) {
      throw new Error('Core returned invalid rotation service metadata.')
    }
    return {
      serviceId: service.serviceId,
      role: service.role as 'direct' | 'dependent',
      action:
        service.action as CoreSecretRotationImpactPlan['services'][number]['action'],
      ...(typeof service.actionId === 'string'
        ? { actionId: service.actionId }
        : {}),
      reason:
        sanitizeBrokerDisplayText(service.reason) ??
        '[rotation reason unavailable]',
      required: service.required,
      sources: requireCoreRotationStringArray(service.sources, 'sources'),
      locations: requireCoreRotationStringArray(service.locations, 'locations'),
      dependentsOf: requireCoreRotationStringArray(
        service.dependentsOf,
        'dependents'
      ),
      blockers: requireCoreRotationStringArray(service.blockers, 'blockers'),
    }
  })
  const operations = Array.isArray(execution.operations)
    ? execution.operations.map((value) => {
        const operation = requireRecord(
          value,
          'Core returned invalid rotation operation metadata.'
        )
        if (
          typeof operation.serviceId !== 'string' ||
          !['restart', 'reload', 'action'].includes(String(operation.action)) ||
          typeof operation.reason !== 'string'
        ) {
          throw new Error('Core returned invalid rotation operation metadata.')
        }
        return {
          serviceId: operation.serviceId,
          action: operation.action as 'restart' | 'reload' | 'action',
          ...(typeof operation.actionId === 'string'
            ? { actionId: operation.actionId }
            : {}),
          reason:
            sanitizeBrokerDisplayText(operation.reason) ??
            '[rotation reason unavailable]',
        }
      })
    : (() => {
        throw new Error('Core returned invalid rotation operations.')
      })()
  return {
    ref: input.ref,
    planFingerprint: input.planFingerprint,
    status: input.status as 'ready' | 'blocked',
    confirmationRequired: true,
    valuePolicy: 'metadata_only',
    services,
    execution: {
      stopOrder: requireCoreRotationStringArray(
        execution.stopOrder,
        'stop order'
      ),
      startOrder: requireCoreRotationStringArray(
        execution.startOrder,
        'start order'
      ),
      operations,
    },
    blockers: requireCoreRotationStringArray(input.blockers, 'blockers'),
  }
}

export async function fetchCoreSecretRotationImpactPlan(
  ref: string
): Promise<CoreSecretRotationImpactPlan> {
  requireSafeBrokerIdentifier(ref, 'secret ref')
  if (serviceLassoStubDataEnabled) {
    return {
      ref,
      planFingerprint: `sha256:${'a'.repeat(64)}`,
      status: 'ready',
      confirmationRequired: true,
      valuePolicy: 'metadata_only',
      services: [],
      execution: { stopOrder: [], startOrder: [], operations: [] },
      blockers: [],
    }
  }
  return normalizeCoreRotationImpactPlan(
    await fetchRuntimeJson<unknown>(
      `/api/secrets/rotation-plan?ref=${encodeURIComponent(ref)}`
    )
  )
}

export async function executeCoreSecretRotation(
  request: CoreSecretRotationExecutionRequest
): Promise<CoreSecretRotationExecutionState> {
  requireSafeBrokerIdentifier(request.ref, 'secret ref')
  requireSafeBrokerIdentifier(request.operationId, 'operation id')
  if (
    !/^sha256:[a-f0-9]{64}$/.test(request.planFingerprint) ||
    !request.reason.trim() ||
    !request.value
  ) {
    throw new Error(
      'Core rotation requires a fresh plan, audit reason, and replacement value.'
    )
  }
  if (serviceLassoStubDataEnabled) {
    return {
      schema: 'service-lasso.secret-rotation-operation.v1',
      operationId: request.operationId,
      ref: request.ref,
      planFingerprint: request.planFingerprint,
      phase: 'committed',
      outcome: 'committed',
      activeVersionId: 'stub-version-2',
      previousVersionId: 'stub-version-1',
      stagedVersionId: 'stub-version-2',
      completedOperations: [],
      rollbackCompletedOperations: [],
      failureCode: null,
      updatedAt: new Date().toISOString(),
      plan: await fetchCoreSecretRotationImpactPlan(request.ref),
    }
  }
  const payload = await fetchRuntimeJson<unknown>(
    '/api/secrets/rotation/execute',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }
  )
  const wrapper = requireRecord(
    payload,
    'Core returned an invalid rotation execution response.'
  )
  assertNoLifecycleSecretFields(wrapper)
  assertNoCoreRotationSecretFields(wrapper)
  const operation = requireRecord(
    wrapper.operation,
    'Core returned invalid rotation operation state.'
  )
  if (
    operation.schema !== 'service-lasso.secret-rotation-operation.v1' ||
    operation.operationId !== request.operationId ||
    operation.ref !== request.ref ||
    operation.planFingerprint !== request.planFingerprint ||
    !['committed', 'rolled_back', 'blocked', 'in_progress'].includes(
      String(operation.outcome)
    ) ||
    typeof operation.updatedAt !== 'string'
  ) {
    throw new Error('Core returned invalid rotation operation state.')
  }
  return {
    schema: 'service-lasso.secret-rotation-operation.v1',
    operationId: request.operationId,
    ref: request.ref,
    planFingerprint: request.planFingerprint,
    phase: operation.phase as CoreSecretRotationExecutionState['phase'],
    outcome: operation.outcome as CoreSecretRotationExecutionState['outcome'],
    activeVersionId:
      typeof operation.activeVersionId === 'string'
        ? operation.activeVersionId
        : null,
    previousVersionId:
      typeof operation.previousVersionId === 'string'
        ? operation.previousVersionId
        : null,
    stagedVersionId:
      typeof operation.stagedVersionId === 'string'
        ? operation.stagedVersionId
        : null,
    completedOperations: requireCoreRotationStringArray(
      operation.completedOperations,
      'completed operations'
    ),
    rollbackCompletedOperations: requireCoreRotationStringArray(
      operation.rollbackCompletedOperations,
      'rollback operations'
    ),
    failureCode:
      typeof operation.failureCode === 'string' ? operation.failureCode : null,
    updatedAt: operation.updatedAt,
    plan: normalizeCoreRotationImpactPlan(operation.plan),
  }
}

export async function runSecretRotationVersionAction(
  request: SecretRotationVersionRequest
) {
  await wait(120)
  requireSafeBrokerIdentifier(request.ref, 'secret ref')
  if (request.action !== 'status') {
    requireSafeBrokerIdentifier(request.operationId, 'operation id')
    if (!request.reason?.trim()) {
      throw new Error('Audit reason is required before rotation mutation.')
    }
  }
  if (request.action === 'stage' && !request.value?.trim()) {
    throw new Error('A replacement value is required before rotation stage.')
  }
  if (
    request.action === 'activate' &&
    (!request.versionId || !request.expectedCurrentVersion)
  ) {
    throw new Error(
      'Staged and expected current versions are required before activation.'
    )
  }

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath(`rotation/${request.action}`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          operationId: request.operationId,
          versionId: request.versionId,
          expectedCurrentVersion: request.expectedCurrentVersion,
          reason: request.reason?.trim(),
          confirm: request.action === 'status' ? undefined : true,
          value: request.action === 'stage' ? request.value : undefined,
          retentionLimit: request.retentionLimit,
        }),
      }
    )
    return normalizeSecretRotationVersionResponse(payload, request)
  }

  const now = new Date().toISOString()
  const currentVersion = {
    versionId:
      request.action === 'activate' ? request.versionId! : 'stub-version-1',
    sourceId: 'local-test',
    state: 'active',
    fingerprint: `sha256:${'e'.repeat(64)}`,
    createdAt: now,
    updatedAt: now,
    activatedAt: now,
    auditStatus: 'audit_recorded',
    policyResult: 'allowed',
  } satisfies SecretRotationVersionMetadata
  const stagedVersion = {
    ...currentVersion,
    versionId: `rv-${request.operationId ?? 'stub-rotation'}`,
    state: 'staged',
    stagedAt: now,
  } satisfies SecretRotationVersionMetadata
  const previousVersion = {
    ...currentVersion,
    versionId: 'stub-version-1',
    state: 'retained',
    retainedAt: now,
  } satisfies SecretRotationVersionMetadata
  const outcome =
    request.action === 'status'
      ? 'ready'
      : request.action === 'stage'
        ? 'staged'
        : request.action === 'activate'
          ? 'applied'
          : request.action === 'rollback'
            ? 'rolled_back'
            : 'retired'

  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-rotation-${request.action}-${Date.now()}`,
    ref: request.ref,
    operation: `rotation_${request.action}`,
    mode: request.action,
    outcome,
    applied: ['activate', 'rollback', 'retire'].includes(request.action),
    requiresConfirmation: request.action === 'stage',
    auditStatus:
      request.action === 'status' ? 'audit_available' : 'audit_recorded',
    policyResult: 'allowed',
    nextAction:
      request.action === 'stage'
        ? 'activate_with_expected_current_version_after_consumer_preflight'
        : 'inspect_rotation_status',
    activeVersionId: currentVersion.versionId,
    previousVersionId:
      request.action === 'activate' ? previousVersion.versionId : undefined,
    currentVersion,
    stagedVersion: request.action === 'stage' ? stagedVersion : undefined,
    previousVersion:
      request.action === 'activate' ? previousVersion : undefined,
    versions:
      request.action === 'activate'
        ? [currentVersion, previousVersion]
        : [currentVersion],
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretRotationVersionResult)
}
