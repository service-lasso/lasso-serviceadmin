import {
  parseFleetMetricsPayload,
  parseNetworkHomePayload,
  parseRuntimeInstanceHome,
} from './home-runtime'
import {
  parseInboxCountsPayload,
  parseInboxListPayload,
  unavailableInboxCounts,
  unavailableInboxList,
  unreadBadgeCount,
} from './inbox'
import { withLocalOperatorRequestInit } from './local-operator-session'
import {
  buildStubServiceLogUrl,
  fetchAuditEvents as fetchStubAuditEvents,
  fetchInbox as fetchStubInbox,
  fetchInboxCounts as fetchStubInboxCounts,
  fetchFleetMetrics as fetchStubFleetMetrics,
  fetchRuntimeInstanceHome as fetchStubRuntimeInstanceHome,
  fetchNetworkHome as fetchStubNetworkHome,
  fetchServiceConfigDocument as fetchStubServiceConfigDocument,
  fetchDashboardService as fetchStubDashboardService,
  fetchDashboardSummary as fetchStubDashboardSummary,
  fetchServiceTelemetryPreview as fetchStubServiceTelemetryPreview,
  fetchServices as fetchStubServices,
  fetchTelemetryPreview as fetchStubTelemetryPreview,
  markInboxItemsRead as markStubInboxItemsRead,
  markInboxRead as markStubInboxRead,
  hideInboxItem as hideStubInboxItem,
  unhideInboxItem as unhideStubInboxItem,
  runDashboardAction as runStubDashboardAction,
  saveServiceConfigDocument as saveStubServiceConfigDocument,
  serviceLassoApiBaseUrl,
  isServiceAdminStubModeEnabled,
  normalizeRuntimeServiceAction,
} from './stub'
import type {
  AuditEventsFilters,
  AuditEventsResponse,
  AuditEventsResult,
  DashboardAction,
  DashboardService,
  DashboardSummary,
  InboxCountsResult,
  InboxListResult,
  InboxQuery,
  FleetServiceMetrics,
  NetworkHomeEndpoint,
  RuntimeInstanceHome,
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
  return `${serviceLassoApiBaseUrl ?? ''}${pathname}`
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
  const response = await fetch(
    buildApiUrl(pathname),
    withLocalOperatorRequestInit(init)
  )
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
  return {
    ...payload.summary,
    favorites: payload.summary.favorites.map(normalizeRuntimeDashboardService),
    others: payload.summary.others.map(normalizeRuntimeDashboardService),
    problemServices: payload.summary.problemServices.map(
      normalizeRuntimeDashboardService
    ),
  }
}

async function fetchRuntimeServices() {
  const payload = await fetchRuntimeJson<DashboardServicesResponse>(
    '/api/dashboard/services'
  )
  return payload.services.map(normalizeRuntimeDashboardService)
}

async function fetchRuntimeDashboardService(serviceId: string) {
  const payload = await fetchRuntimeJson<DashboardServiceDetailResponse>(
    `/api/dashboard/services/${encodeServiceId(serviceId)}`
  )
  return payload.service
    ? normalizeRuntimeDashboardService(payload.service)
    : null
}

function normalizeRuntimeDashboardService(
  service: DashboardService
): DashboardService {
  const actions = Array.isArray(service.actions) ? service.actions : []
  return {
    ...service,
    actions: actions
      .map(normalizeRuntimeServiceAction)
      .filter(
        (action): action is NonNullable<typeof action> => action !== null
      ),
  }
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
  if (isServiceAdminStubModeEnabled()) {
    return fetchStubDashboardSummary()
  }

  return fetchRuntimeDashboardSummary()
}

export async function fetchServices() {
  if (isServiceAdminStubModeEnabled()) {
    return fetchStubServices()
  }

  return fetchRuntimeServices()
}

export async function fetchDashboardService(serviceId: string) {
  if (isServiceAdminStubModeEnabled()) {
    return fetchStubDashboardService(serviceId)
  }

  return fetchRuntimeDashboardService(serviceId)
}

export async function fetchTelemetryPreview() {
  if (isServiceAdminStubModeEnabled()) {
    return fetchStubTelemetryPreview()
  }

  return fetchRuntimeTelemetryPreview()
}

