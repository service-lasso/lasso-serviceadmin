export type ServiceStatus = 'running' | 'available' | 'stopped' | 'degraded'

export type ServiceLogType =
  | 'default'
  | 'stdout'
  | 'stderr'
  | 'access'
  | 'error'
  | (string & {})

export type ServiceLink = {
  label: string
  url: string
  kind?: 'local' | 'lan' | 'remote' | 'admin' | 'docs' | 'metrics'
}

export type ServiceRuntimeHealth = {
  state: ServiceStatus
  health: 'healthy' | 'warning' | 'critical'
  uptime: string
  lastCheckAt: string
  lastRestartAt?: string
  summary: string
}

export type ServiceEndpoint = {
  label: string
  url: string
  bind: string
  port: number
  protocol: 'http' | 'https' | 'tcp'
  exposure: 'local' | 'lan' | 'public'
}

export type ServiceEnvironmentVariable = {
  key: string
  value: string
  templateValue?: string
  scope: 'global' | 'service'
  secret?: boolean
  source?: string
}

export type ServiceMetadata = {
  serviceType: string
  runtime: string
  version: string
  build: string
  packageId?: string
  installPath?: string
  configPath?: string
  dataPath?: string
  logPath?: string
  workPath?: string
  profile?: string
  imageUrl?: string
}

export type ServiceDependency = {
  id: string
  name: string
  status: ServiceStatus
  relation: 'depends_on' | 'dependent'
  note?: string
}

export type ServiceLogPreviewEntry = {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  source: 'supervisor' | 'healthcheck' | 'stdout' | 'stderr' | 'app'
  message: string
}

export type ServiceAction = {
  id: string
  label: string
  kind:
    | 'start'
    | 'stop'
    | 'restart'
    | 'reload'
    | 'install'
    | 'uninstall'
    | 'open_logs'
    | 'open_config'
    | 'open_admin'
}

export type DashboardService = {
  id: string
  name: string
  status: ServiceStatus
  favorite: boolean
  note: string
  links: ServiceLink[]
  installed: boolean
  role: string
  runtimeHealth: ServiceRuntimeHealth
  endpoints: ServiceEndpoint[]
  metadata: ServiceMetadata
  dependencies: ServiceDependency[]
  dependents: ServiceDependency[]
  environmentVariables: ServiceEnvironmentVariable[]
  recentLogs: ServiceLogPreviewEntry[]
  actions: ServiceAction[]
}

export type DashboardRuntime = {
  status: 'healthy' | 'warning'
  lastReloadedAt: string
  warningCount: number
}

export type DashboardSummary = {
  runtime: DashboardRuntime
  servicesTotal: number
  servicesRunning: number
  servicesAvailable?: number
  servicesStopped: number
  servicesDegraded: number
  networkExposureCount: number
  installedCount: number
  favorites: DashboardService[]
  others: DashboardService[]
  warnings: string[]
  problemServices: DashboardService[]
}

export type DashboardAction =
  | 'reload-runtime'
  | 'start-services'
  | 'stop-services'
  | 'restart-services'
  | { kind: 'toggle-favorite'; serviceId: string }
  | {
      kind: 'service-lifecycle'
      serviceId: string
      action: 'start' | 'stop' | 'restart'
    }

export type AuditEventOutcome = 'success' | 'failure'

export type AuditEvent = {
  id: string
  timestamp: string
  source: string
  action: string
  actor: string
  subject?: string
  serviceId?: string
  method?: string
  routeTemplate?: string
  outcome: AuditEventOutcome
  statusCode: number
  summary: string
  reason: string | null
  correlationId: string
  relatedRevisionId: string | null
  chainId: string
  sequence: number
  previousHash: string | null
  eventHash: string
  chainStatus: 'valid'
}

export type AuditEventsFilters = {
  serviceId?: string
  actor?: string
  action?: string
  outcome?: AuditEventOutcome
  source?: string
  since?: string
  until?: string
  query?: string
  limit?: number
  cursor?: string
}

export type AuditEventsPagination = {
  limit: number
  nextCursor: string | null
  total: number
}

