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

export type StubSecretMutationState =
  | 'ready'
  | 'denied'
  | 'auth-required'
  | 'unavailable'
  | 'cancelled'
  | 'success'
  | 'failure'

export type StubSecretMutationPreview = {
  state: StubSecretMutationState
  title: string
  badge: string
  dryRunStatus: string
  applyStatus: string
  policyDecision: string
  auditRequirement: string
  safeDiff: string[]
  affectedRefs: string[]
  nextStep: string
  canApply: boolean
  stubOnly: true
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
  'The update/reset/reveal API shown here is a deterministic stub preview until the Secrets Broker production mutation contract lands.',
]

export const stubSecretMutationStates: Array<{
  id: StubSecretMutationState
  label: string
}> = [
  { id: 'ready', label: 'Ready dry-run preview' },
  { id: 'denied', label: 'Policy denied' },
  { id: 'auth-required', label: 'Auth required' },
  { id: 'unavailable', label: 'Broker unavailable' },
  { id: 'cancelled', label: 'Operator cancelled' },
  { id: 'success', label: 'Stub apply success' },
  { id: 'failure', label: 'Stub apply failure' },
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
    'secrets-management:stub-mutation-preview',
    'secrets-management:stub-mutation-apply-status',
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

export function buildStubSecretMutationPreview(
  row: ManagedSecretRow,
  action: ManagedSecretAction,
  state: StubSecretMutationState,
  auditReason: string,
  confirmed: boolean
): StubSecretMutationPreview {
  const actionLabel =
    action === 'reset'
      ? 'reset/rotate'
      : action === 'reveal'
        ? 'reveal'
        : 'update'
  const hasAuditReason = auditReason.trim().length >= 8
  const base = {
    state,
    title: `Stub ${actionLabel} preview for ${row.name}`,
    affectedRefs: [row.ref],
    stubOnly: true as const,
  }

  if (state === 'denied') {
    return {
      ...base,
      badge: 'Policy denied',
      dryRunStatus: 'blocked before preview',
      applyStatus: 'not applied',
      policyDecision: 'deny: operator lacks single-secret mutation entitlement',
      auditRequirement:
        'audit reason retained as metadata only; no mutation attempted',
      safeDiff: ['no value read', 'no value written', 'policy denial recorded'],
      nextStep: 'Request least-privilege access or choose a different ref.',
      canApply: false,
    }
  }

  if (state === 'auth-required') {
    return {
      ...base,
      badge: 'Auth required',
      dryRunStatus: 'blocked before preview',
      applyStatus: 'not applied',
      policyDecision:
        'challenge: broker requires fresh operator authentication',
      auditRequirement: 'reauthenticate before preview or apply',
      safeDiff: ['no value read', 'no value written', 'auth challenge emitted'],
      nextStep:
        'Complete broker auth challenge, then rerun the dry-run preview.',
      canApply: false,
    }
  }

  if (state === 'unavailable') {
    return {
      ...base,
      badge: 'Broker unavailable',
      dryRunStatus: 'failed closed',
      applyStatus: 'not applied',
      policyDecision:
        'unavailable: stub broker endpoint did not accept mutation preview',
      auditRequirement: 'retry when broker health is restored',
      safeDiff: [
        'no value read',
        'no value written',
        'unavailable status rendered',
      ],
      nextStep: 'Check Secrets Broker health and retry the preview.',
      canApply: false,
    }
  }

  if (state === 'cancelled') {
    return {
      ...base,
      badge: 'Cancelled',
      dryRunStatus: 'preview discarded',
      applyStatus: 'cancelled by operator',
      policyDecision: 'allow preview only; apply cancelled',
      auditRequirement: 'audit reason discarded with the cancelled operation',
      safeDiff: [
        'preview generated',
        'no value written',
        'operator cancellation recorded',
      ],
      nextStep: 'Choose another action or rerun preview with a fresh reason.',
      canApply: false,
    }
  }

  if (state === 'success') {
    return {
      ...base,
      badge: 'Stub apply success',
      dryRunStatus: 'preview accepted',
      applyStatus: 'deterministic fake apply completed',
      policyDecision: 'allow: single-secret mutation permitted by stub policy',
      auditRequirement: 'audit reason captured as safe metadata',
      safeDiff: [
        'metadata version increments by 1',
        'dependent service restart note added',
        'raw value remains hidden',
      ],
      nextStep:
        'Production broker API will replace this fake status when contract lands.',
      canApply: false,
    }
  }

  if (state === 'failure') {
    return {
      ...base,
      badge: 'Stub apply failure',
      dryRunStatus: 'preview accepted',
      applyStatus: 'deterministic fake apply failed',
      policyDecision: 'allow preview; apply returned safe failure metadata',
      auditRequirement: 'audit reason retained for failed attempt',
      safeDiff: [
        'metadata unchanged',
        'failure category rendered',
        'raw value remains hidden',
      ],
      nextStep:
        'Review safe failure category and retry after broker contract issue is resolved.',
      canApply: false,
    }
  }

  return {
    ...base,
    badge: 'Ready dry-run preview',
    dryRunStatus: hasAuditReason
      ? 'metadata-only dry-run ready'
      : 'audit reason required',
    applyStatus: 'not applied',
    policyDecision:
      row.state === 'missing'
        ? 'deny until ref/source exists'
        : 'allow preview; apply remains confirmation gated',
    auditRequirement: hasAuditReason
      ? 'audit reason present; confirmation still required'
      : 'enter at least 8 characters of audit reason',
    safeDiff: [
      `${actionLabel} target ref selected`,
      'affected service metadata reviewed',
      'raw value placeholder is never displayed',
    ],
    nextStep:
      row.state === 'missing'
        ? 'Connect the provider/source before mutation preview can apply.'
        : confirmed && hasAuditReason
          ? 'Use the stub state selector to simulate apply success or failure.'
          : 'Enter audit reason and explicit confirmation before apply can be simulated.',
    canApply: row.state !== 'missing' && confirmed && hasAuditReason,
  }
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
