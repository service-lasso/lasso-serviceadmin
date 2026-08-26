const ROTATION_PROXY_LIFECYCLE_SCHEMA =
  'service-admin.rotation-proxy-lifecycle.v1'
const TRANSPORT_DIAGNOSTIC_SCHEMA =
  'service-admin.real-browser-transport-diagnostic.v1'
const allowedLifecyclePhases = new Set([
  'upstream_started',
  'headers_received',
  'body_received',
  'downstream_closed',
])
const MAX_LIFECYCLE_EVENTS = 16

export function parseRotationProxyLifecycleDiagnostic(line) {
  if (typeof line !== 'string' || line.length > 512) return null
  let value
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (
    value?.schema !== ROTATION_PROXY_LIFECYCLE_SCHEMA ||
    !allowedLifecyclePhases.has(value.phase)
  ) {
    return null
  }
  const keys = Object.keys(value)
  if (!keys.every((key) => ['schema', 'phase', 'status'].includes(key))) {
    return null
  }
  if (
    value.status !== undefined &&
    (!Number.isInteger(value.status) || value.status < 100 || value.status > 599)
  ) {
    return null
  }
  return value.status === undefined
    ? { phase: value.phase }
    : { phase: value.phase, status: value.status }
}

export async function probeAdminReachability(adminOrigin, fetchImplementation = fetch) {
  try {
    const response = await fetchImplementation(adminOrigin, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
    })
    await response.body?.cancel()
    return 'reachable'
  } catch {
    return 'unreachable'
  }
}

export function buildTransportDiagnostic(events, adminReachability) {
  const boundedEvents = (Array.isArray(events) ? events : [])
    .filter(
      (event) =>
        event &&
        typeof event === 'object' &&
        allowedLifecyclePhases.has(event.phase) &&
        (event.status === undefined ||
          (Number.isInteger(event.status) &&
            event.status >= 100 &&
            event.status <= 599))
    )
    .slice(0, MAX_LIFECYCLE_EVENTS)
  return {
    schema: TRANSPORT_DIAGNOSTIC_SCHEMA,
    phases: boundedEvents.map(({ phase }) => phase),
    statuses: boundedEvents.flatMap(({ status }) =>
      status === undefined ? [] : [status]
    ),
    adminReachability:
      adminReachability === 'reachable' ? 'reachable' : 'unreachable',
  }
}