export type AuditEventsResponse = {
  events: AuditEvent[]
  pagination: AuditEventsPagination
}

export type AuditEventsResult = AuditEventsResponse & {
  status: 'available' | 'unavailable'
  stubMode: boolean
  unavailableReason: string | null
}

export type ServiceConfigRevision = {
  id: string
  createdAt: string
  actor: string
  reason: string | null
  path: string
  previousHash: string
  currentHash: string
  validationStatus: 'valid'
  content: string
}

export type ServiceConfigDocument = {
  serviceId: string
  fileName: 'server.json'
  path: string
  content: string
  hash: string
  updatedAt: string
  backupCount: number
  revisions: ServiceConfigRevision[]
  safety: {
    rawSecretValuesLoaded: false
    omittedSensitiveFields: string[]
  }
}

export type ServiceConfigSaveResult = {
  serviceId: string
  fileName: 'server.json'
  path: string
  hash: string
  savedAt: string
  backup: ServiceConfigRevision
  validationStatus: 'valid'
}

export type TelemetryCountBucket = {
  key: string
  count: number
}

export type ServiceTelemetrySignal = {
  kind: 'span' | 'metric' | 'log' | string
  name: string
  traceId?: string
  spanId?: string
  traceparent?: string
  correlationId?: string
  attributes: Record<string, string | number | boolean>
}

export type ServiceTelemetryPreview = {
  serviceId: string
  signals: ServiceTelemetrySignal[]
}

export type TelemetryPreview = {
  contractVersion: string
  exporter: {
    status: 'disabled' | 'configured' | 'error' | string
    protocol: string
    endpointConfigured: boolean
    endpointValueReturned: boolean
    headersValueReturned: boolean
    reason: string
  }
  resource: {
    serviceName: string
    serviceNamespace: string
    serviceInstanceId: string
  }
  traceContext?: {
    propagation: string
    responseHeaders: {
      correlationId: string
      traceId: string
      traceparent: string
    }
    traceparentSampled: boolean
    incomingHeadersAccepted: boolean
    incomingHeadersReturned: boolean
    rawHeadersReturned: boolean
    routeTemplateOnly: boolean
  }
  redaction: {
    mode: string
    allowedAttributes: string[]
    forbiddenFieldClasses: string[]
  }
  exportPreview: {
    mode: 'disabled' | 'dry_run' | string
    status: 'not_sent' | 'ready' | string
    signalCount: number
    serviceCount: number
    endpointConfigured: boolean
    endpointValueReturned: boolean
    headersValueReturned: boolean
    bodyValueReturned: boolean
    allowedAttributeCount: number
    reason: string
  }
  apiRequestBuffer?: {
    capacity: number
    retainedCount: number
    droppedCount: number
    routeTemplateOnly: boolean
    rawMaterialReturned: boolean
  }
  apiRequestSummary?: {
    retainedCount: number
    droppedCount: number
    totalObservedCount: number
    mutatingCount: number
    routeGroups: TelemetryCountBucket[]
    statusClasses: TelemetryCountBucket[]
    outcomes: TelemetryCountBucket[]
    routeTemplateOnly: boolean
    rawMaterialReturned: boolean
  }
}

export type SecretManagementRecord = {
  ref: string
  name: string
  sourceId: string
  providerKind: string
  ownerServiceId?: string
  workspaceId?: string
  state: string
  outcome: string
  capabilities: string[]
  policy?: string
  auditStatus?: string
  valueSearch?: string
  tombstone?: SecretTombstoneMetadata
}

export type SecretTombstoneMetadata = {
  state: string
  version: string
  decommissionOperationId: string
  restoreOperationId?: string
  decommissionedAt: string
  restoredAt?: string
}

export type SecretsManagementState = {
  serviceId: string
  apiVersion: string
  query?: string
  valueSearch: boolean
  outcome: string
  results: SecretManagementRecord[]
}

export type SecretRevealRequest = {
  ref: string
  reason: string
  confirm: boolean
}

