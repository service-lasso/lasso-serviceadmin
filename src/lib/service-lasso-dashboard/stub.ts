import {
  containsUnsafeBrokerText,
  requireSafeBrokerIdentifier,
  sanitizeBrokerDisplayText,
  validateBrokerSearchInput,
  withheldBrokerText,
} from './secrets-safe-text'
import type {
  BrokerBulkCampaignItem,
  BrokerBulkCampaignRequest,
  BrokerBulkCampaignResult,
  BrokerEventFilters,
  BrokerEventsResult,
  BrokerLockoutClearRequest,
  BrokerLockoutClearResult,
  BrokerMigrationItem,
  BrokerMigrationRequest,
  BrokerMigrationResult,
  BrokerLifecycleBackup,
  BrokerLifecycleBackupResult,
  BrokerLifecycleOperationRequest,
  BrokerLifecycleRestoreResult,
  BrokerLifecycleRotateResult,
  BrokerLifecycleStatus,
  BrokerOperationCapability,
  BrokerProviderStatus,
  BrokerProviderStatusState,
  BrokerProviderValidationRequest,
  BrokerProviderValidationResult,
  BrokerTelemetry,
  DashboardAction,
  DashboardService,
  DashboardSummary,
  FirstRunSetupActionResult,
  FirstRunSetupState,
  FirstRunSetupStatus,
  InboxMessage,
  InboxMessageActionKind,
  InboxMessageActionResult,
  InboxSummary,
  McpState,
  ServiceSecurityState,
  ServiceRecoveryDoctorActionResult,
  ServiceRecoveryHistoryState,
  SecretDecommissionPlan,
  SecretDecommissionRequest,
  SecretDecommissionResult,
  SecretCreatePlan,
  SecretCreateRequest,
  SecretCreateResult,
  SecretMutationRequest,
  SecretMutationResult,
  SecretPolicyPreviewRequest,
  SecretPolicyPreviewResult,
  SecretRevealRequest,
  SecretRevealResult,
  SecretRotationPreviewRequest,
  SecretRotationPreviewResult,
  CoreSecretRotationImpactPlan,
  CoreSecretRotationExecutionRequest,
  CoreSecretRotationExecutionState,
  SecretRotationVersionMetadata,
  SecretRotationVersionRequest,
  SecretRotationVersionResult,
  SecretsManagementState,
  ServiceSetupRunResult,
  ServiceSetupState,
  ServiceSetupStep,
  ServiceSetupStepRun,
  ServiceAction,
  ServiceLifecycleActionKind,
  ServiceUpdateAction,
  ServiceUpdateState,
} from './types'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type RuntimeApiEnvironment = {
  DEV?: boolean
  VITE_SERVICE_LASSO_API_BASE_URL?: string
  VITE_SERVICE_LASSO_ENABLE_STUB_DATA?: string
}

export type RuntimeApiMode = 'local-dev' | 'packaged-runtime'

export type RuntimeApiUnavailableDetails = {
  mode: RuntimeApiMode
  path: string
  endpoint: string | null
  status: number | null
  contentType: string | null
  packagedProxyConfigured: boolean
  reason: 'missing_api_base_url' | 'fetch_failed' | 'http_error' | 'non_json'
  errorCode?: string | null
}

export class RuntimeApiUnavailableError extends Error {
  readonly details: RuntimeApiUnavailableDetails

  constructor(details: RuntimeApiUnavailableDetails, cause?: unknown) {
    const endpoint = details.endpoint ?? details.path
    const metadata = [
      `path ${details.path}`,
      details.status == null ? null : `status ${details.status}`,
      details.errorCode ? `code ${details.errorCode}` : null,
      details.contentType ? `content-type ${details.contentType}` : null,
    ]
      .filter(Boolean)
      .join(', ')
    super(
      `Service Lasso runtime API unavailable for ${endpoint}: ${details.reason}${
        metadata ? ` (${metadata})` : ''
      }.`
    )
    this.name = 'RuntimeApiUnavailableError'
    this.details = details
    if (cause) {
      Object.defineProperty(this, 'cause', {
        value: cause,
        configurable: true,
        writable: true,
      })
    }
  }
}

export function resolveRuntimeApiMode(
  env: RuntimeApiEnvironment = import.meta.env
): RuntimeApiMode {
  return env.DEV ? 'local-dev' : 'packaged-runtime'
}

export function resolveServiceLassoApiBaseUrl(
  env: RuntimeApiEnvironment = import.meta.env
) {
  const configured = env.VITE_SERVICE_LASSO_API_BASE_URL?.replace(/\/$/, '')
  if (configured) return configured
  return resolveRuntimeApiMode(env) === 'packaged-runtime' ? '' : null
}

export function isServiceLassoStubDataEnabled(
  env: RuntimeApiEnvironment = import.meta.env
) {
  return (
    resolveRuntimeApiMode(env) === 'local-dev' &&
    env.VITE_SERVICE_LASSO_ENABLE_STUB_DATA === 'true'
  )
}

export const serviceLassoApiBaseUrl = resolveServiceLassoApiBaseUrl()

export const serviceLassoStubDataEnabled = isServiceLassoStubDataEnabled()

export const favoritesFeatureEnabled =
  import.meta.env.VITE_SERVICE_LASSO_FAVORITES_ENABLED === 'true'

export const favoritesMutationEnabled =
  favoritesFeatureEnabled && serviceLassoApiBaseUrl !== null

type RemoteServiceMeta = {
  id: string
  name?: string
  favorite?: boolean
  imageUrl?: string
}

type RemoteServiceUpdate = {
  serviceId: string
  update: ServiceUpdateState
}

type RemoteServiceRecovery = {
  serviceId: string
  recovery: ServiceRecoveryHistoryState
}

let inboxMessages: InboxMessage[] = [
  {
    id: 'update-service-admin-2-3',
    title: 'Service Admin update downloaded',
    summary: 'Version 2.3.0 is staged and ready for review.',
    details:
      'The runtime downloaded the Service Admin 2.3.0 candidate. Review the changelog, then install during an operator-approved maintenance window.',
    category: 'update',
    severity: 'info',
    createdAt: '2026-07-24T00:18:00Z',
    read: false,
    hidden: false,
    target: {
      label: 'Service Admin UI',
      href: '/services/service-admin',
      kind: 'service',
    },
    actions: [
      {
        id: 'open-update-service-admin',
        label: 'Open Update',
        kind: 'open_update',
        target: '/services/service-admin',
      },
      {
        id: 'mark-update-read',
        label: 'Mark Read',
        kind: 'mark_read',
      },
      {
        id: 'hide-update',
        label: 'Hide',
        kind: 'hide',
      },
    ],
  },
  {
    id: 'workflow-backup-deferred',
    title: 'Backup workflow waiting for approval',
    summary: 'Nightly backup export is paused until the target is confirmed.',
    details:
      'The workflow runner prepared the backup plan but paused before export because the destination requires a fresh approval.',
    category: 'workflow',
    severity: 'warning',
    createdAt: '2026-07-23T22:42:00Z',
    read: false,
    hidden: false,
    target: {
      label: 'Backup workflow',
      href: '/logs?service=dagu',
      kind: 'workflow',
    },
    actions: [
      {
        id: 'open-workflow-backup',
        label: 'Open Workflow',
        kind: 'open_workflow',
        target: '/logs?service=dagu',
      },
      {
        id: 'view-backup-audit',
        label: 'View Audit',
        kind: 'view_audit',
        target: '/logs?service=dagu',
      },
    ],
  },
  {
    id: 'system-runtime-reloaded',
    title: 'Runtime configuration reloaded',
    summary: 'Canonical services root changed and dashboard data refreshed.',
    details:
      'Service Lasso reloaded manifests from the canonical services root and refreshed dashboard service metadata.',
    category: 'system',
    severity: 'info',
    createdAt: '2026-07-23T21:10:00Z',
    read: true,
    hidden: false,
    actions: [
      {
        id: 'mark-runtime-unread',
        label: 'Mark Unread',
        kind: 'mark_unread',
      },
    ],
  },
  {
    id: 'error-zitadel-health',
    title: 'Zitadel readiness probe failed',
    summary: 'OIDC discovery exceeded the configured latency budget.',
    details:
      'The latest health check marked the Zitadel discovery endpoint as critical. Open logs before retrying the probe.',
    category: 'error',
    severity: 'critical',
    createdAt: '2026-07-23T19:35:00Z',
    read: false,
    hidden: false,
    target: {
      label: 'Zitadel logs',
      href: '/logs?service=zitadel',
      kind: 'logs',
    },
    actions: [
      {
        id: 'open-zitadel-logs',
        label: 'Open Logs',
        kind: 'open_logs',
        target: '/logs?service=zitadel',
      },
      {
        id: 'retry-zitadel-health',
        label: 'Retry',
        kind: 'retry',
        disabled: true,
        reason:
          'Runtime retry endpoint is pending service-lasso/service-lasso#833.',
      },
    ],
  },
]

const firstRunSetupStatuses = new Set<FirstRunSetupStatus>([
  'not_required',
  'setup_required',
  'setup_in_progress',
  'setup_complete',
  'setup_failed',
])

function createDefaultFirstRunSetupState(): FirstRunSetupState {
  return {
    contractVersion: 'service-lasso.setup-status.v1',
    state: 'not_required',
    setupMode: false,
    vault: {
      required: true,
      ready: true,
    },
    operator: {
      osUsername: 'local-operator',
      identitySource: 'vault',
    },
    trustBoundary: {
      bindHost: '127.0.0.1',
      localOnly: true,
      localhostBootstrapAllowed: false,
      remoteBootstrapAllowed: false,
      setupTokenConfigured: false,
      blockers: [],
    },
    auth: {
      actor: {
        authenticated: true,
        kind: 'local-root',
        actorId: 'local-root',
      },
      mode: 'local-root',
      blockers: [],
    },
  }
}

let firstRunSetupFixture = createDefaultFirstRunSetupState()

const secretsBrokerServiceId = '@secretsbroker'

const secretsManagementFixture: SecretsManagementState = {
  serviceId: secretsBrokerServiceId,
  apiVersion: 'secretsbroker.local/v1',
  query: '',
  valueSearch: false,
  outcome: 'ready',
  results: [
    {
      ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
      name: 'SESSION_SIGNING_KEY',
      sourceId: 'local',
      providerKind: 'local-encrypted-store',
      ownerServiceId: '@serviceadmin',
      workspaceId: 'local',
      state: 'present',
      outcome: 'ready',
      capabilities: [
        'metadata',
        'reveal',
        'edit',
        'reset',
        'rotation',
        'decommission',
        'policy',
      ],
      policy: 'local-writeback-policy',
      auditStatus: 'audit_available',
      valueSearch: 'supported',
    },
    {
      ref: 'zitadel/traefik-oidc-auth/client-secret',
      name: 'client-secret',
      sourceId: 'vault-auth',
      providerKind: 'vault',
      ownerServiceId: '@traefik',
      workspaceId: 'local',
      state: 'auth_required',
      outcome: 'source_auth_required',
      capabilities: ['metadata'],
      policy: 'provider-policy',
      auditStatus: 'audit_unavailable',
      valueSearch: 'unsupported',
    },
    {
      ref: 'services/archive/runtime/RECOVERABLE_TOKEN',
      name: 'RECOVERABLE_TOKEN',
      sourceId: 'local',
      providerKind: 'local-encrypted-store',
      ownerServiceId: 'archive',
      workspaceId: 'local',
      state: 'decommissioned',
      outcome: 'decommissioned',
      capabilities: ['metadata', 'restore'],
      policy: 'local-writeback-policy',
      auditStatus: 'audit_available',
      valueSearch: 'unavailable',
      tombstone: {
        state: 'decommissioned',
        version: 'stub-tombstone-version-1',
        decommissionOperationId: 'stub-decommission-recoverable',
        decommissionedAt: '2026-08-14T00:00:00.000Z',
      },
    },
  ],
}

const brokerProviderStatusFixture: BrokerProviderStatusState = {
  serviceId: secretsBrokerServiceId,
  apiVersion: 'secretsbroker.local/v1',
  contractVersion: '1.0.0',
  manifestVersion: '1.0.0',
  outcome: 'ready',
  currentProvider: {
    providerId: 'local',
    providerKind: 'local-encrypted-store',
    displayName: 'Local encrypted store',
    state: 'ready',
    outcome: 'ready',
    credentialHandle: 'local-master-key',
    namespaces: ['services'],
    capabilities: ['read', 'migration_source'],
    operations: [],
    auditStatus: 'audit_available',
  },
  providers: [
    {
      providerId: 'local',
      providerKind: 'local-encrypted-store',
      displayName: 'Local encrypted store',
      state: 'ready',
      outcome: 'ready',
      credentialHandle: 'local-master-key',
      namespaces: ['services'],
      capabilities: ['read', 'migration_source'],
      operations: [],
      auditStatus: 'audit_available',
    },
    {
      providerId: 'vault-target',
      providerKind: 'vault',
      displayName: 'Vault migration target',
      state: 'ready',
      outcome: 'ready',
      credentialHandle: 'configured-ref-or-env',
      address: 'https://vault.example.invalid',
      namespaces: ['services'],
      capabilities: ['read', 'migration'],
      operations: [
        {
          operationId: 'post_v1_providers_migration_apply',
          method: 'POST',
          path: '/v1/providers/migration/apply',
          maturity: 'validated',
          classification: 'mutation',
          authenticationRequired: true,
          policyRequired: true,
          auditRequired: true,
          scope: 'provider-remote',
          completionMode: 'synchronous',
          limitationCode: 'runtime_auth_policy_audit_revalidated',
          reasonCode: 'validated',
          nextAction: 'execute_guarded_operation',
        },
      ],
      auditStatus: 'audit_available',
    },
  ],
}

function createEmptyUpdateState(serviceId: string): ServiceUpdateState {
  return {
    serviceId,
    state: 'installed',
    updatedAt: new Date('2026-04-11T10:00:00+10:00').toISOString(),
    lastCheck: {
      checkedAt: new Date('2026-04-11T10:00:00+10:00').toISOString(),
      status: 'latest',
      reason: 'No newer update has been reported.',
      sourceRepo: null,
      track: null,
      installedTag: null,
      manifestTag: null,
      latestTag: null,
    },
    available: null,
    downloadedCandidate: null,
    installDeferred: null,
    failed: null,
  }
}

function createEmptyRecoveryState(
  serviceId: string
): ServiceRecoveryHistoryState {
  return {
    serviceId,
    updatedAt: new Date('2026-04-11T10:00:00+10:00').toISOString(),
    events: [],
  }
}

const securityState: ServiceSecurityState = {
  updatedAt: new Date('2026-04-11T10:20:00+10:00').toISOString(),
  currentActor: 'local-root',
  safety: {
    lastOwnerProtected: true,
    selfSecurityAccessProtected: true,
  },
  groups: [
    {
      id: 'owners',
      name: 'Owners',
      description: 'Full Service Lasso administration with recovery access.',
      builtIn: true,
      ownerCapable: true,
      elevated: true,
      permissionKeys: [
        'runtime.manage',
        'services.manage',
        'security.manage',
        'backup.restore',
      ],
      actorCount: 1,
      mappingCount: 1,
      scopeRules: ['all-services', 'all-runtimes'],
      canEdit: false,
      canReset: true,
    },
    {
      id: 'operators',
      name: 'Operators',
      description: 'Day-to-day service operation without security ownership.',
      builtIn: true,
      ownerCapable: false,
      elevated: false,
      permissionKeys: [
        'services.read',
        'actions.run',
        'health.repair',
        'logs.read',
      ],
      actorCount: 3,
      mappingCount: 2,
      scopeRules: ['profile:default'],
      canEdit: false,
      canReset: true,
    },
    {
      id: 'backup-maintainers',
      name: 'Backup maintainers',
      description: 'Custom group for backup review and restore preparation.',
      builtIn: false,
      ownerCapable: false,
      elevated: true,
      permissionKeys: ['backup.read', 'backup.restore', 'audit.read'],
      actorCount: 2,
      mappingCount: 1,
      scopeRules: ['service:secrets-broker', 'service:service-admin'],
      canEdit: true,
      canReset: false,
    },
  ],
  permissions: [
    {
      key: 'runtime.manage',
      displayName: 'Manage runtime',
      description: 'Reload and repair the Service Lasso runtime supervisor.',
      category: 'Runtime',
      riskLevel: 'critical',
      requiresConfirmation: true,
      usedBy: ['Runtime reload', 'Demo gate recovery'],
    },
    {
      key: 'services.manage',
      displayName: 'Manage services',
      description: 'Install, stop, start, and restart managed services.',
      category: 'Services',
      riskLevel: 'high',
      requiresConfirmation: true,
      usedBy: ['Service actions', 'Setup reruns'],
    },
    {
      key: 'security.manage',
      displayName: 'Manage security',
      description: 'Change groups, permissions, and provider mappings.',
      category: 'Security / groups / mappings',
      riskLevel: 'critical',
      requiresConfirmation: true,
      usedBy: ['Group edit', 'Provider mapping edit'],
    },
    {
      key: 'actions.run',
      displayName: 'Run actions',
      description: 'Execute declared service actions from the admin UI.',
      category: 'Actions',
      riskLevel: 'medium',
      requiresConfirmation: false,
      usedBy: ['Restart router', 'Reload UI'],
    },
    {
      key: 'health.repair',
      displayName: 'Repair health',
      description: 'Run doctor and recovery steps for unhealthy services.',
      category: 'Health / repair / validate',
      riskLevel: 'high',
      requiresConfirmation: true,
      usedBy: ['Recovery doctor'],
    },
    {
      key: 'backup.restore',
      displayName: 'Restore backups',
      description: 'Prepare and execute restore flows for backed-up services.',
      category: 'Backup / restore',
      riskLevel: 'critical',
      requiresConfirmation: true,
      usedBy: ['Restore service data'],
    },
    {
      key: 'audit.read',
      displayName: 'Read audit trail',
      description: 'Inspect security and service action history.',
      category: 'Audit',
      riskLevel: 'low',
      requiresConfirmation: false,
      usedBy: ['Security history', 'Action history'],
    },
    {
      key: 'logs.read',
      displayName: 'Read logs',
      description: 'View service logs and runtime diagnostics.',
      category: 'System / scheduler / supervisor',
      riskLevel: 'low',
      requiresConfirmation: false,
      usedBy: ['Logs'],
    },
    {
      key: 'backup.read',
      displayName: 'Read backup metadata',
      description: 'Inspect backup manifests and restore points.',
      category: 'Files / archive / export',
      riskLevel: 'medium',
      requiresConfirmation: false,
      usedBy: ['Backup inventory'],
    },
  ],
  actorAssignments: [
    {
      id: 'local-root-owner',
      actor: 'local-root',
      groupId: 'owners',
      source: 'local',
      self: true,
      lastOwner: true,
    },
    {
      id: 'ops-provider-group',
      actor: 'zitadel:service-lasso-operators',
      groupId: 'operators',
      source: 'provider',
      self: false,
      lastOwner: false,
    },
    {
      id: 'backup-service-account',
      actor: 'service-account:backup-runner',
      groupId: 'backup-maintainers',
      source: 'service-account',
      self: false,
      lastOwner: false,
    },
  ],
  providerMappings: [
    {
      id: 'zitadel-owners',
      provider: 'Zitadel',
      claimType: 'role',
      claimValue: 'service-lasso-owner',
      targetGroupId: 'owners',
      enabled: true,
      priority: 10,
      conflicts: [],
    },
    {
      id: 'zitadel-operators',
      provider: 'Zitadel',
      claimType: 'group',
      claimValue: 'service-lasso-operators',
      targetGroupId: 'operators',
      enabled: true,
      priority: 20,
      conflicts: [],
    },
    {
      id: 'oidc-backup-maintainers',
      provider: 'Generic OIDC',
      claimType: 'service-account',
      claimValue: 'backup-runner',
      targetGroupId: 'backup-maintainers',
      enabled: false,
      priority: 30,
      conflicts: ['Disabled until restore approval workflow is enabled.'],
    },
  ],
  auditLinks: [
    { label: 'Security changes', url: '/logs?source=security', count: 18 },
    { label: 'Denied actions', url: '/logs?source=denied', count: 4 },
  ],
  secretRotation: {
    plans: [
      {
        id: 'plan-router-cert-2026-04',
        ref: 'secrets/router/tls-cert',
        planRevision: 'rev-2026-04-11T10-18Z',
        provider: 'Local vault',
        store: 'service-lasso-default',
        capabilityStatus: 'ready',
        authStatus: 'ready',
        policyStatus: 'ready',
        auditStatus: 'ready',
        contractVersion: 'rotation-plan.v1',
        contractCompatible: true,
        applySupported: true,
        currentVersion: {
          id: 'ver-router-cert-11',
          createdAt: new Date('2026-04-03T08:12:00+10:00').toISOString(),
          activatedAt: new Date('2026-04-03T08:15:00+10:00').toISOString(),
        },
        candidateVersion: {
          id: 'ver-router-cert-12',
          createdAt: new Date('2026-04-11T10:16:00+10:00').toISOString(),
          stagedBy: 'local-root',
        },
        services: [
          {
            serviceId: 'traefik',
            serviceName: 'Traefik',
            relation: 'direct',
            action: 'restart',
            actionLabel: 'Restart edge router',
            order: 20,
            rematerializeConfig: true,
            expectedHealthChecks: ['HTTP route table', 'TLS listener'],
            manualBlockers: [],
            estimatedDisruption: 'under 10 seconds',
            serviceHref: '/services/traefik',
            logsHref: '/logs?service=traefik',
          },
          {
            serviceId: 'service-admin',
            serviceName: 'Service Admin UI',
            relation: 'dependent',
            action: 'reload',
            actionLabel: 'Reload runtime metadata',
            order: 30,
            rematerializeConfig: false,
            expectedHealthChecks: ['Service Admin root', 'Dashboard API'],
            manualBlockers: [],
            estimatedDisruption: 'none expected',
            serviceHref: '/services/service-admin',
            logsHref: '/logs?service=service-admin',
          },
        ],
        rollbackAvailable: true,
        rollbackReason: 'Previous local version remains staged until commit.',
        blockedReasons: [],
      },
      {
        id: 'plan-remote-provider',
        ref: 'secrets/provider/oauth-client',
        planRevision: 'rev-remote-provider-disabled',
        provider: 'Remote provider',
        store: 'provider:acme-cloud',
        capabilityStatus: 'unsupported',
        authStatus: 'requires_auth',
        policyStatus: 'blocked',
        auditStatus: 'ready',
        contractVersion: 'rotation-plan.v1',
        contractCompatible: true,
        applySupported: false,
        currentVersion: {
          id: 'remote-client-active',
          createdAt: new Date('2026-03-22T12:00:00+10:00').toISOString(),
          activatedAt: new Date('2026-03-22T12:02:00+10:00').toISOString(),
        },
        candidateVersion: {
          id: 'remote-client-candidate',
          createdAt: new Date('2026-04-11T09:50:00+10:00').toISOString(),
          stagedBy: 'provider-sync',
        },
        services: [
          {
            serviceId: 'zitadel',
            serviceName: 'Zitadel',
            relation: 'direct',
            action: 'manual',
            actionLabel: 'Manual provider rotation',
            order: 10,
            rematerializeConfig: true,
            expectedHealthChecks: ['OIDC discovery', 'Token exchange'],
            manualBlockers: ['Remote provider execution is not advertised.'],
            estimatedDisruption: 'requires operator window',
            serviceHref: '/services/zitadel',
            logsHref: '/logs?service=zitadel',
          },
        ],
        rollbackAvailable: false,
        rollbackReason: 'Remote provider has not advertised rollback support.',
        blockedReasons: [
          'Remote-provider rotations remain disabled until executable capability is advertised.',
        ],
      },
    ],
    operations: [
      {
        id: 'op-router-cert-rotation',
        planId: 'plan-router-cert-2026-04',
        phase: 'verifying',
        phaseLabel: 'Verifying linked service health',
        updatedAt: new Date('2026-04-11T10:19:30+10:00').toISOString(),
        safeNextAction:
          'Wait for core operation status before committing or rolling back.',
        rollbackAllowed: true,
      },
    ],
    bulkCampaigns: [
      {
        id: 'bulk-campaign-runtime-keys-stage-1',
        planRevision: 'bulk-dry-run-2026-04-11T10-24Z',
        operation: 'rotate_reset',
        operationLabel: 'Bulk rotate/reset',
        generatedAt: new Date('2026-04-11T10:24:00+10:00').toISOString(),
        expiresAt: new Date('2026-04-11T10:39:00+10:00').toISOString(),
        dryRunOnly: true,
        applySupported: false,
        auditReasonRequired: true,
        highRiskConfirmationRequired: true,
        selectedCount: 3,
        applicableCount: 1,
        deniedCount: 1,
        unsupportedCount: 1,
        highRiskCount: 1,
        safeNextAction:
          'Review the broker-backed dry run, resolve denied and unsupported refs, then regenerate the plan before any apply path is enabled.',
        items: [
          {
            ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
            ownerServiceId: '@serviceadmin',
            sourceProvider: 'local-encrypted-store',
            targetPolicy: 'local-writeback-policy',
            capabilityStatus: 'ready',
            policyStatus: 'ready',
            auditStatus: 'ready',
            riskLevel: 'high',
            expectedAction:
              'Broker would stage a reset candidate and rematerialise dependent runtime metadata.',
            blockers: [],
          },
          {
            ref: 'zitadel/traefik-oidc-auth/client-secret',
            ownerServiceId: '@traefik',
            sourceProvider: 'vault',
            targetProvider: 'provider:acme-cloud',
            targetPolicy: 'provider-policy',
            capabilityStatus: 'requires_auth',
            policyStatus: 'denied',
            auditStatus: 'ready',
            riskLevel: 'critical',
            expectedAction:
              'Provider auth and policy review are required before rotation can be planned.',
            blockers: ['Provider authentication required.', 'Policy denied.'],
          },
          {
            ref: 'services/echo-service/env/API_TOKEN',
            ownerServiceId: 'echo-service',
            sourceProvider: 'legacy-env-file',
            targetPolicy: 'managed-secrets-policy',
            capabilityStatus: 'unsupported',
            policyStatus: 'blocked',
            auditStatus: 'unavailable',
            riskLevel: 'medium',
            expectedAction:
              'Legacy environment refs must be migrated into broker metadata before campaign planning.',
            blockers: ['Provider does not advertise bulk reset support.'],
          },
        ],
      },
    ],
  },
}

