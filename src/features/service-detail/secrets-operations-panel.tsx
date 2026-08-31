import { useMemo, useState } from 'react'
import {
  Activity,
  Download,
  RefreshCw,
  ShieldAlert,
  UnlockKeyhole,
} from 'lucide-react'
import {
  buildOperationalControlsExport,
  summarizeActiveLockouts,
  summarizeEffectivePolicy,
} from '@/lib/service-lasso-dashboard/broker-operational-controls'
import {
  useBrokerEvents,
  useBrokerLockoutClear,
  useBrokerTelemetry,
  useRuntimeIdentity,
  useSecretAccessAssignments,
} from '@/lib/service-lasso-dashboard/hooks'
import { serviceLassoStubDataEnabled } from '@/lib/service-lasso-dashboard/stub'
import type { BrokerEventFilters } from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const EVENT_FAMILIES = [
  'all',
  'auth_failure',
  'lockout_started',
  'lockout_cleared',
  'policy_decision',
  'source_auth_required',
  'source_unavailable',
  'source_recovered',
  'provider_unavailable',
  'provider_recovered',
  'management_apply',
  'rotation_action',
  'delete_action',
  'key_lifecycle',
  'backup_restore',
  'audit_unavailable',
] as const

function formatEventTime(value: string) {
  return new Date(value).toLocaleString()
}

function eventSubject(event: {
  serviceId?: string
  providerId?: string
  sourceId?: string
}) {
  return event.serviceId ?? event.providerId ?? event.sourceId ?? 'Broker'
}

