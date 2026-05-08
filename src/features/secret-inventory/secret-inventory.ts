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

export const secretInventoryBoundaries = [
  'This is deterministic local fixture metadata only; it does not query a backend or resolve secret payloads.',
  'Rows show refs, state, ownership, expiry, rotation, and links to adjacent metadata views only.',
  'Plaintext values, raw reveal controls, clipboard actions, bulk edits, and rotation mutations are intentionally absent.',
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
    auditUrl: '/secrets-broker#audit',
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
    providerConnectionUrl: '/secrets-broker#provider-connections',
    refUsageUrl: '/dependencies?ref=zitadel-client-credential',
    auditUrl: '/secrets-broker#audit',
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
    auditUrl: '/secrets-broker#audit',
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
    auditUrl: '/secrets-broker#audit',
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
    providerConnectionUrl: '/secrets-broker#provider-connections',
    refUsageUrl: '/dependencies?ref=payments-signing-ref',
    auditUrl: '/secrets-broker#audit',
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
