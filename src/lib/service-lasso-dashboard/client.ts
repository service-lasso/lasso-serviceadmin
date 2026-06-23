import {
  buildStubServiceLogUrl,
  fetchServiceConfigDocument as fetchStubServiceConfigDocument,
  fetchDashboardService as fetchStubDashboardService,
  fetchDashboardSummary as fetchStubDashboardSummary,
  fetchServices as fetchStubServices,
  runDashboardAction as runStubDashboardAction,
  saveServiceConfigDocument as saveStubServiceConfigDocument,
  serviceLassoApiBaseUrl,
  stubDashboardDataEnabled,
} from './stub'
import type {
  DashboardAction,
  DashboardService,
  DashboardSummary,
  ServiceConfigDocument,
  ServiceConfigSaveResult,
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
    type?: 'default' | 'access' | 'error'
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