export type SecretRevealResult = {
  serviceId: string
  apiVersion: string
  requestId: string
  ref: string
  operation: 'reveal'
  outcome: string
  value: string
  metadata?: Record<string, string>
  ttlSeconds: number
  auditStatus: string
}

export type SecretMutationOperation = 'edit' | 'reset'

export type SecretCreateGenerationMode =
  | 'broker_generated'
  | 'operator_supplied'

export type SecretCreatePlan = {
  ref: string
  operationId: string
  generationMode: SecretCreateGenerationMode
  expectedState: 'missing'
  expiresAt: string
  signature: string
}

export type SecretCreateRequest = {
  ref: string
  operationId: string
  generationMode: SecretCreateGenerationMode
  reason: string
  value?: string
  plan?: SecretCreatePlan
}

export type SecretCreateResult = {
  serviceId: string
  apiVersion: string
  requestId: string
  operationId: string
  ref: string
  operation: 'create'
  mode: 'dry-run' | 'apply'
  generationMode: SecretCreateGenerationMode
  outcome: string
  applied: boolean
  requiresConfirmation: boolean
  auditStatus: string
  policyResult: string
  nextAction?: string
  plan?: SecretCreatePlan
  affectedRefs: string[]
  affectedServices: string[]
}

export type SecretMutationRequest = {
  operation: SecretMutationOperation
  ref: string
  reason: string
  value?: string
}

export type SecretMutationResult = {
  serviceId: string
  apiVersion: string
  requestId: string
  ref: string
  operation: SecretMutationOperation
  mode: 'dry-run' | 'apply'
  outcome: string
  applied: boolean
  requiresConfirmation: boolean
  auditStatus: string
  nextAction?: string
  affectedRefs: string[]
  affectedServices: string[]
}

export type SecretPolicyPreviewRequest = {
  ref: string
}

export type SecretPolicyPreviewResult = {
  serviceId: string
  apiVersion: string
  requestId: string
  ref: string
  operation: 'policy'
  mode: 'preview'
  outcome: 'unsupported'
  applied: false
  requiresConfirmation: false
  auditStatus: string
  nextAction: string
  unsupportedCapability: 'policy_binding_persistence'
  currentPolicy?: string
  affectedRefs: string[]
  affectedServices: string[]
}

export type BrokerOperationCapability = {
  operationId: string
  method: string
  path: string
  maturity:
    | 'unavailable'
    | 'planned'
    | 'read-only'
    | 'dry-run'
    | 'executable'
    | 'validated'
    | string
  classification: 'read' | 'mutation' | string
  authenticationRequired: boolean
  policyRequired: boolean
  auditRequired: boolean
  scope: string
  completionMode: string
  limitationCode: string
  reasonCode: string
  nextAction: string
}

export type BrokerProviderStatus = {
  providerId: string
  providerKind: string
  displayName: string
  state: string
  outcome: string
  credentialHandle?: string
  address?: string
  namespaces: string[]
  capabilities: string[]
  operations: BrokerOperationCapability[]
  nextAction?: string
  auditStatus: string
}

export type BrokerProviderStatusState = {
  serviceId: string
  apiVersion: string
  contractVersion: string
  manifestVersion: string
  outcome: string
  currentProvider: BrokerProviderStatus
  providers: BrokerProviderStatus[]
}

export type BrokerProviderValidationRequest = {
  providerId: string
  providerKind: string
  displayName: string
  address?: string
  credentialRef?: string
  namespaces: string[]
  reason: string
}

export type BrokerProviderValidationResult = {
  serviceId: string
  apiVersion: string
  requestId: string
  operation: 'validate'
  outcome: string
  applied: false
  requiresConfirmation: false
  auditStatus: string
  nextAction?: string
  provider: BrokerProviderStatus
}

export type BrokerMigrationRequest = {
  operationId: string
  sourceProviderId: string
  targetProviderId: string
  refs: string[]
  reason: string
}

export type BrokerMigrationItem = {
  ref: string
  sourceProviderId: string
  targetProviderId: string
  ownerServiceId: string
  state: string
  outcome: string
  risk: string
  expectedAction: string
  policyResult: string
  auditRequirement: string
  recovery: string
}

