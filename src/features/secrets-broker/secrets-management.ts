export type ManagedSecretState =
  | 'present'
  | 'rotation-due'
  | 'stale'
  | 'missing'

export type ManagedSecretAction =
  | 'metadata'
  | 'reveal'
  | 'edit'
  | 'reset'
  | 'policy'

export type ManagedSecretRow = {
  id: string
  ref: string
  name: string
  owningService: string
  provider: string
  source: string
  workspace: string
  state: ManagedSecretState
  lastUpdatedAt: string
  lastUsedAt: string
  rotationStatus: string
  policy: string
  auditStatus: string
  backendCapability: string
  valueSearch: 'supported' | 'unsupported'
  safeTags: string[]
}

export type ManagedSecretActionPreview = {
  action: ManagedSecretAction
  title: string
  status: string
  preview: string
  nextStep: string
  requiresConfirmation: boolean
}

export const managedSecretRows: ManagedSecretRow[] = [
  {
    id: 'serviceadmin-session-signing',
    ref: 'secret://local/default/@serviceadmin/SESSION_SIGNING_KEY',
    name: 'SESSION_SIGNING_KEY',
    owningService: '@serviceadmin',
    provider: 'local encrypted store',
    source: 'local-default',
    workspace: 'local-dev',
    state: 'present',
    lastUpdatedAt: '2026-05-08T10:44:00Z',
    lastUsedAt: '2026-05-08T15:10:00Z',
    rotationStatus: 'healthy',
    policy: 'policy/openclaw/service-lasso/read-single-secret',
    auditStatus: 'audit available',
    backendCapability: 'reveal, edit dry-run, reset dry-run, policy preview',
    valueSearch: 'supported',
    safeTags: ['startup', 'session', 'local'],
  },
  {
    id: 'zitadel-client-credential',
    ref: 'secret://provider/zitadel/client-credential',
    name: 'ZITADEL_CLIENT_CREDENTIAL',
    owningService: '@serviceadmin',
    provider: 'provider connection',
    source: 'zitadel-admin',
    workspace: 'identity',
    state: 'rotation-due',
    lastUpdatedAt: '2026-04-20T06:30:00Z',
    lastUsedAt: '2026-05-08T08:20:00Z',
    rotationStatus: 'due within 7 days',
    policy: 'policy/openclaw/service-lasso/provider-read',
    auditStatus: 'audit available',
    backendCapability: 'metadata, reveal challenge, reset dry-run',
    valueSearch: 'supported',
    safeTags: ['identity', 'provider', 'rotation'],
  },
  {
    id: 'runtime-node-registry-auth',
    ref: 'secret://file/runtime/node-registry-auth',
    name: 'NODE_REGISTRY_AUTH',
    owningService: '@node',
    provider: 'file source',
    source: 'runtime env file',
    workspace: 'build',
    state: 'stale',
    lastUpdatedAt: '2026-04-12T11:00:00Z',
    lastUsedAt: '2026-05-01T12:05:00Z',
    rotationStatus: 'review source freshness',
    policy: 'policy/openclaw/service-lasso/file-source-review',
    auditStatus: 'audit available',
    backendCapability: 'metadata, edit dry-run only',
    valueSearch: 'unsupported',
    safeTags: ['file-source', 'build'],
  },
  {
    id: 'payments-signing-ref',
    ref: 'secret://provider/payments/signing-ref',
    name: 'PAYMENTS_SIGNING_REF',
    owningService: 'payments-api',
    provider: 'provider connection',
    source: 'payments-provider',
    workspace: 'future-prod-readonly',
    state: 'missing',
    lastUpdatedAt: 'not available',
    lastUsedAt: 'not available',
    rotationStatus: 'registration pending',
    policy: 'policy/openclaw/service-lasso/payments-readonly',
    auditStatus: 'audit required before reveal',
    backendCapability: 'metadata only until provider is connected',
    valueSearch: 'unsupported',
    safeTags: ['payments', 'placeholder'],
  },
]

export const managedSecretSafetyBoundaries = [
  'Rows contain safe metadata only: refs, owner, provider/source, state, policy, audit status, and action readiness.',
  'Metadata search filters refs/tags/provider/owner locally; it does not index raw secret values.',
  'Broker-backed value search is represented as supported or unsupported and returns ref metadata only.',
  'Reveal delegates to the controlled #38 pattern: explicit action, audit status, timeout, and value hidden by default.',
  'Edit, reset, and policy actions require dry-run/preview before apply and never use spreadsheet-style plaintext editing.',
]