const mcpState: McpState = {
  updatedAt: new Date('2026-04-11T10:28:00+10:00').toISOString(),
  enabled: true,
  health: 'warning',
  protocolVersion: '2025-06-18',
  sdkVersion: 'service-lasso-mcp 0.4.0',
  transports: ['stdio', 'streamable-http'],
  operatingMode: 'guarded',
  canonicalEndpoint: 'http://127.0.0.1:17883/mcp',
  stdioCommand: 'service-lasso mcp serve --transport stdio',
  lastSelfCheckAt: new Date('2026-04-11T10:27:40+10:00').toISOString(),
  lastError: 'Remote transport requires explicit operator enablement.',
  exposure: {
    loopback: true,
    lan: false,
    remote: false,
  },
  identityProvider: {
    name: 'Zitadel',
    discoveryStatus: 'available',
    issuer: 'https://identity.service-lasso.local',
  },
  allowedOrigins: ['http://127.0.0.1:17700', 'http://localhost:17700'],
  rateLimit: {
    limit: 120,
    windowSeconds: 60,
    remaining: 84,
  },
  permissions: [
    {
      role: 'Observer',
      mode: 'read-only',
      scopes: ['mcp.read', 'audit.read'],
    },
    {
      role: 'Operator',
      mode: 'guarded',
      scopes: ['mcp.read', 'mcp.actions.request', 'audit.read'],
    },
    {
      role: 'Maintainer',
      mode: 'guarded',
      scopes: [
        'mcp.read',
        'mcp.actions.request',
        'mcp.confirmations.resolve',
        'audit.read',
      ],
    },
    {
      role: 'Administrator',
      mode: 'administrator',
      scopes: [
        'mcp.read',
        'mcp.configure',
        'mcp.confirmations.resolve',
        'security.manage',
        'audit.read',
      ],
    },
  ],
  clients: [
    {
      id: 'client-inspector-local',
      name: 'MCP Inspector',
      transport: 'streamable-http',
      actor: 'local-root',
      lastSeenAt: new Date('2026-04-11T10:26:12+10:00').toISOString(),
      remoteAddress: '127.0.0.1',
    },
    {
      id: 'client-cli-stdio',
      name: 'Service Lasso CLI',
      transport: 'stdio',
      actor: 'service-account:mcp-cli',
      lastSeenAt: new Date('2026-04-11T10:18:35+10:00').toISOString(),
      remoteAddress: null,
    },
  ],
  operations: [
    {
      id: 'op-health-sweep',
      tool: 'service.health.list',
      actor: 'local-root',
      clientId: 'client-inspector-local',
      status: 'succeeded',
      startedAt: new Date('2026-04-11T10:24:02+10:00').toISOString(),
      correlationId: 'corr-mcp-health-sweep',
    },
    {
      id: 'op-service-restart',
      tool: 'service.restart',
      actor: 'service-account:mcp-cli',
      clientId: 'client-cli-stdio',
      status: 'running',
      startedAt: new Date('2026-04-11T10:27:15+10:00').toISOString(),
      correlationId: 'corr-mcp-restart-review',
    },
  ],
  confirmations: [
    {
      id: 'confirm-router-restart',
      actor: 'service-account:mcp-cli',
      tool: 'service.restart',
      target: 'traefik',
      parameterSummary: 'Restart request for the Traefik service only.',
      risk: 'high',
      status: 'pending',
      expiresAt: new Date('2026-04-11T10:37:15+10:00').toISOString(),
      correlationId: 'corr-mcp-restart-review',
      canApprove: true,
      canDeny: true,
    },
  ],
  auditLinks: [
    { label: 'MCP tool calls', url: '/logs?source=mcp', count: 21 },
    { label: 'MCP denials', url: '/logs?source=mcp&outcome=denied', count: 3 },
    {
      label: 'MCP confirmations',
      url: '/logs?source=mcp&event=confirmation',
      count: 5,
    },
  ],
}

async function fetchRemoteServiceMeta(): Promise<RemoteServiceMeta[] | null> {
  if (serviceLassoApiBaseUrl === null) return null

  try {
    const payload = await fetchRuntimeJson<{
      services?: RemoteServiceMeta[]
    }>('/api/services/meta')

    return payload.services ?? []
  } catch {
    return null
  }
}

async function fetchRemoteUpdateStates(): Promise<
  RemoteServiceUpdate[] | null
> {
  if (serviceLassoApiBaseUrl === null) return null

  try {
    const payload = await fetchRuntimeJson<{
      services?: RemoteServiceUpdate[]
    }>('/api/updates')

    return payload.services ?? []
  } catch {
    return null
  }
}

async function fetchRemoteRecoveryStates(): Promise<
  RemoteServiceRecovery[] | null
> {
  if (serviceLassoApiBaseUrl === null) return null

  try {
    const payload = await fetchRuntimeJson<{
      services?: RemoteServiceRecovery[]
    }>('/api/recovery')

    return payload.services ?? []
  } catch {
    return null
  }
}

function applyRemoteServiceMeta(serviceMeta: RemoteServiceMeta[]) {
  if (serviceMeta.length === 0) return

  const remoteMetaById = new Map(
    serviceMeta.map((service) => [service.id, service])
  )

  services = services.map((service) => {
    const remoteMeta = remoteMetaById.get(service.id)
    if (!remoteMeta) return service

    return {
      ...service,
      favorite:
        remoteMeta.favorite === undefined
          ? service.favorite
          : Boolean(remoteMeta.favorite),
      metadata: {
        ...service.metadata,
        imageUrl: remoteMeta.imageUrl ?? service.metadata.imageUrl,
      },
    }
  })
}

export function applyRemoteUpdateStates(updateStates: RemoteServiceUpdate[]) {
  if (updateStates.length === 0) return

  const updateById = new Map(
    updateStates.map((service) => [service.serviceId, service.update])
  )

  services = services.map((service) => ({
    ...service,
    updates: updateById.get(service.id) ?? service.updates,
  }))
}

export function applyRemoteRecoveryStates(
  recoveryStates: RemoteServiceRecovery[]
) {
  if (recoveryStates.length === 0) return

  const recoveryById = new Map(
    recoveryStates.map((service) => [service.serviceId, service.recovery])
  )

  services = services.map((service) => ({
    ...service,
    recovery: recoveryById.get(service.id) ?? service.recovery,
  }))
}

async function syncRemoteStateFromApi() {
  const [remoteServiceMeta, remoteUpdateStates, remoteRecoveryStates] =
    await Promise.all([
      fetchRemoteServiceMeta(),
      fetchRemoteUpdateStates(),
      fetchRemoteRecoveryStates(),
    ])
  if (remoteServiceMeta) {
    applyRemoteServiceMeta(remoteServiceMeta)
  }
  if (remoteUpdateStates) {
    applyRemoteUpdateStates(remoteUpdateStates)
  }
  if (remoteRecoveryStates) {
    applyRemoteRecoveryStates(remoteRecoveryStates)
  }
}

let services: DashboardService[] = [
  {
    id: 'traefik',
    name: 'Traefik',
    status: 'running',
    favorite: true,
    role: 'Edge router and ingress controller',
    note: 'Primary edge router is healthy.',
    installed: true,
    links: [
      { label: 'Local', url: 'http://localhost:8080', kind: 'local' },
      { label: 'Route', url: 'https://traefik.localtest.me', kind: 'remote' },
    ],
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '4d 12h',
      lastCheckAt: '2026-04-11T10:18:00+10:00',
      lastRestartAt: '2026-04-07T21:54:00+10:00',
      summary: 'Ingress is serving routes and health checks are green.',
    },
    endpoints: [
      {
        id: 'dashboard',
        kind: 'network',
        label: 'Local dashboard',
        url: 'http://localhost:8080',
        bind: '127.0.0.1',
        port: 8080,
        protocol: 'http',
        transport: 'tcp',
        exposure: 'local',
        primary: true,
        source: 'manifest.endpoints',
        readiness: 'ready',
      },
      {
        id: 'route',
        kind: 'url',
        label: 'LAN route',
        url: 'https://traefik.localtest.me',
        bind: '0.0.0.0',
        port: 443,
        protocol: 'https',
        transport: 'tcp',
        exposure: 'public',
        target: 'dashboard',
        source: 'manifest.endpoints',
      },
    ],
    metadata: {
      serviceType: 'core-platform',
      runtime: 'docker',
      version: 'v3.1.2',
      build: 'sha256:traefik-demo',
      packageId: 'docker.io/library/traefik:3.1.2',
      installPath: 'C:\\service-lasso\\traefik',
      configPath: 'C:\\service-lasso\\traefik\\traefik.yml',
      dataPath: 'C:\\service-lasso\\traefik\\data',
      logPath: '/services/traefik/service.log',
      workPath: 'C:\\service-lasso\\traefik',
      profile: 'default',
      imageUrl: '/services/traefik/logo.svg',
    },
    dependencies: [
      {
        id: 'secrets-broker',
        name: 'Secrets Broker',
        status: 'running',
        relation: 'depends_on',
        note: 'Uses broker-managed certificates and route secrets.',
      },
    ],
    dependents: [
      {
        id: 'service-admin',
        name: 'Service Admin UI',
        status: 'running',
        relation: 'dependent',
        note: 'Admin UI is published through Traefik.',
      },
    ],
    environmentVariables: [
      {
        key: 'TRAEFIK_ENTRYPOINTS_WEB_ADDRESS',
        value: ':80',
        scope: 'service',
        source: 'service.json',
      },
      {
        key: 'TRAEFIK_ENTRYPOINTS_WEBSECURE_ADDRESS',
        value: ':443',
        scope: 'service',
        source: 'service.json',
      },
      {
        key: 'SERVICE_LASSO_ROOT',
        value: 'C:\\service-lasso',
        scope: 'global',
        source: '.env',
      },
    ],
    recentLogs: [
      {
        timestamp: '2026-04-11T10:17:44+10:00',
        level: 'info',
        source: 'healthcheck',
        message: 'All configured routers reported healthy responses.',
      },
      {
        timestamp: '2026-04-11T10:12:18+10:00',
        level: 'info',
        source: 'app',
        message: 'Route table reloaded after provider refresh.',
      },
    ],
    actions: [
      { id: 'start', label: 'Start service', kind: 'start' },
      { id: 'stop', label: 'Stop service', kind: 'stop' },
      {
        id: 'restart',
        label: 'Restart router',
        kind: 'restart',
        permission: {
          allowed: true,
          actor: 'local-root',
          mode: 'local-root',
          requiresConfirmation: true,
          confirmationLabel: 'Restart router',
          reason:
            'Restarting the edge router briefly interrupts local routing.',
        },
      },
      { id: 'install', label: 'Install service', kind: 'install' },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
      { id: 'open_admin', label: 'Open dashboard', kind: 'open_admin' },
    ],
    access: {
      lastOwnerProtected: true,
      groups: [
        {
          id: 'platform-owners',
          name: 'Platform Owners',
          providerMappings: ['ZITADEL: service-lasso-owners'],
        },
        {
          id: 'release-operators',
          name: 'Release Operators',
          providerMappings: ['ZITADEL: release-operators'],
        },
        {
          id: 'backup-readers',
          name: 'Backup Readers',
          providerMappings: ['Local group: backup-readers'],
        },
      ],
      grants: [
        {
          id: 'traefik-owner-runtime',
          groupId: 'platform-owners',
          groupName: 'Platform Owners',
          permissionKey: 'runtime.owner',
          permissionLabel: 'Runtime owner',
          scope: {
            kind: 'runtime',
            label: 'All runtime',
          },
          sensitive: true,
          elevated: true,
          lastChangedAt: '2026-04-11T08:22:00+10:00',
          auditUrl: '/logs?service=traefik&type=access',
        },
        {
          id: 'traefik-restart-action',
          groupId: 'release-operators',
          groupName: 'Release Operators',
          permissionKey: 'service.action.run',
          permissionLabel: 'Run service action',
          scope: {
            kind: 'action',
            label: 'Traefik restart action',
            serviceId: 'traefik',
            actionId: 'restart',
          },
          elevated: true,
          lastChangedAt: '2026-04-11T09:14:00+10:00',
          auditUrl: '/logs?service=traefik&type=access',
        },
        {
          id: 'traefik-backup-read',
          groupId: 'backup-readers',
          groupName: 'Backup Readers',
          permissionKey: 'service.backup.read',
          permissionLabel: 'Read service backups',
          scope: {
            kind: 'backup-area',
            label: 'Traefik backups',
            serviceId: 'traefik',
            resourceId: 'service-backups',
          },
          lastChangedAt: '2026-04-10T16:40:00+10:00',
          auditUrl: '/logs?service=traefik&type=access',
        },
      ],
    },
    updates: createEmptyUpdateState('traefik'),
  },
  {
    id: 'service-admin',
    name: 'Service Admin UI',
    status: 'running',
    favorite: true,
    role: 'Operator dashboard for Service Lasso',
    note: 'Operator dashboard is reachable.',
    installed: true,
    links: [
      { label: 'Local', url: 'http://localhost:17700', kind: 'local' },
      { label: 'LAN', url: 'http://192.168.1.53:17700', kind: 'lan' },
    ],
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '2h 16m',
      lastCheckAt: '2026-04-11T10:19:00+10:00',
      lastRestartAt: '2026-04-11T08:03:00+10:00',
      summary:
        'UI responds on the required port and current operator actions are available.',
    },
    endpoints: [
      {
        id: 'web',
        kind: 'network',
        label: 'Local UI',
        url: 'http://localhost:17700',
        bind: '0.0.0.0',
        port: 17700,
        protocol: 'http',
        transport: 'tcp',
        exposure: 'local',
        primary: true,
        source: 'manifest.endpoints',
        readiness: 'ready',
      },
      {
        id: 'lan',
        kind: 'url',
        label: 'LAN UI',
        url: 'http://192.168.1.53:17700',
        bind: '0.0.0.0',
        port: 17700,
        protocol: 'http',
        transport: 'tcp',
        exposure: 'lan',
        target: 'web',
        source: 'manifest.endpoints',
      },
    ],
    metadata: {
      serviceType: 'ui-admin',
      runtime: 'vite-preview',
      version: 'develop-stub',
      build: 'local-working-tree',
      packageId: 'lasso-@serviceadmin',
      installPath: 'C:\\projects\\service-lasso\\lasso-@serviceadmin',
      configPath:
        'C:\\projects\\service-lasso\\lasso-@serviceadmin\\vite.config.ts',
      dataPath: 'C:\\projects\\service-lasso\\lasso-@serviceadmin\\dist',
      logPath: '/services/service-admin/service.log',
      workPath: 'C:\\projects\\service-lasso\\lasso-@serviceadmin',
      profile: 'develop',
    },
    dependencies: [
      {
        id: 'traefik',
        name: 'Traefik',
        status: 'running',
        relation: 'depends_on',
        note: 'Used for routed/public exposure patterns.',
      },
      {
        id: 'zitadel',
        name: 'ZITADEL',
        status: 'degraded',
        relation: 'depends_on',
        note: 'Future auth surface depends on stable identity provider health.',
      },
    ],
    dependents: [],
    environmentVariables: [
      {
        key: 'VITE_SERVICE_LASSO_API_BASE_URL',
        value: 'http://127.0.0.1:3001',
        scope: 'service',
        source: '.env.local',
      },
      {
        key: 'VITE_SERVICE_LASSO_FAVORITES_ENABLED',
        value: 'true',
        scope: 'service',
        source: '.env.local',
      },
      {
        key: 'SERVICE_LASSO_ROOT',
        value: 'C:\\service-lasso',
        scope: 'global',
        source: '.env',
      },
    ],
    recentLogs: [
      {
        timestamp: '2026-04-11T10:18:11+10:00',
        level: 'info',
        source: 'stdout',
        message: 'GET /services/service-admin returned 200 in 19ms.',
      },
      {
        timestamp: '2026-04-11T10:09:43+10:00',
        level: 'info',
        source: 'app',
        message: 'Dashboard stub actions mounted successfully.',
      },
    ],
    actions: [
      { id: 'start', label: 'Start service', kind: 'start' },
      {
        id: 'stop',
        label: 'Stop service',
        kind: 'stop',
        permission: {
          allowed: false,
          actor: 'local-root',
          mode: 'local-root',
          reason:
            'Service Admin cannot stop its own UI process from this operator surface.',
        },
      },
      { id: 'reload', label: 'Reload UI', kind: 'reload' },
      { id: 'install', label: 'Install service', kind: 'install' },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
      { id: 'open_config', label: 'Open config', kind: 'open_config' },
    ],
    updates: {
      ...createEmptyUpdateState('service-admin'),
      state: 'available',
      updatedAt: new Date('2026-04-11T10:12:00+10:00').toISOString(),
      lastCheck: {
        checkedAt: new Date('2026-04-11T10:12:00+10:00').toISOString(),
        status: 'update_available',
        reason: 'A newer Service Admin release is available.',
        sourceRepo: 'service-lasso/lasso-serviceadmin',
        track: 'latest',
        installedTag: '2026.4.18-170a1af',
        manifestTag: '2026.4.18-170a1af',
        latestTag: '2026.4.26-demo',
      },
      available: {
        tag: '2026.4.26-demo',
        version: '2026.4.26-demo',
        releaseUrl:
          'https://github.com/service-lasso/lasso-serviceadmin/releases/tag/2026.4.26-demo',
        publishedAt: new Date('2026-04-26T00:00:00Z').toISOString(),
        assetName: '@serviceadmin-win32.zip',
        assetUrl:
          'https://github.com/service-lasso/lasso-serviceadmin/releases/download/2026.4.26-demo/@serviceadmin-win32.zip',
      },
    },
  },
  {
    id: 'zitadel',
    name: 'ZITADEL',
    status: 'degraded',
    favorite: false,
    role: 'Primary identity provider',
    note: 'SSO is reachable, but one upstream health check is lagging.',
    installed: true,
    links: [{ label: 'Local', url: 'http://localhost:8081', kind: 'local' }],
    runtimeHealth: {
      state: 'degraded',
      health: 'warning',
      uptime: '6d 2h',
      lastCheckAt: '2026-04-11T10:18:20+10:00',
      lastRestartAt: '2026-04-05T07:11:00+10:00',
      summary:
        'Auth service is up, but upstream checks show intermittent latency.',
    },
    endpoints: [
      {
        id: 'web',
        kind: 'network',
        label: 'Local auth UI',
        url: 'http://localhost:8081',
        bind: '127.0.0.1',
        port: 8081,
        protocol: 'http',
        transport: 'tcp',
        exposure: 'local',
        primary: true,
        source: 'manifest.endpoints',
        readiness: 'blocked',
      },
      {
        id: 'oidc',
        kind: 'url',
        label: 'OIDC discovery',
        protocol: 'https',
        target: 'web',
        exposure: 'local',
        required: true,
        source: 'manifest.endpoints',
        health: 'warning',
        readiness: 'blocked',
        resolution: {
          status: 'failed',
          message:
            'Endpoint selector ${endpoint.web.port} resolved, but readiness probe exceeded the latency budget.',
        },
      },
    ],
    metadata: {
      serviceType: 'identity',
      runtime: 'container',
      version: '2.57.0',
      build: 'zitadel-local-demo',
      packageId: 'ghcr.io/zitadel/zitadel:2.57.0',
      installPath: 'C:\\service-lasso\\zitadel',
      configPath: 'C:\\service-lasso\\zitadel\\zitadel.env',
      dataPath: 'C:\\service-lasso\\zitadel\\data',
      logPath: '/services/zitadel/service.log',
      workPath: 'C:\\service-lasso\\zitadel',
      profile: 'default',
    },
    dependencies: [
      {
        id: 'secrets-broker',
        name: 'Secrets Broker',
        status: 'running',
        relation: 'depends_on',
      },
    ],
    dependents: [
      {
        id: 'service-admin',
        name: 'Service Admin UI',
        status: 'running',
        relation: 'dependent',
        note: 'UI auth features eventually depend on Zitadel.',
      },
    ],
    environmentVariables: [
      {
        key: 'ZITADEL_EXTERNALDOMAIN',
        value: 'localhost',
        scope: 'service',
        source: 'zitadel.env',
      },
      {
        key: 'ZITADEL_EXTERNALPORT',
        value: '8081',
        scope: 'service',
        source: 'zitadel.env',
      },
      {
        key: 'SERVICE_LASSO_ROOT',
        value: 'C:\\service-lasso',
        scope: 'global',
        source: '.env',
      },
    ],
    recentLogs: [
      {
        timestamp: '2026-04-11T10:17:01+10:00',
        level: 'warn',
        source: 'healthcheck',
        message: 'OIDC readiness probe exceeded expected latency budget.',
      },
      {
        timestamp: '2026-04-11T09:58:26+10:00',
        level: 'info',
        source: 'app',
        message: 'Auth realm configuration reloaded without restart.',
      },
    ],
    actions: [
      { id: 'start', label: 'Start identity service', kind: 'start' },
      { id: 'stop', label: 'Stop identity service', kind: 'stop' },
      { id: 'restart', label: 'Restart identity service', kind: 'restart' },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
      { id: 'open_admin', label: 'Open auth UI', kind: 'open_admin' },
    ],
    updates: {
      ...createEmptyUpdateState('zitadel'),
      state: 'failed',
      updatedAt: new Date('2026-04-11T10:14:00+10:00').toISOString(),
      lastCheck: {
        checkedAt: new Date('2026-04-11T10:14:00+10:00').toISOString(),
        status: 'check_failed',
        reason: 'Release source returned an error.',
        sourceRepo: 'service-lasso/zitadel',
        track: 'latest',
        installedTag: '2.57.0',
        manifestTag: '2.57.0',
        latestTag: null,
      },
      failed: {
        reason: 'Release source returned an error.',
        failedAt: new Date('2026-04-11T10:14:00+10:00').toISOString(),
        sourceStatus: 'check_failed',
      },
    },
  },
  {
    id: 'dagu',
    name: 'Dagu',
    status: 'stopped',
    favorite: false,
    role: 'Workflow engine',
    note: 'Workflow engine is not currently started.',
    installed: true,
    links: [{ label: 'Local', url: 'http://localhost:8082', kind: 'local' }],
    runtimeHealth: {
      state: 'stopped',
      health: 'critical',
      uptime: '0m',
      lastCheckAt: '2026-04-11T10:18:35+10:00',
      lastRestartAt: '2026-04-10T23:44:00+10:00',
      summary: 'Workflow engine is installed but currently offline.',
    },
    endpoints: [
      {
        label: 'Local workflow UI',
        url: 'http://localhost:8082',
        bind: '127.0.0.1',
        port: 8082,
        protocol: 'http',
        exposure: 'local',
      },
    ],
    metadata: {
      serviceType: 'workflow',
      runtime: 'binary-service',
      version: '0.17.1',
      build: 'dagu-demo-build',
      packageId: 'dagu@0.17.1',
      installPath: 'C:\\service-lasso\\dagu',
      configPath: 'C:\\service-lasso\\dagu\\config.yaml',
      dataPath: 'C:\\service-lasso\\dagu\\data',
      logPath: '/services/dagu/service.log',
      workPath: 'C:\\service-lasso\\dagu',
      profile: 'default',
    },
    dependencies: [
      {
        id: 'secrets-broker',
        name: 'Secrets Broker',
        status: 'running',
        relation: 'depends_on',
      },
    ],
    dependents: [],
    environmentVariables: [
      {
        key: 'DAGU_PORT',
        value: '8082',
        scope: 'service',
        source: 'config.yaml',
      },
      {
        key: 'DAGU_HOME',
        value: 'C:\\service-lasso\\dagu',
        scope: 'service',
        source: 'service.json',
      },
      {
        key: 'SERVICE_LASSO_ROOT',
        value: 'C:\\service-lasso',
        scope: 'global',
        source: '.env',
      },
    ],
    recentLogs: [
      {
        timestamp: '2026-04-11T09:51:05+10:00',
        level: 'error',
        source: 'supervisor',
        message: 'Service is stopped and awaiting explicit start action.',
      },
    ],
    actions: [
      { id: 'stop', label: 'Stop workflow engine', kind: 'stop' },
      { id: 'start', label: 'Start workflow engine', kind: 'start' },
      { id: 'install', label: 'Install workflow engine', kind: 'install' },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
      { id: 'open_admin', label: 'Open workflow UI', kind: 'open_admin' },
    ],
    updates: {
      ...createEmptyUpdateState('dagu'),
      state: 'downloadedCandidate',
      updatedAt: new Date('2026-04-11T10:15:00+10:00').toISOString(),
      lastCheck: {
        checkedAt: new Date('2026-04-11T10:15:00+10:00').toISOString(),
        status: 'update_available',
        reason: 'Update candidate has been downloaded.',
        sourceRepo: 'service-lasso/dagu',
        track: 'latest',
        installedTag: '0.17.1',
        manifestTag: '0.17.1',
        latestTag: '0.18.0',
      },
      downloadedCandidate: {
        tag: '0.18.0',
        version: '0.18.0',
        assetName: 'dagu-win32.zip',
        assetUrl: 'https://example.invalid/dagu-win32.zip',
        archivePath:
          'C:\\service-lasso\\dagu\\.state\\update-candidates\\0.18.0\\dagu-win32.zip',
        extractedPath: null,
        downloadedAt: new Date('2026-04-11T10:15:00+10:00').toISOString(),
      },
    },
  },
  {
    id: 'secrets-broker',
    name: 'Secrets Broker',
    status: 'running',
    favorite: false,
    role: 'Token and secret resolution layer',
    note: 'Secrets broker stub is healthy.',
    installed: true,
    links: [{ label: 'Local', url: 'http://localhost:8083', kind: 'local' }],
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '3d 7h',
      lastCheckAt: '2026-04-11T10:18:48+10:00',
      lastRestartAt: '2026-04-08T02:19:00+10:00',
      summary: 'Secrets and provider tokens are resolving normally.',
    },
    endpoints: [
      {
        label: 'Local broker API',
        url: 'http://localhost:8083',
        bind: '127.0.0.1',
        port: 8083,
        protocol: 'http',
        exposure: 'local',
      },
    ],
    metadata: {
      serviceType: 'security-core',
      runtime: 'go-service',
      version: 'v0.4.0-dev',
      build: 'broker-demo-build',
      packageId: 'service-lasso/secrets-broker',
      installPath: 'C:\\service-lasso\\secrets-broker',
      configPath: 'C:\\service-lasso\\secrets-broker\\config.json',
      dataPath: 'C:\\service-lasso\\secrets-broker\\vault',
      logPath: '/services/secrets-broker/service.log',
      workPath: 'C:\\service-lasso\\secrets-broker',
      profile: 'default',
    },
    dependencies: [],
    dependents: [
      {
        id: 'traefik',
        name: 'Traefik',
        status: 'running',
        relation: 'dependent',
      },
      {
        id: 'zitadel',
        name: 'ZITADEL',
        status: 'degraded',
        relation: 'dependent',
      },
      {
        id: 'dagu',
        name: 'Dagu',
        status: 'stopped',
        relation: 'dependent',
      },
    ],
    environmentVariables: [
      {
        key: 'SECRETS_BROKER_PORT',
        value: '8083',
        scope: 'service',
        source: 'config.json',
      },
      {
        key: 'SECRETS_BROKER_VAULT_PATH',
        value: 'C:\\service-lasso\\secrets-broker\\vault',
        scope: 'service',
        source: 'config.json',
      },
      {
        key: 'SERVICE_LASSO_ROOT',
        value: 'C:\\service-lasso',
        scope: 'global',
        source: '.env',
      },
    ],
    recentLogs: [
      {
        timestamp: '2026-04-11T10:18:52+10:00',
        level: 'info',
        source: 'app',
        message: 'Resolved provider token refs for 3 dependent services.',
      },
      {
        timestamp: '2026-04-11T10:01:12+10:00',
        level: 'info',
        source: 'healthcheck',
        message: 'Vault integrity check passed.',
      },
    ],
    actions: [
      {
        id: 'restart',
        label: 'Restart broker',
        kind: 'restart',
        permission: {
          allowed: true,
          actor: 'local-root',
          mode: 'local-root',
          requiresConfirmation: true,
          confirmationLabel: 'Restart broker',
          reason:
            'Restarting the secrets broker can temporarily block dependent service credentials.',
        },
      },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
      { id: 'open_config', label: 'Open config', kind: 'open_config' },
      {
        id: 'uninstall',
        label: 'Uninstall service',
        kind: 'uninstall',
        permission: {
          allowed: false,
          actor: 'remote-anonymous',
          mode: 'remote-anonymous',
          reason:
            'Remote anonymous sessions cannot uninstall security-critical services.',
        },
      },
    ],
    updates: {
      ...createEmptyUpdateState('secrets-broker'),
      state: 'installDeferred',
      updatedAt: new Date('2026-04-11T10:16:00+10:00').toISOString(),
      lastCheck: {
        checkedAt: new Date('2026-04-11T10:16:00+10:00').toISOString(),
        status: 'update_available',
        reason: 'Install is waiting for the maintenance window.',
        sourceRepo: 'service-lasso/secrets-broker',
        track: 'latest',
        installedTag: 'v0.4.0-dev',
        manifestTag: 'v0.4.0-dev',
        latestTag: 'v0.4.1',
      },
      installDeferred: {
        reason: 'Current time is outside updates.installWindow.',
        deferredAt: new Date('2026-04-11T10:16:00+10:00').toISOString(),
        nextEligibleAt: new Date('2026-04-12T02:00:00+10:00').toISOString(),
      },
    },
  },
]

