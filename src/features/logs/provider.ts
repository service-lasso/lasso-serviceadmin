import { serviceLassoApiBaseUrl } from '@/lib/service-lasso-dashboard/stub'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'

const logsDebugEnabled =
  import.meta.env.DEV ||
  import.meta.env.VITE_SERVICE_LASSO_LOGS_DEBUG === 'true'
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

export type ServiceLogOverviewEntry = {
  timestamp?: string
  level: string
  message: string
}

export type ServiceLogOverview = {
  serviceId: string
  logPath?: string
  stdoutPath?: string
  stderrPath?: string
  entries: ServiceLogOverviewEntry[]
  archives: unknown[]
  retention?: {
    maxArchives?: number
  }
}

type ServiceLogOverviewResponse = {
  logs: ServiceLogOverview
}

export function redactLogLine(line: string) {
  return line
    .replace(
      /\b(authorization)(\s*[:=]\s*)Bearer\s+([A-Za-z0-9._~+/-]+=*)/gi,
      '$1$2[redacted]'
    )
    .replace(
      /\b(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|cookie|authorization)(\s*[:=]\s*)([^\s,;]+)/gi,
      '$1$2[redacted]'
    )
    .replace(/\b(Bearer)\s+([A-Za-z0-9._~+/-]+=*)/gi, '$1 [redacted]')
}

export function debugLogs(message: string, details?: Record<string, unknown>) {
  if (!logsDebugEnabled) return
  // eslint-disable-next-line no-console
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

function buildLogsApiUrl(pathname: string, params: URLSearchParams) {
  return `${resolveLogsApiBaseUrl()}${pathname}?${params.toString()}`
}

function encodeServiceId(serviceId: string) {
  return encodeURIComponent(serviceId)
}

function buildServiceLogsOverviewUrl(serviceId: string) {
  return `${resolveLogsApiBaseUrl()}/api/services/${encodeServiceId(
    serviceId
  )}/logs`
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

export async function fetchServiceLogsOverview(service: DashboardService) {
  const overviewUrl = buildServiceLogsOverviewUrl(service.id)

  debugLogs('requesting service logs overview', {
    serviceId: service.id,
    overviewUrl,
  })

  const response = await fetch(overviewUrl)
  const payload = await parseJsonResponse<ServiceLogOverviewResponse>(response)
  const overview = payload.logs

  return {
    ...overview,
    entries: overview.entries.map((entry) => ({
      ...entry,
      message: redactLogLine(entry.message),
    })),
  }
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
  const safeChunk = {
    ...chunk,
    lines: chunk.lines.map(redactLogLine),
  }

  debugLogs('log chunk loaded', {
    serviceId: safeChunk.serviceId,
    type: safeChunk.type,
    before: before ?? null,
    lineCount: safeChunk.lines.length,
    totalLines: safeChunk.totalLines,
    hasMore: safeChunk.hasMore,
    nextBefore: safeChunk.nextBefore,
    firstLinePreview: safeChunk.lines[0]?.slice(0, 120) ?? null,
  })

  return safeChunk
}
