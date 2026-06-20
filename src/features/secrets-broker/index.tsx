import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileKey2,
  KeyRound,
  LockKeyhole,
  Network,
  ShieldCheck,
  TerminalSquare,
  X,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfigDrawer } from '@/components/config-drawer'
import { DependencyGraphCanvas } from '@/components/dependency-graph-canvas'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { SupportBundleDiagnosticsAction } from '../support-bundle'
import {
  auditEventTypeLabel,
  filterSecretsBrokerAuditEvents,
  secretsBrokerAuditEvents,
  type SecretsBrokerAuditEvent,
  type SecretsBrokerAuditEventType,
  type SecretsBrokerAuditOutcome,
  type SecretsBrokerAuditTamperEvidenceStatus,
} from './audit-events'
import {
  secretsBrokerBackupKeyStatus,
  type SecretsBrokerBackupKeyAction,
  type SecretsBrokerBackupState,
  type SecretsBrokerRotationState,
} from './backup-key-management'
import {
  countDiagnosticsByStatus,
  secretsBrokerDiagnostics,
  type SecretsBrokerDiagnostic,
  type SecretsBrokerDiagnosticStatus,
} from './diagnostics'
import {
  buildOperationalLockoutClearPreview,
  buildOperationalLockoutClearResult,
  filterOperationalControlEvents,
  operationalControlEvents,
  operationalControlLockouts,
  operationalControlMetrics,
  operationalControlPolicies,
  type OperationalControlLockoutClearResult,
  type OperationalControlOutcome,
  type OperationalControlSeverity,
} from './operational-controls'
import {
  secretsBrokerProviderConnections,
  type SecretsBrokerProviderConnectionDetail,
  type SecretsBrokerProviderConnectionState,
  type SecretsBrokerProviderLifecycleStatus,
} from './provider-connections'
import {
  singleSecretRevealReference,
  singleSecretRevealScenarios,
  type SingleSecretRevealState,
} from './single-secret-reveal'
import {
  countSourceBackendsByState,
  secretsBrokerSourceBackends,
  type SecretsBrokerSourceBackend,
  type SecretsBrokerSourceState,
} from './source-backends'
import {
  buildSecretsBrokerTopology,
  filterSecretsBrokerTopology,
  toReactFlowSecretsBrokerTopology,
} from './topology'
import {
  countWorkflowRefStatuses,
  workflowAuthoringBoundaries,
  type WorkflowSecretRefStatus,
} from './workflow-authoring'

type WizardSource = {
  id: string
  title: string
  kind: string
  summary: string
  status: 'ready' | 'locked' | 'auth-required' | 'degraded' | 'policy-denied'
  affected: string[]
  safeExample: string
  warning?: string
  nextAction: string
}

type SecretsBrokerOverviewState =
  | 'healthy'
  | 'degraded'
  | 'offline'
  | 'unconfigured'

type SecretsBrokerOverviewScenario = {
  id: SecretsBrokerOverviewState
  label: string
  health: {
    state: SecretsBrokerOverviewState
    title: string
    summary: string
    apiReachable: boolean
    lastCheckedAt: string
  }
  storage: {
    localStore: string
    externalSource: string
    backendState: string
  }
  keystore: {
    state: string
    version: string
    warning: string
  }
  operations: {
    reconnectRequired: number
    recentResolveFailures: number
    recentDeniedRequests: number
    lastAuditEvent: string
  }
  emptyState?: string
}

export type SecretsBrokerSectionFocus =
  | 'overview'
  | 'operational-controls'
  | 'sources'
  | 'provider-connections'
  | 'single-reveal'
  | 'backup-keys'
  | 'workflow-boundaries'
  | 'topology'
  | 'audit-events'
  | 'diagnostics'

const secretsBrokerSectionMetadata: Record<
  SecretsBrokerSectionFocus,
  { title: string; heading: string; description: string }
> = {
  overview: {
    title: 'Service Admin - Secrets Broker Overview',
    heading: 'Overview',
    description:
      'Monitor Secrets Broker health, sources, policy, audit, and operator action state.',
  },
  'operational-controls': {
    title: 'Service Admin - Secrets Broker Operational Controls',
    heading: 'Secrets Broker operational controls',
    description:
      'Inspect policy, audit, telemetry, event filtering, and lockout posture.',
  },
  sources: {
    title: 'Service Admin - Secrets Broker Providers',
    heading: 'Secrets Broker providers',
    description: 'Inspect configured provider metadata safely.',
  },
  'provider-connections': {
    title: 'Service Admin - Secrets Broker Provider Connections',
    heading: 'Secrets Broker provider connections',
    description:
      'Inspect provider connection health without credential values.',
  },
  'single-reveal': {
    title: 'Service Admin - Secrets Broker Single Reveal',
    heading: 'Secrets Broker single reveal',
    description: 'Preview controlled reveal states without leaking values.',
  },
  'backup-keys': {
    title: 'Service Admin - Secrets Broker Backup Keys',
    heading: 'Secrets Broker backup keys',
    description: 'Inspect backup, restore, and key management readiness.',
  },
  'workflow-boundaries': {
    title: 'Service Admin - Secrets Broker Workflow Boundaries',
    heading: 'Secrets Broker workflow boundaries',
    description: 'Review workflow authoring SecretRef guardrails.',
  },
  topology: {
    title: 'Service Admin - Secrets Broker Topology',
    heading: 'Secrets Broker topology',
    description: 'Inspect safe service-to-secret relationship metadata.',
  },
  'audit-events': {
    title: 'Service Admin - Operations Audit Logging',
    heading: 'Audit Logging',
    description: 'Inspect audit events and tamper-evidence metadata.',
  },
  diagnostics: {
    title: 'Service Admin - Secrets Broker Diagnostics',
    heading: 'Secrets Broker diagnostics',
    description: 'Inspect safe diagnostics and troubleshooting signals.',
  },
}

const wizardSources: WizardSource[] = [
  {
    id: 'local-vault',
    title: 'Local encrypted vault',
    kind: 'local/file',
    summary:
      'Create or unlock the default local-first Secrets Broker vault without showing resolved values.',
    status: 'locked',
    affected: ['@secretsbroker/local/default', 'echo-service:DB_PASSWORD'],
    safeExample:
      'SecretRef: secret://local/default/echo-service/DB_PASSWORD (value hidden)',
    nextAction:
      'Import portable master key or re-wrap this vault for the current machine.',
  },
  {
    id: 'file-source',
    title: 'File source',
    kind: 'file',
    summary:
      'Validate a least-privilege file source path and preview affected refs before enabling it.',
    status: 'degraded',
    affected: ['@node:NPM_TOKEN', '@serviceadmin:SESSION_SECRET'],
    safeExample: 'file://C:/service-lasso/secrets/runtime.env#SESSION_SECRET',
    warning:
      'Risky broad paths are rejected; keep file grants scoped to the smallest secrets directory.',
    nextAction: 'Choose a narrower path and test again before saving.',
  },
  {
    id: 'exec-adapter',
    title: 'OpenClaw exec adapter',
    kind: 'exec',
    summary:
      'Check resolver health, namespace policy, and last result without printing command output values.',
    status: 'policy-denied',
    affected: ['openclaw/service-lasso/*', '@serviceadmin:OPENCLAW_TOKEN'],
    safeExample:
      'SecretRef: exec://openclaw/service-lasso/SESSION_TOKEN (value hidden)',
    warning:
      'Exec adapters must use allowlisted namespaces and must not echo secrets to logs.',
    nextAction:
      'Review policy denial, update namespace allowlist, and record an audit reason.',
  },
  {
    id: 'external-manager',
    title: 'External source auth',
    kind: 'vault/1password/aws/bitwarden',
    summary:
      'Surface expired Vault tokens, locked password managers, or missing cloud credentials before services start.',
    status: 'auth-required',
    affected: [
      'payments-api:STRIPE_KEY',
      'backup-worker:AWS_SECRET_ACCESS_KEY',
    ],
    safeExample:
      'SecretRef: vault://kv/service-lasso/payments/STRIPE_KEY (value hidden)',
    nextAction:
      'Authenticate the external source once, then retry affected refs.',
  },
  {
    id: 'generated-writeback',
    title: 'Generated secret write-back',
    kind: 'write-back',
    summary:
      'Preview generated secret storage decisions with policy and audit links, never the generated value.',
    status: 'ready',
    affected: ['@serviceadmin:SESSION_SECRET'],
    safeExample:
      'write-back: local/default/@serviceadmin/SESSION_SECRET (generated value hidden)',
    nextAction:
      'Confirm operation, policy decision, and audit reason before writing.',
  },
]

const brokerOverviewScenarios: SecretsBrokerOverviewScenario[] = [
  {
    id: 'healthy',
    label: 'Healthy preview',
    health: {
      state: 'healthy',
      title: '@secretsbroker healthy',
      summary:
        'Broker API is reachable and all startup-critical sources have safe metadata available.',
      apiReachable: true,
      lastCheckedAt: '2026-05-07T19:20:00Z',
    },
    storage: {
      localStore: 'local encrypted store reachable',
      externalSource: 'Vault-backed source available behind broker',
      backendState: 'hybrid local-first backend',
    },
    keystore: {
      state: 'available',
      version: 'key version v3',
      warning: 'no rotation warning',
    },
    operations: {
      reconnectRequired: 0,
      recentResolveFailures: 0,
      recentDeniedRequests: 1,
      lastAuditEvent: 'resolve granted · local · 2026-05-07T19:18:00Z',
    },
  },
  {
    id: 'degraded',
    label: 'Degraded preview',
    health: {
      state: 'degraded',
      title: '@secretsbroker degraded',
      summary:
        'Broker API is reachable, but one external provider requires operator re-authentication before dependent services use it.',
      apiReachable: true,
      lastCheckedAt: '2026-05-07T19:21:00Z',
    },
    storage: {
      localStore: 'local encrypted store reachable',
      externalSource: 'Vault source_auth_required',
      backendState: 'external source unavailable for dependent refs',
    },
    keystore: {
      state: 'available',
      version: 'key version v3',
      warning: 'rotation not required',
    },
    operations: {
      reconnectRequired: 1,
      recentResolveFailures: 2,
      recentDeniedRequests: 1,
      lastAuditEvent: 'refresh failure · vault · 2026-05-07T19:19:00Z',
    },
  },
  {
    id: 'offline',
    label: 'Offline preview',
    health: {
      state: 'offline',
      title: '@secretsbroker offline',
      summary:
        'Broker API is not reachable. Service Admin can show the last safe metadata snapshot, but live tests are unavailable.',
      apiReachable: false,
      lastCheckedAt: '2026-05-07T19:10:00Z',
    },
    storage: {
      localStore: 'unknown while broker is offline',
      externalSource: 'not checked',
      backendState: 'live backend state unavailable',
    },
    keystore: {
      state: 'unknown',
      version: 'not exposed while offline',
      warning: 'start @secretsbroker or inspect core API/CLI',
    },
    operations: {
      reconnectRequired: 0,
      recentResolveFailures: 0,
      recentDeniedRequests: 0,
      lastAuditEvent: 'last cached event only',
    },
  },
  {
    id: 'unconfigured',
    label: 'Unconfigured preview',
    health: {
      state: 'unconfigured',
      title: '@secretsbroker setup needed',
      summary:
        'No broker source is configured yet. Add a local encrypted store or external source before resolving refs.',
      apiReachable: true,
      lastCheckedAt: '2026-05-07T19:22:00Z',
    },
    storage: {
      localStore: 'not configured',
      externalSource: 'none configured',
      backendState: 'setup_needed',
    },
    keystore: {
      state: 'unavailable',
      version: 'no key version yet',
      warning: 'create or import a master key before enabling sources',
    },
    operations: {
      reconnectRequired: 0,
      recentResolveFailures: 0,
      recentDeniedRequests: 0,
      lastAuditEvent: 'no audit events yet',
    },
    emptyState:
      'Add a local encrypted store or connect an external source to activate @secretsbroker.',
  },
]

