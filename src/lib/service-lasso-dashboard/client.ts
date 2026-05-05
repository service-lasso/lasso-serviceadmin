import {
  buildStubServiceLogUrl,
  fetchDashboardService as fetchStubDashboardService,
  fetchDashboardSummary as fetchStubDashboardSummary,
  fetchServices as fetchStubServices,
  runDashboardAction as runStubDashboardAction,
  serviceLassoApiBaseUrl,
} from './stub'
import type {
  DashboardAction,
  DashboardService,
  DashboardSummary,
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
  if (!serviceLassoApiBaseUrl) {
    throw new Error('Service Lasso API base URL is not configured.')
  }

  return `${serviceLassoApiBaseUrl}${pathname}`
}

async function fetchRuntimeJson<T>(pathname: string, init?: RequestInit) {
  const response = await fetch(buildApiUrl(pathname), init)
  const contentType = response.headers.get('content-type') ?? ''

  if (!response.ok) {
    throw new Error(`Service Lasso runtime API returned ${response.status}.`)
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('Service Lasso runtime API returned non-JSON content.')
  }

  return (await response.json()) as T
}

function hasRuntimeApi() {
  return Boolean(serviceLassoApiBaseUrl)
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

  return updateRuntimeFavorite(action.serviceId)
}

export async function fetchDashboardSummary() {
  if (!hasRuntimeApi()) {
    return fetchStubDashboardSummary()
  }

  return fetchRuntimeDashboardSummary()
}

export async function fetchServices() {
  if (!hasRuntimeApi()) {
    return fetchStubServices()
  }

  return fetchRuntimeServices()
}

export async function fetchDashboardService(serviceId: string) {
  if (!hasRuntimeApi()) {
    return fetchStubDashboardService(serviceId)
  }

  return fetchRuntimeDashboardService(serviceId)
}

export function buildServiceLogUrl(
  serviceId: string,
  options?: {
    type?: 'default' | 'access' | 'error'
  }
) {
  if (!hasRuntimeApi()) {
    return buildStubServiceLogUrl(serviceId, options)
  }

  const params = new URLSearchParams({
    service: serviceId,
    type: options?.type ?? 'default',
  })

  return buildApiUrl(`/api/logs/read?${params.toString()}`)
}

export async function runDashboardAction(action: DashboardAction) {
  if (!hasRuntimeApi()) {
    return runStubDashboardAction(action)
  }

  return runRuntimeDashboardAction(action)
}
