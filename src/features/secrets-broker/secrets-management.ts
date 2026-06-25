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

export type SingleSecretSubmitEnvelope = {
  operationId: string
  endpoint: string
  idempotencyKey: string
  correlationId: string
  payloadFields: string[]
  omittedFields: string[]
  transportGuardrails: string[]
  storageGuardrails: string[]
  diagnosticsGuardrails: string[]
  readyForSubmit: boolean
  blockedReason: string
}

export type SingleSecretConfirmationReceipt = {
  receiptId: string
  operationId: string
  ref: string
  action: ManagedSecretAction
  accepted: boolean
  auditReasonStatus: string
  confirmationStatus: string
  dryRunBinding: string
  policyBinding: string
  capabilityBinding: string
  blockedReason: string
  allowedReceiptFields: string[]
  omittedReceiptFields: string[]
  safeReceiptRows: string[]
}

export type SingleSecretReplayGuard = {
  operationId: string
  replayScope: string
  planFingerprint: string
  selectedRefBinding: string
  actionBinding: string
  idempotencyKey: string
  correlationId: string
  stalePlanGuard: string
  replayDecision: string
  readyForReplaySafeSubmit: boolean
  omittedReplayFields: string[]
  refBindingRows: string[]
  safeReplayRows: string[]
}

export type SingleSecretLeakEvidence = {
  route: string
  selectedRef: string
  action: ManagedSecretAction
  routeState: string
  allowedRouteParams: string[]
  browserStorageWrites: string
  browserStorageKeys: string[]
  diagnosticsRef: string
  supportBundleRef: string
  screenshotPolicy: string
  consoleEvent: string
  omittedFields: string[]
  safeEvidenceRows: string[]
  safeForScreenshots: boolean
}

export type SingleSecretExportGuardrail = {
  exportGuardId: string
  operationId: string
  ref: string
  action: ManagedSecretAction
  metadataExportStatus: string
  rawExportStatus: string
  copyStatus: string
  allowedExportFields: string[]
  blockedExportFields: string[]
  exportRoutes: string[]
  storageGuardrails: string[]
  safeExportRows: string[]
}

export type SingleSecretEditPreview = {
  ref: string
  operationId: string
  eligible: boolean
  badge: string
  patchPlanHash: string
  validationStatus: string
  conflictCheckRef: string
  rollbackPlanRef: string
  targetMetadataFields: string[]
  immutableFields: string[]
  affectedConsumerRefs: string[]
  auditTrail: string
  applyGate: string
  blockers: string[]
  omittedUnsafeFields: string[]
  safeDiffRows: string[]
}

export type SingleSecretRotationPreview = {
  ref: string
  operationId: string
  eligible: boolean
  badge: string
  rotationPlanRef: string
  idempotencyRef: string
  retryWindowRef: string
  providerCapabilityCheck: string
  dependentServiceRefs: string[]
  restartPlanRefs: string[]
  auditEventId: string
  applyGate: string
  blockers: string[]
  omittedUnsafeFields: string[]
  safeMetadataRows: string[]
}

export type SingleSecretOperationOutcome =
  | 'submitted'
  | 'applied'
  | 'policy-denied'
  | 'auth-required'
  | 'audit-unavailable'
  | 'provider-unavailable'
  | 'failed'
  | 'stale-plan'
  | 'cancelled'

export type SingleSecretAuditFeedback = {
  auditEventId: string
  correlationId: string
  eventState: string
  redactionStatus: string
  dependentServiceStatus: string
  sinkStatus: string
  evidenceRows: string[]
}

export type SingleSecretImpactEvidence = {
  title: string
  impactRef: string
  dependentServiceRefs: string[]
  auditRefs: string[]
  rollbackRef: string
  freshPreviewRequirement: string
  omittedUnsafeFields: string[]
  safeEvidenceRows: string[]
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
  providerAuthChallengeRef: string | null
  providerRecoveryRef: string | null
  brokerFailureRef: string | null
  brokerFailureCategory: string | null
  recoverySteps: string[]
  auditFeedback: SingleSecretAuditFeedback
  impactEvidence: SingleSecretImpactEvidence
  safetyRows: string[]
  nextAction: string
}

export type SingleSecretStatusMonitor = {
  operationId: string
  statusEndpoint: string
  pollCadence: string
  terminalState: string
  stateBadge: string
  retryAllowed: boolean
  retryToken: string
  stalePlanGuard: string
  allowedStatusFields: string[]
  omittedStatusFields: string[]
  statusRows: string[]
  operatorNextAction: string
  safeEvidenceRows: string[]
}

export type SingleSecretEvidenceBundle = {
  bundleId: string
  operationId: string
  ref: string
  reportRef: string
  screenshotRedaction: string
  diagnosticsRef: string
  storageEvidence: string
  supportBundleStatus: string
  allowedFields: string[]
  omittedArtifacts: string[]
  safeEvidenceRows: string[]
}

export type SingleSecretRecoveryDecision = {
  decisionId: string
  operationId: string
  ref: string
  outcome: SingleSecretOperationOutcome
  badge: string
  retryAllowed: boolean
  freshPreviewRequired: boolean
  operatorAction: string
  brokerAction: string
  blocker: string
  recoveryRef: string
  rollbackRef: string
  retryRef: string
  statusEndpoint: string
  allowedRecoveryFields: string[]
  omittedRecoveryFields: string[]
  safeRecoveryRows: string[]
}

export type SingleSecretOperatorHandoff = {
  handoffId: string
  operationId: string
  ref: string
  outcome: SingleSecretOperationOutcome
  lane:
    | 'monitor'
    | 'settled'
    | 'policy-review'
    | 'provider-auth'
    | 'audit-recovery'
    | 'provider-recovery'
    | 'broker-review'
    | 'fresh-preview'
  badge: string
  owner: string
  severity: 'info' | 'warning' | 'critical'
  requiredAction: string
  shareableEvidenceRefs: string[]
  blockedReason: string | null
  validatorNote: string
  allowedHandoffFields: string[]
  omittedHandoffFields: string[]
  safeHandoffRows: string[]
}

export type SingleSecretOwnerActionTicket = {
  ticketId: string
  operationId: string
  ref: string
  lane: SingleSecretOperatorHandoff['lane']
  owner: string
  severity: SingleSecretOperatorHandoff['severity']
  acknowledgementStatus: string
  requiredAction: string
  freshPreviewRequired: boolean
  evidenceRefs: string[]
  safeEscalationRoute: string
  allowedTicketFields: string[]
  omittedTicketFields: string[]
  safeTicketRows: string[]
}

