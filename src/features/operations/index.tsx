import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Activity, ClipboardCheck, FileChartColumn } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  fetchSecretsBrokerAuditEvents,
  type SecretsBrokerAuditEventMetadata,
} from '@/lib/secrets-broker/client'
import {
  useServiceTelemetryPreview,
  useServices,
  useTelemetryPreview,
} from '@/lib/service-lasso-dashboard/hooks'
import type {
  DashboardService,
  ServiceTelemetryPreview,
  TelemetryPreview,
} from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import {
  DataTableColumnHeader,
  DataTablePagination,
  DataTableToolbar,
} from '@/components/data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  auditEventTypeLabel,
  secretsBrokerAuditEvents,
} from '@/features/secrets-broker/audit-events'

type OperationsSource = 'Service Lasso' | 'Secrets Broker'
type OperationsState = 'available' | 'degraded' | 'unavailable'

type TelemetryRow = {
  id: string
  signal: string
  source: OperationsSource
  owner: string
  state: OperationsState
  lastSample: string
  value: string
  nextAction: string
}

type AuditLogRow = {
  id: string
  event: string
  source: OperationsSource
  actor: string
  outcome: string
  policy: string
  tamperEvidence: string
  recordedAt: string
  safeSummary: string
}

type AuditSourceStatus = 'live' | 'unavailable' | 'fixture'

type AuditSummary = {
  sourceLabel: string
  eventCount: number
  mutatingActionCount: number
  chainStatus: 'verified' | 'broken' | 'mixed' | 'unavailable'
  rawMaterialLabel: 'Hidden' | 'Review'
  rawMaterialReturned: boolean
}

const stateVariant: Record<
  OperationsState,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  available: 'default',
  degraded: 'secondary',
  unavailable: 'outline',
}

const sourceOptions = [
  { label: 'Service Lasso', value: 'Service Lasso' },
  { label: 'Secrets Broker', value: 'Secrets Broker' },
]

function stateLabel(state: OperationsState) {
  return state.replace('-', ' ')
}

function operationStateForService(service: DashboardService): OperationsState {
  if (service.status === 'running' || service.status === 'available') {
    return 'available'
  }
  if (service.status === 'degraded') return 'degraded'
  return 'unavailable'
}

function telemetryPreviewState(telemetryPreview: TelemetryPreview) {
  const hasSafeExportPreview =
    !telemetryPreview.exportPreview.endpointValueReturned &&
    !telemetryPreview.exportPreview.headersValueReturned &&
    !telemetryPreview.exportPreview.bodyValueReturned

  if (!hasSafeExportPreview) return 'unavailable'
  if (telemetryPreview.exporter.status === 'disabled') return 'degraded'
  return 'available'
}