export type BrokerLifecycleBackup = {
  schema: 'service-lasso.secretsbroker.backup-metadata.v1'
  backupId: string
  createdAt?: string
  storeKeyId?: string
  storeKeyVersion?: string
  secretCount: number
  sizeBytes: number
  artifactHash?: string
  verification: 'verified' | 'invalid'
}

export type BrokerRecoveryPolicyMetadata = {
  policyId: string
  keyId: string
  keyVersion: string
  threshold: number
  shareCount: number
  shareFingerprints: string[]
  recipientFingerprints: string[]
  createdAt: string
  rotatedAt?: string
  revokedAt?: string
  status: string
  nextAction: string
}

export type BrokerLifecycleStatus = {
  serviceId: '@secretsbroker'
  apiVersion: string
  outcome: string
  key: {
    available: boolean
    keyId?: string
    keyVersion?: string
    secretCount: number
  }
  wrapper: {
    available: boolean
    supported: boolean
    wrapperKind: string
    os: string
    keyId?: string
    keyVersion?: string
    state: string
    nextAction: string
    failureReason?: string
  }
  recovery: {
    outcome: string
    policy?: BrokerRecoveryPolicyMetadata
    nextAction: string
  }
  backups: BrokerLifecycleBackup[]
  auditStatus: string
  nextAction: string
}

export type BrokerLifecycleOperationRequest = {
  operationId: string
  reason: string
  backupId?: string
  planToken?: string
  expectedKeyId?: string
  expectedStoreHash?: string
  confirm?: boolean
}

export type BrokerLifecycleBackupResult = {
  serviceId: '@secretsbroker'
  apiVersion: string
  outcome: string
  applied: boolean
  backup?: BrokerLifecycleBackup
  backups: BrokerLifecycleBackup[]
  auditStatus: string
  nextAction: string
}

export type BrokerLifecycleRestoreResult = {
  serviceId: '@secretsbroker'
  apiVersion: string
  outcome: string
  applied: boolean
  backup?: BrokerLifecycleBackup
  planToken?: string
  planExpiresAt?: string
  expectedKeyId?: string
  expectedStoreHash?: string
  requiresConfirmation: boolean
  auditStatus: string
  nextAction: string
}

export type BrokerLifecycleRotateResult = {
  serviceId: '@secretsbroker'
  apiVersion: string
  outcome: string
  applied: boolean
  rotatedAt?: string
  oldKeyId?: string
  newKeyId?: string
  keyVersion?: string
  secretCount: number
  requiresConfirmation: boolean
  auditStatus: string
  nextAction: string
}

export type BrokerMigrationResult = {
  serviceId: string
  apiVersion: string
  requestId: string
  operationId: string
  operation: 'migration_dry_run' | 'migration_apply'
  outcome: string
  applied: boolean
  requiresConfirmation: boolean
  auditStatus: string
  nextAction?: string
  sourceProviderId: string
  targetProviderId: string
  results: BrokerMigrationItem[]
  rollback: string
}

export type BrokerBulkCampaignRequest = {
  campaignId?: string
  planToken?: string
  operationId: string
  operation: 'migrate_remap_provider'
  refs: string[]
  targetProviderId: string
  reason: string
  confirm?: boolean
  highRiskConfirm?: string
}

export type BrokerBulkCampaignItem = {
  ref: string
  sourceId: string
  providerKind: string
  ownerServiceId: string
  operation: string
  capabilityResult: string
  policyResult: string
  auditRequirement: string
  risk: string
  expectedAction: string
  outcome: string
  nextAction?: string
  idempotencyKey: string
  operationItemId: string
  recovery?: string
  targetProviderId?: string
  providerAction?: string
  applied: boolean
  retrySafe: boolean
  verified: boolean
  attempts?: number
}

export type BrokerBulkCampaignSummary = {
  selectedCount: number
  applicableCount: number
  deniedCount: number
  unsupportedCount: number
  authRequiredCount: number
  skippedCount: number
  appliedCount: number
  failedCount: number
  staleCount: number
  highRiskCount: number
}

