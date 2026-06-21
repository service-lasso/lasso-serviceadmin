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
  | 'delete'
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

export type ManagedSecretActionReadiness = {
  action: Exclude<ManagedSecretAction, 'metadata'>
  label: string
  status: 'ready' | 'blocked'
  badge: string
  blockers: string[]
  safeChecks: string[]
  nextStep: string
  canPreview: boolean
}

export type SingleSecretOperationPlan = {
  action: ManagedSecretAction
  operationId: string
  endpoint: string
  dryRunStatus: string
  capabilityDecision: string
  policyDecision: string
  auditRequirement: string
  applyGate: string
  blockers: string[]
  safePayloadFields: string[]
  revalidationChecks: string[]
  canSubmit: boolean
}

export type SingleSecretOperationOutcome =
  | 'submitted'
  | 'applied'
  | 'policy-denied'
  | 'auth-required'
  | 'failed'
  | 'stale-plan'

export type SingleSecretAuditFeedback = {
  auditEventId: string
  correlationId: string
  eventState: string
  redactionStatus: string
  dependentServiceStatus: string
  sinkStatus: string
  evidenceRows: string[]
}

export type SingleSecretOperationResult = {
  operationId: string
  ref: string
  action: ManagedSecretAction
  outcome: SingleSecretOperationOutcome
  applied: boolean
  resultBadge: string
  auditStatus: string
  resultStatus: string
  recoveryStatus: string
  retryPolicy: string
  recoverySteps: string[]
  auditFeedback: SingleSecretAuditFeedback
  safetyRows: string[]
  nextAction: string
}

export type SingleSecretDecommissionPreview = {
  ref: string
  operationId: string
  mode: 'disable' | 'decommission'
  eligible: boolean
  badge: string
  dependentServiceRefs: string[]
  recoveryPlanRef: string
  tombstoneRef: string
  retentionStatus: string
  auditTrail: string
  applyGate: string
  blockers: string[]
  safeMetadataRows: string[]
}

export type SingleSecretPolicyPreview = {
  ref: string
  operationId: string
  eligible: boolean
  badge: string
  currentPolicyRef: string
  targetPolicyRef: string
  policyDiffMetadata: string[]
  affectedConsumerRefs: string[]
  rollbackPlanRef: string
  auditTrail: string
  applyGate: string
  blockers: string[]
  enforcementChecks: string[]
  safeMetadataRows: string[]
}