function buildTelemetryPreviewRows(
  telemetryPreview?: TelemetryPreview,
  telemetryError?: Error | null,
  secretsBrokerTelemetry?: ServiceTelemetryPreview
): TelemetryRow[] {
  if (telemetryError) {
    return [
      {
        id: 'runtime-telemetry-preview-error',
        signal: 'Core telemetry preview',
        source: 'Service Lasso',
        owner: 'service-lasso-core',
        state: 'unavailable',
        lastSample: 'Unavailable',
        value: telemetryError.message,
        nextAction: 'Verify the Service Lasso runtime /api/telemetry endpoint.',
      },
    ]
  }

  if (!telemetryPreview) return []

  const apiRequestBuffer = telemetryPreview.apiRequestBuffer
  const apiRequestSummary = telemetryPreview.apiRequestSummary
  const traceContext = telemetryPreview.traceContext
  const coreTraceContextSafe =
    traceContext &&
    traceContext.routeTemplateOnly &&
    !traceContext.incomingHeadersReturned &&
    !traceContext.rawHeadersReturned
  const brokerTraceContextReady =
    Boolean(secretsBrokerTelemetry?.signals.length) &&
    secretsBrokerTelemetry?.signals.every(
      (signal) =>
        Boolean(signal.traceparent) &&
        Boolean(signal.traceId) &&
        Boolean(signal.spanId) &&
        Boolean(signal.correlationId)
    )

  return [
    {
      id: 'runtime-telemetry-exporter',
      signal: 'Core telemetry exporter',
      source: 'Service Lasso',
      owner: telemetryPreview.resource.serviceName,
      state: telemetryPreviewState(telemetryPreview),
      lastSample: telemetryPreview.contractVersion,
      value: `${telemetryPreview.exporter.protocol} ${telemetryPreview.exporter.status}; endpoint hidden=${!telemetryPreview.exporter.endpointValueReturned}; headers hidden=${!telemetryPreview.exporter.headersValueReturned}`,
      nextAction: telemetryPreview.exporter.reason,
    },
    {
      id: 'runtime-telemetry-redaction',
      signal: 'Telemetry allowlist redaction',
      source: 'Service Lasso',
      owner: telemetryPreview.resource.serviceNamespace,
      state:
        telemetryPreview.redaction.mode === 'allowlist'
          ? 'available'
          : 'degraded',
      lastSample: `${telemetryPreview.redaction.allowedAttributes.length} attributes`,
      value: `${telemetryPreview.redaction.forbiddenFieldClasses.length} forbidden field classes omitted`,
      nextAction:
        'Keep Service Admin telemetry metadata-only and avoid raw request, config, credential, or secret material.',
    },
    {
      id: 'runtime-telemetry-export-preview',
      signal: 'OTLP export preview',
      source: 'Service Lasso',
      owner: telemetryPreview.resource.serviceInstanceId,
      state:
        telemetryPreview.exportPreview.endpointValueReturned ||
        telemetryPreview.exportPreview.headersValueReturned ||
        telemetryPreview.exportPreview.bodyValueReturned
          ? 'unavailable'
          : telemetryPreview.exportPreview.mode === 'disabled'
            ? 'degraded'
            : 'available',
      lastSample: `${telemetryPreview.exportPreview.signalCount} signals`,
      value: `${telemetryPreview.exportPreview.mode}/${telemetryPreview.exportPreview.status}; ${telemetryPreview.exportPreview.serviceCount} services`,
      nextAction: telemetryPreview.exportPreview.reason,
    },
    ...(traceContext
      ? [
          {
            id: 'runtime-telemetry-trace-context',
            signal: 'Core trace propagation',
            source: 'Service Lasso' as const,
            owner: traceContext.propagation,
            state: coreTraceContextSafe
              ? ('available' as const)
              : ('unavailable' as const),
            lastSample: traceContext.traceparentSampled
              ? 'sampled traceparent'
              : 'unsampled traceparent',
            value: `response header names=${Object.values(traceContext.responseHeaders).join(', ')}; raw headers returned=${traceContext.rawHeadersReturned}`,
            nextAction:
              'Propagate W3C trace context by header name only; incoming/raw header values stay hidden.',
          },
        ]
      : []),
    ...(traceContext && secretsBrokerTelemetry
      ? [
          {
            id: 'runtime-telemetry-core-broker-correlation',
            signal: 'Core-to-broker correlation',
            source: 'Secrets Broker' as const,
            owner: secretsBrokerTelemetry.serviceId,
            state:
              coreTraceContextSafe && brokerTraceContextReady
                ? ('available' as const)
                : ('degraded' as const),
            lastSample: `${secretsBrokerTelemetry.signals.length} broker signals`,
            value: `core propagation=${traceContext.propagation}; broker trace context=${brokerTraceContextReady}`,
            nextAction:
              'Use Service Lasso correlation IDs and W3C trace context posture without rendering header values or payloads.',
          },
        ]
      : []),
    ...(apiRequestBuffer
      ? [
          {
            id: 'runtime-telemetry-request-buffer',
            signal: 'API request buffer safety',
            source: 'Service Lasso' as const,
            owner: 'route-template telemetry',
            state:
              apiRequestBuffer.routeTemplateOnly &&
              !apiRequestBuffer.rawMaterialReturned
                ? ('available' as const)
                : ('unavailable' as const),
            lastSample: `${apiRequestBuffer.retainedCount}/${apiRequestBuffer.capacity} retained`,
            value: `${apiRequestBuffer.droppedCount} dropped; route templates only=${apiRequestBuffer.routeTemplateOnly}`,
            nextAction:
              'Use aggregate request metadata only; raw URLs, query strings, headers, and bodies stay hidden.',
          },
        ]
      : []),
    ...(apiRequestSummary
      ? [
          {
            id: 'runtime-telemetry-request-summary',
            signal: 'API request summary',
            source: 'Service Lasso' as const,
            owner: 'operations telemetry',
            state:
              apiRequestSummary.routeTemplateOnly &&
              !apiRequestSummary.rawMaterialReturned
                ? ('available' as const)
                : ('unavailable' as const),
            lastSample: `${apiRequestSummary.totalObservedCount} observed`,
            value: `${apiRequestSummary.mutatingCount} mutating; ${apiRequestSummary.routeGroups.length} route groups`,
            nextAction:
              'Show status classes, outcomes, and route groups without raw request material.',
          },
        ]
      : []),
  ]
}