function createDemoRecoveryState(
  serviceId: string
): ServiceRecoveryHistoryState {
  const base = createEmptyRecoveryState(serviceId)
  const at = new Date('2026-04-11T10:18:00+10:00').toISOString()

  if (serviceId === 'zitadel') {
    return {
      ...base,
      updatedAt: at,
      events: [
        {
          kind: 'monitor',
          serviceId,
          action: 'skip',
          reason: 'unhealthy_threshold',
          message: 'Service is unhealthy but has not reached threshold.',
          at,
        },
      ],
    }
  }

  if (serviceId === 'dagu') {
    return {
      ...base,
      updatedAt: at,
      events: [
        {
          kind: 'restart',
          serviceId,
          ok: false,
          message: 'Restart readiness check failed.',
          at,
        },
      ],
    }
  }

  if (serviceId === 'secrets-broker') {
    return {
      ...base,
      updatedAt: at,
      events: [
        {
          kind: 'hook',
          serviceId,
          phase: 'postUpgrade',
          ok: false,
          blocked: true,
          steps: [
            {
              phase: 'postUpgrade',
              name: 'reload-secrets',
              command: 'node ./hooks/reload-secrets.mjs',
              ok: false,
              exitCode: 7,
              timedOut: false,
              failurePolicy: 'block',
              stdout: '',
              stderr: 'reload failed',
              startedAt: new Date('2026-04-11T10:17:50+10:00').toISOString(),
              finishedAt: new Date('2026-04-11T10:17:51+10:00').toISOString(),
            },
          ],
          at,
        },
      ],
    }
  }

  return {
    ...base,
    updatedAt: at,
    events: [
      {
        kind: serviceId === 'service-admin' ? 'doctor' : 'monitor',
        serviceId,
        action: serviceId === 'service-admin' ? undefined : 'healthy',
        reason: serviceId === 'service-admin' ? undefined : 'healthy',
        ok: serviceId === 'service-admin' ? true : undefined,
        blocked: serviceId === 'service-admin' ? false : undefined,
        message:
          serviceId === 'service-admin' ? undefined : 'Service is healthy.',
        steps: serviceId === 'service-admin' ? [] : undefined,
        at,
      },
    ],
  }
}

function createSetupRun(
  serviceId: string,
  stepId: string,
  status: ServiceSetupStepRun['status'],
  options: {
    startedAt: string
    durationMs: number
    exitCode: number | null
    signal?: string | null
    message?: string
  }
): ServiceSetupStepRun {
  const startedAt = new Date(options.startedAt).toISOString()
  const finishedAt = new Date(
    Date.parse(startedAt) + options.durationMs
  ).toISOString()
  const runId = `${startedAt.replace(/[:.]/g, '-')}-${stepId}`

  return {
    runId,
    serviceId,
    stepId,
    status,
    startedAt,
    finishedAt,
    durationMs: options.durationMs,
    command: `service-lasso setup run ${serviceId} ${stepId}`,
    exitCode: options.exitCode,
    signal: options.signal ?? null,
    message: options.message,
    logs: {
      logPath: `/services/${serviceId}/logs/setup/${stepId}/${runId}/setup.log`,
      stdoutPath: `/services/${serviceId}/logs/setup/${stepId}/${runId}/stdout.log`,
      stderrPath: `/services/${serviceId}/logs/setup/${stepId}/${runId}/stderr.log`,
    },
  }
}

function createSetupStep(
  serviceId: string,
  step: Omit<ServiceSetupStep, 'lastRun' | 'history' | 'status'> & {
    lastRun?: ServiceSetupStepRun
    status?: ServiceSetupStep['status']
  }
): ServiceSetupStep {
  return {
    ...step,
    id: step.id,
    description: step.description ?? `Setup step ${step.id} for ${serviceId}.`,
    status: step.status ?? step.lastRun?.status ?? 'pending',
    lastRun: step.lastRun ?? null,
    history: step.lastRun ? [step.lastRun] : [],
  }
}

function createDemoSetupState(serviceId: string): ServiceSetupState {
  if (serviceId === 'service-admin') {
    return { serviceId, updatedAt: null, steps: [] }
  }

  if (serviceId === 'zitadel') {
    const lastRun = createSetupRun(serviceId, 'seed-admin', 'failed', {
      startedAt: '2026-04-11T09:59:00+10:00',
      durationMs: 1421,
      exitCode: 1,
      message: 'Setup step "seed-admin" failed with exit code 1.',
    })

    return {
      serviceId,
      updatedAt: lastRun.finishedAt,
      steps: [
        createSetupStep(serviceId, {
          id: 'seed-admin',
          description: 'Create the initial administrator realm user.',
          rerun: 'manual',
          dependOn: ['zitadel-db'],
          lastRun,
        }),
      ],
    }
  }

  const certificateRun = createSetupRun(
    serviceId,
    'generate-certificate',
    'succeeded',
    {
      startedAt: '2026-04-11T08:31:00+10:00',
      durationMs: 814,
      exitCode: 0,
      message: 'Setup step "generate-certificate" completed.',
    }
  )
  const cacheRun = createSetupRun(serviceId, 'prepare-cache', 'skipped', {
    startedAt: '2026-04-11T08:32:00+10:00',
    durationMs: 0,
    exitCode: null,
    message: 'setup step already succeeded',
  })

  return {
    serviceId,
    updatedAt: certificateRun.finishedAt,
    steps: [
      createSetupStep(serviceId, {
        id: 'generate-certificate',
        description: 'Generate local TLS material required by the service.',
        rerun: 'ifMissing',
        lastRun: certificateRun,
      }),
      createSetupStep(serviceId, {
        id: 'prepare-cache',
        description: 'Prepare runtime cache directories.',
        rerun: 'ifMissing',
        lastRun: cacheRun,
        skipReason: cacheRun.message,
      }),
    ],
  }
}

services = services.map((service) => ({
  ...service,
  recovery: service.recovery ?? createDemoRecoveryState(service.id),
  setup: service.setup ?? createDemoSetupState(service.id),
}))

let runtime = {
  status: 'warning' as const,
  lastReloadedAt: new Date('2026-04-10T19:55:00+10:00').toISOString(),
}

function buildWarnings(currentServices: DashboardService[]) {
  const warnings: string[] = []

  if (currentServices.some((service) => service.status === 'degraded')) {
    warnings.push('One or more services are degraded and need attention.')
  }

  if (currentServices.some((service) => service.status === 'stopped')) {
    warnings.push('At least one managed service is currently stopped.')
  }

  if (!currentServices.some((service) => service.favorite)) {
    warnings.push('No favorite services are configured for quick access.')
  }

  const updateNotifications = buildUpdateNotifications(currentServices)
  warnings.push(...updateNotifications.messages)
  warnings.push(...buildRecoveryNotifications(currentServices).messages)

  return warnings
}

export function buildUpdateNotifications(currentServices: DashboardService[]) {
  const latestCount = currentServices.filter(
    (service) => service.updates?.state === 'installed'
  ).length
  const availableCount = currentServices.filter(
    (service) => service.updates?.state === 'available'
  ).length
  const downloadedCount = currentServices.filter(
    (service) => service.updates?.state === 'downloadedCandidate'
  ).length
  const deferredCount = currentServices.filter(
    (service) => service.updates?.state === 'installDeferred'
  ).length
  const failedCount = currentServices.filter(
    (service) => service.updates?.state === 'failed'
  ).length
  const messages: string[] = []

  if (availableCount > 0) {
    messages.push(`${availableCount} service update(s) are available.`)
  }
  if (downloadedCount > 0) {
    messages.push(
      `${downloadedCount} downloaded update candidate(s) are ready.`
    )
  }
  if (deferredCount > 0) {
    messages.push(
      `${deferredCount} update install(s) are waiting for a window.`
    )
  }
  if (failedCount > 0) {
    messages.push(`${failedCount} update check(s) need attention.`)
  }

  return {
    latestCount,
    availableCount,
    downloadedCount,
    deferredCount,
    failedCount,
    messages,
  }
}

export function buildRecoveryNotifications(
  currentServices: DashboardService[]
) {
  const latestEvents = currentServices.flatMap((service) => {
    const event = service.recovery?.events[service.recovery.events.length - 1]
    return event ? [{ service, event }] : []
  })
  const monitorAttentionCount = latestEvents.filter(
    ({ event }) =>
      event.kind === 'monitor' &&
      event.action !== 'healthy' &&
      event.reason !== 'healthy'
  ).length
  const doctorBlockedCount = latestEvents.filter(
    ({ event }) => event.kind === 'doctor' && event.blocked === true
  ).length
  const hookBlockedCount = latestEvents.filter(
    ({ event }) => event.kind === 'hook' && event.blocked === true
  ).length
  const restartFailureCount = latestEvents.filter(
    ({ event }) => event.kind === 'restart' && event.ok === false
  ).length
  const messages: string[] = []

  if (monitorAttentionCount > 0) {
    messages.push(
      `${monitorAttentionCount} service monitor event(s) need review.`
    )
  }
  if (doctorBlockedCount > 0) {
    messages.push(
      `${doctorBlockedCount} doctor/preflight check(s) are blocked.`
    )
  }
  if (hookBlockedCount > 0) {
    messages.push(`${hookBlockedCount} lifecycle hook run(s) are blocked.`)
  }
  if (restartFailureCount > 0) {
    messages.push(`${restartFailureCount} restart attempt(s) failed readiness.`)
  }

  return {
    monitorAttentionCount,
    doctorBlockedCount,
    hookBlockedCount,
    restartFailureCount,
    messages,
  }
}

function buildRuntimeEndpoint(path: string, apiBaseUrl: string) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export async function fetchRuntimeJson<T>(
  path: string,
  options?: {
    apiBaseUrl?: string | null
    mode?: RuntimeApiMode
    method?: string
    headers?: HeadersInit
    body?: BodyInit | null
    acceptErrorResponse?: (status: number, payload: unknown) => boolean
  }
) {
  const apiBaseUrl =
    options?.apiBaseUrl === undefined
      ? serviceLassoApiBaseUrl
      : options.apiBaseUrl
  const mode = options?.mode ?? resolveRuntimeApiMode()
  const detailsBase = {
    mode,
    path,
    endpoint:
      apiBaseUrl == null ? null : buildRuntimeEndpoint(path, apiBaseUrl),
    status: null,
    contentType: null,
    packagedProxyConfigured: mode === 'packaged-runtime' && apiBaseUrl === '',
  } satisfies Omit<RuntimeApiUnavailableDetails, 'reason'>

  if (apiBaseUrl == null) {
    throw new RuntimeApiUnavailableError({
      ...detailsBase,
      reason: 'missing_api_base_url',
    })
  }

  let response: Response
  const endpoint = buildRuntimeEndpoint(path, apiBaseUrl)
  const requestDetails = {
    ...detailsBase,
    endpoint,
  }
  const requestInit: RequestInit = {
    method: options?.method,
    headers: options?.headers,
    body: options?.body,
  }

  try {
    response = await fetch(endpoint, requestInit)
  } catch (error) {
    throw new RuntimeApiUnavailableError(
      {
        ...requestDetails,
        reason: 'fetch_failed',
      },
      error
    )
  }

  const contentType = response.headers.get('content-type')
  const responseDetails = {
    ...requestDetails,
    status: response.status,
    contentType,
  }

  if (!response.ok) {
    let errorCode: string | null = null
    let errorPayload: unknown = null
    if (contentType?.toLowerCase().includes('application/json')) {
      try {
        errorPayload = (await response.clone().json()) as unknown
        if (errorPayload && typeof errorPayload === 'object') {
          const candidate = (errorPayload as Record<string, unknown>).error
          if (
            typeof candidate === 'string' &&
            /^[a-z][a-z0-9_-]{0,99}$/.test(candidate)
          ) {
            errorCode = candidate
          }
        }
      } catch {
        // Only a bounded allowlisted error code may cross this boundary.
      }
    }
    if (!options?.acceptErrorResponse?.(response.status, errorPayload)) {
      throw new RuntimeApiUnavailableError({
        ...responseDetails,
        reason: 'http_error',
        errorCode,
      })
    }
    // The caller still validates the complete typed response body.
  }

  if (!contentType?.toLowerCase().includes('application/json')) {
    throw new RuntimeApiUnavailableError({
      ...responseDetails,
      reason: 'non_json',
    })
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new RuntimeApiUnavailableError(
      {
        ...responseDetails,
        reason: 'non_json',
      },
      error
    )
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}

const serviceActionKinds = new Set<ServiceAction['kind']>([
  'start',
  'stop',
  'restart',
  'reload',
  'install',
  'uninstall',
  'open_logs',
  'open_config',
  'open_admin',
])

export function normalizeRuntimeServiceAction(
  input: unknown
): ServiceAction | null {
  if (!isRecord(input)) return null
  const id = requireSafeBrokerIdentifier(input.id, 'dashboard action id')
  const label = sanitizeBrokerDisplayText(input.label)
  if (!label || !serviceActionKinds.has(input.kind as ServiceAction['kind'])) {
    return null
  }

  if (typeof input.permission === 'string') {
    const permissionKey = requireSafeBrokerIdentifier(
      input.permission,
      'dashboard action permission'
    )
    const allowed = input.granted === true
    const requiresConfirmation = input.requiresConfirmation === true
    return {
      id,
      label,
      kind: input.kind as ServiceAction['kind'],
      permission: {
        key: permissionKey,
        allowed,
        actor:
          typeof input.actor === 'string'
            ? requireSafeBrokerIdentifier(input.actor, 'dashboard action actor')
            : undefined,
        mode:
          input.mode === 'local-root' || input.mode === 'signed-in'
            ? input.mode
            : undefined,
        requiresConfirmation,
        confirmationLabel: requiresConfirmation ? label : undefined,
        reason: allowed
          ? requiresConfirmation
            ? 'The runtime requires explicit confirmation.'
            : undefined
          : 'The authenticated runtime actor is not granted this permission.',
      },
    }
  }

  return {
    id,
    label,
    kind: input.kind as ServiceAction['kind'],
    permission: {
      allowed: false,
      reason:
        'The runtime did not provide an authoritative permission decision.',
    },
  }
}

function normalizeRuntimeDashboardService(service: DashboardService) {
  const rawActions = Array.isArray(service.actions) ? service.actions : []
  return {
    ...service,
    actions: rawActions
      .map(normalizeRuntimeServiceAction)
      .filter((action): action is ServiceAction => action !== null),
  }
}

function readString(input: unknown) {
  return typeof input === 'string' ? input : undefined
}

function readStringArray(input: unknown) {
  return Array.isArray(input)
    ? input.filter((item): item is string => typeof item === 'string')
    : undefined
}

function setupContractError(field: string): never {
  throw new Error(`Invalid Service Lasso setup status contract: ${field}.`)
}

function requireSetupRecord(
  input: unknown,
  field: string
): Record<string, unknown> {
  if (!isRecord(input)) setupContractError(field)
  return input
}

function requireSetupString(input: unknown, field: string, max = 256) {
  const containsControlCharacter =
    typeof input === 'string' &&
    Array.from(input).some((character) => {
      const code = character.charCodeAt(0)
      return code <= 31 || code === 127
    })
  if (
    typeof input !== 'string' ||
    input.length === 0 ||
    input.length > max ||
    containsControlCharacter
  ) {
    setupContractError(field)
  }
  return input
}

function requireSetupBoolean(input: unknown, field: string) {
  if (typeof input !== 'boolean') setupContractError(field)
  return input
}

function requireSetupBlockers(input: unknown, field: string) {
  if (!Array.isArray(input) || input.length > 32) setupContractError(field)
  return input.map((item, index) =>
    requireSetupString(item, `${field}[${index}]`, 128)
  )
}

export function normalizeFirstRunSetupPayload(
  payload: unknown
): FirstRunSetupState {
  const envelope = requireSetupRecord(payload, 'response')
  const setup = requireSetupRecord(envelope.setup, 'setup')
  if (setup.contractVersion !== 'service-lasso.setup-status.v1') {
    setupContractError('setup.contractVersion')
  }
  if (
    typeof setup.state !== 'string' ||
    !firstRunSetupStatuses.has(setup.state as FirstRunSetupStatus)
  ) {
    setupContractError('setup.state')
  }

  const vault = requireSetupRecord(setup.vault, 'setup.vault')
  const operator = requireSetupRecord(setup.operator, 'setup.operator')
  const trust = requireSetupRecord(setup.trustBoundary, 'setup.trustBoundary')
  const auth = requireSetupRecord(setup.auth, 'setup.auth')
  const actor = requireSetupRecord(auth.actor, 'setup.auth.actor')
  const actorKinds = new Set(['local-root', 'zitadel', 'local-token'])
  const authModes = new Set(['local-root', 'zitadel', 'local-token', 'blocked'])
  const actorKind =
    actor.kind === null
      ? null
      : actorKinds.has(String(actor.kind))
        ? (actor.kind as 'local-root' | 'zitadel' | 'local-token')
        : setupContractError('setup.auth.actor.kind')
  const actorId =
    actor.actorId === null
      ? null
      : requireSetupString(actor.actorId, 'setup.auth.actor.actorId')
  const mode = authModes.has(String(auth.mode))
    ? (auth.mode as FirstRunSetupState['auth']['mode'])
    : setupContractError('setup.auth.mode')

  if (operator.identitySource !== 'vault') {
    setupContractError('setup.operator.identitySource')
  }

  return {
    contractVersion: 'service-lasso.setup-status.v1',
    state: setup.state as FirstRunSetupStatus,
    setupMode: requireSetupBoolean(setup.setupMode, 'setup.setupMode'),
    vault: {
      required: requireSetupBoolean(vault.required, 'setup.vault.required'),
      ready: requireSetupBoolean(vault.ready, 'setup.vault.ready'),
    },
    operator: {
      osUsername: requireSetupString(
        operator.osUsername,
        'setup.operator.osUsername'
      ),
      identitySource: 'vault',
    },
    trustBoundary: {
      bindHost: requireSetupString(
        trust.bindHost,
        'setup.trustBoundary.bindHost'
      ),
      localOnly: requireSetupBoolean(
        trust.localOnly,
        'setup.trustBoundary.localOnly'
      ),
      localhostBootstrapAllowed: requireSetupBoolean(
        trust.localhostBootstrapAllowed,
        'setup.trustBoundary.localhostBootstrapAllowed'
      ),
      remoteBootstrapAllowed: requireSetupBoolean(
        trust.remoteBootstrapAllowed,
        'setup.trustBoundary.remoteBootstrapAllowed'
      ),
      setupTokenConfigured: requireSetupBoolean(
        trust.setupTokenConfigured,
        'setup.trustBoundary.setupTokenConfigured'
      ),
      blockers: requireSetupBlockers(
        trust.blockers,
        'setup.trustBoundary.blockers'
      ),
    },
    auth: {
      actor: {
        authenticated: requireSetupBoolean(
          actor.authenticated,
          'setup.auth.actor.authenticated'
        ),
        kind: actorKind,
        actorId,
      },
      mode,
      blockers: requireSetupBlockers(auth.blockers, 'setup.auth.blockers'),
    },
  }
}

export function normalizeFirstRunSetupBootstrapPayload(
  payload: unknown
): FirstRunSetupActionResult {
  const envelope = requireSetupRecord(payload, 'response')
  const bootstrap = requireSetupRecord(envelope.bootstrap, 'bootstrap')
  if (bootstrap.ok !== true) setupContractError('bootstrap.ok')
  if (bootstrap.state !== 'setup_complete') {
    setupContractError('bootstrap.state')
  }
  if (
    typeof bootstrap.provisionedSecretCount !== 'number' ||
    !Number.isSafeInteger(bootstrap.provisionedSecretCount) ||
    bootstrap.provisionedSecretCount < 0 ||
    bootstrap.provisionedSecretCount > 10_000
  ) {
    setupContractError('bootstrap.provisionedSecretCount')
  }

  return {
    bootstrap: {
      ok: true,
      state: 'setup_complete',
      provisionedSecretCount: bootstrap.provisionedSecretCount,
    },
    setup: normalizeFirstRunSetupPayload(payload),
  }
}

function normalizeSetupRun(input: unknown): ServiceSetupStepRun | null {
  if (!isRecord(input)) return null

  const stepId = readString(input.stepId)
  const serviceId = readString(input.serviceId)
  const runId = readString(input.runId)
  const startedAt = readString(input.startedAt)
  const finishedAt = readString(input.finishedAt)
  const status = readString(input.status)

  if (!stepId || !serviceId || !runId || !startedAt || !finishedAt || !status) {
    return null
  }

  const logs = isRecord(input.logs) ? input.logs : undefined

  return {
    runId,
    serviceId,
    stepId,
    status:
      status === 'succeeded' ||
      status === 'failed' ||
      status === 'timeout' ||
      status === 'skipped'
        ? status
        : 'pending',
    startedAt,
    finishedAt,
    durationMs:
      typeof input.durationMs === 'number' && Number.isFinite(input.durationMs)
        ? input.durationMs
        : Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
    command: readString(input.command),
    exitCode: typeof input.exitCode === 'number' ? input.exitCode : null,
    signal: readString(input.signal) ?? null,
    message: readString(input.message),
    logs: logs
      ? {
          logPath: readString(logs.logPath),
          stdoutPath: readString(logs.stdoutPath),
          stderrPath: readString(logs.stderrPath),
        }
      : undefined,
  }
}

export function normalizeServiceSetupPayload(
  serviceId: string,
  payload: unknown
): ServiceSetupState {
  const input = isRecord(payload) ? payload : {}
  const rawSetup = isRecord(input.setup) ? input.setup : input
  const stateSteps = isRecord(rawSetup.steps) ? rawSetup.steps : {}
  const rawSteps = Array.isArray(input.steps) ? input.steps : []

  const stepIds = new Set<string>()
  for (const rawStep of rawSteps) {
    if (typeof rawStep === 'string') {
      stepIds.add(rawStep)
    } else if (isRecord(rawStep) && typeof rawStep.id === 'string') {
      stepIds.add(rawStep.id)
    }
  }
  for (const stepId of Object.keys(stateSteps)) {
    stepIds.add(stepId)
  }

  const steps = Array.from(stepIds)
    .sort((left, right) => left.localeCompare(right))
    .map((stepId) => {
      const stepDetails = rawSteps.find(
        (item) => isRecord(item) && item.id === stepId
      )
      const declared = isRecord(stepDetails) ? stepDetails : {}
      const state = isRecord(stateSteps[stepId]) ? stateSteps[stepId] : {}
      const lastRun = normalizeSetupRun(state.lastRun)
      const history = Array.isArray(state.history)
        ? state.history
            .map((entry) => normalizeSetupRun(entry))
            .filter((entry): entry is ServiceSetupStepRun => entry !== null)
        : []

      return {
        id: stepId,
        description: readString(declared.description),
        rerun:
          declared.rerun === 'ifMissing' ||
          declared.rerun === 'manual' ||
          declared.rerun === 'always'
            ? declared.rerun
            : undefined,
        dependOn:
          readStringArray(declared.dependOn) ??
          readStringArray(declared.depend_on),
        status:
          state.status === 'succeeded' ||
          state.status === 'failed' ||
          state.status === 'timeout' ||
          state.status === 'skipped'
            ? state.status
            : (lastRun?.status ?? 'pending'),
        lastRun,
        history,
        skipReason:
          state.status === 'skipped'
            ? (lastRun?.message ?? readString(state.reason))
            : undefined,
      } satisfies ServiceSetupStep
    })

  return {
    serviceId: readString(input.serviceId) ?? serviceId,
    updatedAt: readString(rawSetup.updatedAt) ?? null,
    steps,
  }
}

export function isRuntimeApiUnavailableError(
  error: unknown
): error is RuntimeApiUnavailableError {
  return error instanceof RuntimeApiUnavailableError
}

export function getRuntimeApiUnavailableCopy(
  error: unknown,
  env: RuntimeApiEnvironment = import.meta.env
) {
  const mode = resolveRuntimeApiMode(env)
  const details = isRuntimeApiUnavailableError(error)
    ? error.details
    : ({
        mode,
        path: '/api/dashboard',
        endpoint: null,
        status: null,
        contentType: null,
        packagedProxyConfigured: mode === 'packaged-runtime',
        reason: 'fetch_failed',
      } satisfies RuntimeApiUnavailableDetails)

  return {
    title: 'Runtime API unavailable',
    description:
      'Service Admin cannot reach or parse the Service Lasso runtime API.',
    guidance:
      mode === 'local-dev'
        ? 'Set VITE_SERVICE_LASSO_API_BASE_URL for a separate runtime API, or set VITE_SERVICE_LASSO_ENABLE_STUB_DATA=true for local fixture development.'
        : 'Check that the packaged Service Admin runtime API proxy is configured and returning JSON.',
    details,
  }
}

function buildSummary(): DashboardSummary {
  const warnings = buildWarnings(services)
  const updateNotifications = buildUpdateNotifications(services)
  const recoveryNotifications = buildRecoveryNotifications(services)
  const favorites = services.filter((service) => service.favorite)
  const others = services.filter((service) => !service.favorite)

  return {
    runtime: {
      status: warnings.length > 0 ? 'warning' : 'healthy',
      lastReloadedAt: runtime.lastReloadedAt,
      warningCount: warnings.length,
    },
    servicesTotal: services.length,
    servicesRunning: services.filter((service) => service.status === 'running')
      .length,
    servicesStopped: services.filter((service) => service.status === 'stopped')
      .length,
    servicesDegraded: services.filter(
      (service) => service.status === 'degraded'
    ).length,
    networkExposureCount: services.reduce(
      (count, service) => count + service.links.length,
      0
    ),
    installedCount: services.filter((service) => service.installed).length,
    favorites,
    others,
    warnings,
    problemServices: services.filter(
      (service) => service.status === 'degraded' || service.status === 'stopped'
    ),
    updateNotifications,
    recoveryNotifications,
  }
}

function syncFavoriteState(serviceId: string, favorite?: boolean) {
  services = services.map((service) =>
    service.id === serviceId
      ? {
          ...service,
          favorite: favorite ?? !service.favorite,
        }
      : service
  )
}

async function updateFavoriteViaApi(serviceId: string, favorite: boolean) {
  if (!favoritesMutationEnabled || serviceLassoApiBaseUrl === null) return false

  try {
    const response = await fetch(
      `${serviceLassoApiBaseUrl}/api/services/${serviceId}/meta`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ favorite }),
      }
    )

    if (!response.ok) return false

    syncFavoriteState(serviceId, favorite)
    return true
  } catch {
    return false
  }
}

