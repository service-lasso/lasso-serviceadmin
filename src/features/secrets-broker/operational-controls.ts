export type OperationalControlOutcome =
  | 'allowed'
  | 'denied'
  | 'blocked'
  | 'warning'
  | 'recorded'

export type OperationalControlSeverity = 'info' | 'warning' | 'critical'

export type OperationalControlEvent = {
  id: string
  timestamp: string
  serviceId: string
  providerId: string
  operation: string
  outcome: OperationalControlOutcome
  severity: OperationalControlSeverity
  family:
    | 'policy_decision'
    | 'audit_recorded'
    | 'telemetry'
    | 'lockout_started'
    | 'lockout_cleared'
  refScope: string
  summary: string
  nextAction: string
}

export type OperationalControlPolicy = {
  serviceId: string
  resolveScopes: string[]
  writebackScopes: string[]
  manageScopes: string[]
  decision: 'allowed' | 'denied' | 'unknown'
  blocker: string
}

export type OperationalControlMetric = {
  label: string
  value: string
  status: OperationalControlSeverity
  detail: string
}

export type OperationalControlLockout = {
  id: string
  scope: string
  affected: string
  retryAfterSeconds: number
  status: 'active' | 'clear-ready' | 'observed'
  auditedClearSupported: boolean
  reason: string
}

export type OperationalControlFilters = {
  serviceId?: string
  providerId?: string
  operation?: string
  outcome?: OperationalControlOutcome | 'all'
  severity?: OperationalControlSeverity | 'all'
  since?: string
  until?: string
}

export const operationalControlPolicies: OperationalControlPolicy[] = [
  {
    serviceId: '@serviceadmin',
    resolveScopes: ['services/@serviceadmin/runtime/*', 'providers/ui/*'],
    writebackScopes: ['services/@serviceadmin/generated/*'],
    manageScopes: ['services/*/runtime/*'],
    decision: 'allowed',
    blocker:
      'local API auth and audit reason still required for management actions',
  },
  {
    serviceId: 'payments-api',
    resolveScopes: ['services/payments-api/runtime/*', 'providers/payments/*'],
    writebackScopes: [],
    manageScopes: [],
    decision: 'denied',
    blocker: 'provider auth is required before payment refs can be tested',
  },
  {
    serviceId: 'dagu:daily-ai-summary',
    resolveScopes: ['workflows/dagu/daily-ai-summary/*'],
    writebackScopes: [],
    manageScopes: [],
    decision: 'unknown',
    blocker:
      'workflow launch identity has not been verified by broker telemetry',
  },
]

export const operationalControlMetrics: OperationalControlMetric[] = [
  {
    label: 'Broker health',
    value: 'degraded',
    status: 'warning',
    detail: 'one external provider requires re-authentication',
  },
  {
    label: 'Audit availability',
    value: 'recording',
    status: 'info',
    detail: 'metadata-only audit chain is available for local mode',
  },
  {
    label: 'Policy decisions',
    value: '41 allow / 3 deny',
    status: 'info',
    detail: 'counters are grouped by outcome without raw refs',
  },
  {
    label: 'Active lockouts',
    value: '1',
    status: 'critical',
    detail: 'scoped local API cooldown blocks secret-bearing actions only',
  },
]

