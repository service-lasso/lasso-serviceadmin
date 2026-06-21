import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
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
import {
  CheckCircle2,
  DatabaseZap,
  Eye,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { isServiceAdminStubModeEnabled } from '@/lib/service-lasso-dashboard/stub'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  buildBulkSecretCampaignPlan,
  buildBulkSecretCampaignApplyGate,
  buildBulkSecretCampaignApplyResult,
  buildManagedSecretActionPreview,
  buildManagedSecretActionReadiness,
  buildSingleSecretOperationHistoryEntry,
  buildSingleSecretOperationResult,
  buildSingleSecretOperationPlan,
  buildStubSecretMutationPreview,
  bulkSecretCampaignApplyModes,
  bulkSecretCampaignOperations,
  bulkSecretCampaignRevalidationStates,
  managedSecretRows,
  stubSecretMutationStates,
  valueSearchManagedSecrets,
  type BulkSecretCampaignApplyMode,
  type BulkSecretCampaignApplyResult,
  type BulkSecretCampaignOperation,
  type BulkSecretCampaignRevalidationState,
  type ManagedSecretAction,
  type ManagedSecretRow,
  type ManagedSecretState,
  type SingleSecretOperationHistoryEntry,
  type SingleSecretOperationResult,
  type StubSecretMutationState,
} from './secrets-management'

const stateVariant: Record<
  ManagedSecretState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  present: 'default',
  missing: 'destructive',
  stale: 'secondary',
  'rotation-due': 'outline',
}

const stateOptions: Array<{ label: string; value: ManagedSecretState }> = [
  { label: 'Present', value: 'present' },
  { label: 'Rotation due', value: 'rotation-due' },
  { label: 'Stale', value: 'stale' },
  { label: 'Missing', value: 'missing' },
]

const providerOptions = Array.from(
  new Set(managedSecretRows.map((row) => row.provider))
)
  .sort()
  .map((provider) => ({ label: provider, value: provider }))

const actionButtonLabels: Record<
  Exclude<ManagedSecretAction, 'metadata'>,
  string
> = {
  reveal: 'Controlled reveal',
  edit: 'Edit/update dry-run',
  reset: 'Reset/rotate dry-run',
  delete: 'Delete dry-run',
  policy: 'Apply policy preview',
}

