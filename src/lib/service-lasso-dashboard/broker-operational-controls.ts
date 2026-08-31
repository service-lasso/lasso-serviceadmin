import type {
  BrokerEventsResult,
  BrokerOperationalEvent,
  BrokerTelemetry,
  SecretAccessPolicyGrant,
} from './types'

export type OperationalControlsExport = {
  schema: 'service-lasso.admin.operational-controls-export.v1'
  generatedAt: string
  telemetry: {
    outcome: string
    generatedAt: string
    activeLockouts: number
    localApiAuthFailures: number
    auditRecords: BrokerTelemetry['counters']['auditRecords']
    policyDecisions: BrokerTelemetry['counters']['policyDecisions']
  }
  events: Array<{
    id: string
    ts: string
    family: string
    severity: string
    operation: string
    outcome: string
    serviceId?: string
    providerId?: string
    lockoutScope?: string
    retryAfterSeconds?: number
  }>
  effectivePolicy: Array<{
    serviceId: string
    namespace: string
    refs: string[]
    operations: string[]
  }>
}

const UNSAFE_EXPORT_MARKERS = [
  'secretValue',
  'masterKey',
  'recoveryShare',
  'passphrase',
  'bearer',
  'privateKey',
  'password',
  'cookie',
  'authorization',
]

/**
 * True when Broker telemetry and events may be exported as metadata-only.
 */
export function operationalSafetyFlagsAllowExport(input: {
  valueMaterialIncluded: boolean
  metadataOnly: boolean
  rawRefIncluded: boolean
}): boolean {
  return (
    input.valueMaterialIncluded === false &&
    input.metadataOnly === true &&
    input.rawRefIncluded === false
  )
}

/**
 * Builds a metadata-only operational-controls export. Throws if Broker safety
 * flags are weakened or secret-bearing fields appear.
 */
export function buildOperationalControlsExport(input: {
  generatedAt: string
  telemetry: BrokerTelemetry
  events: BrokerEventsResult
  grants: readonly SecretAccessPolicyGrant[]
}): OperationalControlsExport {
  if (
    !operationalSafetyFlagsAllowExport({
      valueMaterialIncluded: input.telemetry.safety.valueMaterialIncluded,
      metadataOnly: input.events.safety.metadataOnly,
      rawRefIncluded: input.events.safety.rawRefIncluded,
    }) ||
    input.events.safety.valueMaterialIncluded !== false
  ) {
    throw new Error(
      'Operational export failed closed because Broker safety metadata is weakened.'
    )
  }
  const payload: OperationalControlsExport = {
    schema: 'service-lasso.admin.operational-controls-export.v1',
    generatedAt: input.generatedAt,
    telemetry: {
      outcome: input.telemetry.outcome,
      generatedAt: input.telemetry.generatedAt,
      activeLockouts: input.telemetry.counters.activeLockouts,
      localApiAuthFailures: input.telemetry.counters.localApiAuthFailures,
      auditRecords: input.telemetry.counters.auditRecords,
      policyDecisions: input.telemetry.counters.policyDecisions,
    },
    events: input.events.events.map((event) => ({
      id: event.id,
      ts: event.ts,
      family: event.family,
      severity: event.severity,
      operation: event.operation,
      outcome: event.outcome,
      serviceId: event.serviceId,
      providerId: event.providerId,
      lockoutScope: event.lockoutScope,
      retryAfterSeconds: event.retryAfterSeconds,
    })),
    effectivePolicy: input.grants.map((grant) => ({
      serviceId: grant.serviceId,
      namespace: grant.namespace,
      refs: [...grant.refs],
      operations: [...grant.operations],
    })),
  }
  const serialized = JSON.stringify(payload)
  for (const marker of UNSAFE_EXPORT_MARKERS) {
    if (serialized.toLowerCase().includes(marker.toLowerCase())) {
      throw new Error(
        'Operational export failed closed because withheld material was present.'
      )
    }
  }
  return payload
}

export type ActiveLockoutSummary = {
  count: number
  scopes: Array<{
    scope: string
    retryAfterSeconds?: number
    retryGuidance: string
  }>
}

/**
 * Lists active lockout scopes from live telemetry plus lockout_started events.
 */
export function summarizeActiveLockouts(input: {
  activeLockouts: number
  events: readonly BrokerOperationalEvent[]
}): ActiveLockoutSummary {
  const scopes: ActiveLockoutSummary['scopes'] = []
  for (const event of input.events) {
    if (event.family !== 'lockout_started' || !event.lockoutScope) continue
    scopes.push({
      scope: event.lockoutScope,
      retryAfterSeconds: event.retryAfterSeconds,
      retryGuidance:
        event.retryAfterSeconds !== undefined
          ? `Retry window ${String(event.retryAfterSeconds)} seconds.`
          : 'Broker enforces the retry window for this exact scope.',
    })
  }
  return {
    count: input.activeLockouts,
    scopes,
  }
}

/**
 * Compact effective-policy rows: allowed namespaces and refs per service.
 */
export function summarizeEffectivePolicy(
  grants: readonly SecretAccessPolicyGrant[]
): Array<{
  serviceId: string
  namespace: string
  refsLabel: string
  operationsLabel: string
}> {
  return grants.map((grant) => ({
    serviceId: grant.serviceId,
    namespace: grant.namespace,
    refsLabel: grant.namespaceWide
      ? 'namespace-wide'
      : grant.refs.join(', ') || 'No refs declared',
    operationsLabel: grant.operations.join(', '),
  }))
}
