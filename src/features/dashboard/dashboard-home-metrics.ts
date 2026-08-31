import type {
  DashboardService,
  DashboardSummary,
  FleetServiceMetrics,
  NetworkHomeEndpoint,
  RuntimeInstanceHome,
  ServiceStatus,
} from '@/lib/service-lasso-dashboard/types'

const TRAEFIK_SERVICE_ID = '@traefik'

const nonServiceEndpointLabelTerms = [
  'artifact',
  'download',
  'docs',
  'documentation',
  'homepage',
  'metadata',
  'release',
  'source',
  'vendor',
]

/**
 * Unique dashboard services from favorites, others, and problem lists.
 * Problem tiles can duplicate other rows, so the first id wins.
 */
export function listDashboardServices(
  summary: DashboardSummary
): DashboardService[] {
  const byId = new Map<string, DashboardService>()

  for (const service of [
    ...summary.favorites,
    ...summary.others,
    ...summary.problemServices,
  ]) {
    if (!byId.has(service.id)) {
      byId.set(service.id, service)
    }
  }

  return [...byId.values()]
}

/**
 * Format a Core ISO timestamp for home chips without leaking locale variance.
 */
export function formatOperatorInstant(
  value: string | undefined
): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return `${new Date(parsed).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

/**
 * Docs and download URLs are not daemon listens. Keep the same filter the
 * Network page uses so home does not revive the link-count vanity card.
 */
export function isOperatorListenEndpoint(
  endpoint: DashboardService['endpoints'][number]
): boolean {
  if (
    typeof endpoint.port !== 'number' ||
    !Number.isInteger(endpoint.port) ||
    endpoint.port <= 0
  ) {
    return false
  }

  const label = endpoint.label.toLowerCase()
  return !nonServiceEndpointLabelTerms.some((term) => label.includes(term))
}

export type HomeListenPort = {
  port: number
  bind: string
  serviceId: string
  serviceName: string
}

/**
 * Unique listen ports for currently running daemons. Duplicate LAN/local
 * rows on the same port collapse to one operator-facing listen.
 */
export function uniqueListenPorts(
  services: readonly DashboardService[]
): HomeListenPort[] {
  const byPort = new Map<number, HomeListenPort>()

  for (const service of services) {
    if (service.status !== 'running') {
      continue
    }

    for (const endpoint of service.endpoints) {
      const port = endpoint.port
      if (!isOperatorListenEndpoint(endpoint) || typeof port !== 'number') {
        continue
      }

      if (byPort.has(port)) {
        continue
      }

      byPort.set(port, {
        port,
        bind: endpoint.bind ?? 'unknown',
        serviceId: service.id,
        serviceName: service.name,
      })
    }
  }

  return [...byPort.values()].sort((left, right) => left.port - right.port)
}

/**
 * Compact listen-port summary for the home card description.
 */
export function formatListenPortSummary(
  ports: readonly HomeListenPort[]
): string {
  if (ports.length === 0) {
    return 'No daemon listens on this runtime'
  }

  const shown = ports.slice(0, 6).map((entry) => String(entry.port))
  const extra = ports.length - shown.length
  if (extra <= 0) {
    return shown.join(', ')
  }

  return `${shown.join(', ')} +${extra}`
}

export type HomeFleetMix = {
  running: number
  available: number
  stopped: number
  degraded: number
  crashed: number
  total: number
}

/**
 * Split running / available / stopped / degraded / crashed. Crashed overlays
 * GET /api/metrics lastTermination so a dead Admin is not just Stopped.
 */
export function deriveFleetMix(
  summary: DashboardSummary,
  metrics: readonly FleetServiceMetrics[] | null
): HomeFleetMix {
  const services = listDashboardServices(summary)
  const crashedIds = new Set(
    (metrics ?? [])
      .filter(
        (entry) =>
          entry.lastTermination === 'crashed' && entry.running === false
      )
      .map((entry) => entry.serviceId)
  )

  let running = 0
  let available = 0
  let stopped = 0
  let degraded = 0
  let crashed = 0

  for (const service of services) {
    if (crashedIds.has(service.id)) {
      crashed += 1
      continue
    }

    if (service.status === 'running') {
      running += 1
      continue
    }

    if (service.status === 'available') {
      available += 1
      continue
    }

    if (service.status === 'degraded') {
      degraded += 1
      continue
    }

    stopped += 1
  }

  return {
    running,
    available,
    stopped,
    degraded,
    crashed,
    total: services.length,
  }
}

/**
 * Services card copy. Keep the historic "stopped, degraded" phrase so stub
 * Playwright still matches, and append crashed when metrics reported any.
 */
export function formatFleetMixDescription(mix: HomeFleetMix): string {
  const base = `${mix.available} available, ${mix.stopped} stopped, ${mix.degraded} degraded`
  if (mix.crashed === 0) {
    return base
  }

  return `${base}, ${mix.crashed} crashed`
}

export type HomeProblemRow = {
  id: string
  name: string
  status: ServiceStatus
  note: string
  lastStart: string | null
  installed: boolean
  crashed: boolean
}

/**
 * Named failures with the reason and last start already in dashboard JSON.
 */
export function deriveProblemRows(
  summary: DashboardSummary,
  metrics: readonly FleetServiceMetrics[] | null
): HomeProblemRow[] {
  const crashedIds = new Set(
    (metrics ?? [])
      .filter(
        (entry) =>
          entry.lastTermination === 'crashed' && entry.running === false
      )
      .map((entry) => entry.serviceId)
  )

  return summary.problemServices.map((service) => ({
    id: service.id,
    name: service.name,
    status: service.status,
    note: service.note.trim(),
    lastStart: formatOperatorInstant(service.runtimeHealth.lastRestartAt),
    installed: service.installed,
    crashed: crashedIds.has(service.id),
  }))
}

/**
 * One listen port for a service tile, if that process is actually listening.
 */
export function primaryListenPort(
  service: DashboardService
): HomeListenPort | null {
  const [first] = uniqueListenPorts([service])
  return first ?? null
}

export type HomeGenerationLane = {
  available: boolean
  phase: string
  activeGenerationId: string | null
  classification: string
  staleCount: number
}

/**
 * Compact generation-lane chip. Missing snapshot must not look selected.
 */
export function deriveGenerationLane(
  instance: RuntimeInstanceHome | null
): HomeGenerationLane {
  if (!instance) {
    return {
      available: false,
      phase: 'unknown',
      activeGenerationId: null,
      classification: 'unavailable',
      staleCount: 0,
    }
  }

  return {
    available: true,
    phase: instance.phase ?? 'unknown',
    activeGenerationId: instance.activeGenerationId,
    classification: instance.classification ?? 'unknown',
    staleCount: instance.staleCount,
  }
}

/**
 * Short generation id so the chip does not dump a raw UUID.
 */
export function formatGenerationId(generationId: string | null): string {
  if (typeof generationId !== 'string' || generationId.trim().length === 0) {
    return 'none'
  }

  if (generationId.length <= 12) {
    return generationId
  }

  return generationId.slice(0, 8)
}

export type HomeTraefikStrip = {
  available: boolean
  status: ServiceStatus | 'missing'
  entrypoints: number[]
  liveBackendCount: number
  reservedEmptyCount: number
}

/**
 * Traefik entrypoints vs live backends. Reserved-empty routes are expected
 * on a laptop demo and are not treated as errors.
 */
export function deriveTraefikStrip(
  summary: DashboardSummary,
  network: readonly NetworkHomeEndpoint[] | null
): HomeTraefikStrip {
  const services = listDashboardServices(summary)
  const traefik = services.find((service) => service.id === TRAEFIK_SERVICE_ID)
  if (!traefik) {
    return {
      available: false,
      status: 'missing',
      entrypoints: [],
      liveBackendCount: 0,
      reservedEmptyCount: 0,
    }
  }

  const entrypoints = uniqueListenPorts([traefik]).map((entry) => entry.port)
  const liveBackendCount = uniqueListenPorts(
    services.filter((service) => service.id !== TRAEFIK_SERVICE_ID)
  ).length

  const networkEndpoints = (network ?? []).filter(
    (entry) => entry.serviceId === TRAEFIK_SERVICE_ID
  )
  const reservedEmptyCount = networkEndpoints.filter((entry) => {
    if (entry.port === null) {
      return false
    }
    if (entrypoints.includes(entry.port)) {
      return false
    }
    const label = entry.label.toLowerCase()
    return (
      label.includes('reserved') ||
      label.includes('cms') ||
      label.includes('flow') ||
      label.includes('bpmn') ||
      label.includes('mongo') ||
      label.includes('typedb')
    )
  }).length

  return {
    available: true,
    status: traefik.status,
    entrypoints,
    liveBackendCount,
    reservedEmptyCount,
  }
}

export type HomeLogVolume = {
  available: boolean
  stdoutLines: number
  stderrLines: number
  servicesWithStderr: number
}

/**
 * Line counts only. Broker INFO-on-stderr is not an application error.
 */
export function deriveLogVolume(
  metrics: readonly FleetServiceMetrics[] | null
): HomeLogVolume {
  if (!metrics) {
    return {
      available: false,
      stdoutLines: 0,
      stderrLines: 0,
      servicesWithStderr: 0,
    }
  }

  let stdoutLines = 0
  let stderrLines = 0
  let servicesWithStderr = 0

  for (const entry of metrics) {
    stdoutLines += entry.stdoutLines
    stderrLines += entry.stderrLines
    if (entry.stderrLines > 0) {
      servicesWithStderr += 1
    }
  }

  return {
    available: true,
    stdoutLines,
    stderrLines,
    servicesWithStderr,
  }
}

/**
 * Inbox unread chip copy. Missing counts must not look like zero mail.
 */
export function formatInboxUnread(unread: number | null): string {
  if (unread === null || !Number.isInteger(unread) || unread < 0) {
    return '—'
  }

  return String(unread)
}