export function SecretsManagementPage() {
  const stubModeEnabled = isServiceAdminStubModeEnabled()
  const [valueQuery, setValueQuery] = useState('')
  const [valueSearchSupported, setValueSearchSupported] = useState(false)
  const [selectedRowId, setSelectedRowId] = useState(managedSecretRows[0].id)
  const [selectedAction, setSelectedAction] =
    useState<ManagedSecretAction>('metadata')
  const [stubState, setStubState] = useState<StubSecretMutationState>('ready')
  const [auditReason, setAuditReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [singleApplyResult, setSingleApplyResult] =
    useState<SingleSecretOperationResult | null>(null)
  const [singleOperationHistory, setSingleOperationHistory] = useState<
    SingleSecretOperationHistoryEntry[]
  >([])
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([
    managedSecretRows[0].id,
    managedSecretRows[1].id,
  ])
  const [bulkOperation, setBulkOperation] =
    useState<BulkSecretCampaignOperation>('rotate-reset')
  const [bulkPlanGenerated, setBulkPlanGenerated] = useState(false)
  const [bulkAuditReason, setBulkAuditReason] = useState('')
  const [bulkConfirmation, setBulkConfirmation] = useState('')
  const [bulkRevalidationState, setBulkRevalidationState] =
    useState<BulkSecretCampaignRevalidationState>('ready')
  const [bulkRevalidated, setBulkRevalidated] = useState(false)
  const [bulkApplyMode, setBulkApplyMode] =
    useState<BulkSecretCampaignApplyMode>('success')
  const [bulkApplyResult, setBulkApplyResult] =
    useState<BulkSecretCampaignApplyResult | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  usePageMetadata({
    title: 'Service Admin - Secrets Broker Secrets',
    description:
      'Searchable metadata-first Secrets Broker management table for controlled reveal, dry-run edit/reset, and policy preview actions.',
  })

  const valueSearchRows = useMemo(
    () =>
      valueSearchManagedSecrets(
        managedSecretRows,
        valueQuery,
        valueSearchSupported
      ),
    [valueQuery, valueSearchSupported]
  )
  const selectedRow =
    managedSecretRows.find((row) => row.id === selectedRowId) ??
    managedSecretRows[0]
  const actionPreview = buildManagedSecretActionPreview(
    selectedRow,
    selectedAction
  )
  const selectedActionReadiness = buildManagedSecretActionReadiness(selectedRow)
  const selectedActionReadinessDetail =
    selectedActionReadiness.find((item) => item.action === selectedAction) ??
    null
  const stubMutationPreview = buildStubSecretMutationPreview(
    selectedRow,
    selectedAction === 'metadata' || selectedAction === 'policy'
      ? 'edit'
      : selectedAction,
    stubState,
    auditReason,
    confirmed
  )
  const singleOperationPlan = buildSingleSecretOperationPlan(
    selectedRow,
    selectedAction,
    auditReason,
    confirmed,
    stubState
  )
  const bulkPlan = useMemo(
    () =>
      buildBulkSecretCampaignPlan(
        managedSecretRows,
        bulkSelectedIds,
        bulkOperation
      ),
    [bulkOperation, bulkSelectedIds]
  )
  const bulkApplyGate = buildBulkSecretCampaignApplyGate(
    bulkPlan,
    bulkAuditReason,
    bulkConfirmation,
    bulkRevalidationState,
    bulkRevalidated,
    bulkPlan.applyAvailable
  )

  const resetBulkApplyGate = useCallback(() => {
    setBulkRevalidated(false)
    setBulkApplyResult(null)
  }, [])

  function resetBulkApplyResult() {
    setBulkApplyResult(null)
  }

  const chooseAction = useCallback(
    (rowId: string, action: ManagedSecretAction) => {
      setSelectedRowId(rowId)
      setSelectedAction(action)
      setSingleApplyResult(null)
    },
    []
  )

  const toggleBulkSelection = useCallback(
    (rowId: string, checked: boolean) => {
      setBulkPlanGenerated(false)
      resetBulkApplyGate()
      setBulkSelectedIds((current) =>
        checked
          ? [...new Set([...current, rowId])]
          : current.filter((id) => id !== rowId)
      )
    },
    [resetBulkApplyGate]
  )

  function setOperation(operation: BulkSecretCampaignOperation) {
    setBulkPlanGenerated(false)
    resetBulkApplyGate()
    setBulkOperation(operation)
  }

  function applyBulkCampaign() {
    setBulkApplyResult(
      buildBulkSecretCampaignApplyResult(bulkPlan, bulkApplyMode)
    )
  }

  function applySingleSecretOperation() {
    const result = buildSingleSecretOperationResult(
      selectedRow,
      singleOperationPlan
    )
    setSingleApplyResult(result)
    setSingleOperationHistory((current) => [
      buildSingleSecretOperationHistoryEntry(
        selectedRow,
        singleOperationPlan,
        current.length + 1
      ),
      ...current,
    ])
    setStubState('success')
  }

  const columns = useMemo<ColumnDef<ManagedSecretRow>[]>(
    () => [
      {
        id: 'plan',
        header: 'Plan',
        cell: ({ row }) => (
          <input
            type='checkbox'
            aria-label={`Select ${row.original.name} for bulk dry-run`}
            checked={bulkSelectedIds.includes(row.original.id)}
            onChange={(event) =>
              toggleBulkSelection(row.original.id, event.target.checked)
            }
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: 'name',
        accessorFn: (row) =>
          [
            row.name,
            row.ref,
            row.owningService,
            row.provider,
            row.source,
            row.workspace,
            row.rotationStatus,
            row.policy,
            row.auditStatus,
            row.backendCapability,
            row.safeTags.join(' '),
          ].join(' '),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Secret ref' />
        ),
        cell: ({ row }) => (
          <div className='min-w-80 align-top'>
            <div className='font-medium'>{row.original.name}</div>
            <div className='text-sm break-all text-muted-foreground'>
              {row.original.ref}
            </div>
            <div className='mt-2 flex flex-wrap gap-1'>
              {row.original.safeTags.map((tag) => (
                <Badge key={tag} variant='outline'>
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        ),
        filterFn: (row, id, value) =>
          String(row.getValue(id))
            .toLowerCase()
            .includes(String(value).toLowerCase()),
        enableHiding: false,
      },
      {
        accessorKey: 'provider',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Owner / provider' />
        ),
        cell: ({ row }) => (
          <div className='min-w-56 align-top'>
            <div className='font-medium'>{row.original.owningService}</div>
            <div className='text-sm text-muted-foreground'>
              {row.original.provider} · {row.original.source}
            </div>
            <div className='text-xs text-muted-foreground'>
              {row.original.workspace}
            </div>
          </div>
        ),
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        accessorKey: 'state',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: ({ row }) => (
          <div className='min-w-48 align-top'>
            <Badge variant={stateVariant[row.original.state]}>
              {row.original.state}
            </Badge>
            <div className='mt-2 text-sm'>{row.original.rotationStatus}</div>
            <div className='text-xs text-muted-foreground'>
              Updated: {row.original.lastUpdatedAt}
            </div>
          </div>
        ),
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        accessorKey: 'policy',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Policy / audit' />
        ),
        cell: ({ row }) => (
          <div className='min-w-64 align-top text-sm'>
            <div className='break-all'>{row.original.policy}</div>
            <div className='mt-2 text-muted-foreground'>
              {row.original.auditStatus}
            </div>
            <div className='text-xs text-muted-foreground'>
              Capability: {row.original.backendCapability}
            </div>
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const readiness = buildManagedSecretActionReadiness(row.original)
          const readyCount = readiness.filter((item) => item.canPreview).length

          return (
            <div className='min-w-80 space-y-3 align-top'>
              <div className='text-xs text-muted-foreground'>
                Readiness: {readyCount} ready / {readiness.length - readyCount}{' '}
                blocked
              </div>
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => chooseAction(row.original.id, 'metadata')}
                >
                  View metadata
                </Button>
                {readiness.map((item) => (
                  <Button
                    key={item.action}
                    type='button'
                    size='sm'
                    variant={item.canPreview ? 'outline' : 'secondary'}
                    onClick={() => chooseAction(row.original.id, item.action)}
                  >
                    {actionButtonLabels[item.action]}
                  </Button>
                ))}
              </div>
              <div className='flex flex-wrap gap-1'>
                {readiness.map((item) => (
                  <Badge
                    key={`${item.action}-${item.status}`}
                    variant={item.canPreview ? 'outline' : 'secondary'}
                  >
                    {item.label}: {item.badge}
                  </Badge>
                ))}
              </div>
            </div>
          )
        },
        enableSorting: false,
      },
    ],
    [bulkSelectedIds, chooseAction, toggleBulkSelection]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: managedSecretRows,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue ?? '')
        .trim()
        .toLowerCase()
      if (!query) return true
      return [
        row.original.ref,
        row.original.name,
        row.original.owningService,
        row.original.provider,
        row.original.source,
        row.original.workspace,
        row.original.rotationStatus,
        row.original.policy,
        row.original.auditStatus,
        row.original.backendCapability,
        ...row.original.safeTags,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  useEffect(() => {
    if (
      pagination.pageIndex > 0 &&
      pagination.pageIndex >= table.getPageCount()
    ) {
      setPagination((current) => ({
        ...current,
        pageIndex: Math.max(table.getPageCount() - 1, 0),
      }))
    }
  }, [pagination.pageIndex, table])

  if (!stubModeEnabled) {
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

        <Main id='content' className='space-y-6'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div>
              <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
                <DatabaseZap className='size-5' /> Secrets
              </h1>
              <p className='mt-1 text-muted-foreground'>
                Secrets Broker management table for safe metadata search,
                controlled reveal entry, and dry-run edit/reset/delete/policy
                actions. Rows never render raw secret values.
              </p>
            </div>
            <Badge variant='outline'>Live API required</Badge>
          </div>

          <Alert>
            <ShieldCheck className='size-4' />
            <AlertTitle>Secrets Broker API unavailable</AlertTitle>
            <AlertDescription>
              No local stub data is rendered because Service Admin stub mode is
              disabled. Connect a live Secrets Broker API or enable the explicit
              local developer stub flag for fixture previews.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Secrets management unavailable</CardTitle>
              <CardDescription>
                The production mutation contract is not connected in this UI
                build, so fixture rows, stub previews, and simulated apply
                controls stay hidden by default.
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-wrap gap-2 text-sm text-muted-foreground'>
              <Badge variant='outline'>No fixture rows</Badge>
              <Badge variant='outline'>No simulated mutations</Badge>
              <Badge variant='outline'>No raw values</Badge>
            </CardContent>
          </Card>
        </Main>
      </>
    )
  }

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

      <Main id='content' className='space-y-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <DatabaseZap className='size-5' /> Secrets
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Search refs, review provider state, and launch dry-run actions
              without raw values.
            </p>
          </div>
          <Badge variant='secondary'>Stub preview · values hidden</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <ShieldCheck className='size-4' /> Operator queue
            </CardTitle>
            <CardDescription>
              Current controls are metadata-first and dry-run gated.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-3 md:grid-cols-3'>
            <div className='rounded-md border p-3 text-sm'>
              <div className='font-medium'>Find a ref</div>
              <div className='text-muted-foreground'>
                Use table search, filters, sorting, and pagination.
              </div>
            </div>
            <div className='rounded-md border p-3 text-sm'>
              <div className='font-medium'>Pick row action</div>
              <div className='text-muted-foreground'>
                Reveal, edit, reset, delete, and policy actions open previews.
              </div>
            </div>
            <div className='rounded-md border p-3 text-sm'>
              <div className='font-medium'>Dry-run before apply</div>
              <div className='text-muted-foreground'>
                Apply stays locked without preview, audit reason, and
                confirmation.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total refs</CardDescription>
              <CardTitle className='text-3xl'>
                {managedSecretRows.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Visible values</CardDescription>
              <CardTitle className='text-3xl'>0</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Preview actions</CardDescription>
              <CardTitle className='text-3xl'>5</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Bulk mutations</CardDescription>
              <CardTitle className='text-3xl'>0</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <DatabaseZap className='size-4' /> Search and value-search posture
            </CardTitle>
            <CardDescription>
              Table controls search safe metadata; value search returns
              refs/metadata only when the broker supports it.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-4 lg:grid-cols-2'>
            <div className='space-y-2'>
              <div className='text-sm font-medium text-muted-foreground'>
                Shared table metadata controls
              </div>
              <div className='rounded-md border bg-muted/40 p-3 text-sm'>
                Use the table toolbar below to search safe refs, owners,
                providers, tags, policy names, and audit metadata. The search
                index excludes raw values and provider credentials.
              </div>
              <div className='text-sm text-muted-foreground'>
                Metadata matches: {table.getFilteredRowModel().rows.length}
              </div>
            </div>

            <div className='space-y-2'>
              <label
                htmlFor='value-search'
                className='text-sm font-medium text-muted-foreground'
              >
                Broker-backed value search
              </label>
              <Input
                id='value-search'
                value={valueQuery}
                onChange={(event) => setValueQuery(event.target.value)}
                placeholder='Broker receives search request; UI receives refs only'
              />
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  variant={valueSearchSupported ? 'default' : 'outline'}
                  onClick={() => setValueSearchSupported(true)}
                >
                  Simulate supported value search
                </Button>
                <Button
                  type='button'
                  variant={!valueSearchSupported ? 'default' : 'outline'}
                  onClick={() => setValueSearchSupported(false)}
                >
                  Simulate unsupported value search
                </Button>
              </div>
              <div className='rounded-md border p-3 text-sm'>
                {valueSearchSupported ? (
                  <div>
                    Value search supported: {valueSearchRows.length} safe ref
                    metadata match
                    {valueSearchRows.length === 1 ? '' : 'es'} returned; raw
                    values are never returned to the table.
                  </div>
                ) : (
                  <div>
                    Value search unsupported by this broker/source; the table
                    fails closed and keeps raw values hidden.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Secrets management table</CardTitle>
            <CardDescription>
              Searchable safe metadata rows with controlled row actions and
              multi-ref selection for non-mutating campaign planning. Apply
              controls are represented as dry-run/preview states, not direct
              mutation.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <DataTableToolbar
              table={table}
              searchPlaceholder='Search secret metadata...'
              filters={[
                {
                  columnId: 'state',
                  title: 'State',
                  options: stateOptions,
                },
                {
                  columnId: 'provider',
                  title: 'Provider',
                  options: providerOptions,
                },
              ]}
            />
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className='group/row'>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className={cn(
                            'bg-background group-hover/row:bg-muted',
                            header.column.columnDef.meta?.className,
                            header.column.columnDef.meta?.thClassName
                          )}
                        >
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
                      <TableRow key={row.id} className='group/row'>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              'bg-background align-top group-hover/row:bg-muted',
                              cell.column.columnDef.meta?.className,
                              cell.column.columnDef.meta?.tdClassName
                            )}
                          >
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
                        No secrets match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination table={table} className='mt-auto' />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <ListChecks className='size-4' /> Bulk campaign dry-run planner
            </CardTitle>
            <CardDescription>
              Selected refs become a broker campaign plan, then supported
              rotate/reset/update, policy, and provider migration campaigns can
              apply through operation IDs.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]'>
              <div className='space-y-2'>
                <label
                  htmlFor='bulk-operation'
                  className='text-sm font-medium text-muted-foreground'
                >
                  Campaign operation
                </label>
                <select
                  id='bulk-operation'
                  className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                  value={bulkOperation}
                  onChange={(event) =>
                    setOperation(
                      event.target.value as BulkSecretCampaignOperation
                    )
                  }
                >
                  {bulkSecretCampaignOperations.map((operation) => (
                    <option key={operation.id} value={operation.id}>
                      {operation.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className='flex items-end'>
                <Button
                  type='button'
                  disabled={bulkSelectedIds.length === 0}
                  onClick={() => {
                    setBulkPlanGenerated(true)
                    resetBulkApplyGate()
                  }}
                >
                  Generate bulk dry-run plan
                </Button>
              </div>
            </div>

            <div className='grid gap-3 md:grid-cols-3 xl:grid-cols-6'>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  Selected
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.selectedCount}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  Applicable
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.applicableCount}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  Denied
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.deniedCount}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  Unsupported
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.unsupportedCount}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  Auth required
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.authRequiredCount}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  High risk
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.highRiskCount}
                </div>
              </div>
            </div>

            {bulkSelectedIds.length === 0 ? (
              <div className='rounded-md border bg-muted/40 p-3'>
                No refs selected. Select at least one metadata row before
                generating a campaign dry-run plan.
              </div>
            ) : bulkPlanGenerated ? (
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>Provider / target</TableHead>
                      <TableHead>Capability / policy</TableHead>
                      <TableHead>Risk / audit</TableHead>
                      <TableHead>Operation IDs</TableHead>
                      <TableHead>Expected action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkPlan.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className='min-w-72 align-top'>
                          <div className='font-medium'>{item.name}</div>
                          <div className='text-sm break-all text-muted-foreground'>
                            {item.ref}
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            {item.owningService}
                          </div>
                        </TableCell>
                        <TableCell className='min-w-56 align-top'>
                          <div>{item.sourceProvider}</div>
                          <div className='mt-2 text-xs text-muted-foreground'>
                            Target: {item.targetProvider}
                          </div>
                          <div className='text-xs break-all text-muted-foreground'>
                            {item.targetPolicy}
                          </div>
                        </TableCell>
                        <TableCell className='min-w-64 align-top'>
                          <div>{item.capabilityResult}</div>
                          <div className='mt-2 text-muted-foreground'>
                            {item.policyResult}
                          </div>
                          {item.blockers.length > 0 ? (
                            <div className='mt-2 flex flex-wrap gap-1'>
                              {item.blockers.map((blocker) => (
                                <Badge key={blocker} variant='outline'>
                                  {blocker}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className='min-w-56 align-top'>
                          <Badge
                            variant={
                              item.risk === 'high' ? 'destructive' : 'outline'
                            }
                          >
                            {item.risk} risk
                          </Badge>
                          <div className='mt-2 text-muted-foreground'>
                            {item.auditRequirement}
                          </div>
                        </TableCell>
                        <TableCell className='min-w-72 align-top text-xs'>
                          <div className='break-all'>
                            Item: {item.operationItemId}
                          </div>
                          <div className='mt-2 break-all text-muted-foreground'>
                            Idempotency: {item.idempotencyKey}
                          </div>
                          <Badge className='mt-2' variant='outline'>
                            {item.retrySafe ? 'retry safe' : 'fresh plan first'}
                          </Badge>
                        </TableCell>
                        <TableCell className='min-w-56 align-top'>
                          {item.expectedAction}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className='rounded-md border bg-muted/40 p-3'>
                {bulkPlan.selectedCount} refs selected. Generate dry-run to
                calculate capability, policy, risk, audit, and blocker metadata.
              </div>
            )}

            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                disabled={!bulkApplyGate.canApply}
                onClick={applyBulkCampaign}
              >
                Apply bulk campaign
              </Button>
              <Badge variant='secondary'>Dry-run plus revalidation</Badge>
              <Badge variant={bulkPlan.applyAvailable ? 'default' : 'outline'}>
                {bulkPlan.applyAvailable
                  ? 'Broker campaign API wired'
                  : 'Apply unavailable for this operation'}
              </Badge>
              <Badge variant='outline'>No raw values</Badge>
              <Badge variant='outline'>No provider credentials</Badge>
              <Badge variant='outline'>No export</Badge>
            </div>

            {bulkPlanGenerated ? (
              <div className='grid gap-4 rounded-md border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]'>
                <div className='space-y-4'>
                  <div>
                    <h3 className='font-medium'>
                      Campaign confirmation and revalidation
                    </h3>
                    <p className='mt-1 text-muted-foreground'>
                      Apply remains fail-closed until audit reason,
                      confirmation, and immediate revalidation all pass. Denied,
                      unsupported, auth-required, skipped, failed, and stale
                      items remain typed per row.
                    </p>
                  </div>

                  <div className='grid gap-3 md:grid-cols-3'>
                    <div className='space-y-2'>
                      <label
                        htmlFor='bulk-audit-reason'
                        className='text-sm font-medium text-muted-foreground'
                      >
                        Campaign audit reason
                      </label>
                      <Input
                        id='bulk-audit-reason'
                        value={bulkAuditReason}
                        onChange={(event) => {
                          setBulkAuditReason(event.target.value)
                          resetBulkApplyGate()
                        }}
                        placeholder='Required before revalidation'
                      />
                    </div>

                    <div className='space-y-2'>
                      <label
                        htmlFor='bulk-confirmation'
                        className='text-sm font-medium text-muted-foreground'
                      >
                        Explicit confirmation
                      </label>
                      <Input
                        id='bulk-confirmation'
                        value={bulkConfirmation}
                        onChange={(event) => {
                          setBulkConfirmation(event.target.value)
                          resetBulkApplyGate()
                        }}
                        placeholder={bulkApplyGate.confirmationPhrase}
                      />
                      <div className='text-xs text-muted-foreground'>
                        Required phrase: {bulkApplyGate.confirmationPhrase}
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <label
                        htmlFor='bulk-apply-mode'
                        className='text-sm font-medium text-muted-foreground'
                      >
                        Apply result mode
                      </label>
                      <select
                        id='bulk-apply-mode'
                        className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                        value={bulkApplyMode}
                        onChange={(event) => {
                          setBulkApplyMode(
                            event.target.value as BulkSecretCampaignApplyMode
                          )
                          resetBulkApplyResult()
                        }}
                      >
                        {bulkSecretCampaignApplyModes.map((mode) => (
                          <option key={mode.id} value={mode.id}>
                            {mode.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]'>
                    <div className='space-y-2'>
                      <label
                        htmlFor='bulk-revalidation-state'
                        className='text-sm font-medium text-muted-foreground'
                      >
                        Revalidation outcome
                      </label>
                      <select
                        id='bulk-revalidation-state'
                        className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                        value={bulkRevalidationState}
                        onChange={(event) => {
                          setBulkRevalidationState(
                            event.target
                              .value as BulkSecretCampaignRevalidationState
                          )
                          resetBulkApplyGate()
                        }}
                      >
                        {bulkSecretCampaignRevalidationStates.map((state) => (
                          <option key={state.id} value={state.id}>
                            {state.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className='flex items-end'>
                      <Button
                        type='button'
                        variant='outline'
                        disabled={!bulkApplyGate.auditReasonAccepted}
                        onClick={() => setBulkRevalidated(true)}
                      >
                        Revalidate dry-run
                      </Button>
                    </div>
                  </div>
                </div>

                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='mb-3 flex flex-wrap gap-2'>
                    <Badge
                      variant={
                        bulkApplyGate.revalidationPassed
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {bulkApplyGate.revalidationPassed
                        ? 'Revalidated'
                        : 'Revalidation blocked'}
                    </Badge>
                    <Badge variant='outline'>
                      {bulkApplyGate.applyDisabledReason}
                    </Badge>
                  </div>

                  <dl className='space-y-2'>
                    <div>
                      <dt className='text-muted-foreground'>Campaign</dt>
                      <dd className='break-all'>{bulkPlan.campaignId}</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>Operation</dt>
                      <dd className='break-all'>{bulkPlan.operationId}</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>
                        Revalidation status
                      </dt>
                      <dd>{bulkApplyGate.revalidationStatus}</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>Apply state</dt>
                      <dd>
                        {bulkApplyGate.canApply
                          ? 'campaign apply ready'
                          : 'campaign apply disabled'}
                      </dd>
                    </div>
                  </dl>

                  <ul className='mt-3 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {bulkApplyGate.statusRows.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>

                  {bulkApplyGate.blockers.length > 0 ? (
                    <div className='mt-3 space-y-1'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Blockers
                      </div>
                      <div className='flex flex-wrap gap-1'>
                        {bulkApplyGate.blockers.map((blocker) => (
                          <Badge key={blocker} variant='outline'>
                            {blocker}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {bulkApplyResult ? (
              <div className='space-y-4 rounded-md border p-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <h3 className='font-medium'>
                      Campaign apply result: {bulkApplyResult.outcome}
                    </h3>
                    <p className='mt-1 text-muted-foreground'>
                      {bulkApplyResult.auditStatus}; next action:{' '}
                      {bulkApplyResult.nextAction}.
                    </p>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <Badge variant='default'>
                      Applied {bulkApplyResult.appliedCount}
                    </Badge>
                    <Badge variant='outline'>
                      Failed {bulkApplyResult.failedCount}
                    </Badge>
                    <Badge variant='outline'>
                      Denied {bulkApplyResult.deniedCount}
                    </Badge>
                    <Badge variant='outline'>
                      Skipped {bulkApplyResult.skippedCount}
                    </Badge>
                    <Badge variant='outline'>
                      Unsupported {bulkApplyResult.unsupportedCount}
                    </Badge>
                    <Badge variant='outline'>
                      Auth {bulkApplyResult.authRequiredCount}
                    </Badge>
                    <Badge variant='outline'>
                      Stale {bulkApplyResult.staleCount}
                    </Badge>
                  </div>
                </div>

                <div className='grid gap-3 md:grid-cols-3'>
                  <div className='rounded-md border p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Campaign ID
                    </div>
                    <div className='mt-1 break-all'>
                      {bulkApplyResult.campaignId}
                    </div>
                  </div>
                  <div className='rounded-md border p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Operation ID
                    </div>
                    <div className='mt-1 break-all'>
                      {bulkApplyResult.operationId}
                    </div>
                  </div>
                  <div className='rounded-md border p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Plan token
                    </div>
                    <div className='mt-1 break-all'>
                      {bulkApplyResult.planToken}
                    </div>
                  </div>
                </div>

                <div className='overflow-x-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ref</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead>Operation identity</TableHead>
                        <TableHead>Audit / recovery</TableHead>
                        <TableHead>Next action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkApplyResult.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className='min-w-72 align-top'>
                            <div className='font-medium'>{item.name}</div>
                            <div className='text-sm break-all text-muted-foreground'>
                              {item.ref}
                            </div>
                          </TableCell>
                          <TableCell className='min-w-40 align-top'>
                            <Badge
                              variant={
                                item.outcome === 'applied'
                                  ? 'default'
                                  : item.outcome === 'failed'
                                    ? 'destructive'
                                    : 'outline'
                              }
                            >
                              {item.outcome}
                            </Badge>
                            <div className='mt-2 text-xs text-muted-foreground'>
                              {item.applied ? 'Applied' : 'Not applied'}
                            </div>
                          </TableCell>
                          <TableCell className='min-w-72 align-top text-xs'>
                            <div className='break-all'>
                              Item: {item.operationItemId}
                            </div>
                            <div className='mt-2 break-all text-muted-foreground'>
                              Idempotency: {item.idempotencyKey}
                            </div>
                            <Badge className='mt-2' variant='outline'>
                              {item.retrySafe
                                ? 'retry by operation id'
                                : 'fresh plan required'}
                            </Badge>
                          </TableCell>
                          <TableCell className='min-w-64 align-top'>
                            <div>{item.auditStatus}</div>
                            <div className='mt-2 text-muted-foreground'>
                              {item.recovery}
                            </div>
                          </TableCell>
                          <TableCell className='min-w-56 align-top'>
                            {item.nextAction}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              {actionPreview.action === 'reveal' ? (
                <Eye className='size-4' />
              ) : actionPreview.action === 'reset' ? (
                <RotateCcw className='size-4' />
              ) : actionPreview.action === 'delete' ? (
                <Trash2 className='size-4' />
              ) : (
                <SlidersHorizontal className='size-4' />
              )}
              {actionPreview.title}
            </CardTitle>
            <CardDescription>
              Selected row action preview. No apply occurs from this table
              without dry-run, audit reason, and explicit confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <Badge
              variant={
                actionPreview.requiresConfirmation ? 'outline' : 'secondary'
              }
            >
              {actionPreview.status}
            </Badge>
            <p>{actionPreview.preview}</p>
            <div className='rounded-md border bg-muted/40 p-3'>
              <div className='text-xs font-medium text-muted-foreground uppercase'>
                Next step
              </div>
              <div>{actionPreview.nextStep}</div>
            </div>
            {selectedActionReadinessDetail ? (
              <div className='grid gap-3 rounded-md border p-3 md:grid-cols-3'>
                <div>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Selected action readiness
                  </div>
                  <Badge
                    className='mt-1'
                    variant={
                      selectedActionReadinessDetail.canPreview
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {selectedActionReadinessDetail.badge}
                  </Badge>
                  <div className='mt-2 text-muted-foreground'>
                    {selectedActionReadinessDetail.nextStep}
                  </div>
                </div>
                <div>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Readiness blockers
                  </div>
                  {selectedActionReadinessDetail.blockers.length > 0 ? (
                    <div className='mt-2 flex flex-wrap gap-1'>
                      {selectedActionReadinessDetail.blockers.map((blocker) => (
                        <Badge key={blocker} variant='outline'>
                          {blocker}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className='mt-2 text-muted-foreground'>
                      No row-level blockers before the dry-run gate.
                    </div>
                  )}
                </div>
                <div>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Safe readiness checks
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {selectedActionReadinessDetail.safeChecks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            <div className='grid gap-3 rounded-md border p-3 md:grid-cols-3'>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Broker operation contract
                </div>
                <div className='mt-1 font-medium break-all'>
                  {singleOperationPlan.operationId}
                </div>
                <div className='mt-1 text-muted-foreground'>
                  {singleOperationPlan.endpoint}
                </div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Dry-run and policy
                </div>
                <div className='mt-1'>{singleOperationPlan.dryRunStatus}</div>
                <div className='mt-1 text-muted-foreground'>
                  {singleOperationPlan.policyDecision}
                </div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Submit gate
                </div>
                <Badge
                  className='mt-1'
                  variant={
                    singleOperationPlan.canSubmit ? 'default' : 'secondary'
                  }
                >
                  {singleOperationPlan.applyGate}
                </Badge>
                <div className='mt-2 flex flex-wrap gap-1'>
                  {singleOperationPlan.safePayloadFields.map((field) => (
                    <Badge key={field} variant='outline'>
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className='grid gap-3 md:grid-cols-2'>
              <div className='rounded-md border p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Immediate revalidation checks
                </div>
                <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                  {singleOperationPlan.revalidationChecks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Submit blockers
                </div>
                {singleOperationPlan.blockers.length > 0 ? (
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleOperationPlan.blockers.map((blocker) => (
                      <Badge key={blocker} variant='outline'>
                        {blocker}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className='mt-2 text-muted-foreground'>
                    No blockers after audit reason, confirmation, capability,
                    policy, and broker-state checks pass.
                  </div>
                )}
              </div>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button type='button' disabled>
                Apply disabled until dry-run preview is accepted
              </Button>
              <Badge variant='secondary'>Raw values hidden</Badge>
              <Badge variant='outline'>No copy/export</Badge>
              <Badge variant='outline'>No bulk mutation</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Single-secret preview gate</CardTitle>
            <CardDescription>
              Deterministic non-production status model for one selected ref.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div className='grid gap-4 lg:grid-cols-3'>
              <div className='rounded-lg border p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Selected ref
                </div>
                <div className='mt-1 font-medium break-all'>
                  {selectedRow.ref}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <label
                  htmlFor='stub-state'
                  className='text-xs font-medium text-muted-foreground uppercase'
                >
                  Stub API state
                </label>
                <select
                  id='stub-state'
                  className='mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm'
                  value={stubState}
                  onChange={(event) => {
                    setStubState(event.target.value as StubSecretMutationState)
                    setSingleApplyResult(null)
                  }}
                >
                  {stubSecretMutationStates.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Apply readiness
                </div>
                <Badge
                  className='mt-2'
                  variant={
                    stubMutationPreview.canApply ? 'default' : 'secondary'
                  }
                >
                  {stubMutationPreview.canApply
                    ? 'Stub apply can be simulated'
                    : 'Stub apply blocked'}
                </Badge>
              </div>
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='space-y-2'>
                <label
                  htmlFor='audit-reason'
                  className='text-sm font-medium text-muted-foreground'
                >
                  Audit reason for stub preview
                </label>
                <Input
                  id='audit-reason'
                  value={auditReason}
                  onChange={(event) => {
                    setAuditReason(event.target.value)
                    setSingleApplyResult(null)
                  }}
                  placeholder='Required before simulated apply; no secret values'
                />
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    checked={confirmed}
                    onChange={(event) => {
                      setConfirmed(event.target.checked)
                      setSingleApplyResult(null)
                    }}
                  />
                  I confirm this is a stub preview and no production mutation
                  will be performed.
                </label>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='mb-2 flex flex-wrap items-center gap-2'>
                  <Badge variant='outline'>{stubMutationPreview.badge}</Badge>
                  <Badge variant='secondary'>Stub API · preview only</Badge>
                </div>
                <div className='font-medium'>{stubMutationPreview.title}</div>
                <dl className='mt-3 grid gap-2 text-sm'>
                  <div>
                    <dt className='text-muted-foreground'>Dry-run status</dt>
                    <dd>{stubMutationPreview.dryRunStatus}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Apply status</dt>
                    <dd>{stubMutationPreview.applyStatus}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Policy decision</dt>
                    <dd>{stubMutationPreview.policyDecision}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Audit requirement</dt>
                    <dd>{stubMutationPreview.auditRequirement}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className='rounded-lg border p-3'>
              <div className='text-xs font-medium text-muted-foreground uppercase'>
                Metadata-only dry-run diff
              </div>
              <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                {stubMutationPreview.safeDiff.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className='mt-3 rounded-md border bg-muted/40 p-3'>
                {stubMutationPreview.nextStep}
              </div>
            </div>

            {singleApplyResult ? (
              <div className='rounded-lg border p-3'>
                <div className='mb-3 flex flex-wrap items-center gap-2'>
                  <CheckCircle2 className='size-4 text-primary' />
                  <div className='font-medium'>
                    Single-secret operation result: {singleApplyResult.outcome}
                  </div>
                  <Badge variant='secondary'>Metadata only</Badge>
                  <Badge variant='outline'>
                    {singleApplyResult.applied ? 'Applied' : 'Not applied'}
                  </Badge>
                </div>
                <div className='grid gap-3 md:grid-cols-3'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Operation ID
                    </div>
                    <div className='mt-1 break-all'>
                      {singleApplyResult.operationId}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Ref
                    </div>
                    <div className='mt-1 break-all'>
                      {singleApplyResult.ref}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Audit
                    </div>
                    <div className='mt-1'>{singleApplyResult.auditStatus}</div>
                  </div>
                </div>
                <div className='mt-3 rounded-md border bg-muted/40 p-3'>
                  <div>{singleApplyResult.resultStatus}</div>
                  <div className='mt-2 text-muted-foreground'>
                    {singleApplyResult.nextAction}
                  </div>
                </div>
                <div className='mt-3 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Recovery guidance
                    </div>
                    <div className='mt-1'>
                      {singleApplyResult.recoveryStatus}
                    </div>
                    <div className='mt-2 text-muted-foreground'>
                      {singleApplyResult.retryPolicy}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Recovery steps
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {singleApplyResult.recoverySteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <ul className='mt-3 list-disc space-y-1 ps-5 text-muted-foreground'>
                  {singleApplyResult.safetyRows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className='rounded-lg border p-3'>
              <div className='mb-3 flex flex-wrap items-center gap-2'>
                <ListChecks className='size-4 text-primary' />
                <div className='font-medium'>
                  Single-secret operation history
                </div>
                <Badge variant='secondary'>Metadata only</Badge>
                <Badge variant='outline'>
                  {singleOperationHistory.length} submitted
                </Badge>
              </div>
              {singleOperationHistory.length > 0 ? (
                <div className='overflow-x-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ref</TableHead>
                        <TableHead>Action / status</TableHead>
                        <TableHead>Audit event</TableHead>
                        <TableHead>Recovery</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {singleOperationHistory.map((entry) => (
                        <TableRow key={entry.auditEventId}>
                          <TableCell className='min-w-72 align-top'>
                            <div className='font-medium'>{entry.rowName}</div>
                            <div className='text-sm break-all text-muted-foreground'>
                              {entry.ref}
                            </div>
                            <div className='mt-2 text-xs text-muted-foreground'>
                              {entry.provider}
                            </div>
                          </TableCell>
                          <TableCell className='min-w-44 align-top'>
                            <Badge variant='outline'>{entry.action}</Badge>
                            <div className='mt-2'>{entry.statusBadge}</div>
                            <div className='text-xs text-muted-foreground'>
                              {entry.submittedAt}
                            </div>
                          </TableCell>
                          <TableCell className='min-w-72 align-top'>
                            <div className='break-all'>
                              {entry.auditEventId}
                            </div>
                            <div className='mt-2 text-xs break-all text-muted-foreground'>
                              {entry.policy}
                            </div>
                          </TableCell>
                          <TableCell className='min-w-64 align-top'>
                            <div>{entry.nextAction}</div>
                            <div className='mt-2 text-muted-foreground'>
                              {entry.recoveryStatus}
                            </div>
                            <div className='mt-2 text-xs text-muted-foreground'>
                              {entry.retryPolicy}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className='rounded-md border bg-muted/40 p-3 text-muted-foreground'>
                  No submitted stub operations yet. History will list refs,
                  operation ids, audit event ids, and next actions only.
                </div>
              )}
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                disabled={!stubMutationPreview.canApply}
                onClick={applySingleSecretOperation}
              >
                Simulate stub apply
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setAuditReason('')
                  setConfirmed(false)
                  setStubState('cancelled')
                  setSingleApplyResult(null)
                }}
              >
                Cancel stub preview
              </Button>
              <Badge variant='outline'>No plaintext editing</Badge>
              <Badge variant='outline'>Single-secret only</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guardrails</CardTitle>
            <CardDescription>
              Boundaries enforced by this operator surface.
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-2'>
            <Badge variant='outline'>No plaintext table editing</Badge>
            <Badge variant='outline'>No copy/export</Badge>
            <Badge variant='outline'>Dry-run first</Badge>
            <Badge variant='outline'>Audit reason required</Badge>
            <Badge variant='outline'>Raw values hidden</Badge>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
