import type { DashboardService, ServiceAction } from './types'

export type LifecycleActionKind = Extract<
  ServiceAction['kind'],
  'start' | 'stop' | 'restart'
>

/**
 * True when the action is a daemon lifecycle control.
 */
export function isLifecycleAction(
  action: ServiceAction
): action is ServiceAction & { kind: LifecycleActionKind } {
  return (
    action.kind === 'start' ||
    action.kind === 'stop' ||
    action.kind === 'restart'
  )
}

/**
 * True when Core advertised this lifecycle kind and the service is not a
 * provider. Installed state is not part of advertisement.
 */
export function hasLifecycleAction(
  service: DashboardService,
  action: LifecycleActionKind
): boolean {
  const isProvider =
    service.role === 'provider' || service.metadata.serviceType === 'provider'

  return (
    !isProvider &&
    service.actions.some((candidate) => candidate.kind === action)
  )
}

/**
 * Start is available only while stopped; stop and restart only while running.
 * Matches the services list. Does not require `installed`.
 */
export function isLifecycleActionEnabled(
  service: DashboardService,
  action: LifecycleActionKind
): boolean {
  if (!hasLifecycleAction(service, action)) {
    return false
  }

  const running = service.status === 'running' || service.status === 'degraded'
  if (action === 'start') {
    return !running
  }

  return running
}
