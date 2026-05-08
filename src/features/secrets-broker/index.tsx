import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { DependencyGraphCanvas } from '@/components/dependency-graph-canvas'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  auditEventTypeLabel,
  filterSecretsBrokerAuditEvents,
  secretsBrokerAuditEvents,
  type SecretsBrokerAuditEvent,
  type SecretsBrokerAuditEventType,
  type SecretsBrokerAuditOutcome,
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

const statusCopy: Record<WizardSource['status'], string> = {
  ready: 'Ready',
  locked: 'Locked',
  'auth-required': 'Auth required',
  degraded: 'Degraded',
  'policy-denied': 'Policy denied',
}

const statusVariant: Record<
  WizardSource['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  ready: 'default',
  locked: 'secondary',
  'auth-required': 'secondary',
  degraded: 'outline',
  'policy-denied': 'destructive',
}

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

function SourceIcon({ source }: { source: WizardSource }) {
  if (source.id === 'local-vault') return <LockKeyhole className='size-4' />
  if (source.id === 'file-source') return <FileKey2 className='size-4' />
  if (source.id === 'exec-adapter') return <TerminalSquare className='size-4' />
  if (source.id === 'generated-writeback') {
    return <ClipboardCheck className='size-4' />
  }
  return <KeyRound className='size-4' />
}

function SourceCard({
  source,
  selected,
  onSelect,
}: {
  source: WizardSource
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type='button'
      onClick={onSelect}
      className={`rounded-lg border p-4 text-left transition hover:border-primary ${
        selected ? 'border-primary bg-muted/60' : 'bg-card'
      }`}
    >
      <div className='mb-3 flex items-start justify-between gap-3'>
        <div className='flex items-center gap-2 font-medium'>
          <SourceIcon source={source} />
          {source.title}
        </div>
        <Badge variant={statusVariant[source.status]}>
          {statusCopy[source.status]}
        </Badge>
      </div>
      <p className='text-sm text-muted-foreground'>{source.summary}</p>
    </button>
  )
}

function SafeExample({ value }: { value: string }) {
  return (
    <div className='rounded-md border bg-muted/40 p-3 font-mono text-sm break-all'>
      {value}
    </div>
  )
}

