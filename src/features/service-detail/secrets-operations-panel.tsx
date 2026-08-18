import { useMemo, useState } from 'react'
import { Activity, RefreshCw, ShieldAlert, UnlockKeyhole } from 'lucide-react'
import {
  useBrokerEvents,
  useBrokerLockoutClear,
  useBrokerTelemetry,
  useRuntimeIdentity,
} from '@/lib/service-lasso-dashboard/hooks'
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
      limit,
      ...(cursor ? { cursor } : {}),
    }),
    [cursor, family, limit, severity]
  )
  const telemetry = useBrokerTelemetry(canRead)
  const events = useBrokerEvents(filters, canRead)
  const clearLockout = useBrokerLockoutClear()
  const auditRecordCount =
    telemetry.data?.counters.auditRecords.reduce(
      (total, counter) => total + counter.count,
      0
    ) ?? 0

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