export const operationalControlEvents: OperationalControlEvent[] = [
  {
    id: 'opctl-evt-001',
    timestamp: '2026-05-22T04:10:00Z',
    serviceId: '@serviceadmin',
    providerId: 'local',
    operation: 'reveal',
    outcome: 'allowed',
    severity: 'info',
    family: 'audit_recorded',
    refScope: 'services/@serviceadmin/runtime/*',
    summary:
      'Privileged reveal approved after local API auth and audit reason.',
    nextAction: 'Keep reveal time-limited and hide copy actions by default.',
  },
  {
    id: 'opctl-evt-002',
    timestamp: '2026-05-22T04:08:00Z',
    serviceId: 'payments-api',
    providerId: 'vault',
    operation: 'resolve',
    outcome: 'blocked',
    severity: 'critical',
    family: 'policy_decision',
    refScope: 'providers/payments/*',
    summary: 'Resolve blocked because external provider auth is unavailable.',
    nextAction: 'Re-authenticate provider and rerun metadata-only test.',
  },
  {
    id: 'opctl-evt-003',
    timestamp: '2026-05-22T04:05:00Z',
    serviceId: '@serviceadmin',
    providerId: 'local',
    operation: 'writeback',
    outcome: 'denied',
    severity: 'warning',
    family: 'policy_decision',
    refScope: 'services/@serviceadmin/generated/*',
    summary:
      'Generated write-back denied until operator records an audit reason.',
    nextAction: 'Collect reason and dry-run again before apply.',
  },
  {
    id: 'opctl-evt-004',
    timestamp: '2026-05-22T04:02:00Z',
    serviceId: 'dagu:daily-ai-summary',
    providerId: 'onepassword',
    operation: 'resolve',
    outcome: 'warning',
    severity: 'warning',
    family: 'telemetry',
    refScope: 'workflows/dagu/daily-ai-summary/*',
    summary:
      'Workflow launch identity is present but provider duration is not measured yet.',
    nextAction:
      'Treat duration charts as unavailable until broker emits timing metadata.',
  },
  {
    id: 'opctl-evt-005',
    timestamp: '2026-05-22T03:59:00Z',
    serviceId: '@secretsbroker',
    providerId: 'local',
    operation: 'local-api-auth',
    outcome: 'blocked',
    severity: 'critical',
    family: 'lockout_started',
    refScope: 'local-api/session/ui',
    summary: 'Three failed local API token attempts started a scoped cooldown.',
    nextAction:
      'Wait for retry window or request audited clear when supported.',
  },
]

export const operationalControlLockouts: OperationalControlLockout[] = [
  {
    id: 'lockout-local-api-ui',
    scope: 'local-api/session/ui',
    affected: '@serviceadmin secret-bearing management actions',
    retryAfterSeconds: 240,
    status: 'active',
    auditedClearSupported: false,
    reason: 'invalid local API token attempts exceeded scoped threshold',
  },
  {
    id: 'lockout-vault-refresh',
    scope: 'provider/vault/ops',
    affected: 'payments-api provider-backed resolve tests',
    retryAfterSeconds: 0,
    status: 'clear-ready',
    auditedClearSupported: true,
    reason:
      'operator re-authentication completed and clear action requires reason',
  },
]

const secretMaterialSentinels = [
  'ACTUAL_SECRET',
  'RAW_SECRET',
  'PASSWORD=',
  'TOKEN=',
  'CLIENT_SECRET=',
  'BEGIN PRIVATE KEY',
  'fixture-provider-credential-value',
  'fixture-managed-secret-value',
]

export function filterOperationalControlEvents(
  events: OperationalControlEvent[],
  filters: OperationalControlFilters
) {
  const sinceTime = filters.since ? Date.parse(filters.since) : Number.NaN
  const untilTime = filters.until ? Date.parse(filters.until) : Number.NaN

  return events.filter((event) => {
    if (filters.serviceId && filters.serviceId !== 'all') {
      if (event.serviceId !== filters.serviceId) return false
    }
    if (filters.providerId && filters.providerId !== 'all') {
      if (event.providerId !== filters.providerId) return false
    }
    if (filters.operation && filters.operation !== 'all') {
      if (event.operation !== filters.operation) return false
    }
    if (filters.outcome && filters.outcome !== 'all') {
      if (event.outcome !== filters.outcome) return false
    }
    if (filters.severity && filters.severity !== 'all') {
      if (event.severity !== filters.severity) return false
    }
    const eventTime = Date.parse(event.timestamp)
    if (!Number.isNaN(sinceTime) && eventTime < sinceTime) return false
    if (!Number.isNaN(untilTime) && eventTime > untilTime) return false
    return true
  })
}

export function operationalControlFixturesHaveSecretMaterial() {
  const serialized = JSON.stringify({
    operationalControlEvents,
    operationalControlLockouts,
    operationalControlMetrics,
    operationalControlPolicies,
  }).toUpperCase()

  return secretMaterialSentinels.some((sentinel) =>
    serialized.includes(sentinel.toUpperCase())
  )
}