export type SingleSecretOperationHistoryEntry = SingleSecretOperationResult & {
  rowName: string
  provider: string
  policy: string
  auditEventId: string
  statusBadge: string
  submittedAt: string
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

export type BulkSecretCampaignOperation =
  | 'rotate-reset'
  | 'update-edit'
  | 'apply-policy'
  | 'migrate-provider'
  | 'mark-action-required'

export type BulkSecretCampaignItem = {
  id: string
  ref: string
  name: string
  owningService: string
  sourceProvider: string
  targetProvider: string
  targetPolicy: string
  capabilityResult: string
  policyResult: string
  risk: 'low' | 'medium' | 'high'
  auditRequirement: string
  expectedAction: string
  blockers: string[]
  idempotencyKey: string
  operationItemId: string
  retrySafe: boolean
  recovery: string
}

export type BulkSecretCampaignPlan = {
  campaignId: string
  operationId: string
  planToken: string
  operation: BulkSecretCampaignOperation
  selectedCount: number
  applicableCount: number
  deniedCount: number
  unsupportedCount: number
  authRequiredCount: number
  missingProviderCount: number
  highRiskCount: number
  items: BulkSecretCampaignItem[]
  applyAvailable: boolean
}

export type BulkSecretCampaignRevalidationState =
  | 'ready'
  | 'stale-plan'
  | 'provider-changed'
  | 'policy-changed'
  | 'capability-changed'
  | 'auth-required'
  | 'denied'
  | 'unsupported'
  | 'audit-unavailable'

export type BulkSecretCampaignApplyGate = {
  auditReasonAccepted: boolean
  confirmationRequired: boolean
  confirmationPhrase: string
  confirmationAccepted: boolean
  revalidationPassed: boolean
  revalidationStatus: string
  statusRows: string[]
  blockers: string[]
  canApply: boolean
  applyDisabledReason: string
}

export type BulkSecretCampaignApplyMode =
  | 'success'
  | 'partial-failure'
  | 'retryable-failure'
  | 'non-retryable-failure'
  | 'stale-plan'

export type BulkSecretCampaignApplyItemOutcome =
  | 'applied'
  | 'failed'
  | 'denied'
  | 'skipped'
  | 'unsupported'
  | 'auth-required'
  | 'stale-plan'

export type BulkSecretCampaignApplyItem = {
  id: string
  ref: string
  name: string
  operationItemId: string
  idempotencyKey: string
  outcome: BulkSecretCampaignApplyItemOutcome
  applied: boolean
  retrySafe: boolean
  auditStatus: string
  recovery: string
  nextAction: string
}

export type BulkSecretCampaignApplyResult = {
  campaignId: string
  operationId: string
  planToken: string
  operation: BulkSecretCampaignOperation
  mode: 'apply'
  outcome: 'applied' | 'partial_failure' | 'failed' | 'stale_plan'
  appliedCount: number
  failedCount: number
  deniedCount: number
  skippedCount: number
  unsupportedCount: number
  authRequiredCount: number
  staleCount: number
  auditStatus: string
  nextAction: string
  items: BulkSecretCampaignApplyItem[]
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
    backendCapability:
      'reveal, edit dry-run, reset dry-run, delete dry-run, policy preview',
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
    backendCapability:
      'metadata, reveal challenge, reset dry-run, delete dry-run',
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
  'Edit, reset, delete, and policy actions require dry-run/preview before apply and never use spreadsheet-style plaintext editing.',
  'The update/reset/delete/reveal API shown here is a deterministic stub preview until the Secrets Broker production mutation contract lands.',
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

export const singleSecretOperationOutcomes: Array<{
  id: SingleSecretOperationOutcome
  label: string
}> = [
  { id: 'submitted', label: 'Submitted for broker status' },
  { id: 'applied', label: 'Broker apply success' },
  { id: 'policy-denied', label: 'Policy denied after submit' },
  { id: 'auth-required', label: 'Auth required after submit' },
  { id: 'failed', label: 'Broker apply failed' },
  { id: 'stale-plan', label: 'Stale plan rejected' },
]

export const bulkSecretCampaignOperations: Array<{
  id: BulkSecretCampaignOperation
  label: string
}> = [
  { id: 'rotate-reset', label: 'Rotate/reset selected refs' },
  { id: 'update-edit', label: 'Update/edit selected refs' },
  { id: 'apply-policy', label: 'Apply/change policy' },
  { id: 'migrate-provider', label: 'Migrate/remap provider' },
  { id: 'mark-action-required', label: 'Mark action required' },
]

export const bulkSecretCampaignRevalidationStates: Array<{
  id: BulkSecretCampaignRevalidationState
  label: string
}> = [
  { id: 'ready', label: 'Successful revalidation' },
  { id: 'stale-plan', label: 'Stale plan' },
  { id: 'provider-changed', label: 'Provider config changed' },
  { id: 'policy-changed', label: 'Policy changed' },
  { id: 'capability-changed', label: 'Capability changed' },
  { id: 'auth-required', label: 'Provider auth required' },
  { id: 'denied', label: 'Policy denied' },
  { id: 'unsupported', label: 'Unsupported rows' },
  { id: 'audit-unavailable', label: 'Audit unavailable' },
]

export const bulkSecretCampaignApplyModes: Array<{
  id: BulkSecretCampaignApplyMode
  label: string
}> = [
  { id: 'success', label: 'Apply success' },
  { id: 'partial-failure', label: 'Partial failure' },
  { id: 'retryable-failure', label: 'Retryable failure' },
  { id: 'non-retryable-failure', label: 'Non-retryable failure' },
  { id: 'stale-plan', label: 'Stale plan rejected' },
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
    'secrets-management:single-secret-operation-history',
    'secrets-management:single-secret-decommission-preview',
    'secrets-management:single-secret-policy-preview',
    'secrets-management:stub-delete-preview',
    'secrets-management:bulk-campaign-dry-run',
    'secrets-management:bulk-campaign-apply',
    'secrets-management:bulk-campaign-status',
  ],
  persistedStorage: 'none',
}

const bulkCampaignRevalidationMessages: Record<
  BulkSecretCampaignRevalidationState,
  string
> = {
  ready:
    'fresh dry-run revalidated against selected refs, provider config, policy, auth, capability, and audit metadata',
  'stale-plan':
    'stale plan: rerun dry-run because the previous campaign plan expired',
  'provider-changed':
    'provider config changed since dry-run; rerun before apply',
  'policy-changed': 'policy changed since dry-run; rerun before apply',
  'capability-changed':
    'provider capability changed since dry-run; rerun before apply',
  'auth-required': 'provider auth required before revalidation can pass',
  denied: 'policy denied during revalidation; apply fails closed',
  unsupported: 'selected rows include unsupported campaign operations',
  'audit-unavailable': 'audit unavailable; campaign apply fails closed',
}

export function getBulkSecretCampaignConfirmationPhrase(
  plan: BulkSecretCampaignPlan
) {
  return plan.highRiskCount > 0
    ? 'CONFIRM HIGH RISK CAMPAIGN'
    : 'CONFIRM BULK CAMPAIGN'
}

function safeCampaignSlug(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'campaign'
}

function brokerOperationForCampaign(operation: BulkSecretCampaignOperation) {
  return operation.replace(/-/g, '_')
}

function buildCampaignId(operation: BulkSecretCampaignOperation) {
  return `campaign-${safeCampaignSlug(operation)}-2026-06-20-a`
}

function buildOperationItemId(campaignId: string, itemId: string) {
  return `${campaignId}:item:${safeCampaignSlug(itemId)}`
}

function buildIdempotencyKey(
  campaignId: string,
  operation: BulkSecretCampaignOperation,
  itemId: string
) {
  return `${campaignId}:${brokerOperationForCampaign(operation)}:${safeCampaignSlug(itemId)}`
}

function bulkCampaignOperationCanApply(operation: BulkSecretCampaignOperation) {
  return (
    operation === 'rotate-reset' ||
    operation === 'update-edit' ||
    operation === 'apply-policy' ||
    operation === 'migrate-provider'
  )
}

function bulkCampaignOperationIsHighRisk(
  operation: BulkSecretCampaignOperation
) {
  return operation !== 'mark-action-required'
}

function bulkPolicyTargetForRow(row: ManagedSecretRow) {
  return row.owningService === 'payments-api'
    ? 'policy/openclaw/service-lasso/payments-campaign-review'
    : 'policy/openclaw/service-lasso/bulk-campaign-apply'
}

function bulkMigrationTargetForRow(row: ManagedSecretRow) {
  if (row.source === 'local-default') return 'vault-prod'
  if (row.provider === 'provider connection') return 'local-default'
  return 'vault-prod'
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
      : action === 'delete'
        ? 'delete'
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

export function buildBulkSecretCampaignPlan(
  rows: ManagedSecretRow[],
  selectedIds: string[],
  operation: BulkSecretCampaignOperation
): BulkSecretCampaignPlan {
  const selected = rows.filter((row) => selectedIds.includes(row.id))
  const campaignId = buildCampaignId(operation)
  const items = selected.map((row): BulkSecretCampaignItem => {
    const blockers: string[] = []
    let capabilityResult = 'supported: metadata dry-run only'
    let policyResult = 'allow preview'
    let risk: BulkSecretCampaignItem['risk'] = 'medium'
    let expectedAction = 'Generate campaign dry-run metadata; do not apply.'
    let recovery = 'retry with the same idempotency key or restore from backup'
    let targetProvider = row.source
    let targetPolicy = row.policy

    if (operation === 'mark-action-required') {
      risk = 'low'
      expectedAction = 'Mark ref for follow-up only; no provider mutation.'
      recovery = 'clear the action marker after provider/operator follow-up'
    }

    if (bulkCampaignOperationIsHighRisk(operation)) {
      risk = 'high'
    }

    if (operation === 'apply-policy') {
      targetPolicy = bulkPolicyTargetForRow(row)
      capabilityResult = 'supported: policy dry-run and apply available'
      policyResult = 'allow: target policy can be applied after revalidation'
      expectedAction =
        'Apply the target policy through broker policy-change operation ID.'
      recovery =
        'reapply the previous policy through a fresh audited campaign if rollback is required'
    }

    if (operation === 'migrate-provider') {
      targetProvider = bulkMigrationTargetForRow(row)
      capabilityResult =
        'supported: provider migration/remap dry-run and apply available'
      policyResult =
        'allow: source and target provider namespaces are policy approved'
      expectedAction =
        'Move or remap the ref through broker migration operation ID.'
      recovery =
        'retry by operation ID; use source provider as rollback target where supported'
    }

    if (row.policy.includes('readonly')) {
      policyResult = 'denied: policy is readonly for this ref'
      blockers.push('policy denied')
    }

    if (row.state === 'missing') {
      capabilityResult = 'missing provider/source'
      blockers.push('provider/source missing')
      expectedAction = 'Skip until the provider/source is configured.'
    } else if (
      operation === 'rotate-reset' &&
      !row.backendCapability.includes('reset dry-run')
    ) {
      capabilityResult = 'unsupported: reset dry-run unavailable'
      blockers.push('unsupported capability')
      expectedAction = 'Skip this ref or choose an edit/policy preview.'
    } else if (
      operation === 'update-edit' &&
      !row.backendCapability.includes('edit dry-run')
    ) {
      capabilityResult = 'unsupported: edit dry-run unavailable'
      blockers.push('unsupported capability')
      expectedAction = 'Skip this ref or choose a reset/policy preview.'
    } else if (
      operation === 'apply-policy' &&
      !row.backendCapability.includes('policy preview')
    ) {
      capabilityResult = 'unsupported: policy apply capability unavailable'
      blockers.push('unsupported capability')
      expectedAction = 'Skip this ref until policy apply is broker-supported.'
    } else if (
      operation === 'migrate-provider' &&
      row.provider === 'file source'
    ) {
      capabilityResult = 'unsupported: file sources migrate outside broker'
      blockers.push('unsupported capability')
      expectedAction = 'Document external provider action only.'
    } else if (
      operation === 'migrate-provider' &&
      row.safeTags.includes('provider')
    ) {
      capabilityResult =
        'auth required: source provider challenge before migration apply'
      blockers.push('provider auth required')
      expectedAction = 'Reconnect provider auth, then create a fresh plan.'
    } else if (
      operation === 'rotate-reset' &&
      row.safeTags.includes('provider')
    ) {
      capabilityResult = 'auth required: provider challenge before dry-run'
      blockers.push('provider auth required')
      expectedAction = 'Request provider auth, then rerun dry-run.'
    }

    return {
      id: row.id,
      ref: row.ref,
      name: row.name,
      owningService: row.owningService,
      sourceProvider: `${row.provider} / ${row.source}`,
      targetProvider,
      targetPolicy,
      capabilityResult,
      policyResult,
      risk,
      auditRequirement:
        risk === 'high'
          ? 'campaign audit reason and fresh dry-run required before apply'
          : 'campaign audit summary required',
      expectedAction,
      blockers,
      idempotencyKey: buildIdempotencyKey(campaignId, operation, row.id),
      operationItemId: buildOperationItemId(campaignId, row.id),
      retrySafe: blockers.length === 0,
      recovery:
        blockers.length === 0
          ? recovery
          : 'fix blocker, create a fresh plan, then retry',
    }
  })
  const applicableCount = items.filter(
    (item) => item.blockers.length === 0
  ).length
  const applyAvailable =
    bulkCampaignOperationCanApply(operation) && applicableCount > 0

  return {
    campaignId,
    operationId: `bulk-${safeCampaignSlug(operation)}-2026-06-20-a`,
    planToken: `${campaignId}:${brokerOperationForCampaign(operation)}:sha256:metadata-only`,
    operation,
    selectedCount: items.length,
    applicableCount,
    deniedCount: items.filter((item) => item.policyResult.includes('denied'))
      .length,
    unsupportedCount: items.filter((item) =>
      item.capabilityResult.includes('unsupported')
    ).length,
    authRequiredCount: items.filter((item) =>
      item.capabilityResult.includes('auth required')
    ).length,
    missingProviderCount: items.filter((item) =>
      item.capabilityResult.includes('missing provider')
    ).length,
    highRiskCount: items.filter((item) => item.risk === 'high').length,
    items,
    applyAvailable,
  }
}

export function buildBulkSecretCampaignApplyGate(
  plan: BulkSecretCampaignPlan,
  auditReason: string,
  confirmation: string,
  revalidationState: BulkSecretCampaignRevalidationState,
  revalidated: boolean,
  brokerCampaignApiAvailable = plan.applyAvailable
): BulkSecretCampaignApplyGate {
  const auditReasonAccepted = auditReason.trim().length >= 12
  const confirmationPhrase = getBulkSecretCampaignConfirmationPhrase(plan)
  const confirmationRequired = plan.highRiskCount > 0
  const confirmationAccepted =
    !confirmationRequired || confirmation.trim() === confirmationPhrase
  const blockers: string[] = []

  if (plan.selectedCount === 0) {
    blockers.push('select at least one ref')
  }
  if (plan.applicableCount === 0) {
    blockers.push('no selected refs are applicable for this campaign')
  }
  if (!auditReasonAccepted) {
    blockers.push('audit reason must be at least 12 characters')
  }
  if (!confirmationAccepted) {
    blockers.push(`type ${confirmationPhrase}`)
  }
  if (!revalidated) {
    blockers.push('run immediate revalidation')
  } else if (revalidationState !== 'ready') {
    blockers.push(bulkCampaignRevalidationMessages[revalidationState])
  }
  if (!brokerCampaignApiAvailable) {
    blockers.push('broker campaign apply API not connected')
  }

  const revalidationPassed =
    revalidated && revalidationState === 'ready' && plan.applicableCount > 0
  const canApply =
    blockers.length === 0 &&
    auditReasonAccepted &&
    confirmationAccepted &&
    revalidationPassed &&
    brokerCampaignApiAvailable

  return {
    auditReasonAccepted,
    confirmationRequired,
    confirmationPhrase,
    confirmationAccepted,
    revalidationPassed,
    revalidationStatus: revalidated
      ? bulkCampaignRevalidationMessages[revalidationState]
      : 'not revalidated since this dry-run was generated',
    statusRows: [
      auditReasonAccepted ? 'audit reason recorded' : 'audit reason missing',
      confirmationAccepted
        ? 'confirmation accepted'
        : 'high-risk confirmation missing',
      revalidationPassed
        ? 'revalidation passed'
        : revalidated
          ? 'revalidation blocked'
          : 'revalidation not run',
      brokerCampaignApiAvailable
        ? 'broker campaign API available'
        : 'broker campaign API unavailable',
      plan.applicableCount < plan.selectedCount
        ? 'non-applicable rows stay typed as denied skipped unsupported or auth-required'
        : 'all selected rows are applicable',
    ],
    blockers,
    canApply,
    applyDisabledReason: canApply
      ? 'apply ready'
      : (blockers[0] ?? 'apply blocked'),
  }
}

function itemOutcomeFromBlockers(
  item: BulkSecretCampaignItem
): BulkSecretCampaignApplyItemOutcome | null {
  if (item.blockers.includes('provider auth required')) return 'auth-required'
  if (item.blockers.includes('policy denied')) return 'denied'
  if (item.blockers.includes('unsupported capability')) return 'unsupported'
  if (item.blockers.includes('provider/source missing')) return 'skipped'
  return null
}

function applyOutcomeForItem(
  item: BulkSecretCampaignItem,
  mode: BulkSecretCampaignApplyMode,
  applicableIndex: number
): BulkSecretCampaignApplyItemOutcome {
  const blockerOutcome = itemOutcomeFromBlockers(item)
  if (blockerOutcome) return blockerOutcome
  if (mode === 'stale-plan') return 'stale-plan'
  if (mode === 'retryable-failure' || mode === 'non-retryable-failure') {
    return 'failed'
  }
  if (mode === 'partial-failure' && applicableIndex > 0) return 'failed'
  return 'applied'
}

function nextActionForApplyOutcome(
  outcome: BulkSecretCampaignApplyItemOutcome
) {
  switch (outcome) {
    case 'applied':
      return 'monitor campaign status and dependent service restart notes'
    case 'failed':
      return 'review safe failure metadata and retry only by operation id'
    case 'denied':
      return 'request policy change or remove this ref from the campaign'
    case 'unsupported':
      return 'choose a supported operation family or provider-specific workflow'
    case 'auth-required':
      return 'complete provider auth then create a fresh plan'
    case 'stale-plan':
      return 'create a fresh dry-run plan before applying'
    case 'skipped':
    default:
      return 'fix provider/source state before retrying'
  }
}

function recoveryForApplyOutcome(
  item: BulkSecretCampaignItem,
  outcome: BulkSecretCampaignApplyItemOutcome,
  mode: BulkSecretCampaignApplyMode
) {
  if (outcome === 'failed' && mode === 'non-retryable-failure') {
    return 'manual recovery required; do not replay without a fresh broker plan'
  }
  if (outcome === 'failed') {
    return 'retry with the same idempotency key after fixing the safe error'
  }
  if (outcome === 'applied') return item.recovery
  return 'create a fresh plan after resolving the typed blocker'
}

export function buildBulkSecretCampaignApplyResult(
  plan: BulkSecretCampaignPlan,
  mode: BulkSecretCampaignApplyMode
): BulkSecretCampaignApplyResult {
  let applicableIndex = -1
  const items = plan.items.map((item): BulkSecretCampaignApplyItem => {
    if (item.blockers.length === 0) applicableIndex += 1
    const outcome = applyOutcomeForItem(item, mode, applicableIndex)
    const applied = outcome === 'applied'

    return {
      id: item.id,
      ref: item.ref,
      name: item.name,
      operationItemId: item.operationItemId,
      idempotencyKey: item.idempotencyKey,
      outcome,
      applied,
      retrySafe:
        item.retrySafe &&
        (outcome === 'applied' ||
          (outcome === 'failed' && mode !== 'non-retryable-failure')),
      auditStatus:
        outcome === 'applied'
          ? 'campaign and item audit recorded'
          : 'campaign audit recorded; item mutation not applied',
      recovery: recoveryForApplyOutcome(item, outcome, mode),
      nextAction: nextActionForApplyOutcome(outcome),
    }
  })

  const appliedCount = items.filter((item) => item.outcome === 'applied').length
  const failedCount = items.filter((item) => item.outcome === 'failed').length
  const staleCount = items.filter(
    (item) => item.outcome === 'stale-plan'
  ).length
  const deniedCount = items.filter((item) => item.outcome === 'denied').length
  const unsupportedCount = items.filter(
    (item) => item.outcome === 'unsupported'
  ).length
  const authRequiredCount = items.filter(
    (item) => item.outcome === 'auth-required'
  ).length
  const skippedCount = items.filter((item) => item.outcome === 'skipped').length
  const nonAppliedCount =
    failedCount +
    staleCount +
    deniedCount +
    unsupportedCount +
    authRequiredCount +
    skippedCount
  const outcome =
    staleCount > 0
      ? 'stale_plan'
      : appliedCount > 0 && nonAppliedCount === 0
        ? 'applied'
        : appliedCount > 0
          ? 'partial_failure'
          : 'failed'

  return {
    campaignId: plan.campaignId,
    operationId: plan.operationId,
    planToken: plan.planToken,
    operation: plan.operation,
    mode: 'apply',
    outcome,
    appliedCount,
    failedCount,
    deniedCount,
    skippedCount,
    unsupportedCount,
    authRequiredCount,
    staleCount,
    auditStatus: 'campaign-level audit summary recorded',
    nextAction:
      outcome === 'applied'
        ? 'monitor campaign status'
        : outcome === 'stale_plan'
          ? 'create a fresh plan'
          : 'review per-item outcomes and retry only by operation id',
    items,
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
    case 'delete':
      return {
        action,
        title: `Delete dry-run for ${row.name}`,
        status:
          row.state === 'missing'
            ? 'blocked: ref already missing'
            : 'delete preview required before apply',
        preview:
          'Preview checks delete capability, policy, affected service references, audit readiness, and recovery guidance without reading or exporting the current value.',
        nextStep:
          row.state === 'missing'
            ? 'No delete can be applied until the provider/source reports an existing ref.'
            : 'Run delete preview first; apply remains disabled until preview, audit reason, and explicit confirmation are accepted.',
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

function capabilityRequirementForAction(action: ManagedSecretAction) {
  switch (action) {
    case 'edit':
      return 'edit dry-run'
    case 'reset':
      return 'reset dry-run'
    case 'delete':
      return 'delete dry-run'
    case 'policy':
      return 'policy preview'
    case 'reveal':
      return 'reveal'
    case 'metadata':
    default:
      return 'metadata'
  }
}

function managedSecretActionLabel(action: ManagedSecretAction) {
  switch (action) {
    case 'reveal':
      return 'Reveal'
    case 'edit':
      return 'Edit'
    case 'reset':
      return 'Rotate'
    case 'delete':
      return 'Delete'
    case 'policy':
      return 'Policy'
    case 'metadata':
    default:
      return 'Metadata'
  }
}

export function buildManagedSecretActionReadiness(
  row: ManagedSecretRow
): ManagedSecretActionReadiness[] {
  const actions: Array<Exclude<ManagedSecretAction, 'metadata'>> = [
    'reveal',
    'edit',
    'reset',
    'delete',
    'policy',
  ]

  return actions.map((action) => {
    const requirement = capabilityRequirementForAction(action)
    const blockers: string[] = []

    if (row.state === 'missing') {
      blockers.push('ref unavailable')
    }
    if (!row.backendCapability.includes(requirement)) {
      blockers.push(`${requirement} unsupported`)
    }
    if (
      action !== 'reveal' &&
      row.policy.includes('readonly') &&
      !blockers.includes('readonly policy review required')
    ) {
      blockers.push('readonly policy review required')
    }
    if (
      row.auditStatus.includes('required before reveal') &&
      action === 'reveal'
    ) {
      blockers.push('fresh audit reason required')
    }

    const canPreview = blockers.length === 0

    return {
      action,
      label: managedSecretActionLabel(action),
      status: canPreview ? 'ready' : 'blocked',
      badge: canPreview ? 'preview ready' : 'blocked fail closed',
      blockers,
      safeChecks: [
        `${requirement} capability evaluated from broker metadata`,
        'policy and audit posture shown before dry-run',
        'raw value remains hidden from table, route, storage, and diagnostics',
      ],
      nextStep: canPreview
        ? `Open ${managedSecretActionLabel(action).toLowerCase()} dry-run preview with audit reason and confirmation.`
        : `Resolve ${blockers[0]} before this action can preview.`,
      canPreview,
    }
  })
}

function endpointForSingleSecretAction(action: ManagedSecretAction) {
  switch (action) {
    case 'reveal':
      return 'POST /v1/management/secrets/{ref}/reveal:preview'
    case 'edit':
      return 'POST /v1/management/secrets/{ref}/update:dry-run'
    case 'reset':
      return 'POST /v1/management/secrets/{ref}/rotate:dry-run'
    case 'delete':
      return 'POST /v1/management/secrets/{ref}/delete:dry-run'
    case 'policy':
      return 'POST /v1/management/secrets/{ref}/policy:preview'
    case 'metadata':
    default:
      return 'GET /v1/management/secrets/{ref}/metadata'
  }
}

function safeOperationSlug(action: ManagedSecretAction, row: ManagedSecretRow) {
  return `${action}-${row.id}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function auditEventIdForSingleSecretAction(
  action: ManagedSecretAction,
  row: ManagedSecretRow,
  suffix = 'preview'
) {
  return `audit-${safeOperationSlug(action, row)}-${suffix}`
}

function safePayloadFieldsForSingleSecretAction(action: ManagedSecretAction) {
  const baseFields = [
    'ref',
    'operationId',
    'action',
    'owningService',
    'provider',
    'policy',
    'auditReasonMetadata',
  ]

  switch (action) {
    case 'reveal':
      return [...baseFields, 'revealChallengeId']
    case 'edit':
      return [...baseFields, 'metadataDiff']
    case 'reset':
      return [...baseFields, 'rotationReason']
    case 'delete':
      return [...baseFields, 'recoveryPlanRef', 'dependentServiceRefs']
    case 'policy':
      return [...baseFields, 'targetPolicyRef', 'policyDiffMetadata']
    case 'metadata':
    default:
      return ['ref', 'operationId', 'action', 'owningService', 'provider']
  }
}

function revalidationChecksForSingleSecretAction(
  action: ManagedSecretAction,
  requirement: string
) {
  if (action === 'metadata') {
    return ['metadata view does not revalidate a mutation']
  }

  const checks = [
    `${requirement} broker capability rechecked immediately before submit`,
    'policy decision rechecked immediately before submit',
    'audit writer availability required before submit',
  ]

  if (action === 'delete') {
    checks.push('dependent service references and recovery guidance checked')
  }
  if (action === 'policy') {
    checks.push('target policy assignment diff checked as metadata only')
  }
  if (action === 'reset') {
    checks.push('rotation can submit without controlled reveal')
  }

  return checks
}

export function buildSingleSecretOperationPlan(
  row: ManagedSecretRow,
  action: ManagedSecretAction,
  auditReason: string,
  confirmed: boolean,
  state: StubSecretMutationState
): SingleSecretOperationPlan {
  const requirement = capabilityRequirementForAction(action)
  const blockers: string[] = []
  const hasAuditReason = auditReason.trim().length >= 8
  const metadataOnly = action === 'metadata'
  const capabilitySupported =
    metadataOnly || row.backendCapability.includes(requirement)

  if (!metadataOnly && row.state === 'missing') {
    blockers.push('ref unavailable')
  }
  if (!capabilitySupported) {
    blockers.push(`${requirement} unsupported`)
  }
  if (!metadataOnly && !hasAuditReason) {
    blockers.push('audit reason required')
  }
  if (!metadataOnly && !confirmed) {
    blockers.push('explicit confirmation required')
  }
  if (state === 'denied') {
    blockers.push('policy denied')
  }
  if (state === 'auth-required') {
    blockers.push('operator auth required')
  }
  if (state === 'unavailable') {
    blockers.push('broker unavailable')
  }
  if (state === 'cancelled') {
    blockers.push('operator cancelled')
  }
  if (state === 'failure') {
    blockers.push('previous apply failed')
  }

  const canSubmit = !metadataOnly && blockers.length === 0 && state === 'ready'

  return {
    action,
    operationId: `single-${safeOperationSlug(action, row)}-2026-06-20-a`,
    endpoint: endpointForSingleSecretAction(action),
    dryRunStatus: metadataOnly
      ? 'metadata read only; no mutation dry-run needed'
      : capabilitySupported
        ? `${requirement} capability checked; preview required before submit`
        : `${requirement} capability unavailable; fail closed`,
    capabilityDecision: capabilitySupported
      ? `supported: ${requirement}`
      : `unsupported: ${requirement}`,
    policyDecision:
      row.policy.includes('readonly') && action !== 'metadata'
        ? 'review required: readonly policy blocks mutation unless broker policy changes'
        : 'allow preview: final allow/deny belongs to Secrets Broker',
    auditRequirement: hasAuditReason
      ? 'audit reason captured as metadata only'
      : metadataOnly
        ? 'audit reason not required for metadata view'
        : 'audit reason required before submit',
    applyGate: canSubmit
      ? 'operation submit ready after dry-run revalidation'
      : metadataOnly
        ? 'metadata view only'
        : (blockers[0] ?? 'operation blocked'),
    blockers,
    safePayloadFields: safePayloadFieldsForSingleSecretAction(action),
    revalidationChecks: revalidationChecksForSingleSecretAction(
      action,
      requirement
    ),
    canSubmit,
  }
}

export function buildSingleSecretDecommissionPreview(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan
): SingleSecretDecommissionPreview {
  const blockers = [...plan.blockers]

  if (plan.action !== 'delete') {
    blockers.push('select delete action')
  }

  const providerBacked = row.provider === 'provider connection'
  const dependentServiceRefs =
    row.owningService === '@serviceadmin'
      ? ['@serviceadmin runtime session loader', '@secretsbroker audit sink']
      : [
          `${row.owningService} runtime binding`,
          `${row.workspace} workspace policy reference`,
        ]
  const mode = providerBacked ? 'disable' : 'decommission'
  const eligible = blockers.length === 0
  const actionLabel = mode === 'disable' ? 'disable' : 'decommission'

  return {
    ref: row.ref,
    operationId: plan.operationId,
    mode,
    eligible,
    badge: eligible
      ? `${actionLabel} preview ready`
      : `${actionLabel} preview blocked`,
    dependentServiceRefs,
    recoveryPlanRef: `recovery-${safeOperationSlug('delete', row)}-metadata`,
    tombstoneRef: `tombstone-${safeOperationSlug('delete', row)}-metadata`,
    retentionStatus: eligible
      ? 'redacted tombstone and recovery metadata retained for audit review'
      : 'no tombstone or recovery metadata will be written while blocked',
    auditTrail: eligible
      ? 'audit reason, operation id, dependency refs, and policy metadata are ready for broker submit'
      : 'audit trail records blocker metadata only; no source access or deletion attempted',
    applyGate: eligible
      ? 'ready for broker-owned delete/decommission submit after final revalidation'
      : blockers[0],
    blockers,
    safeMetadataRows: [
      'current secret value is not read before delete/decommission preview',
      'dependent service refs are names only and contain no environment values',
      'recovery plan reference is metadata-only and does not embed secret material',
      'tombstone reference is redacted and cannot restore a value by itself',
    ],
  }
}

function singlePolicyTargetForRow(row: ManagedSecretRow) {
  if (row.owningService === 'payments-api') {
    return 'policy/openclaw/service-lasso/payments-single-ref-review'
  }

  const ownerSlug = row.owningService
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `policy/openclaw/service-lasso/${ownerSlug || 'service'}/least-privilege-single-ref`
}

function policyConsumerRefsForRow(row: ManagedSecretRow) {
  if (row.owningService === '@serviceadmin') {
    return ['@serviceadmin operator API', '@serviceadmin secret action UI']
  }

  return [
    `${row.owningService} runtime resolve policy`,
    `${row.workspace} workspace authorization map`,
  ]
}

export function buildSingleSecretPolicyPreview(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan
): SingleSecretPolicyPreview {
  const blockers = [...plan.blockers]

  if (plan.action !== 'policy') {
    blockers.push('select policy action')
  }

  const eligible = blockers.length === 0
  const targetPolicyRef = singlePolicyTargetForRow(row)
  const affectedConsumerRefs = policyConsumerRefsForRow(row)

  return {
    ref: row.ref,
    operationId: plan.operationId,
    eligible,
    badge: eligible ? 'policy preview ready' : 'policy preview blocked',
    currentPolicyRef: row.policy,
    targetPolicyRef,
    policyDiffMetadata: [
      `previousPolicyRef: ${row.policy}`,
      `targetPolicyRef: ${targetPolicyRef}`,
      `scope: ${row.owningService} / ${row.workspace}`,
      'decision fields: allow, deny, audit-required, auth-required',
    ],
    affectedConsumerRefs,
    rollbackPlanRef: `rollback-${safeOperationSlug('policy', row)}-metadata`,
    auditTrail: eligible
      ? 'audit reason, operation id, previous policy, target policy, and consumer refs are ready for broker submit'
      : 'audit trail records blocker metadata only; no policy assignment will be written while blocked',
    applyGate: eligible
      ? 'ready for broker-owned policy assignment submit after final revalidation'
      : blockers[0],
    blockers,
    enforcementChecks: [
      'target policy assignment diff checked as metadata only',
      'per-service resolve policy is revalidated before submit',
      'audit writer availability is required before apply',
      'readonly or missing refs fail closed before policy assignment',
    ],
    safeMetadataRows: [
      'policy preview never reads or writes the current secret value',
      'affected consumers are service or workspace refs, not environment values',
      'rollback plan reference contains previous policy metadata only',
      'policy diff excludes raw payloads, tokens, cookies, keys, and provider credentials',
    ],
  }
}

export function buildSingleSecretOperationResult(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  outcome: SingleSecretOperationOutcome = 'submitted'
): SingleSecretOperationResult {
  const actionLabel =
    plan.action === 'reset'
      ? 'rotate/reset'
      : plan.action === 'edit'
        ? 'edit/update'
        : plan.action === 'delete'
          ? 'delete/decommission'
          : plan.action === 'policy'
            ? 'policy change'
            : plan.action
  const recoverySteps =
    plan.action === 'delete'
      ? [
          'verify dependent service references before broker decommission',
          'retain recovery plan reference until audit review completes',
          'restore only through a fresh broker plan if apply fails',
        ]
      : plan.action === 'policy'
        ? [
            'compare target policy metadata before broker submit',
            'record previous policy reference as audit metadata',
            'reapply previous policy only through a fresh audited preview',
          ]
        : plan.action === 'reset'
          ? [
              'track rotation operation id until provider status settles',
              'restart dependent service only after broker success metadata',
              'retry by operation id when the provider marks the retry safe',
            ]
          : plan.action === 'edit'
            ? [
                'review metadata diff before broker submit',
                'retry by operation id only when broker marks the update safe',
                'create a fresh preview after policy or provider state changes',
              ]
            : [
                'complete controlled reveal challenge outside the table',
                'let the short-lived reveal expire after the audit window',
                'request a fresh reveal instead of reusing stale metadata',
              ]
  const applied = outcome === 'applied'
  const resultBadge =
    outcome === 'applied'
      ? 'broker applied'
      : outcome === 'policy-denied'
        ? 'policy denied'
        : outcome === 'auth-required'
          ? 'auth required'
          : outcome === 'failed'
            ? 'apply failed'
            : outcome === 'stale-plan'
              ? 'stale plan'
              : 'submitted to broker'
  const auditStatus =
    outcome === 'submitted'
      ? 'stub audit event recorded with metadata only'
      : outcome === 'applied'
        ? 'stub audit event and broker success metadata recorded'
        : 'stub audit event recorded with typed failure metadata only'
  const resultStatus =
    outcome === 'submitted'
      ? `${actionLabel} dry-run accepted for broker submission; production mutation remains external to this stub`
      : outcome === 'applied'
        ? `${actionLabel} accepted by broker status callback; Service Admin records metadata only`
        : outcome === 'policy-denied'
          ? `${actionLabel} denied by broker policy after final revalidation; no value was read or written`
          : outcome === 'auth-required'
            ? `${actionLabel} paused because broker requires fresh operator authentication`
            : outcome === 'stale-plan'
              ? `${actionLabel} rejected because the dry-run plan is stale`
              : `${actionLabel} failed with broker-owned safe error metadata`
  const nextAction =
    outcome === 'applied'
      ? plan.action === 'reset'
        ? 'monitor dependent service restart notes and rotation freshness'
        : 'monitor broker operation audit and dependent service status'
      : outcome === 'policy-denied'
        ? 'update policy assignment or request least-privilege approval'
        : outcome === 'auth-required'
          ? 'complete broker auth challenge and create a fresh preview'
          : outcome === 'stale-plan'
            ? 'create a fresh dry-run plan before retry'
            : outcome === 'failed'
              ? 'review safe broker failure metadata and retry only when marked safe'
              : plan.action === 'reset'
                ? 'monitor broker rotation outcome and dependent service restart notes'
                : 'monitor broker operation status and typed policy/audit result'
  const recoveryStatus =
    outcome === 'applied'
      ? 'operation settled with broker success metadata'
      : outcome === 'policy-denied'
        ? 'policy denial is fail-closed and requires a new authorized plan'
        : outcome === 'auth-required'
          ? 'authentication challenge must complete outside the table'
          : outcome === 'stale-plan'
            ? 'stale plan recovery requires a fresh audited preview'
            : outcome === 'failed'
              ? 'broker failure recovery depends on retry-safe operation metadata'
              : plan.action === 'delete'
                ? 'delete/decommission requires recovery-guided broker ownership'
                : plan.action === 'policy'
                  ? 'policy rollback requires a fresh audited preview'
                  : plan.action === 'reset'
                    ? 'rotation retry is operation-id scoped and provider-owned'
                    : plan.action === 'edit'
                      ? 'edit retry waits for broker retry-safe metadata'
                      : 'reveal recovery is fresh-challenge only'
  const retryPolicy =
    outcome === 'applied'
      ? 'no retry needed after broker success'
      : outcome === 'policy-denied' ||
          outcome === 'auth-required' ||
          outcome === 'stale-plan'
        ? 'fresh plan required before any retry'
        : outcome === 'failed'
          ? 'retry only with the same operation id when broker marks retry safe'
          : plan.action === 'delete' || plan.action === 'policy'
            ? 'fresh plan required before any retry'
            : 'retry only by operation id when broker marks the attempt retry-safe'
  const auditFeedback = buildSingleSecretAuditFeedback(
    row,
    plan,
    outcome,
    auditEventIdForSingleSecretAction(plan.action, row)
  )

  return {
    operationId: plan.operationId,
    ref: row.ref,
    action: plan.action,
    outcome,
    applied,
    resultBadge,
    auditStatus,
    resultStatus,
    recoveryStatus,
    retryPolicy,
    recoverySteps,
    auditFeedback,
    safetyRows: [
      'raw value was not revealed',
      'request body is limited to ref, operation id, action, owner, provider, policy, and audit reason metadata',
      plan.action === 'reset'
        ? 'rotation can be requested without controlled reveal'
        : plan.action === 'delete'
          ? 'delete/decommission remains broker-owned and recovery-guided; current value was not read'
          : plan.action === 'policy'
            ? 'policy change carries target policy metadata only'
            : 'operator action used the selected dry-run gate',
      'no copy, export, route, query string, local storage, or diagnostic payload contains secret material',
    ],
    nextAction,
  }
}

export function buildSingleSecretAuditFeedback(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  outcome: SingleSecretOperationOutcome,
  auditEventId: string
): SingleSecretAuditFeedback {
  const eventState =
    outcome === 'applied'
      ? 'settled with broker success metadata'
      : outcome === 'submitted'
        ? 'recorded and waiting for broker terminal status'
        : outcome === 'policy-denied'
          ? 'recorded as policy denial with no source access'
          : outcome === 'auth-required'
            ? 'recorded as auth challenge with no source access'
            : outcome === 'stale-plan'
              ? 'recorded as stale-plan rejection'
              : 'recorded as safe broker failure metadata'
  const dependentServiceStatus =
    plan.action === 'reset'
      ? outcome === 'applied'
        ? 'dependent service restart metadata ready for operator review'
        : 'dependent service restart remains pending broker success metadata'
      : plan.action === 'delete'
        ? 'dependent service refs retained for decommission review'
        : plan.action === 'policy'
          ? 'policy consumers require fresh authorization metadata review'
          : 'no dependent service restart requested by this action'

  return {
    auditEventId,
    correlationId: `corr-${safeOperationSlug(plan.action, row)}-${outcome}`,
    eventState,
    redactionStatus:
      'allowlisted fields only: ref, action, operation id, policy, owner, provider, outcome, and timestamps',
    dependentServiceStatus,
    sinkStatus: row.auditStatus.includes('available')
      ? 'audit sink available in stub metadata model'
      : 'audit sink requires broker confirmation before apply',
    evidenceRows: [
      'audit payload excludes raw values and credential material',
      'operator reason is stored as metadata, not as a secret field',
      'route, query string, local storage, and diagnostics receive no secret material',
    ],
  }
}

export function buildSingleSecretOperationHistoryEntry(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  sequence: number,
  outcome: SingleSecretOperationOutcome = 'submitted'
): SingleSecretOperationHistoryEntry {
  const result = buildSingleSecretOperationResult(row, plan, outcome)
  const safeSequence = Math.max(1, sequence)

  return {
    ...result,
    auditFeedback: {
      ...result.auditFeedback,
      auditEventId: auditEventIdForSingleSecretAction(
        plan.action,
        row,
        String(safeSequence)
      ),
    },
    rowName: row.name,
    provider: row.provider,
    policy: row.policy,
    auditEventId: auditEventIdForSingleSecretAction(
      plan.action,
      row,
      String(safeSequence)
    ),
    statusBadge: result.resultBadge,
    submittedAt: `stub-sequence-${safeSequence}`,
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

export function managedSecretBulkPlanHasSecretMaterial(
  plan: BulkSecretCampaignPlan
) {
  return forbiddenSecretPattern.test(JSON.stringify(plan))
}

export function managedSecretBulkApplyResultHasSecretMaterial(
  result: BulkSecretCampaignApplyResult
) {
  return forbiddenSecretPattern.test(JSON.stringify(result))
}

export function managedSecretSingleHistoryHasSecretMaterial(
  entries: SingleSecretOperationHistoryEntry[]
) {
  return forbiddenSecretPattern.test(JSON.stringify(entries))
}

export function managedSecretDecommissionPreviewHasSecretMaterial(
  preview: SingleSecretDecommissionPreview
) {
  return forbiddenSecretPattern.test(JSON.stringify(preview))
}

export function managedSecretPolicyPreviewHasSecretMaterial(
  preview: SingleSecretPolicyPreview
) {
  return forbiddenSecretPattern.test(JSON.stringify(preview))
}

export function managedSecretActionReadinessHasSecretMaterial(
  readiness: ManagedSecretActionReadiness[]
) {
  return forbiddenSecretPattern.test(JSON.stringify(readiness))
}