function buildTelemetryRows(
  services: DashboardService[],
  telemetryPreview?: TelemetryPreview,
  telemetryError?: Error | null,
  secretsBrokerTelemetry?: ServiceTelemetryPreview,
  secretsBrokerTelemetryError?: Error | null
): TelemetryRow[] {
  const serviceRows: TelemetryRow[] = services.slice(0, 6).map((service) => ({
    id: `service-${service.id}`,
    signal: service.name,
    source: 'Service Lasso',
    owner: service.id,
    state: operationStateForService(service),
    lastSample: service.runtimeHealth.lastCheckAt,
    value: service.runtimeHealth.summary,
    nextAction:
      service.status === 'running'
        ? 'Runtime telemetry source is reporting.'
        : 'Check runtime state before treating this signal as healthy.',
  }))

  return [
    ...buildTelemetryPreviewRows(
      telemetryPreview,
      telemetryError,
      secretsBrokerTelemetry
    ),
    {
      id: 'runtime-health',
      signal: 'Runtime API health',
      source: 'Service Lasso',
      owner: 'service-lasso-runtime',
      state: services.length ? 'available' : 'unavailable',
      lastSample: services[0]?.runtimeHealth.lastCheckAt ?? 'Not sampled',
      value: services.length
        ? `${services.length} service records available`
        : 'Runtime service list is unavailable in this environment.',
      nextAction: services.length
        ? 'Use Runtime or Logs for service-level details.'
        : 'Verify Service Lasso runtime health endpoint before operating.',
    },
    ...buildSecretsBrokerTelemetryRows(
      secretsBrokerTelemetry,
      secretsBrokerTelemetryError
    ),
    {
      id: 'secretsbroker-audit-metadata',
      signal: 'Secrets Broker audit metadata',
      source: 'Secrets Broker',
      owner: '@secretsbroker',
      state: 'available',
      lastSample: secretsBrokerAuditEvents[0]?.timestamp ?? 'Not sampled',
      value: `${secretsBrokerAuditEvents.length} metadata-only audit events loaded`,
      nextAction: 'Use Audit for policy, outcome, and chain status.',
    },
    ...serviceRows,
  ]
}

function buildSecretsBrokerTelemetryRows(
  telemetryPreview?: ServiceTelemetryPreview,
  telemetryError?: Error | null
): TelemetryRow[] {
  if (telemetryError) {
    return [
      {
        id: 'secretsbroker-telemetry-preview-error',
        signal: 'Secrets Broker service telemetry',
        source: 'Secrets Broker',
        owner: '@secretsbroker',
        state: 'unavailable',
        lastSample: 'Unavailable',
        value: telemetryError.message,
        nextAction:
          'Verify the core /api/services/@secretsbroker/telemetry proxy before relying on broker telemetry status.',
      },
    ]
  }

  if (!telemetryPreview) {
    return [
      {
        id: 'secretsbroker-telemetry-preview-pending',
        signal: 'Secrets Broker service telemetry',
        source: 'Secrets Broker',
        owner: '@secretsbroker',
        state: 'degraded',
        lastSample: 'Not sampled',
        value: 'Waiting for core service telemetry preview.',
        nextAction:
          'Keep broker telemetry explicit until a runtime-backed preview is available.',
      },
    ]
  }

  const signals = telemetryPreview.signals
  const firstSignal = signals[0]
  const attributes = firstSignal?.attributes ?? {}
  const signalCount = signals.length
  const signalKinds = Array.from(new Set(signals.map((signal) => signal.kind)))
  const allSignalsHaveTraceContext =
    signalCount > 0 &&
    signals.every(
      (signal) =>
        Boolean(signal.traceparent) &&
        Boolean(signal.traceId) &&
        Boolean(signal.spanId) &&
        Boolean(signal.correlationId)
    )
  const rawAttributeKeysReturned = Object.keys(attributes).some((key) =>
    /authorization|cookie|header|body|query|secret|token|credential|private/i.test(
      key
    )
  )
  const serviceTag =
    typeof attributes['service.artifact.tag'] === 'string'
      ? attributes['service.artifact.tag']
      : typeof attributes['service.version'] === 'string'
        ? attributes['service.version']
        : 'tag unavailable'

  return [
    {
      id: 'secretsbroker-service-trace-context',
      signal: 'Secrets Broker service trace context',
      source: 'Secrets Broker',
      owner: telemetryPreview.serviceId,
      state: allSignalsHaveTraceContext ? 'available' : 'degraded',
      lastSample: `${signalCount} signals`,
      value: `w3c traceparent=${allSignalsHaveTraceContext}; correlation ids=${allSignalsHaveTraceContext}`,
      nextAction:
        'Use the core service telemetry route for broker trace posture; incoming headers and raw request material stay out of the UI.',
    },
    {
      id: 'secretsbroker-service-safe-envelope',
      signal: 'Secrets Broker telemetry safe envelope',
      source: 'Secrets Broker',
      owner: serviceTag,
      state: rawAttributeKeysReturned ? 'unavailable' : 'available',
      lastSample: signalKinds.join(', ') || 'No signals',
      value: `route/service attributes only; unsafe keys returned=${rawAttributeKeysReturned}`,
      nextAction:
        'Display service id, version, health, phase, outcome, and artifact metadata only.',
    },
  ]
}

