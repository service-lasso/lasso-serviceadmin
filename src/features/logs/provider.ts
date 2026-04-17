import { serviceLassoApiBaseUrl } from '@/lib/service-lasso-dashboard/stub'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'

const logsDebugEnabled =
  import.meta.env.DEV || import.meta.env.VITE_SERVICE_LASSO_LOGS_DEBUG === 'true'
const relativeLogsApiBaseUrl = ''

export type ServiceLogInfo = {
  serviceId: string
  type: 'default' | 'access' | 'error'
  path: string
  availableTypes: string[]
}

export type ServiceLogChunk = {
  serviceId: string
  type: 'default' | 'access' | 'error'
  path: string
  totalLines: number
  start: number
  end: number
  hasMore: boolean
  nextBefore: number
  limit: number
  lines: string[]
}

export function debugLogs(message: string, details?: Record<string, unknown>) {
  if (!logsDebugEnabled) return
  console.log('[logs-debug]', message, details ?? {})
}

async function parseJsonResponse<T>(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (!response.ok) {
    throw new Error('Live logs are unavailable right now.')
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('Live logs are unavailable right now.')
  }

  return (await response.json()) as T
}

function resolveLogsApiBaseUrl() {
  return serviceLassoApiBaseUrl ?? relativeLogsApiBaseUrl
}

function buildLogsApiUrl(
  pathname: '/api/services/log-info' | '/api/logs/read',
  params: URLSearchParams
) {
  return `${resolveLogsApiBaseUrl()}${pathname}?${params.toString()}`
}

export async function fetchServiceLogInfo(
  service: DashboardService,
  type: 'default' | 'access' | 'error'
) {
  const params = new URLSearchParams({
    service: service.id,
    type,
  })
  const infoUrl = buildLogsApiUrl('/api/services/log-info', params)

  debugLogs('requesting log info', {
    serviceId: service.id,
    type,
    infoUrl,
  })

  const response = await fetch(infoUrl)
  const info = await parseJsonResponse<ServiceLogInfo>(response)

  debugLogs('log info loaded', {
    serviceId: info.serviceId,
    type: info.type,
    path: info.path,
    availableTypes: info.availableTypes,
  })

  return info
}

export async function fetchServiceLogChunk(
  service: DashboardService,
  type: 'default' | 'access' | 'error',
  before?: number,
  limit = 100
) {
  const params = new URLSearchParams({
    service: service.id,
    type,
    limit: String(limit),
  })

  if (typeof before === 'number') {
    params.set('before', String(before))
  }

  const chunkUrl = buildLogsApiUrl('/api/logs/read', params)

  debugLogs('requesting log chunk', {
    serviceId: service.id,
    type,
    before: before ?? null,
    limit,
    chunkUrl,
  })

  const response = await fetch(chunkUrl)
  const chunk = await parseJsonResponse<ServiceLogChunk>(response)

  debugLogs('log chunk loaded', {
    serviceId: chunk.serviceId,
    type: chunk.type,
    before: before ?? null,
    lineCount: chunk.lines.length,
    totalLines: chunk.totalLines,
    hasMore: chunk.hasMore,
    nextBefore: chunk.nextBefore,
    firstLinePreview: chunk.lines[0]?.slice(0, 120) ?? null,
  })

  return chunk
}