export type BrokerBulkCampaignResult = {
  serviceId: '@secretsbroker'
  apiVersion: string
  requestId: string
  campaignId: string
  planToken: string
  operationId: string
  operation: 'migrate_remap_provider'
  mode: 'create' | 'revalidate' | 'apply' | 'status'
  outcome: string
  applied: boolean
  requiresConfirmation: boolean
  requiresAuditReason: boolean
  requiresRevalidation: boolean
  auditStatus: string
  staleAfterSeconds: number
  nextAction?: string
  results: BrokerBulkCampaignItem[]
  summary: BrokerBulkCampaignSummary
  affectedRefs: string[]
  affectedServices: string[]
  unsupportedFamilies?: string[]
  durable: boolean
  maxConcurrency: number
  backpressurePolicy: string
  createdAt: string
  revalidatedAt?: string
  updatedAt: string
}

export type BrokerTelemetryOperationCounter = {
  operation: string
  outcome: string
  count: number
}

export type BrokerTelemetryStateCounter = {
  id: string
  state: string
  outcome: string
  count: number
}

export type BrokerTelemetry = {
  serviceId: '@secretsbroker'
  apiVersion: string
  contractVersion: string
  outcome: string
  generatedAt: string
  counters: {
    operations: BrokerTelemetryOperationCounter[]
    policyDecisions: Array<{ outcome: string; count: number }>
    localApiAuthFailures: number
    activeLockouts: number
    providerStates: BrokerTelemetryStateCounter[]
    sourceStates: BrokerTelemetryStateCounter[]
    auditRecords: Array<{
      auditStatus: string
      outcome: string
      count: number
    }>
  }
  safety: {
    lowCardinalityLabels: boolean
    valueMaterialIncluded: false
  }
}

export type BrokerOperationalEvent = {
  id: string
  ts: string
  family: string
  severity: string
  operation: string
  serviceId?: string
  providerId?: string
  sourceId?: string
  policyId?: string
  keyId?: string
  refPrefix?: string
  refHash?: string
  outcome: string
  requestId?: string
}

export type BrokerEventFilters = {
  since?: string
  until?: string
  serviceId?: string
  providerId?: string
  sourceId?: string
  operation?: string
  outcome?: string
  severity?: string
  family?: string
  refPrefix?: string
  refHash?: string
  limit?: number
  cursor?: string
}

export type BrokerEventsResult = {
  serviceId: '@secretsbroker'
  apiVersion: string
  outcome: string
  generatedAt: string
  limit: number
  nextCursor?: string
  events: BrokerOperationalEvent[]
  safety: {
    metadataOnly: true
    rawRefIncluded: false
    valueMaterialIncluded: false
  }
}

export type BrokerLockoutClearRequest = {
  scope: string
  reason: string
}

export type BrokerLockoutClearResult = {
  serviceId: '@secretsbroker'
  apiVersion: string
  requestId?: string
  operation: 'lockout_clear'
  outcome: string
  cleared: boolean
  lockoutScope: string
  auditStatus: string
  nextAction?: string
}

export type SecretDecommissionPlan = {
  ref: string
  operationId: string
  expectedVersion: string
  dependencyStatus: 'clear'
  dependencySnapshot: string
  expiresAt: string
  signature: string
}

export type SecretDecommissionRequest = {
  ref: string
  operationId: string
  reason?: string
  plan?: SecretDecommissionPlan
  expectedVersion?: string
}

export type SecretDecommissionResult = {
  serviceId: string
  apiVersion: string
  requestId: string
  operationId: string
  ref: string
  operation: 'decommission' | 'decommission_restore'
  mode: 'dry-run' | 'apply'
  outcome: string
  applied: boolean
  requiresConfirmation: boolean
  auditStatus: string
  policyResult: string
  nextAction?: string
  expectedVersion?: string
  dependencyStatus: string
  dependencySnapshot?: string
  dependencies: string[]
  recoverable: boolean
  plan?: SecretDecommissionPlan
  tombstone?: SecretTombstoneMetadata
  affectedRefs: string[]
  affectedServices: string[]
}

