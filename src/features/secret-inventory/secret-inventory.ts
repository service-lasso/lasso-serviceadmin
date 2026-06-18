export type SecretInventoryState =
  | 'present'
  | 'missing'
  | 'stale'
  | 'rotation-due'

export type SecretInventorySource =
  | 'local encrypted store'
  | 'provider connection'
  | 'file source'
  | 'generated write-back'

export interface SecretInventoryRow {
  id: string
  namespace: string
  refId: string
  source: SecretInventorySource
  backend: string
  owningService: string
  workspace: string
  presenceState: SecretInventoryState
  keyVersion: string
  lastUpdated: string
  lastUsed: string
  expiry: string
  rotationStatus: string
  providerConnectionUrl?: string
  refUsageUrl: string
  auditUrl: string
  safeNotes: string
  unavailableActions: string[]
}

export type SecretInventoryOperation = 'rotate' | 'delete'

export type SecretInventoryOperationState =
  | 'preview-ready'
  | 'unsupported'
  | 'policy-denied'
  | 'auth-required'
  | 'missing'
  | 'success'
  | 'failure'

export interface SecretInventoryOperationPreview {
  operation: SecretInventoryOperation
  state: SecretInventoryOperationState
  title: string
  badge: string
  capabilityResult: string
  policyResult: string
  auditRequirement: string
  applyStatus: string
  nextStep: string
  safeDiff: string[]
  affectedRefs: string[]
  requiresTypedConfirmation: boolean
  canRecordPreview: boolean
}

export const secretInventoryBoundaries = [
  'This deterministic local fixture models broker operation metadata only; it does not resolve secret payloads.',
  'Rows show refs, state, ownership, expiry, rotation readiness, safe actions, and links to adjacent metadata views only.',
  'Single-row rotate/delete actions use metadata-only broker previews with audit reason and typed confirmation gates.',
  'Plaintext values, raw reveal controls, clipboard actions, bulk edits, and spreadsheet-style mutation are intentionally absent.',
  'Any future raw reveal flow must remain a separate privileged workflow with identity, policy, audit reason, timeout, and no logging of values.',
]

export const secretInventoryRows: SecretInventoryRow[] = [
  {
    id: 'local-serviceadmin-session-signing',
    namespace: 'local/serviceadmin',
    refId: 'secret://local/serviceadmin/session-signing',
    source: 'local encrypted store',
    backend: '@secretsbroker/local/default',
    owningService: '@serviceadmin',
    workspace: 'local-dev',
    presenceState: 'present',
    keyVersion: 'v3',
    lastUpdated: '2026-05-07T19:10:00Z',
    lastUsed: '2026-05-08T09:45:00Z',
    expiry: 'managed rotation window',
    rotationStatus: 'healthy',
    refUsageUrl: '/dependencies?ref=session-signing',
    auditUrl: '/secrets-broker/audit-events',
    safeNotes: 'Startup-critical ref; value hidden and never rendered.',
    unavailableActions: ['show plaintext', 'copy value', 'bulk edit'],
  },
  {
    id: 'provider-zitadel-client-credential',
    namespace: 'provider/zitadel',
    refId: 'secret://provider/zitadel/client-credential',
    source: 'provider connection',
    backend: 'ZITADEL provider connection',
    owningService: '@serviceadmin',
    workspace: 'identity',
    presenceState: 'rotation-due',
    keyVersion: 'v5',
    lastUpdated: '2026-04-20T06:30:00Z',
    lastUsed: '2026-05-08T08:20:00Z',
    expiry: '2026-05-15T00:00:00Z',
    rotationStatus: 'due within 7 days',
    providerConnectionUrl: '/secrets-broker/sources',
    refUsageUrl: '/dependencies?ref=zitadel-client-credential',
    auditUrl: '/secrets-broker/audit-events',
    safeNotes: 'Connection metadata only; provider material remains hidden.',
    unavailableActions: ['show plaintext', 'rotate from table', 'export value'],
  },
  {
    id: 'file-source-node-registry-auth',
    namespace: 'file/runtime',
    refId: 'secret://file/runtime/node-registry-auth',
    source: 'file source',
    backend: 'runtime env file source',
    owningService: '@node',
    workspace: 'build',
    presenceState: 'stale',
    keyVersion: 'unknown',
    lastUpdated: '2026-04-12T11:00:00Z',
    lastUsed: '2026-05-01T12:05:00Z',
    expiry: 'not declared',
    rotationStatus: 'review source freshness',
    refUsageUrl: '/dependencies?ref=node-registry-auth',
    auditUrl: '/secrets-broker/audit-events',
    safeNotes: 'File path grants should be narrowed before future mutation UI.',
    unavailableActions: ['show plaintext', 'open source file', 'bulk rotate'],
  },
  {
    id: 'generated-echoservice-webhook-signing',
    namespace: 'generated/echoservice',
    refId: 'secret://generated/echoservice/webhook-signing',
    source: 'generated write-back',
    backend: '@secretsbroker/generated/write-back',
    owningService: 'echo-service',
    workspace: 'demo',
    presenceState: 'present',
    keyVersion: 'v1',
    lastUpdated: '2026-05-06T04:00:00Z',
    lastUsed: '2026-05-07T22:14:00Z',
    expiry: '2026-08-06T04:00:00Z',
    rotationStatus: 'healthy',
    refUsageUrl: '/dependencies?ref=webhook-signing',
    auditUrl: '/secrets-broker/audit-events',
    safeNotes: 'Generated value is write-only; table tracks metadata state.',
    unavailableActions: ['show plaintext', 'regenerate here', 'copy value'],
  },
  {
    id: 'provider-payments-signing-ref',
    namespace: 'provider/payments',
    refId: 'secret://provider/payments/signing-ref',
    source: 'provider connection',
    backend: 'payments provider connection',
    owningService: 'payments-api',
    workspace: 'future-prod-readonly',
    presenceState: 'missing',
    keyVersion: 'not available',
    lastUpdated: 'not available',
    lastUsed: 'not available',
    expiry: 'not available',
    rotationStatus: 'registration pending',
    providerConnectionUrl: '/secrets-broker/sources',
    refUsageUrl: '/dependencies?ref=payments-signing-ref',
    auditUrl: '/secrets-broker/audit-events',
    safeNotes:
      'Placeholder metadata; no production provider route is configured.',
    unavailableActions: ['show plaintext', 'remote fetch', 'bulk operation'],
  },
]