export function setFirstRunSetupFixtureForTests(
  fixture: Partial<FirstRunSetupState> | null
) {
  const defaults = createDefaultFirstRunSetupState()
  firstRunSetupFixture = fixture
    ? {
        ...defaults,
        ...fixture,
        vault: {
          ...defaults.vault,
          ...fixture.vault,
        },
        operator: {
          ...defaults.operator,
          ...fixture.operator,
        },
        trustBoundary: {
          ...defaults.trustBoundary,
          ...fixture.trustBoundary,
        },
        auth: {
          ...defaults.auth,
          ...fixture.auth,
          actor: {
            ...defaults.auth.actor,
            ...fixture.auth?.actor,
          },
        },
      }
    : defaults
}

export async function fetchFirstRunSetupState() {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>('/api/setup/status')
    return normalizeFirstRunSetupPayload(payload)
  }

  return structuredClone(firstRunSetupFixture)
}

export async function bootstrapFirstRunSetup(setupToken?: string) {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const response = await fetchRuntimeJson<unknown>('/api/setup/bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(setupToken ? { setupToken } : {}),
    })
    return normalizeFirstRunSetupBootstrapPayload(response)
  }

  firstRunSetupFixture = {
    ...firstRunSetupFixture,
    state: 'not_required',
    setupMode: false,
    vault: {
      ...firstRunSetupFixture.vault,
      ready: true,
    },
    trustBoundary: {
      ...firstRunSetupFixture.trustBoundary,
      localhostBootstrapAllowed: false,
      remoteBootstrapAllowed: false,
      blockers: [],
    },
  }

  return structuredClone({
    bootstrap: {
      ok: true,
      state: 'setup_complete',
      provisionedSecretCount: 3,
    },
    setup: firstRunSetupFixture,
  } satisfies FirstRunSetupActionResult)
}

export async function fetchDashboardSummary() {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<{ summary?: DashboardSummary }>(
      '/api/dashboard'
    )
    if (!payload.summary) {
      throw new RuntimeApiUnavailableError({
        mode: resolveRuntimeApiMode(),
        path: '/api/dashboard',
        endpoint:
          serviceLassoApiBaseUrl == null
            ? null
            : buildRuntimeEndpoint('/api/dashboard', serviceLassoApiBaseUrl),
        status: 200,
        contentType: 'application/json',
        packagedProxyConfigured:
          resolveRuntimeApiMode() === 'packaged-runtime' &&
          serviceLassoApiBaseUrl === '',
        reason: 'non_json',
      })
    }

    return structuredClone(normalizeRuntimeDashboardSummary(payload.summary))
  }

  await syncRemoteStateFromApi()
  return structuredClone(buildSummary())
}

export function normalizeRuntimeDashboardSummary(
  summary: Omit<
    DashboardSummary,
    'updateNotifications' | 'recoveryNotifications'
  > &
    Partial<
      Pick<DashboardSummary, 'updateNotifications' | 'recoveryNotifications'>
    >
): DashboardSummary {
  const favorites = summary.favorites.map(normalizeRuntimeDashboardService)
  const others = summary.others.map(normalizeRuntimeDashboardService)
  const currentServices = [...favorites, ...others]
  return {
    ...summary,
    favorites,
    others,
    updateNotifications:
      summary.updateNotifications ?? buildUpdateNotifications(currentServices),
    recoveryNotifications:
      summary.recoveryNotifications ??
      buildRecoveryNotifications(currentServices),
  }
}

export async function fetchServices() {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<{ services?: DashboardService[] }>(
      '/api/dashboard/services'
    )
    return structuredClone(
      (payload.services ?? []).map(normalizeRuntimeDashboardService)
    )
  }

  await syncRemoteStateFromApi()
  return structuredClone(services)
}

function buildInboxSummary(): InboxSummary {
  const messages = [...inboxMessages].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
  )

  return {
    messages,
    counts: {
      total: messages.filter((message) => !message.hidden).length,
      unread: messages.filter((message) => !message.hidden && !message.read)
        .length,
      updates: messages.filter(
        (message) => !message.hidden && message.category === 'update'
      ).length,
      system: messages.filter(
        (message) => !message.hidden && message.category === 'system'
      ).length,
      workflow: messages.filter(
        (message) => !message.hidden && message.category === 'workflow'
      ).length,
      errors: messages.filter(
        (message) => !message.hidden && message.category === 'error'
      ).length,
      hidden: messages.filter((message) => message.hidden).length,
    },
    updatedAt: new Date().toISOString(),
  }
}

export async function fetchInboxSummary() {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<{ inbox?: InboxSummary }>(
      '/api/inbox'
    )
    return structuredClone(
      payload.inbox ?? {
        messages: [],
        counts: {
          total: 0,
          unread: 0,
          updates: 0,
          system: 0,
          workflow: 0,
          errors: 0,
          hidden: 0,
        },
        updatedAt: new Date().toISOString(),
      }
    )
  }

  return structuredClone(buildInboxSummary())
}

export async function runInboxMessageAction(options: {
  messageId: string
  action: InboxMessageActionKind
}) {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<InboxMessageActionResult>(
      `/api/inbox/messages/${encodeURIComponent(options.messageId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: options.action }),
      }
    )
    return structuredClone(payload)
  }

  inboxMessages = inboxMessages.map((message) => {
    if (message.id !== options.messageId) return message

    if (options.action === 'mark_read') {
      return {
        ...message,
        read: true,
        actions: message.actions.map((action) =>
          action.kind === 'mark_read'
            ? { ...action, kind: 'mark_unread', label: 'Mark Unread' }
            : action
        ),
      }
    }

    if (options.action === 'mark_unread') {
      return {
        ...message,
        read: false,
        actions: message.actions.map((action) =>
          action.kind === 'mark_unread'
            ? { ...action, kind: 'mark_read', label: 'Mark Read' }
            : action
        ),
      }
    }

    if (options.action === 'hide') {
      return { ...message, hidden: true, read: true }
    }

    return message
  })

  const inbox = buildInboxSummary()
  const message =
    inbox.messages.find((item) => item.id === options.messageId) ??
    inboxMessages.find((item) => item.id === options.messageId)

  if (!message) {
    throw new Error(`Inbox message ${options.messageId} was not found.`)
  }

  return structuredClone({
    ok: true,
    message,
    inbox,
  } satisfies InboxMessageActionResult)
}

export async function fetchSecurityState() {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<{
      security?: ServiceSecurityState
    }>('/api/security')
    if (!payload.security) {
      throw new RuntimeApiUnavailableError({
        mode: resolveRuntimeApiMode(),
        path: '/api/security',
        endpoint:
          serviceLassoApiBaseUrl == null
            ? null
            : buildRuntimeEndpoint('/api/security', serviceLassoApiBaseUrl),
        status: 200,
        contentType: 'application/json',
        packagedProxyConfigured:
          resolveRuntimeApiMode() === 'packaged-runtime' &&
          serviceLassoApiBaseUrl === '',
        reason: 'non_json',
      })
    }

    return structuredClone(payload.security)
  }

  return structuredClone(securityState)
}

export async function fetchMcpState() {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<{
      mcp?: McpState
    }>('/api/mcp')
    if (!payload.mcp) {
      throw new RuntimeApiUnavailableError({
        mode: resolveRuntimeApiMode(),
        path: '/api/mcp',
        endpoint:
          serviceLassoApiBaseUrl == null
            ? null
            : buildRuntimeEndpoint('/api/mcp', serviceLassoApiBaseUrl),
        status: 200,
        contentType: 'application/json',
        packagedProxyConfigured:
          resolveRuntimeApiMode() === 'packaged-runtime' &&
          serviceLassoApiBaseUrl === '',
        reason: 'non_json',
      })
    }

    return structuredClone(payload.mcp)
  }

  return structuredClone(mcpState)
}

export async function fetchDashboardService(serviceId: string) {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<{ service?: DashboardService }>(
      `/api/dashboard/services/${encodeURIComponent(serviceId)}`
    )
    return structuredClone(
      payload.service ? normalizeRuntimeDashboardService(payload.service) : null
    )
  }

  await syncRemoteStateFromApi()
  return (
    structuredClone(services.find((service) => service.id === serviceId)) ??
    null
  )
}

export async function fetchServiceSetup(serviceId: string) {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      `/api/services/${encodeURIComponent(serviceId)}/setup`
    )
    return normalizeServiceSetupPayload(serviceId, payload)
  }

  await syncRemoteStateFromApi()
  return structuredClone(
    services.find((service) => service.id === serviceId)?.setup ??
      createDemoSetupState(serviceId)
  )
}

function buildSecretsManagementApiPath(section: string, search?: string) {
  const path = `/api/services/${encodeURIComponent(secretsBrokerServiceId)}/secrets/${section}`
  if (!search?.trim()) return path
  return `${path}?search=${encodeURIComponent(search.trim())}`
}

function buildBrokerProviderApiPath(section: string) {
  return `/api/services/${encodeURIComponent(secretsBrokerServiceId)}/providers/${section}`
}

function buildBrokerLifecycleApiPath(section: string) {
  return `/api/services/${encodeURIComponent(secretsBrokerServiceId)}/lifecycle/${section}`
}

function buildBrokerOperationsApiPath(section: string) {
  return `/api/services/${encodeURIComponent(secretsBrokerServiceId)}/operations/${section}`
}

function requireRecord(value: unknown, message: string) {
  if (!isRecord(value)) throw new Error(message)
  return value
}

function requireIdentifierArray(
  value: unknown,
  field: string,
  options: { allowWildcard?: boolean } = {}
) {
  if (!Array.isArray(value)) {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  return value.map((item) =>
    options.allowWildcard && item === '*'
      ? '*'
      : requireSafeBrokerIdentifier(item, field)
  )
}

function requireSafeBrokerOperationPath(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error(
      'Secrets Broker returned an invalid provider operation path.'
    )
  }
  const normalized = value.trim()
  if (
    !/^\/(?:[a-z0-9@._:+~-]+|\{[a-z][a-z0-9_]{0,63}\})(?:\/(?:[a-z0-9@._:+~-]+|\{[a-z][a-z0-9_]{0,63}\}))*$/i.test(
      normalized
    ) ||
    containsUnsafeBrokerText(normalized)
  ) {
    throw new Error(
      'Secrets Broker returned an invalid provider operation path.'
    )
  }
  return normalized
}

export function normalizeSecretsManagementState(
  payload: unknown
): SecretsManagementState {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid management response.'
  )
  if (!Array.isArray(input.results) || typeof input.valueSearch !== 'boolean') {
    throw new Error('Secrets Broker returned an invalid management response.')
  }

  return {
    serviceId: requireSafeBrokerIdentifier(input.serviceId, 'service id'),
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    query:
      typeof input.query === 'string'
        ? sanitizeBrokerDisplayText(input.query)
        : undefined,
    valueSearch: input.valueSearch,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    results: input.results.map((entry) => {
      const record = requireRecord(
        entry,
        'Secrets Broker returned an invalid managed secret record.'
      )
      const tombstone =
        record.tombstone === undefined
          ? undefined
          : (() => {
              const value = requireRecord(
                record.tombstone,
                'Secrets Broker returned invalid tombstone inventory metadata.'
              )
              if (
                value.state !== 'decommissioned' ||
                typeof value.version !== 'string' ||
                typeof value.decommissionOperationId !== 'string' ||
                typeof value.decommissionedAt !== 'string' ||
                Number.isNaN(Date.parse(value.decommissionedAt))
              ) {
                throw new Error(
                  'Secrets Broker returned invalid tombstone inventory metadata.'
                )
              }
              return {
                state: 'decommissioned',
                version: requireSafeBrokerIdentifier(
                  value.version,
                  'tombstone version'
                ),
                decommissionOperationId: requireSafeBrokerIdentifier(
                  value.decommissionOperationId,
                  'decommission operation id'
                ),
                decommissionedAt: value.decommissionedAt,
              }
            })()
      return {
        ref: requireSafeBrokerIdentifier(record.ref, 'secret ref'),
        name: requireSafeBrokerIdentifier(record.name, 'secret name'),
        sourceId: requireSafeBrokerIdentifier(record.sourceId, 'source id'),
        providerKind: requireSafeBrokerIdentifier(
          record.providerKind,
          'provider kind'
        ),
        ownerServiceId:
          record.ownerServiceId === undefined
            ? undefined
            : requireSafeBrokerIdentifier(
                record.ownerServiceId,
                'owner service id'
              ),
        workspaceId:
          record.workspaceId === undefined
            ? undefined
            : requireSafeBrokerIdentifier(record.workspaceId, 'workspace id'),
        state:
          sanitizeBrokerDisplayText(record.state) ?? '[missing broker state]',
        outcome:
          sanitizeBrokerDisplayText(record.outcome) ??
          '[missing broker outcome]',
        capabilities: requireIdentifierArray(
          record.capabilities,
          'secret capabilities'
        ),
        policy: sanitizeBrokerDisplayText(record.policy),
        auditStatus: sanitizeBrokerDisplayText(record.auditStatus),
        valueSearch: sanitizeBrokerDisplayText(record.valueSearch),
        tombstone,
      }
    }),
  }
}

function normalizeSecretRevealResponse(
  payload: unknown,
  request: SecretRevealRequest
): SecretRevealResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid reveal response.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.ref !== request.ref ||
    input.operation !== 'reveal' ||
    typeof input.value !== 'string' ||
    !input.value ||
    input.value.length > 1_048_576 ||
    !Number.isInteger(input.ttlSeconds) ||
    (input.ttlSeconds as number) < 1 ||
    (input.ttlSeconds as number) > 300
  ) {
    throw new Error('Secrets Broker returned an invalid reveal response.')
  }
  const metadata =
    input.metadata === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(
            requireRecord(
              input.metadata,
              'Secrets Broker returned invalid reveal metadata.'
            )
          ).map(([key, value]) => [
            requireSafeBrokerIdentifier(key, 'reveal metadata key'),
            sanitizeBrokerDisplayText(value) ?? '[missing broker metadata]',
          ])
        )

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    ref: request.ref,
    operation: 'reveal',
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    value: input.value,
    metadata,
    ttlSeconds: input.ttlSeconds as number,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
  }
}

export async function fetchSecretsManagementState(search = '') {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const safeSearch = validateBrokerSearchInput(search)
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('management', safeSearch)
    )
    return structuredClone(normalizeSecretsManagementState(payload))
  }

  const query = search.trim().toLowerCase()
  const results = query
    ? secretsManagementFixture.results.filter((record) =>
        [
          record.ref,
          record.name,
          record.sourceId,
          record.providerKind,
          record.ownerServiceId,
          record.outcome,
        ].some((value) => value?.toLowerCase().includes(query))
      )
    : secretsManagementFixture.results

  return structuredClone({
    ...secretsManagementFixture,
    query: search,
    results,
  })
}

export async function revealManagedSecret(
  request: SecretRevealRequest,
  auditContext?: {
    actorId: string
    actorKind: 'local-root' | 'zitadel' | 'local-token'
    workspaceId?: string
  }
) {
  await wait(120)

  const reason = request.reason.trim()
  if (!reason) {
    throw new Error('Audit reason is required before reveal.')
  }
  if (!request.confirm) {
    throw new Error('Explicit confirmation is required before reveal.')
  }

  if (!serviceLassoStubDataEnabled) {
    if (!auditContext) {
      throw new Error('A trusted runtime identity is required before reveal.')
    }
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('reveal'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: `service-admin-${Date.now()}`,
          serviceId: '@serviceadmin',
          ref: request.ref,
          reason,
          confirm: true,
          actor: auditContext,
        }),
      }
    )
    return structuredClone(normalizeSecretRevealResponse(payload, request))
  }

  const record = secretsManagementFixture.results.find(
    (item) => item.ref === request.ref
  )
  if (
    !record ||
    record.outcome !== 'ready' ||
    !record.capabilities.includes('reveal') ||
    record.auditStatus !== 'audit_available'
  ) {
    throw new Error('Secret reveal is not available for this record.')
  }

  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-reveal-${Date.now()}`,
    ref: request.ref,
    operation: 'reveal',
    outcome: 'ready',
    value: 'fixture-revealed-value-425',
    metadata: {
      sourceId: record.sourceId,
      providerKind: record.providerKind,
    },
    ttlSeconds: 60,
    auditStatus: 'audit_ready',
  } satisfies SecretRevealResult)
}

function normalizeSecretCreateResponse(
  payload: unknown,
  request: SecretCreateRequest,
  mode: 'dry-run' | 'apply'
): SecretCreateResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid create response.'
  )
  const planInput = input.plan
  let plan: SecretCreatePlan | undefined
  if (planInput !== undefined) {
    const candidate = requireRecord(
      planInput,
      'Secrets Broker returned an invalid create plan.'
    )
    if (
      candidate.ref !== request.ref ||
      candidate.operationId !== request.operationId ||
      candidate.generationMode !== request.generationMode ||
      candidate.expectedState !== 'missing' ||
      typeof candidate.expiresAt !== 'string' ||
      Number.isNaN(Date.parse(candidate.expiresAt)) ||
      typeof candidate.signature !== 'string' ||
      !candidate.signature.startsWith('hmac-sha256:')
    ) {
      throw new Error('Secrets Broker returned an invalid create plan.')
    }
    plan = {
      ref: request.ref,
      operationId: request.operationId,
      generationMode: request.generationMode,
      expectedState: 'missing',
      expiresAt: candidate.expiresAt,
      signature: candidate.signature,
    }
  }
  if (
    input.serviceId !== secretsBrokerServiceId ||
    typeof input.apiVersion !== 'string' ||
    typeof input.requestId !== 'string' ||
    input.operationId !== request.operationId ||
    input.ref !== request.ref ||
    input.operation !== 'create' ||
    input.mode !== mode ||
    input.generationMode !== request.generationMode ||
    typeof input.outcome !== 'string' ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean' ||
    typeof input.auditStatus !== 'string' ||
    typeof input.policyResult !== 'string' ||
    !Array.isArray(input.affectedRefs) ||
    !input.affectedRefs.every((item) => typeof item === 'string') ||
    !Array.isArray(input.affectedServices) ||
    !input.affectedServices.every((item) => typeof item === 'string') ||
    Object.prototype.hasOwnProperty.call(input, 'value')
  ) {
    throw new Error('Secrets Broker returned an invalid create response.')
  }
  if (mode === 'dry-run' && !plan) {
    throw new Error('Secrets Broker did not return a signed create plan.')
  }
  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    operationId: request.operationId,
    ref: request.ref,
    operation: 'create',
    mode,
    generationMode: request.generationMode,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: input.applied,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    policyResult:
      sanitizeBrokerDisplayText(input.policyResult) ??
      '[missing broker policy result]',
    nextAction:
      typeof input.nextAction === 'string'
        ? sanitizeBrokerDisplayText(input.nextAction)
        : undefined,
    plan,
    affectedRefs: requireIdentifierArray(input.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      input.affectedServices,
      'affected services'
    ),
  }
}

function validateSecretCreateRequest(
  request: SecretCreateRequest,
  apply: boolean
) {
  if (!request.ref.trim() || !request.operationId.trim()) {
    throw new Error('A secret reference and operation id are required.')
  }
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before create.')
  }
  if (
    request.generationMode === 'operator_supplied' &&
    apply &&
    !request.value?.trim()
  ) {
    throw new Error('A secret value is required for operator-supplied create.')
  }
  if (request.generationMode === 'broker_generated' && request.value) {
    throw new Error('Broker-generated create cannot include a secret value.')
  }
}

export async function previewManagedSecretCreate(request: SecretCreateRequest) {
  await wait(120)
  validateSecretCreateRequest(request, false)
  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('create/dry-run'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: `serviceadmin-create-preview-${Date.now()}`,
          serviceId: '@serviceadmin',
          ref: request.ref,
          operationId: request.operationId,
          generationMode: request.generationMode,
          reason: request.reason.trim(),
        }),
      }
    )
    return structuredClone(
      normalizeSecretCreateResponse(payload, request, 'dry-run')
    )
  }
  const plan: SecretCreatePlan = {
    ref: request.ref,
    operationId: request.operationId,
    generationMode: request.generationMode,
    expectedState: 'missing',
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    signature: 'hmac-sha256:stub-create-plan',
  }
  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-create-preview-${Date.now()}`,
    operationId: request.operationId,
    ref: request.ref,
    operation: 'create',
    mode: 'dry-run',
    generationMode: request.generationMode,
    outcome: 'dry_run_ready',
    applied: false,
    requiresConfirmation: true,
    auditStatus: 'audit_recorded',
    policyResult: 'allowed',
    nextAction: 'confirm_signed_plan_before_expiry',
    plan,
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretCreateResult)
}

export async function applyManagedSecretCreate(request: SecretCreateRequest) {
  await wait(120)
  validateSecretCreateRequest(request, true)
  if (!request.plan) {
    throw new Error('A signed create plan is required before apply.')
  }
  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('create/apply'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: `serviceadmin-create-apply-${Date.now()}`,
          serviceId: '@serviceadmin',
          ref: request.ref,
          operationId: request.operationId,
          generationMode: request.generationMode,
          reason: request.reason.trim(),
          confirm: true,
          ...(request.generationMode === 'operator_supplied'
            ? { value: request.value }
            : {}),
          plan: request.plan,
        }),
      }
    )
    return structuredClone(
      normalizeSecretCreateResponse(payload, request, 'apply')
    )
  }
  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-create-apply-${Date.now()}`,
    operationId: request.operationId,
    ref: request.ref,
    operation: 'create',
    mode: 'apply',
    generationMode: request.generationMode,
    outcome: 'applied',
    applied: true,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
    policyResult: 'allowed',
    nextAction: 'secret_created',
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretCreateResult)
}

function validateSecretMutationRequest(
  request: SecretMutationRequest,
  requireValue: boolean
) {
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before mutation.')
  }
  if (requireValue && !request.value?.trim()) {
    throw new Error('A replacement value is required before apply.')
  }
}

