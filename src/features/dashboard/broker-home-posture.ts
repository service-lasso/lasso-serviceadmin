import type {
  DashboardService,
  DashboardSummary,
} from '@/lib/service-lasso-dashboard/types'

const secretsBrokerServiceId = '@secretsbroker'

/**
 * Ready / degraded / unavailable chip states shown on Dashboard home.
 * Names and counts only; never secret values.
 */
export type BrokerReadyState = 'ready' | 'degraded' | 'unavailable'

/**
 * Collect unique dashboard services from the summary lists operators already
 * receive from GET /api/dashboard. Problem services can duplicate favorites
 * or others, so the first match wins.
 */
function listDashboardServices(summary: DashboardSummary): DashboardService[] {
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
 * Find the `@secretsbroker` tile already present on the dashboard payload.
 * Returns null when the broker is not registered so home can show Unavailable
 * instead of fabricating a healthy chip.
 */
export function findSecretsBrokerService(
  summary: DashboardSummary
): DashboardService | null {
  for (const service of listDashboardServices(summary)) {
    if (service.id === secretsBrokerServiceId) {
      return service
    }
  }

  return null
}

/**
 * Map Core dashboard health onto the three operator labels Overview used to
 * advertise. Only a running healthy process is Ready. Stopped or critical is
 * Unavailable. Warning or degraded is Degraded. Other combinations fail closed.
 */
export function deriveBrokerReadyState(
  service: DashboardService | null
): BrokerReadyState {
  if (!service) {
    return 'unavailable'
  }

  if (
    service.status === 'stopped' ||
    service.runtimeHealth.health === 'critical'
  ) {
    return 'unavailable'
  }

  if (
    service.status === 'degraded' ||
    service.runtimeHealth.health === 'warning'
  ) {
    return 'degraded'
  }

  if (
    service.status === 'running' &&
    service.runtimeHealth.health === 'healthy'
  ) {
    return 'ready'
  }

  return 'unavailable'
}

/**
 * Operator-facing Ready chip label. Keep copy short so it sits beside the
 * existing runtime/services cards.
 */
export function brokerReadyLabel(state: BrokerReadyState): string {
  if (state === 'ready') {
    return 'Ready'
  }

  if (state === 'degraded') {
    return 'Degraded'
  }

  return 'Unavailable'
}

/**
 * Format the telemetry `activeLockouts` integer. Missing telemetry must not
 * look like zero lockouts.
 */
export function formatBrokerLockoutCount(
  activeLockouts: number | null
): string {
  if (activeLockouts === null) {
    return '—'
  }

  if (!Number.isInteger(activeLockouts) || activeLockouts < 0) {
    return '—'
  }

  return String(activeLockouts)
}