function buildAuditRows(): AuditLogRow[] {
  return buildAuditRowsFromBrokerEvents(
    secretsBrokerAuditEvents.map((event) => ({
      id: event.id,
      event: auditEventTypeLabel(event.type),
      actorType: event.actorType,
      actorId: event.actorId,
      outcome: event.outcome,
      policyDecision: event.policyDecision,
      tamperEvidence: event.tamperEvidence.status,
      recordedAt: event.timestamp,
      summary: event.normalizedReason,
    }))
  )
}

function buildAuditRowsFromBrokerEvents(
  events: SecretsBrokerAuditEventMetadata[]
): AuditLogRow[] {
  const brokerRows = events.map(
    (event): AuditLogRow => ({
      id: event.id,
      event: event.event.replace(/_/g, ' '),
      source: 'Secrets Broker',
      actor: `${event.actorType}: ${event.actorId}`,
      outcome: event.outcome,
      policy: event.policyDecision,
      tamperEvidence: event.tamperEvidence,
      recordedAt: event.recordedAt,
      safeSummary: event.summary,
    })
  )

  return [
    {
      id: 'service-lasso-runtime-check',
      event: 'runtime health checked',
      source: 'Service Lasso',
      actor: 'serviceadmin:operator-view',
      outcome: 'success',
      policy: 'metadata-only runtime status read',
      tamperEvidence: 'unavailable',
      recordedAt: '2026-05-07T18:21:00Z',
      safeSummary:
        'Runtime health and service status were viewed without log payloads or secret values.',
    },
    {
      id: 'service-lasso-log-viewer-opened',
      event: 'log viewer opened',
      source: 'Service Lasso',
      actor: 'serviceadmin:operator-view',
      outcome: 'granted',
      policy: 'server resolves log paths before browser access',
      tamperEvidence: 'unavailable',
      recordedAt: '2026-05-07T18:20:30Z',
      safeSummary:
        'Log access surface keeps browser requests scoped to service id and log type.',
    },
    ...brokerRows,
  ]
}

function auditSourceLabel(status: AuditSourceStatus) {
  if (status === 'live') return 'Live runtime audit'
  if (status === 'unavailable') return 'Unavailable'
  return 'Fixture preview'
}

function isMutatingAuditRow(row: AuditLogRow) {
  return /committed|changed|completed|rotated|revoked|denied|granted/i.test(
    `${row.event} ${row.policy}`
  )
}

function auditChainStatus(rows: AuditLogRow[]): AuditSummary['chainStatus'] {
  if (!rows.length) return 'unavailable'

  const statuses = new Set(rows.map((row) => row.tamperEvidence))
  if (statuses.size === 1) {
    const [status] = Array.from(statuses)
    return status === 'verified' || status === 'broken' ? status : 'unavailable'
  }

  return 'mixed'
}