function secretMutationPath(
  operation: SecretMutationRequest['operation'],
  action: 'dry-run' | 'apply'
) {
  return buildSecretsManagementApiPath(`${operation}/${action}`)
}

function assertSecretMutationResponse(
  payload: unknown,
  request: SecretMutationRequest,
  mode: 'dry-run' | 'apply'
): SecretMutationResult {
  if (!isRecord(payload)) {
    throw new Error('Secrets Broker returned an invalid mutation response.')
  }
  const expectedMode = mode === 'apply' ? 'apply' : 'dry-run'
  if (
    payload.serviceId !== secretsBrokerServiceId ||
    typeof payload.apiVersion !== 'string' ||
    typeof payload.requestId !== 'string' ||
    payload.ref !== request.ref ||
    payload.operation !== request.operation ||
    payload.mode !== expectedMode ||
    typeof payload.outcome !== 'string' ||
    typeof payload.applied !== 'boolean' ||
    typeof payload.requiresConfirmation !== 'boolean' ||
    typeof payload.auditStatus !== 'string' ||
    !Array.isArray(payload.affectedRefs) ||
    !payload.affectedRefs.every((item) => typeof item === 'string') ||
    !Array.isArray(payload.affectedServices) ||
    !payload.affectedServices.every((item) => typeof item === 'string') ||
    Object.prototype.hasOwnProperty.call(payload, 'value')
  ) {
    throw new Error('Secrets Broker returned an invalid mutation response.')
  }

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: payload.apiVersion,
    requestId: payload.requestId,
    ref: request.ref,
    operation: request.operation,
    mode: expectedMode,
    outcome:
      sanitizeBrokerDisplayText(payload.outcome) ?? '[missing broker outcome]',
    applied: payload.applied,
    requiresConfirmation: payload.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(payload.auditStatus) ??
      '[missing broker audit status]',
    nextAction:
      typeof payload.nextAction === 'string'
        ? sanitizeBrokerDisplayText(payload.nextAction)
        : undefined,
    affectedRefs: requireIdentifierArray(payload.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      payload.affectedServices,
      'affected services'
    ),
  }
}

export async function previewManagedSecretMutation(
  request: SecretMutationRequest
) {
  await wait(120)
  validateSecretMutationRequest(request, false)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      secretMutationPath(request.operation, 'dry-run'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          reason: request.reason.trim(),
        }),
      }
    )
    return assertSecretMutationResponse(payload, request, 'dry-run')
  }

  const record = secretsManagementFixture.results.find(
    (item) => item.ref === request.ref
  )
  if (
    !record ||
    record.outcome !== 'ready' ||
    record.providerKind !== 'local-encrypted-store' ||
    !record.capabilities.includes(request.operation) ||
    record.auditStatus !== 'audit_available'
  ) {
    throw new Error('Secret mutation is not available for this record.')
  }

  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-${request.operation}-preview-${Date.now()}`,
    ref: request.ref,
    operation: request.operation,
    mode: 'dry-run',
    outcome: 'dry_run_ready',
    applied: false,
    requiresConfirmation: true,
    auditStatus: 'audit_ready',
    nextAction: 'confirm_and_apply_with_audit_reason',
    affectedRefs: [request.ref],
    affectedServices: record.ownerServiceId ? [record.ownerServiceId] : [],
  } satisfies SecretMutationResult)
}

export async function applyManagedSecretMutation(
  request: SecretMutationRequest
) {
  await wait(120)
  validateSecretMutationRequest(request, true)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      secretMutationPath(request.operation, 'apply'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          reason: request.reason.trim(),
          confirm: true,
          value: request.value,
        }),
      }
    )
    return assertSecretMutationResponse(payload, request, 'apply')
  }

  await previewManagedSecretMutation(request)
  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-${request.operation}-apply-${Date.now()}`,
    ref: request.ref,
    operation: request.operation,
    mode: 'apply',
    outcome: 'applied',
    applied: true,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretMutationResult)
}

function normalizeSecretPolicyPreviewResponse(
  payload: unknown,
  request: SecretPolicyPreviewRequest
): SecretPolicyPreviewResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid policy preview.'
  )
  const record = requireRecord(
    input.record,
    'Secrets Broker returned an invalid policy preview record.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.ref !== request.ref ||
    input.operation !== 'policy' ||
    input.mode !== 'preview' ||
    input.outcome !== 'unsupported' ||
    input.applied !== false ||
    input.requiresConfirmation !== false ||
    input.unsupportedCapability !== 'policy_binding_persistence' ||
    record.ref !== request.ref ||
    Object.prototype.hasOwnProperty.call(input, 'value') ||
    Object.prototype.hasOwnProperty.call(input, 'payload') ||
    Object.prototype.hasOwnProperty.call(record, 'value') ||
    Object.prototype.hasOwnProperty.call(record, 'payload')
  ) {
    throw new Error('Secrets Broker returned an invalid policy preview.')
  }

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    ref: request.ref,
    operation: 'policy',
    mode: 'preview',
    outcome: 'unsupported',
    applied: false,
    requiresConfirmation: false,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    nextAction:
      sanitizeBrokerDisplayText(input.nextAction) ??
      '[missing broker next action]',
    unsupportedCapability: 'policy_binding_persistence',
    currentPolicy: sanitizeBrokerDisplayText(record.policy),
    affectedRefs: requireIdentifierArray(input.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      input.affectedServices,
      'affected services'
    ),
  }
}

export async function previewManagedSecretPolicy(
  request: SecretPolicyPreviewRequest
) {
  await wait(120)
  requireSafeBrokerIdentifier(request.ref, 'secret ref')

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('policy/preview'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: request.ref }),
      }
    )
    return normalizeSecretPolicyPreviewResponse(payload, request)
  }

  const record = secretsManagementFixture.results.find(
    (item) => item.ref === request.ref
  )
  if (
    !record ||
    record.outcome !== 'ready' ||
    !record.capabilities.includes('policy') ||
    record.auditStatus !== 'audit_available'
  ) {
    throw new Error('Secret policy status is not available for this record.')
  }

  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-policy-preview-${Date.now()}`,
    ref: request.ref,
    operation: 'policy',
    mode: 'preview',
    outcome: 'unsupported',
    applied: false,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
    nextAction: 'wait_for_policy_binding_persistence',
    unsupportedCapability: 'policy_binding_persistence',
    currentPolicy: record.policy,
    affectedRefs: [request.ref],
    affectedServices: record.ownerServiceId ? [record.ownerServiceId] : [],
  } satisfies SecretPolicyPreviewResult)
}

function normalizeBrokerOperationCapability(
  value: unknown
): BrokerOperationCapability {
  const input = requireRecord(
    value,
    'Secrets Broker returned an invalid provider operation.'
  )
  if (
    typeof input.authenticationRequired !== 'boolean' ||
    typeof input.policyRequired !== 'boolean' ||
    typeof input.auditRequired !== 'boolean'
  ) {
    throw new Error('Secrets Broker returned an invalid provider operation.')
  }
  return {
    operationId: requireSafeBrokerIdentifier(
      input.operationId,
      'provider operation id'
    ),
    method: requireSafeBrokerIdentifier(input.method, 'provider method'),
    path: requireSafeBrokerOperationPath(input.path),
    maturity: requireSafeBrokerIdentifier(
      input.maturity,
      'provider operation maturity'
    ),
    classification: requireSafeBrokerIdentifier(
      input.classification,
      'provider operation classification'
    ),
    authenticationRequired: input.authenticationRequired,
    policyRequired: input.policyRequired,
    auditRequired: input.auditRequired,
    scope: requireSafeBrokerIdentifier(input.scope, 'provider operation scope'),
    completionMode: requireSafeBrokerIdentifier(
      input.completionMode,
      'provider completion mode'
    ),
    limitationCode: requireSafeBrokerIdentifier(
      input.limitationCode,
      'provider limitation code',
      { allowEmpty: true }
    ),
    reasonCode: requireSafeBrokerIdentifier(
      input.reasonCode,
      'provider reason code',
      { allowEmpty: true }
    ),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'provider next action',
      { allowEmpty: true }
    ),
  }
}

function normalizeBrokerProviderStatus(value: unknown): BrokerProviderStatus {
  const input = requireRecord(
    value,
    'Secrets Broker returned an invalid provider status.'
  )
  if (!Array.isArray(input.operations)) {
    throw new Error('Secrets Broker returned an invalid provider status.')
  }
  return {
    providerId: requireSafeBrokerIdentifier(input.providerId, 'provider id'),
    providerKind: requireSafeBrokerIdentifier(
      input.providerKind,
      'provider kind'
    ),
    displayName:
      sanitizeBrokerDisplayText(input.displayName) ?? '[missing provider name]',
    state: sanitizeBrokerDisplayText(input.state) ?? '[missing provider state]',
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing provider outcome]',
    credentialHandle: sanitizeBrokerDisplayText(input.credentialHandle),
    address: sanitizeBrokerDisplayText(input.address),
    namespaces: requireIdentifierArray(
      input.namespaces,
      'provider namespaces',
      {
        allowWildcard: true,
      }
    ),
    capabilities: requireIdentifierArray(
      input.capabilities,
      'provider capabilities'
    ),
    operations: input.operations.map(normalizeBrokerOperationCapability),
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
  }
}

function assertNoProviderSecretFields(value: Record<string, unknown>) {
  const forbidden = new Set([
    'credentialvalue',
    'token',
    'password',
    'passphrase',
    'secret',
    'secretvalue',
    'value',
    'payload',
    'privatekey',
    'accesskey',
    'secretaccesskey',
    'sessiontoken',
  ])
  for (const field of Object.keys(value)) {
    if (forbidden.has(field.toLowerCase().replace(/[_-]/g, ''))) {
      throw new Error('Secrets Broker returned credential-bearing metadata.')
    }
  }
}

function assertNoBrokerSecretMaterial(value: unknown, depth = 0) {
  if (depth > 16) {
    throw new Error('Secrets Broker returned excessively nested metadata.')
  }
  if (Array.isArray(value)) {
    for (const item of value) assertNoBrokerSecretMaterial(item, depth + 1)
    return
  }
  if (!isRecord(value)) return
  assertNoProviderSecretFields(value)
  for (const nested of Object.values(value)) {
    assertNoBrokerSecretMaterial(nested, depth + 1)
  }
}

function requireBrokerCount(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  return value
}

function requireBrokerTimestamp(value: unknown, field: string) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  return value
}

function requireBrokerMetadata(value: unknown, field: string) {
  const normalized = sanitizeBrokerDisplayText(value)
  if (!normalized || normalized === withheldBrokerText) {
    throw new Error(`Secrets Broker returned invalid ${field}.`)
  }
  return normalized
}

function containsBrokerControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || code === 0x7f
  })
}

const brokerLockoutScopePattern =
  /^(?:local_api|management|writeback):[-A-Za-z0-9@._:/+~\\]{1,480}$/u

function requireBrokerLockoutScope(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('Secrets Broker returned an invalid lockout scope.')
  }
  const scope = value.trim()
  if (
    !brokerLockoutScopePattern.test(scope) ||
    containsBrokerControlCharacter(scope)
  ) {
    throw new Error('Secrets Broker returned an invalid lockout scope.')
  }
  return scope
}

export function normalizeBrokerTelemetry(payload: unknown): BrokerTelemetry {
  assertNoBrokerSecretMaterial(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid telemetry metadata.'
  )
  const counters = requireRecord(
    input.counters,
    'Secrets Broker returned invalid telemetry counters.'
  )
  const safety = requireRecord(
    input.safety,
    'Secrets Broker returned invalid telemetry safety metadata.'
  )
  if (
    !Array.isArray(counters.operations) ||
    !Array.isArray(counters.policyDecisions) ||
    !Array.isArray(counters.providerStates) ||
    !Array.isArray(counters.sourceStates) ||
    !Array.isArray(counters.auditRecords) ||
    safety.lowCardinalityLabels !== true ||
    safety.valueMaterialIncluded !== false
  ) {
    throw new Error('Secrets Broker telemetry failed its safety contract.')
  }

  const normalizeOutcomeCounter = (value: unknown) => {
    const record = requireRecord(
      value,
      'Secrets Broker returned an invalid telemetry outcome counter.'
    )
    return {
      outcome: requireBrokerMetadata(record.outcome, 'telemetry outcome'),
      count: requireBrokerCount(record.count, 'telemetry count'),
    }
  }
  const normalizeStateCounter = (value: unknown) => {
    const record = requireRecord(
      value,
      'Secrets Broker returned an invalid telemetry state counter.'
    )
    return {
      id: requireSafeBrokerIdentifier(record.id, 'telemetry state id'),
      state: requireBrokerMetadata(record.state, 'telemetry state'),
      outcome: requireBrokerMetadata(record.outcome, 'telemetry outcome'),
      count: requireBrokerCount(record.count, 'telemetry count'),
    }
  }

  return {
    serviceId: requireSafeBrokerIdentifier(
      input.serviceId,
      'telemetry service id'
    ) as '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(
      input.apiVersion,
      'telemetry API version'
    ),
    contractVersion: requireSafeBrokerIdentifier(
      input.contractVersion,
      'telemetry contract version'
    ),
    outcome: requireBrokerMetadata(input.outcome, 'telemetry outcome'),
    generatedAt: requireBrokerTimestamp(
      input.generatedAt,
      'telemetry timestamp'
    ),
    counters: {
      operations: counters.operations.map((value) => {
        const record = requireRecord(
          value,
          'Secrets Broker returned an invalid operation counter.'
        )
        return {
          operation: requireSafeBrokerIdentifier(
            record.operation,
            'telemetry operation'
          ),
          outcome: requireBrokerMetadata(
            record.outcome,
            'telemetry operation outcome'
          ),
          count: requireBrokerCount(record.count, 'telemetry operation count'),
        }
      }),
      policyDecisions: counters.policyDecisions.map(normalizeOutcomeCounter),
      localApiAuthFailures: requireBrokerCount(
        counters.localApiAuthFailures,
        'local API auth failure count'
      ),
      activeLockouts: requireBrokerCount(
        counters.activeLockouts,
        'active lockout count'
      ),
      providerStates: counters.providerStates.map(normalizeStateCounter),
      sourceStates: counters.sourceStates.map(normalizeStateCounter),
      auditRecords: counters.auditRecords.map((value) => {
        const record = requireRecord(
          value,
          'Secrets Broker returned an invalid audit counter.'
        )
        return {
          auditStatus: requireBrokerMetadata(
            record.auditStatus,
            'telemetry audit status'
          ),
          outcome: requireBrokerMetadata(
            record.outcome,
            'telemetry audit outcome'
          ),
          count: requireBrokerCount(record.count, 'telemetry audit count'),
        }
      }),
    },
    safety: {
      lowCardinalityLabels: true,
      valueMaterialIncluded: false,
    },
  }
}

export function normalizeBrokerEvents(payload: unknown): BrokerEventsResult {
  assertNoBrokerSecretMaterial(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid operational events.'
  )
  const safety = requireRecord(
    input.safety,
    'Secrets Broker returned invalid event safety metadata.'
  )
  if (
    !Array.isArray(input.events) ||
    safety.metadataOnly !== true ||
    safety.rawRefIncluded !== false ||
    safety.valueMaterialIncluded !== false
  ) {
    throw new Error(
      'Secrets Broker events failed their metadata-only contract.'
    )
  }
  const optionalIdentifier = (value: unknown, field: string) =>
    value === undefined || value === ''
      ? undefined
      : requireSafeBrokerIdentifier(value, field)
  return {
    serviceId: requireSafeBrokerIdentifier(
      input.serviceId,
      'event service id'
    ) as '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(
      input.apiVersion,
      'event API version'
    ),
    outcome: requireBrokerMetadata(input.outcome, 'event outcome'),
    generatedAt: requireBrokerTimestamp(input.generatedAt, 'event timestamp'),
    limit: requireBrokerCount(input.limit, 'event limit'),
    nextCursor: optionalIdentifier(input.nextCursor, 'event cursor'),
    events: input.events.map((value) => {
      const record = requireRecord(
        value,
        'Secrets Broker returned an invalid operational event.'
      )
      return {
        id: requireSafeBrokerIdentifier(record.id, 'event id'),
        ts: requireBrokerTimestamp(record.ts, 'event timestamp'),
        family: requireSafeBrokerIdentifier(record.family, 'event family'),
        severity: requireSafeBrokerIdentifier(
          record.severity,
          'event severity'
        ),
        operation: requireSafeBrokerIdentifier(
          record.operation,
          'event operation'
        ),
        serviceId: optionalIdentifier(record.serviceId, 'event service id'),
        providerId: optionalIdentifier(record.providerId, 'event provider id'),
        sourceId: optionalIdentifier(record.sourceId, 'event source id'),
        policyId: optionalIdentifier(record.policyId, 'event policy id'),
        keyId: optionalIdentifier(record.keyId, 'event key id'),
        refPrefix: optionalIdentifier(record.refPrefix, 'event ref prefix'),
        refHash: optionalIdentifier(record.refHash, 'event ref hash'),
        outcome: requireBrokerMetadata(record.outcome, 'event outcome'),
        requestId: optionalIdentifier(record.requestId, 'event request id'),
      }
    }),
    safety: {
      metadataOnly: true,
      rawRefIncluded: false,
      valueMaterialIncluded: false,
    },
  }
}

function buildBrokerEventQuery(filters: BrokerEventFilters) {
  const params = new URLSearchParams()
  for (const [name, raw] of Object.entries(filters)) {
    if (raw === undefined || raw === '') continue
    if (name === 'limit') {
      if (!Number.isInteger(raw) || Number(raw) < 1 || Number(raw) > 200) {
        throw new Error('Event limit must be an integer from 1 to 200.')
      }
    }
    const value = String(raw).trim()
    if (value.length > 256 || containsBrokerControlCharacter(value)) {
      throw new Error('Operational event filter contains unsafe input.')
    }
    params.set(name, value)
  }
  return params.size > 0 ? `?${params}` : ''
}

export async function fetchBrokerTelemetry(): Promise<BrokerTelemetry> {
  await wait(120)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      contractVersion: 'service-lasso.secretsbroker.telemetry-preview.v1',
      outcome: 'ready',
      generatedAt: new Date().toISOString(),
      counters: {
        operations: [],
        policyDecisions: [],
        localApiAuthFailures: 0,
        activeLockouts: 0,
        providerStates: [],
        sourceStates: [],
        auditRecords: [],
      },
      safety: { lowCardinalityLabels: true, valueMaterialIncluded: false },
    })
  }
  return normalizeBrokerTelemetry(
    await fetchRuntimeJson<unknown>(buildBrokerOperationsApiPath('telemetry'))
  )
}

export async function fetchBrokerEvents(
  filters: BrokerEventFilters = {}
): Promise<BrokerEventsResult> {
  await wait(120)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      generatedAt: new Date().toISOString(),
      limit: filters.limit ?? 25,
      events: [],
      safety: {
        metadataOnly: true,
        rawRefIncluded: false,
        valueMaterialIncluded: false,
      },
    })
  }
  return normalizeBrokerEvents(
    await fetchRuntimeJson<unknown>(
      `${buildBrokerOperationsApiPath('events')}${buildBrokerEventQuery(filters)}`
    )
  )
}

export async function clearBrokerLockout(
  request: BrokerLockoutClearRequest
): Promise<BrokerLockoutClearResult> {
  const scope = requireBrokerLockoutScope(request.scope)
  if (!request.reason.trim() || request.reason.trim().length > 256) {
    throw new Error('An audit reason is required to clear a lockout.')
  }
  const payload = serviceLassoStubDataEnabled
    ? {
        serviceId: '@secretsbroker',
        apiVersion: 'v1',
        operation: 'lockout_clear',
        outcome: 'not_found',
        cleared: false,
        lockoutScope: scope,
        auditStatus: 'audit_recorded',
        nextAction: 'check_lockout_scope',
      }
    : await fetchRuntimeJson<unknown>(
        buildSecretsManagementApiPath('lockouts/clear'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope,
            reason: request.reason.trim(),
            confirm: true,
          }),
        }
      )
  assertNoBrokerSecretMaterial(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid lockout response.'
  )
  if (
    input.operation !== 'lockout_clear' ||
    typeof input.cleared !== 'boolean' ||
    input.auditStatus !== 'audit_recorded'
  ) {
    throw new Error(
      'Secrets Broker lockout response failed its audit contract.'
    )
  }
  return {
    serviceId: requireSafeBrokerIdentifier(
      input.serviceId,
      'lockout service id'
    ) as '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(
      input.apiVersion,
      'lockout API version'
    ),
    requestId:
      input.requestId === undefined
        ? undefined
        : requireSafeBrokerIdentifier(input.requestId, 'lockout request id'),
    operation: 'lockout_clear',
    outcome: requireBrokerMetadata(input.outcome, 'lockout outcome'),
    cleared: input.cleared,
    lockoutScope: requireBrokerLockoutScope(input.lockoutScope),
    auditStatus: 'audit_recorded',
    nextAction:
      input.nextAction === undefined
        ? undefined
        : requireSafeBrokerIdentifier(input.nextAction, 'lockout next action'),
  }
}

export function providerSupportsMigrationApply(provider: BrokerProviderStatus) {
  return provider.operations.some(
    (operation) =>
      operation.path === '/v1/providers/migration/apply' &&
      (operation.maturity === 'validated' ||
        operation.maturity === 'executable')
  )
}

export async function fetchBrokerProviderStatus() {
  await wait(120)
  if (serviceLassoStubDataEnabled) {
    return structuredClone(brokerProviderStatusFixture)
  }
  const payload = await fetchRuntimeJson<unknown>(
    buildBrokerProviderApiPath('config/status')
  )
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid provider status response.'
  )
  if (!Array.isArray(input.providers)) {
    throw new Error(
      'Secrets Broker returned an invalid provider status response.'
    )
  }
  const providers = input.providers.map(normalizeBrokerProviderStatus)
  const currentProvider = normalizeBrokerProviderStatus(input.currentProvider)
  return {
    serviceId: requireSafeBrokerIdentifier(input.serviceId, 'service id'),
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    contractVersion: requireSafeBrokerIdentifier(
      input.contractVersion,
      'contract version'
    ),
    manifestVersion: requireSafeBrokerIdentifier(
      input.manifestVersion,
      'manifest version'
    ),
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    currentProvider,
    providers,
  } satisfies BrokerProviderStatusState
}

function normalizeProviderValidationResponse(
  payload: unknown,
  request: BrokerProviderValidationRequest
): BrokerProviderValidationResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid provider validation response.'
  )
  assertNoProviderSecretFields(input)
  const provider = normalizeBrokerProviderStatus(input.provider)
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.operation !== 'validate' ||
    input.applied !== false ||
    input.requiresConfirmation !== false ||
    provider.providerId !== request.providerId ||
    provider.providerKind !== request.providerKind
  ) {
    throw new Error(
      'Secrets Broker returned an invalid provider validation response.'
    )
  }
  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    operation: 'validate',
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: false,
    requiresConfirmation: false,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    provider,
  }
}

export async function validateBrokerProviderConfiguration(
  request: BrokerProviderValidationRequest
) {
  await wait(120)
  for (const [label, value] of [
    ['provider id', request.providerId],
    ['provider kind', request.providerKind],
  ] as const) {
    requireSafeBrokerIdentifier(value, label)
  }
  const displayName = sanitizeBrokerDisplayText(request.displayName)
  if (!displayName || displayName === withheldBrokerText) {
    throw new Error('Provider display name is invalid or unsafe.')
  }
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before provider validation.')
  }
  if (request.address) {
    const address = new URL(request.address)
    if (
      !['http:', 'https:'].includes(address.protocol) ||
      address.username ||
      address.password ||
      address.pathname !== '/' ||
      address.search ||
      address.hash
    ) {
      throw new Error('Provider address must be a safe HTTP(S) origin.')
    }
  }
  if (request.credentialRef) {
    requireSafeBrokerIdentifier(request.credentialRef, 'credential ref')
  }
  request.namespaces.forEach((namespace) => {
    if (namespace !== '*') {
      requireSafeBrokerIdentifier(namespace, 'provider namespace')
    }
  })

  if (serviceLassoStubDataEnabled) {
    const provider = brokerProviderStatusFixture.providers.find(
      (candidate) => candidate.providerId === request.providerId
    ) ?? {
      ...brokerProviderStatusFixture.providers[1],
      providerId: request.providerId,
      providerKind: request.providerKind,
      displayName,
    }
    return structuredClone({
      serviceId: secretsBrokerServiceId,
      apiVersion: brokerProviderStatusFixture.apiVersion,
      requestId: `stub-provider-validation-${Date.now()}`,
      operation: 'validate',
      outcome: 'ready',
      applied: false,
      requiresConfirmation: false,
      auditStatus: 'audit_recorded',
      provider,
    } satisfies BrokerProviderValidationResult)
  }

  const payload = await fetchRuntimeJson<unknown>(
    buildBrokerProviderApiPath('config/validate'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: `serviceadmin-provider-validate-${Date.now()}`,
        serviceId: '@serviceadmin',
        providerId: request.providerId,
        providerKind: request.providerKind,
        displayName,
        address: request.address,
        credentialRef: request.credentialRef,
        namespaces: request.namespaces,
        reason: request.reason.trim(),
        validationMode: 'connectivity_and_capabilities',
      }),
    }
  )
  return normalizeProviderValidationResponse(payload, request)
}

function normalizeBrokerMigrationItem(value: unknown): BrokerMigrationItem {
  const input = requireRecord(
    value,
    'Secrets Broker returned an invalid migration item.'
  )
  assertNoProviderSecretFields(input)
  return {
    ref: requireSafeBrokerIdentifier(input.ref, 'migration ref'),
    sourceProviderId: requireSafeBrokerIdentifier(
      input.sourceProviderId,
      'source provider id'
    ),
    targetProviderId: requireSafeBrokerIdentifier(
      input.targetProviderId,
      'target provider id'
    ),
    ownerServiceId: requireSafeBrokerIdentifier(
      input.ownerServiceId,
      'owner service id',
      { allowEmpty: true }
    ),
    state: requireSafeBrokerIdentifier(input.state, 'migration state'),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'migration outcome'),
    risk: requireSafeBrokerIdentifier(input.risk, 'migration risk'),
    expectedAction: requireSafeBrokerIdentifier(
      input.expectedAction,
      'migration expected action'
    ),
    policyResult: requireSafeBrokerIdentifier(
      input.policyResult,
      'migration policy result'
    ),
    auditRequirement: requireSafeBrokerIdentifier(
      input.auditRequirement,
      'migration audit requirement'
    ),
    recovery: requireSafeBrokerIdentifier(
      input.recovery,
      'migration recovery action'
    ),
  }
}

function normalizeBrokerMigrationResponse(
  payload: unknown,
  request: BrokerMigrationRequest,
  apply: boolean
): BrokerMigrationResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid migration response.'
  )
  assertNoProviderSecretFields(input)
  const expectedOperation = apply ? 'migration_apply' : 'migration_dry_run'
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.operationId !== request.operationId ||
    input.operation !== expectedOperation ||
    input.sourceProviderId !== request.sourceProviderId ||
    input.targetProviderId !== request.targetProviderId ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean' ||
    !Array.isArray(input.results)
  ) {
    throw new Error('Secrets Broker returned an invalid migration response.')
  }
  const results = input.results.map(normalizeBrokerMigrationItem)
  const requestedRefs = [...request.refs].sort()
  const returnedRefs = results.map((item) => item.ref).sort()
  if (JSON.stringify(requestedRefs) !== JSON.stringify(returnedRefs)) {
    throw new Error('Secrets Broker returned an invalid migration response.')
  }
  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    operationId: request.operationId,
    operation: expectedOperation,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: input.applied,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    sourceProviderId: request.sourceProviderId,
    targetProviderId: request.targetProviderId,
    results,
    rollback:
      sanitizeBrokerDisplayText(input.rollback) ??
      '[missing migration recovery guidance]',
  }
}

function validateBrokerMigrationRequest(request: BrokerMigrationRequest) {
  requireSafeBrokerIdentifier(request.operationId, 'migration operation id')
  requireSafeBrokerIdentifier(request.sourceProviderId, 'source provider id')
  requireSafeBrokerIdentifier(request.targetProviderId, 'target provider id')
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before provider migration.')
  }
  if (!request.refs.length) {
    throw new Error('At least one secret reference is required for migration.')
  }
  request.refs.forEach((ref) =>
    requireSafeBrokerIdentifier(ref, 'migration ref')
  )
}

async function runBrokerMigration(
  request: BrokerMigrationRequest,
  apply: boolean
) {
  await wait(120)
  validateBrokerMigrationRequest(request)
  if (serviceLassoStubDataEnabled) {
    const target = brokerProviderStatusFixture.providers.find(
      (provider) => provider.providerId === request.targetProviderId
    )
    const executable = Boolean(target && providerSupportsMigrationApply(target))
    const nowOutcome = apply
      ? executable
        ? 'applied'
        : 'unsupported'
      : 'dry_run_ready'
    return structuredClone({
      serviceId: secretsBrokerServiceId,
      apiVersion: brokerProviderStatusFixture.apiVersion,
      requestId: `stub-migration-${apply ? 'apply' : 'preview'}-${Date.now()}`,
      operationId: request.operationId,
      operation: apply ? 'migration_apply' : 'migration_dry_run',
      outcome: nowOutcome,
      applied: apply && executable,
      requiresConfirmation: !apply,
      auditStatus: 'audit_recorded',
      nextAction: executable
        ? 'verify_target_metadata'
        : 'select_executable_target',
      sourceProviderId: request.sourceProviderId,
      targetProviderId: request.targetProviderId,
      results: request.refs.map((ref) => ({
        ref,
        sourceProviderId: request.sourceProviderId,
        targetProviderId: request.targetProviderId,
        ownerServiceId: 'app',
        state: apply && executable ? 'migrated' : 'planned',
        outcome: apply && executable ? 'migrated' : 'dry_run_ready',
        risk: 'high',
        expectedAction: 'copy_value_inside_broker',
        policyResult: 'allowed',
        auditRequirement: 'required',
        recovery: 'retry_after_fix_or_restore_from_backup',
      })),
      rollback:
        'restore from encrypted backup or rerun after fixing provider state',
    } satisfies BrokerMigrationResult)
  }
  const payload = await fetchRuntimeJson<unknown>(
    buildBrokerProviderApiPath(`migration/${apply ? 'apply' : 'dry-run'}`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: `serviceadmin-migration-${Date.now()}`,
        serviceId: '@serviceadmin',
        operationId: request.operationId,
        sourceProviderId: request.sourceProviderId,
        targetProviderId: request.targetProviderId,
        refs: request.refs,
        reason: request.reason.trim(),
        confirm: apply,
      }),
    }
  )
  return normalizeBrokerMigrationResponse(payload, request, apply)
}

export function previewBrokerMigration(request: BrokerMigrationRequest) {
  return runBrokerMigration(request, false)
}

export function applyBrokerMigration(request: BrokerMigrationRequest) {
  return runBrokerMigration(request, true)
}

function normalizeBrokerBulkCampaignItem(
  value: unknown
): BrokerBulkCampaignItem {
  const input = requireRecord(
    value,
    'Secrets Broker returned an invalid bulk campaign item.'
  )
  assertNoProviderSecretFields(input)
  if (
    typeof input.applied !== 'boolean' ||
    typeof input.retrySafe !== 'boolean' ||
    typeof input.verified !== 'boolean'
  ) {
    throw new Error('Secrets Broker returned an invalid bulk campaign item.')
  }
  return {
    ref: requireSafeBrokerIdentifier(input.ref, 'campaign ref'),
    sourceId: requireSafeBrokerIdentifier(input.sourceId, 'campaign source id'),
    providerKind: requireSafeBrokerIdentifier(
      input.providerKind,
      'campaign provider kind'
    ),
    ownerServiceId: requireSafeBrokerIdentifier(
      input.ownerServiceId,
      'campaign owner service id',
      { allowEmpty: true }
    ),
    operation: requireSafeBrokerIdentifier(
      input.operation,
      'campaign operation'
    ),
    capabilityResult: requireSafeBrokerIdentifier(
      input.capabilityResult,
      'campaign capability result'
    ),
    policyResult: requireSafeBrokerIdentifier(
      input.policyResult,
      'campaign policy result'
    ),
    auditRequirement: requireSafeBrokerIdentifier(
      input.auditRequirement,
      'campaign audit requirement'
    ),
    risk: requireSafeBrokerIdentifier(input.risk, 'campaign risk'),
    expectedAction: requireSafeBrokerIdentifier(
      input.expectedAction,
      'campaign expected action'
    ),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'campaign outcome'),
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    idempotencyKey: requireSafeBrokerIdentifier(
      input.idempotencyKey,
      'campaign idempotency key'
    ),
    operationItemId: requireSafeBrokerIdentifier(
      input.operationItemId,
      'campaign item id'
    ),
    recovery: sanitizeBrokerDisplayText(input.recovery),
    targetProviderId:
      input.targetProviderId === undefined
        ? undefined
        : requireSafeBrokerIdentifier(
            input.targetProviderId,
            'campaign target provider id'
          ),
    providerAction: sanitizeBrokerDisplayText(input.providerAction),
    applied: input.applied,
    retrySafe: input.retrySafe,
    verified: input.verified,
    attempts:
      input.attempts === undefined
        ? undefined
        : requireLifecycleInteger(input.attempts, 'campaign attempt count'),
  }
}

function normalizeBrokerBulkCampaignResponse(
  payload: unknown,
  request: BrokerBulkCampaignRequest,
  mode: BrokerBulkCampaignResult['mode']
): BrokerBulkCampaignResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid bulk campaign response.'
  )
  assertNoProviderSecretFields(input)
  const summary = requireRecord(
    input.summary,
    'Secrets Broker returned an invalid bulk campaign summary.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.operationId !== request.operationId ||
    input.operation !== request.operation ||
    input.mode !== mode ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean' ||
    typeof input.requiresAuditReason !== 'boolean' ||
    typeof input.requiresRevalidation !== 'boolean' ||
    typeof input.durable !== 'boolean' ||
    !Array.isArray(input.results) ||
    !Array.isArray(input.affectedRefs) ||
    !Array.isArray(input.affectedServices)
  ) {
    throw new Error(
      'Secrets Broker returned an invalid bulk campaign response.'
    )
  }
  const results = input.results.map(normalizeBrokerBulkCampaignItem)
  const requestedRefs = [...request.refs].sort()
  const returnedRefs = [...(input.affectedRefs as unknown[])].map((ref) =>
    requireSafeBrokerIdentifier(ref, 'campaign affected ref')
  )
  if (JSON.stringify(requestedRefs) !== JSON.stringify(returnedRefs.sort())) {
    throw new Error(
      'Secrets Broker returned an invalid bulk campaign response.'
    )
  }
  const integer = (field: string) =>
    requireLifecycleInteger(summary[field], `campaign ${field}`)
  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    campaignId: requireSafeBrokerIdentifier(input.campaignId, 'campaign id'),
    planToken: requireSafeBrokerIdentifier(
      input.planToken,
      'campaign plan token'
    ),
    operationId: request.operationId,
    operation: request.operation,
    mode,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing campaign outcome]',
    applied: input.applied,
    requiresConfirmation: input.requiresConfirmation,
    requiresAuditReason: input.requiresAuditReason,
    requiresRevalidation: input.requiresRevalidation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    staleAfterSeconds: requireLifecycleInteger(
      input.staleAfterSeconds,
      'campaign staleness interval'
    ),
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    results,
    summary: {
      selectedCount: integer('selectedCount'),
      applicableCount: integer('applicableCount'),
      deniedCount: integer('deniedCount'),
      unsupportedCount: integer('unsupportedCount'),
      authRequiredCount: integer('authRequiredCount'),
      skippedCount: integer('skippedCount'),
      appliedCount: integer('appliedCount'),
      failedCount: integer('failedCount'),
      staleCount: integer('staleCount'),
      highRiskCount: integer('highRiskCount'),
    },
    affectedRefs: returnedRefs,
    affectedServices: (input.affectedServices as unknown[]).map((service) =>
      requireSafeBrokerIdentifier(service, 'campaign affected service')
    ),
    unsupportedFamilies: Array.isArray(input.unsupportedFamilies)
      ? input.unsupportedFamilies.map((family) =>
          requireSafeBrokerIdentifier(family, 'unsupported campaign family')
        )
      : undefined,
    durable: input.durable,
    maxConcurrency: requireLifecycleInteger(
      input.maxConcurrency,
      'campaign concurrency'
    ),
    backpressurePolicy: requireSafeBrokerIdentifier(
      input.backpressurePolicy,
      'campaign backpressure policy'
    ),
    createdAt: requireLifecycleDate(input.createdAt, 'campaign creation time')!,
    revalidatedAt: requireLifecycleDate(
      input.revalidatedAt,
      'campaign revalidation time',
      true
    ),
    updatedAt: requireLifecycleDate(input.updatedAt, 'campaign update time')!,
  }
}

function validateBrokerBulkCampaignRequest(request: BrokerBulkCampaignRequest) {
  requireSafeBrokerIdentifier(request.operationId, 'campaign operation id')
  requireSafeBrokerIdentifier(request.targetProviderId, 'target provider id')
  if (request.operation !== 'migrate_remap_provider') {
    throw new Error('Only provider migration campaigns are executable.')
  }
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before a bulk campaign.')
  }
  if (!request.refs.length || request.refs.length > 256) {
    throw new Error('A bulk campaign requires between 1 and 256 refs.')
  }
  request.refs.forEach((ref) =>
    requireSafeBrokerIdentifier(ref, 'campaign ref')
  )
}

async function runBrokerBulkCampaign(
  request: BrokerBulkCampaignRequest,
  mode: BrokerBulkCampaignResult['mode']
) {
  await wait(120)
  validateBrokerBulkCampaignRequest(request)
  if (serviceLassoStubDataEnabled) {
    const now = new Date().toISOString()
    const campaignId = request.campaignId ?? `stub-campaign-${Date.now()}`
    const apply = mode === 'apply'
    return structuredClone({
      serviceId: secretsBrokerServiceId,
      apiVersion: brokerProviderStatusFixture.apiVersion,
      requestId: `stub-campaign-${mode}-${Date.now()}`,
      campaignId,
      planToken: request.planToken ?? `stub-plan-${Date.now()}`,
      operationId: request.operationId,
      operation: request.operation,
      mode,
      outcome: apply ? 'applied' : 'dry_run_ready',
      applied: apply,
      requiresConfirmation: !apply,
      requiresAuditReason: !apply,
      requiresRevalidation: false,
      auditStatus: 'audit_recorded',
      staleAfterSeconds: 300,
      nextAction: apply ? 'verify_target_metadata' : 'confirm_exact_campaign',
      results: request.refs.map((ref, index) => ({
        ref,
        sourceId: 'local',
        providerKind: 'local-encrypted-store',
        ownerServiceId: 'app',
        operation: request.operation,
        capabilityResult: 'validated',
        policyResult: 'allowed',
        auditRequirement: 'required',
        risk: 'high',
        expectedAction: 'copy_value_inside_broker',
        outcome: apply ? 'migrated' : 'dry_run_ready',
        idempotencyKey: `stub-key-${index}`,
        operationItemId: `stub-item-${index}`,
        recovery: 'retry_after_fix_or_restore_from_backup',
        targetProviderId: request.targetProviderId,
        providerAction: 'write_and_verify',
        applied: apply,
        retrySafe: true,
        verified: apply,
        attempts: apply ? 1 : 0,
      })),
      summary: {
        selectedCount: request.refs.length,
        applicableCount: request.refs.length,
        deniedCount: 0,
        unsupportedCount: 0,
        authRequiredCount: 0,
        skippedCount: 0,
        appliedCount: apply ? request.refs.length : 0,
        failedCount: 0,
        staleCount: 0,
        highRiskCount: request.refs.length,
      },
      affectedRefs: [...request.refs].sort(),
      affectedServices: ['app'],
      durable: true,
      maxConcurrency: 1,
      backpressurePolicy: 'stop_on_provider_backpressure',
      createdAt: now,
      updatedAt: now,
    } satisfies BrokerBulkCampaignResult)
  }
  const payload = await fetchRuntimeJson<unknown>(
    buildSecretsManagementApiPath(`campaigns/${mode}`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: `serviceadmin-campaign-${mode}-${Date.now()}`,
        serviceId: '@serviceadmin',
        campaignId: request.campaignId ?? '',
        planToken: request.planToken ?? '',
        operationId: request.operationId,
        operation: request.operation,
        refs: request.refs,
        targetProviderId: request.targetProviderId,
        reason: request.reason.trim(),
        confirm: request.confirm === true,
        highRiskConfirm: request.highRiskConfirm ?? '',
      }),
    }
  )
  return normalizeBrokerBulkCampaignResponse(payload, request, mode)
}

export function createBrokerBulkCampaign(request: BrokerBulkCampaignRequest) {
  return runBrokerBulkCampaign(request, 'create')
}

export function revalidateBrokerBulkCampaign(
  request: BrokerBulkCampaignRequest
) {
  return runBrokerBulkCampaign(request, 'revalidate')
}

export function applyBrokerBulkCampaign(request: BrokerBulkCampaignRequest) {
  return runBrokerBulkCampaign(request, 'apply')
}

export function fetchBrokerBulkCampaignStatus(
  request: BrokerBulkCampaignRequest
) {
  return runBrokerBulkCampaign(request, 'status')
}

const forbiddenLifecycleFields = new Set([
  'token',
  'apitoken',
  'password',
  'passphrase',
  'masterkey',
  'privatekey',
  'credential',
  'credentialvalue',
  'secret',
  'secretvalue',
  'recoveryshare',
  'recoveryshares',
  'ciphertext',
  'payload',
  'nonce',
  'path',
])

function assertNoLifecycleSecretFields(value: unknown, depth = 0) {
  if (depth > 16 || value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => assertNoLifecycleSecretFields(item, depth + 1))
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, '')
    if (forbiddenLifecycleFields.has(normalized)) {
      throw new Error('Secrets Broker returned lifecycle secret material.')
    }
    assertNoLifecycleSecretFields(nested, depth + 1)
  }
}

function requireLifecycleInteger(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  return value
}

function requireLifecycleDate(value: unknown, field: string, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) {
    return undefined
  }
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Secrets Broker returned an invalid ${field}.`)
  }
  return value
}

