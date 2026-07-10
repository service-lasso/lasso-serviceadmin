import {
  buildStubServiceLogUrl,
  fetchAuditEvents as fetchStubAuditEvents,
  fetchServiceConfigDocument as fetchStubServiceConfigDocument,
  fetchDashboardService as fetchStubDashboardService,
  fetchDashboardSummary as fetchStubDashboardSummary,
  fetchServiceTelemetryPreview as fetchStubServiceTelemetryPreview,
  fetchServices as fetchStubServices,
  fetchTelemetryPreview as fetchStubTelemetryPreview,
  runDashboardAction as runStubDashboardAction,
  saveServiceConfigDocument as saveStubServiceConfigDocument,
  serviceLassoApiBaseUrl,
  stubDashboardDataEnabled,
} from './stub'
import type {
  AuditEventsFilters,
  AuditEventsResponse,
  AuditEventsResult,
  DashboardAction,
  DashboardService,
  DashboardSummary,
  ServiceConfigDocument,
  ServiceConfigSaveResult,
  ServiceLogType,
  ServiceTelemetryPreview,
  TelemetryPreview,
} from './types'

type DashboardSummaryResponse = {
  summary: DashboardSummary
}

type DashboardServicesResponse = {
  services: DashboardService[]
}

type DashboardServiceDetailResponse = {
  service: DashboardService
}

type TelemetryPreviewResponse = {
  telemetry: TelemetryPreview
}

type ServiceTelemetryPreviewResponse = {
  telemetry: ServiceTelemetryPreview
}

function encodeServiceId(serviceId: string) {
  return encodeURIComponent(serviceId)
}

function buildApiUrl(pathname: string) {
  return `${serviceLassoApiBaseUrl}${pathname}`
}

function readApiErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  for (const key of ['detail', 'message', 'title', 'error']) {
    const value = (payload as Record<string, unknown>)[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

async function readResponseBody(response: Response, contentType: string) {
  if (contentType.toLowerCase().includes('application/json')) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  try {
    return await response.text()
  } catch {
    return null
  }
}

async function fetchRuntimeJson<T>(pathname: string, init?: RequestInit) {
  const response = await fetch(buildApiUrl(pathname), init)
  const contentType = response.headers.get('content-type') ?? ''

  if (!response.ok) {
    const body = await readResponseBody(response, contentType)
    const bodyMessage =
      typeof body === 'string' && body.trim()
        ? body.trim()
        : readApiErrorMessage(body)
    const suffix = bodyMessage ? `: ${bodyMessage}` : '.'

    throw new Error(
      `Service Lasso runtime API returned ${response.status}${suffix}`
    )
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('Service Lasso runtime API returned non-JSON content.')
  }

  return (await response.json()) as T
}

async function fetchRuntimeDashboardSummary() {
  const payload =
    await fetchRuntimeJson<DashboardSummaryResponse>('/api/dashboard')
  return payload.summary
}

async function fetchRuntimeServices() {
  const payload = await fetchRuntimeJson<DashboardServicesResponse>(
    '/api/dashboard/services'
  )
  return payload.services
}

async function fetchRuntimeDashboardService(serviceId: string) {
  const payload = await fetchRuntimeJson<DashboardServiceDetailResponse>(
    `/api/dashboard/services/${encodeServiceId(serviceId)}`
  )
  return payload.service ?? null
}

async function fetchRuntimeTelemetryPreview() {
  const payload =
    await fetchRuntimeJson<TelemetryPreviewResponse>('/api/telemetry')
  return payload.telemetry
}

async function fetchRuntimeServiceTelemetryPreview(serviceId: string) {
  const payload = await fetchRuntimeJson<ServiceTelemetryPreviewResponse>(
    `/api/services/${encodeServiceId(serviceId)}/telemetry`
  )
  return payload.telemetry
}

function appendAuditFilter(
  params: URLSearchParams,
  key: keyof AuditEventsFilters,
  value: AuditEventsFilters[keyof AuditEventsFilters]
) {
  if (value === undefined || value === null || value === '') return
  params.set(key, String(value))
}

function buildAuditQueryString(filters: AuditEventsFilters = {}) {
  const params = new URLSearchParams()

  appendAuditFilter(params, 'serviceId', filters.serviceId)
  appendAuditFilter(params, 'actor', filters.actor)
  appendAuditFilter(params, 'action', filters.action)
  appendAuditFilter(params, 'outcome', filters.outcome)
  appendAuditFilter(params, 'source', filters.source)
  appendAuditFilter(params, 'since', filters.since)
  appendAuditFilter(params, 'until', filters.until)
  appendAuditFilter(params, 'query', filters.query)
  appendAuditFilter(params, 'limit', filters.limit)
  appendAuditFilter(params, 'cursor', filters.cursor)

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

async function fetchRuntimeAuditEvents(
  filters: AuditEventsFilters = {}
): Promise<AuditEventsResult> {
  const pathname = `/api/audit${buildAuditQueryString(filters)}`
  const response = await fetch(buildApiUrl(pathname))
  const contentType = response.headers.get('content-type') ?? ''

  if (response.status === 404) {
    return {
      status: 'unavailable',
      stubMode: false,
      unavailableReason: 'Service Lasso runtime audit API is not available.',
      events: [],
      pagination: {
        limit: filters.limit ?? 100,
        nextCursor: null,
        total: 0,
      },
    }
  }

  if (!response.ok) {
    const body = await readResponseBody(response, contentType)
    const bodyMessage =
      typeof body === 'string' && body.trim()
        ? body.trim()
        : readApiErrorMessage(body)
    const suffix = bodyMessage ? `: ${bodyMessage}` : '.'

    throw new Error(
      `Service Lasso audit API returned ${response.status}${suffix}`
    )
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('Service Lasso audit API returned non-JSON content.')
  }

  const payload = (await response.json()) as AuditEventsResponse

  return {
    status: 'available',
    stubMode: false,
    unavailableReason: null,
    events: payload.events,
    pagination: payload.pagination,
  }
}

async function updateRuntimeFavorite(serviceId: string) {
  const service = await fetchRuntimeDashboardService(serviceId)
  if (!service) {
    throw new Error(`Service ${serviceId} was not found by the runtime API.`)
  }

  await fetchRuntimeJson(`/api/services/${encodeServiceId(serviceId)}/meta`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ favorite: !service.favorite }),
  })

  return fetchRuntimeDashboardSummary()
}