export function buildAuditSummary(
  rows: AuditLogRow[],
  sourceStatus: AuditSourceStatus = 'fixture',
  rawMaterialReturned = false
): AuditSummary {
  return {
    sourceLabel: auditSourceLabel(sourceStatus),
    eventCount: sourceStatus === 'unavailable' ? 0 : rows.length,
    mutatingActionCount:
      sourceStatus === 'unavailable'
        ? 0
        : rows.filter(isMutatingAuditRow).length,
    chainStatus:
      sourceStatus === 'unavailable' ? 'unavailable' : auditChainStatus(rows),
    rawMaterialLabel: rawMaterialReturned ? 'Review' : 'Hidden',
    rawMaterialReturned,
  }
}

function OperationsLoading() {
  return (
    <div className='flex flex-1 flex-col gap-4'>
      <Skeleton className='h-10 w-full max-w-xl' />
      <Skeleton className='h-[420px] w-full' />
      <Skeleton className='mt-auto h-9 w-full max-w-md' />
    </div>
  )
}

function OperationsStateBadge({ state }: { state: OperationsState }) {
  return <Badge variant={stateVariant[state]}>{stateLabel(state)}</Badge>
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  if (['success', 'granted'].includes(outcome)) {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>{outcome}</Badge>
    )
  }
  if (outcome === 'denied') return <Badge variant='secondary'>{outcome}</Badge>
  if (outcome === 'failure')
    return <Badge variant='destructive'>{outcome}</Badge>
  return <Badge variant='outline'>{outcome}</Badge>
}

const telemetryColumns: ColumnDef<TelemetryRow>[] = [
  {
    accessorKey: 'signal',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Signal' />
    ),
    cell: ({ row }) => (
      <div className='flex max-w-[240px] min-w-0 flex-col'>
        <span className='truncate font-medium' title={row.original.signal}>
          {row.original.signal}
        </span>
        <span className='truncate text-xs text-muted-foreground'>
          {row.original.owner}
        </span>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: 'source',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Source' />
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'state',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='State' />
    ),
    cell: ({ row }) => <OperationsStateBadge state={row.original.state} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'lastSample',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Last sample' />
    ),
    cell: ({ row }) => (
      <div className='max-w-[180px] truncate whitespace-nowrap'>
        {row.original.lastSample}
      </div>
    ),
  },
  {
    accessorKey: 'value',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Value' />
    ),
    cell: ({ row }) => (
      <div className='max-w-[320px] truncate' title={row.original.value}>
        {row.original.value}
      </div>
    ),
  },
  {
    accessorKey: 'nextAction',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Next action' />
    ),
    cell: ({ row }) => (
      <div className='max-w-[360px] truncate' title={row.original.nextAction}>
        {row.original.nextAction}
      </div>
    ),
  },
]

const auditColumns: ColumnDef<AuditLogRow>[] = [
  {
    accessorKey: 'event',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Event' />
    ),
    cell: ({ row }) => (
      <div className='flex max-w-[240px] min-w-0 flex-col'>
        <span className='truncate font-medium' title={row.original.event}>
          {row.original.event}
        </span>
        <span className='truncate text-xs text-muted-foreground'>
          {row.original.id}
        </span>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: 'source',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Source' />
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'outcome',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Outcome' />
    ),
    cell: ({ row }) => <OutcomeBadge outcome={row.original.outcome} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'actor',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Actor' />
    ),
    cell: ({ row }) => (
      <div className='max-w-[220px] truncate' title={row.original.actor}>
        {row.original.actor}
      </div>
    ),
  },
  {
    accessorKey: 'policy',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Policy' />
    ),
    cell: ({ row }) => (
      <div className='max-w-[320px] truncate' title={row.original.policy}>
        {row.original.policy}
      </div>
    ),
  },
  {
    accessorKey: 'tamperEvidence',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Chain' />
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'recordedAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Recorded' />
    ),
    cell: ({ row }) => (
      <div className='max-w-[180px] truncate whitespace-nowrap'>
        {row.original.recordedAt}
      </div>
    ),
  },
  {
    accessorKey: 'safeSummary',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Safe summary' />
    ),
    cell: ({ row }) => (
      <div className='max-w-[360px] truncate' title={row.original.safeSummary}>
        {row.original.safeSummary}
      </div>
    ),
  },
]