function normalizeLifecycleBackup(value: unknown): BrokerLifecycleBackup {
  const input = requireRecord(
    value,
    'Secrets Broker returned invalid backup metadata.'
  )
  assertNoLifecycleSecretFields(input)
  if (
    input.schema !== 'service-lasso.secretsbroker.backup-metadata.v1' ||
    !['verified', 'invalid'].includes(String(input.verification))
  ) {
    throw new Error('Secrets Broker returned invalid backup metadata.')
  }
  const verification = input.verification as 'verified' | 'invalid'
  return {
    schema: 'service-lasso.secretsbroker.backup-metadata.v1',
    backupId: requireSafeBrokerIdentifier(input.backupId, 'backup id'),
    createdAt: requireLifecycleDate(
      input.createdAt,
      'backup creation time',
      verification === 'invalid'
    ),
    storeKeyId:
      verification === 'invalid' && !input.storeKeyId
        ? undefined
        : requireSafeBrokerIdentifier(input.storeKeyId, 'backup key id'),
    storeKeyVersion:
      verification === 'invalid' && !input.storeKeyVersion
        ? undefined
        : requireSafeBrokerIdentifier(
            input.storeKeyVersion,
            'backup key version'
          ),
    secretCount: requireLifecycleInteger(
      input.secretCount ?? 0,
      'secret count'
    ),
    sizeBytes: requireLifecycleInteger(input.sizeBytes ?? 0, 'backup size'),
    artifactHash:
      verification === 'invalid' && !input.artifactHash
        ? undefined
        : requireSafeBrokerIdentifier(input.artifactHash, 'artifact hash'),
    verification,
  }
}

function normalizeRecoveryPolicy(value: unknown) {
  if (value === undefined || value === null) return undefined
  const input = requireRecord(
    value,
    'Secrets Broker returned invalid recovery policy metadata.'
  )
  assertNoLifecycleSecretFields(input)
  if (
    !Array.isArray(input.shareFingerprints) ||
    (input.recipientFingerprints !== undefined &&
      !Array.isArray(input.recipientFingerprints))
  ) {
    throw new Error('Secrets Broker returned invalid recovery policy metadata.')
  }
  return {
    policyId: requireSafeBrokerIdentifier(input.policyId, 'recovery policy id'),
    keyId: requireSafeBrokerIdentifier(input.keyId, 'recovery key id'),
    keyVersion: requireSafeBrokerIdentifier(
      input.keyVersion,
      'recovery key version'
    ),
    threshold: requireLifecycleInteger(input.threshold, 'recovery threshold'),
    shareCount: requireLifecycleInteger(
      input.shareCount,
      'recovery share count'
    ),
    shareFingerprints: input.shareFingerprints.map((item) =>
      requireSafeBrokerIdentifier(item, 'recovery share fingerprint')
    ),
    recipientFingerprints: (input.recipientFingerprints ?? []).map((item) =>
      requireSafeBrokerIdentifier(item, 'recovery recipient fingerprint')
    ),
    createdAt: requireLifecycleDate(input.createdAt, 'recovery creation time')!,
    rotatedAt: requireLifecycleDate(
      input.rotatedAt,
      'recovery rotation time',
      true
    ),
    revokedAt: requireLifecycleDate(
      input.revokedAt,
      'recovery revocation time',
      true
    ),
    status: requireSafeBrokerIdentifier(input.status, 'recovery status'),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'recovery next action'
    ),
  }
}

function normalizeBrokerLifecycleStatus(
  payload: unknown
): BrokerLifecycleStatus {
  assertNoLifecycleSecretFields(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid lifecycle status.'
  )
  const key = requireRecord(
    input.key,
    'Secrets Broker returned invalid key status.'
  )
  const wrapper = requireRecord(
    input.wrapper,
    'Secrets Broker returned invalid wrapper status.'
  )
  const recovery = requireRecord(
    input.recovery,
    'Secrets Broker returned invalid recovery status.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    typeof key.available !== 'boolean' ||
    typeof wrapper.available !== 'boolean' ||
    typeof wrapper.supported !== 'boolean' ||
    !Array.isArray(input.backups)
  ) {
    throw new Error('Secrets Broker returned invalid lifecycle status.')
  }
  return {
    serviceId: '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'lifecycle outcome'),
    key: {
      available: key.available,
      keyId: key.keyId
        ? requireSafeBrokerIdentifier(key.keyId, 'key id')
        : undefined,
      keyVersion: key.keyVersion
        ? requireSafeBrokerIdentifier(key.keyVersion, 'key version')
        : undefined,
      secretCount: requireLifecycleInteger(key.secretCount, 'secret count'),
    },
    wrapper: {
      available: wrapper.available,
      supported: wrapper.supported,
      wrapperKind: requireSafeBrokerIdentifier(
        wrapper.wrapperKind,
        'wrapper kind'
      ),
      os: requireSafeBrokerIdentifier(wrapper.os, 'wrapper OS'),
      keyId: wrapper.keyId
        ? requireSafeBrokerIdentifier(wrapper.keyId, 'wrapper key id')
        : undefined,
      keyVersion: wrapper.keyVersion
        ? requireSafeBrokerIdentifier(wrapper.keyVersion, 'wrapper key version')
        : undefined,
      state: requireSafeBrokerIdentifier(wrapper.state, 'wrapper state'),
      nextAction: requireSafeBrokerIdentifier(
        wrapper.nextAction,
        'wrapper next action'
      ),
      failureReason: sanitizeBrokerDisplayText(wrapper.failureReason),
    },
    recovery: {
      outcome: requireSafeBrokerIdentifier(
        recovery.outcome,
        'recovery outcome'
      ),
      policy: normalizeRecoveryPolicy(recovery.policy),
      nextAction: requireSafeBrokerIdentifier(
        recovery.nextAction,
        'recovery next action'
      ),
    },
    backups: input.backups.map(normalizeLifecycleBackup),
    auditStatus: requireSafeBrokerIdentifier(
      input.auditStatus,
      'lifecycle audit status'
    ),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'lifecycle next action'
    ),
  }
}

function normalizeLifecycleBackupResult(
  payload: unknown
): BrokerLifecycleBackupResult {
  assertNoLifecycleSecretFields(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid backup result.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    typeof input.applied !== 'boolean' ||
    (input.backups !== undefined && !Array.isArray(input.backups))
  ) {
    throw new Error('Secrets Broker returned invalid backup result.')
  }
  return {
    serviceId: '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'backup outcome'),
    applied: input.applied,
    backup: input.backup ? normalizeLifecycleBackup(input.backup) : undefined,
    backups: Array.isArray(input.backups)
      ? input.backups.map(normalizeLifecycleBackup)
      : [],
    auditStatus: requireSafeBrokerIdentifier(
      input.auditStatus,
      'backup audit status'
    ),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'backup next action'
    ),
  }
}

function normalizeLifecycleRestoreResult(
  payload: unknown
): BrokerLifecycleRestoreResult {
  assertNoLifecycleSecretFields(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid restore result.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean'
  ) {
    throw new Error('Secrets Broker returned invalid restore result.')
  }
  return {
    serviceId: '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'restore outcome'),
    applied: input.applied,
    backup: input.backup ? normalizeLifecycleBackup(input.backup) : undefined,
    planToken: input.planToken
      ? requireSafeBrokerIdentifier(input.planToken, 'restore plan token')
      : undefined,
    planExpiresAt: requireLifecycleDate(
      input.planExpiresAt,
      'restore plan expiry',
      true
    ),
    expectedKeyId: input.expectedKeyId
      ? requireSafeBrokerIdentifier(input.expectedKeyId, 'expected key id')
      : undefined,
    expectedStoreHash: input.expectedStoreHash
      ? requireSafeBrokerIdentifier(
          input.expectedStoreHash,
          'expected store hash'
        )
      : undefined,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus: requireSafeBrokerIdentifier(
      input.auditStatus,
      'restore audit status'
    ),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'restore next action'
    ),
  }
}

function normalizeLifecycleRotateResult(
  payload: unknown
): BrokerLifecycleRotateResult {
  assertNoLifecycleSecretFields(payload)
  const input = requireRecord(
    payload,
    'Secrets Broker returned invalid key rotation result.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean'
  ) {
    throw new Error('Secrets Broker returned invalid key rotation result.')
  }
  return {
    serviceId: '@secretsbroker',
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    outcome: requireSafeBrokerIdentifier(input.outcome, 'rotation outcome'),
    applied: input.applied,
    rotatedAt: requireLifecycleDate(input.rotatedAt, 'rotation time', true),
    oldKeyId: input.oldKeyId
      ? requireSafeBrokerIdentifier(input.oldKeyId, 'old key id')
      : undefined,
    newKeyId: input.newKeyId
      ? requireSafeBrokerIdentifier(input.newKeyId, 'new key id')
      : undefined,
    keyVersion: input.keyVersion
      ? requireSafeBrokerIdentifier(input.keyVersion, 'key version')
      : undefined,
    secretCount: requireLifecycleInteger(input.secretCount, 'secret count'),
    requiresConfirmation: input.requiresConfirmation,
    auditStatus: requireSafeBrokerIdentifier(
      input.auditStatus,
      'rotation audit status'
    ),
    nextAction: requireSafeBrokerIdentifier(
      input.nextAction,
      'rotation next action'
    ),
  }
}

function validateLifecycleOperationRequest(
  request: BrokerLifecycleOperationRequest,
  requireBackup = false
) {
  requireSafeBrokerIdentifier(request.operationId, 'lifecycle operation id')
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before lifecycle operations.')
  }
  if (requireBackup && !request.backupId) {
    throw new Error('A backup selection is required.')
  }
  if (request.backupId) {
    requireSafeBrokerIdentifier(request.backupId, 'backup id')
  }
}