const brokerOverviewStateCopy: Record<SecretsBrokerOverviewState, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  offline: 'Offline',
  unconfigured: 'Setup needed',
}

const backupStateCopy: Record<SecretsBrokerBackupState, string> = {
  ready: 'Ready',
  missing: 'Missing backup',
  stale: 'Backup stale',
  blocked: 'Blocked',
}

const backupStateVariant: Record<
  SecretsBrokerBackupState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  ready: 'default',
  missing: 'destructive',
  stale: 'secondary',
  blocked: 'destructive',
}

const rotationStateCopy: Record<SecretsBrokerRotationState, string> = {
  current: 'Current',
  'rotation-due': 'Rotation due',
  'recovery-risk': 'Recovery risk',
  blocked: 'Blocked',
}

const rotationStateVariant: Record<
  SecretsBrokerRotationState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  current: 'default',
  'rotation-due': 'secondary',
  'recovery-risk': 'destructive',
  blocked: 'destructive',
}

const brokerOverviewStateVariant: Record<
  SecretsBrokerOverviewState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  healthy: 'default',
  degraded: 'secondary',
  offline: 'destructive',
  unconfigured: 'outline',
}

const diagnosticStatusCopy: Record<SecretsBrokerDiagnosticStatus, string> = {
  pass: 'Passing',
  warning: 'Warning',
  fail: 'Failing',
}

const diagnosticStatusVariant: Record<
  SecretsBrokerDiagnosticStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pass: 'default',
  warning: 'secondary',
  fail: 'destructive',
}

const auditOutcomeVariant: Record<
  SecretsBrokerAuditOutcome,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  granted: 'default',
  success: 'default',
  denied: 'destructive',
  failure: 'secondary',
  revoked: 'outline',
}

const auditTamperEvidenceCopy: Record<
  SecretsBrokerAuditTamperEvidenceStatus,
  string
> = {
  verified: 'Tamper evidence verified',
  broken: 'Tamper evidence broken',
  unavailable: 'Tamper evidence unavailable',
}

const auditTamperEvidenceVariant: Record<
  SecretsBrokerAuditTamperEvidenceStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  verified: 'default',
  broken: 'destructive',
  unavailable: 'outline',
}

const sourceStateCopy: Record<SecretsBrokerSourceState, string> = {
  configured: 'Configured',
  'not-configured': 'Not configured',
  reachable: 'Reachable',
  failing: 'Failing',
  untested: 'Untested',
}

const sourceStateVariant: Record<
  SecretsBrokerSourceState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  configured: 'secondary',
  'not-configured': 'outline',
  reachable: 'default',
  failing: 'destructive',
  untested: 'outline',
}

const warningVariant: Record<
  SecretsBrokerSourceBackend['warnings'][number]['severity'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  info: 'outline',
  warning: 'secondary',
  critical: 'destructive',
}

const sourceActionCopy: Record<
  SecretsBrokerSourceBackend['supportedActions'][number],
  string
> = {
  'test-source': 'Test source',
  'view-diagnostics': 'View diagnostics',
  'edit-configuration': 'Edit configuration',
  'view-examples': 'View examples',
}

const providerConnectionStatusCopy: Record<
  SecretsBrokerProviderConnectionState,
  string
> = {
  healthy: 'Healthy',
  degraded: 'Reconnect required',
  failed: 'Failing',
  disabled: 'Disabled',
  missing: 'Failing',
}

const providerConnectionStatusVariant: Record<
  SecretsBrokerProviderConnectionState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  healthy: 'default',
  degraded: 'secondary',
  failed: 'destructive',
  disabled: 'outline',
  missing: 'destructive',
}

const providerLifecycleStatusCopy: Record<
  SecretsBrokerProviderLifecycleStatus,
  string
> = {
  connected: 'Connected',
  expiring: 'Expiring',
  'auth-required': 'Auth required',
  'reconnect-required': 'Reconnect required',
  'refresh-failed': 'Refresh failed',
  revoked: 'Revoked',
  'permission-changed': 'Permission changed',
  degraded: 'Degraded',
}

const providerLifecycleStatusVariant: Record<
  SecretsBrokerProviderLifecycleStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  connected: 'default',
  expiring: 'secondary',
  'auth-required': 'destructive',
  'reconnect-required': 'secondary',
  'refresh-failed': 'destructive',
  revoked: 'destructive',
  'permission-changed': 'secondary',
  degraded: 'secondary',
}

const providerConnectionStates = Array.from(
  new Set(
    secretsBrokerProviderConnections.map((connection) => connection.state)
  )
)
const providerConnectionProviders = Array.from(
  new Set(
    secretsBrokerProviderConnections.map((connection) => connection.provider)
  )
)

const workflowRefStatusCopy: Record<WorkflowSecretRefStatus, string> = {
  valid: 'Valid',
  missing: 'Missing',
  denied: 'Denied',
  warning: 'Needs retest',
}

const workflowRefStatusVariant: Record<
  WorkflowSecretRefStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  valid: 'default',
  missing: 'destructive',
  denied: 'destructive',
  warning: 'secondary',
}

const operationalControlSeverityVariant: Record<
  OperationalControlSeverity,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  info: 'default',
  warning: 'secondary',
  critical: 'destructive',
}

const operationalControlOutcomeVariant: Record<
  OperationalControlOutcome,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  allowed: 'default',
  recorded: 'default',
  warning: 'secondary',
  blocked: 'destructive',
  denied: 'destructive',
}

function filterProviderConnections(
  connections: SecretsBrokerProviderConnectionDetail[],
  filters: {
    provider: string
    status: SecretsBrokerProviderConnectionState | 'all'
    query: string
  }
) {
  const query = filters.query.trim().toLowerCase()

  return connections.filter((connection) => {
    const providerMatches =
      filters.provider === 'all' || connection.provider === filters.provider
    const statusMatches =
      filters.status === 'all' || connection.state === filters.status
    const queryMatches =
      query.length === 0 ||
      [
        connection.title,
        connection.provider,
        connection.source,
        connection.connectionRef,
        connection.health.label,
        connection.lifecycle.label,
        connection.lifecycle.status,
        connection.lifecycle.lastRefreshError ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)

    return providerMatches && statusMatches && queryMatches
  })
}

const auditTypes = Array.from(
  new Set(secretsBrokerAuditEvents.map((event) => event.type))
)
const auditOutcomes = Array.from(
  new Set(secretsBrokerAuditEvents.map((event) => event.outcome))
)
const auditProviders = Array.from(
  new Set(secretsBrokerAuditEvents.map((event) => event.provider))
)
const auditTamperEvidenceStates = Array.from(
  new Set(secretsBrokerAuditEvents.map((event) => event.tamperEvidence.status))
)

function BackupKeyActionButton({
  action,
}: {
  action: SecretsBrokerBackupKeyAction
}) {
  return (
    <div className='rounded-lg border p-3 text-sm'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Button
          type='button'
          size='sm'
          variant={action.state === 'danger' ? 'destructive' : 'outline'}
          disabled={action.state === 'disabled'}
        >
          {action.label}
        </Button>
        <Badge variant={action.state === 'danger' ? 'destructive' : 'outline'}>
          {action.state}
        </Badge>
      </div>
      {action.confirmationCopy ? (
        <p className='mt-2 text-xs text-muted-foreground'>
          Confirmation required: {action.confirmationCopy}
        </p>
      ) : null}
      {action.disabledReason ? (
        <p className='mt-2 text-xs text-muted-foreground'>
          {action.disabledReason}
        </p>
      ) : null}
    </div>
  )
}

