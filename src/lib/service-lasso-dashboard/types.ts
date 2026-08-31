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
  pid?: number | null
  runId?: string | null
}

export type ServiceEndpoint = {
  id?: string
  kind?: string
  label: string
  direction?: string
  transport?: string
  protocol?: 'http' | 'https' | 'tcp' | 'udp' | string
  bind?: string
  port?: number
  portDefault?: number
  portStrategy?: string
  target?: string
  url?: string
  exposure?: 'local' | 'lan' | 'public' | string
  required?: boolean
  primary?: boolean
  source?: string
  health?: 'healthy' | 'warning' | 'critical' | 'unknown' | string
  readiness?: 'ready' | 'blocked' | 'unknown' | string
  resolution?: {
    status?: 'resolved' | 'failed' | 'conflict' | 'warning' | string
    message?: string
    errors?: string[]
    conflicts?: string[]
  }
  error?: string
  errors?: string[]
  conflicts?: string[]
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
    | 'config'
    | 'uninstall'
    | 'open_logs'
    | 'open_config'
    | 'open_admin'
  permission?: {
    key?: string
    allowed: boolean
    actor?: string
    mode?: 'local-root' | 'signed-in' | 'remote-anonymous' | 'setup'
    reason?: string
    requiresConfirmation?: boolean
    confirmationLabel?: string
  }
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
  updates?: ServiceUpdateState
  recovery?: ServiceRecoveryHistoryState
  setup?: ServiceSetupState
  access?: ServiceAccessState
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
  updateNotifications?: {
    latestCount: number
    availableCount: number
    downloadedCount: number
    deferredCount: number
    failedCount: number
    messages: string[]
  }
  recoveryNotifications?: {
    monitorAttentionCount: number
    doctorBlockedCount: number
    hookBlockedCount: number
    restartFailureCount: number
    messages: string[]
  }
}

export type FleetProcessTermination = 'stopped' | 'exited' | 'crashed'

export type FleetServiceMetrics = {
  serviceId: string
  running: boolean
  crashCount: number
  lastTermination: FleetProcessTermination | null
  stdoutLines: number
  stderrLines: number
}

export type RuntimeLaneClassification =
  | 'selected'
  | 'not_found'
  | 'stale'
  | 'ambiguous'
  | 'wrong_lane'
  | 'unknown_owner'

export type RuntimeGenerationPhase =
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'superseded'

export type RuntimeInstanceHome = {
  phase: RuntimeGenerationPhase | null
  activeGenerationId: string | null
  classification: RuntimeLaneClassification | null
  staleCount: number
}

export type NetworkHomeEndpoint = {
  serviceId: string
  label: string
  port: number | null
  bind: string | null
  kind: string | null
}

export type DashboardAction =
  | 'reload-runtime'
  | 'start-services'
  | 'stop-services'
  | 'restart-services'
  | {
      kind: 'toggle-favorite'
      serviceId: string
    }
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

export type OperatorInboxType =
  | 'system'
  | 'workflow'
  | 'service'
  | 'update'
  | 'security'
  | 'help'
  | 'error'

export type OperatorInboxSeverity =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'critical'

export type OperatorInboxSource =
  | 'runtime'
  | 'service'
  | 'workflow'
  | 'updater'
  | 'broker'
  | 'admin-ui'
  | 'system'

export type OperatorInboxState = 'unread' | 'read'

export type OperatorInboxVisibility = 'visible' | 'hidden'

export type OperatorInboxActionKind = 'link' | 'api' | 'command'

export type OperatorInboxActionAvailability =
  | 'available'
  | 'disabled'
  | 'expired'

export type OperatorInboxFilter =
  | 'all'
  | 'unread'
  | 'updates'
  | 'system'
  | 'workflow'
  | 'service'
  | 'errors'
  | 'hidden'

export type OperatorInboxRelatedTarget = {
  serviceId?: string
  workflowId?: string
  updateId?: string
  auditId?: string
  backupExportId?: string
  route?: string
}

export type OperatorInboxActionMetadata = {
  label: string
  target: string
  kind: OperatorInboxActionKind
  availability: OperatorInboxActionAvailability
}