export type SecretRotationVersionMetadata = {
  versionId: string
  sourceId: string
  state: string
  fingerprint: string
  createdAt: string
  updatedAt: string
  stagedAt?: string
  activatedAt?: string
  retainedAt?: string
  operationId?: string
  auditStatus: string
  policyResult: string
}

export type SecretRotationVersionAction =
  | 'status'
  | 'stage'
  | 'activate'
  | 'rollback'
  | 'retire'

export type SecretRotationVersionRequest = {
  action: SecretRotationVersionAction
  ref: string
  operationId?: string
  versionId?: string
  expectedCurrentVersion?: string
  reason?: string
  value?: string
  retentionLimit?: number
}

export type SecretRotationVersionResult = {
  serviceId: string
  apiVersion: string
  requestId: string
  ref: string
  operation:
    | 'rotation_status'
    | 'rotation_stage'
    | 'rotation_activate'
    | 'rotation_rollback'
    | 'rotation_retire'
  mode: SecretRotationVersionAction
  outcome: string
  applied: boolean
  requiresConfirmation: boolean
  auditStatus: string
  policyResult: string
  nextAction?: string
  activeVersionId?: string
  previousVersionId?: string
  expectedCurrentVersion?: string
  currentVersion?: SecretRotationVersionMetadata
  stagedVersion?: SecretRotationVersionMetadata
  previousVersion?: SecretRotationVersionMetadata
  versions: SecretRotationVersionMetadata[]
  affectedRefs: string[]
  affectedServices: string[]
}

export type SecretRotationPreviewRequest = {
  ref: string
  operationId: string
  reason: string
}

export type SecretRotationPreviewResult = {
  serviceId: string
  apiVersion: string
  requestId: string
  operationId: string
  operation: 'credential_rotation'
  mode: 'dry-run'
  outcome: string
  applied: false
  requiresConfirmation: boolean
  auditStatus: string
  staleAfterSeconds: number
  nextAction?: string
  results: Array<{
    ref: string
    sourceId: string
    providerKind: string
    ownerServiceId: string
    capability: string
    capabilityResult: string
    policyResult: string
    auditRequirement: string
    risk: string
    expectedAction: string
    outcome: string
    nextAction?: string
    operationId: string
    idempotencyKey: string
  }>
  affectedRefs: string[]
  affectedServices: string[]
}

export type SecretRotationImpactServiceAction =
  | 'restart'
  | 'reload'
  | 'action'
  | 'manual'
  | 'none'

export type CoreSecretRotationImpactPlan = {
  ref: string
  planFingerprint: string
  status: 'ready' | 'blocked'
  confirmationRequired: true
  valuePolicy: 'metadata_only'
  services: Array<{
    serviceId: string
    role: 'direct' | 'dependent'
    action: SecretRotationImpactServiceAction
    actionId?: string
    reason: string
    required: boolean
    sources: string[]
    locations: string[]
    dependentsOf: string[]
    blockers: string[]
  }>
  execution: {
    stopOrder: string[]
    startOrder: string[]
    operations: Array<{
      serviceId: string
      action: 'restart' | 'reload' | 'action'
      actionId?: string
      reason: string
    }>
  }
  blockers: string[]
}

export type CoreSecretRotationExecutionRequest = {
  operationId: string
  ref: string
  planFingerprint: string
  reason: string
  confirm: true
  value: string
}

export type CoreSecretRotationExecutionState = {
  schema: 'service-lasso.secret-rotation-operation.v1'
  operationId: string
  ref: string
  planFingerprint: string
  phase:
    | 'planned'
    | 'staged'
    | 'consumers_stopped'
    | 'activated'
    | 'converging'
    | 'committed'
    | 'rolling_back'
    | 'rolled_back'
    | 'blocked'
  outcome: 'in_progress' | 'committed' | 'rolled_back' | 'blocked'
  activeVersionId: string | null
  previousVersionId: string | null
  stagedVersionId: string | null
  completedOperations: string[]
  rollbackCompletedOperations: string[]
  failureCode: string | null
  updatedAt: string
  plan: CoreSecretRotationImpactPlan
}
