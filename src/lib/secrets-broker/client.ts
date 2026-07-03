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

async function fetchJson<T>(pathname: string) {
  const response = await fetch(buildApiUrl(pathname))
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