export type OperatorInboxItem = {
  id: string
  dedupeKey: string
  title: string
  summary: string
  details: string | null
  type: OperatorInboxType
  severity: OperatorInboxSeverity
  source: OperatorInboxSource
  state: OperatorInboxState
  visibility: OperatorInboxVisibility
  createdAt: string
  updatedAt: string
  readAt: string | null
  hiddenAt: string | null
  relatedTarget: OperatorInboxRelatedTarget | null
  action: OperatorInboxActionMetadata | null
}

export type OperatorInboxCounts = {
  total: number
  unread: number
  read: number
  visible: number
  hidden: number
  byType: Record<OperatorInboxType, number>
  bySeverity: Record<OperatorInboxSeverity, number>
  bySource: Record<OperatorInboxSource, number>
  byFilter: Record<OperatorInboxFilter, number>
}

export type OperatorInboxListResult = {
  items: OperatorInboxItem[]
  pagination: {
    limit: number
    nextCursor: string | null
    total: number
  }
}

export type InboxQuery = {
  filter?: OperatorInboxFilter
  limit?: number
  cursor?: string
}

export type InboxListResult = {
  status: 'available' | 'unavailable'
  stubMode: boolean
  unavailableReason: string | null
  items: OperatorInboxItem[]
  pagination: OperatorInboxListResult['pagination']
}