export const managedSecretSafeSurfaces = {
  route: '/secrets-broker/secrets',
  pageTitle: 'Service Admin - Secrets Broker Secrets',
  breadcrumb: 'Secrets Broker / Secrets',
  diagnostics:
    'secrets_table=metadata_only; value_search=refs_only; raw_values=hidden',
  supportBundle:
    'secrets management table includes refs, state, policy, and audit metadata only; raw values omitted',
  consoleEvents: [
    'secrets-management:metadata-search',
    'secrets-management:value-search-metadata-only',
    'secrets-management:action-preview',
  ],
  persistedStorage: 'none',
}

export function filterManagedSecrets(
  rows: ManagedSecretRow[],
  query: string,
  state: ManagedSecretState | 'all'
): ManagedSecretRow[] {
  const normalized = query.trim().toLowerCase()
  return rows.filter((row) => {
    const matchesState = state === 'all' || row.state === state
    const matchesQuery =
      normalized.length === 0 ||
      [
        row.ref,
        row.name,
        row.owningService,
        row.provider,
        row.source,
        row.workspace,
        row.rotationStatus,
        ...row.safeTags,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    return matchesState && matchesQuery
  })
}

export function valueSearchManagedSecrets(
  rows: ManagedSecretRow[],
  query: string,
  supported: boolean
): ManagedSecretRow[] {
  const normalized = query.trim().toLowerCase()
  if (!supported || normalized.length === 0) return []
  return rows.filter(
    (row) =>
      row.valueSearch === 'supported' &&
      (row.safeTags.join(' ').toLowerCase().includes(normalized) ||
        row.name.toLowerCase().includes(normalized) ||
        row.owningService.toLowerCase().includes(normalized))
  )
}

export function buildManagedSecretActionPreview(
  row: ManagedSecretRow,
  action: ManagedSecretAction
): ManagedSecretActionPreview {
  switch (action) {
    case 'reveal':
      return {
        action,
        title: `Controlled reveal for ${row.name}`,
        status:
          row.state === 'missing'
            ? 'fail-closed: ref missing'
            : 'ready for controlled reveal handoff',
        preview:
          'Uses the #38 reveal pattern: explicit operator action, policy/audit status, short-lived display, and value hidden until authorized.',
        nextStep:
          row.state === 'missing'
            ? 'Connect the provider/source before reveal can be requested.'
            : 'Open the controlled reveal flow with an audit reason; raw value is not shown in this table.',
        requiresConfirmation: true,
      }
    case 'edit':
      return {
        action,
        title: `Edit/update dry-run for ${row.name}`,
        status:
          row.state === 'missing'
            ? 'blocked: ref unavailable'
            : 'dry-run required before apply',
        preview:
          'Preview validates target ref, policy, backend capability, affected service metadata, and audit readiness without plaintext spreadsheet editing.',
        nextStep:
          'Run dry-run, review metadata-only diff, enter audit reason, then apply only after explicit confirmation.',
        requiresConfirmation: true,
      }
    case 'reset':
      return {
        action,
        title: `Reset/rotate dry-run for ${row.name}`,
        status:
          row.state === 'missing'
            ? 'blocked: provider/source missing'
            : 'rotation preview required before apply',
        preview:
          'Preview checks backend support, policy, affected service restart notes, and audit status without generating or displaying raw material in Service Admin.',
        nextStep:
          'Run reset/rotate preview first; apply remains disabled until preview and audit reason are accepted.',
        requiresConfirmation: true,
      }
    case 'policy':
      return {
        action,
        title: `Policy preview for ${row.name}`,
        status: 'policy preview required before apply',
        preview:
          'Preview shows policy target, expected outcome, affected refs, and audit status. Applying policy is separate and confirmation-gated.',
        nextStep:
          'Review policy preview and audit impact before applying any change.',
        requiresConfirmation: true,
      }
    case 'metadata':
    default:
      return {
        action: 'metadata',
        title: `Metadata view for ${row.name}`,
        status: 'metadata only',
        preview:
          'Displays safe ref metadata, ownership, provider/source, rotation state, policy, audit posture, and action readiness only.',
        nextStep:
          'Choose a controlled row action when an operator task is needed.',
        requiresConfirmation: false,
      }
  }
}

const forbiddenSecretPattern =
  /(secret-value|plaintext|correct-horse-battery-staple|portable-master-key|raw key|sk-[a-z0-9]|ghp_[a-z0-9]|AKIA[0-9A-Z]{16}|password\s*=|api[_-]?key\s*=|private key|cookie=|bearer\s+[a-z0-9])/i

export function managedSecretsHaveSecretMaterial(rows = managedSecretRows) {
  return forbiddenSecretPattern.test(JSON.stringify(rows))
}

export function managedSecretSafeSurfacesIncludeSecretMaterial() {
  return forbiddenSecretPattern.test(JSON.stringify(managedSecretSafeSurfaces))
}