async function runRuntimeDashboardAction(action: DashboardAction) {
  if (action === 'reload-runtime') {
    await fetchRuntimeJson('/api/runtime/actions/reload', { method: 'POST' })
    return fetchRuntimeDashboardSummary()
  }

  if (action === 'start-services') {
    await fetchRuntimeJson('/api/runtime/actions/startAll', { method: 'POST' })
    return fetchRuntimeDashboardSummary()
  }

  if (action === 'stop-services') {
    await fetchRuntimeJson('/api/runtime/actions/stopAll', { method: 'POST' })
    return fetchRuntimeDashboardSummary()
  }

  if (action === 'restart-services') {
    await fetchRuntimeJson('/api/runtime/actions/stopAll', { method: 'POST' })
    await fetchRuntimeJson('/api/runtime/actions/startAll', { method: 'POST' })
    return fetchRuntimeDashboardSummary()
  }

  if (action.kind === 'service-lifecycle') {
    await fetchRuntimeJson(
      `/api/services/${encodeServiceId(action.serviceId)}/${action.action}`,
      { method: 'POST' }
    )
    return fetchRuntimeDashboardSummary()
  }

  return updateRuntimeFavorite(action.serviceId)
}

export async function fetchDashboardSummary() {
  if (stubDashboardDataEnabled) {
    return fetchStubDashboardSummary()
  }

  return fetchRuntimeDashboardSummary()
}

export async function fetchServices() {
  if (stubDashboardDataEnabled) {
    return fetchStubServices()
  }

  return fetchRuntimeServices()
}

export async function fetchDashboardService(serviceId: string) {
  if (stubDashboardDataEnabled) {
    return fetchStubDashboardService(serviceId)
  }

  return fetchRuntimeDashboardService(serviceId)
}

export async function fetchTelemetryPreview() {
  if (stubDashboardDataEnabled) {
    return fetchStubTelemetryPreview()
  }

  return fetchRuntimeTelemetryPreview()
}

export async function fetchServiceTelemetryPreview(serviceId: string) {
  if (stubDashboardDataEnabled) {
    return fetchStubServiceTelemetryPreview(serviceId)
  }

  return fetchRuntimeServiceTelemetryPreview(serviceId)
}

export async function fetchAuditEvents(filters: AuditEventsFilters = {}) {
  if (stubDashboardDataEnabled) {
    return fetchStubAuditEvents(filters)
  }

  return fetchRuntimeAuditEvents(filters)
}

export async function fetchServiceConfigDocument(serviceId: string) {
  if (stubDashboardDataEnabled) {
    return fetchStubServiceConfigDocument(serviceId)
  }

  return fetchRuntimeJson<ServiceConfigDocument>(
    `/api/services/${encodeServiceId(serviceId)}/config`
  )
}

export async function saveServiceConfigDocument({
  serviceId,
  content,
  reason,
}: {
  serviceId: string
  content: string
  reason?: string | null
}) {
  if (stubDashboardDataEnabled) {
    return saveStubServiceConfigDocument({ serviceId, content, reason })
  }

  return fetchRuntimeJson<ServiceConfigSaveResult>(
    `/api/services/${encodeServiceId(serviceId)}/config`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        actor: 'service-admin-web',
        reason: reason ?? null,
      }),
    }
  )
}

export function buildServiceLogUrl(
  serviceId: string,
  options?: {
    type?: ServiceLogType
  }
) {
  if (stubDashboardDataEnabled) {
    return buildStubServiceLogUrl(serviceId, options)
  }

  const params = new URLSearchParams({
    service: serviceId,
    type: options?.type ?? 'default',
  })

  return buildApiUrl(`/api/logs/read?${params.toString()}`)
}

export async function runDashboardAction(action: DashboardAction) {
  if (stubDashboardDataEnabled) {
    return runStubDashboardAction(action)
  }

  return runRuntimeDashboardAction(action)
}