export type SingleSecretClosureReview = {
  closureId: string
  operationId: string
  ref: string
  outcome: SingleSecretOperationOutcome
  reviewState: 'ready-to-close' | 'monitoring' | 'owner-action-required'
  badge: string
  canCloseOperatorReview: boolean
  requiredBeforeClose: string[]
  retainedEvidenceRefs: string[]
  auditRefs: string[]
  supportRefs: string[]
  allowedClosureFields: string[]
  omittedClosureFields: string[]
  safeClosureRows: string[]
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

export type SingleSecretRevealPreview = {
  ref: string
  operationId: string
  eligible: boolean
  badge: string
  revealChallengeId: string
  challengeExpiresAt: string
  revealWindow: string
  auditEventId: string
  auditSinkStatus: string
  policyDecision: string
  authRequirement: string
  dependentConsumerRefs: string[]
  displayGuardrails: string[]
  applyGate: string
  blockers: string[]
  safeMetadataRows: string[]
}

export type SingleSecretRevealLifecycleState =
  | 'pending'
  | 'authorized'
  | 'expired'
  | 'revoked'
  | 'denied'
  | 'audit-unavailable'

export type SingleSecretRevealLifecycle = {
  ref: string
  operationId: string
  state: SingleSecretRevealLifecycleState
  badge: string
  revealChallengeId: string
  revealSessionRef: string
  displayStatus: string
  valueStatus: string
  actorRef: string
  auditEventId: string
  correlationId: string
  expiresAt: string
  revocationRef: string
  policyDecisionRef: string
  nextAction: string
  blockedReason: string | null
  omittedUnsafeFields: string[]
  safeEvidenceRows: string[]
}

export type SingleSecretOperationHistoryEntry = SingleSecretOperationResult & {
  rowName: string
  provider: string
  policy: string
  auditEventId: string
  statusBadge: string
  submittedAt: string
}

export type SingleSecretOperationHistoryFilter = {
  action: ManagedSecretAction | 'all'
  outcome: SingleSecretOperationOutcome | 'all'
  query: string
}

export type SingleSecretOperationHistoryReview = {
  totalCount: number
  filteredCount: number
  appliedCount: number
  blockedCount: number
  pendingCount: number
  safeSearchStatus: string
  allowedFields: string[]
  omittedFields: string[]
  safeEvidenceRows: string[]
  entries: SingleSecretOperationHistoryEntry[]
}

export type SingleSecretOperationAuditTrailStep = {
  id: string
  label: string
  status: string
  actorRef: string
  evidence: string
  redaction: string
  occurredAt: string
  terminal: boolean
}

export type SingleSecretAuditReceipt = {
  receiptId: string
  operationId: string
  ref: string
  action: ManagedSecretAction
  outcome: SingleSecretOperationOutcome
  auditEventId: string
  correlationId: string
  receiptChecksum: string
  retentionStatus: string
  terminalStepStatus: string
  safeReceiptFields: string[]
  omittedReceiptArtifacts: string[]
  safeReceiptRows: string[]
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
  | 'policy-denied'
  | 'auth-required'
  | 'audit-unavailable'
  | 'provider-unavailable'
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
  | 'audit-unavailable'
  | 'provider-unavailable'
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
  outcome:
    | 'applied'
    | 'partial_failure'
    | 'failed'
    | 'policy_denied'
    | 'auth_required'
    | 'audit_unavailable'
    | 'provider_unavailable'
    | 'stale_plan'
  appliedCount: number
  failedCount: number
  deniedCount: number
  skippedCount: number
  unsupportedCount: number
  authRequiredCount: number
  auditUnavailableCount: number
  providerUnavailableCount: number
  staleCount: number
  auditStatus: string
  nextAction: string
  items: BulkSecretCampaignApplyItem[]
}

export type BulkSecretCampaignClosureReview = {
  closureId: string
  campaignId: string
  operationId: string
  outcome: BulkSecretCampaignApplyResult['outcome']
  reviewState: 'closable' | 'monitoring' | 'blocked'
  canCloseCampaignReview: boolean
  requiredBeforeClose: string[]
  retainedEvidenceRefs: string[]
  auditRefs: string[]
  supportRefs: string[]
  itemOutcomeSummary: string[]
  allowedClosureFields: string[]
  omittedClosureFields: string[]
  safeClosureRows: string[]
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
  { id: 'audit-unavailable', label: 'Audit unavailable after submit' },
  {
    id: 'provider-unavailable',
    label: 'Provider unavailable after submit',
  },
  { id: 'failed', label: 'Broker apply failed' },
  { id: 'stale-plan', label: 'Stale plan rejected' },
  { id: 'cancelled', label: 'Operator cancelled before submit' },
]

export const singleSecretRevealLifecycleStates: Array<{
  id: SingleSecretRevealLifecycleState
  label: string
}> = [
  { id: 'pending', label: 'Challenge pending' },
  { id: 'authorized', label: 'Authorized short-lived display' },
  { id: 'expired', label: 'Challenge expired' },
  { id: 'revoked', label: 'Challenge revoked' },
  { id: 'denied', label: 'Policy denied' },
  { id: 'audit-unavailable', label: 'Audit unavailable' },
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
  { id: 'policy-denied', label: 'Policy denied after submit' },
  { id: 'auth-required', label: 'Provider auth required after submit' },
  { id: 'audit-unavailable', label: 'Audit unavailable after submit' },
  { id: 'provider-unavailable', label: 'Provider unavailable after submit' },
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
    'secrets-management:single-secret-operation-audit-trail',
    'secrets-management:route-storage-leak-evidence',
    'secrets-management:single-secret-decommission-preview',
    'secrets-management:single-secret-policy-preview',
    'secrets-management:stub-delete-preview',
    'secrets-management:bulk-campaign-dry-run',
    'secrets-management:bulk-campaign-apply',
    'secrets-management:bulk-campaign-status',
    'secrets-management:bulk-campaign-closure-review',
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
  if (mode === 'policy-denied') return 'denied'
  if (mode === 'auth-required') return 'auth-required'
  if (mode === 'audit-unavailable') return 'audit-unavailable'
  if (mode === 'provider-unavailable') return 'provider-unavailable'
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
    case 'audit-unavailable':
      return 'restore audit persistence then create a fresh campaign preview'
    case 'provider-unavailable':
      return 'restore provider connectivity then create a fresh campaign preview'
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
  if (outcome === 'denied') {
    return 'mutation failed closed because broker policy denied this item after final revalidation'
  }
  if (outcome === 'auth-required') {
    return 'mutation failed closed because broker requires provider reauthentication'
  }
  if (outcome === 'audit-unavailable') {
    return 'mutation failed closed because item audit could not be persisted'
  }
  if (outcome === 'provider-unavailable') {
    return 'mutation failed closed because provider connector was unavailable'
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
          : outcome === 'denied'
            ? 'campaign audit recorded; policy denied and item mutation not applied'
            : outcome === 'auth-required'
              ? 'campaign audit recorded; provider auth required and item mutation not applied'
              : outcome === 'audit-unavailable'
                ? 'campaign audit unavailable; item mutation not applied'
                : outcome === 'provider-unavailable'
                  ? 'campaign audit recorded; provider unavailable and item mutation not applied'
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
  const auditUnavailableCount = items.filter(
    (item) => item.outcome === 'audit-unavailable'
  ).length
  const providerUnavailableCount = items.filter(
    (item) => item.outcome === 'provider-unavailable'
  ).length
  const skippedCount = items.filter((item) => item.outcome === 'skipped').length
  const nonAppliedCount =
    failedCount +
    staleCount +
    deniedCount +
    unsupportedCount +
    authRequiredCount +
    auditUnavailableCount +
    providerUnavailableCount +
    skippedCount
  const outcome =
    auditUnavailableCount > 0
      ? 'audit_unavailable'
      : providerUnavailableCount > 0
        ? 'provider_unavailable'
        : mode === 'auth-required' &&
            authRequiredCount > 0 &&
            appliedCount === 0
          ? 'auth_required'
          : staleCount > 0
            ? 'stale_plan'
            : appliedCount === 0 && deniedCount > 0
              ? 'policy_denied'
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
    auditUnavailableCount,
    providerUnavailableCount,
    staleCount,
    auditStatus:
      auditUnavailableCount > 0
        ? 'campaign-level audit unavailable; no item mutation applied without audit persistence'
        : providerUnavailableCount > 0
          ? 'campaign-level audit recorded; provider connector unavailable and no item mutation applied'
          : outcome === 'auth_required'
            ? 'campaign-level audit recorded; provider reauthentication required and no values were read or written'
            : outcome === 'policy_denied'
              ? 'campaign-level audit recorded; broker policy denied item mutation and no values were read or written'
              : 'campaign-level audit summary recorded',
    nextAction:
      outcome === 'applied'
        ? 'monitor campaign status'
        : outcome === 'audit_unavailable'
          ? 'restore audit sink availability and create a fresh campaign preview'
          : outcome === 'provider_unavailable'
            ? 'restore provider connectivity and create a fresh campaign preview'
            : outcome === 'auth_required'
              ? 'complete provider reauthentication and create a fresh campaign preview'
              : outcome === 'stale_plan'
                ? 'create a fresh plan'
                : outcome === 'policy_denied'
                  ? 'request least-privilege policy approval and create a fresh campaign preview'
                  : 'review per-item outcomes and retry only by operation id',
    items,
  }
}

export function buildBulkSecretCampaignClosureReview(
  result: BulkSecretCampaignApplyResult
): BulkSecretCampaignClosureReview {
  const nonAppliedCount =
    result.failedCount +
    result.deniedCount +
    result.skippedCount +
    result.unsupportedCount +
    result.authRequiredCount +
    result.auditUnavailableCount +
    result.providerUnavailableCount +
    result.staleCount
  const retrySafeCount = result.items.filter(
    (item) => !item.applied && item.retrySafe
  ).length
  const canCloseCampaignReview =
    result.outcome === 'applied' && nonAppliedCount === 0
  const reviewState: BulkSecretCampaignClosureReview['reviewState'] =
    canCloseCampaignReview
      ? 'closable'
      : retrySafeCount > 0
        ? 'monitoring'
        : 'blocked'

  return {
    closureId: `bulk-closure-${safeCampaignSlug(result.campaignId)}`,
    campaignId: result.campaignId,
    operationId: result.operationId,
    outcome: result.outcome,
    reviewState,
    canCloseCampaignReview,
    requiredBeforeClose: canCloseCampaignReview
      ? [
          'acknowledge campaign-level audit summary',
          'retain item operation ids and plan token',
          'confirm dependent service status is reviewed',
        ]
      : reviewState === 'monitoring'
        ? [
            'review retry-safe failed item operation ids',
            'retry only items marked retry safe and only by operation id',
            'keep campaign open until every item has terminal recovery metadata',
          ]
        : [
            'resolve the typed blocker named by the campaign next action',
            'create a fresh campaign dry-run before any new mutation attempt',
            'retain blocked item outcome evidence without request or response bodies',
          ],
    retainedEvidenceRefs: [
      result.campaignId,
      result.operationId,
      result.planToken,
      ...result.items.map((item) => item.operationItemId),
    ],
    auditRefs: [
      `audit-campaign-${safeCampaignSlug(result.campaignId)}`,
      `corr-campaign-${safeCampaignSlug(result.operationId)}`,
      `audit-summary-${safeCampaignSlug(result.outcome)}`,
    ],
    supportRefs: [
      `support://secrets-broker/campaigns/${safeCampaignSlug(result.campaignId)}/safe-summary`,
      `diagnostics://secrets-broker/campaigns/${safeCampaignSlug(result.operationId)}/metadata-only`,
      'screenshots-redacted-by-policy',
    ],
    itemOutcomeSummary: result.items.map(
      (item) =>
        `${item.name}: ${item.outcome}; ${item.retrySafe ? 'retry-safe' : 'fresh-plan-required'}`
    ),
    allowedClosureFields: [
      'closureId',
      'campaignId',
      'operationId',
      'planToken',
      'outcome',
      'itemOperationIds',
      'idempotencyKeys',
      'auditStatus',
      'correlationId',
      'supportEvidenceRef',
      'typedItemOutcomes',
    ],
    omittedClosureFields: [
      'rawValue',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
      'screenshotsWithVisibleValues',
      'diagnosticPayloadsWithBodies',
      'bulkSpreadsheetPayload',
    ],
    safeClosureRows: [
      'bulk closure review stores only campaign ids, operation ids, typed item outcomes, audit refs, and support evidence refs',
      canCloseCampaignReview
        ? 'campaign review may close after audit acknowledgement and dependent service status review'
        : reviewState === 'monitoring'
          ? 'partial campaigns remain open while retry-safe item recovery is monitored by operation id'
          : 'blocked campaigns stay open until policy, auth, audit, provider, or stale-plan recovery creates a fresh plan',
      'closing or keeping the campaign open never requires raw values, request body replay, provider credentials, or diagnostic payload bodies',
    ],
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
      return [...baseFields, 'metadataDiff', 'patchPlanHash', 'rollbackPlanRef']
    case 'reset':
      return [
        ...baseFields,
        'rotationReason',
        'rotationPlanRef',
        'dependentServiceRefs',
        'restartPlanRefs',
        'idempotencyRef',
      ]
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
  if (action === 'edit') {
    checks.push('metadata diff, schema guard, and conflict check reviewed')
  }
  if (action === 'policy') {
    checks.push('target policy assignment diff checked as metadata only')
  }
  if (action === 'reset') {
    checks.push('rotation can submit without controlled reveal')
    checks.push('dependent service restart and reload plan checked')
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

export function buildSingleSecretSubmitEnvelope(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan
): SingleSecretSubmitEnvelope {
  const slug = safeOperationSlug(plan.action, row)

  return {
    operationId: plan.operationId,
    endpoint: plan.endpoint,
    idempotencyKey: `idem-${slug}-metadata-submit`,
    correlationId: `corr-${slug}-metadata-submit`,
    payloadFields: plan.safePayloadFields,
    omittedFields: [
      'rawValue',
      'clearValueBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'environmentValues',
      'requestBodyEcho',
    ],
    transportGuardrails: [
      'ref stays in the broker route template and is not copied into query strings',
      'operation id and correlation id are metadata-only and retry scoped',
      'submit body is allowlisted from the dry-run plan fields only',
    ],
    storageGuardrails: [
      'no local storage or session storage writes are required for submit',
      'audit reason is retained as broker audit metadata only',
      'recovery, rollback, and tombstone refs never embed secret values',
    ],
    diagnosticsGuardrails: [
      'console events use action and operation id only',
      'screenshots and support bundles may include metadata ids but not payload values',
      'failure evidence records typed status and correlation id only',
    ],
    readyForSubmit: plan.canSubmit,
    blockedReason: plan.canSubmit
      ? 'ready after final broker revalidation'
      : (plan.blockers[0] ?? plan.applyGate),
  }
}

export function buildSingleSecretConfirmationReceipt(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  envelope: SingleSecretSubmitEnvelope,
  auditReason: string,
  confirmed: boolean
): SingleSecretConfirmationReceipt {
  const slug = safeOperationSlug(plan.action, row)
  const hasAuditReason = auditReason.trim().length >= 8
  const accepted = plan.canSubmit && envelope.readyForSubmit
  const metadataOnly = plan.action === 'metadata'

  return {
    receiptId: `receipt-${slug}-${accepted ? 'accepted' : 'blocked'}`,
    operationId: plan.operationId,
    ref: row.ref,
    action: plan.action,
    accepted,
    auditReasonStatus: metadataOnly
      ? 'not required for metadata view'
      : hasAuditReason
        ? 'accepted as broker audit metadata'
        : 'missing or too short',
    confirmationStatus: metadataOnly
      ? 'not required for metadata view'
      : confirmed
        ? 'explicit stub preview confirmation accepted'
        : 'explicit confirmation missing',
    dryRunBinding:
      'receipt binds the latest dry-run operation id, selected ref, action, and idempotency key',
    policyBinding: plan.policyDecision,
    capabilityBinding: plan.capabilityDecision,
    blockedReason: accepted ? 'none' : envelope.blockedReason,
    allowedReceiptFields: [
      'receiptId',
      'operationId',
      'ref',
      'action',
      'auditReasonStatus',
      'confirmationStatus',
      'capabilityDecision',
      'policyDecision',
      'idempotencyKey',
      'correlationId',
    ],
    omittedReceiptFields: [
      'auditReasonText',
      'rawValue',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
    ],
    safeReceiptRows: [
      accepted
        ? 'confirmation receipt accepted; submit remains operation-id scoped'
        : 'confirmation receipt blocked before broker mutation',
      'audit reason text is represented only by broker audit metadata status',
      'operator confirmation is recorded as a boolean gate, not as free-form payload',
      'receipt evidence can be copied to audit notes without raw secret material',
      envelope.readyForSubmit
        ? 'submit envelope is ready after final broker revalidation'
        : `submit envelope blocked: ${envelope.blockedReason}`,
    ],
  }
}

export function buildSingleSecretReplayGuard(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  envelope: SingleSecretSubmitEnvelope
): SingleSecretReplayGuard {
  const slug = safeOperationSlug(plan.action, row)
  const readyForReplaySafeSubmit = plan.canSubmit && envelope.readyForSubmit

  return {
    operationId: plan.operationId,
    replayScope:
      'single-secret operation id, selected ref, selected action, and broker-issued idempotency key',
    planFingerprint: `plan-fp-${slug}-metadata-only`,
    selectedRefBinding: `bound to selected ref ${row.ref}`,
    actionBinding: `bound to ${managedSecretActionLabel(plan.action).toLowerCase()} action`,
    idempotencyKey: envelope.idempotencyKey,
    correlationId: envelope.correlationId,
    stalePlanGuard:
      'reject submit if ref, action, policy, capability, provider, audit, or plan fingerprint changed after dry-run',
    replayDecision: readyForReplaySafeSubmit
      ? 'first submit and retry are allowed only with the same operation id and idempotency key'
      : `replay blocked: ${envelope.blockedReason}`,
    readyForReplaySafeSubmit,
    omittedReplayFields: [
      'rawValue',
      'requestBody',
      'responseBody',
      'auditReasonText',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'environmentValues',
    ],
    refBindingRows: [
      'cross-ref replay rejected before broker mutation',
      'cross-action replay rejected before broker mutation',
      'stale dry-run fingerprint requires a fresh preview',
    ],
    safeReplayRows: [
      'idempotency evidence uses operation id, correlation id, ref metadata, and action metadata only',
      'retry status is operation-id scoped and never includes request or response bodies',
      'operator audit reason text is represented by broker audit metadata only',
    ],
  }
}

export function buildSingleSecretLeakEvidence(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  envelope: SingleSecretSubmitEnvelope
): SingleSecretLeakEvidence {
  const slug = safeOperationSlug(plan.action, row)
  const actionParam =
    plan.action === 'metadata'
      ? 'action omitted for default metadata view'
      : `action=${plan.action}`

  return {
    route: managedSecretSafeSurfaces.route,
    selectedRef: row.ref,
    action: plan.action,
    routeState:
      'selected ref and action are represented as allowlisted metadata only',
    allowedRouteParams: [
      'ref=<managed secret ref>',
      actionParam,
      'secret=<metadata table search>',
      'provider=<provider filter>',
      'state=<state filter>',
      'page/pageSize=<table pagination>',
    ],
    browserStorageWrites:
      'localStorage writes: none; sessionStorage writes: none',
    browserStorageKeys: ['none'],
    diagnosticsRef: `diagnostics-${slug}-metadata-only`,
    supportBundleRef: `support-${slug}-metadata-only`,
    screenshotPolicy:
      'screenshots may include refs, operation ids, badges, and typed outcomes; value display stays hidden',
    consoleEvent: 'secrets-management:route-storage-leak-evidence',
    omittedFields: [
      ...envelope.omittedFields,
      'requestBody',
      'responseBody',
      'providerAuthMaterial',
      'recoveryMaterial',
      'supportBundlePayloadBodies',
    ],
    safeEvidenceRows: [
      'route state uses only ref/action metadata and table filters',
      'browser storage remains unused for selected action state and submit envelopes',
      `submit envelope ${envelope.operationId} omits value and provider auth fields`,
      'diagnostics and support bundles carry refs, operation ids, correlation ids, action names, and typed status only',
      'safe screenshots keep value display regions hidden or redacted',
    ],
    safeForScreenshots: true,
  }
}

export function buildSingleSecretExportGuardrail(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  envelope: SingleSecretSubmitEnvelope
): SingleSecretExportGuardrail {
  const slug = safeOperationSlug(plan.action, row)

  return {
    exportGuardId: `export-guard-${slug}-metadata`,
    operationId: plan.operationId,
    ref: row.ref,
    action: plan.action,
    metadataExportStatus:
      'metadata report available for operation ids, refs, audit refs, typed outcomes, and next actions only',
    rawExportStatus:
      'raw value copy, raw export, and spreadsheet-style payload export are unavailable',
    copyStatus:
      envelope.readyForSubmit || plan.blockers.length === 0
        ? 'copy support evidence only after audit reason and confirmation metadata are bound'
        : 'copy disabled until the selected action passes the dry-run gate',
    allowedExportFields: [
      'exportGuardId',
      'operationId',
      'ref',
      'action',
      'owner',
      'provider',
      'policy',
      'auditEventId',
      'correlationId',
      'outcome',
      'nextAction',
    ],
    blockedExportFields: [
      'rawValue',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
    ],
    exportRoutes: [
      '/secrets-broker/secrets',
      '/secrets-broker/secrets?ref=<encoded-ref>&action=<metadata-action>',
    ],
    storageGuardrails: [
      'browser storage keeps table and action selection only',
      'metadata reports are generated from typed refs and operation ids',
      'diagnostics and support bundles omit request and response bodies',
    ],
    safeExportRows: [
      'metadata export is scoped to the selected ref and operation id',
      'raw value export and bulk raw reveal are out of scope',
      'copyable evidence excludes source payloads, generated values, provider auth material, and recovery material',
      'spreadsheet-style secret editing remains unavailable',
      `support evidence reuses ${envelope.correlationId} without including secret material`,
    ],
  }
}

function editConsumerRefsForRow(row: ManagedSecretRow) {
  if (row.owningService === '@serviceadmin') {
    return ['@serviceadmin operator API', '@serviceadmin runtime config loader']
  }

  return [
    `${row.owningService} runtime config consumer`,
    `${row.workspace} workspace dependency map`,
  ]
}

function rotationDependentServiceRefsForRow(row: ManagedSecretRow) {
  if (row.owningService === '@serviceadmin') {
    return [
      '@serviceadmin runtime session loader',
      '@serviceadmin operator API',
    ]
  }

  return [
    `${row.owningService} runtime secret consumer`,
    `${row.workspace} restart coordination ref`,
  ]
}

export function buildSingleSecretRotationPreview(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan
): SingleSecretRotationPreview {
  const blockers = [...plan.blockers]

  if (plan.action !== 'reset') {
    blockers.push('select reset action')
  }

  const eligible = blockers.length === 0
  const slug = safeOperationSlug('reset', row)
  const dependentServiceRefs = rotationDependentServiceRefsForRow(row)

  return {
    ref: row.ref,
    operationId: plan.operationId,
    eligible,
    badge: eligible ? 'rotation preview ready' : 'rotation preview blocked',
    rotationPlanRef: `rotation-plan-${slug}-metadata`,
    idempotencyRef: `idem-${slug}-metadata-submit`,
    retryWindowRef: `retry-window-${slug}-operation-id-only`,
    providerCapabilityCheck: eligible
      ? 'rotate/reset capability, provider state, policy, and audit metadata ready for final broker revalidation'
      : 'rotation capability and provider state deferred while preview is blocked',
    dependentServiceRefs,
    restartPlanRefs: dependentServiceRefs.map(
      (ref) => `restart-${safeCampaignSlug(ref)}-after-rotation-metadata`
    ),
    auditEventId: auditEventIdForSingleSecretAction('reset', row),
    applyGate: eligible
      ? 'ready for broker-owned rotate/reset submit after final service impact revalidation'
      : blockers[0],
    blockers,
    omittedUnsafeFields: [
      'rawValue',
      'generatedValue',
      'replacementValue',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
    ],
    safeMetadataRows: [
      'rotation preview never reveals the current value or generated replacement value',
      'dependent service restart refs are names only and contain no environment values',
      'idempotency and retry refs are scoped to the broker operation id',
      'operator can rotate without opening a controlled reveal session',
    ],
  }
}

export function buildSingleSecretEditPreview(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan
): SingleSecretEditPreview {
  const blockers = [...plan.blockers]

  if (plan.action !== 'edit') {
    blockers.push('select edit action')
  }

  const eligible = blockers.length === 0
  const slug = safeOperationSlug('edit', row)
  const affectedConsumerRefs = editConsumerRefsForRow(row)

  return {
    ref: row.ref,
    operationId: plan.operationId,
    eligible,
    badge: eligible ? 'edit preview ready' : 'edit preview blocked',
    patchPlanHash: `patch-${slug}-metadata-sha256`,
    validationStatus: eligible
      ? 'schema and policy validation ready for final broker revalidation'
      : 'schema validation deferred while preview is blocked',
    conflictCheckRef: `conflict-${slug}-metadata`,
    rollbackPlanRef: `update-rollback-${slug}-metadata`,
    targetMetadataFields: [
      'label',
      'description',
      'rotationPolicyRef',
      'ownerServiceRef',
      'safeTagSet',
    ],
    immutableFields: [
      'ref',
      'providerCredential',
      'rawValue',
      'providerToken',
      'environmentValue',
    ],
    affectedConsumerRefs,
    auditTrail: eligible
      ? 'audit reason, operation id, metadata patch hash, rollback ref, and consumer refs are ready for broker submit'
      : 'audit trail records blocker metadata only; no update patch will be submitted while blocked',
    applyGate: eligible
      ? 'ready for broker-owned edit/update submit after final conflict and policy revalidation'
      : blockers[0],
    blockers,
    omittedUnsafeFields: [
      'rawValue',
      'clearValueBody',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
    ],
    safeDiffRows: [
      'metadata diff contains field names, old/new metadata refs, and validation status only',
      'clear-value table editing is unavailable and cannot be represented in the patch plan',
      'conflict checks compare operation id, ref, patch hash, policy, and latest metadata version',
      'rollback reference stores previous metadata refs only and never stores secret material',
    ],
  }
}

function revealConsumerRefsForRow(row: ManagedSecretRow) {
  if (row.owningService === '@serviceadmin') {
    return ['@serviceadmin operator session', '@secretsbroker audit writer']
  }

  return [
    `${row.owningService} controlled reveal request`,
    `${row.workspace} workspace audit trail`,
  ]
}

export function buildSingleSecretRevealPreview(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan
): SingleSecretRevealPreview {
  const blockers = [...plan.blockers]

  if (plan.action !== 'reveal') {
    blockers.push('select reveal action')
  }

  const eligible = blockers.length === 0
  const challengeSlug = safeOperationSlug('reveal', row)

  return {
    ref: row.ref,
    operationId: plan.operationId,
    eligible,
    badge: eligible ? 'reveal challenge ready' : 'reveal challenge blocked',
    revealChallengeId: `challenge-${challengeSlug}-metadata`,
    challengeExpiresAt: '2026-06-21T07:20:00Z',
    revealWindow: eligible
      ? 'short-lived display window starts only after broker authorization'
      : 'no reveal window is opened while blocked',
    auditEventId: auditEventIdForSingleSecretAction('reveal', row),
    auditSinkStatus: row.auditStatus.includes('available')
      ? 'audit sink ready for challenge metadata'
      : 'audit sink must be confirmed before reveal challenge',
    policyDecision: plan.policyDecision,
    authRequirement:
      row.auditStatus.includes('required before reveal') ||
      blockers.includes('operator auth required')
        ? 'fresh operator authentication required before reveal'
        : 'operator session can request broker challenge',
    dependentConsumerRefs: revealConsumerRefsForRow(row),
    displayGuardrails: [
      'value stays hidden until the broker returns an authorized short-lived display',
      'copy and export remain unavailable from this management table',
      'expired challenge metadata cannot be reused to show a value',
      'screen and diagnostics evidence contain challenge ids only',
    ],
    applyGate: eligible
      ? 'ready for broker-owned reveal challenge after final revalidation'
      : blockers[0],
    blockers,
    safeMetadataRows: [
      'reveal preview carries challenge id, ref, policy, owner, provider, and audit metadata only',
      'raw secret value is not fetched during preview generation',
      'route, query string, local storage, diagnostics, and support bundles receive no secret material',
      'audit event id and correlation metadata are safe to retain for review',
    ],
  }
}

export function buildSingleSecretRevealLifecycle(
  row: ManagedSecretRow,
  preview: SingleSecretRevealPreview,
  state: SingleSecretRevealLifecycleState
): SingleSecretRevealLifecycle {
  const slug = safeOperationSlug('reveal', row)
  const blockedReason =
    preview.blockers.length > 0
      ? preview.blockers[0]
      : state === 'denied'
        ? 'broker policy denied reveal after challenge review'
        : state === 'audit-unavailable'
          ? 'audit sink unavailable; reveal display fails closed'
          : state === 'expired'
            ? 'challenge expired before broker display authorization'
            : state === 'revoked'
              ? 'operator or broker revoked challenge before display'
              : null
  const badge =
    state === 'authorized'
      ? 'authorized display metadata'
      : state === 'expired'
        ? 'expired'
        : state === 'revoked'
          ? 'revoked'
          : state === 'denied'
            ? 'policy denied'
            : state === 'audit-unavailable'
              ? 'audit blocked'
              : 'pending'
  const displayStatus =
    state === 'authorized'
      ? 'broker authorized a short-lived display session; value remains outside table fixtures and diagnostics'
      : state === 'expired'
        ? 'display not opened because the challenge expired'
        : state === 'revoked'
          ? 'display not opened because the challenge was revoked'
          : state === 'denied'
            ? 'display blocked by policy; no source access occurred'
            : state === 'audit-unavailable'
              ? 'display blocked because audit persistence is unavailable'
              : 'waiting for broker authorization; no display session yet'
  const nextAction =
    state === 'authorized'
      ? 'wait for broker display expiry, then require a fresh reveal challenge for any later view'
      : state === 'expired'
        ? 'create a fresh audited reveal preview before retry'
        : state === 'revoked'
          ? 'review revocation reason and create a fresh challenge only if policy still permits'
          : state === 'denied'
            ? 'request least-privilege approval or choose metadata-only review'
            : state === 'audit-unavailable'
              ? 'restore audit persistence before any new reveal challenge'
              : 'complete broker authorization and audit retention checks before opening display'

  return {
    ref: row.ref,
    operationId: preview.operationId,
    state,
    badge,
    revealChallengeId: preview.revealChallengeId,
    revealSessionRef:
      state === 'authorized'
        ? `reveal-session-${slug}-metadata`
        : 'no active display session',
    displayStatus,
    valueStatus: 'hidden; no value is stored, copied, exported, or logged',
    actorRef:
      state === 'authorized'
        ? 'broker-authorized-operator-session'
        : 'serviceadmin-ui',
    auditEventId: preview.auditEventId,
    correlationId: `corr-reveal-${slug}-${state}`,
    expiresAt:
      state === 'authorized' || state === 'pending'
        ? preview.challengeExpiresAt
        : 'expired or revoked before display',
    revocationRef:
      state === 'revoked'
        ? `revoke-reveal-${slug}-metadata`
        : `revocation-ready-${slug}-metadata`,
    policyDecisionRef: `policy-decision-reveal-${slug}-${state}-metadata`,
    nextAction,
    blockedReason,
    omittedUnsafeFields: [
      'rawValue',
      'displayPayload',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
    ],
    safeEvidenceRows: [
      'lifecycle evidence stores challenge id, session ref, expiry, actor ref, audit event, correlation id, and typed state only',
      'authorized display metadata does not place the revealed value in the table, route, query string, local storage, diagnostics, screenshots, or support bundles',
      state === 'authorized'
        ? 'short-lived display can be revoked or expire without persisting value payloads'
        : state === 'audit-unavailable'
          ? 'audit-unavailable state fails closed before broker display authorization'
          : state === 'denied'
            ? 'policy-denied state records decision refs without source access'
            : state === 'expired'
              ? 'expired challenge metadata cannot be reused for display'
              : state === 'revoked'
                ? 'revoked challenge metadata requires a fresh audited preview before retry'
                : 'pending challenge metadata cannot display a value',
    ],
  }
}

function decommissionDependentServiceRefsForRow(row: ManagedSecretRow) {
  if (row.owningService === '@serviceadmin') {
    return ['@serviceadmin runtime session loader', '@secretsbroker audit sink']
  }

  return [
    `${row.owningService} runtime binding`,
    `${row.workspace} workspace policy reference`,
  ]
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
  const dependentServiceRefs = decommissionDependentServiceRefsForRow(row)
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
  const actionRecoverySteps =
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
  const outcomeRecoverySteps =
    outcome === 'policy-denied'
      ? [
          'preserve the denied operation id for audit review only',
          'request least-privilege policy approval before any new submit',
          'create a fresh audited preview after policy assignment changes',
        ]
      : outcome === 'auth-required'
        ? [
            'complete provider reauthentication in the broker-owned auth flow',
            'discard this dry-run token after auth challenge starts',
            'create a fresh audited preview after provider session is refreshed',
          ]
        : outcome === 'provider-unavailable'
          ? [
              'wait for broker health to confirm the provider connector is reachable',
              'keep the current operation id for support evidence only',
              'create a fresh audited preview after provider capability metadata refreshes',
            ]
          : outcome === 'stale-plan'
            ? [
                'discard the expired dry-run token and operation submit envelope',
                'refresh policy, provider capability, audit sink, and ref metadata before retry',
                'create a fresh audited preview before any broker submit is attempted',
              ]
            : outcome === 'failed'
              ? [
                  'preserve the broker failure reference for support evidence only',
                  'retry only when the broker marks the same operation id retry safe',
                  'create a fresh preview if the failure category changes before retry',
                ]
              : outcome === 'cancelled'
                ? [
                    'record the cancelled operation id as audit metadata only',
                    'discard the cancelled submit envelope before any broker mutation',
                    'create a fresh audited preview if the operator resumes',
                  ]
                : []
  const recoverySteps = [...actionRecoverySteps, ...outcomeRecoverySteps]
  const applied = outcome === 'applied'
  const resultBadge =
    outcome === 'applied'
      ? 'broker applied'
      : outcome === 'policy-denied'
        ? 'policy denied'
        : outcome === 'auth-required'
          ? 'auth required'
          : outcome === 'audit-unavailable'
            ? 'audit unavailable'
            : outcome === 'provider-unavailable'
              ? 'provider unavailable'
              : outcome === 'failed'
                ? 'apply failed'
                : outcome === 'stale-plan'
                  ? 'stale plan'
                  : outcome === 'cancelled'
                    ? 'cancelled by operator'
                    : 'submitted to broker'
  const auditStatus =
    outcome === 'submitted'
      ? 'stub audit event recorded with metadata only'
      : outcome === 'applied'
        ? 'stub audit event and broker success metadata recorded'
        : outcome === 'audit-unavailable'
          ? 'stub audit outage metadata recorded; mutation failed closed'
          : outcome === 'provider-unavailable'
            ? 'stub provider outage metadata recorded; mutation failed closed'
            : outcome === 'stale-plan'
              ? 'stub stale-plan rejection recorded; mutation failed closed'
              : outcome === 'cancelled'
                ? 'stub cancellation metadata recorded; mutation not submitted'
                : 'stub audit event recorded with typed failure metadata only'
  const resultStatus =
    outcome === 'submitted'
      ? `${actionLabel} dry-run accepted for broker submission; production mutation remains external to this stub`
      : outcome === 'applied'
        ? `${actionLabel} accepted by broker status callback; Service Admin records metadata only`
        : outcome === 'policy-denied'
          ? `${actionLabel} denied by broker policy after final revalidation; no value was read or written`
          : outcome === 'auth-required'
            ? `${actionLabel} paused because broker requires fresh operator authentication before source access`
            : outcome === 'audit-unavailable'
              ? `${actionLabel} blocked because audit persistence is unavailable; no value was read or written`
              : outcome === 'provider-unavailable'
                ? `${actionLabel} blocked because the provider connector is unavailable or unsupported; no value was read or written`
                : outcome === 'stale-plan'
                  ? `${actionLabel} rejected because the dry-run plan token expired before final broker revalidation; no value was read or written`
                  : outcome === 'cancelled'
                    ? `${actionLabel} cancelled by operator before broker mutation; the cancelled operation id is retained as metadata only`
                    : `${actionLabel} failed with broker-owned safe error metadata`
  const nextAction =
    outcome === 'applied'
      ? plan.action === 'reset'
        ? 'monitor dependent service restart notes and rotation freshness'
        : 'monitor broker operation audit and dependent service status'
      : outcome === 'policy-denied'
        ? 'update policy assignment or request least-privilege approval'
        : outcome === 'auth-required'
          ? 'complete broker provider reauthentication and create a fresh preview'
          : outcome === 'audit-unavailable'
            ? 'restore audit sink availability and create a fresh preview'
            : outcome === 'provider-unavailable'
              ? 'restore provider connectivity or capability support and create a fresh preview'
              : outcome === 'stale-plan'
                ? 'create a fresh dry-run plan before retry'
                : outcome === 'failed'
                  ? 'review safe broker failure metadata and retry only when marked safe'
                  : outcome === 'cancelled'
                    ? 'create a fresh dry-run preview if the operator resumes this action'
                    : plan.action === 'reset'
                      ? 'monitor broker rotation outcome and dependent service restart notes'
                      : 'monitor broker operation status and typed policy/audit result'
  const recoveryStatus =
    outcome === 'applied'
      ? 'operation settled with broker success metadata'
      : outcome === 'policy-denied'
        ? 'policy denial is fail-closed and requires a new authorized plan'
        : outcome === 'auth-required'
          ? 'provider reauthentication must complete in the broker-owned auth flow'
          : outcome === 'audit-unavailable'
            ? 'audit outage is fail-closed and requires a fresh audited preview'
            : outcome === 'provider-unavailable'
              ? 'provider outage is fail-closed and requires a fresh audited preview'
              : outcome === 'stale-plan'
                ? 'stale plan recovery requires a fresh audited preview'
                : outcome === 'failed'
                  ? 'broker failure recovery depends on retry-safe operation metadata'
                  : outcome === 'cancelled'
                    ? 'cancelled preview was not submitted and can only resume with a fresh dry-run'
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
          outcome === 'audit-unavailable' ||
          outcome === 'provider-unavailable' ||
          outcome === 'stale-plan' ||
          outcome === 'cancelled'
        ? 'fresh plan required before any retry'
        : outcome === 'failed'
          ? 'retry only with the same operation id when broker marks retry safe'
          : plan.action === 'delete' || plan.action === 'policy'
            ? 'fresh plan required before any retry'
            : 'retry only by operation id when broker marks the attempt retry-safe'
  const providerAuthChallengeRef =
    outcome === 'auth-required'
      ? `auth-challenge-${safeOperationSlug(plan.action, row)}-metadata`
      : null
  const providerRecoveryRef =
    outcome === 'provider-unavailable'
      ? `provider-recovery-${safeOperationSlug(plan.action, row)}-metadata`
      : null
  const brokerFailureRef =
    outcome === 'failed'
      ? `broker-failure-${safeOperationSlug(plan.action, row)}-metadata`
      : null
  const brokerFailureCategory =
    outcome === 'failed'
      ? plan.action === 'reset'
        ? 'provider_retryable_safe_error'
        : plan.action === 'edit'
          ? 'metadata_update_retryable_safe_error'
          : plan.action === 'delete'
            ? 'decommission_non_retryable_safe_error'
            : plan.action === 'policy'
              ? 'policy_assignment_safe_error'
              : 'reveal_safe_error'
      : null
  const auditFeedback = buildSingleSecretAuditFeedback(
    row,
    plan,
    outcome,
    auditEventIdForSingleSecretAction(plan.action, row)
  )
  const impactEvidence = buildSingleSecretImpactEvidence(
    row,
    plan,
    outcome,
    auditFeedback
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
    providerAuthChallengeRef,
    providerRecoveryRef,
    brokerFailureRef,
    brokerFailureCategory,
    recoverySteps,
    auditFeedback,
    impactEvidence,
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
      outcome === 'auth-required'
        ? 'provider reauthentication uses broker-owned challenge refs; credentials are never entered in the Service Admin table'
        : outcome === 'provider-unavailable'
          ? 'provider outage details are limited to connector state, capability metadata, and correlation id'
          : outcome === 'stale-plan'
            ? 'stale-plan evidence is limited to operation id, ref, action, and expired preview metadata'
            : outcome === 'failed'
              ? 'broker failure evidence is limited to operation id, category, retry-safe status, and correlation id'
              : outcome === 'cancelled'
                ? 'cancellation evidence is limited to operation id, ref, action, audit reason metadata, and correlation id'
                : 'broker result metadata excludes provider auth challenge secrets',
      'no copy, export, route, query string, local storage, or diagnostic payload contains secret material',
    ],
    nextAction,
  }
}

export function buildSingleSecretImpactEvidence(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  outcome: SingleSecretOperationOutcome,
  auditFeedback: SingleSecretAuditFeedback
): SingleSecretImpactEvidence {
  const slug = safeOperationSlug(plan.action, row)
  const dependentServiceRefs =
    plan.action === 'delete'
      ? decommissionDependentServiceRefsForRow(row)
      : plan.action === 'policy'
        ? policyConsumerRefsForRow(row)
        : plan.action === 'reset'
          ? ['@serviceadmin runtime session loader']
          : plan.action === 'edit'
            ? [row.owningService]
            : ['@serviceadmin operator session']
  const rollbackRef =
    plan.action === 'delete'
      ? `recovery-${slug}-metadata`
      : plan.action === 'policy'
        ? `rollback-${slug}-metadata`
        : plan.action === 'reset'
          ? `rotation-monitor-${slug}-metadata`
          : plan.action === 'edit'
            ? `update-rollback-${slug}-metadata`
            : `reveal-window-${slug}-metadata`
  const freshPreviewRequirement =
    outcome === 'applied'
      ? plan.action === 'delete'
        ? 'restore or recreate only through a fresh audited broker recovery plan'
        : plan.action === 'policy'
          ? 'rollback requires a fresh audited policy assignment preview'
          : 'future changes require a fresh audited dry-run preview'
      : outcome === 'submitted'
        ? 'wait for broker terminal metadata before any follow-up preview'
        : 'discard this result before retry and create a fresh audited dry-run preview'

  return {
    title:
      plan.action === 'delete'
        ? 'Delete/decommission impact evidence'
        : plan.action === 'policy'
          ? 'Policy assignment impact evidence'
          : plan.action === 'reset'
            ? 'Rotation impact evidence'
            : plan.action === 'edit'
              ? 'Edit impact evidence'
              : 'Reveal impact evidence',
    impactRef: `impact-${slug}-${outcome}-metadata`,
    dependentServiceRefs,
    auditRefs: [auditFeedback.auditEventId, auditFeedback.correlationId],
    rollbackRef,
    freshPreviewRequirement,
    omittedUnsafeFields: [
      'rawValue',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
    ],
    safeEvidenceRows: [
      'impact evidence stores refs, operation ids, typed outcome, audit refs, and dependent service metadata only',
      plan.action === 'delete'
        ? 'decommission impact keeps tombstone and recovery references separate from secret material'
        : plan.action === 'policy'
          ? 'policy impact keeps previous and target policy refs as metadata-only rollback context'
          : 'impact evidence keeps follow-up guidance metadata-only',
      'support bundles and diagnostics may include this impact reference but never secret payloads',
    ],
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
            : outcome === 'audit-unavailable'
              ? 'recorded as audit unavailable with no source access'
              : outcome === 'provider-unavailable'
                ? 'recorded as provider unavailable with no source access'
                : outcome === 'stale-plan'
                  ? 'recorded as stale-plan rejection'
                  : outcome === 'cancelled'
                    ? 'recorded as operator cancellation with no broker mutation'
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
      ? outcome === 'audit-unavailable'
        ? 'audit sink unavailable; mutation is blocked until broker confirms retention'
        : 'audit sink available in stub metadata model'
      : 'audit sink requires broker confirmation before apply',
    evidenceRows: [
      'audit payload excludes raw values and credential material',
      'operator reason is stored as metadata, not as a secret field',
      outcome === 'auth-required'
        ? 'provider auth challenge refs contain status metadata only and never provider credentials'
        : outcome === 'provider-unavailable'
          ? 'provider outage evidence contains connector status metadata only and never provider credentials'
          : outcome === 'stale-plan'
            ? 'stale-plan evidence contains expired preview metadata only and never request or response bodies'
            : outcome === 'failed'
              ? 'broker failure evidence contains typed category metadata only and never request or response bodies'
              : outcome === 'cancelled'
                ? 'cancellation evidence contains typed operator intent metadata only and never request or response bodies'
                : 'provider auth material is omitted from audit evidence',
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

export function buildSingleSecretOperationHistoryReview(
  entries: SingleSecretOperationHistoryEntry[],
  filter: SingleSecretOperationHistoryFilter = {
    action: 'all',
    outcome: 'all',
    query: '',
  }
): SingleSecretOperationHistoryReview {
  const query = filter.query.trim().toLowerCase()
  const filteredEntries = entries.filter((entry) => {
    const actionMatches =
      filter.action === 'all' || entry.action === filter.action
    const outcomeMatches =
      filter.outcome === 'all' || entry.outcome === filter.outcome
    const textMatches =
      query.length === 0 ||
      [
        entry.operationId,
        entry.ref,
        entry.rowName,
        entry.provider,
        entry.policy,
        entry.auditEventId,
        entry.auditFeedback.correlationId,
        entry.outcome,
        entry.action,
        entry.statusBadge,
        entry.resultStatus,
        entry.recoveryStatus,
        entry.retryPolicy,
        entry.nextAction,
        entry.submittedAt,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)

    return actionMatches && outcomeMatches && textMatches
  })

  const blockedOutcomes: SingleSecretOperationOutcome[] = [
    'policy-denied',
    'auth-required',
    'audit-unavailable',
    'provider-unavailable',
    'failed',
    'stale-plan',
    'cancelled',
  ]

  return {
    totalCount: entries.length,
    filteredCount: filteredEntries.length,
    appliedCount: filteredEntries.filter((entry) => entry.outcome === 'applied')
      .length,
    blockedCount: filteredEntries.filter((entry) =>
      blockedOutcomes.includes(entry.outcome)
    ).length,
    pendingCount: filteredEntries.filter(
      (entry) => entry.outcome === 'submitted'
    ).length,
    safeSearchStatus:
      query.length > 0
        ? 'history search matched metadata-only operation evidence'
        : 'history review is showing metadata-only operation evidence',
    allowedFields: [
      'operationId',
      'ref',
      'rowName',
      'provider',
      'policy',
      'action',
      'outcome',
      'auditEventId',
      'correlationId',
      'resultStatus',
      'recoveryStatus',
      'retryPolicy',
      'nextAction',
      'submittedAt',
    ],
    omittedFields: [
      'rawValue',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
      'screenshotsWithVisibleValues',
      'diagnosticPayloadsWithBodies',
    ],
    safeEvidenceRows: [
      'history filters operate on refs, operation ids, action/outcome, audit ids, correlation ids, and provider metadata only',
      'history review excludes request bodies, response bodies, raw values, credentials, tokens, cookies, keys, recovery material, and environment values',
      'filtered history rows remain safe for support triage and screenshots because value display regions stay hidden',
    ],
    entries: filteredEntries,
  }
}

export function buildSingleSecretOperationAuditTrail(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  outcome: SingleSecretOperationOutcome = 'submitted'
): SingleSecretOperationAuditTrailStep[] {
  const auditEventId = auditEventIdForSingleSecretAction(plan.action, row)
  const slug = safeOperationSlug(plan.action, row)
  const terminalStatus =
    outcome === 'applied'
      ? 'terminal success'
      : outcome === 'submitted'
        ? 'pending broker terminal status'
        : outcome === 'policy-denied'
          ? 'terminal policy denial'
          : outcome === 'auth-required'
            ? 'paused for broker reauthentication'
            : outcome === 'audit-unavailable'
              ? 'terminal audit unavailable'
              : outcome === 'provider-unavailable'
                ? 'terminal provider unavailable'
                : outcome === 'stale-plan'
                  ? 'terminal stale-plan rejection'
                  : outcome === 'cancelled'
                    ? 'terminal operator cancellation'
                    : 'terminal safe failure'

  return [
    {
      id: `${auditEventId}:preview`,
      label: 'Dry-run preview recorded',
      status: plan.dryRunStatus,
      actorRef: 'serviceadmin-ui',
      evidence: `${plan.operationId} created for ${row.name}`,
      redaction:
        'preview evidence stores ref, action, policy, provider, owner, and audit metadata only',
      occurredAt: 'stub-step-1',
      terminal: false,
    },
    {
      id: `${auditEventId}:gate`,
      label: 'Apply gate evaluated',
      status: plan.applyGate,
      actorRef: 'secretsbroker-policy',
      evidence:
        plan.blockers.length > 0
          ? `blocked by ${plan.blockers.join(', ')}`
          : 'confirmation, capability, policy, and audit metadata accepted',
      redaction:
        'gate evidence excludes raw values, request bodies, credentials, and environment values',
      occurredAt: 'stub-step-2',
      terminal: false,
    },
    {
      id: `${auditEventId}:broker-status`,
      label: 'Broker status callback',
      status: terminalStatus,
      actorRef: '@secretsbroker',
      evidence: `corr-${slug}-${outcome}`,
      redaction:
        'callback evidence stores typed outcome and correlation id only',
      occurredAt: 'stub-step-3',
      terminal: outcome !== 'submitted',
    },
    {
      id: `${auditEventId}:audit-sink`,
      label: 'Audit sink retention',
      status: row.auditStatus.includes('available')
        ? 'retained by available audit sink'
        : 'waiting for audit sink confirmation',
      actorRef: '@secretsbroker-audit',
      evidence: auditEventId,
      redaction:
        'audit payload uses allowlisted fields and omits payloads, tokens, cookies, keys, and raw secret material',
      occurredAt: 'stub-step-4',
      terminal: false,
    },
  ]
}

export function buildSingleSecretAuditReceipt(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  result: SingleSecretOperationResult,
  auditTrail: SingleSecretOperationAuditTrailStep[]
): SingleSecretAuditReceipt {
  const slug = safeOperationSlug(plan.action, row)
  const terminalStep =
    auditTrail.find((step) => step.terminal) ??
    auditTrail[auditTrail.length - 1]
  const checksumSeed = [
    result.operationId,
    row.ref,
    plan.action,
    result.outcome,
    result.auditFeedback.auditEventId,
    result.auditFeedback.correlationId,
    terminalStep.status,
  ].join('|')
  const checksum = Array.from(checksumSeed).reduce(
    (total, char) => (total + char.charCodeAt(0) * 17) % 100000,
    0
  )

  return {
    receiptId: `audit-receipt-${slug}-${result.outcome}`,
    operationId: result.operationId,
    ref: row.ref,
    action: plan.action,
    outcome: result.outcome,
    auditEventId: result.auditFeedback.auditEventId,
    correlationId: result.auditFeedback.correlationId,
    receiptChecksum: `safe-audit-${checksum.toString().padStart(5, '0')}`,
    retentionStatus:
      result.outcome === 'submitted'
        ? 'receipt pending terminal broker metadata'
        : result.outcome === 'audit-unavailable'
          ? 'audit receipt blocked until sink retention is restored'
          : 'audit receipt retained with metadata-only terminal evidence',
    terminalStepStatus: terminalStep.status,
    safeReceiptFields: [
      'receiptId',
      'operationId',
      'ref',
      'action',
      'outcome',
      'auditEventId',
      'correlationId',
      'terminalStepStatus',
      'receiptChecksum',
      'retentionStatus',
    ],
    omittedReceiptArtifacts: [
      'rawValue',
      'requestBody',
      'responseBody',
      'requestHeaders',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
      'screenshotsWithVisibleValues',
      'diagnosticPayloadsWithBodies',
    ],
    safeReceiptRows: [
      'audit receipts are derived from operation ids, refs, typed outcomes, audit ids, and correlation ids only',
      'receipt checksum proves the metadata set reviewed without hashing or storing secret payloads',
      result.outcome === 'audit-unavailable'
        ? 'audit-unavailable receipts remain blocked and require sink recovery before retry'
        : 'retained audit receipts are shareable for support and issue trails without raw values',
      'receipt exports omit request bodies, response bodies, headers, credentials, tokens, cookies, keys, recovery material, and environment values',
    ],
  }
}

export function buildSingleSecretStatusMonitor(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  result: SingleSecretOperationResult
): SingleSecretStatusMonitor {
  const retryAllowed = result.outcome === 'failed' && plan.action !== 'reveal'
  const terminalState =
    result.outcome === 'applied'
      ? 'terminal success'
      : result.outcome === 'submitted'
        ? 'pending broker terminal status'
        : result.outcome === 'policy-denied'
          ? 'terminal policy denial'
          : result.outcome === 'auth-required'
            ? 'paused for broker authentication'
            : result.outcome === 'audit-unavailable'
              ? 'terminal audit unavailable'
              : result.outcome === 'provider-unavailable'
                ? 'terminal provider unavailable'
                : result.outcome === 'stale-plan'
                  ? 'terminal stale-plan rejection'
                  : result.outcome === 'cancelled'
                    ? 'terminal operator cancellation'
                    : 'terminal safe failure'

  return {
    operationId: result.operationId,
    statusEndpoint: 'GET /v1/management/secret-operations/{operationId}',
    pollCadence:
      result.outcome === 'submitted'
        ? 'poll every 5 seconds until broker terminal metadata arrives'
        : 'polling stopped after terminal metadata is recorded',
    terminalState,
    stateBadge:
      result.outcome === 'applied'
        ? 'settled'
        : result.outcome === 'submitted'
          ? 'monitoring'
          : result.outcome === 'failed'
            ? 'safe failure'
            : result.outcome === 'audit-unavailable'
              ? 'audit blocked'
              : result.outcome === 'auth-required'
                ? 'auth challenge'
                : result.outcome === 'provider-unavailable'
                  ? 'provider outage'
                  : result.outcome === 'cancelled'
                    ? 'cancelled'
                    : result.outcome,
    retryAllowed,
    retryToken: retryAllowed
      ? `retry-${safeOperationSlug(plan.action, row)}-operation-id-only`
      : 'fresh broker preview required before retry',
    stalePlanGuard:
      result.outcome === 'stale-plan'
        ? 'existing dry-run token rejected; generate a fresh audited preview'
        : 'status updates are accepted only when operation id, ref, action, and correlation id match the latest preview',
    allowedStatusFields: [
      'operationId',
      'ref',
      'action',
      'outcome',
      'correlationId',
      'auditEventId',
      'retrySafe',
      'updatedAt',
    ],
    omittedStatusFields: [
      'rawValue',
      'requestBodyEcho',
      'responseBodyEcho',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'environmentValues',
    ],
    statusRows: [
      `broker outcome: ${result.outcome}`,
      `audit event: ${result.auditFeedback.auditEventId}`,
      `correlation: ${result.auditFeedback.correlationId}`,
      `dependent status: ${result.auditFeedback.dependentServiceStatus}`,
      result.outcome === 'auth-required'
        ? 'auth challenge: broker-owned provider reauthentication required'
        : result.outcome === 'provider-unavailable'
          ? 'provider status: connector unavailable or unsupported'
          : result.outcome === 'stale-plan'
            ? 'stale preview: broker rejected the expired dry-run token'
            : result.outcome === 'cancelled'
              ? 'cancelled preview: operator stopped before broker mutation'
              : 'auth challenge: not requested by broker status',
    ],
    operatorNextAction: result.nextAction,
    safeEvidenceRows: [
      'status polling is keyed by operation id, not by secret value',
      'terminal status records typed broker metadata only',
      result.outcome === 'auth-required'
        ? 'provider reauthentication happens outside Service Admin and omits provider credentials'
        : result.outcome === 'provider-unavailable'
          ? 'provider recovery happens in broker/provider configuration and omits provider credentials'
          : result.outcome === 'stale-plan'
            ? 'stale-plan recovery creates a new dry-run and omits request and response body echoes'
            : result.outcome === 'cancelled'
              ? 'cancelled preview recovery creates a fresh dry-run and omits request and response body echoes'
              : 'provider credentials remain omitted from status polling',
      'retry guidance never reuses stale previews or blocked policy decisions',
      'support evidence may include ids, timestamps, and typed outcomes only',
    ],
  }
}

export function buildSingleSecretEvidenceBundle(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  result: SingleSecretOperationResult,
  monitor: SingleSecretStatusMonitor
): SingleSecretEvidenceBundle {
  const slug = safeOperationSlug(plan.action, row)

  return {
    bundleId: `support-evidence-${slug}-${result.outcome}`,
    operationId: result.operationId,
    ref: row.ref,
    reportRef: `report-${slug}-${result.outcome}-metadata`,
    screenshotRedaction:
      'screenshots may include refs, badges, and typed outcomes only; value display regions stay hidden or redacted',
    diagnosticsRef: `diagnostics-${slug}-${monitor.stateBadge}-metadata`,
    storageEvidence:
      'localStorage/sessionStorage evidence contains no secret operation payloads',
    supportBundleStatus:
      result.outcome === 'applied'
        ? 'safe support bundle ready after terminal broker metadata'
        : result.outcome === 'submitted'
          ? 'support bundle pending terminal broker metadata'
          : 'safe support bundle records fail-closed metadata only',
    allowedFields: [
      'bundleId',
      'operationId',
      'ref',
      'action',
      'outcome',
      'auditEventId',
      'correlationId',
      'dependentServiceRefs',
      'statusBadge',
      'updatedAt',
    ],
    omittedArtifacts: [
      'rawValue',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
      'screenshotsWithVisibleValues',
      'diagnosticPayloadsWithBodies',
    ],
    safeEvidenceRows: [
      'support reports are generated from typed broker metadata, not from secret payloads',
      'screenshots and report rows use operation ids, refs, audit ids, correlation ids, and typed outcomes only',
      'diagnostics and support bundles omit request bodies, response bodies, provider auth material, and raw environment values',
      'storage checks prove no raw value, provider credential, token, cookie, key, recovery material, or request body is persisted',
      `next operator action: ${result.nextAction}`,
    ],
  }
}

export function buildSingleSecretRecoveryDecision(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  result: SingleSecretOperationResult,
  monitor: SingleSecretStatusMonitor
): SingleSecretRecoveryDecision {
  const slug = safeOperationSlug(plan.action, row)
  const retryAllowed = result.outcome === 'failed' && plan.action !== 'reveal'
  const freshPreviewRequired =
    result.outcome !== 'submitted' && result.outcome !== 'applied'

  const operatorAction =
    result.outcome === 'applied'
      ? 'review terminal metadata and dependent service freshness'
      : result.outcome === 'submitted'
        ? 'wait for broker terminal status before any retry or recovery'
        : result.outcome === 'auth-required'
          ? 'complete provider reauthentication, then create a fresh audited preview'
          : result.outcome === 'audit-unavailable'
            ? 'restore audit persistence, then create a fresh audited preview'
            : result.outcome === 'provider-unavailable'
              ? 'restore provider connectivity or capability support, then create a fresh audited preview'
              : result.outcome === 'policy-denied'
                ? 'request least-privilege approval or choose a permitted policy, then create a fresh preview'
                : result.outcome === 'stale-plan'
                  ? 'discard the rejected dry-run token and create a fresh preview'
                  : result.outcome === 'cancelled'
                    ? 'resume only by creating a fresh preview with a new confirmation'
                    : 'retry only with the same operation id after reviewing broker failure metadata'

  const brokerAction =
    result.outcome === 'submitted'
      ? 'continue polling operation status by operation id'
      : result.outcome === 'applied'
        ? 'retain terminal status and audit metadata for review'
        : result.outcome === 'auth-required'
          ? 'issue broker-owned provider challenge metadata only'
          : result.outcome === 'audit-unavailable'
            ? 'block mutation until audit retention can be confirmed'
            : result.outcome === 'provider-unavailable'
              ? 'refresh provider health and capability metadata'
              : result.outcome === 'policy-denied'
                ? 'retain policy decision reference without mutation'
                : result.outcome === 'stale-plan'
                  ? 'reject replayed or expired dry-run token'
                  : result.outcome === 'cancelled'
                    ? 'retain cancellation metadata without broker mutation'
                    : 'allow one operation-id retry when broker marks it retry-safe'

  const blocker =
    result.outcome === 'submitted' || result.outcome === 'applied'
      ? 'none'
      : result.outcome === 'failed'
        ? 'broker safe failure metadata review required'
        : result.outcome.replace('-', ' ')

  return {
    decisionId: `recovery-${slug}-${result.outcome}`,
    operationId: result.operationId,
    ref: row.ref,
    outcome: result.outcome,
    badge:
      result.outcome === 'applied'
        ? 'settled'
        : result.outcome === 'submitted'
          ? 'monitor'
          : retryAllowed
            ? 'retry gated'
            : 'fresh preview required',
    retryAllowed,
    freshPreviewRequired,
    operatorAction,
    brokerAction,
    blocker,
    recoveryRef:
      result.providerRecoveryRef ??
      result.brokerFailureRef ??
      `recovery-${slug}-${result.outcome}-metadata`,
    rollbackRef: result.impactEvidence.rollbackRef,
    retryRef: retryAllowed
      ? monitor.retryToken
      : 'retry blocked until a fresh broker preview is created',
    statusEndpoint: monitor.statusEndpoint,
    allowedRecoveryFields: [
      'decisionId',
      'operationId',
      'ref',
      'action',
      'outcome',
      'correlationId',
      'auditEventId',
      'statusBadge',
      'retryAllowed',
      'recoveryRef',
      'rollbackRef',
    ],
    omittedRecoveryFields: [
      'rawValue',
      'requestBodyEcho',
      'responseBodyEcho',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
    ],
    safeRecoveryRows: [
      'recovery decisions are derived from typed broker metadata only',
      'retry eligibility is scoped to operation id, ref, action, and correlation id',
      freshPreviewRequired
        ? 'fresh preview is required before any new broker mutation attempt'
        : 'terminal or pending state does not reuse a mutation payload',
      result.outcome === 'policy-denied'
        ? 'policy denial recovery requires a new authorized policy path'
        : result.outcome === 'audit-unavailable'
          ? 'audit recovery requires confirmed retention before a new preview'
          : result.outcome === 'auth-required'
            ? 'provider challenge stays broker-owned and omits auth material'
            : result.outcome === 'provider-unavailable'
              ? 'provider recovery stores connector metadata only'
              : 'recovery evidence stores ids, refs, typed outcomes, and next actions only',
    ],
  }
}

export function buildSingleSecretOperatorHandoff(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  result: SingleSecretOperationResult,
  monitor: SingleSecretStatusMonitor,
  decision: SingleSecretRecoveryDecision
): SingleSecretOperatorHandoff {
  const slug = safeOperationSlug(plan.action, row)
  const lane: SingleSecretOperatorHandoff['lane'] =
    result.outcome === 'submitted'
      ? 'monitor'
      : result.outcome === 'applied'
        ? 'settled'
        : result.outcome === 'policy-denied'
          ? 'policy-review'
          : result.outcome === 'auth-required'
            ? 'provider-auth'
            : result.outcome === 'audit-unavailable'
              ? 'audit-recovery'
              : result.outcome === 'provider-unavailable'
                ? 'provider-recovery'
                : result.outcome === 'stale-plan' ||
                    result.outcome === 'cancelled'
                  ? 'fresh-preview'
                  : 'broker-review'

  const owner =
    lane === 'monitor' || lane === 'settled'
      ? 'operator'
      : lane === 'policy-review'
        ? 'policy approver'
        : lane === 'provider-auth'
          ? 'provider owner'
          : lane === 'audit-recovery'
            ? 'audit operator'
            : lane === 'provider-recovery'
              ? 'provider operator'
              : lane === 'fresh-preview'
                ? 'operator'
                : 'broker operator'

  const severity: SingleSecretOperatorHandoff['severity'] =
    lane === 'settled' || lane === 'monitor'
      ? 'info'
      : lane === 'audit-recovery' || lane === 'provider-recovery'
        ? 'critical'
        : 'warning'

  const requiredAction =
    lane === 'settled'
      ? 'review terminal status and no further mutation action'
      : lane === 'monitor'
        ? 'keep polling the broker status endpoint until terminal metadata arrives'
        : decision.operatorAction

  return {
    handoffId: `handoff-${slug}-${result.outcome}`,
    operationId: result.operationId,
    ref: row.ref,
    outcome: result.outcome,
    lane,
    badge:
      lane === 'settled'
        ? 'closed'
        : lane === 'monitor'
          ? 'monitoring'
          : lane === 'fresh-preview'
            ? 'new preview'
            : 'owner action required',
    owner,
    severity,
    requiredAction,
    shareableEvidenceRefs: [
      result.auditFeedback.auditEventId,
      result.auditFeedback.correlationId,
      result.impactEvidence.impactRef,
      result.impactEvidence.rollbackRef,
      decision.recoveryRef,
      monitor.statusEndpoint,
    ],
    blockedReason:
      result.outcome === 'submitted' || result.outcome === 'applied'
        ? null
        : decision.blocker,
    validatorNote:
      result.outcome === 'applied'
        ? 'terminal success can be validated from audit id, correlation id, impact ref, and status endpoint only'
        : result.outcome === 'submitted'
          ? 'pending state remains evidence-only until broker terminal status is observed'
          : 'blocked state must be revalidated with a fresh preview before another mutation attempt',
    allowedHandoffFields: [
      'handoffId',
      'operationId',
      'ref',
      'action',
      'outcome',
      'lane',
      'owner',
      'auditEventId',
      'correlationId',
      'statusEndpoint',
      'impactRef',
      'rollbackRef',
      'recoveryRef',
    ],
    omittedHandoffFields: [
      'rawValue',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
      'screenshotsWithVisibleValues',
    ],
    safeHandoffRows: [
      'operator handoffs use ids, refs, typed outcomes, owner lanes, and audit metadata only',
      'handoff evidence can be copied into issue or audit notes without raw secret material',
      result.outcome === 'submitted' || result.outcome === 'applied'
        ? 'successful or pending handoffs do not include mutation payload echoes'
        : 'blocked handoffs require owner action and a fresh broker preview before another submit',
      `required action: ${requiredAction}`,
    ],
  }
}

export function buildSingleSecretOwnerActionTicket(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  handoff: SingleSecretOperatorHandoff
): SingleSecretOwnerActionTicket {
  const slug = safeOperationSlug(plan.action, row)
  const freshPreviewRequired =
    handoff.lane !== 'monitor' && handoff.lane !== 'settled'

  return {
    ticketId: `owner-action-${slug}-${handoff.outcome}`,
    operationId: handoff.operationId,
    ref: row.ref,
    lane: handoff.lane,
    owner: handoff.owner,
    severity: handoff.severity,
    acknowledgementStatus:
      handoff.lane === 'settled'
        ? 'acknowledge terminal broker metadata before closing operator review'
        : handoff.lane === 'monitor'
          ? 'watch broker status endpoint until terminal metadata arrives'
          : 'owner acknowledgement required before another broker preview',
    requiredAction: handoff.requiredAction,
    freshPreviewRequired,
    evidenceRefs: handoff.shareableEvidenceRefs,
    safeEscalationRoute:
      handoff.severity === 'critical'
        ? 'route to broker/audit operator with metadata-only evidence refs'
        : 'keep in operator queue with metadata-only evidence refs',
    allowedTicketFields: [
      'ticketId',
      'operationId',
      'ref',
      'action',
      'lane',
      'owner',
      'severity',
      'auditEventId',
      'correlationId',
      'statusEndpoint',
      'impactRef',
      'rollbackRef',
      'recoveryRef',
    ],
    omittedTicketFields: [
      'rawValue',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
      'screenshotsWithVisibleValues',
      'diagnosticPayloadsWithBodies',
    ],
    safeTicketRows: [
      'owner action tickets are generated from the safe handoff packet only',
      'ticket evidence is shareable because it contains ids, refs, owners, lanes, and typed outcomes only',
      freshPreviewRequired
        ? 'fresh broker preview is required after owner action before any mutation retry'
        : 'no mutation payload is retained while the operation is monitored or settled',
      handoff.lane === 'provider-auth'
        ? 'provider authentication happens outside Service Admin and omits provider credentials'
        : handoff.lane === 'audit-recovery'
          ? 'audit recovery ticket carries sink status metadata only'
          : handoff.lane === 'provider-recovery'
            ? 'provider recovery ticket carries connector metadata only'
            : 'owner queue omits request bodies, response bodies, and secret material',
    ],
  }
}

export function buildSingleSecretClosureReview(
  row: ManagedSecretRow,
  plan: SingleSecretOperationPlan,
  result: SingleSecretOperationResult,
  monitor: SingleSecretStatusMonitor,
  evidenceBundle: SingleSecretEvidenceBundle,
  auditReceipt: SingleSecretAuditReceipt,
  handoff: SingleSecretOperatorHandoff,
  ticket: SingleSecretOwnerActionTicket
): SingleSecretClosureReview {
  const slug = safeOperationSlug(plan.action, row)
  const reviewState: SingleSecretClosureReview['reviewState'] =
    result.outcome === 'applied'
      ? 'ready-to-close'
      : result.outcome === 'submitted'
        ? 'monitoring'
        : 'owner-action-required'
  const canCloseOperatorReview = reviewState === 'ready-to-close'

  return {
    closureId: `closure-review-${slug}-${result.outcome}`,
    operationId: result.operationId,
    ref: row.ref,
    outcome: result.outcome,
    reviewState,
    badge: canCloseOperatorReview
      ? 'operator review can close'
      : reviewState === 'monitoring'
        ? 'wait for broker terminal metadata'
        : 'owner action required before close',
    canCloseOperatorReview,
    requiredBeforeClose: canCloseOperatorReview
      ? [
          'acknowledge terminal audit receipt',
          'retain support evidence bundle reference',
          'confirm dependent service status is reviewed',
        ]
      : reviewState === 'monitoring'
        ? [
            'wait for terminal broker status metadata',
            'refresh status endpoint before deciding retry or close',
            'keep operation in history without retaining payload bodies',
          ]
        : [
            ticket.requiredAction,
            'complete owner acknowledgement',
            'create a fresh preview before any new mutation attempt',
          ],
    retainedEvidenceRefs: [
      auditReceipt.receiptId,
      auditReceipt.receiptChecksum,
      evidenceBundle.bundleId,
      evidenceBundle.reportRef,
      monitor.statusEndpoint,
      handoff.handoffId,
      ticket.ticketId,
    ],
    auditRefs: [
      result.auditFeedback.auditEventId,
      result.auditFeedback.correlationId,
      auditReceipt.terminalStepStatus,
    ],
    supportRefs: [
      evidenceBundle.diagnosticsRef,
      evidenceBundle.supportBundleStatus,
      evidenceBundle.storageEvidence,
    ],
    allowedClosureFields: [
      'closureId',
      'operationId',
      'ref',
      'action',
      'outcome',
      'auditEventId',
      'correlationId',
      'receiptChecksum',
      'statusEndpoint',
      'supportEvidenceRef',
      'ownerActionTicketId',
    ],
    omittedClosureFields: [
      'rawValue',
      'requestBody',
      'responseBody',
      'providerCredentials',
      'providerTokens',
      'cookies',
      'privateKeys',
      'recoveryMaterial',
      'environmentValues',
      'screenshotsWithVisibleValues',
      'diagnosticPayloadsWithBodies',
    ],
    safeClosureRows: [
      'closure review stores only ids, refs, typed outcomes, audit refs, and support evidence refs',
      canCloseOperatorReview
        ? 'operator review may close after terminal metadata and audit receipt acknowledgement'
        : reviewState === 'monitoring'
          ? 'pending operations remain open until broker terminal metadata arrives'
          : 'blocked operations stay open until owner action and a fresh preview are completed',
      'closing or keeping the review open never requires raw value reveal, request body replay, provider credentials, or diagnostic payload bodies',
      `operator lane: ${handoff.lane}`,
    ],
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

export function managedSecretBulkClosureReviewHasSecretMaterial(
  review: BulkSecretCampaignClosureReview
) {
  return forbiddenSecretPattern.test(JSON.stringify(review))
}

export function managedSecretSingleHistoryHasSecretMaterial(
  entries: SingleSecretOperationHistoryEntry[]
) {
  return forbiddenSecretPattern.test(JSON.stringify(entries))
}

export function managedSecretHistoryReviewHasSecretMaterial(
  review: SingleSecretOperationHistoryReview
) {
  return forbiddenSecretPattern.test(JSON.stringify(review))
}

export function managedSecretSingleAuditTrailHasSecretMaterial(
  entries: SingleSecretOperationAuditTrailStep[]
) {
  return forbiddenSecretPattern.test(JSON.stringify(entries))
}

export function managedSecretAuditReceiptHasSecretMaterial(
  receipt: SingleSecretAuditReceipt
) {
  return forbiddenSecretPattern.test(JSON.stringify(receipt))
}

export function managedSecretStatusMonitorHasSecretMaterial(
  monitor: SingleSecretStatusMonitor
) {
  return forbiddenSecretPattern.test(JSON.stringify(monitor))
}

export function managedSecretEvidenceBundleHasSecretMaterial(
  bundle: SingleSecretEvidenceBundle
) {
  return forbiddenSecretPattern.test(JSON.stringify(bundle))
}

export function managedSecretRecoveryDecisionHasSecretMaterial(
  decision: SingleSecretRecoveryDecision
) {
  return forbiddenSecretPattern.test(JSON.stringify(decision))
}

export function managedSecretOperatorHandoffHasSecretMaterial(
  handoff: SingleSecretOperatorHandoff
) {
  return forbiddenSecretPattern.test(JSON.stringify(handoff))
}

export function managedSecretOwnerActionTicketHasSecretMaterial(
  ticket: SingleSecretOwnerActionTicket
) {
  return forbiddenSecretPattern.test(JSON.stringify(ticket))
}

export function managedSecretClosureReviewHasSecretMaterial(
  review: SingleSecretClosureReview
) {
  return forbiddenSecretPattern.test(JSON.stringify(review))
}

export function managedSecretSubmitEnvelopeHasSecretMaterial(
  envelope: SingleSecretSubmitEnvelope
) {
  return forbiddenSecretPattern.test(JSON.stringify(envelope))
}

export function managedSecretConfirmationReceiptHasSecretMaterial(
  receipt: SingleSecretConfirmationReceipt
) {
  return forbiddenSecretPattern.test(JSON.stringify(receipt))
}

export function managedSecretReplayGuardHasSecretMaterial(
  guard: SingleSecretReplayGuard
) {
  return forbiddenSecretPattern.test(JSON.stringify(guard))
}

export function managedSecretLeakEvidenceHasSecretMaterial(
  evidence: SingleSecretLeakEvidence
) {
  return forbiddenSecretPattern.test(JSON.stringify(evidence))
}

export function managedSecretExportGuardrailHasSecretMaterial(
  guardrail: SingleSecretExportGuardrail
) {
  return forbiddenSecretPattern.test(JSON.stringify(guardrail))
}

export function managedSecretEditPreviewHasSecretMaterial(
  preview: SingleSecretEditPreview
) {
  return forbiddenSecretPattern.test(JSON.stringify(preview))
}

export function managedSecretRotationPreviewHasSecretMaterial(
  preview: SingleSecretRotationPreview
) {
  return forbiddenSecretPattern.test(JSON.stringify(preview))
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

export function managedSecretRevealPreviewHasSecretMaterial(
  preview: SingleSecretRevealPreview
) {
  return forbiddenSecretPattern.test(JSON.stringify(preview))
}

export function managedSecretRevealLifecycleHasSecretMaterial(
  lifecycle: SingleSecretRevealLifecycle
) {
  return forbiddenSecretPattern.test(JSON.stringify(lifecycle))
}

export function managedSecretActionReadinessHasSecretMaterial(
  readiness: ManagedSecretActionReadiness[]
) {
  return forbiddenSecretPattern.test(JSON.stringify(readiness))
}