export async function fetchServiceTelemetryPreview(serviceId: string) {
  if (isServiceAdminStubModeEnabled()) {
    return fetchStubServiceTelemetryPreview(serviceId)
  }

  return fetchRuntimeServiceTelemetryPreview(serviceId)
}

export async function fetchAuditEvents(filters: AuditEventsFilters = {}) {
  if (isServiceAdminStubModeEnabled()) {
    return fetchStubAuditEvents(filters)
  }

  return fetchRuntimeAuditEvents(filters)
}

function buildInboxQueryString(query: InboxQuery = {}) {
  const params = new URLSearchParams()
  if (query.filter) {
    params.set('filter', query.filter)
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit))
  }
  if (query.cursor) {
    params.set('cursor', query.cursor)
  }
  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

async function fetchRuntimeInbox(
  query: InboxQuery = {}
): Promise<InboxListResult> {
  try {
    const pathname = `/api/operator/inbox${buildInboxQueryString(query)}`
    const response = await fetch(buildApiUrl(pathname))
    const contentType = response.headers.get('content-type') ?? ''

    if (response.status === 404) {
      return unavailableInboxList()
    }

    if (!response.ok) {
      const body = await readResponseBody(response, contentType)
      const bodyMessage =
        typeof body === 'string' && body.trim()
          ? body.trim()
          : readApiErrorMessage(body)
      const suffix = bodyMessage ? `: ${bodyMessage}` : '.'
      return {
        ...unavailableInboxList(),
        unavailableReason: `Service Lasso runtime Inbox API returned ${response.status}${suffix}`,
      }
    }

    if (!contentType.toLowerCase().includes('application/json')) {
      return unavailableInboxList()
    }

    const parsed = parseInboxListPayload(await response.json())
    if (!parsed) {
      return unavailableInboxList()
    }
    return parsed
  } catch {
    return unavailableInboxList()
  }
}

async function fetchRuntimeInboxCounts(): Promise<InboxCountsResult> {
  try {
    const response = await fetch(buildApiUrl('/api/operator/inbox/counts'))
    const contentType = response.headers.get('content-type') ?? ''

    if (response.status === 404) {
      return unavailableInboxCounts()
    }

    if (!response.ok) {
      return unavailableInboxCounts()
    }

    if (!contentType.toLowerCase().includes('application/json')) {
      return unavailableInboxCounts()
    }

    const counts = parseInboxCountsPayload(await response.json())
    if (!counts) {
      return unavailableInboxCounts()
    }

    return {
      status: 'available',
      stubMode: false,
      unavailableReason: null,
      unread: unreadBadgeCount(counts),
      counts,
    }
  } catch {
    return unavailableInboxCounts()
  }
}