function BackupKeyManagementPanel() {
  const status = secretsBrokerBackupKeyStatus

  return (
    <Card id='backup-key-management'>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <FileKey2 className='size-4' /> Backup, restore, and key
              management
            </CardTitle>
            <CardDescription>
              Safe operator view for encrypted backup status, restore readiness,
              portable master-key posture, and key rotation actions. Metadata
              only: raw secret values and key material are never rendered.
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant={backupStateVariant[status.backup.state]}>
              {backupStateCopy[status.backup.state]}
            </Badge>
            <Badge variant={rotationStateVariant[status.key.state]}>
              {rotationStateCopy[status.key.state]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-4 lg:grid-cols-2'>
          <div className='rounded-lg border p-4 text-sm'>
            <div className='mb-2 flex items-center gap-2 font-medium'>
              <ClipboardCheck className='size-4' /> Backup status
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Last backup
                </div>
                <div>{status.backup.lastBackupAt ?? 'not available'}</div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Artifact
                </div>
                <div>{status.backup.artifact}</div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Storage location
                </div>
                <div>{status.backup.location}</div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Restore readiness
                </div>
                <div>{status.backup.restoreReadiness}</div>
                <div className='text-xs text-muted-foreground'>
                  verified {status.backup.restoreLastVerifiedAt ?? 'never'}
                </div>
              </div>
            </div>
            {status.backup.warning ? (
              <div className='mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive'>
                {status.backup.warning}
              </div>
            ) : null}
          </div>

          <div className='rounded-lg border p-4 text-sm'>
            <div className='mb-2 flex items-center gap-2 font-medium'>
              <KeyRound className='size-4' /> Portable master-key status
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Key version
                </div>
                <div>{status.key.keyVersion}</div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Key id
                </div>
                <div>{status.key.keyId}</div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Rotation status
                </div>
                <div>{status.key.rotationStatus}</div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Recovery material
                </div>
                <div>{status.key.recoveryMaterial}</div>
              </div>
            </div>
            {status.key.warning ? (
              <div className='mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive'>
                {status.key.warning}
              </div>
            ) : null}
          </div>
        </div>

        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
          {status.actions.map((action) => (
            <BackupKeyActionButton key={action.id} action={action} />
          ))}
        </div>

        <div className='rounded-lg border p-4 text-sm'>
          <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
            <div className='font-medium'>Recent backup/key audit metadata</div>
            <Badge variant='secondary'>No values or key material</Badge>
          </div>
          <div className='grid gap-3 lg:grid-cols-3'>
            {status.audit.map((event) => (
              <div key={event.id} className='rounded-md bg-muted/40 p-3'>
                <div className='font-medium'>{event.operation}</div>
                <div className='text-xs text-muted-foreground'>
                  {event.at} · {event.outcome}
                </div>
                <div className='mt-2'>{event.metadata}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SourceBackendCard({ source }: { source: SecretsBrokerSourceBackend }) {
  const actionLinks: Partial<
    Record<SecretsBrokerSourceBackend['supportedActions'][number], string>
  > = {
    'view-diagnostics': '/secrets-broker/sources',
    'edit-configuration': '/secrets-broker/sources',
  }

  return (
    <div className='rounded-lg border p-4 text-sm'>
      <div className='mb-3 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <div className='flex items-center gap-2 font-medium'>
            <FileKey2 className='size-4' />
            {source.title}
          </div>
          <div className='text-xs text-muted-foreground'>
            {source.type} · {source.provider} · {source.mode}
          </div>
        </div>
        <Badge variant={sourceStateVariant[source.state]}>
          {sourceStateCopy[source.state]}
        </Badge>
      </div>
      <p className='text-muted-foreground'>{source.summary}</p>

      <div className='mt-3 grid gap-3 md:grid-cols-2'>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Source/backend
          </div>
          <div>{source.source}</div>
          <div className='text-xs text-muted-foreground'>
            {source.connection}
          </div>
        </div>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Last test result
          </div>
          <div>
            {source.testResult.outcome} · {source.testResult.checkedAt}
          </div>
          <div className='text-xs text-muted-foreground'>
            Last check: {source.lastCheckedAt}
          </div>
        </div>
      </div>

      <div className='mt-3 rounded-md bg-muted/40 p-2'>
        <div className='text-xs font-medium text-muted-foreground uppercase'>
          Test metadata only
        </div>
        <div className='mt-1 flex flex-wrap gap-1'>
          {source.testResult.metadata.map((item) => (
            <Badge key={item} variant='outline'>
              {item}
            </Badge>
          ))}
        </div>
      </div>

      <div className='mt-3 grid gap-3 md:grid-cols-2'>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Example refs
          </div>
          <div className='mt-1 space-y-1'>
            {source.exampleRefs.map((ref) => (
              <div key={ref} className='font-mono text-xs break-all'>
                {ref}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Example config
          </div>
          <div className='mt-1 space-y-1'>
            {source.exampleConfig.map((line) => (
              <div key={line} className='font-mono text-xs break-all'>
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>

      {source.warnings.length ? (
        <div className='mt-3 space-y-2'>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Security warnings
          </div>
          {source.warnings.map((warning) => (
            <div key={warning.code} className='rounded-md border p-2'>
              <div className='mb-1 flex flex-wrap items-center gap-2'>
                <Badge variant={warningVariant[warning.severity]}>
                  {warning.title}
                </Badge>
                <span className='font-mono text-xs text-muted-foreground'>
                  {warning.code}
                </span>
              </div>
              <div className='text-muted-foreground'>{warning.description}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className='mt-3 rounded-md border border-dashed p-2 text-xs text-muted-foreground'>
          No source security warnings.
        </div>
      )}

      <div className='mt-3 flex flex-wrap gap-2'>
        {source.supportedActions.map((action) => {
          const href = actionLinks[action]

          return href ? (
            <Button
              key={action}
              type='button'
              variant='outline'
              size='sm'
              asChild
            >
              <Link to={href}>{sourceActionCopy[action]}</Link>
            </Button>
          ) : (
            <Button key={action} type='button' variant='outline' size='sm'>
              {sourceActionCopy[action]}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function AuditEventDetail({ event }: { event: SecretsBrokerAuditEvent }) {
  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='text-base'>Event detail</CardTitle>
            <CardDescription>{event.id}</CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant={auditOutcomeVariant[event.outcome]}>
              {event.outcome}
            </Badge>
            <Badge
              variant={auditTamperEvidenceVariant[event.tamperEvidence.status]}
            >
              {event.tamperEvidence.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4 text-sm'>
        <div className='grid gap-3 md:grid-cols-2'>
          <div>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Event
            </div>
            <div>{auditEventTypeLabel(event.type)}</div>
          </div>
          <div>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Timestamp
            </div>
            <div>{event.timestamp}</div>
          </div>
          <div>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Provider/source
            </div>
            <div>
              {event.provider} · {event.source}
            </div>
          </div>
          <div>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Connection
            </div>
            <div>{event.connection}</div>
          </div>
          <div>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Actor
            </div>
            <div>
              {event.actorType}: {event.actorId}
            </div>
          </div>
          <div>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Service/workflow/run
            </div>
            <div>{event.serviceOrWorkflow}</div>
          </div>
        </div>
        <div className='rounded-md bg-muted/40 p-2'>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            SecretRef identifier
          </div>
          <div className='font-mono break-all'>{event.ref}</div>
        </div>
        <div className='grid gap-3 md:grid-cols-2'>
          <div className='rounded-md bg-muted/40 p-2'>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Affected refs
            </div>
            <div className='mt-1 flex flex-wrap gap-1'>
              {event.affectedRefs.map((ref) => (
                <Badge key={ref} variant='outline'>
                  {ref}
                </Badge>
              ))}
            </div>
          </div>
          <div className='rounded-md bg-muted/40 p-2'>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Affected services/workflows
            </div>
            <div className='mt-1 flex flex-wrap gap-1'>
              {event.affectedServices.map((service) => (
                <Badge key={service} variant='outline'>
                  {service}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className='rounded-md bg-muted/40 p-2'>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Policy decision
          </div>
          <div>{event.policyId}</div>
          <div className='text-muted-foreground'>{event.policyDecision}</div>
        </div>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Audit reason
          </div>
          <p className='text-muted-foreground'>{event.auditReason}</p>
        </div>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Normalized reason
          </div>
          <p className='text-muted-foreground'>{event.normalizedReason}</p>
        </div>
        <div className='rounded-md bg-muted/40 p-2'>
          <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
            <div className='text-xs font-medium text-muted-foreground uppercase'>
              Tamper-evidence status
            </div>
            <Badge
              variant={auditTamperEvidenceVariant[event.tamperEvidence.status]}
            >
              {auditTamperEvidenceCopy[event.tamperEvidence.status]}
            </Badge>
          </div>
          <div className='grid gap-2 text-xs md:grid-cols-2'>
            <span>chain: {event.tamperEvidence.chainId}</span>
            <span>
              sequence:{' '}
              {event.tamperEvidence.sequence === null
                ? 'unavailable'
                : event.tamperEvidence.sequence}
            </span>
            <span>
              previous hash:{' '}
              {event.tamperEvidence.previousHashRef ?? 'unavailable'}
            </span>
            <span>
              entry hash: {event.tamperEvidence.entryHashRef ?? 'unavailable'}
            </span>
            <span>
              checked: {event.tamperEvidence.checkedAt ?? 'not checked'}
            </span>
          </div>
          <p className='mt-2 text-xs text-muted-foreground'>
            {event.tamperEvidence.note}
          </p>
        </div>
        <div className='flex gap-3 rounded-lg border p-3'>
          <ShieldCheck className='mt-0.5 size-4 shrink-0' />
          <div>
            Event details use safe identifiers, policy metadata, and normalized
            reasons only. Resolved secret values are not stored in this fixture
            or rendered by this panel.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DiagnosticCard({
  diagnostic,
}: {
  diagnostic: SecretsBrokerDiagnostic
}) {
  return (
    <div className='rounded-lg border p-3 text-sm'>
      <div className='mb-2 flex flex-wrap items-start justify-between gap-2'>
        <div>
          <div className='font-medium'>{diagnostic.title}</div>
          <div className='text-xs text-muted-foreground'>
            {diagnostic.category} · {diagnostic.code} · last checked{' '}
            {diagnostic.lastCheckedAt}
          </div>
        </div>
        <Badge variant={diagnosticStatusVariant[diagnostic.status]}>
          {diagnosticStatusCopy[diagnostic.status]}
        </Badge>
      </div>
      <p className='text-muted-foreground'>{diagnostic.normalizedMessage}</p>
      <div className='mt-3 grid gap-2 md:grid-cols-2'>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Affected refs
          </div>
          <div className='mt-1 flex flex-wrap gap-1'>
            {diagnostic.affectedRefs.length ? (
              diagnostic.affectedRefs.map((ref) => (
                <Badge key={ref} variant='outline'>
                  {ref}
                </Badge>
              ))
            ) : (
              <span className='text-xs text-muted-foreground'>none</span>
            )}
          </div>
        </div>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Affected services/workflows
          </div>
          <div className='mt-1 flex flex-wrap gap-1'>
            {diagnostic.affectedServices.map((service) => (
              <Badge key={service} variant='outline'>
                {service}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <div className='mt-3 rounded-md bg-muted/40 p-2'>
        <div className='text-xs font-medium text-muted-foreground uppercase'>
          Suggested fix
        </div>
        <div>{diagnostic.suggestedFix}</div>
      </div>
      <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
        <span className='text-xs text-muted-foreground'>
          Source: {diagnostic.sourceLabel}
        </span>
        <Button variant='outline' size='sm' asChild>
          <Link to={diagnostic.link.to} search={diagnostic.link.search}>
            {diagnostic.link.label}
          </Link>
        </Button>
      </div>
    </div>
  )
}

function OperationalControlsPanel() {
  const [serviceFilter, setServiceFilter] = useState('all')
  const [providerFilter, setProviderFilter] = useState('all')
  const [operationFilter, setOperationFilter] = useState('all')
  const [outcomeFilter, setOutcomeFilter] = useState<
    OperationalControlOutcome | 'all'
  >('all')
  const [severityFilter, setSeverityFilter] = useState<
    OperationalControlSeverity | 'all'
  >('all')
  const [sinceFilter, setSinceFilter] = useState('')
  const [untilFilter, setUntilFilter] = useState('')
  const [lockoutClearReasons, setLockoutClearReasons] = useState<
    Record<string, string>
  >({})
  const [lockoutClearConfirmations, setLockoutClearConfirmations] = useState<
    Record<string, string>
  >({})
  const [lockoutClearResults, setLockoutClearResults] = useState<
    Record<string, OperationalControlLockoutClearResult>
  >({})

  const services = Array.from(
    new Set(operationalControlEvents.map((event) => event.serviceId))
  )
  const providers = Array.from(
    new Set(operationalControlEvents.map((event) => event.providerId))
  )
  const operations = Array.from(
    new Set(operationalControlEvents.map((event) => event.operation))
  )
  const outcomes = Array.from(
    new Set(operationalControlEvents.map((event) => event.outcome))
  )
  const severities = Array.from(
    new Set(operationalControlEvents.map((event) => event.severity))
  )
  const filteredEvents = filterOperationalControlEvents(
    operationalControlEvents,
    {
      serviceId: serviceFilter,
      providerId: providerFilter,
      operation: operationFilter,
      outcome: outcomeFilter,
      severity: severityFilter,
      since: sinceFilter,
      until: untilFilter,
    }
  )

  return (
    <Card id='operational-controls'>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <ShieldCheck className='size-4' /> Operational controls
            </CardTitle>
            <CardDescription>
              Policy, audit, telemetry, event filtering, and lockout posture for
              Secrets Broker operations. The surface shows refs, scopes,
              counters, and outcomes only.
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary'>Metadata only</Badge>
            <Badge variant='outline'>Raw values hidden</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 md:grid-cols-4'>
          {operationalControlMetrics.map((metric) => (
            <div key={metric.label} className='rounded-lg border p-3'>
              <div className='flex items-center justify-between gap-2'>
                <div className='text-xs text-muted-foreground'>
                  {metric.label}
                </div>
                <Badge
                  variant={operationalControlSeverityVariant[metric.status]}
                >
                  {metric.status}
                </Badge>
              </div>
              <div className='mt-1 text-xl font-bold'>{metric.value}</div>
              <div className='mt-1 text-xs text-muted-foreground'>
                {metric.detail}
              </div>
            </div>
          ))}
        </div>

        <div className='grid gap-4 lg:grid-cols-[1fr_1fr]'>
          <div className='rounded-lg border p-4'>
            <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
              <div>
                <div className='font-medium'>Effective service policy</div>
                <div className='text-xs text-muted-foreground'>
                  Service manifest scopes and fail-closed decision state.
                </div>
              </div>
              <Badge variant='outline'>no value material</Badge>
            </div>
            <div className='space-y-3'>
              {operationalControlPolicies.map((policy) => (
                <div
                  key={policy.serviceId}
                  className='rounded-md border p-3 text-sm'
                >
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='font-medium'>{policy.serviceId}</div>
                    <Badge
                      variant={
                        policy.decision === 'allowed'
                          ? 'default'
                          : policy.decision === 'denied'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {policy.decision}
                    </Badge>
                  </div>
                  <div className='mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3'>
                    <div>
                      <div className='font-medium text-foreground'>Resolve</div>
                      {policy.resolveScopes.join(', ') || 'none'}
                    </div>
                    <div>
                      <div className='font-medium text-foreground'>
                        Writeback
                      </div>
                      {policy.writebackScopes.join(', ') || 'none'}
                    </div>
                    <div>
                      <div className='font-medium text-foreground'>Manage</div>
                      {policy.manageScopes.join(', ') || 'none'}
                    </div>
                  </div>
                  <div className='mt-2 text-xs text-muted-foreground'>
                    {policy.blocker}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className='rounded-lg border p-4'>
            <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
              <div>
                <div className='font-medium'>Scoped lockouts</div>
                <div className='text-xs text-muted-foreground'>
                  Affected scopes, retry windows, and audited-clear support.
                </div>
              </div>
              <Badge variant='outline'>secret-bearing actions only</Badge>
            </div>
            <div className='space-y-3'>
              {operationalControlLockouts.map((lockout) => {
                const auditReason = lockoutClearReasons[lockout.id] ?? ''
                const confirmation = lockoutClearConfirmations[lockout.id] ?? ''
                const preview = buildOperationalLockoutClearPreview(
                  lockout,
                  auditReason,
                  confirmation
                )
                const result = lockoutClearResults[lockout.id]

                return (
                  <div
                    key={lockout.id}
                    className='rounded-md border p-3 text-sm'
                  >
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <div className='font-medium'>{lockout.scope}</div>
                      <Badge
                        variant={
                          lockout.status === 'active'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {lockout.status}
                      </Badge>
                    </div>
                    <div className='mt-2 text-muted-foreground'>
                      {lockout.affected}
                    </div>
                    <div className='mt-2 grid gap-2 text-xs sm:grid-cols-2'>
                      <div>Retry after: {lockout.retryAfterSeconds}s</div>
                      <div>
                        Audited clear:{' '}
                        {lockout.auditedClearSupported
                          ? 'supported'
                          : 'blocked'}
                      </div>
                      <div>Endpoint: {lockout.clearEndpoint}</div>
                      <div>Audit status: {lockout.auditStatus}</div>
                    </div>
                    <div className='mt-2 text-xs text-muted-foreground'>
                      {lockout.reason}
                    </div>

                    {lockout.auditedClearSupported ? (
                      <div className='mt-3 space-y-3 rounded-md border bg-muted/30 p-3'>
                        <div>
                          <label
                            htmlFor={`${lockout.id}-clear-reason`}
                            className='mb-1 block text-xs font-medium'
                          >
                            Audit reason for lockout clear
                          </label>
                          <Textarea
                            id={`${lockout.id}-clear-reason`}
                            value={auditReason}
                            onChange={(event) =>
                              setLockoutClearReasons((current) => ({
                                ...current,
                                [lockout.id]: event.target.value,
                              }))
                            }
                            placeholder='why this scoped lockout is safe to clear'
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`${lockout.id}-clear-confirmation`}
                            className='mb-1 block text-xs font-medium'
                          >
                            Confirm exact lockout scope
                          </label>
                          <Input
                            id={`${lockout.id}-clear-confirmation`}
                            value={confirmation}
                            onChange={(event) =>
                              setLockoutClearConfirmations((current) => ({
                                ...current,
                                [lockout.id]: event.target.value,
                              }))
                            }
                            placeholder={lockout.scope}
                          />
                        </div>
                        <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                          <Badge
                            variant={
                              preview.canSubmit ? 'default' : 'secondary'
                            }
                          >
                            {preview.outcome}
                          </Badge>
                          <span>{preview.nextAction}</span>
                        </div>
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          disabled={!preview.canSubmit}
                          onClick={() => {
                            const clearResult =
                              buildOperationalLockoutClearResult(
                                lockout,
                                auditReason,
                                confirmation
                              )

                            if (clearResult) {
                              setLockoutClearResults((current) => ({
                                ...current,
                                [lockout.id]: clearResult,
                              }))
                            }
                          }}
                        >
                          Request audited clear
                        </Button>
                        {result ? (
                          <div className='rounded-md border bg-background p-3 text-xs'>
                            <div className='font-medium'>
                              Audited clear recorded
                            </div>
                            <div className='mt-1 grid gap-1 text-muted-foreground sm:grid-cols-2'>
                              <div>request: {result.response.requestId}</div>
                              <div>outcome: {result.response.outcome}</div>
                              <div>audit: {result.response.auditStatus}</div>
                              <div>next: {result.response.nextAction}</div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <Button
                        className='mt-3'
                        type='button'
                        size='sm'
                        variant='outline'
                        disabled
                      >
                        Request audited clear
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className='rounded-lg border p-4'>
          <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
            <div>
              <div className='font-medium'>Operational events</div>
              <div className='text-xs text-muted-foreground'>
                Filters cover service, provider, operation, outcome, severity,
                and time window.
              </div>
            </div>
            <Button type='button' size='sm' variant='outline'>
              Export audit metadata
            </Button>
          </div>

          <div className='grid gap-3 md:grid-cols-7'>
            <div>
              <label
                htmlFor='operational-control-service'
                className='mb-1 block text-xs text-muted-foreground'
              >
                Control service
              </label>
              <select
                id='operational-control-service'
                className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value)}
              >
                <option value='all'>all</option>
                {services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor='operational-control-provider'
                className='mb-1 block text-xs text-muted-foreground'
              >
                Control provider
              </label>
              <select
                id='operational-control-provider'
                className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
              >
                <option value='all'>all</option>
                {providers.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor='operational-control-operation'
                className='mb-1 block text-xs text-muted-foreground'
              >
                Control operation
              </label>
              <select
                id='operational-control-operation'
                className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                value={operationFilter}
                onChange={(event) => setOperationFilter(event.target.value)}
              >
                <option value='all'>all</option>
                {operations.map((operation) => (
                  <option key={operation} value={operation}>
                    {operation}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor='operational-control-outcome'
                className='mb-1 block text-xs text-muted-foreground'
              >
                Control result
              </label>
              <select
                id='operational-control-outcome'
                className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                value={outcomeFilter}
                onChange={(event) =>
                  setOutcomeFilter(
                    event.target.value as OperationalControlOutcome | 'all'
                  )
                }
              >
                <option value='all'>all</option>
                {outcomes.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor='operational-control-severity'
                className='mb-1 block text-xs text-muted-foreground'
              >
                Control urgency
              </label>
              <select
                id='operational-control-severity'
                className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                value={severityFilter}
                onChange={(event) =>
                  setSeverityFilter(
                    event.target.value as OperationalControlSeverity | 'all'
                  )
                }
              >
                <option value='all'>all</option>
                {severities.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor='operational-control-since'
                className='mb-1 block text-xs text-muted-foreground'
              >
                Control since
              </label>
              <Input
                id='operational-control-since'
                value={sinceFilter}
                onChange={(event) => setSinceFilter(event.target.value)}
                placeholder='2026-05-22T04:00:00Z'
              />
            </div>
            <div>
              <label
                htmlFor='operational-control-until'
                className='mb-1 block text-xs text-muted-foreground'
              >
                Control until
              </label>
              <Input
                id='operational-control-until'
                value={untilFilter}
                onChange={(event) => setUntilFilter(event.target.value)}
                placeholder='2026-05-22T04:10:00Z'
              />
            </div>
          </div>

          <div className='mt-4 overflow-x-auto rounded-lg border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50 text-left'>
                <tr>
                  <th className='p-3 font-medium'>Event</th>
                  <th className='p-3 font-medium'>Service / provider</th>
                  <th className='p-3 font-medium'>Outcome</th>
                  <th className='p-3 font-medium'>Scope</th>
                  <th className='p-3 font-medium'>Next action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id} className='border-t align-top'>
                    <td className='p-3'>
                      <div className='font-medium'>{event.operation}</div>
                      <div className='text-xs text-muted-foreground'>
                        {event.family} · {event.timestamp}
                      </div>
                    </td>
                    <td className='p-3'>
                      <div>{event.serviceId}</div>
                      <div className='text-xs text-muted-foreground'>
                        {event.providerId}
                      </div>
                    </td>
                    <td className='p-3'>
                      <div className='flex flex-wrap gap-2'>
                        <Badge
                          variant={
                            operationalControlOutcomeVariant[event.outcome]
                          }
                        >
                          {event.outcome}
                        </Badge>
                        <Badge
                          variant={
                            operationalControlSeverityVariant[event.severity]
                          }
                        >
                          {event.severity}
                        </Badge>
                      </div>
                      <div className='mt-2 text-xs text-muted-foreground'>
                        {event.summary}
                      </div>
                    </td>
                    <td className='p-3 font-mono text-xs break-all'>
                      {event.refScope}
                    </td>
                    <td className='p-3'>{event.nextAction}</td>
                  </tr>
                ))}
                {!filteredEvents.length ? (
                  <tr>
                    <td className='p-3 text-muted-foreground' colSpan={5}>
                      No operational events match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PrivilegedSecretRevealPanel({
  scenarioId,
  revealed,
  onScenarioChange,
  onReveal,
  onHide,
}: {
  scenarioId: SingleSecretRevealState
  revealed: boolean
  onScenarioChange: (state: SingleSecretRevealState) => void
  onReveal: () => void
  onHide: (state: SingleSecretRevealState) => void
}) {
  const scenario =
    singleSecretRevealScenarios.find((item) => item.id === scenarioId) ??
    singleSecretRevealScenarios[0]
  const ref = singleSecretRevealReference
  const showValue = scenario.id === 'allowed' && revealed

  return (
    <Card id='privileged-secret-reveal'>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <LockKeyhole className='size-4' /> Privileged single-secret reveal
            </CardTitle>
            <CardDescription>
              Controlled Service Admin to Secrets Broker reveal flow for one
              selected ref. Default state is redacted; reveal is explicit,
              short-lived, fail-closed, and auditable.
            </CardDescription>
          </div>
          <Badge variant={scenario.canReveal ? 'default' : 'outline'}>
            {scenario.badge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='max-w-xs'>
          <label
            htmlFor='single-secret-reveal-state'
            className='mb-1 block text-xs text-muted-foreground'
          >
            Reveal workflow state
          </label>
          <select
            id='single-secret-reveal-state'
            className='h-9 w-full rounded-md border bg-background px-3 text-sm'
            value={scenarioId}
            onChange={(event) =>
              onScenarioChange(event.target.value as SingleSecretRevealState)
            }
          >
            {singleSecretRevealScenarios.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className='grid gap-4 lg:grid-cols-[1.1fr_0.9fr]'>
          <div className='rounded-lg border p-4 text-sm'>
            <div className='mb-3 flex items-center gap-2 font-medium'>
              <KeyRound className='size-4' /> Selected safe metadata
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Ref
                </div>
                <div className='break-all'>{ref.ref}</div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Secret name
                </div>
                <div>{ref.name}</div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Owning service
                </div>
                <div>{ref.owningService}</div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Provider / source
                </div>
                <div>
                  {ref.provider} � {ref.source}
                </div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Last updated
                </div>
                <div>{ref.lastUpdatedAt}</div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Policy
                </div>
                <div className='break-all'>{ref.policy}</div>
              </div>
            </div>
          </div>

          <div className='rounded-lg border p-4 text-sm'>
            <div className='mb-3 flex items-center gap-2 font-medium'>
              <ShieldCheck className='size-4' /> Reveal control
            </div>
            <div className='space-y-3'>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Status
                </div>
                <div>{scenario.status}</div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Raw value
                </div>
                {showValue ? (
                  <div
                    className='mt-1 rounded-md border border-destructive/40 bg-destructive/10 p-2 font-mono text-sm'
                    aria-live='polite'
                  >
                    {ref.fakeRawValue}
                  </div>
                ) : (
                  <div className='mt-1 rounded-md border bg-muted/50 p-2 font-mono text-sm'>
                    ������������
                  </div>
                )}
              </div>
              <p className='text-muted-foreground'>{scenario.reason}</p>
              <div className='rounded-md bg-muted/40 p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Audit/status feedback
                </div>
                <div>
                  {showValue
                    ? `Audit event recorded: ${ref.auditEventId}`
                    : scenario.auditStatus}
                </div>
              </div>
              {showValue ? (
                <div className='text-xs text-muted-foreground'>
                  Reveal window expires in 60 seconds. The value re-hides on
                  timeout, cancel, navigation away, or refresh. Copy/export is
                  disabled for this story.
                </div>
              ) : (
                <div className='text-xs text-muted-foreground'>
                  {scenario.nextAction}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            disabled={!scenario.canReveal || revealed}
            onClick={onReveal}
          >
            Reveal secret value
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={!revealed}
            onClick={() => onHide('cancelled')}
          >
            Cancel reveal
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={!revealed}
            onClick={() => onHide('expired')}
          >
            Expire reveal window
          </Button>
          <Badge variant='secondary'>Bulk reveal disabled</Badge>
          <Badge variant='outline'>Copy disabled</Badge>
          <Badge variant='outline'>No route/query value material</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

export function SecretsBrokerSetupWizard({
  focusSection = 'overview',
}: {
  focusSection?: SecretsBrokerSectionFocus
} = {}) {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const pageMetadata = secretsBrokerSectionMetadata[focusSection]

  useEffect(() => {
    if (focusSection !== 'overview') return

    const legacyHash = hash.replace(/^#/, '')
    const legacyHashRoute: Partial<Record<string, string>> = {
      'operational-controls': '/operations/audit-logging',
      'secret-sources': '/secrets-broker/sources',
      'provider-connections': '/secrets-broker/sources',
      'single-secret-reveal': '/secrets-broker/secrets',
      'single-reveal': '/secrets-broker/secrets',
      'backup-keys': '/secrets-broker/backup-keys',
      'workflow-authoring-boundary': '/secrets-broker/sources',
      'workflow-boundaries': '/secrets-broker/sources',
      'secrets-topology': '/secrets-broker/topology',
      topology: '/secrets-broker/topology',
      'audit-events': '/operations/audit-logging',
      diagnostics: '/secrets-broker/sources',
    }
    const route = legacyHashRoute[legacyHash]

    if (route) {
      void navigate({ to: route, replace: true })
    }
  }, [focusSection, hash, navigate])

  usePageMetadata({
    title: pageMetadata.title,
    description: pageMetadata.description,
  })

  const [auditTypeFilter, setAuditTypeFilter] = useState<
    SecretsBrokerAuditEventType | 'all'
  >('all')
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState<
    SecretsBrokerAuditOutcome | 'all'
  >('all')
  const [auditProviderFilter, setAuditProviderFilter] = useState<
    SecretsBrokerAuditEvent['provider'] | 'all'
  >('all')
  const [auditTamperEvidenceFilter, setAuditTamperEvidenceFilter] = useState<
    SecretsBrokerAuditTamperEvidenceStatus | 'all'
  >('all')
  const [auditQueryFilter, setAuditQueryFilter] = useState('')
  const [auditSinceFilter, setAuditSinceFilter] = useState('')
  const [auditUntilFilter, setAuditUntilFilter] = useState('')
  const [topologySearchQuery, setTopologySearchQuery] = useState('')
  const [selectedAuditEventId, setSelectedAuditEventId] = useState(
    secretsBrokerAuditEvents[0].id
  )
  const [connectionProviderFilter, setConnectionProviderFilter] =
    useState('all')
  const [connectionStatusFilter, setConnectionStatusFilter] = useState<
    SecretsBrokerProviderConnectionState | 'all'
  >('all')
  const [connectionQueryFilter, setConnectionQueryFilter] = useState('')
  const [overviewScenarioId, setOverviewScenarioId] =
    useState<SecretsBrokerOverviewState>('healthy')
  const [singleSecretRevealState, setSingleSecretRevealState] =
    useState<SingleSecretRevealState>('hidden')
  const [singleSecretRevealed, setSingleSecretRevealed] = useState(false)
  const [selectedWorkflowBoundaryId, setSelectedWorkflowBoundaryId] = useState(
    workflowAuthoringBoundaries[0].id
  )
  const brokerOverview =
    brokerOverviewScenarios.find(
      (scenario) => scenario.id === overviewScenarioId
    ) ?? brokerOverviewScenarios[0]
  const readyCount = wizardSources.filter(
    (source) => source.status === 'ready'
  ).length
  const blockedCount = wizardSources.length - readyCount
  const diagnosticCounts = countDiagnosticsByStatus(secretsBrokerDiagnostics)
  const sourceCounts = countSourceBackendsByState(secretsBrokerSourceBackends)
  const sourceWarningCount = secretsBrokerSourceBackends.reduce(
    (count, source) => count + source.warnings.length,
    0
  )
  const filteredProviderConnections = useMemo(
    () =>
      filterProviderConnections(secretsBrokerProviderConnections, {
        provider: connectionProviderFilter,
        status: connectionStatusFilter,
        query: connectionQueryFilter,
      }),
    [connectionProviderFilter, connectionQueryFilter, connectionStatusFilter]
  )
  const providerConnectionsNeedingAction =
    secretsBrokerProviderConnections.filter((connection) =>
      ['degraded', 'failed', 'missing'].includes(connection.state)
    ).length
  const selectedWorkflowBoundary =
    workflowAuthoringBoundaries.find(
      (workflow) => workflow.id === selectedWorkflowBoundaryId
    ) ?? workflowAuthoringBoundaries[0]
  const workflowRefCounts = countWorkflowRefStatuses()
  const workflowRefsNeedingAction =
    workflowRefCounts.denied +
    workflowRefCounts.missing +
    workflowRefCounts.warning
  const selectedWorkflowBlocksSave = selectedWorkflowBoundary.refs.some((ref) =>
    ['denied', 'missing'].includes(ref.status)
  )
  const filteredAuditEvents = useMemo(
    () =>
      filterSecretsBrokerAuditEvents(secretsBrokerAuditEvents, {
        type: auditTypeFilter,
        outcome: auditOutcomeFilter,
        provider: auditProviderFilter,
        tamperEvidence: auditTamperEvidenceFilter,
        query: auditQueryFilter,
        since: auditSinceFilter,
        until: auditUntilFilter,
      }),
    [
      auditOutcomeFilter,
      auditProviderFilter,
      auditQueryFilter,
      auditTamperEvidenceFilter,
      auditSinceFilter,
      auditTypeFilter,
      auditUntilFilter,
    ]
  )
  const selectedAuditEvent =
    filteredAuditEvents.find((event) => event.id === selectedAuditEventId) ??
    filteredAuditEvents[0] ??
    secretsBrokerAuditEvents[0]
  const secretsTopology = useMemo(() => buildSecretsBrokerTopology(), [])
  const filteredSecretsTopology = useMemo(
    () => filterSecretsBrokerTopology(secretsTopology, topologySearchQuery),
    [secretsTopology, topologySearchQuery]
  )
  const reactFlowSecretsTopology = useMemo(
    () => toReactFlowSecretsBrokerTopology(filteredSecretsTopology),
    [filteredSecretsTopology]
  )
  const topologyProblemEdges = filteredSecretsTopology.edges.filter((edge) =>
    ['failed', 'denied', 'missing', 'warning'].includes(edge.status)
  )

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              {pageMetadata.heading}
            </h2>
            <p className='text-muted-foreground'>{pageMetadata.description}</p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/variables'>View variables</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/dependencies'>Dependency impact</Link>
            </Button>
          </div>
        </div>

        {focusSection === 'overview' ? (
          <>
            <Card>
              <CardHeader>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <CardTitle className='flex items-center gap-2'>
                      <ShieldCheck className='size-4' /> @secretsbroker overview
                    </CardTitle>
                    <CardDescription>
                      Broker health, API reachability, backend state, keystore
                      posture, and operator action summary. This overview uses
                      safe metadata only and never renders resolved secret
                      values.
                    </CardDescription>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <Badge
                      variant={
                        brokerOverviewStateVariant[brokerOverview.health.state]
                      }
                    >
                      {brokerOverviewStateCopy[brokerOverview.health.state]}
                    </Badge>
                    <Badge variant='outline'>Raw values hidden</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='max-w-xs'>
                  <label
                    htmlFor='broker-overview-scenario'
                    className='mb-1 block text-xs text-muted-foreground'
                  >
                    Preview state
                  </label>
                  <select
                    id='broker-overview-scenario'
                    className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                    value={overviewScenarioId}
                    onChange={(event) =>
                      setOverviewScenarioId(
                        event.target.value as SecretsBrokerOverviewState
                      )
                    }
                  >
                    {brokerOverviewScenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='grid gap-4 lg:grid-cols-[1.2fr_1fr]'>
                  <div className='rounded-lg border p-4'>
                    <div className='mb-2 flex flex-wrap items-center gap-2'>
                      {brokerOverview.health.apiReachable ? (
                        <CheckCircle2 className='size-4 text-primary' />
                      ) : (
                        <AlertTriangle className='size-4 text-destructive' />
                      )}
                      <div className='font-medium'>
                        {brokerOverview.health.title}
                      </div>
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      {brokerOverview.health.summary}
                    </p>
                    <div className='mt-3 grid gap-3 text-sm md:grid-cols-2'>
                      <div>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          API reachable
                        </div>
                        <div>
                          {brokerOverview.health.apiReachable ? 'yes' : 'no'}
                        </div>
                      </div>
                      <div>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Last health check
                        </div>
                        <div>{brokerOverview.health.lastCheckedAt}</div>
                      </div>
                    </div>
                    {brokerOverview.emptyState ? (
                      <div className='mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
                        {brokerOverview.emptyState}
                      </div>
                    ) : null}
                  </div>

                  <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-1'>
                    <div className='rounded-lg border p-3 text-sm'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Storage / backend summary
                      </div>
                      <div className='mt-1'>
                        {brokerOverview.storage.localStore}
                      </div>
                      <div className='text-muted-foreground'>
                        {brokerOverview.storage.externalSource}
                      </div>
                      <Badge className='mt-2' variant='outline'>
                        {brokerOverview.storage.backendState}
                      </Badge>
                    </div>
                    <div className='rounded-lg border p-3 text-sm'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Keystore / master key
                      </div>
                      <div className='mt-1'>
                        {brokerOverview.keystore.state}
                      </div>
                      <div className='text-muted-foreground'>
                        {brokerOverview.keystore.version}
                      </div>
                      <div className='mt-1 text-xs text-muted-foreground'>
                        {brokerOverview.keystore.warning}
                      </div>
                    </div>
                  </div>
                </div>

                <div className='grid gap-3 md:grid-cols-4'>
                  <div className='rounded-lg border p-3'>
                    <div className='text-xs text-muted-foreground'>
                      Reconnect required
                    </div>
                    <div className='text-2xl font-bold'>
                      {brokerOverview.operations.reconnectRequired}
                    </div>
                  </div>
                  <div className='rounded-lg border p-3'>
                    <div className='text-xs text-muted-foreground'>
                      Recent resolve failures
                    </div>
                    <div className='text-2xl font-bold'>
                      {brokerOverview.operations.recentResolveFailures}
                    </div>
                  </div>
                  <div className='rounded-lg border p-3'>
                    <div className='text-xs text-muted-foreground'>
                      Recent denied requests
                    </div>
                    <div className='text-2xl font-bold'>
                      {brokerOverview.operations.recentDeniedRequests}
                    </div>
                  </div>
                  <div className='rounded-lg border p-3'>
                    <div className='text-xs text-muted-foreground'>
                      Last audit event
                    </div>
                    <div className='text-sm font-medium'>
                      {brokerOverview.operations.lastAuditEvent}
                    </div>
                  </div>
                </div>

                <div className='flex flex-wrap gap-2'>
                  <Button variant='outline' size='sm' asChild>
                    <Link to='/secrets-broker/sources'>View providers</Link>
                  </Button>
                  <Button variant='outline' size='sm' asChild>
                    <Link to='/secrets-broker/sources'>Add provider</Link>
                  </Button>
                  <Button variant='outline' size='sm' asChild>
                    <Link to='/operations/audit-logging'>Audit Logging</Link>
                  </Button>
                  <Button variant='outline' size='sm' asChild>
                    <Link to='/secrets-broker/sources'>
                      View provider status
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className='grid gap-4 md:grid-cols-3'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-base'>Ready providers</CardTitle>
                  <CardDescription>
                    Sources that can be saved or retried safely.
                  </CardDescription>
                </CardHeader>
                <CardContent className='text-3xl font-bold'>
                  {readyCount}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-base'>
                    Needs operator action
                  </CardTitle>
                  <CardDescription>
                    Locked, degraded, denied, or auth-required states.
                  </CardDescription>
                </CardHeader>
                <CardContent className='text-3xl font-bold'>
                  {blockedCount}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-base'>Value handling</CardTitle>
                  <CardDescription>
                    No setup test renders resolved plaintext secrets.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant='secondary'>Values hidden</Badge>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {focusSection === 'operational-controls' ? (
          <OperationalControlsPanel />
        ) : null}

        {focusSection === 'single-reveal' ? (
          <PrivilegedSecretRevealPanel
            scenarioId={singleSecretRevealState}
            revealed={singleSecretRevealed}
            onScenarioChange={(state) => {
              setSingleSecretRevealState(state)
              setSingleSecretRevealed(false)
            }}
            onReveal={() => setSingleSecretRevealed(true)}
            onHide={(state) => {
              setSingleSecretRevealState(state)
              setSingleSecretRevealed(false)
            }}
          />
        ) : null}

        {focusSection === 'backup-keys' ? <BackupKeyManagementPanel /> : null}

        {focusSection === 'sources' ? (
          <Card id='secret-sources'>
            <CardHeader>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    <FileKey2 className='size-4' /> Secret Sources / Backends
                  </CardTitle>
                  <CardDescription>
                    Inspect local and external Secrets Broker sources, source
                    test results, safe example refs/config, and security
                    warnings without displaying returned secret values.
                  </CardDescription>
                </div>
                <Badge variant='secondary'>Metadata only</Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-3 md:grid-cols-4'>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>Reachable</div>
                  <div className='text-2xl font-bold'>
                    {sourceCounts.reachable}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>
                    Configured
                  </div>
                  <div className='text-2xl font-bold'>
                    {sourceCounts.configured}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>
                    Failing/untested
                  </div>
                  <div className='text-2xl font-bold'>
                    {sourceCounts.failing + sourceCounts.untested}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>Warnings</div>
                  <div className='text-2xl font-bold'>{sourceWarningCount}</div>
                </div>
              </div>

              <div className='grid gap-4 lg:grid-cols-2'>
                {secretsBrokerSourceBackends.map((source) => (
                  <SourceBackendCard key={source.id} source={source} />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {focusSection === 'provider-connections' ? (
          <Card id='provider-connections'>
            <CardHeader>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    <KeyRound className='size-4' /> Provider Connections
                  </CardTitle>
                  <CardDescription>
                    Search and filter external provider connections by provider,
                    status, and label. Secret material shows presence/status
                    only, never raw values.
                  </CardDescription>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Badge variant='secondary'>No raw values</Badge>
                  <Badge variant='outline'>
                    {providerConnectionsNeedingAction} need action
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-3 md:grid-cols-3'>
                <div>
                  <label
                    htmlFor='provider-connection-search'
                    className='mb-1 block text-xs text-muted-foreground'
                  >
                    Search label
                  </label>
                  <Input
                    id='provider-connection-search'
                    value={connectionQueryFilter}
                    onChange={(event) =>
                      setConnectionQueryFilter(event.target.value)
                    }
                    placeholder='label, source, provider'
                  />
                </div>
                <div>
                  <label
                    htmlFor='provider-connection-provider'
                    className='mb-1 block text-xs text-muted-foreground'
                  >
                    Connection provider
                  </label>
                  <select
                    id='provider-connection-provider'
                    className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                    value={connectionProviderFilter}
                    onChange={(event) =>
                      setConnectionProviderFilter(event.target.value)
                    }
                  >
                    <option value='all'>all</option>
                    {providerConnectionProviders.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor='provider-connection-status'
                    className='mb-1 block text-xs text-muted-foreground'
                  >
                    Connection status
                  </label>
                  <select
                    id='provider-connection-status'
                    className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                    value={connectionStatusFilter}
                    onChange={(event) =>
                      setConnectionStatusFilter(
                        event.target.value as
                          | SecretsBrokerProviderConnectionState
                          | 'all'
                      )
                    }
                  >
                    <option value='all'>all</option>
                    {providerConnectionStates.map((status) => (
                      <option key={status} value={status}>
                        {providerConnectionStatusCopy[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredProviderConnections.length === 0 ? (
                <div className='rounded-lg border border-dashed p-6 text-sm text-muted-foreground'>
                  No provider connections match these filters. Add a source or
                  connection from Secret Sources / Backends, then test the
                  connection before using it in services.
                </div>
              ) : (
                <div className='overflow-x-auto rounded-lg border'>
                  <table className='w-full text-sm'>
                    <thead className='bg-muted/50 text-left'>
                      <tr>
                        <th className='p-3 font-medium'>Provider</th>
                        <th className='p-3 font-medium'>Connection label</th>
                        <th className='p-3 font-medium'>Auth method</th>
                        <th className='p-3 font-medium'>Status</th>
                        <th className='p-3 font-medium'>Lifecycle</th>
                        <th className='p-3 font-medium'>Secret material</th>
                        <th className='p-3 font-medium'>Expiry / refresh</th>
                        <th className='p-3 font-medium'>Last check/error</th>
                        <th className='p-3 font-medium'>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProviderConnections.map((connection) => (
                        <tr key={connection.id} className='border-t align-top'>
                          <td className='p-3 font-medium'>
                            {connection.provider}
                          </td>
                          <td className='p-3'>
                            <div className='font-medium'>
                              {connection.title}
                            </div>
                            <div className='text-xs text-muted-foreground'>
                              {connection.source}
                            </div>
                          </td>
                          <td className='p-3'>
                            {connection.metadata.find(
                              (item) =>
                                item.label === 'Auth mode' ||
                                item.label === 'Mode' ||
                                item.label === 'Profile'
                            )?.value ?? 'metadata-only auth'}
                          </td>
                          <td className='p-3'>
                            <Badge
                              variant={
                                providerConnectionStatusVariant[
                                  connection.state
                                ]
                              }
                            >
                              {providerConnectionStatusCopy[connection.state]}
                            </Badge>
                            {['degraded', 'failed', 'missing'].includes(
                              connection.state
                            ) ? (
                              <div className='mt-2 text-xs font-medium text-destructive'>
                                Operator action required
                              </div>
                            ) : null}
                          </td>
                          <td className='p-3'>
                            <Badge
                              variant={
                                providerLifecycleStatusVariant[
                                  connection.lifecycle.status
                                ]
                              }
                            >
                              {
                                providerLifecycleStatusCopy[
                                  connection.lifecycle.status
                                ]
                              }
                            </Badge>
                            <div className='mt-2 text-xs text-muted-foreground'>
                              {connection.lifecycle.summary}
                            </div>
                          </td>
                          <td className='p-3'>
                            <div>{connection.secretMaterial.presence}</div>
                            <div className='text-xs text-muted-foreground'>
                              value hidden
                            </div>
                          </td>
                          <td className='p-3'>
                            {connection.secretMaterial.expiresAt ?? 'not set'}
                            <div className='text-xs text-muted-foreground'>
                              {connection.secretMaterial.refreshWindow ??
                                connection.health.nextAction}
                            </div>
                          </td>
                          <td className='p-3'>
                            <div>{connection.lifecycle.lastCheckedAt}</div>
                            {connection.lifecycle.lastRefreshError ? (
                              <div className='text-xs text-destructive'>
                                {connection.lifecycle.lastRefreshError}
                              </div>
                            ) : (
                              <div className='text-xs text-muted-foreground'>
                                last resolve:{' '}
                                {connection.usage.lastSuccessfulResolve ??
                                  'not recorded'}
                              </div>
                            )}
                            <div className='mt-2 flex flex-wrap gap-1 text-xs'>
                              {connection.lifecycle.auditEventRef ? (
                                <a
                                  href='/operations/audit-logging'
                                  className='text-primary underline-offset-4 hover:underline'
                                >
                                  Audit {connection.lifecycle.auditEventRef}
                                </a>
                              ) : null}
                              {connection.lifecycle.diagnosticRef ? (
                                <a
                                  href='/secrets-broker/sources'
                                  className='text-primary underline-offset-4 hover:underline'
                                >
                                  Diagnostics{' '}
                                  {connection.lifecycle.diagnosticRef}
                                </a>
                              ) : null}
                            </div>
                          </td>
                          <td className='p-3'>
                            <div className='flex flex-wrap gap-2'>
                              {connection.actions
                                .filter((action) =>
                                  [
                                    'reconnect',
                                    'refresh-test-now',
                                    'disable-enable',
                                  ].includes(action.id)
                                )
                                .map((action) => (
                                  <Button
                                    key={action.id}
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    disabled={
                                      action.state === 'disabled' ||
                                      action.state === 'unsupported'
                                    }
                                    title={
                                      action.state === 'unsupported'
                                        ? action.disabledReason
                                        : undefined
                                    }
                                  >
                                    {action.label}
                                    {action.state === 'unsupported'
                                      ? ' unavailable'
                                      : ''}
                                  </Button>
                                ))}
                              <Button asChild size='sm' variant='secondary'>
                                <Link
                                  to='/secrets-broker/$connectionId'
                                  params={{ connectionId: connection.id }}
                                >
                                  View details
                                </Link>
                              </Button>
                              <Button type='button' size='sm' variant='outline'>
                                View audit
                              </Button>
                            </div>
                            {connection.actions
                              .filter(
                                (action) =>
                                  action.state === 'unsupported' &&
                                  action.disabledReason
                              )
                              .map((action) => (
                                <div
                                  key={`${action.id}-unsupported-reason`}
                                  className='mt-2 text-xs text-muted-foreground'
                                >
                                  {action.label} unavailable:{' '}
                                  {action.disabledReason}
                                </div>
                              ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {focusSection === 'workflow-boundaries' ? (
          <Card id='workflow-authoring-boundary'>
            <CardHeader>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    <TerminalSquare className='size-4' /> Workflow authoring
                    boundary
                  </CardTitle>
                  <CardDescription>
                    Metadata-only guidance for authors wiring Secrets Broker
                    refs into workflows. This panel validates refs and generates
                    safe snippets without becoming a runner editor or resolving
                    secret values.
                  </CardDescription>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Badge variant='secondary'>No runner editor</Badge>
                  <Badge variant='outline'>SecretRefs only</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-3 md:grid-cols-4'>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>Workflows</div>
                  <div className='text-2xl font-bold'>
                    {workflowAuthoringBoundaries.length}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>
                    Valid refs
                  </div>
                  <div className='text-2xl font-bold'>
                    {workflowRefCounts.valid}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>
                    Need action
                  </div>
                  <div className='text-2xl font-bold'>
                    {workflowRefsNeedingAction}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>
                    Value policy
                  </div>
                  <div className='mt-1'>metadata-only validation</div>
                </div>
              </div>

              <div className='grid gap-4 lg:grid-cols-[0.9fr_1.1fr]'>
                <div className='space-y-3'>
                  <div>
                    <label
                      htmlFor='workflow-authoring-scenario'
                      className='mb-1 block text-xs text-muted-foreground'
                    >
                      Authoring scenario
                    </label>
                    <select
                      id='workflow-authoring-scenario'
                      className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                      value={selectedWorkflowBoundaryId}
                      onChange={(event) =>
                        setSelectedWorkflowBoundaryId(event.target.value)
                      }
                    >
                      {workflowAuthoringBoundaries.map((workflow) => (
                        <option key={workflow.id} value={workflow.id}>
                          {workflow.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className='rounded-lg border p-4 text-sm'>
                    <div className='mb-2 flex flex-wrap items-start justify-between gap-2'>
                      <div>
                        <div className='font-medium'>
                          {selectedWorkflowBoundary.title}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {selectedWorkflowBoundary.owner} ·{' '}
                          {selectedWorkflowBoundary.targetRuntime}
                        </div>
                      </div>
                      <Badge
                        variant={
                          selectedWorkflowBoundary.status === 'ready'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {selectedWorkflowBoundary.status === 'ready'
                          ? 'Ready to save'
                          : 'Needs action'}
                      </Badge>
                    </div>
                    <p className='text-muted-foreground'>
                      {selectedWorkflowBoundary.summary}
                    </p>
                    {selectedWorkflowBlocksSave ? (
                      <div className='mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive'>
                        Missing or denied refs should block save/run handoff
                        until policy and metadata issues are resolved.
                      </div>
                    ) : (
                      <div className='mt-3 rounded-md border p-3 text-muted-foreground'>
                        Ref checks are metadata-valid. Continue to provider
                        tests before any execution handoff.
                      </div>
                    )}
                  </div>

                  <div className='rounded-lg border p-4 text-sm'>
                    <div className='font-medium'>Boundary guardrails</div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {selectedWorkflowBoundary.guardrails.map((guardrail) => (
                        <li key={guardrail}>{guardrail}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className='space-y-4'>
                  <div className='overflow-x-auto rounded-lg border'>
                    <table className='w-full text-sm'>
                      <thead className='bg-muted/50 text-left'>
                        <tr>
                          <th className='p-3 font-medium'>SecretRef</th>
                          <th className='p-3 font-medium'>Provider</th>
                          <th className='p-3 font-medium'>Status</th>
                          <th className='p-3 font-medium'>Save/run guidance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedWorkflowBoundary.refs.map((ref) => (
                          <tr key={ref.id} className='border-t align-top'>
                            <td className='p-3'>
                              <div className='font-medium'>{ref.label}</div>
                              <div className='font-mono text-xs break-all text-muted-foreground'>
                                {ref.ref}
                              </div>
                            </td>
                            <td className='p-3'>
                              <div>{ref.provider}</div>
                              <div className='text-xs text-muted-foreground'>
                                {ref.connection}
                              </div>
                            </td>
                            <td className='p-3'>
                              <Badge
                                variant={workflowRefStatusVariant[ref.status]}
                              >
                                {workflowRefStatusCopy[ref.status]}
                              </Badge>
                              <div className='mt-2 text-xs text-muted-foreground'>
                                {ref.policyDecision}
                              </div>
                            </td>
                            <td className='p-3'>
                              <div>{ref.message}</div>
                              <div className='mt-1 text-xs text-muted-foreground'>
                                {ref.suggestedFix}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className='rounded-lg border p-4'>
                    <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
                      <div className='font-medium'>Generated safe snippet</div>
                      <Badge variant='secondary'>values hidden</Badge>
                    </div>
                    <pre className='overflow-x-auto rounded-md bg-muted/60 p-3 text-xs'>
                      {selectedWorkflowBoundary.snippet}
                    </pre>
                    <p className='mt-2 text-xs text-muted-foreground'>
                      Snippets are authoring aids only. They contain SecretRef
                      identifiers and validation flags, never resolved/plaintext
                      secret values or raw provider command output.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {focusSection === 'topology' ? (
          <Card id='secrets-topology'>
            <CardHeader>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    <Network className='size-4' /> Secrets Broker topology
                  </CardTitle>
                  <CardDescription>
                    Safe topology graph for services, workflows, runs,
                    SecretRefs, broker sources, and provider connections. Graph
                    labels and fallback rows use the same safe metadata and
                    never render resolved secret values.
                  </CardDescription>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Badge variant='secondary'>Safe metadata only</Badge>
                  <Badge variant='outline'>List fallback included</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-3 md:grid-cols-4'>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>
                    Graph nodes
                  </div>
                  <div className='text-2xl font-bold'>
                    {filteredSecretsTopology.nodes.length}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>
                    Graph edges
                  </div>
                  <div className='text-2xl font-bold'>
                    {filteredSecretsTopology.edges.length}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>
                    Action edges
                  </div>
                  <div className='text-2xl font-bold'>
                    {topologyProblemEdges.length}
                  </div>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-xs text-muted-foreground'>
                    Value policy
                  </div>
                  <div className='mt-1'>hidden / never rendered</div>
                </div>
              </div>

              <div className='grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'>
                <div>
                  <label
                    htmlFor='secrets-topology-search'
                    className='mb-1 block text-xs font-medium text-muted-foreground'
                  >
                    Search topology
                  </label>
                  <Input
                    id='secrets-topology-search'
                    value={topologySearchQuery}
                    onChange={(event) =>
                      setTopologySearchQuery(event.target.value)
                    }
                    placeholder='Search service, workflow, provider, ref, or status'
                  />
                  <div className='mt-2 text-xs text-muted-foreground'>
                    Showing {filteredSecretsTopology.nodes.length} of{' '}
                    {secretsTopology.nodes.length} nodes and{' '}
                    {filteredSecretsTopology.edges.length} of{' '}
                    {secretsTopology.edges.length} relationships.
                  </div>
                </div>
                {topologySearchQuery ? (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => setTopologySearchQuery('')}
                  >
                    <X className='size-4' />
                    Clear
                  </Button>
                ) : null}
              </div>

              <DependencyGraphCanvas
                nodes={reactFlowSecretsTopology.nodes}
                edges={reactFlowSecretsTopology.edges}
                height={480}
                draggable={false}
                selectable={false}
                showMiniMap={false}
                legendItems={[
                  { label: 'ok', color: '#16a34a' },
                  {
                    label: 'warning / missing',
                    color: '#f59e0b',
                    dashed: true,
                  },
                  { label: 'failed', color: '#dc2626', dashed: true },
                  { label: 'denied', color: '#991b1b', dashed: true },
                ]}
              />

              <div className='rounded-lg border p-3 text-sm'>
                <div className='font-medium'>
                  Actionable relationship fallback
                </div>
                <p className='text-muted-foreground'>
                  This list mirrors the graph relationships for accessibility
                  and troubleshooting. Each edge links to detail, audit, or
                  diagnostic context instead of relying on decorative graph-only
                  state.
                </p>
              </div>

              <div className='overflow-x-auto rounded-lg border'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted/50 text-left'>
                    <tr>
                      <th className='p-3 font-medium'>Relationship</th>
                      <th className='p-3 font-medium'>From</th>
                      <th className='p-3 font-medium'>To</th>
                      <th className='p-3 font-medium'>Status</th>
                      <th className='p-3 font-medium'>Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSecretsTopology.edges.map((edge) => {
                      const sourceNode = filteredSecretsTopology.nodes.find(
                        (node) => node.id === edge.source
                      )
                      const targetNode = filteredSecretsTopology.nodes.find(
                        (node) => node.id === edge.target
                      )

                      return (
                        <tr key={edge.id} className='border-t align-top'>
                          <td className='p-3 font-medium'>{edge.label}</td>
                          <td className='p-3'>
                            <div>{sourceNode?.label ?? edge.source}</div>
                            <div className='text-xs text-muted-foreground'>
                              {sourceNode?.kind}
                            </div>
                          </td>
                          <td className='p-3'>
                            <div>{targetNode?.label ?? edge.target}</div>
                            <div className='text-xs text-muted-foreground'>
                              {targetNode?.kind}
                            </div>
                          </td>
                          <td className='p-3'>
                            <Badge
                              variant={
                                edge.status === 'ok'
                                  ? 'default'
                                  : edge.status === 'failed' ||
                                      edge.status === 'denied'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {edge.status}
                            </Badge>
                          </td>
                          <td className='p-3'>
                            <div className='flex flex-wrap gap-2'>
                              <Button asChild size='sm' variant='outline'>
                                <a href={edge.detailHref}>Detail</a>
                              </Button>
                              <Button asChild size='sm' variant='outline'>
                                <a href={edge.auditHref}>Audit</a>
                              </Button>
                              {edge.diagnosticHref ? (
                                <Button asChild size='sm' variant='outline'>
                                  <a href={edge.diagnosticHref}>Diagnostics</a>
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {!filteredSecretsTopology.edges.length ? (
                      <tr>
                        <td className='p-3 text-muted-foreground' colSpan={5}>
                          No topology relationships match the current search.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {focusSection === 'audit-events' ? (
          <Card id='audit-events'>
            <CardHeader>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    <ClipboardCheck className='size-4' /> Audit and events
                  </CardTitle>
                  <CardDescription>
                    Inspect Secrets Broker operations by type, outcome,
                    provider, source/backend, connection, service/workflow/run,
                    actor, and timestamp without exposing secret values.
                  </CardDescription>
                </div>
                <Badge variant='secondary'>Values never rendered</Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-3 md:grid-cols-7'>
                <div>
                  <label
                    htmlFor='secret-audit-type'
                    className='mb-1 block text-xs text-muted-foreground'
                  >
                    Event type
                  </label>
                  <select
                    id='secret-audit-type'
                    className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                    value={auditTypeFilter}
                    onChange={(event) =>
                      setAuditTypeFilter(
                        event.target.value as
                          | SecretsBrokerAuditEventType
                          | 'all'
                      )
                    }
                  >
                    <option value='all'>all</option>
                    {auditTypes.map((type) => (
                      <option key={type} value={type}>
                        {auditEventTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor='secret-audit-outcome'
                    className='mb-1 block text-xs text-muted-foreground'
                  >
                    Outcome
                  </label>
                  <select
                    id='secret-audit-outcome'
                    className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                    value={auditOutcomeFilter}
                    onChange={(event) =>
                      setAuditOutcomeFilter(
                        event.target.value as SecretsBrokerAuditOutcome | 'all'
                      )
                    }
                  >
                    <option value='all'>all</option>
                    {auditOutcomes.map((outcome) => (
                      <option key={outcome} value={outcome}>
                        {outcome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor='secret-audit-provider'
                    className='mb-1 block text-xs text-muted-foreground'
                  >
                    Audit provider
                  </label>
                  <select
                    id='secret-audit-provider'
                    className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                    value={auditProviderFilter}
                    onChange={(event) =>
                      setAuditProviderFilter(
                        event.target.value as
                          | SecretsBrokerAuditEvent['provider']
                          | 'all'
                      )
                    }
                  >
                    <option value='all'>all</option>
                    {auditProviders.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor='secret-audit-tamper-evidence'
                    className='mb-1 block text-xs text-muted-foreground'
                  >
                    Tamper evidence
                  </label>
                  <select
                    id='secret-audit-tamper-evidence'
                    className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                    value={auditTamperEvidenceFilter}
                    onChange={(event) =>
                      setAuditTamperEvidenceFilter(
                        event.target.value as
                          | SecretsBrokerAuditTamperEvidenceStatus
                          | 'all'
                      )
                    }
                  >
                    <option value='all'>all</option>
                    {auditTamperEvidenceStates.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor='secret-audit-query'
                    className='mb-1 block text-xs text-muted-foreground'
                  >
                    Source / actor
                  </label>
                  <Input
                    id='secret-audit-query'
                    value={auditQueryFilter}
                    onChange={(event) =>
                      setAuditQueryFilter(event.target.value)
                    }
                    placeholder='source, connection, target, actor'
                  />
                </div>
                <div>
                  <label
                    htmlFor='secret-audit-since'
                    className='mb-1 block text-xs text-muted-foreground'
                  >
                    Since
                  </label>
                  <Input
                    id='secret-audit-since'
                    type='datetime-local'
                    value={auditSinceFilter}
                    onChange={(event) =>
                      setAuditSinceFilter(event.target.value)
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor='secret-audit-until'
                    className='mb-1 block text-xs text-muted-foreground'
                  >
                    Until
                  </label>
                  <Input
                    id='secret-audit-until'
                    type='datetime-local'
                    value={auditUntilFilter}
                    onChange={(event) =>
                      setAuditUntilFilter(event.target.value)
                    }
                  />
                </div>
              </div>

              <div className='grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]'>
                <div className='space-y-2'>
                  {filteredAuditEvents.length ? (
                    filteredAuditEvents.map((event) => (
                      <button
                        key={event.id}
                        type='button'
                        className={`w-full rounded-lg border p-3 text-left text-sm transition hover:border-primary ${
                          selectedAuditEvent.id === event.id
                            ? 'border-primary bg-muted/60'
                            : 'bg-card'
                        }`}
                        onClick={() => setSelectedAuditEventId(event.id)}
                      >
                        <div className='mb-2 flex flex-wrap items-start justify-between gap-2'>
                          <div>
                            <div className='font-medium'>
                              {auditEventTypeLabel(event.type)}
                            </div>
                            <div className='text-xs text-muted-foreground'>
                              {event.timestamp} · {event.provider} ·{' '}
                              {event.source}
                            </div>
                          </div>
                          <div className='flex flex-wrap gap-2'>
                            <Badge variant={auditOutcomeVariant[event.outcome]}>
                              {event.outcome}
                            </Badge>
                            <Badge
                              variant={
                                auditTamperEvidenceVariant[
                                  event.tamperEvidence.status
                                ]
                              }
                            >
                              {event.tamperEvidence.status}
                            </Badge>
                          </div>
                        </div>
                        <div className='grid gap-2 text-xs text-muted-foreground md:grid-cols-3'>
                          <span>ref: {event.ref}</span>
                          <span>actor: {event.actorId}</span>
                          <span>target: {event.serviceOrWorkflow}</span>
                          <span>audit reason: {event.auditReason}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
                      No audit events match the current filters.
                    </div>
                  )}
                </div>
                <AuditEventDetail event={selectedAuditEvent} />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {focusSection === 'diagnostics' ? (
          <Card id='diagnostics'>
            <CardHeader>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    <AlertTriangle className='size-4' /> Diagnostics and
                    troubleshooting
                  </CardTitle>
                  <CardDescription>
                    Normalized, secret-safe checks for broker lifecycle,
                    provider, auth, policy, and workflow runtime failures.
                  </CardDescription>
                </div>
                <Badge variant='secondary'>Raw output scrubbed</Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-3 md:grid-cols-3'>
                <div className='rounded-lg border p-3'>
                  <div className='text-2xl font-bold'>
                    {diagnosticCounts.pass}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    passing checks
                  </p>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-2xl font-bold'>
                    {diagnosticCounts.warning}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    degraded checks
                  </p>
                </div>
                <div className='rounded-lg border p-3'>
                  <div className='text-2xl font-bold'>
                    {diagnosticCounts.fail}
                  </div>
                  <p className='text-xs text-muted-foreground'>failed checks</p>
                </div>
              </div>
              <div className='grid gap-3 lg:grid-cols-2'>
                {secretsBrokerDiagnostics.map((diagnostic) => (
                  <DiagnosticCard key={diagnostic.id} diagnostic={diagnostic} />
                ))}
              </div>
              <SupportBundleDiagnosticsAction />
              <div className='flex gap-3 rounded-lg border p-3 text-sm'>
                <ShieldCheck className='mt-0.5 size-4 shrink-0' />
                <div>
                  <div className='font-medium'>
                    Secret-safe diagnostics only
                  </div>
                  <p className='text-muted-foreground'>
                    Checks show normalized codes, source labels, affected refs,
                    affected services or workflows, and suggested fixes. Raw
                    command stdout/stderr and resolved secret values are never
                    rendered.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </Main>
    </>
  )
}
