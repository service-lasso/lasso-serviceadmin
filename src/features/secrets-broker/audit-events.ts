export type SecretsBrokerAuditEventType =
  | 'resolve_granted'
  | 'resolve_denied'
  | 'external_provider_read'
  | 'refresh_failure'
  | 'reconnect_required'
  | 'session_token_revoked'
  | 'write_back_denied'
  | 'secret_rotated'

export type SecretsBrokerAuditOutcome =
  | 'granted'
  | 'denied'
  | 'failure'
  | 'revoked'
  | 'success'

export type SecretsBrokerAuditEvent = {
  id: string
  timestamp: string
  type: SecretsBrokerAuditEventType
  outcome: SecretsBrokerAuditOutcome
  provider: 'local' | 'openclaw' | 'vault' | 'dagu' | 'onepassword'
  source: string
  connection: string
  serviceOrWorkflow: string
  actorType: 'service' | 'workflow' | 'operator' | 'cli-session'
  actorId: string
  ref: string
  policyId: string
  policyDecision: string
  normalizedReason: string
}

export type SecretsBrokerAuditFilters = {
  type?: SecretsBrokerAuditEventType | 'all'
  outcome?: SecretsBrokerAuditOutcome | 'all'
  provider?: SecretsBrokerAuditEvent['provider'] | 'all'
  query?: string
  since?: string
  until?: string
}

export const secretsBrokerAuditEvents: SecretsBrokerAuditEvent[] = [
  {
    id: 'evt-20260507-001',
    timestamp: '2026-05-07T18:20:00Z',
    type: 'resolve_granted',
    outcome: 'granted',
    provider: 'openclaw',
    source: '@secretsbroker/openclaw/service-lasso',
    connection: 'OpenClaw SecretRef adapter',
    serviceOrWorkflow: '@serviceadmin',
    actorType: 'service',
    actorId: '@serviceadmin',
    ref: 'openclaw/anthropic/api_key',
    policyId: 'policy/openclaw/service-lasso/read',
    policyDecision: 'allow: namespace and service identity matched',
    normalizedReason: 'Resolver granted access to the requested SecretRef.',
  },
  {
    id: 'evt-20260507-002',
    timestamp: '2026-05-07T18:19:15Z',
    type: 'resolve_denied',
    outcome: 'denied',
    provider: 'local',
    source: '@secretsbroker/local/default',
    connection: 'Local encrypted vault',
    serviceOrWorkflow: 'postgres',
    actorType: 'service',
    actorId: 'postgres',
    ref: 'postgres.ADMIN_PASSWORD',
    policyId: 'policy/local/default/read',
    policyDecision: 'deny: service identity missing ref grant',
    normalizedReason:
      'Policy denied the read request before any value was resolved.',
  },
  {
    id: 'evt-20260507-003',
    timestamp: '2026-05-07T18:18:44Z',
    type: 'refresh_failure',
    outcome: 'failure',
    provider: 'vault',
    source: '@secretsbroker/external/ops',
    connection: 'Vault kv/service-lasso',
    serviceOrWorkflow: '@serviceadmin',
    actorType: 'operator',
    actorId: 'operator:max',
    ref: 'telegram.bot_token',
    policyId: 'policy/external/ops/refresh',
    policyDecision: 'allow: refresh attempted',
    normalizedReason:
      'External provider refresh failed because source authentication is required.',
  },
  {
    id: 'evt-20260507-004',
    timestamp: '2026-05-07T18:17:12Z',
    type: 'session_token_revoked',
    outcome: 'revoked',
    provider: 'openclaw',
    source: '@secretsbroker/openclaw/session',
    connection: 'CLI/session token',
    serviceOrWorkflow: 'cli:service-lasso',
    actorType: 'cli-session',
    actorId: 'session:rotated',
    ref: 'openclaw/session_token',
    policyId: 'policy/openclaw/session/lifecycle',
    policyDecision: 'revoke: token replaced by newer session',
    normalizedReason: 'Session credential was revoked after rotation.',
  },
  {
    id: 'evt-20260507-005',
    timestamp: '2026-05-07T18:16:03Z',
    type: 'external_provider_read',
    outcome: 'success',
    provider: 'onepassword',
    source: '@secretsbroker/external/ops',
    connection: '1Password ops vault',
    serviceOrWorkflow: 'dagu:daily-ai-summary',
    actorType: 'workflow',
    actorId: 'dagu:daily-ai-summary/run/20260507',
    ref: 'openclaw/anthropic/api_key',
    policyId: 'policy/workflows/ai-summary/read',
    policyDecision: 'allow: workflow run identity matched',
    normalizedReason:
      'External provider returned metadata for a successful read.',
  },
  {
    id: 'evt-20260507-006',
    timestamp: '2026-05-07T18:15:22Z',
    type: 'write_back_denied',
    outcome: 'denied',
    provider: 'local',
    source: '@secretsbroker/local/default',
    connection: 'Generated secret write-back',
    serviceOrWorkflow: '@serviceadmin',
    actorType: 'service',
    actorId: '@serviceadmin',
    ref: '@serviceadmin/SESSION_SECRET',
    policyId: 'policy/local/default/write-back',
    policyDecision: 'deny: write-back requires operator audit reason',
    normalizedReason:
      'Generated secret write-back was denied before storing a value.',
  },
]

export function filterSecretsBrokerAuditEvents(
  events: SecretsBrokerAuditEvent[],
  filters: SecretsBrokerAuditFilters
) {
  const sinceTime = filters.since ? Date.parse(filters.since) : Number.NaN
  const untilTime = filters.until ? Date.parse(filters.until) : Number.NaN

  return events.filter((event) => {
    if (filters.type && filters.type !== 'all' && event.type !== filters.type) {
      return false
    }
    if (
      filters.outcome &&
      filters.outcome !== 'all' &&
      event.outcome !== filters.outcome
    ) {
      return false
    }
    if (
      filters.provider &&
      filters.provider !== 'all' &&
      event.provider !== filters.provider
    ) {
      return false
    }
    const query = filters.query?.trim().toLowerCase()
    if (query) {
      const searchable = [
        event.source,
        event.connection,
        event.serviceOrWorkflow,
        event.actorType,
        event.actorId,
        event.ref,
      ]
        .join(' ')
        .toLowerCase()
      if (!searchable.includes(query)) {
        return false
      }
    }
    const eventTime = Date.parse(event.timestamp)
    if (!Number.isNaN(sinceTime) && eventTime < sinceTime) {
      return false
    }
    if (!Number.isNaN(untilTime) && eventTime > untilTime) {
      return false
    }
    return true
  })
}

export function auditEventTypeLabel(type: SecretsBrokerAuditEventType) {
  return type.replace(/_/g, ' ')
}