export function countSecretInventoryByState(rows = secretInventoryRows) {
  return rows.reduce(
    (counts, row) => ({
      ...counts,
      [row.presenceState]: counts[row.presenceState] + 1,
    }),
    {
      present: 0,
      missing: 0,
      stale: 0,
      'rotation-due': 0,
    } satisfies Record<SecretInventoryState, number>
  )
}

export function buildLargeSecretInventoryFixture(
  count: number
): SecretInventoryRow[] {
  return Array.from({ length: count }, (_, index) => ({
    ...secretInventoryRows[index % secretInventoryRows.length],
    id: `fixture-secret-ref-${index + 1}`,
    namespace: `fixture/workspace-${(index % 8) + 1}`,
    refId: `secret://fixture/workspace-${(index % 8) + 1}/ref-${index + 1}`,
    owningService: `fixture-service-${(index % 12) + 1}`,
    workspace: `fixture-${(index % 5) + 1}`,
  }))
}

function deriveOperationState(
  row: SecretInventoryRow,
  operation: SecretInventoryOperation
): SecretInventoryOperationState {
  if (row.presenceState === 'missing') return 'missing'

  if (row.source === 'file source') return 'unsupported'

  if (
    row.unavailableActions.some((action) =>
      action.toLowerCase().includes(operation)
    )
  ) {
    return 'unsupported'
  }

  if (row.backend.toLowerCase().includes('payments')) {
    return 'policy-denied'
  }

  if (row.source === 'provider connection' && operation === 'rotate') {
    return 'auth-required'
  }

  return 'preview-ready'
}

