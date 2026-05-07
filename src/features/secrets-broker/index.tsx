import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileKey2,
  KeyRound,
  LockKeyhole,
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
  countDiagnosticsByStatus,
  secretsBrokerDiagnostics,
  type SecretsBrokerDiagnostic,
  type SecretsBrokerDiagnosticStatus,
} from './diagnostics'

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

const auditTypes = Array.from(
  new Set(secretsBrokerAuditEvents.map((event) => event.type))
)
const auditOutcomes = Array.from(
  new Set(secretsBrokerAuditEvents.map((event) => event.outcome))
)
const auditProviders = Array.from(
  new Set(secretsBrokerAuditEvents.map((event) => event.provider))
)

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

        <Card>
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
                  Provider
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

        <Card>
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