function SourceBackendCard({ source }: { source: SecretsBrokerSourceBackend }) {
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
        {source.supportedActions.map((action) => (
          <Button key={action} type='button' variant='outline' size='sm'>
            {sourceActionCopy[action]}
          </Button>
        ))}
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
          <Badge variant={auditOutcomeVariant[event.outcome]}>
            {event.outcome}
          </Badge>
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
        <div className='rounded-md bg-muted/40 p-2'>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Policy decision
          </div>
          <div>{event.policyId}</div>
          <div className='text-muted-foreground'>{event.policyDecision}</div>
        </div>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Normalized reason
          </div>
          <p className='text-muted-foreground'>{event.normalizedReason}</p>
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

export function SecretsBrokerSetupWizard() {
  usePageMetadata({
    title: 'Service Admin - Secrets Broker Setup',
    description:
      'Guided setup and diagnostics for local and external Secrets Broker sources.',
  })

  const [selectedId, setSelectedId] = useState(wizardSources[0].id)
  const [auditTypeFilter, setAuditTypeFilter] = useState<
    SecretsBrokerAuditEventType | 'all'
  >('all')
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState<
    SecretsBrokerAuditOutcome | 'all'
  >('all')
  const [auditProviderFilter, setAuditProviderFilter] = useState<
    SecretsBrokerAuditEvent['provider'] | 'all'
  >('all')
  const [auditQueryFilter, setAuditQueryFilter] = useState('')
  const [auditSinceFilter, setAuditSinceFilter] = useState('')
  const [auditUntilFilter, setAuditUntilFilter] = useState('')
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
  const selectedSource = useMemo(
    () =>
      wizardSources.find((source) => source.id === selectedId) ??
      wizardSources[0],
    [selectedId]
  )
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
        query: auditQueryFilter,
        since: auditSinceFilter,
        until: auditUntilFilter,
      }),
    [
      auditOutcomeFilter,
      auditProviderFilter,
      auditQueryFilter,
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
  const reactFlowSecretsTopology = useMemo(
    () => toReactFlowSecretsBrokerTopology(secretsTopology),
    [secretsTopology]
  )
  const topologyProblemEdges = secretsTopology.edges.filter((edge) =>
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
              Secrets Broker setup
            </h2>
            <p className='text-muted-foreground'>
              Configure and test local, file, exec, and external secret sources
              without revealing secret values.
            </p>
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

        <Card>
          <CardHeader>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <ShieldCheck className='size-4' /> @secretsbroker overview
                </CardTitle>
                <CardDescription>
                  Broker health, API reachability, backend state, keystore
                  posture, and operator action summary. This overview uses safe
                  metadata only and never renders resolved secret values.
                </CardDescription>
              </div>
              <Badge
                variant={
                  brokerOverviewStateVariant[brokerOverview.health.state]
                }
              >
                {brokerOverviewStateCopy[brokerOverview.health.state]}
              </Badge>
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
                  <div className='mt-1'>{brokerOverview.keystore.state}</div>
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
                <a href='#provider-connections'>View provider connections</a>
              </Button>
              <Button variant='outline' size='sm' asChild>
                <a href='#secret-sources'>View secret sources</a>
              </Button>
              <Button variant='outline' size='sm' asChild>
                <a href='#audit-events'>View audit/events</a>
              </Button>
              <Button variant='outline' size='sm' asChild>
                <a href='#diagnostics'>View diagnostics</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-4 md:grid-cols-3'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base'>Ready sources</CardTitle>
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
              <CardTitle className='text-base'>Needs operator action</CardTitle>
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

        <BackupKeyManagementPanel />

        <Card id='secret-sources'>
          <CardHeader>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <FileKey2 className='size-4' /> Secret Sources / Backends
                </CardTitle>
                <CardDescription>
                  Inspect local and external Secrets Broker sources, source test
                  results, safe example refs/config, and security warnings
                  without displaying returned secret values.
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
                <div className='text-xs text-muted-foreground'>Configured</div>
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

        <Card id='provider-connections'>
          <CardHeader>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <KeyRound className='size-4' /> Provider Connections
                </CardTitle>
                <CardDescription>
                  Search and filter external provider connections by provider,
                  status, and label. Secret material shows presence/status only,
                  never raw values.
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
                          <div className='font-medium'>{connection.title}</div>
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
                              providerConnectionStatusVariant[connection.state]
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
                                href='#audit-events'
                                className='text-primary underline-offset-4 hover:underline'
                              >
                                Audit {connection.lifecycle.auditEventRef}
                              </a>
                            ) : null}
                            {connection.lifecycle.diagnosticRef ? (
                              <a
                                href='#diagnostics'
                                className='text-primary underline-offset-4 hover:underline'
                              >
                                Diagnostics {connection.lifecycle.diagnosticRef}
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

        <Card id='workflow-authoring-boundary'>
          <CardHeader>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <TerminalSquare className='size-4' /> Workflow authoring
                  boundary
                </CardTitle>
                <CardDescription>
                  Metadata-only guidance for authors wiring Secrets Broker refs
                  into workflows. This panel validates refs and generates safe
                  snippets without becoming a runner editor or resolving secret
                  values.
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
                <div className='text-xs text-muted-foreground'>Valid refs</div>
                <div className='text-2xl font-bold'>
                  {workflowRefCounts.valid}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>Need action</div>
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
                      Missing or denied refs should block save/run handoff until
                      policy and metadata issues are resolved.
                    </div>
                  ) : (
                    <div className='mt-3 rounded-md border p-3 text-muted-foreground'>
                      Ref checks are metadata-valid. Continue to provider tests
                      before any execution handoff.
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

        <Card id='secrets-topology'>
          <CardHeader>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <Network className='size-4' /> Secrets Broker topology
                </CardTitle>
                <CardDescription>
                  Safe topology graph for services, workflows, runs, SecretRefs,
                  broker sources, and provider connections. Graph labels and
                  fallback rows use the same safe metadata and never render
                  resolved secret values.
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
                <div className='text-xs text-muted-foreground'>Graph nodes</div>
                <div className='text-2xl font-bold'>
                  {secretsTopology.nodes.length}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs text-muted-foreground'>Graph edges</div>
                <div className='text-2xl font-bold'>
                  {secretsTopology.edges.length}
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

            <DependencyGraphCanvas
              nodes={reactFlowSecretsTopology.nodes}
              edges={reactFlowSecretsTopology.edges}
              height={480}
              draggable={false}
              selectable={false}
              showMiniMap={false}
              legendItems={[
                { label: 'ok', color: '#16a34a' },
                { label: 'warning / missing', color: '#f59e0b', dashed: true },
                { label: 'failed', color: '#dc2626', dashed: true },
                { label: 'denied', color: '#991b1b', dashed: true },
              ]}
            />

            <div className='rounded-lg border p-3 text-sm'>
              <div className='font-medium'>
                Actionable relationship fallback
              </div>
              <p className='text-muted-foreground'>
                This list mirrors the graph relationships for accessibility and
                troubleshooting. Each edge links to detail, audit, or diagnostic
                context instead of relying on decorative graph-only state.
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
                  {secretsTopology.edges.map((edge) => {
                    const sourceNode = secretsTopology.nodes.find(
                      (node) => node.id === edge.source
                    )
                    const targetNode = secretsTopology.nodes.find(
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
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card id='audit-events'>
          <CardHeader>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <ClipboardCheck className='size-4' /> Audit and events
                </CardTitle>
                <CardDescription>
                  Inspect Secrets Broker operations by type, outcome, provider,
                  source/backend, connection, service/workflow/run, actor, and
                  timestamp without exposing secret values.
                </CardDescription>
              </div>
              <Badge variant='secondary'>Values never rendered</Badge>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-3 md:grid-cols-6'>
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
                      event.target.value as SecretsBrokerAuditEventType | 'all'
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
                  htmlFor='secret-audit-query'
                  className='mb-1 block text-xs text-muted-foreground'
                >
                  Source / actor
                </label>
                <Input
                  id='secret-audit-query'
                  value={auditQueryFilter}
                  onChange={(event) => setAuditQueryFilter(event.target.value)}
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
                  onChange={(event) => setAuditSinceFilter(event.target.value)}
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
                  onChange={(event) => setAuditUntilFilter(event.target.value)}
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
                        <Badge variant={auditOutcomeVariant[event.outcome]}>
                          {event.outcome}
                        </Badge>
                      </div>
                      <div className='grid gap-2 text-xs text-muted-foreground md:grid-cols-3'>
                        <span>ref: {event.ref}</span>
                        <span>actor: {event.actorId}</span>
                        <span>target: {event.serviceOrWorkflow}</span>
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

        <Card id='diagnostics'>
          <CardHeader>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <AlertTriangle className='size-4' /> Diagnostics and
                  troubleshooting
                </CardTitle>
                <CardDescription>
                  Normalized, secret-safe checks for broker lifecycle, provider,
                  auth, policy, and workflow runtime failures.
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
                <p className='text-xs text-muted-foreground'>passing checks</p>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-2xl font-bold'>
                  {diagnosticCounts.warning}
                </div>
                <p className='text-xs text-muted-foreground'>degraded checks</p>
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
            <div className='flex gap-3 rounded-lg border p-3 text-sm'>
              <ShieldCheck className='mt-0.5 size-4 shrink-0' />
              <div>
                <div className='font-medium'>Secret-safe diagnostics only</div>
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

        <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]'>
          <Card>
            <CardHeader>
              <CardTitle>Source setup paths</CardTitle>
              <CardDescription>
                Pick a source type to preview the safe setup contract and
                current stubbed state.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3'>
              {wizardSources.map((source) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  selected={source.id === selectedSource.id}
                  onSelect={() => setSelectedId(source.id)}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <CardTitle className='flex items-center gap-2'>
                    <SourceIcon source={selectedSource} />
                    {selectedSource.title}
                  </CardTitle>
                  <CardDescription>{selectedSource.kind}</CardDescription>
                </div>
                <Badge variant={statusVariant[selectedSource.status]}>
                  {statusCopy[selectedSource.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-5'>
              <section className='space-y-2'>
                <h3 className='font-medium'>Safe example</h3>
                <SafeExample value={selectedSource.safeExample} />
                <p className='text-sm text-muted-foreground'>
                  Examples intentionally use SecretRef-style identifiers and
                  hidden generated values only.
                </p>
              </section>

              <section className='space-y-2'>
                <h3 className='font-medium'>Affected refs and services</h3>
                <div className='flex flex-wrap gap-2'>
                  {selectedSource.affected.map((item) => (
                    <Badge key={item} variant='outline'>
                      {item}
                    </Badge>
                  ))}
                </div>
              </section>

              {selectedSource.warning ? (
                <div className='flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'>
                  <AlertTriangle className='mt-0.5 size-4 shrink-0' />
                  <span>{selectedSource.warning}</span>
                </div>
              ) : null}

              <section className='space-y-2'>
                <h3 className='font-medium'>Next safe action</h3>
                <p className='text-sm text-muted-foreground'>
                  {selectedSource.nextAction}
                </p>
              </section>

              <div className='rounded-lg border p-3 text-sm'>
                <div className='mb-2 flex items-center gap-2 font-medium'>
                  <ShieldCheck className='size-4' /> Security gates
                </div>
                <ul className='list-disc space-y-1 pl-5 text-muted-foreground'>
                  <li>Require preview before destructive or broad changes.</li>
                  <li>
                    Require explicit confirmation and an audit reason before
                    save/write.
                  </li>
                  <li>Show policy decisions and audit links without values.</li>
                </ul>
              </div>

              <div className='flex flex-wrap gap-2'>
                <Button type='button'>Test selected source</Button>
                <Button type='button' variant='outline'>
                  Cancel setup
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <CheckCircle2 className='size-4' /> Covered setup states
            </CardTitle>
            <CardDescription>
              This first slice makes the states visible before wiring live
              Secrets Broker APIs.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3'>
            <div>Blank install: choose local/file/exec/external source.</div>
            <div>Existing vault on new machine: import or re-wrap.</div>
            <div>External auth required: show affected refs first.</div>
            <div>Service dependency blocked: explain source/policy reason.</div>
            <div>OpenClaw exec adapter: namespace and last check only.</div>
            <div>
              Generated secret write-back: policy and audit, value hidden.
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