export function SecretsBrokerOperationsPanel() {
  const identity = useRuntimeIdentity()
  const permissions = identity.data?.permissions ?? []
  const permitted = (permission: string) =>
    permissions.includes('*') || permissions.includes(permission)
  const canRead = permitted('workspace:read')
  const canClearLockouts = permitted('security:manage')
  const [severity, setSeverity] = useState('all')
  const [family, setFamily] = useState('all')
  const [limit, setLimit] = useState(25)
  const [serviceId, setServiceId] = useState('')
  const [providerId, setProviderId] = useState('')
  const [operation, setOperation] = useState('')
  const [outcome, setOutcome] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [cursor, setCursor] = useState<string>()
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [lockoutScope, setLockoutScope] = useState('')
  const [lockoutReason, setLockoutReason] = useState('')
  const [lockoutConfirmed, setLockoutConfirmed] = useState(false)
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const filters = useMemo<BrokerEventFilters>(
    () => ({
      ...(severity === 'all' ? {} : { severity }),
      ...(family === 'all' ? {} : { family }),
      ...(serviceId.trim() ? { serviceId: serviceId.trim() } : {}),
      ...(providerId.trim() ? { providerId: providerId.trim() } : {}),
      ...(operation.trim() ? { operation: operation.trim() } : {}),
      ...(outcome.trim() ? { outcome: outcome.trim() } : {}),
      ...(since.trim() ? { since: new Date(since).toISOString() } : {}),
      ...(until.trim() ? { until: new Date(until).toISOString() } : {}),
      limit,
      ...(cursor ? { cursor } : {}),
    }),
    [
      cursor,
      family,
      limit,
      operation,
      outcome,
      providerId,
      serviceId,
      severity,
      since,
      until,
    ]
  )
  const telemetry = useBrokerTelemetry(canRead)
  const events = useBrokerEvents(filters, canRead)
  const assignments = useSecretAccessAssignments()
  const clearLockout = useBrokerLockoutClear()
  const auditRecordCount =
    telemetry.data?.counters.auditRecords.reduce(
      (total, counter) => total + counter.count,
      0
    ) ?? 0
  const lockouts = useMemo(
    () =>
      summarizeActiveLockouts({
        activeLockouts: telemetry.data?.counters.activeLockouts ?? 0,
        events: events.data?.events ?? [],
      }),
    [events.data?.events, telemetry.data?.counters.activeLockouts]
  )
  const effectivePolicy = useMemo(
    () => summarizeEffectivePolicy(assignments.data?.grants ?? []),
    [assignments.data?.grants]
  )
  const auditAvailable = (telemetry.data?.counters.auditRecords ?? []).some(
    (record) => record.auditStatus === 'audit_recorded'
  )
  const operationsUnsupported = telemetry.data?.outcome === 'unsupported'

  const resetPagination = () => {
    setCursor(undefined)
    setCursorHistory([])
  }

  const runLockoutClear = async () => {
    setMessage(undefined)
    setError(undefined)
    if (!lockoutConfirmed) {
      setError('Explicit confirmation is required to clear a Broker lockout.')
      return
    }
    try {
      const result = await clearLockout.mutateAsync({
        scope: lockoutScope,
        reason: lockoutReason,
      })
      setMessage(
        result.cleared
          ? `Lockout ${result.lockoutScope} was cleared and audited.`
          : `No active lockout matched ${result.lockoutScope}; the audited check completed safely.`
      )
      setLockoutConfirmed(false)
    } catch {
      setLockoutConfirmed(false)
      setError(
        'Lockout clearing failed closed. Verify the exact scope, audit sink, and Broker availability.'
      )
    }
  }

  const exportMetadata = () => {
    setError(undefined)
    setMessage(undefined)
    if (!telemetry.data || !events.data) {
      setError('Live operational metadata is required before export.')
      return
    }
    try {
      const payload = buildOperationalControlsExport({
        generatedAt: new Date().toISOString(),
        telemetry: telemetry.data,
        events: events.data,
        grants: assignments.data?.grants ?? [],
      })
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'broker-operational-controls-metadata.json'
      link.click()
      URL.revokeObjectURL(url)
      setMessage('Metadata-only operational export downloaded.')
    } catch {
      setError(
        'Operational export failed closed. Audit and event safety metadata must remain metadata-only.'
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Activity className='size-5' /> Operational controls
        </CardTitle>
        <CardDescription>
          Live low-cardinality telemetry, bounded metadata-only events, and
          audited lockout recovery. Secret values, raw references, provider
          responses, credentials, and request bodies are excluded.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5'>
        {serviceLassoStubDataEnabled ? (
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            Stub/fixture mode. These operational results are labelled fixtures,
            not live Broker telemetry.
          </p>
        ) : null}
        {operationsUnsupported ? (
          <p className='text-sm text-destructive'>
            Broker operational telemetry is unsupported on this runtime.
          </p>
        ) : null}
        <div className='grid gap-3 md:grid-cols-3'>
          <div className='rounded-lg border p-3'>
            <div className='flex items-center gap-2 font-medium'>
              <ShieldAlert className='size-4' /> Active lockouts
            </div>
            <p className='mt-2 text-2xl font-semibold'>
              {telemetry.data?.counters.activeLockouts ?? '—'}
            </p>
          </div>
          <div className='rounded-lg border p-3'>
            <div className='font-medium'>Local API auth failures</div>
            <p className='mt-2 text-2xl font-semibold'>
              {telemetry.data?.counters.localApiAuthFailures ?? '—'}
            </p>
          </div>
          <div className='rounded-lg border p-3'>
            <div className='font-medium'>Audited operation records</div>
            <p className='mt-2 text-2xl font-semibold'>{auditRecordCount}</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {auditAvailable
                ? 'Audit recorded'
                : 'Audit unavailable or not recorded'}
            </p>
          </div>
        </div>

        {!canRead ? (
          <p className='text-sm text-muted-foreground'>
            Workspace read permission is required for operational metadata.
          </p>
        ) : telemetry.isError || events.isError ? (
          <div className='flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-3'>
            <p className='text-sm text-destructive'>
              Live Broker operational metadata is unavailable.
            </p>
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => {
                void telemetry.refetch()
                void events.refetch()
              }}
            >
              <RefreshCw className='mr-2 size-4' /> Retry
            </Button>
          </div>
        ) : null}

        <div className='grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end'>
          <div className='space-y-2'>
            <Label htmlFor='broker-event-severity'>Event severity</Label>
            <select
              id='broker-event-severity'
              className='h-9 w-full rounded-md border bg-background px-3 text-sm'
              value={severity}
              onChange={(event) => {
                setSeverity(event.target.value)
                resetPagination()
              }}
            >
              <option value='all'>All severities</option>
              <option value='info'>Info</option>
              <option value='warning'>Warning</option>
              <option value='error'>Error</option>
            </select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='broker-event-family'>Event family</Label>
            <select
              id='broker-event-family'
              className='h-9 w-full rounded-md border bg-background px-3 text-sm'
              value={family}
              onChange={(event) => {
                setFamily(event.target.value)
                resetPagination()
              }}
            >
              {EVENT_FAMILIES.map((value) => (
                <option key={value} value={value}>
                  {value === 'all' ? 'All families' : value}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='broker-event-limit'>Page size</Label>
            <select
              id='broker-event-limit'
              className='h-9 rounded-md border bg-background px-3 text-sm'
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value))
                resetPagination()
              }}
            >
              {[10, 25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <Button
            type='button'
            variant='outline'
            disabled={!canRead || telemetry.isFetching || events.isFetching}
            onClick={() => {
              void telemetry.refetch()
              void events.refetch()
            }}
          >
            <RefreshCw className='mr-2 size-4' /> Refresh
          </Button>
        </div>
        <div className='grid gap-3 md:grid-cols-3 lg:grid-cols-6'>
          <div className='space-y-2'>
            <Label htmlFor='broker-event-service'>Service</Label>
            <Input
              id='broker-event-service'
              value={serviceId}
              maxLength={128}
              placeholder='@secretsbroker'
              onChange={(event) => {
                setServiceId(event.target.value)
                resetPagination()
              }}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='broker-event-provider'>Provider</Label>
            <Input
              id='broker-event-provider'
              value={providerId}
              maxLength={128}
              placeholder='local'
              onChange={(event) => {
                setProviderId(event.target.value)
                resetPagination()
              }}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='broker-event-operation'>Operation</Label>
            <Input
              id='broker-event-operation'
              value={operation}
              maxLength={128}
              placeholder='local_api_auth'
              onChange={(event) => {
                setOperation(event.target.value)
                resetPagination()
              }}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='broker-event-outcome'>Outcome</Label>
            <Input
              id='broker-event-outcome'
              value={outcome}
              maxLength={128}
              placeholder='denied'
              onChange={(event) => {
                setOutcome(event.target.value)
                resetPagination()
              }}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='broker-event-since'>Since</Label>
            <Input
              id='broker-event-since'
              type='datetime-local'
              value={since}
              onChange={(event) => {
                setSince(event.target.value)
                resetPagination()
              }}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='broker-event-until'>Until</Label>
            <Input
              id='broker-event-until'
              type='datetime-local'
              value={until}
              onChange={(event) => {
                setUntil(event.target.value)
                resetPagination()
              }}
            />
          </div>
        </div>
        <div className='flex justify-end'>
          <Button
            type='button'
            variant='outline'
            disabled={!canRead || !telemetry.data || !events.data}
            onClick={exportMetadata}
          >
            <Download className='mr-2 size-4' /> Export metadata
          </Button>
        </div>

        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Family</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(events.data?.events ?? []).map((event) => (
                <TableRow key={event.id}>
                  <TableCell className='text-xs whitespace-nowrap'>
                    {formatEventTime(event.ts)}
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>{event.family}</Badge>
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {event.operation}
                  </TableCell>
                  <TableCell>{eventSubject(event)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        event.severity === 'error' ? 'destructive' : 'secondary'
                      }
                    >
                      {event.outcome}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!events.isLoading && (events.data?.events.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='py-6 text-center text-sm'>
                    No operational events match the current safe filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <div className='flex justify-end gap-2'>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={cursorHistory.length === 0}
            onClick={() => {
              const prior = [...cursorHistory]
              setCursor(prior.pop() || undefined)
              setCursorHistory(prior)
            }}
          >
            Previous
          </Button>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={!events.data?.nextCursor}
            onClick={() => {
              if (!events.data?.nextCursor) return
              setCursorHistory((history) => [...history, cursor ?? ''])
              setCursor(events.data.nextCursor)
            }}
          >
            Next
          </Button>
        </div>

        <div className='space-y-3 rounded-lg border p-4'>
          <h3 className='font-medium'>Effective allowed refs and namespaces</h3>
          <p className='text-sm text-muted-foreground'>
            Live broker.accessPolicy grants. This is not a policy playground.
            Full inspector remains on Security.
          </p>
          {assignments.isError ? (
            <p className='text-sm text-destructive'>
              Effective policy metadata is unavailable.
            </p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Refs</TableHead>
                <TableHead>Operations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {effectivePolicy.map((row) => (
                <TableRow key={`${row.serviceId}:${row.namespace}`}>
                  <TableCell className='font-mono text-xs'>
                    {row.serviceId}
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {row.namespace}
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {row.refsLabel}
                  </TableCell>
                  <TableCell>{row.operationsLabel}</TableCell>
                </TableRow>
              ))}
              {effectivePolicy.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className='text-muted-foreground'>
                    No effective policy grants are declared on this instance.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        {lockouts.scopes.length > 0 ? (
          <div className='space-y-2 rounded-lg border p-4'>
            <h3 className='font-medium'>Active lockout scopes</h3>
            {lockouts.scopes.map((item) => (
              <p key={item.scope} className='text-sm'>
                <span className='font-mono text-xs'>{item.scope}</span>
                {' · '}
                {item.retryGuidance}
              </p>
            ))}
          </div>
        ) : null}

        <div className='space-y-3 rounded-lg border p-4'>
          <div>
            <h3 className='flex items-center gap-2 font-medium'>
              <UnlockKeyhole className='size-4' /> Clear an exact lockout
            </h3>
            <p className='mt-1 text-sm text-muted-foreground'>
              Allowed scopes begin with local_api:, management:, or writeback:.
              The Broker records both successful clears and safe not-found
              checks.
            </p>
          </div>
          <div className='grid gap-3 md:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='broker-lockout-scope'>Exact lockout scope</Label>
              <Input
                id='broker-lockout-scope'
                value={lockoutScope}
                maxLength={512}
                placeholder='management:operator-id'
                onChange={(event) => setLockoutScope(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='broker-lockout-reason'>Audit reason</Label>
              <Input
                id='broker-lockout-reason'
                value={lockoutReason}
                maxLength={256}
                placeholder='Why is this lockout being cleared?'
                onChange={(event) => setLockoutReason(event.target.value)}
              />
            </div>
          </div>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <Label className='flex items-center gap-2'>
              <Checkbox
                aria-label='Confirm this exact audited lockout clear'
                checked={lockoutConfirmed}
                onCheckedChange={(checked) =>
                  setLockoutConfirmed(checked === true)
                }
              />
              Confirm this exact audited lockout clear
            </Label>
            <Button
              type='button'
              variant='destructive'
              disabled={
                !canClearLockouts ||
                !lockoutScope.trim() ||
                !lockoutReason.trim() ||
                !lockoutConfirmed ||
                clearLockout.isPending
              }
              onClick={() => void runLockoutClear()}
            >
              Clear exact lockout
            </Button>
          </div>
          {message ? (
            <p className='text-sm text-emerald-700 dark:text-emerald-300'>
              {message}
            </p>
          ) : null}
          {error ? <p className='text-sm text-destructive'>{error}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}