async function mutateRuntimeInbox(
  pathname: string,
  body: Record<string, unknown>
): Promise<InboxListResult> {
  try {
    const response = await fetch(buildApiUrl(pathname), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const contentType = response.headers.get('content-type') ?? ''

    if (response.status === 404) {
      return unavailableInboxList()
    }

    if (!response.ok) {
      const payload = await readResponseBody(response, contentType)
      const bodyMessage =
        typeof payload === 'string' && payload.trim()
          ? payload.trim()
          : readApiErrorMessage(payload)
      const suffix = bodyMessage ? `: ${bodyMessage}` : '.'
      throw new Error(
        `Service Lasso runtime Inbox API returned ${response.status}${suffix}`
      )
    }

    return fetchRuntimeInbox({ filter: 'all', limit: 200 })
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    const wrapped = new Error(
      unavailableInboxList().unavailableReason ?? 'Inbox mutation failed.'
    )
    Object.assign(wrapped, { cause: error })
    throw wrapped
  }
}

/**
 * Loads durable operator Inbox messages from Core, or fixture data in stub mode.
 */
export async function fetchInbox(query: InboxQuery = {}) {
  if (isServiceAdminStubModeEnabled()) {
    return fetchStubInbox(query)
  }

  return fetchRuntimeInbox(query)
}

/**
 * Reads optional Core JSON without throwing. Home chips fail closed.
 */
async function readOptionalRuntimeJson(
  pathname: string
): Promise<unknown | null> {
  try {
    const response = await fetch(
      buildApiUrl(pathname),
      withLocalOperatorRequestInit()
    )
    const contentType = response.headers.get('content-type') ?? ''

    if (!response.ok) {
      return null
    }

    if (!contentType.toLowerCase().includes('application/json')) {
      return null
    }

    return await response.json()
  } catch {
    return null
  }
}

async function fetchRuntimeFleetMetrics(): Promise<
  FleetServiceMetrics[] | null
> {
  return parseFleetMetricsPayload(await readOptionalRuntimeJson('/api/metrics'))
}

async function fetchRuntimeInstanceHomeSnapshot(): Promise<RuntimeInstanceHome | null> {
  return parseRuntimeInstanceHome(
    await readOptionalRuntimeJson('/api/runtime/instance')
  )
}

async function fetchRuntimeNetworkHome(): Promise<
  NetworkHomeEndpoint[] | null
> {
  return parseNetworkHomePayload(await readOptionalRuntimeJson('/api/network'))
}

/**
 * Loads Inbox unread counts for header and sidebar badges.
 */
export async function fetchInboxCounts() {
  if (isServiceAdminStubModeEnabled()) {
    return fetchStubInboxCounts()
  }

  return fetchRuntimeInboxCounts()
}

/**
 * Loads fleet process and log-line metrics for Dashboard home chips.
 */
export async function fetchFleetMetrics(): Promise<
  FleetServiceMetrics[] | null
> {
  if (isServiceAdminStubModeEnabled()) {
    return fetchStubFleetMetrics()
  }

  return fetchRuntimeFleetMetrics()
}

/**
 * Loads the active generation lane for Dashboard home.
 */
export async function fetchRuntimeInstanceHome(): Promise<RuntimeInstanceHome | null> {
  if (isServiceAdminStubModeEnabled()) {
    return fetchStubRuntimeInstanceHome()
  }

  return fetchRuntimeInstanceHomeSnapshot()
}

/**
 * Loads network endpoints for Traefik reserved-route counting on home.
 */
export async function fetchNetworkHome(): Promise<
  NetworkHomeEndpoint[] | null
> {
  if (isServiceAdminStubModeEnabled()) {
    return fetchStubNetworkHome()
  }

  return fetchRuntimeNetworkHome()
}

/**
 * Marks one Inbox item read through the Core mutation API.
 */
export async function markInboxRead(itemId: string) {
  if (isServiceAdminStubModeEnabled()) {
    return markStubInboxRead(itemId)
  }

  return mutateRuntimeInbox(
    `/api/operator/inbox/${encodeURIComponent(itemId)}/read`,
    {}
  )
}

/**
 * Marks many Inbox items read through the Core bulk mutation API.
 */
export async function markInboxItemsRead(itemIds: string[]) {
  if (isServiceAdminStubModeEnabled()) {
    return markStubInboxItemsRead(itemIds)
  }

  return mutateRuntimeInbox('/api/operator/inbox/bulk', {
    action: 'read',
    ids: itemIds,
  })
}

/**
 * Hides one Inbox item through Core `POST /api/operator/inbox/:id/hide`.
 */
export async function hideInboxItem(itemId: string) {
  if (isServiceAdminStubModeEnabled()) {
    return hideStubInboxItem(itemId)
  }

  return mutateRuntimeInbox(
    `/api/operator/inbox/${encodeURIComponent(itemId)}/hide`,
    {}
  )
}

/**
 * Restores one hidden Inbox item through Core `POST /api/operator/inbox/:id/unhide`.
 */
export async function unhideInboxItem(itemId: string) {
  if (isServiceAdminStubModeEnabled()) {
    return unhideStubInboxItem(itemId)
  }

  return mutateRuntimeInbox(
    `/api/operator/inbox/${encodeURIComponent(itemId)}/unhide`,
    {}
  )
}

export async function fetchServiceConfigDocument(serviceId: string) {
  if (isServiceAdminStubModeEnabled()) {
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
  if (isServiceAdminStubModeEnabled()) {
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
  if (isServiceAdminStubModeEnabled()) {
    return buildStubServiceLogUrl(serviceId, options)
  }

  const params = new URLSearchParams({
    service: serviceId,
    type: options?.type ?? 'default',
  })

  return buildApiUrl(`/api/logs/read?${params.toString()}`)
}

export async function runDashboardAction(action: DashboardAction) {
  if (isServiceAdminStubModeEnabled()) {
    return runStubDashboardAction(action)
  }

  return runRuntimeDashboardAction(action)
}