function OperationsTable<TData>({
  data,
  columns,
  searchKey,
  searchPlaceholder,
  filters,
  emptyMessage,
}: {
  data: TData[]
  columns: ColumnDef<TData>[]
  searchKey: string
  searchPlaceholder: string
  filters: {
    columnId: string
    title: string
    options: { label: string; value: string }[]
  }[]
  emptyMessage: string
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <DataTableToolbar
        table={table}
        searchKey={searchKey}
        searchPlaceholder={searchPlaceholder}
        filters={filters}
      />
      <div className='overflow-hidden rounded-md border'>
        <Table className='table-fixed'>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className='min-w-0'>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
    </div>
  )
}

function OperationsHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
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

      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>{title}</h2>
          <p className='text-muted-foreground'>{description}</p>
        </div>
        <Button variant='outline' size='sm' asChild>
          <Link to='/runtime'>Runtime</Link>
        </Button>
      </div>
    </>
  )
}

export function OperationsTelemetry() {
  usePageMetadata({
    title: 'Service Admin - Operations Telemetry',
    description:
      'Operations telemetry across Service Lasso and Secrets Broker sources.',
  })

  const servicesQuery = useServices()
  const telemetryQuery = useTelemetryPreview()
  const secretsBrokerTelemetryQuery =
    useServiceTelemetryPreview('@secretsbroker')
  const telemetryError =
    telemetryQuery.error instanceof Error ? telemetryQuery.error : null
  const secretsBrokerTelemetryError =
    secretsBrokerTelemetryQuery.error instanceof Error
      ? secretsBrokerTelemetryQuery.error
      : null
  const rows = useMemo(
    () =>
      buildTelemetryRows(
        servicesQuery.data ?? [],
        telemetryQuery.data,
        telemetryError,
        secretsBrokerTelemetryQuery.data,
        secretsBrokerTelemetryError
      ),
    [
      secretsBrokerTelemetryError,
      secretsBrokerTelemetryQuery.data,
      servicesQuery.data,
      telemetryError,
      telemetryQuery.data,
    ]
  )
  const requestSummary = telemetryQuery.data?.apiRequestSummary
  const exporter = telemetryQuery.data?.exporter

  return (
    <>
      <OperationsHeader
        title='Telemetry'
        description='Service Lasso runtime and Secrets Broker telemetry status, with missing sources shown explicitly.'
      />
      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='grid gap-4 md:grid-cols-3'>
          <div className='rounded-md border p-4'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <Activity className='size-4' /> Service Lasso signals
            </div>
            <div className='mt-2 text-2xl font-bold'>
              {rows.filter((row) => row.source === 'Service Lasso').length}
            </div>
            <p className='text-xs text-muted-foreground'>
              Runtime-backed rows use service metadata and health summaries.
            </p>
          </div>
          <div className='rounded-md border p-4'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <FileChartColumn className='size-4' /> Secrets Broker signals
            </div>
            <div className='mt-2 text-2xl font-bold'>
              {rows.filter((row) => row.source === 'Secrets Broker').length}
            </div>
            <p className='text-xs text-muted-foreground'>
              Broker rows are sourced from core service telemetry metadata.
            </p>
          </div>
          <div className='rounded-md border p-4'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <ClipboardCheck className='size-4' /> Safety boundary
            </div>
            <div className='mt-2 text-2xl font-bold'>
              {exporter
                ? exporter.endpointValueReturned ||
                  exporter.headersValueReturned
                  ? 'Review'
                  : 'Hidden'
                : 'No values'}
            </div>
            <p className='text-xs text-muted-foreground'>
              {requestSummary
                ? `${requestSummary.totalObservedCount} API requests observed with raw material returned=${requestSummary.rawMaterialReturned}.`
                : 'No secret values, tokens, credentials, or raw log payloads are shown.'}
            </p>
          </div>
        </div>

        {servicesQuery.isLoading ||
        telemetryQuery.isLoading ||
        secretsBrokerTelemetryQuery.isLoading ? (
          <OperationsLoading />
        ) : (
          <OperationsTable
            data={rows}
            columns={telemetryColumns}
            searchKey='signal'
            searchPlaceholder='Search telemetry signals...'
            filters={[
              { columnId: 'source', title: 'Source', options: sourceOptions },
              {
                columnId: 'state',
                title: 'State',
                options: [
                  { label: 'Available', value: 'available' },
                  { label: 'Degraded', value: 'degraded' },
                  { label: 'Unavailable', value: 'unavailable' },
                ],
              },
            ]}
            emptyMessage='No telemetry rows match the current filters.'
          />
        )}
      </Main>
    </>
  )
}

