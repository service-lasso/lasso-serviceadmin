import { serviceLassoApiBaseUrl } from '@/lib/service-lasso-dashboard/stub'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'

export type ServiceRunStatusFields = {
  state: DashboardService['status']
  started: string | undefined
  pid: string | undefined
  runId: string | undefined
}

type ServiceMetricsPayload = {
  metrics?: {
    process?: {
      pid?: number | null
    }
  }
}

type ServiceLogsPayload = {
  logs?: {
    runId?: string | null
  }
}

/**
 * Formats a persisted process id for operator display.
 *
 * @param pid - Runtime process id, or null/undefined when none is recorded.
 * @returns Decimal pid text, or undefined when the value is not a live pid.
 */
export function formatProcessId(
  pid: number | null | undefined
): string | undefined {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
    return undefined
  }

  return String(pid)
}

/**
 * Last-resort pid scrape from health prose. HTTP aggregate summaries do not
 * include pid, which is why structured dashboard/metrics fields are required.
 *
 * @param service - Dashboard service row.
 * @returns Pid digits when note or summary contains `pid N`.
 */
export function extractPidFromHealthText(
  service: DashboardService
): string | undefined {
  const values = [service.note, service.runtimeHealth.summary]

  for (const value of values) {
    const match = value.match(/\bpid\s+(\d+)\b/i)
    const pidText = match?.[1]
    if (pidText) {
      return pidText
    }
  }

  return undefined
}

/**
 * Reads process-identity fields already present on the dashboard service.
 *
 * @param service - Dashboard service row.
 * @returns State, started, pid, and run id without extra API calls.
 */
export function readStructuredRunStatus(
  service: DashboardService
): ServiceRunStatusFields {
  return {
    state: service.status,
    started: service.runtimeHealth.lastRestartAt ?? undefined,
    pid:
      formatProcessId(service.runtimeHealth.pid) ??
      extractPidFromHealthText(service),
    runId: service.runtimeHealth.runId ?? undefined,
  }
}

function encodeServiceId(serviceId: string) {
  return encodeURIComponent(serviceId)
}

function buildRuntimeUrl(pathname: string) {
  return `${serviceLassoApiBaseUrl}${pathname}`
}

async function readJsonPayload<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || !contentType.toLowerCase().includes('application/json')) {
    return null
  }

  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

/**
 * Loads pid from Core metrics when the dashboard row omitted it.
 *
 * @param serviceId - Canonical service id.
 * @returns Pid text, or undefined when metrics are unavailable.
 */
export async function fetchRuntimeProcessId(
  serviceId: string
): Promise<string | undefined> {
  try {
    const response = await fetch(
      buildRuntimeUrl(`/api/services/${encodeServiceId(serviceId)}/metrics`)
    )
    const payload = await readJsonPayload<ServiceMetricsPayload>(response)
    return formatProcessId(payload?.metrics?.process?.pid)
  } catch {
    return undefined
  }
}

/**
 * Loads the current log run id when the dashboard row omitted it.
 *
 * @param serviceId - Canonical service id.
 * @returns Run id, or undefined when logs overview is unavailable.
 */
export async function fetchRuntimeRunId(
  serviceId: string
): Promise<string | undefined> {
  try {
    const response = await fetch(
      buildRuntimeUrl(`/api/services/${encodeServiceId(serviceId)}/logs`)
    )
    const payload = await readJsonPayload<ServiceLogsPayload>(response)
    const runId = payload?.logs?.runId
    return typeof runId === 'string' && runId.trim().length > 0
      ? runId
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Resolves Overview process-identity cards from dashboard fields, then Core
 * metrics/logs when Admin previously omitted those fields.
 *
 * @param service - Dashboard service row.
 * @returns State, started, pid, and run id for operator copy cards.
 */
export async function resolveServiceRunStatus(
  service: DashboardService
): Promise<ServiceRunStatusFields> {
  const structured = readStructuredRunStatus(service)
  const [pid, runId] = await Promise.all([
    structured.pid
      ? Promise.resolve(structured.pid)
      : fetchRuntimeProcessId(service.id),
    structured.runId
      ? Promise.resolve(structured.runId)
      : fetchRuntimeRunId(service.id),
  ])

  return {
    ...structured,
    pid,
    runId,
  }
}
