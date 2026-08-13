export type ServiceStatus = 'running' | 'stopped' | 'degraded'

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
  scope: 'global' | 'service'
  secret?: boolean
  source?: string
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
  skipped: Array<{ stepId: string; reason: string }>
  message: string
}

export type FirstRunSetupStatus =
  | 'not_required'
  | 'required'
  | 'in_progress'
  | 'generated_key_pending_ack'
  | 'complete'
  | 'failed'

export type FirstRunSetupKeySource =
  | 'generated'
  | 'supplied'
  | 'os_keychain'
  | 'secret_file'
  | 'environment'
  | 'cli'
  | 'unknown'

export type FirstRunSetupState = {
  status: FirstRunSetupStatus
  required: boolean
  localOnly: boolean
  remoteAllowed: boolean
  vault: {
    id: string | null
    name: string | null
    keySource: FirstRunSetupKeySource
    keyFingerprint: string | null
    keyReveal: {
      value: string
      generatedAt: string | null
      acknowledged: boolean
    } | null
  }
  rootOwner: {
    id: string | null
    displayName: string | null
    createdAt: string | null
  }
  machine: {
    hostname: string | null
    osUser: string | null
    platform: string | null
  }
  warnings: string[]
  nextActions: string[]
  failure: {
    message: string
    at: string | null
  } | null
}

export type FirstRunSetupActionResult = {
  ok: boolean
  setup: FirstRunSetupState
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
  permission?: {
    allowed: boolean
    actor?: string
    mode?: 'local-root' | 'signed-in' | 'remote-anonymous' | 'setup'
    reason?: string
    requiresConfirmation?: boolean
    confirmationLabel?: string
  }
}

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

export type SecretRotationImpactServiceAction =
  | 'restart'
  | 'reload'
  | 'action'
  | 'manual'
  | 'none'

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

export type SecretRotationState = {
  plans: SecretRotationImpactPlan[]
  operations: SecretRotationOperation[]
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
  servicesStopped: number
  servicesDegraded: number
  networkExposureCount: number
  installedCount: number
  favorites: DashboardService[]
  others: DashboardService[]
  warnings: string[]
  problemServices: DashboardService[]
  updateNotifications: {
    latestCount: number
    availableCount: number
    downloadedCount: number
    deferredCount: number
    failedCount: number
    messages: string[]
  }
  recoveryNotifications: {
    monitorAttentionCount: number
    doctorBlockedCount: number
    hookBlockedCount: number
    restartFailureCount: number
    messages: string[]
  }
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

export type DashboardAction =
  | 'reload-runtime'
  | 'start-services'
  | { kind: 'toggle-favorite'; serviceId: string }