export function OperationsAuditLogging() {
  usePageMetadata({
    title: 'Service Admin - Operations Audit',
    description:
      'Operations audit events across Service Lasso and Secrets Broker sources.',
  })

  const brokerAuditQuery = useQuery({
    queryKey: ['operations', 'audit', 'secrets-broker'],
    queryFn: fetchSecretsBrokerAuditEvents,
  })
  const brokerAudit = brokerAuditQuery.data
  const rows = useMemo(() => {
    if (brokerAudit && !brokerAudit.stubMode) {
      return buildAuditRowsFromBrokerEvents(
        brokerAudit.state === 'ready' ? brokerAudit.events : []
      )
    }

    return buildAuditRows()
  }, [brokerAudit])
  const auditSourceStatus: AuditSourceStatus =
    brokerAudit && !brokerAudit.stubMode
      ? brokerAudit.state === 'ready'
        ? 'live'
        : 'unavailable'
      : 'fixture'
  const auditSummary = useMemo(
    () =>
      buildAuditSummary(
        rows,
        auditSourceStatus,
        brokerAudit?.rawMaterialReturned === true
      ),
    [auditSourceStatus, brokerAudit?.rawMaterialReturned, rows]
  )
  const outcomes = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.outcome)))
        .sort()
        .map((outcome) => ({ label: outcome, value: outcome })),
    [rows]
  )
  const chainStates = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.tamperEvidence)))
        .sort()
        .map((status) => ({ label: status, value: status })),
    [rows]
  )

  return (
    <>
      <OperationsHeader
        title='Audit'
        description='Metadata-only operation events for Service Lasso and Secrets Broker, including explicit unavailable chain proof states.'
      />
      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='grid gap-4 md:grid-cols-5'>
          <div className='rounded-md border p-4'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <Activity className='size-4' /> Data source
            </div>
            <div className='mt-2 text-2xl font-bold'>
              {auditSummary.sourceLabel}
            </div>
            <p className='text-xs text-muted-foreground'>
              Audit events are labelled separately from telemetry and request
              summaries.
            </p>
          </div>
          <div className='rounded-md border p-4'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <FileChartColumn className='size-4' /> Audit events
            </div>
            <div className='mt-2 text-2xl font-bold'>
              {auditSummary.eventCount}
            </div>
            <p className='text-xs text-muted-foreground'>
              Events returned by the current audit source.
            </p>
          </div>
          <div className='rounded-md border p-4'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <ClipboardCheck className='size-4' /> Durable operator actions
            </div>
            <div className='mt-2 text-2xl font-bold'>
              {auditSummary.mutatingActionCount}
            </div>
            <p className='text-xs text-muted-foreground'>
              Mutating actions inferred from safe audit metadata.
            </p>
          </div>
          <div className='rounded-md border p-4'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <ClipboardCheck className='size-4' /> Chain status
            </div>
            <div className='mt-2 text-2xl font-bold capitalize'>
              {auditSummary.chainStatus}
            </div>
            <p className='text-xs text-muted-foreground'>
              Verified, broken, mixed, or unavailable chain proof.
            </p>
          </div>
          <div className='rounded-md border p-4'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <ClipboardCheck className='size-4' /> Raw material
            </div>
            <div className='mt-2 text-2xl font-bold'>
              {auditSummary.rawMaterialLabel}
            </div>
            <p className='text-xs text-muted-foreground'>
              rawMaterialReturned={String(auditSummary.rawMaterialReturned)}
            </p>
          </div>
        </div>
        <div className='rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground'>
          Audit rows use safe identifiers, policy metadata, outcomes, and
          tamper-evidence status only. Secret values, provider credentials,
          tokens, private keys, raw response bodies, and recovery material are
          outside this surface.
        </div>
        <OperationsTable
          data={rows}
          columns={auditColumns}
          searchKey='event'
          searchPlaceholder='Search audit events...'
          filters={[
            { columnId: 'source', title: 'Source', options: sourceOptions },
            { columnId: 'outcome', title: 'Outcome', options: outcomes },
            {
              columnId: 'tamperEvidence',
              title: 'Chain',
              options: chainStates,
            },
          ]}
          emptyMessage='No audit rows match the current filters.'
        />
      </Main>
    </>
  )
}
