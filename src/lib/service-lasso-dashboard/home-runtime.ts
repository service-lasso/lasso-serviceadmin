import type {
  FleetProcessTermination,
  FleetServiceMetrics,
  NetworkHomeEndpoint,
  RuntimeGenerationPhase,
  RuntimeInstanceHome,
  RuntimeLaneClassification,
} from './types'

const TERMINATIONS: readonly FleetProcessTermination[] = [
  'stopped',
  'exited',
  'crashed',
]

const PHASES: readonly RuntimeGenerationPhase[] = [
  'starting',
  'running',
  'stopping',
  'stopped',
  'failed',
  'superseded',
]

const CLASSIFICATIONS: readonly RuntimeLaneClassification[] = [
  'selected',
  'not_found',
  'stale',
  'ambiguous',
  'wrong_lane',
  'unknown_owner',
]

/**
 * Narrows unknown JSON objects without using assertions.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Narrows a JSON value to one of the provided string literals.
 */
function oneOf<T extends string>(
  value: unknown,
  values: readonly T[]
): T | null {
  if (typeof value !== 'string') {
    return null
  }

  for (const entry of values) {
    if (entry === value) {
      return entry
    }
  }

  return null
}

/**
 * Parses one GET /api/metrics service row. Invalid rows are dropped.
 */
function parseFleetServiceMetrics(value: unknown): FleetServiceMetrics | null {
  if (!isRecord(value)) {
    return null
  }

  const serviceId = typeof value.serviceId === 'string' ? value.serviceId : null
  const process = isRecord(value.process) ? value.process : null
  const logs = isRecord(value.logs) ? value.logs : null
  const current = logs && isRecord(logs.current) ? logs.current : null

  if (!serviceId || !process || !current) {
    return null
  }

  if (typeof process.running !== 'boolean') {
    return null
  }

  if (typeof process.crashCount !== 'number' || process.crashCount < 0) {
    return null
  }

  if (typeof current.stdoutLines !== 'number' || current.stdoutLines < 0) {
    return null
  }

  if (typeof current.stderrLines !== 'number' || current.stderrLines < 0) {
    return null
  }

  const lastTermination =
    process.lastTermination === null
      ? null
      : oneOf(process.lastTermination, TERMINATIONS)

  if (process.lastTermination !== null && lastTermination === null) {
    return null
  }

  return {
    serviceId,
    running: process.running,
    crashCount: process.crashCount,
    lastTermination,
    stdoutLines: current.stdoutLines,
    stderrLines: current.stderrLines,
  }
}

/**
 * Parses Core GET /api/metrics `{ services: [...] }`. Fail closed to [].
 */
export function parseFleetMetricsPayload(
  value: unknown
): FleetServiceMetrics[] | null {
  if (!isRecord(value) || !Array.isArray(value.services)) {
    return null
  }

  const parsed: FleetServiceMetrics[] = []
  for (const entry of value.services) {
    const metrics = parseFleetServiceMetrics(entry)
    if (metrics) {
      parsed.push(metrics)
    }
  }

  return parsed
}

/**
 * Parses Core GET /api/runtime/instance for the home generation chip.
 */
export function parseRuntimeInstanceHome(
  value: unknown
): RuntimeInstanceHome | null {
  if (!isRecord(value)) {
    return null
  }

  const instance = isRecord(value.instance) ? value.instance : null
  const registry = isRecord(value.registry) ? value.registry : null
  const generations = isRecord(value.generations) ? value.generations : null
  const selection = isRecord(value.selection) ? value.selection : null

  if (!registry || !generations || !selection) {
    return null
  }

  const staleCount =
    typeof registry.staleCount === 'number' && registry.staleCount >= 0
      ? registry.staleCount
      : null
  if (staleCount === null) {
    return null
  }

  const activeGenerationId =
    generations.activeGenerationId === null
      ? null
      : typeof generations.activeGenerationId === 'string'
        ? generations.activeGenerationId
        : null

  if (
    generations.activeGenerationId !== null &&
    typeof generations.activeGenerationId !== 'string'
  ) {
    return null
  }

  const phase = instance ? oneOf(instance.phase, PHASES) : null
  const classification = oneOf(selection.classification, CLASSIFICATIONS)

  return {
    phase,
    activeGenerationId,
    classification,
    staleCount,
  }
}

/**
 * Parses one GET /api/network service row into home Traefik endpoints.
 */
function parseNetworkService(value: unknown): NetworkHomeEndpoint[] {
  if (!isRecord(value) || typeof value.serviceId !== 'string') {
    return []
  }

  if (!Array.isArray(value.endpoints)) {
    return []
  }

  const parsed: NetworkHomeEndpoint[] = []
  for (const endpoint of value.endpoints) {
    if (!isRecord(endpoint) || typeof endpoint.label !== 'string') {
      continue
    }

    const port =
      typeof endpoint.port === 'number' && endpoint.port > 0
        ? endpoint.port
        : null
    const bind = typeof endpoint.bind === 'string' ? endpoint.bind : null
    const kind = typeof endpoint.kind === 'string' ? endpoint.kind : null

    parsed.push({
      serviceId: value.serviceId,
      label: endpoint.label,
      port,
      bind,
      kind,
    })
  }

  return parsed
}

/**
 * Parses Core GET /api/network `{ services: [...] }`. Fail closed to [].
 */
export function parseNetworkHomePayload(
  value: unknown
): NetworkHomeEndpoint[] | null {
  if (!isRecord(value) || !Array.isArray(value.services)) {
    return null
  }

  return value.services.flatMap((entry) => parseNetworkService(entry))
}
