export type SecretsBrokerAuditEventType =
  | 'resolve_granted'
  | 'resolve_denied'
  | 'reveal_granted'
  | 'reveal_denied'
  | 'external_provider_read'
  | 'refresh_failure'
  | 'reconnect_required'
  | 'session_token_revoked'
  | 'write_back_denied'
  | 'write_back_committed'
  | 'migration_started'
  | 'migration_completed'
  | 'policy_changed'
  | 'secret_rotated'

export type SecretsBrokerAuditOutcome =
  | 'granted'
  | 'denied'
  | 'failure'
  | 'revoked'
  | 'success'

export type SecretsBrokerAuditTamperEvidenceStatus =
  | 'verified'
  | 'broken'
  | 'unavailable'

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
  affectedRefs: string[]
  affectedServices: string[]
  policyId: string
  policyDecision: string
  normalizedReason: string
  auditReason: string
  tamperEvidence: {
    status: SecretsBrokerAuditTamperEvidenceStatus
    chainId: string
    sequence: number | null
    previousHashRef: string | null
    entryHashRef: string | null
    checkedAt: string | null
    note: string
  }
}

export type SecretsBrokerAuditFilters = {
  type?: SecretsBrokerAuditEventType | 'all'
  outcome?: SecretsBrokerAuditOutcome | 'all'
  provider?: SecretsBrokerAuditEvent['provider'] | 'all'
  tamperEvidence?: SecretsBrokerAuditTamperEvidenceStatus | 'all'
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
    affectedRefs: ['openclaw/anthropic/api_key'],
    affectedServices: ['@serviceadmin'],
    policyId: 'policy/openclaw/service-lasso/read',
    policyDecision: 'allow: namespace and service identity matched',
    normalizedReason: 'Resolver granted access to the requested SecretRef.',
    auditReason: 'startup dependency resolution',
    tamperEvidence: {
      status: 'verified',
      chainId: 'audit-chain/openclaw/service-lasso/2026-05-07',
      sequence: 1842,
      previousHashRef: 'sha256:prev-openclaw-1841',
      entryHashRef: 'sha256:event-openclaw-1842',
      checkedAt: '2026-05-07T18:20:05Z',
      note: 'Hash chain verified by broker metadata endpoint.',
    },
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
    affectedRefs: ['postgres.ADMIN_PASSWORD'],
    affectedServices: ['postgres'],
    policyId: 'policy/local/default/read',
    policyDecision: 'deny: service identity missing ref grant',
    normalizedReason:
      'Policy denied the read request before any value was resolved.',
    auditReason: 'service startup preflight',
    tamperEvidence: {
      status: 'verified',
      chainId: 'audit-chain/local/default/2026-05-07',
      sequence: 778,
      previousHashRef: 'sha256:prev-local-777',
      entryHashRef: 'sha256:event-local-778',
      checkedAt: '2026-05-07T18:19:20Z',
      note: 'Denial event is present in the verified local chain.',
    },
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
    affectedRefs: ['telegram.bot_token'],
    affectedServices: ['telegram-alerts', '@serviceadmin'],
    policyId: 'policy/external/ops/refresh',
    policyDecision: 'allow: refresh attempted',
    normalizedReason:
      'External provider refresh failed because source authentication is required.',
    auditReason: 'provider reconnect check',
    tamperEvidence: {
      status: 'unavailable',
      chainId: 'audit-chain/vault/ops/2026-05-07',
      sequence: null,
      previousHashRef: null,
      entryHashRef: null,
      checkedAt: null,
      note: 'Provider is auth-required, so chain proof cannot be fetched yet.',
    },
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
    affectedRefs: ['openclaw/session_token'],
    affectedServices: ['cli:service-lasso'],
    policyId: 'policy/openclaw/session/lifecycle',
    policyDecision: 'revoke: token replaced by newer session',
    normalizedReason: 'Session credential was revoked after rotation.',
    auditReason: 'session rotation',
    tamperEvidence: {
      status: 'broken',
      chainId: 'audit-chain/openclaw/session/2026-05-07',
      sequence: 91,
      previousHashRef: 'sha256:prev-session-090',
      entryHashRef: 'sha256:event-session-091',
      checkedAt: '2026-05-07T18:17:30Z',
      note: 'Broker reported a previous-entry mismatch; treat as investigation required.',
    },
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
    affectedRefs: ['openclaw/anthropic/api_key'],
    affectedServices: ['dagu:daily-ai-summary'],
    policyId: 'policy/workflows/ai-summary/read',
    policyDecision: 'allow: workflow run identity matched',
    normalizedReason:
      'External provider returned metadata for a successful read.',
    auditReason: 'workflow SecretRef resolution',
    tamperEvidence: {
      status: 'verified',
      chainId: 'audit-chain/onepassword/ops/2026-05-07',
      sequence: 122,
      previousHashRef: 'sha256:prev-1password-121',
      entryHashRef: 'sha256:event-1password-122',
      checkedAt: '2026-05-07T18:16:10Z',
      note: 'Provider read event was appended and verified by broker metadata.',
    },
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
    affectedRefs: ['@serviceadmin/SESSION_SECRET'],
    affectedServices: ['@serviceadmin'],
    policyId: 'policy/local/default/write-back',
    policyDecision: 'deny: write-back requires operator audit reason',
    normalizedReason:
      'Generated secret write-back was denied before storing a value.',
    auditReason: 'generated secret dry-run',
    tamperEvidence: {
      status: 'verified',
      chainId: 'audit-chain/local/default/2026-05-07',
      sequence: 777,
      previousHashRef: 'sha256:prev-local-776',
      entryHashRef: 'sha256:event-local-777',
      checkedAt: '2026-05-07T18:15:25Z',
      note: 'Denied write-back event was verified; no generated value was stored.',
    },
  },
  {
    id: 'evt-20260507-007',
    timestamp: '2026-05-07T18:14:10Z',
    type: 'reveal_granted',
    outcome: 'granted',
    provider: 'local',
    source: '@secretsbroker/local/default',
    connection: 'Controlled reveal session',
    serviceOrWorkflow: '@serviceadmin',
    actorType: 'operator',
    actorId: 'operator:max',
    ref: '@serviceadmin/SESSION_SECRET',
    affectedRefs: ['@serviceadmin/SESSION_SECRET'],
    affectedServices: ['@serviceadmin'],
    policyId: 'policy/local/default/reveal',
    policyDecision: 'allow: privileged reveal with recorded reason',
    normalizedReason:
      'A privileged reveal was approved; this viewer stores only the reveal metadata.',
    auditReason: 'operator break-glass verification',
    tamperEvidence: {
      status: 'verified',
      chainId: 'audit-chain/local/default/2026-05-07',
      sequence: 776,
      previousHashRef: 'sha256:prev-local-775',
      entryHashRef: 'sha256:event-local-776',
      checkedAt: '2026-05-07T18:14:15Z',
      note: 'Reveal event metadata verified; raw value is not retained in audit detail.',
    },
  },
  {
    id: 'evt-20260507-008',
    timestamp: '2026-05-07T18:13:02Z',
    type: 'migration_completed',
    outcome: 'success',
    provider: 'vault',
    source: '@secretsbroker/migration/local-to-vault',
    connection: 'Local to Vault migration',
    serviceOrWorkflow: 'migration:ops-vault-cutover',
    actorType: 'operator',
    actorId: 'operator:max',
    ref: 'payments/*',
    affectedRefs: ['payments/STRIPE_API_TOKEN', 'payments/WEBHOOK_SIGNING_REF'],
    affectedServices: ['payments-api', 'billing-worker'],
    policyId: 'policy/migration/local-to-vault',
    policyDecision: 'allow: migration plan approved',
    normalizedReason:
      'Migration completed with counts and ref identifiers only; payload values were not exported.',
    auditReason: 'approved backend migration',
    tamperEvidence: {
      status: 'verified',
      chainId: 'audit-chain/migration/local-to-vault/2026-05-07',
      sequence: 44,
      previousHashRef: 'sha256:prev-migration-043',
      entryHashRef: 'sha256:event-migration-044',
      checkedAt: '2026-05-07T18:13:08Z',
      note: 'Migration summary and counts were verified without value payloads.',
    },
  },
  {
    id: 'evt-20260507-009',
    timestamp: '2026-05-07T18:12:31Z',
    type: 'policy_changed',
    outcome: 'success',
    provider: 'local',
    source: '@secretsbroker/policy/default',
    connection: 'Policy engine',
    serviceOrWorkflow: '@secretsbroker',
    actorType: 'operator',
    actorId: 'operator:max',
    ref: 'policy/local/default/read',
    affectedRefs: ['postgres.ADMIN_PASSWORD', '@serviceadmin/SESSION_SECRET'],
    affectedServices: ['postgres', '@serviceadmin'],
    policyId: 'policy/local/default/read',
    policyDecision: 'change: grant narrowed to explicit service identities',
    normalizedReason:
      'Policy metadata changed; the event includes affected refs and services only.',
    auditReason: 'least-privilege policy maintenance',
    tamperEvidence: {
      status: 'verified',
      chainId: 'audit-chain/policy/default/2026-05-07',
      sequence: 19,
      previousHashRef: 'sha256:prev-policy-018',
      entryHashRef: 'sha256:event-policy-019',
      checkedAt: '2026-05-07T18:12:36Z',
      note: 'Policy change event is verified; no policy secret material is present.',
    },
  },
]

export const secretMaterialSentinels = [
  'DEMO_REVEAL_VALUE_42',
  'ACTUAL_SECRET',
  'RAW_SECRET',
  'BEGIN PRIVATE KEY',
  'AWS_SECRET_ACCESS_KEY=',
  'PASSWORD=',
  'CLIENT_SECRET=',
  'SESSION_COOKIE=',
  'REFRESH_TOKEN=',
  'BOT_TOKEN=',
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
    if (
      filters.tamperEvidence &&
      filters.tamperEvidence !== 'all' &&
      event.tamperEvidence.status !== filters.tamperEvidence
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
        event.policyId,
        event.policyDecision,
        event.normalizedReason,
        event.auditReason,
        event.tamperEvidence.status,
        event.tamperEvidence.chainId,
        ...event.affectedRefs,
        ...event.affectedServices,
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

export function auditEventsContainSecretMaterial(
  events: SecretsBrokerAuditEvent[] = secretsBrokerAuditEvents
) {
  const serialized = JSON.stringify(events).toUpperCase()

  return secretMaterialSentinels.some((sentinel) =>
    serialized.includes(sentinel.toUpperCase())
  )
}
