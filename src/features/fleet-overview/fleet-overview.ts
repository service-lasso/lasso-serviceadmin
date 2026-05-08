export type FleetInstanceKind = 'local' | 'future-remote'
export type FleetInstanceHealth = 'healthy' | 'degraded' | 'unknown' | 'planned'
export type FleetBrokerState =
  | 'ready'
  | 'degraded'
  | 'unconfigured'
  | 'not-connected'

export interface FleetInstanceSummary {
  id: string
  name: string
  kind: FleetInstanceKind
  health: FleetInstanceHealth
  version: string
  servicesCount: number
  brokerState: FleetBrokerState
  lastCheck: string
  region: string
  discoveryRef: string
  registrationState: string
  securityBoundary: string
  allowedActions: string[]
  unavailableActions: string[]
}

export const fleetDiscoveryAssumptions = [
  'The current Service Admin instance remains local-first and self-contained.',
  'Remote instances must be registered by explicit operator action in a future authenticated workflow.',
  'Discovery metadata must use stable instance refs and health summaries, not credentials or secret payloads.',
  'Fleet views can compare status across instances but cannot bypass per-instance policy decisions.',
]

export const fleetSecurityBoundaries = [
  'No remote control is implemented in this planning slice.',
  'No cross-instance Secrets Broker reads, writes, rotations, or raw secret reveal actions are available.',
  'Remote placeholders expose planned metadata fields only; credentials, tokens, cookies, and private keys are excluded.',
  'Any future remote action must require explicit identity, policy, audit reason, and per-instance approval.',
]

export const fleetInstanceSummaries: FleetInstanceSummary[] = [
  {
    id: 'local-dev-primary',
    name: 'Local development instance',
    kind: 'local',
    health: 'healthy',
    version: '2.2.1',
    servicesCount: 7,
    brokerState: 'ready',
    lastCheck: '2026-05-08T13:42:00Z',
    region: 'local workstation',
    discoveryRef: 'instance://local/serviceadmin/default',
    registrationState: 'self-registered local instance',
    securityBoundary:
      'local-only metadata; no remote tunnel or cross-instance secret access',
    allowedActions: [
      'view local metadata',
      'open local service dashboard',
      'review local broker status',
    ],
    unavailableActions: [
      'remote restart',
      'cross-instance secret read',
      'fleet-wide rotation',
    ],
  },
  {
    id: 'future-lan-lab',
    name: 'Future LAN lab instance',
    kind: 'future-remote',
    health: 'planned',
    version: 'registration pending',
    servicesCount: 0,
    brokerState: 'not-connected',
    lastCheck: 'not connected',
    region: 'planned LAN',
    discoveryRef: 'instance://planned/lan-lab',
    registrationState: 'placeholder only; no remote handshake configured',
    securityBoundary:
      'planned metadata row only; no credentials or network route stored',
    allowedActions: ['review registration requirements'],
    unavailableActions: ['remote control', 'secret sync', 'remote logs'],
  },
  {
    id: 'future-prod-readonly',
    name: 'Future production read-only view',
    kind: 'future-remote',
    health: 'planned',
    version: 'registration pending',
    servicesCount: 0,
    brokerState: 'not-connected',
    lastCheck: 'not connected',
    region: 'planned production',
    discoveryRef: 'instance://planned/prod-readonly',
    registrationState: 'placeholder only; requires separate approval model',
    securityBoundary:
      'read-only planning row; no production access or secret material',
    allowedActions: ['review security model'],
    unavailableActions: [
      'remote deploy',
      'raw secret reveal',
      'bulk operation',
    ],
  },
]

export function countFleetInstancesByKind(
  summaries = fleetInstanceSummaries
): Record<FleetInstanceKind, number> {
  return summaries.reduce(
    (counts, summary) => ({
      ...counts,
      [summary.kind]: counts[summary.kind] + 1,
    }),
    { local: 0, 'future-remote': 0 } satisfies Record<FleetInstanceKind, number>
  )
}

export function fleetOverviewHasSecretMaterial(
  summaries = fleetInstanceSummaries
): boolean {
  const serialized = JSON.stringify(summaries)
  return (
    /\b(bearer|basic)\s+(?!auth\b)[a-z0-9._~+/=-]{8,}/i.test(serialized) ||
    /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret|session[_-]?secret|secret|password|cookie|private[_-]?key|recovery[_-]?key|env[_-]?value)\s*[:=]\s*([^\s,;]+)/i.test(
      serialized
    ) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(serialized)
  )
}
