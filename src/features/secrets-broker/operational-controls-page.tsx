import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  ClipboardCheck,
  FileChartColumn,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
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
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
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

const providerActions = [
  {
    id: 'local-provider-refresh',
    title: 'Refresh local provider status',
    provider: 'local',
    status: 'available',
    blocker: 'No blocker. Refresh is metadata-only.',
    action: 'Refresh provider',
    disabled: false,
  },
  {
    id: 'vault-reconnect-test',
    title: 'Test Vault reconnect',
    provider: 'vault',
    status: 'auth-required',
    blocker: 'Provider auth is required before reconnect test can run.',
    action: 'Test reconnect',
    disabled: true,
  },
  {
    id: 'openobserve-export-test',
    title: 'Test OpenObserve log shipping',
    provider: 'openobserve',
    status: 'unavailable',
    blocker: 'Collector endpoint is not configured in this demo.',
    action: 'Test exporter',
    disabled: true,
  },
]

const logShippingRows = [
  {
    id: 'local-audit-chain',
    sink: 'local audit chain',
    type: 'local',
    endpointHealth: 'recording',
    lastSuccessfulShip: '2026-05-22T04:10:00Z',
    queued: 0,
    dropped: 0,
    errors: 0,
    sourceCoverage: 'Secrets Broker policy/audit events',
    redactionStatus: 'metadata-only',
  },
  {
    id: 'openobserve-collector',
    sink: 'OpenObserve',
    type: 'otlp/http',
    endpointHealth: 'not configured',
    lastSuccessfulShip: 'never',
    queued: 0,
    dropped: 0,
    errors: 0,
    sourceCoverage: 'pending service-lasso/service-lasso#636',
    redactionStatus: 'blocked until redacted exporter is configured',
  },
]

function StatusPill({ status }: { status: string }) {
  const variant =
    status === 'available' ||
    status === 'recording' ||
    status === 'metadata-only'
      ? 'default'
      : status.includes('required') || status.includes('configured')
        ? 'secondary'
        : 'outline'

  return <Badge variant={variant}>{status}</Badge>
}

export function OperationalControlsPage() {
  usePageMetadata({
    title: 'Service Admin - Operational Controls',
    description:
      'Standalone Secrets Broker operator actions, Audit Logging, lockout, policy, provider, telemetry, and log shipping status.',
  })

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
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='space-y-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              Operational Controls
            </h2>
            <p className='text-muted-foreground'>
              Secrets Broker operator jobs for lockouts, provider actions,
              policy dry-runs, Audit Logging, telemetry, and log shipping.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary'>Metadata only</Badge>
            <Badge variant='outline'>Raw values hidden</Badge>
            <Button variant='outline' size='sm' asChild>
              <Link to='/operations/audit-logging'>Audit Logging</Link>
            </Button>
          </div>
        </div>

        <div className='grid gap-3 md:grid-cols-4'>
          {operationalControlMetrics.map((metric) => (
            <div key={metric.label} className='rounded-md border p-4'>
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

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <ShieldCheck className='size-4' /> Effective service policy
              </CardTitle>
              <CardDescription>
                Service manifest scopes and fail-closed decision state.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <LockKeyhole className='size-4' /> Scoped lockouts
              </CardTitle>
              <CardDescription>
                Affected scopes, retry windows, and audited-clear support.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
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
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <RefreshCw className='size-4' /> Provider actions
            </CardTitle>
            <CardDescription>
              Reconnect, refresh, and test actions expose unsupported states
              instead of simulating backend contracts.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-3 lg:grid-cols-3'>
            {providerActions.map((action) => (
              <div key={action.id} className='rounded-md border p-3 text-sm'>
                <div className='flex items-start justify-between gap-2'>
                  <div>
                    <div className='font-medium'>{action.title}</div>
                    <div className='text-xs text-muted-foreground'>
                      {action.provider}
                    </div>
                  </div>
                  <StatusPill status={action.status} />
                </div>
                <p className='mt-3 text-xs text-muted-foreground'>
                  {action.blocker}
                </p>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  className='mt-3'
                  disabled={action.disabled}
                >
                  {action.action}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <FileChartColumn className='size-4' /> Telemetry and log shipping
            </CardTitle>
            <CardDescription>
              Audit Logging surfaces exporter status, sink health, coverage, and
              redaction state while OpenTelemetry remains correlation plumbing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50 text-left'>
                  <tr>
                    <th className='p-3 font-medium'>Sink</th>
                    <th className='p-3 font-medium'>Health</th>
                    <th className='p-3 font-medium'>Last success</th>
                    <th className='p-3 font-medium'>Queue</th>
                    <th className='p-3 font-medium'>Coverage</th>
                    <th className='p-3 font-medium'>Redaction</th>
                  </tr>
                </thead>
                <tbody>
                  {logShippingRows.map((row) => (
                    <tr key={row.id} className='border-t align-top'>
                      <td className='p-3'>
                        <div className='font-medium'>{row.sink}</div>
                        <div className='text-xs text-muted-foreground'>
                          {row.type}
                        </div>
                      </td>
                      <td className='p-3'>
                        <StatusPill status={row.endpointHealth} />
                      </td>
                      <td className='p-3'>{row.lastSuccessfulShip}</td>
                      <td className='p-3'>
                        {row.queued} queued / {row.dropped} dropped /{' '}
                        {row.errors} errors
                      </td>
                      <td className='p-3'>{row.sourceCoverage}</td>
                      <td className='p-3'>{row.redactionStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <ClipboardCheck className='size-4' /> Audit Logging
            </CardTitle>
            <CardDescription>
              Filter operational events by service, provider, operation,
              outcome, severity, and time window.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <Badge variant='outline'>Values never rendered</Badge>
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

            <div className='overflow-x-auto rounded-md border'>
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
                          {event.family} | {event.timestamp}
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
          </CardContent>
        </Card>

        <div className='grid gap-3 md:grid-cols-3'>
          <div className='rounded-md border p-4 text-sm'>
            <div className='flex items-center gap-2 font-medium'>
              <Activity className='size-4' /> Policy simulation
            </div>
            <p className='mt-2 text-xs text-muted-foreground'>
              Dry-run entry points stay here until the broker policy contract is
              live; apply actions remain disabled without backend support.
            </p>
          </div>
          <div className='rounded-md border p-4 text-sm'>
            <div className='flex items-center gap-2 font-medium'>
              <ClipboardCheck className='size-4' /> Bulk campaign gates
            </div>
            <p className='mt-2 text-xs text-muted-foreground'>
              Bulk campaign status links are surfaced as metadata only and do
              not export raw secret values.
            </p>
          </div>
          <div className='rounded-md border p-4 text-sm'>
            <div className='flex items-center gap-2 font-medium'>
              <ShieldCheck className='size-4' /> Unsupported controls
            </div>
            <p className='mt-2 text-xs text-muted-foreground'>
              Missing backend contracts are disabled, labeled, and fail closed
              instead of presenting fake success.
            </p>
          </div>
        </div>
      </Main>
    </>
  )
}