async function postBrokerLifecycle(
  section: string,
  request: BrokerLifecycleOperationRequest
) {
  return fetchRuntimeJson<unknown>(buildBrokerLifecycleApiPath(section), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

export async function fetchBrokerLifecycleStatus(): Promise<BrokerLifecycleStatus> {
  await wait(120)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      key: {
        available: true,
        keyId: 'mk-stub',
        keyVersion: 'v1',
        secretCount: 2,
      },
      wrapper: {
        available: true,
        supported: true,
        wrapperKind: 'local-stub',
        os: 'stub',
        keyId: 'mk-stub',
        keyVersion: 'v1',
        state: 'ready',
        nextAction: 'operate_normally',
      },
      recovery: {
        outcome: 'setup_needed',
        nextAction: 'enroll_recovery_policy',
      },
      backups: [],
      auditStatus: 'audit_recorded',
      nextAction: 'operate_normally',
    } satisfies BrokerLifecycleStatus)
  }
  return normalizeBrokerLifecycleStatus(
    await fetchRuntimeJson<unknown>(buildBrokerLifecycleApiPath('status'))
  )
}

export async function fetchBrokerLifecycleBackups(): Promise<BrokerLifecycleBackupResult> {
  await wait(120)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: false,
      backups: [],
      auditStatus: 'audit_recorded',
      nextAction: 'select_backup_or_create_new',
    } satisfies BrokerLifecycleBackupResult)
  }
  return normalizeLifecycleBackupResult(
    await fetchRuntimeJson<unknown>(buildBrokerLifecycleApiPath('backups'))
  )
}

export async function createBrokerLifecycleBackup(
  request: BrokerLifecycleOperationRequest
) {
  validateLifecycleOperationRequest(request)
  if (serviceLassoStubDataEnabled) {
    const now = new Date().toISOString()
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: true,
      backup: {
        schema: 'service-lasso.secretsbroker.backup-metadata.v1',
        backupId: `backup-stub-${Date.now()}`,
        createdAt: now,
        storeKeyId: 'mk-stub',
        storeKeyVersion: 'v1',
        secretCount: 2,
        sizeBytes: 4096,
        artifactHash: 'sha256-stub-metadata-only',
        verification: 'verified',
      },
      backups: [],
      auditStatus: 'audit_recorded',
      nextAction: 'retain_backup_separately_from_recovery_material',
    } satisfies BrokerLifecycleBackupResult)
  }
  return normalizeLifecycleBackupResult(
    await postBrokerLifecycle('backups/create', request)
  )
}

export async function verifyBrokerLifecycleBackup(
  request: BrokerLifecycleOperationRequest
) {
  validateLifecycleOperationRequest(request, true)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: false,
      backup: {
        schema: 'service-lasso.secretsbroker.backup-metadata.v1',
        backupId: request.backupId!,
        createdAt: new Date().toISOString(),
        storeKeyId: 'mk-stub',
        storeKeyVersion: 'v1',
        secretCount: 2,
        sizeBytes: 4096,
        artifactHash: 'sha256-stub-metadata-only',
        verification: 'verified',
      },
      backups: [],
      auditStatus: 'audit_recorded',
      nextAction: 'backup_verified',
    } satisfies BrokerLifecycleBackupResult)
  }
  return normalizeLifecycleBackupResult(
    await postBrokerLifecycle('backups/verify', request)
  )
}

export async function previewBrokerLifecycleRestore(
  request: BrokerLifecycleOperationRequest
) {
  validateLifecycleOperationRequest(request, true)
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: false,
      planToken: 'stub-restore-plan',
      planExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      expectedKeyId: 'mk-stub',
      expectedStoreHash: 'sha256-stub-store',
      requiresConfirmation: true,
      auditStatus: 'audit_recorded',
      nextAction: 'confirm_exact_restore_plan',
    } satisfies BrokerLifecycleRestoreResult)
  }
  return normalizeLifecycleRestoreResult(
    await postBrokerLifecycle('restore/dry-run', { ...request, confirm: false })
  )
}

export async function applyBrokerLifecycleRestore(
  request: BrokerLifecycleOperationRequest
) {
  validateLifecycleOperationRequest(request, true)
  if (
    !request.confirm ||
    !request.planToken ||
    !request.expectedKeyId ||
    !request.expectedStoreHash
  ) {
    throw new Error('The exact confirmed restore plan is required.')
  }
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: true,
      requiresConfirmation: false,
      auditStatus: 'audit_recorded',
      nextAction: 'restart_and_verify_broker',
    } satisfies BrokerLifecycleRestoreResult)
  }
  return normalizeLifecycleRestoreResult(
    await postBrokerLifecycle('restore/apply', request)
  )
}

export async function rotateBrokerLifecycleKey(
  request: BrokerLifecycleOperationRequest
) {
  validateLifecycleOperationRequest(request)
  if (!request.confirm || !request.expectedKeyId) {
    throw new Error('Explicit confirmation and the expected key are required.')
  }
  if (serviceLassoStubDataEnabled) {
    return structuredClone({
      serviceId: '@secretsbroker',
      apiVersion: 'v1',
      outcome: 'ready',
      applied: true,
      rotatedAt: new Date().toISOString(),
      oldKeyId: request.expectedKeyId,
      newKeyId: 'mk-stub-rotated',
      keyVersion: 'v2',
      secretCount: 2,
      requiresConfirmation: false,
      auditStatus: 'audit_recorded',
      nextAction: 'create_and_verify_rotated_backup',
    } satisfies BrokerLifecycleRotateResult)
  }
  return normalizeLifecycleRotateResult(
    await postBrokerLifecycle('key/rotate', request)
  )
}

function validateSecretDecommissionRequest(
  request: SecretDecommissionRequest,
  action: 'dry-run' | 'apply' | 'restore'
) {
  requireSafeBrokerIdentifier(request.ref, 'secret ref')
  requireSafeBrokerIdentifier(request.operationId, 'operation id')
  if (action !== 'dry-run' && !request.reason?.trim()) {
    throw new Error('Audit reason is required before decommission mutation.')
  }
  if (action === 'apply' && !request.plan) {
    throw new Error(
      'A fresh signed decommission plan is required before apply.'
    )
  }
  if (action === 'restore' && !request.expectedVersion?.trim()) {
    throw new Error('The tombstone version is required before restore.')
  }
}

function normalizeDecommissionPlan(
  value: unknown,
  request: SecretDecommissionRequest
): SecretDecommissionPlan {
  const plan = requireRecord(
    value,
    'Secrets Broker returned an invalid decommission plan.'
  )
  if (
    plan.ref !== request.ref ||
    plan.operationId !== request.operationId ||
    plan.dependencyStatus !== 'clear' ||
    typeof plan.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(plan.expiresAt)) ||
    typeof plan.signature !== 'string' ||
    !/^hmac-sha256:[A-Za-z0-9_-]{43}$/u.test(plan.signature) ||
    Object.prototype.hasOwnProperty.call(plan, 'value') ||
    Object.prototype.hasOwnProperty.call(plan, 'payload')
  ) {
    throw new Error('Secrets Broker returned an invalid decommission plan.')
  }

  return {
    ref: request.ref,
    operationId: request.operationId,
    expectedVersion: requireSafeBrokerIdentifier(
      plan.expectedVersion,
      'expected version'
    ),
    dependencyStatus: 'clear',
    dependencySnapshot: requireSafeBrokerIdentifier(
      plan.dependencySnapshot,
      'dependency snapshot'
    ),
    expiresAt: plan.expiresAt,
    signature: plan.signature,
  }
}

function normalizeSecretDecommissionResponse(
  payload: unknown,
  request: SecretDecommissionRequest,
  action: 'dry-run' | 'apply' | 'restore'
): SecretDecommissionResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid decommission response.'
  )
  const expectedOperation =
    action === 'restore' ? 'decommission_restore' : 'decommission'
  const expectedMode = action === 'dry-run' ? 'dry-run' : 'apply'
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.ref !== request.ref ||
    input.operationId !== request.operationId ||
    input.operation !== expectedOperation ||
    input.mode !== expectedMode ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean' ||
    typeof input.recoverable !== 'boolean' ||
    Object.prototype.hasOwnProperty.call(input, 'value')
  ) {
    throw new Error('Secrets Broker returned an invalid decommission response.')
  }

  const tombstone =
    input.tombstone === undefined
      ? undefined
      : (() => {
          const record = requireRecord(
            input.tombstone,
            'Secrets Broker returned invalid tombstone metadata.'
          )
          if (
            Object.prototype.hasOwnProperty.call(record, 'entry') ||
            Object.prototype.hasOwnProperty.call(record, 'value') ||
            Object.prototype.hasOwnProperty.call(record, 'payload') ||
            typeof record.decommissionedAt !== 'string' ||
            !Number.isFinite(Date.parse(record.decommissionedAt)) ||
            (record.restoredAt !== undefined &&
              (typeof record.restoredAt !== 'string' ||
                !Number.isFinite(Date.parse(record.restoredAt))))
          ) {
            throw new Error(
              'Secrets Broker returned invalid tombstone metadata.'
            )
          }
          return {
            state: requireSafeBrokerIdentifier(record.state, 'tombstone state'),
            version: requireSafeBrokerIdentifier(
              record.version,
              'tombstone version'
            ),
            decommissionOperationId: requireSafeBrokerIdentifier(
              record.decommissionOperationId,
              'decommission operation id'
            ),
            restoreOperationId:
              record.restoreOperationId === undefined
                ? undefined
                : requireSafeBrokerIdentifier(
                    record.restoreOperationId,
                    'restore operation id'
                  ),
            decommissionedAt: record.decommissionedAt,
            restoredAt:
              typeof record.restoredAt === 'string'
                ? record.restoredAt
                : undefined,
          }
        })()

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    operationId: request.operationId,
    ref: request.ref,
    operation: expectedOperation,
    mode: expectedMode,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: input.applied,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    policyResult:
      sanitizeBrokerDisplayText(input.policyResult) ??
      '[missing broker policy result]',
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    expectedVersion:
      input.expectedVersion === undefined
        ? undefined
        : requireSafeBrokerIdentifier(
            input.expectedVersion,
            'expected version'
          ),
    dependencyStatus:
      sanitizeBrokerDisplayText(input.dependencyStatus) ??
      '[missing dependency status]',
    dependencySnapshot:
      input.dependencySnapshot === undefined
        ? undefined
        : requireSafeBrokerIdentifier(
            input.dependencySnapshot,
            'dependency snapshot'
          ),
    dependencies: requireIdentifierArray(input.dependencies, 'dependencies'),
    recoverable: input.recoverable,
    plan:
      input.plan === undefined
        ? undefined
        : normalizeDecommissionPlan(input.plan, request),
    tombstone,
    affectedRefs: requireIdentifierArray(input.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      input.affectedServices,
      'affected services'
    ),
  }
}

export async function previewSecretDecommission(
  request: SecretDecommissionRequest
) {
  await wait(120)
  validateSecretDecommissionRequest(request, 'dry-run')

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('decommission/dry-run'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          operationId: request.operationId,
        }),
      }
    )
    return normalizeSecretDecommissionResponse(payload, request, 'dry-run')
  }

  const record = secretsManagementFixture.results.find(
    (item) => item.ref === request.ref
  )
  if (
    !record ||
    record.providerKind !== 'local-encrypted-store' ||
    !record.capabilities.includes('decommission')
  ) {
    throw new Error('Secret decommission is not available for this record.')
  }
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const plan = {
    ref: request.ref,
    operationId: request.operationId,
    expectedVersion: 'stub-version-1',
    dependencyStatus: 'clear',
    dependencySnapshot: `sha256:${'a'.repeat(64)}`,
    expiresAt,
    signature: `hmac-sha256:${'a'.repeat(43)}`,
  } satisfies SecretDecommissionPlan
  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-decommission-preview-${Date.now()}`,
    operationId: request.operationId,
    ref: request.ref,
    operation: 'decommission',
    mode: 'dry-run',
    outcome: 'dry_run_ready',
    applied: false,
    requiresConfirmation: true,
    auditStatus: 'audit_recorded',
    policyResult: 'allowed',
    nextAction: 'confirm_signed_plan_before_expiry',
    expectedVersion: plan.expectedVersion,
    dependencyStatus: 'clear',
    dependencySnapshot: plan.dependencySnapshot,
    dependencies: [],
    recoverable: true,
    plan,
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretDecommissionResult)
}

export async function applySecretDecommission(
  request: SecretDecommissionRequest
) {
  await wait(120)
  validateSecretDecommissionRequest(request, 'apply')

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('decommission/apply'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          operationId: request.operationId,
          reason: request.reason?.trim(),
          confirm: true,
          plan: request.plan,
        }),
      }
    )
    return normalizeSecretDecommissionResponse(payload, request, 'apply')
  }

  const preview = await previewSecretDecommission(request)
  const now = new Date().toISOString()
  return structuredClone({
    ...preview,
    requestId: `stub-decommission-apply-${Date.now()}`,
    mode: 'apply',
    outcome: 'applied',
    applied: true,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
    nextAction: 'retain_tombstone_until_recovery_window_expires',
    plan: undefined,
    tombstone: {
      state: 'decommissioned',
      version: request.plan?.expectedVersion ?? 'stub-version-1',
      decommissionOperationId: request.operationId,
      decommissionedAt: now,
    },
  } satisfies SecretDecommissionResult)
}

export async function restoreSecretDecommission(
  request: SecretDecommissionRequest
) {
  await wait(120)
  validateSecretDecommissionRequest(request, 'restore')

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('decommission/restore'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          operationId: request.operationId,
          reason: request.reason?.trim(),
          confirm: true,
          expectedVersion: request.expectedVersion,
        }),
      }
    )
    return normalizeSecretDecommissionResponse(payload, request, 'restore')
  }

  const now = new Date().toISOString()
  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-decommission-restore-${Date.now()}`,
    operationId: request.operationId,
    ref: request.ref,
    operation: 'decommission_restore',
    mode: 'apply',
    outcome: 'applied',
    applied: true,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
    policyResult: 'allowed',
    nextAction: 'secret_restored_from_encrypted_tombstone',
    expectedVersion: request.expectedVersion,
    dependencyStatus: 'clear',
    dependencies: [],
    recoverable: false,
    tombstone: {
      state: 'restored',
      version: request.expectedVersion ?? 'stub-version-1',
      decommissionOperationId: 'stub-original-decommission',
      restoreOperationId: request.operationId,
      decommissionedAt: now,
      restoredAt: now,
    },
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretDecommissionResult)
}

function normalizeRotationVersionMetadata(
  value: unknown
): SecretRotationVersionMetadata {
  const input = requireRecord(
    value,
    'Secrets Broker returned invalid rotation version metadata.'
  )
  const requiredTimes = ['createdAt', 'updatedAt'] as const
  for (const field of requiredTimes) {
    if (
      typeof input[field] !== 'string' ||
      !Number.isFinite(Date.parse(input[field] as string))
    ) {
      throw new Error(
        'Secrets Broker returned invalid rotation version metadata.'
      )
    }
  }
  const optionalTime = (field: 'stagedAt' | 'activatedAt' | 'retainedAt') => {
    const raw = input[field]
    if (raw === undefined) return undefined
    if (typeof raw !== 'string' || !Number.isFinite(Date.parse(raw))) {
      throw new Error(
        'Secrets Broker returned invalid rotation version metadata.'
      )
    }
    return raw
  }

  return {
    versionId: requireSafeBrokerIdentifier(input.versionId, 'version id'),
    sourceId: requireSafeBrokerIdentifier(input.sourceId, 'source id'),
    state: requireSafeBrokerIdentifier(input.state, 'version state'),
    fingerprint: requireSafeBrokerIdentifier(
      input.fingerprint,
      'version fingerprint'
    ),
    createdAt: input.createdAt as string,
    updatedAt: input.updatedAt as string,
    stagedAt: optionalTime('stagedAt'),
    activatedAt: optionalTime('activatedAt'),
    retainedAt: optionalTime('retainedAt'),
    operationId:
      input.operationId === undefined
        ? undefined
        : requireSafeBrokerIdentifier(input.operationId, 'operation id'),
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    policyResult:
      sanitizeBrokerDisplayText(input.policyResult) ??
      '[missing broker policy result]',
  }
}

function normalizeSecretRotationVersionResponse(
  payload: unknown,
  request: SecretRotationVersionRequest
): SecretRotationVersionResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid rotation response.'
  )
  const expectedOperation = `rotation_${request.action}`
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.ref !== request.ref ||
    input.operation !== expectedOperation ||
    input.mode !== request.action ||
    typeof input.applied !== 'boolean' ||
    typeof input.requiresConfirmation !== 'boolean' ||
    !Array.isArray(input.versions) ||
    Object.prototype.hasOwnProperty.call(input, 'value') ||
    Object.prototype.hasOwnProperty.call(input, 'payload')
  ) {
    throw new Error('Secrets Broker returned an invalid rotation response.')
  }

  const optionalVersion = (field: string) =>
    input[field] === undefined
      ? undefined
      : normalizeRotationVersionMetadata(input[field])

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    ref: request.ref,
    operation: expectedOperation as SecretRotationVersionResult['operation'],
    mode: request.action,
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: input.applied,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    policyResult:
      sanitizeBrokerDisplayText(input.policyResult) ??
      '[missing broker policy result]',
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    activeVersionId:
      input.activeVersionId === undefined
        ? undefined
        : requireSafeBrokerIdentifier(input.activeVersionId, 'active version'),
    previousVersionId:
      input.previousVersionId === undefined
        ? undefined
        : requireSafeBrokerIdentifier(
            input.previousVersionId,
            'previous version'
          ),
    expectedCurrentVersion:
      input.expectedCurrentVersion === undefined
        ? undefined
        : requireSafeBrokerIdentifier(
            input.expectedCurrentVersion,
            'expected current version'
          ),
    currentVersion: optionalVersion('currentVersion'),
    stagedVersion: optionalVersion('stagedVersion'),
    previousVersion: optionalVersion('previousVersion'),
    versions: input.versions.map(normalizeRotationVersionMetadata),
    affectedRefs: requireIdentifierArray(input.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      input.affectedServices,
      'affected services'
    ),
  }
}

function normalizeSecretRotationPreviewResponse(
  payload: unknown,
  request: SecretRotationPreviewRequest
): SecretRotationPreviewResult {
  const input = requireRecord(
    payload,
    'Secrets Broker returned an invalid rotation preview.'
  )
  if (
    input.serviceId !== secretsBrokerServiceId ||
    input.operationId !== request.operationId ||
    input.operation !== 'credential_rotation' ||
    input.mode !== 'dry-run' ||
    input.applied !== false ||
    typeof input.requiresConfirmation !== 'boolean' ||
    !Number.isInteger(input.staleAfterSeconds) ||
    (input.staleAfterSeconds as number) < 1 ||
    (input.staleAfterSeconds as number) > 3600 ||
    !Array.isArray(input.results) ||
    Object.prototype.hasOwnProperty.call(input, 'value')
  ) {
    throw new Error('Secrets Broker returned an invalid rotation preview.')
  }

  const results = input.results.map((value) => {
    const item = requireRecord(
      value,
      'Secrets Broker returned an invalid rotation preview item.'
    )
    if (item.ref !== request.ref || item.operationId !== request.operationId) {
      throw new Error(
        'Secrets Broker returned an invalid rotation preview item.'
      )
    }
    return {
      ref: request.ref,
      sourceId: requireSafeBrokerIdentifier(item.sourceId, 'source id'),
      providerKind: requireSafeBrokerIdentifier(
        item.providerKind,
        'provider kind'
      ),
      ownerServiceId: requireSafeBrokerIdentifier(
        item.ownerServiceId,
        'owner service id',
        { allowEmpty: true }
      ),
      capability: requireSafeBrokerIdentifier(item.capability, 'capability'),
      capabilityResult:
        sanitizeBrokerDisplayText(item.capabilityResult) ??
        '[missing capability result]',
      policyResult:
        sanitizeBrokerDisplayText(item.policyResult) ??
        '[missing policy result]',
      auditRequirement:
        sanitizeBrokerDisplayText(item.auditRequirement) ??
        '[missing audit requirement]',
      risk: sanitizeBrokerDisplayText(item.risk) ?? '[missing risk]',
      expectedAction:
        sanitizeBrokerDisplayText(item.expectedAction) ??
        '[missing expected action]',
      outcome:
        sanitizeBrokerDisplayText(item.outcome) ?? '[missing broker outcome]',
      nextAction: sanitizeBrokerDisplayText(item.nextAction),
      operationId: request.operationId,
      idempotencyKey: requireSafeBrokerIdentifier(
        item.idempotencyKey,
        'idempotency key'
      ),
    }
  })

  return {
    serviceId: secretsBrokerServiceId,
    apiVersion: requireSafeBrokerIdentifier(input.apiVersion, 'API version'),
    requestId: requireSafeBrokerIdentifier(input.requestId, 'request id'),
    operationId: request.operationId,
    operation: 'credential_rotation',
    mode: 'dry-run',
    outcome:
      sanitizeBrokerDisplayText(input.outcome) ?? '[missing broker outcome]',
    applied: false,
    requiresConfirmation: input.requiresConfirmation,
    auditStatus:
      sanitizeBrokerDisplayText(input.auditStatus) ??
      '[missing broker audit status]',
    staleAfterSeconds: input.staleAfterSeconds as number,
    nextAction: sanitizeBrokerDisplayText(input.nextAction),
    results,
    affectedRefs: requireIdentifierArray(input.affectedRefs, 'affected refs'),
    affectedServices: requireIdentifierArray(
      input.affectedServices,
      'affected services'
    ),
  }
}