export type InboxCountsResult = {
  status: 'available' | 'unavailable'
  stubMode: boolean
  unavailableReason: string | null
  unread: number
  counts: OperatorInboxCounts | null
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

export type BrokerProviderConfigureRequest = BrokerProviderValidationRequest & {
  confirm: boolean
  operationId: string
}

export type BrokerProviderConfigureResult = {
  serviceId: string
  apiVersion: string
  requestId: string
  operation: 'configure'
  outcome: string
  applied: boolean
  requiresConfirmation: boolean
  auditStatus: string
  nextAction?: string
  provider: BrokerProviderStatus
}

export type BrokerProviderCapabilityRecord = {
  providerKind: string
  displayName: string
  supported: boolean
  capabilities: string[]
  operations: BrokerOperationCapability[]
  limitations: string[]
}

export type BrokerProviderCapabilitiesState = {
  serviceId: string
  apiVersion: string
  contractVersion: string
  manifestVersion: string
  outcome: string
  capabilities: BrokerProviderCapabilityRecord[]
}

export type BrokerSourceStatus = {
  sourceId: string
  kind: string
  displayName: string
  enabled: boolean
  critical: boolean
  state: string
  outcome: string
  namespaces: string[]
  capabilities: string[]
  operations: BrokerOperationCapability[]
  nextAction?: string
  auditStatus: string
  retryable?: boolean
  priority?: number
}

export type BrokerSourceStatusState = {
  serviceId: string
  apiVersion: string
  contractVersion: string
  manifestVersion: string
  sources: BrokerSourceStatus[]
}

/**
 * Typed UI states for Secrets Broker provider row actions.
 */
export type BrokerProviderActionUiState =
  | 'ready'
  | 'loading'
  | 'unavailable'
  | 'setup-needed'
  | 'locked'
  | 'auth-required'
  | 'policy-denied'
  | 'unsupported'
  | 'degraded'
  | 'audit-unavailable'

/**
 * Clicked-row chrome for a provider action attempt.
 */
export type BrokerProviderActionPhase =
  | 'pending'
  | 'success'
  | 'failure'
  | 'blocked'

export type BrokerProviderRowActionName =
  | 'status'
  | 'capabilities'
  | 'validate'
  | 'reconnect'
  | 'configure-dry-run'
  | 'configure-apply'
  | 'disable'
  | 'remove'

export type BrokerProviderRowActionRequest = {
  action: BrokerProviderRowActionName
  provider: BrokerProviderStatus
  reason?: string
  confirm?: boolean
  address?: string
  credentialRef?: string
  namespaces?: string[]
}

/**
 * Safe metadata only. Never include credentials, tokens, headers, secret
 * values, env, keys, cookies, or request/response bodies.
 */
export type BrokerProviderActionResult = {
  providerId: string
  sourceId: string
  operation: BrokerProviderRowActionName
  phase: BrokerProviderActionPhase
  state: BrokerProviderActionUiState
  summary: string
  nextAction: string
  correlationId?: string
  checkedAt: string
  fixtureDemo: boolean
}

export type BrokerMigrationRequest = {
  operationId: string
  sourceProviderId: string
  targetProviderId: string
  refs: string[]
  reason: string
  /** True only after a fresh dry-run revalidation of this exact plan. */
  revalidated?: boolean
  /** Broker request id from the latest accepted dry-run. */
  planRequestId?: string
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
  /** Explicit destination for created encrypted backups. */
  destinationPolicy?: string
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
    policyDecisions: Array<{
      outcome: string
      count: number
    }>
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
  lockoutScope?: string
  retryAfterSeconds?: number
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
  ownerAction: {
    authority: 'service' | 'external'
    status: 'ready' | 'manual'
    serviceId?: string
    actionId?: string
    rollbackActionId?: string
    reason: string
    blockers: string[]
  } | null
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
  summary: {
    directConsumers: number
    dependents: number
    restart: number
    reload: number
    action: number
    manual: number
    none: number
    blockers: number
    ownerAction: number
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
  createdAt: string
  activeVersionId: string | null
  previousVersionId: string | null
  stagedVersionId: string | null
  initialRunningServiceIds: string[]
  stoppedServiceIds: string[]
  completedOperations: string[]
  rollbackCompletedOperations: string[]
  ownerActionCompleted: boolean
  ownerRollbackCompleted: boolean
  failureCode: string | null
  updatedAt: string
  plan: CoreSecretRotationImpactPlan
}

export type ServiceSetupStepStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'timeout'
  | 'skipped'

export type ServiceSetupStepRun = {
  runId: string
  serviceId: string
  stepId: string
  status: ServiceSetupStepStatus
  startedAt: string
  finishedAt: string
  durationMs: number
  command?: string
  exitCode: number | null
  signal: string | null
  message?: string
  logs?: {
    logPath?: string
    stdoutPath?: string
    stderrPath?: string
  }
}

export type ServiceSetupStep = {
  id: string
  description?: string
  rerun?: 'ifMissing' | 'manual' | 'always'
  dependOn?: string[]
  status: ServiceSetupStepStatus
  lastRun: ServiceSetupStepRun | null
  history: ServiceSetupStepRun[]
  skipReason?: string
}

export type ServiceSetupState = {
  serviceId: string
  updatedAt: string | null
  steps: ServiceSetupStep[]
}

export type ServiceSetupRunResult = {
  action: 'setup'
  serviceId: string
  ok: boolean
  setup: ServiceSetupState
  runs: ServiceSetupStepRun[]
  skipped: Array<{
    stepId: string
    reason: string
  }>
  message: string
}

export type FirstRunSetupStatus =
  | 'not_required'
  | 'setup_required'
  | 'setup_in_progress'
  | 'setup_complete'
  | 'setup_failed'
  | 'lost_key'
  | 'recreate_required'

export type FirstRunSetupState = {
  contractVersion: 'service-lasso.setup-status.v1'
  state: FirstRunSetupStatus
  setupMode: boolean
  vault: {
    required: boolean
    ready: boolean
  }
  operator: {
    osUsername: string
    identitySource: 'vault'
  }
  trustBoundary: {
    bindHost: string
    localOnly: boolean
    localhostBootstrapAllowed: boolean
    remoteBootstrapAllowed: boolean
    setupTokenConfigured: boolean
    blockers: string[]
  }
  auth: {
    actor: {
      authenticated: boolean
      kind: 'local-root' | 'zitadel' | 'local-token' | null
      actorId: string | null
    }
    mode: 'local-root' | 'zitadel' | 'local-token' | 'blocked'
    blockers: string[]
  }
}

export type FirstRunSetupActionResult = {
  bootstrap: {
    ok: true
    state: 'setup_complete'
    provisionedSecretCount: number
  }
  setup: FirstRunSetupState
}

export type ServiceLifecycleActionKind =
  | 'install'
  | 'config'
  | 'start'
  | 'stop'
  | 'restart'
  | 'reload'

export type SecurityPermissionRisk = 'low' | 'medium' | 'high' | 'critical'

export type SecurityPermissionCategory =
  | 'Runtime'
  | 'Services'
  | 'Actions'
  | 'Health / repair / validate'
  | 'Backup / restore'
  | 'Files / archive / export'
  | 'SFTP / destinations'
  | 'Broker / secrets'
  | 'Security / groups / mappings'
  | 'Audit'
  | 'System / scheduler / supervisor'

export type SecurityPermission = {
  key: string
  displayName: string
  description: string
  category: SecurityPermissionCategory
  riskLevel: SecurityPermissionRisk
  requiresConfirmation: boolean
  usedBy: string[]
}

export type SecurityGroup = {
  id: string
  name: string
  description: string
  builtIn: boolean
  ownerCapable: boolean
  elevated: boolean
  permissionKeys: string[]
  actorCount: number
  mappingCount: number
  scopeRules: string[]
  canEdit: boolean
  canReset: boolean
}

export type SecurityActorAssignment = {
  id: string
  actor: string
  groupId: string
  source: 'local' | 'provider' | 'service-account'
  self: boolean
  lastOwner: boolean
}

export type SecurityProviderMapping = {
  id: string
  provider: string
  claimType: 'group' | 'role' | 'org' | 'service-account' | string
  claimValue: string
  targetGroupId: string
  enabled: boolean
  priority: number
  conflicts: string[]
}

export type SecurityAuditLink = {
  label: string
  url: string
  count: number
}

export type SecretRotationReadinessState =
  | 'ready'
  | 'blocked'
  | 'unsupported'
  | 'requires_auth'
  | 'denied'
  | 'unavailable'

export type SecretRotationServiceImpact = {
  serviceId: string
  serviceName: string
  relation: 'direct' | 'dependent'
  action: SecretRotationImpactServiceAction
  actionLabel: string
  order: number
  rematerializeConfig: boolean
  expectedHealthChecks: string[]
  manualBlockers: string[]
  estimatedDisruption: string
  serviceHref: string
  logsHref: string
}

export type SecretRotationImpactPlan = {
  id: string
  ref: string
  planRevision: string
  provider: string
  store: string
  capabilityStatus: SecretRotationReadinessState
  authStatus: SecretRotationReadinessState
  policyStatus: SecretRotationReadinessState
  auditStatus: SecretRotationReadinessState
  contractVersion: string
  contractCompatible: boolean
  applySupported: boolean
  currentVersion: {
    id: string
    createdAt: string
    activatedAt: string
  }
  candidateVersion: {
    id: string
    createdAt: string
    stagedBy: string
  }
  services: SecretRotationServiceImpact[]
  rollbackAvailable: boolean
  rollbackReason: string
  blockedReasons: string[]
}

export type SecretRotationOperationPhase =
  | 'preflight'
  | 'staged'
  | 'activated'
  | 'rematerialising'
  | 'restarting'
  | 'reloading'
  | 'verifying'
  | 'committed'
  | 'rolling_back'
  | 'rolled_back'
  | 'failed'

export type SecretRotationOperation = {
  id: string
  planId: string
  phase: SecretRotationOperationPhase
  phaseLabel: string
  updatedAt: string
  safeNextAction: string
  rollbackAllowed: boolean
}

export type SecretBulkCampaignOperation =
  | 'rotate_reset'
  | 'update_edit'
  | 'apply_policy'
  | 'migrate_provider'
  | 'mark_action_required'

export type SecretBulkCampaignRisk = 'low' | 'medium' | 'high' | 'critical'

export type SecretBulkCampaignItem = {
  ref: string
  ownerServiceId?: string
  sourceProvider: string
  targetProvider?: string
  targetPolicy?: string
  capabilityStatus: SecretRotationReadinessState
  policyStatus: SecretRotationReadinessState
  auditStatus: SecretRotationReadinessState
  riskLevel: SecretBulkCampaignRisk
  expectedAction: string
  blockers: string[]
}

export type SecretBulkCampaignPlan = {
  id: string
  planRevision: string
  operation: SecretBulkCampaignOperation
  operationLabel: string
  generatedAt: string
  expiresAt: string
  dryRunOnly: boolean
  applySupported: boolean
  auditReasonRequired: boolean
  highRiskConfirmationRequired: boolean
  selectedCount: number
  applicableCount: number
  deniedCount: number
  unsupportedCount: number
  highRiskCount: number
  items: SecretBulkCampaignItem[]
  safeNextAction: string
}

export type SecretRotationState = {
  plans: SecretRotationImpactPlan[]
  operations: SecretRotationOperation[]
  bulkCampaigns?: SecretBulkCampaignPlan[]
}

export type ServiceSecurityState = {
  updatedAt: string
  currentActor: string
  groups: SecurityGroup[]
  permissions: SecurityPermission[]
  actorAssignments: SecurityActorAssignment[]
  providerMappings: SecurityProviderMapping[]
  auditLinks: SecurityAuditLink[]
  secretRotation?: SecretRotationState
  safety: {
    lastOwnerProtected: boolean
    selfSecurityAccessProtected: boolean
  }
}

export type SecretAccessAssignmentFinding = {
  serviceId: string
  ref: string
  namespace?: string
  status: 'present' | 'missing' | 'malformed'
  source:
    | 'env'
    | 'globalenv'
    | 'install'
    | 'config'
    | 'broker.import'
    | 'broker.export'
    | 'broker.writeback'
  location: string
  required?: boolean
  reason: string
  accessPolicy: {
    operation: 'resolve'
    status: 'allowed' | 'missing' | 'not_applicable'
    reason: string
  }
}

/**
 * One `broker.accessPolicy.grants[]` row from Core
 * `docs/reference/service-secret-access-policy.md`.
 */
export type SecretAccessPolicyOperation =
  | 'resolve'
  | 'create'
  | 'update'
  | 'rotate'
  | 'delete'

export type SecretAccessPolicyScope =
  | 'workspace'
  | 'service'
  | 'app'
  | 'shared'
  | 'global'

export type SecretAccessPolicyGrant = {
  id: string
  serviceId: string
  workspace: string | null
  namespace: string
  scope: SecretAccessPolicyScope | null
  refs: string[]
  namespaceWide: boolean
  operations: SecretAccessPolicyOperation[]
  purpose: string
}

export type SecretAccessAssignmentAudit = {
  services: Array<{
    serviceId: string
    manifestPath: string
    findings: SecretAccessAssignmentFinding[]
    summary: {
      present: number
      missing: number
      malformed: number
    }
  }>
  summary: {
    services: number
    references: number
    present: number
    missing: number
    malformed: number
  }
  grants: SecretAccessPolicyGrant[]
}

export type McpRole =
  | 'Observer'
  | 'Operator'
  | 'Maintainer'
  | 'Administrator'
  | string

export type McpTransport = 'stdio' | 'streamable-http' | 'sse' | string

export type McpExposureState = {
  loopback: boolean
  lan: boolean
  remote: boolean
}

export type McpIdentityProvider = {
  name: string
  discoveryStatus: 'available' | 'unavailable' | 'not_configured' | string
  issuer?: string | null
}

export type McpRolePermission = {
  role: McpRole
  mode: 'read-only' | 'guarded' | 'administrator' | 'denied' | string
  scopes: string[]
  deniedReason?: string | null
}

export type McpClient = {
  id: string
  name: string
  transport: McpTransport
  actor: string
  lastSeenAt: string
  remoteAddress?: string | null
}

export type McpOperation = {
  id: string
  tool: string
  actor: string
  clientId: string
  status: 'running' | 'succeeded' | 'failed' | 'cancelled' | string
  startedAt: string
  correlationId: string
}

export type McpConfirmation = {
  id: string
  actor: string
  tool: string
  target: string
  parameterSummary: string
  risk: SecurityPermissionRisk
  status: 'pending' | 'approved' | 'denied' | 'expired' | string
  expiresAt: string
  correlationId: string
  canApprove: boolean
  canDeny: boolean
}

export type McpAuditLink = {
  label: string
  url: string
  count: number
}

export type McpState = {
  updatedAt: string
  enabled: boolean
  health: 'healthy' | 'warning' | 'critical' | 'unknown' | string
  protocolVersion: string
  sdkVersion: string
  transports: McpTransport[]
  operatingMode: 'read-only' | 'guarded' | 'administrator' | string
  canonicalEndpoint: string
  stdioCommand: string
  lastSelfCheckAt: string | null
  lastError: string | null
  exposure: McpExposureState
  identityProvider: McpIdentityProvider
  allowedOrigins: string[]
  rateLimit: {
    limit: number
    windowSeconds: number
    remaining: number
  } | null
  permissions: McpRolePermission[]
  clients: McpClient[]
  operations: McpOperation[]
  confirmations: McpConfirmation[]
  auditLinks: McpAuditLink[]
}

export type ServicePermissionScope = {
  kind:
    | 'runtime'
    | 'all-services'
    | 'service'
    | 'action'
    | 'file-source'
    | 'broker-namespace'
    | 'export-destination'
    | 'backup-area'
  label: string
  serviceId?: string
  actionId?: string
  resourceId?: string
}

export type ServiceAccessGroup = {
  id: string
  name: string
  providerMappings: string[]
}

export type ServicePermissionGrant = {
  id: string
  groupId: string
  groupName: string
  permissionKey: string
  permissionLabel: string
  scope: ServicePermissionScope
  sensitive?: boolean
  elevated?: boolean
  lastChangedAt: string
  auditUrl?: string
}

export type ServiceAccessState = {
  groups: ServiceAccessGroup[]
  grants: ServicePermissionGrant[]
  lastOwnerProtected: boolean
}

export type ServiceUpdateStateKind =
  | 'installed'
  | 'available'
  | 'downloadedCandidate'
  | 'installDeferred'
  | 'failed'

export type ServiceUpdateState = {
  serviceId: string
  state: ServiceUpdateStateKind
  updatedAt: string
  lastCheck: {
    checkedAt: string
    status:
      | 'latest'
      | 'update_available'
      | 'pinned'
      | 'unavailable'
      | 'check_failed'
    reason: string
    sourceRepo: string | null
    track: string | null
    installedTag: string | null
    manifestTag: string | null
    latestTag: string | null
  } | null
  available: {
    tag: string | null
    version: string | null
    releaseUrl: string | null
    publishedAt: string | null
    assetName: string | null
    assetUrl: string | null
  } | null
  downloadedCandidate: {
    tag: string
    version: string | null
    assetName: string
    assetUrl: string
    archivePath: string
    extractedPath: string | null
    downloadedAt: string
  } | null
  installDeferred: {
    reason: string
    deferredAt: string
    nextEligibleAt: string | null
  } | null
  failed: {
    reason: string
    failedAt: string
    sourceStatus: string | null
  } | null
}

export type ServiceUpdateAction = 'check' | 'download' | 'install'

export type ServiceRecoveryEventKind = 'monitor' | 'doctor' | 'restart' | 'hook'

export type ServiceRecoveryStepResult = {
  phase?: string
  name: string
  command: string
  ok: boolean
  exitCode: number | null
  timedOut: boolean
  failurePolicy: string
  stdout: string
  stderr: string
  startedAt: string
  finishedAt: string
}

export type ServiceRecoveryEvent = {
  kind: ServiceRecoveryEventKind
  serviceId: string
  action?: 'restart' | 'skip' | 'healthy'
  reason?: string
  phase?: string
  ok?: boolean
  blocked?: boolean
  message?: string
  steps?: ServiceRecoveryStepResult[]
  at: string
}

export type ServiceRecoveryHistoryState = {
  serviceId: string
  updatedAt: string
  events: ServiceRecoveryEvent[]
}

export type ServiceRecoveryDoctorActionResult = {
  serviceId: string
  doctor: {
    ok: boolean
    blocked: boolean
    steps: ServiceRecoveryStepResult[]
  }
  recovery: ServiceRecoveryHistoryState
}

export type InboxMessageCategory = 'update' | 'system' | 'workflow' | 'error'

export type InboxMessageSeverity = 'info' | 'warning' | 'critical'

export type InboxMessageActionKind =
  | 'open_service'
  | 'open_logs'
  | 'open_workflow'
  | 'open_update'
  | 'retry'
  | 'view_audit'
  | 'mark_read'
  | 'mark_unread'
  | 'hide'

export type InboxMessageAction = {
  id: string
  label: string
  kind: InboxMessageActionKind
  target?: string
  disabled?: boolean
  reason?: string
}

export type InboxMessageTarget = {
  label: string
  href: string
  kind: 'service' | 'logs' | 'workflow' | 'update' | 'audit'
}

export type InboxMessage = {
  id: string
  title: string
  summary: string
  details: string
  category: InboxMessageCategory
  severity: InboxMessageSeverity
  createdAt: string
  read: boolean
  hidden: boolean
  target?: InboxMessageTarget
  actions: InboxMessageAction[]
}

export type InboxSummary = {
  messages: InboxMessage[]
  counts: {
    total: number
    unread: number
    updates: number
    system: number
    workflow: number
    errors: number
    hidden: number
  }
  updatedAt: string
}

export type InboxMessageActionResult = {
  ok: boolean
  message: InboxMessage
  inbox: InboxSummary
}