export function buildSecretInventoryOperationPreview(
  row: SecretInventoryRow,
  operation: SecretInventoryOperation,
  auditReason: string,
  confirmation: string,
  selectedState: SecretInventoryOperationState = 'preview-ready'
): SecretInventoryOperationPreview {
  const state =
    selectedState === 'preview-ready'
      ? deriveOperationState(row, operation)
      : selectedState
  const operationLabel = operation === 'rotate' ? 'Rotate' : 'Delete'
  const hasAuditReason = auditReason.trim().length >= 8
  const hasConfirmation = confirmation.trim() === row.refId
  const canRecordPreview =
    state === 'preview-ready' && hasAuditReason && hasConfirmation

  const base = {
    operation,
    state,
    title: `${operationLabel} preview for ${row.refId}`,
    affectedRefs: [row.refId],
    requiresTypedConfirmation: true,
    canRecordPreview,
  }

  if (state === 'unsupported') {
    return {
      ...base,
      badge: 'Unsupported',
      capabilityResult:
        operation === 'rotate'
          ? 'unsupported: provider/source does not expose broker-backed rotation'
          : 'unsupported: provider/source does not expose broker-backed delete',
      policyResult: 'not evaluated because capability is unavailable',
      auditRequirement:
        'audit reason may be recorded as operator intent; no mutation preview can apply',
      applyStatus: 'not applied',
      nextStep:
        'Use provider-specific metadata or external runbook for this ref.',
      safeDiff: [
        'no value read',
        'no value written',
        'unsupported capability rendered safely',
      ],
    }
  }

  if (state === 'policy-denied') {
    return {
      ...base,
      badge: 'Policy denied',
      capabilityResult: 'supported only after policy grants mutation',
      policyResult:
        'deny: selected ref is readonly or outside operator mutation scope',
      auditRequirement:
        'audit reason retained as metadata only; no mutation attempted',
      applyStatus: 'not applied',
      nextStep:
        'Request least-privilege mutation policy or choose another ref.',
      safeDiff: ['no value read', 'no value written', 'policy denial recorded'],
    }
  }

  if (state === 'auth-required') {
    return {
      ...base,
      badge: 'Provider auth required',
      capabilityResult: 'challenge: provider requires fresh operator auth',
      policyResult: 'policy pending until provider challenge completes',
      auditRequirement: 'reauthenticate before preview or apply',
      applyStatus: 'not applied',
      nextStep:
        'Complete the provider challenge, then rerun the broker-backed preview.',
      safeDiff: [
        'no value read',
        'no value written',
        'provider auth challenge emitted',
      ],
    }
  }

  if (state === 'missing') {
    return {
      ...base,
      badge: 'Ref missing',
      capabilityResult: 'missing: provider/source has no current ref to mutate',
      policyResult: 'fail closed before broker operation',
      auditRequirement:
        'audit reason can document operator intent; no existing ref is changed',
      applyStatus: 'not applied',
      nextStep: 'Connect or recreate the provider/source ref before mutation.',
      safeDiff: [
        'no existing ref selected for mutation',
        'no value read',
        'no value written',
      ],
    }
  }

  if (state === 'success') {
    return {
      ...base,
      badge: 'Preview recorded',
      capabilityResult: 'broker accepted metadata-only preview',
      policyResult: 'allow: single-ref mutation permitted by preview policy',
      auditRequirement: 'audit reason captured as safe metadata',
      applyStatus: 'deterministic preview recorded; production apply not wired',
      nextStep:
        'Use the production broker operation endpoint when the live contract is connected.',
      safeDiff: [
        'operation id would be recorded',
        'audit metadata would be linked',
        'raw value remains hidden',
      ],
    }
  }

  if (state === 'failure') {
    return {
      ...base,
      badge: 'Preview failed',
      capabilityResult: 'broker returned safe failure metadata',
      policyResult: 'allow preview; operation failed before mutation',
      auditRequirement: 'audit reason retained for failed preview',
      applyStatus: 'not applied',
      nextStep: 'Review the safe failure category and retry after repair.',
      safeDiff: [
        'metadata unchanged',
        'failure category rendered',
        'raw value remains hidden',
      ],
    }
  }

  return {
    ...base,
    badge: 'Preview ready',
    capabilityResult:
      operation === 'rotate'
        ? 'supported: broker-backed rotate dry-run available'
        : 'supported: broker-backed delete dry-run available',
    policyResult: 'allow preview; apply remains confirmation gated',
    auditRequirement: hasAuditReason
      ? 'audit reason present; typed confirmation still required'
      : 'enter at least 8 characters of audit reason',
    applyStatus: canRecordPreview
      ? 'ready to record metadata-only broker preview'
      : 'not applied',
    nextStep: canRecordPreview
      ? 'Record the preview result; production mutation still requires the live broker endpoint.'
      : 'Enter audit reason and the exact ref id before preview can be recorded.',
    safeDiff: [
      `${operationLabel.toLowerCase()} target ref selected`,
      'affected service metadata reviewed',
      'raw value is never displayed, logged, copied, or exported',
    ],
  }
}

export function secretInventoryHasPlaintextMaterial(
  rows = secretInventoryRows
): boolean {
  const serialized = JSON.stringify(rows)
  return (
    /\b(bearer|basic)\s+(?!auth\b)[a-z0-9._~+/=-]{8,}/i.test(serialized) ||
    /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret|session[_-]?secret|password|cookie|private[_-]?key|recovery[_-]?key|env[_-]?value)\s*[:=]\s*([^\s,;]+)/i.test(
      serialized
    ) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(serialized)
  )
}

export function secretInventoryOperationHasPlaintextMaterial(
  preview: SecretInventoryOperationPreview
): boolean {
  return secretInventoryHasPlaintextMaterial([
    preview as unknown as SecretInventoryRow,
  ])
}