export async function previewSecretRotation(
  request: SecretRotationPreviewRequest
) {
  await wait(120)
  requireSafeBrokerIdentifier(request.ref, 'secret ref')
  requireSafeBrokerIdentifier(request.operationId, 'operation id')
  if (!request.reason.trim()) {
    throw new Error('Audit reason is required before rotation preview.')
  }

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath('rotation/dry-run'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationId: request.operationId,
          refs: [request.ref],
          reason: request.reason.trim(),
        }),
      }
    )
    return normalizeSecretRotationPreviewResponse(payload, request)
  }

  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-rotation-preview-${Date.now()}`,
    operationId: request.operationId,
    operation: 'credential_rotation',
    mode: 'dry-run',
    outcome: 'dry_run_ready',
    applied: false,
    requiresConfirmation: true,
    auditStatus: 'audit_ready',
    staleAfterSeconds: 300,
    nextAction: 'confirm_and_stage_local_version',
    results: [
      {
        ref: request.ref,
        sourceId: 'local-store',
        providerKind: 'local-encrypted-store',
        ownerServiceId: 'app',
        capability: 'rotate/reset',
        capabilityResult: 'supported',
        policyResult: 'allowed',
        auditRequirement: 'required',
        risk: 'high',
        expectedAction: 'stage_then_activate',
        outcome: 'dry_run_ready',
        operationId: request.operationId,
        idempotencyKey: `sha256:${'d'.repeat(64)}`,
      },
    ],
    affectedRefs: [request.ref],
    affectedServices: ['app'],
  } satisfies SecretRotationPreviewResult)
}

function requireCoreRotationStringArray(value: unknown, field: string) {
  if (
    !Array.isArray(value) ||
    value.length > 256 ||
    !value.every(
      (entry) =>
        typeof entry === 'string' &&
        entry.length > 0 &&
        entry.length <= 512 &&
        Array.from(entry).every((character) => {
          const code = character.charCodeAt(0)
          return code > 31 && code !== 127
        })
    )
  ) {
    throw new Error(`Core returned invalid rotation ${field}.`)
  }
  return value as string[]
}

function requireCoreRotationCount(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 4096) {
    throw new Error(`Core returned invalid rotation ${field}.`)
  }
  return Number(value)
}

function requireCoreRotationMetadataId(value: unknown, field: string) {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9@][A-Za-z0-9@._:-]{0,511}$/.test(value)
  ) {
    throw new Error(`Core returned invalid rotation ${field}.`)
  }
  return value
}

function requireCoreRotationMetadataIdArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.length > 256) {
    throw new Error(`Core returned invalid rotation ${field}.`)
  }
  return value.map((entry) => requireCoreRotationMetadataId(entry, field))
}

function assertNoCoreRotationSecretFields(value: unknown, depth = 0) {
  if (depth > 16 || value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((entry) => assertNoCoreRotationSecretFields(entry, depth + 1))
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, '')
    if (
      normalized === 'value' ||
      normalized === 'secretvalue' ||
      normalized === 'token' ||
      normalized === 'credential' ||
      normalized === 'payload' ||
      normalized === 'ciphertext'
    ) {
      throw new Error('Core returned secret material in rotation metadata.')
    }
    assertNoCoreRotationSecretFields(nested, depth + 1)
  }
}

function normalizeCoreRotationImpactPlan(
  value: unknown
): CoreSecretRotationImpactPlan {
  const input = requireRecord(value, 'Core returned an invalid rotation plan.')
  assertNoLifecycleSecretFields(input)
  if (
    typeof input.ref !== 'string' ||
    typeof input.planFingerprint !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(input.planFingerprint) ||
    !['ready', 'blocked'].includes(String(input.status)) ||
    input.confirmationRequired !== true ||
    input.valuePolicy !== 'metadata_only' ||
    !Array.isArray(input.services) ||
    input.services.length > 128 ||
    !Array.isArray(input.blockers)
  ) {
    throw new Error('Core returned an invalid rotation plan.')
  }
  const execution = requireRecord(
    input.execution,
    'Core returned invalid rotation execution metadata.'
  )
  const summary = requireRecord(
    input.summary,
    'Core returned invalid rotation summary metadata.'
  )
  const ownerAction =
    input.ownerAction === null
      ? null
      : (() => {
          const owner = requireRecord(
            input.ownerAction,
            'Core returned invalid rotation owner action metadata.'
          )
          if (
            !['service', 'external'].includes(String(owner.authority)) ||
            !['ready', 'manual'].includes(String(owner.status)) ||
            typeof owner.reason !== 'string'
          ) {
            throw new Error(
              'Core returned invalid rotation owner action metadata.'
            )
          }
          return {
            authority: owner.authority as 'service' | 'external',
            status: owner.status as 'ready' | 'manual',
            ...(typeof owner.serviceId === 'string'
              ? {
                  serviceId: requireCoreRotationMetadataId(
                    owner.serviceId,
                    'rotation owner service id'
                  ),
                }
              : {}),
            ...(typeof owner.actionId === 'string'
              ? {
                  actionId: requireCoreRotationMetadataId(
                    owner.actionId,
                    'rotation owner action id'
                  ),
                }
              : {}),
            ...(typeof owner.rollbackActionId === 'string'
              ? {
                  rollbackActionId: requireCoreRotationMetadataId(
                    owner.rollbackActionId,
                    'rotation owner rollback action id'
                  ),
                }
              : {}),
            reason:
              sanitizeBrokerDisplayText(owner.reason) ??
              '[rotation owner reason unavailable]',
            blockers: requireCoreRotationStringArray(
              owner.blockers,
              'owner blockers'
            ),
          }
        })()
  const services = input.services.map((value) => {
    const service = requireRecord(
      value,
      'Core returned invalid rotation service metadata.'
    )
    if (
      typeof service.serviceId !== 'string' ||
      !['direct', 'dependent'].includes(String(service.role)) ||
      !['restart', 'reload', 'action', 'manual', 'none'].includes(
        String(service.action)
      ) ||
      typeof service.reason !== 'string' ||
      typeof service.required !== 'boolean'
    ) {
      throw new Error('Core returned invalid rotation service metadata.')
    }
    return {
      serviceId: requireCoreRotationMetadataId(service.serviceId, 'service id'),
      role: service.role as 'direct' | 'dependent',
      action:
        service.action as CoreSecretRotationImpactPlan['services'][number]['action'],
      ...(typeof service.actionId === 'string'
        ? {
            actionId: requireCoreRotationMetadataId(
              service.actionId,
              'service action id'
            ),
          }
        : {}),
      reason:
        sanitizeBrokerDisplayText(service.reason) ??
        '[rotation reason unavailable]',
      required: service.required,
      sources: requireCoreRotationStringArray(service.sources, 'sources'),
      locations: requireCoreRotationStringArray(service.locations, 'locations'),
      dependentsOf: requireCoreRotationStringArray(
        service.dependentsOf,
        'dependents'
      ),
      blockers: requireCoreRotationStringArray(service.blockers, 'blockers'),
    }
  })
  const operations = Array.isArray(execution.operations)
    ? execution.operations.map((value) => {
        const operation = requireRecord(
          value,
          'Core returned invalid rotation operation metadata.'
        )
        if (
          typeof operation.serviceId !== 'string' ||
          !['restart', 'reload', 'action'].includes(String(operation.action)) ||
          typeof operation.reason !== 'string'
        ) {
          throw new Error('Core returned invalid rotation operation metadata.')
        }
        return {
          serviceId: requireCoreRotationMetadataId(
            operation.serviceId,
            'operation service id'
          ),
          action: operation.action as 'restart' | 'reload' | 'action',
          ...(typeof operation.actionId === 'string'
            ? {
                actionId: requireCoreRotationMetadataId(
                  operation.actionId,
                  'operation action id'
                ),
              }
            : {}),
          reason:
            sanitizeBrokerDisplayText(operation.reason) ??
            '[rotation reason unavailable]',
        }
      })
    : (() => {
        throw new Error('Core returned invalid rotation operations.')
      })()
  return {
    ref: requireSafeBrokerIdentifier(input.ref, 'rotation ref'),
    planFingerprint: input.planFingerprint,
    status: input.status as 'ready' | 'blocked',
    confirmationRequired: true,
    valuePolicy: 'metadata_only',
    ownerAction,
    services,
    execution: {
      stopOrder: requireCoreRotationStringArray(
        execution.stopOrder,
        'stop order'
      ),
      startOrder: requireCoreRotationStringArray(
        execution.startOrder,
        'start order'
      ),
      operations,
    },
    summary: {
      directConsumers: requireCoreRotationCount(
        summary.directConsumers,
        'direct consumer count'
      ),
      dependents: requireCoreRotationCount(
        summary.dependents,
        'dependent count'
      ),
      restart: requireCoreRotationCount(summary.restart, 'restart count'),
      reload: requireCoreRotationCount(summary.reload, 'reload count'),
      action: requireCoreRotationCount(summary.action, 'action count'),
      manual: requireCoreRotationCount(summary.manual, 'manual count'),
      none: requireCoreRotationCount(summary.none, 'none count'),
      blockers: requireCoreRotationCount(summary.blockers, 'blocker count'),
      ownerAction: requireCoreRotationCount(
        summary.ownerAction,
        'owner action count'
      ),
    },
    blockers: requireCoreRotationStringArray(input.blockers, 'blockers'),
  }
}

export async function fetchCoreSecretRotationImpactPlan(
  ref: string
): Promise<CoreSecretRotationImpactPlan> {
  requireSafeBrokerIdentifier(ref, 'secret ref')
  if (serviceLassoStubDataEnabled) {
    return {
      ref,
      planFingerprint: `sha256:${'a'.repeat(64)}`,
      status: 'ready',
      confirmationRequired: true,
      valuePolicy: 'metadata_only',
      ownerAction: null,
      services: [],
      execution: { stopOrder: [], startOrder: [], operations: [] },
      summary: {
        directConsumers: 0,
        dependents: 0,
        restart: 0,
        reload: 0,
        action: 0,
        manual: 0,
        none: 0,
        blockers: 0,
        ownerAction: 0,
      },
      blockers: [],
    }
  }
  return normalizeCoreRotationImpactPlan(
    await fetchRuntimeJson<unknown>(
      `/api/secrets/rotation-plan?ref=${encodeURIComponent(ref)}`
    )
  )
}

const coreRotationPhases: CoreSecretRotationExecutionState['phase'][] = [
  'planned',
  'staged',
  'consumers_stopped',
  'activated',
  'converging',
  'committed',
  'rolling_back',
  'rolled_back',
  'blocked',
]

function normalizeCoreRotationVersionId(value: unknown, field: string) {
  return value === null
    ? null
    : requireCoreRotationMetadataId(value, `${field} version id`)
}

function normalizeCoreRotationExecutionState(
  payload: unknown,
  expected?: {
    operationId?: string
    ref?: string
    planFingerprint?: string
  }
): CoreSecretRotationExecutionState {
  const wrapper = requireRecord(
    payload,
    'Core returned an invalid rotation execution response.'
  )
  assertNoLifecycleSecretFields(wrapper)
  assertNoCoreRotationSecretFields(wrapper)
  const operation = requireRecord(
    wrapper.operation,
    'Core returned invalid rotation operation state.'
  )
  const plan = normalizeCoreRotationImpactPlan(operation.plan)
  const operationId = requireCoreRotationMetadataId(
    operation.operationId,
    'rotation operation id'
  )
  const ref = requireSafeBrokerIdentifier(operation.ref, 'rotation ref')
  const failureCode =
    operation.failureCode === null
      ? null
      : requireCoreRotationMetadataId(
          operation.failureCode,
          'rotation failure code'
        )
  if (
    operation.schema !== 'service-lasso.secret-rotation-operation.v1' ||
    (expected?.operationId && operationId !== expected.operationId) ||
    (expected?.ref && ref !== expected.ref) ||
    (expected?.planFingerprint &&
      operation.planFingerprint !== expected.planFingerprint) ||
    ref !== plan.ref ||
    operation.planFingerprint !== plan.planFingerprint ||
    !coreRotationPhases.includes(
      operation.phase as CoreSecretRotationExecutionState['phase']
    ) ||
    !['committed', 'rolled_back', 'blocked', 'in_progress'].includes(
      String(operation.outcome)
    ) ||
    typeof operation.createdAt !== 'string' ||
    Number.isNaN(Date.parse(operation.createdAt)) ||
    typeof operation.updatedAt !== 'string' ||
    Number.isNaN(Date.parse(operation.updatedAt)) ||
    typeof operation.ownerActionCompleted !== 'boolean' ||
    typeof operation.ownerRollbackCompleted !== 'boolean'
  ) {
    throw new Error('Core returned invalid rotation operation state.')
  }
  return {
    schema: 'service-lasso.secret-rotation-operation.v1',
    operationId,
    ref,
    planFingerprint: plan.planFingerprint,
    phase: operation.phase as CoreSecretRotationExecutionState['phase'],
    outcome: operation.outcome as CoreSecretRotationExecutionState['outcome'],
    createdAt: operation.createdAt,
    activeVersionId: normalizeCoreRotationVersionId(
      operation.activeVersionId,
      'active'
    ),
    previousVersionId: normalizeCoreRotationVersionId(
      operation.previousVersionId,
      'previous'
    ),
    stagedVersionId: normalizeCoreRotationVersionId(
      operation.stagedVersionId,
      'staged'
    ),
    initialRunningServiceIds: requireCoreRotationMetadataIdArray(
      operation.initialRunningServiceIds,
      'initial running service ids'
    ),
    stoppedServiceIds: requireCoreRotationMetadataIdArray(
      operation.stoppedServiceIds,
      'stopped service ids'
    ),
    completedOperations: requireCoreRotationMetadataIdArray(
      operation.completedOperations,
      'completed operations'
    ),
    rollbackCompletedOperations: requireCoreRotationMetadataIdArray(
      operation.rollbackCompletedOperations,
      'rollback operations'
    ),
    ownerActionCompleted: operation.ownerActionCompleted,
    ownerRollbackCompleted: operation.ownerRollbackCompleted,
    failureCode,
    updatedAt: operation.updatedAt,
    plan,
  }
}

export async function fetchCoreSecretRotationExecutionState(
  operationId: string
): Promise<CoreSecretRotationExecutionState> {
  const safeOperationId = requireSafeBrokerIdentifier(
    operationId,
    'rotation operation id'
  )
  if (serviceLassoStubDataEnabled) {
    const ref = secretsManagementFixture.results[0]?.ref
    if (!ref) throw new Error('Stub rotation inventory is unavailable.')
    const plan = await fetchCoreSecretRotationImpactPlan(ref)
    return {
      schema: 'service-lasso.secret-rotation-operation.v1',
      operationId: safeOperationId,
      ref,
      planFingerprint: plan.planFingerprint,
      phase: 'committed',
      outcome: 'committed',
      createdAt: new Date().toISOString(),
      activeVersionId: 'stub-version-2',
      previousVersionId: 'stub-version-1',
      stagedVersionId: 'stub-version-2',
      initialRunningServiceIds: [],
      stoppedServiceIds: [],
      completedOperations: [],
      rollbackCompletedOperations: [],
      ownerActionCompleted: false,
      ownerRollbackCompleted: false,
      failureCode: null,
      updatedAt: new Date().toISOString(),
      plan,
    }
  }
  return normalizeCoreRotationExecutionState(
    await fetchRuntimeJson<unknown>(
      `/api/secrets/rotation/operations/${encodeURIComponent(safeOperationId)}`
    ),
    { operationId: safeOperationId }
  )
}

export async function executeCoreSecretRotation(
  request: CoreSecretRotationExecutionRequest
): Promise<CoreSecretRotationExecutionState> {
  requireSafeBrokerIdentifier(request.ref, 'secret ref')
  requireSafeBrokerIdentifier(request.operationId, 'operation id')
  if (
    !/^sha256:[a-f0-9]{64}$/.test(request.planFingerprint) ||
    !request.reason.trim() ||
    !request.value
  ) {
    throw new Error(
      'Core rotation requires a fresh plan, audit reason, and replacement value.'
    )
  }
  if (serviceLassoStubDataEnabled) {
    return {
      schema: 'service-lasso.secret-rotation-operation.v1',
      operationId: request.operationId,
      ref: request.ref,
      planFingerprint: request.planFingerprint,
      phase: 'committed',
      outcome: 'committed',
      createdAt: new Date().toISOString(),
      activeVersionId: 'stub-version-2',
      previousVersionId: 'stub-version-1',
      stagedVersionId: 'stub-version-2',
      initialRunningServiceIds: [],
      stoppedServiceIds: [],
      completedOperations: [],
      rollbackCompletedOperations: [],
      ownerActionCompleted: false,
      ownerRollbackCompleted: false,
      failureCode: null,
      updatedAt: new Date().toISOString(),
      plan: await fetchCoreSecretRotationImpactPlan(request.ref),
    }
  }
  const payload = await fetchRuntimeJson<unknown>(
    '/api/secrets/rotation/execute',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      acceptErrorResponse: (status, response) =>
        status === 503 && isRecord(response) && isRecord(response.operation),
    }
  )
  return normalizeCoreRotationExecutionState(payload, {
    operationId: request.operationId,
    ref: request.ref,
    planFingerprint: request.planFingerprint,
  })
}

export async function runSecretRotationVersionAction(
  request: SecretRotationVersionRequest
) {
  await wait(120)
  requireSafeBrokerIdentifier(request.ref, 'secret ref')
  if (request.action !== 'status') {
    requireSafeBrokerIdentifier(request.operationId, 'operation id')
    if (!request.reason?.trim()) {
      throw new Error('Audit reason is required before rotation mutation.')
    }
  }
  if (request.action === 'stage' && !request.value?.trim()) {
    throw new Error('A replacement value is required before rotation stage.')
  }
  if (
    request.action === 'activate' &&
    (!request.versionId || !request.expectedCurrentVersion)
  ) {
    throw new Error(
      'Staged and expected current versions are required before activation.'
    )
  }

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      buildSecretsManagementApiPath(`rotation/${request.action}`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: request.ref,
          operationId: request.operationId,
          versionId: request.versionId,
          expectedCurrentVersion: request.expectedCurrentVersion,
          reason: request.reason?.trim(),
          confirm: request.action === 'status' ? undefined : true,
          value: request.action === 'stage' ? request.value : undefined,
          retentionLimit: request.retentionLimit,
        }),
      }
    )
    return normalizeSecretRotationVersionResponse(payload, request)
  }

  const now = new Date().toISOString()
  const currentVersion = {
    versionId:
      request.action === 'activate' ? request.versionId! : 'stub-version-1',
    sourceId: 'local-test',
    state: 'active',
    fingerprint: `sha256:${'e'.repeat(64)}`,
    createdAt: now,
    updatedAt: now,
    activatedAt: now,
    auditStatus: 'audit_recorded',
    policyResult: 'allowed',
  } satisfies SecretRotationVersionMetadata
  const stagedVersion = {
    ...currentVersion,
    versionId: `rv-${request.operationId ?? 'stub-rotation'}`,
    state: 'staged',
    stagedAt: now,
  } satisfies SecretRotationVersionMetadata
  const previousVersion = {
    ...currentVersion,
    versionId: 'stub-version-1',
    state: 'retained',
    retainedAt: now,
  } satisfies SecretRotationVersionMetadata
  const outcome =
    request.action === 'status'
      ? 'ready'
      : request.action === 'stage'
        ? 'staged'
        : request.action === 'activate'
          ? 'applied'
          : request.action === 'rollback'
            ? 'rolled_back'
            : 'retired'

  return structuredClone({
    serviceId: secretsBrokerServiceId,
    apiVersion: secretsManagementFixture.apiVersion,
    requestId: `stub-rotation-${request.action}-${Date.now()}`,
    ref: request.ref,
    operation: `rotation_${request.action}`,
    mode: request.action,
    outcome,
    applied: ['activate', 'rollback', 'retire'].includes(request.action),
    requiresConfirmation: request.action === 'stage',
    auditStatus:
      request.action === 'status' ? 'audit_available' : 'audit_recorded',
    policyResult: 'allowed',
    nextAction:
      request.action === 'stage'
        ? 'activate_with_expected_current_version_after_consumer_preflight'
        : 'inspect_rotation_status',
    activeVersionId: currentVersion.versionId,
    previousVersionId:
      request.action === 'activate' ? previousVersion.versionId : undefined,
    currentVersion,
    stagedVersion: request.action === 'stage' ? stagedVersion : undefined,
    previousVersion:
      request.action === 'activate' ? previousVersion : undefined,
    versions:
      request.action === 'activate'
        ? [currentVersion, previousVersion]
        : [currentVersion],
    affectedRefs: [request.ref],
    affectedServices: [],
  } satisfies SecretRotationVersionResult)
}

function applyServiceSetupState(serviceId: string, setup: ServiceSetupState) {
  services = services.map((service) =>
    service.id === serviceId ? { ...service, setup } : service
  )
}

function applyServiceUpdateState(
  serviceId: string,
  update: ServiceUpdateState
) {
  services = services.map((service) =>
    service.id === serviceId ? { ...service, updates: update } : service
  )
}

export async function runServiceLifecycleAction(options: {
  action: ServiceLifecycleActionKind
  serviceId: string
  confirm?: boolean
}) {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    await fetchRuntimeJson<unknown>(
      `/api/services/${encodeURIComponent(options.serviceId)}/${options.action}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: options.confirm === true }),
      }
    )
    return { serviceId: options.serviceId, action: options.action }
  }

  services = services.map((service) => {
    if (service.id !== options.serviceId) return service
    const running =
      options.action === 'start' || options.action === 'restart'
        ? true
        : options.action === 'stop'
          ? false
          : service.runtimeHealth.state === 'running'
    return {
      ...service,
      installed: options.action === 'install' ? true : service.installed,
      status: running
        ? 'running'
        : options.action === 'stop'
          ? 'stopped'
          : service.status,
      runtimeHealth: {
        ...service.runtimeHealth,
        state: running
          ? 'running'
          : options.action === 'stop'
            ? 'stopped'
            : service.runtimeHealth.state,
        health: running
          ? 'healthy'
          : options.action === 'stop'
            ? 'warning'
            : service.runtimeHealth.health,
      },
    }
  })
  return { serviceId: options.serviceId, action: options.action }
}

export async function runServiceUpdateAction(options: {
  action: ServiceUpdateAction
  serviceId: string
  force?: boolean
}) {
  await wait(120)

  if (serviceLassoApiBaseUrl === null) {
    return structuredClone(buildSummary())
  }

  const endpoint =
    options.action === 'check'
      ? `${serviceLassoApiBaseUrl}/api/updates/check`
      : `${serviceLassoApiBaseUrl}/api/services/${options.serviceId}/update/${options.action}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body:
      options.action === 'check'
        ? JSON.stringify({ serviceId: options.serviceId })
        : JSON.stringify({ force: options.force === true }),
  })

  if (!response.ok) {
    throw new Error(`Update ${options.action} failed for ${options.serviceId}`)
  }

  const payload = (await response.json()) as {
    update?: ServiceUpdateState
    services?: Array<{ serviceId: string; update: ServiceUpdateState }>
  }
  const update =
    payload.update ??
    payload.services?.find((service) => service.serviceId === options.serviceId)
      ?.update

  if (update) {
    applyServiceUpdateState(options.serviceId, update)
  }

  return structuredClone(buildSummary())
}

export async function runServiceSetupAction(options: {
  serviceId: string
  stepId?: string
  force?: boolean
}) {
  await wait(120)
  const existingSetup =
    services.find((service) => service.id === options.serviceId)?.setup ??
    createDemoSetupState(options.serviceId)

  if (serviceLassoApiBaseUrl === null) {
    const selectedSteps = options.stepId
      ? existingSetup.steps.filter((step) => step.id === options.stepId)
      : existingSetup.steps.filter((step) => step.rerun !== 'manual')
    const now = new Date().toISOString()
    const runs = selectedSteps.map((step) => {
      const status =
        step.status === 'succeeded' && options.force !== true
          ? 'skipped'
          : 'succeeded'
      return {
        runId: `${now.replace(/[:.]/g, '-')}-${step.id}`,
        serviceId: options.serviceId,
        stepId: step.id,
        status,
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        command: `service-lasso setup run ${options.serviceId} ${step.id}`,
        exitCode: status === 'succeeded' ? 0 : null,
        signal: null,
        message:
          status === 'succeeded'
            ? `Setup step "${step.id}" completed.`
            : 'setup step already succeeded',
        logs: step.lastRun?.logs,
      } satisfies ServiceSetupStepRun
    })
    const nextSetup = {
      ...existingSetup,
      updatedAt: now,
      steps: existingSetup.steps.map((step) => {
        const run = runs.find((item) => item.stepId === step.id)
        if (!run) return step
        return {
          ...step,
          status: run.status,
          lastRun: run,
          history: [...step.history, run].slice(-20),
          skipReason: run.status === 'skipped' ? run.message : undefined,
        }
      }),
    } satisfies ServiceSetupState
    applyServiceSetupState(options.serviceId, nextSetup)

    return structuredClone({
      action: 'setup',
      serviceId: options.serviceId,
      ok: true,
      setup: nextSetup,
      runs,
      skipped: runs
        .filter((run) => run.status === 'skipped')
        .map((run) => ({
          stepId: run.stepId,
          reason: run.message ?? 'setup step skipped',
        })),
      message: runs.length
        ? `Setup completed for "${options.serviceId}".`
        : `No setup steps ran for "${options.serviceId}".`,
    } satisfies ServiceSetupRunResult)
  }

  const endpoint = `${serviceLassoApiBaseUrl}/api/services/${options.serviceId}/setup/run${
    options.stepId ? `/${encodeURIComponent(options.stepId)}` : ''
  }`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ force: options.force === true }),
  })

  if (!response.ok) {
    throw new Error(`Setup run failed for ${options.serviceId}`)
  }

  const payload = (await response.json()) as Record<string, unknown>
  const setup = normalizeServiceSetupPayload(options.serviceId, {
    serviceId: options.serviceId,
    steps: existingSetup.steps,
    setup:
      payload.setup ??
      (isRecord(payload.state) && isRecord(payload.state.setup)
        ? payload.state.setup
        : undefined),
  })
  applyServiceSetupState(options.serviceId, setup)

  return structuredClone({
    action: 'setup',
    serviceId: options.serviceId,
    ok: payload.ok === true,
    setup,
    runs: Array.isArray(payload.runs)
      ? payload.runs
          .map((entry) => normalizeSetupRun(entry))
          .filter((entry): entry is ServiceSetupStepRun => entry !== null)
      : [],
    skipped: Array.isArray(payload.skipped)
      ? payload.skipped.filter(
          (item): item is { stepId: string; reason: string } =>
            isRecord(item) &&
            typeof item.stepId === 'string' &&
            typeof item.reason === 'string'
        )
      : [],
    message:
      typeof payload.message === 'string'
        ? payload.message
        : `Setup completed for "${options.serviceId}".`,
  } satisfies ServiceSetupRunResult)
}

function applyServiceRecoveryState(
  serviceId: string,
  recovery: ServiceRecoveryHistoryState
) {
  services = services.map((service) =>
    service.id === serviceId ? { ...service, recovery } : service
  )
}

export async function runServiceRecoveryDoctorAction(serviceId: string) {
  await wait(120)

  if (serviceLassoApiBaseUrl === null) {
    const recovery =
      services.find((service) => service.id === serviceId)?.recovery ??
      createEmptyRecoveryState(serviceId)
    const event = {
      kind: 'doctor' as const,
      serviceId,
      ok: true,
      blocked: false,
      steps: [],
      at: new Date().toISOString(),
    }
    const nextRecovery = {
      ...recovery,
      updatedAt: event.at,
      events: [...recovery.events, event],
    }
    applyServiceRecoveryState(serviceId, nextRecovery)
    return structuredClone({
      serviceId,
      doctor: { ok: true, blocked: false, steps: [] },
      recovery: nextRecovery,
    } satisfies ServiceRecoveryDoctorActionResult)
  }

  const response = await fetch(
    `${serviceLassoApiBaseUrl}/api/services/${serviceId}/recovery/doctor`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  )

  if (!response.ok) {
    throw new Error(`Doctor check failed for ${serviceId}`)
  }

  const payload = (await response.json()) as ServiceRecoveryDoctorActionResult
  applyServiceRecoveryState(serviceId, payload.recovery)
  return structuredClone(payload)
}

export function resolveStubServiceLogInfo(
  serviceId: string,
  type: 'default' | 'access' | 'error' = 'default'
) {
  const service = services.find((item) => item.id === serviceId)
  if (!service) return null

  const defaultPath =
    service.metadata.logPath ?? '/mock-logs/service-sample.log'
  const availableTypes: Array<'default' | 'access' | 'error'> = ['default']

  return {
    serviceId,
    type,
    path: defaultPath,
    availableTypes,
  }
}

export function buildStubServiceLogUrl(
  serviceId: string,
  options?: {
    type?: 'default' | 'access' | 'error'
  }
) {
  const params = new URLSearchParams({
    service: serviceId,
    type: options?.type ?? 'default',
  })

  return `/api/logs/content?${params.toString()}`
}

export async function runDashboardAction(action: DashboardAction) {
  await wait(180)

  if (action === 'reload-runtime') {
    runtime = {
      ...runtime,
      lastReloadedAt: new Date().toISOString(),
    }
  } else if (action === 'start-services') {
    services = services.map((service) => {
      if (service.status === 'stopped') {
        return {
          ...service,
          status: 'running',
          note: 'Service was started from the dashboard action.',
          runtimeHealth: {
            ...service.runtimeHealth,
            state: 'running',
            health: 'healthy',
            uptime: '0m',
            lastCheckAt: new Date().toISOString(),
            lastRestartAt: new Date().toISOString(),
            summary: 'Service was started from the dashboard action.',
          },
          recentLogs: [
            {
              timestamp: new Date().toISOString(),
              level: 'info' as const,
              source: 'supervisor' as const,
              message: 'Service started from dashboard bulk action.',
            },
            ...service.recentLogs,
          ].slice(0, 5),
        }
      }

      return service
    })
  } else {
    const service = services.find((item) => item.id === action.serviceId)
    const nextFavorite = service ? !service.favorite : true
    const updated = await updateFavoriteViaApi(action.serviceId, nextFavorite)

    if (!updated) {
      syncFavoriteState(action.serviceId, nextFavorite)
    }
  }

  return structuredClone(buildSummary())
}
