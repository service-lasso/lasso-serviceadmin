import { useEffect, useMemo, useState } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
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
  Activity,
  AlertTriangle,
  Network,
  Search as SearchIcon,
  ShieldCheck,
  X,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { DependencyGraphCanvas } from '@/components/dependency-graph-canvas'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { LongText } from '@/components/long-text'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  buildSecretsBrokerTopology,
  filterSecretsBrokerTopology,
  type SecretVariableMappingRow,
  type SecretVariableMappingStatus,
  toReactFlowSecretsBrokerTopology,
} from './topology'

const route = getRouteApi('/_authenticated/secrets-broker/topology')

const mappingStatusLabels: Record<SecretVariableMappingStatus, string> = {
  mapped: 'Mapped',
  unmapped: 'Unmapped',
  'missing-source': 'Missing source',
  unknown: 'Unknown',
}

function MappingStatusBadge({
  status,
}: {
  status: SecretVariableMappingStatus
}) {
  if (status === 'mapped') {
    return <Badge className='bg-emerald-600 hover:bg-emerald-600'>Mapped</Badge>
  }

  if (status === 'missing-source') {
    return <Badge variant='destructive'>Missing source</Badge>
  }

  if (status === 'unmapped') {
    return <Badge variant='secondary'>Unmapped</Badge>
  }

  return <Badge variant='outline'>Unknown</Badge>
}

const mappingColumns: ColumnDef<SecretVariableMappingRow>[] = [
  {
    accessorKey: 'serviceName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Service' />
    ),
    cell: ({ row }) => (
      <div className='flex min-w-0 flex-col gap-1'>
        <Link
          to='/services/$serviceId'
          params={{ serviceId: row.original.serviceId }}
          className='truncate font-medium hover:underline'
        >
          {row.original.serviceName}
        </Link>
        <span className='text-xs text-muted-foreground'>
          {row.original.serviceId}
        </span>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: 'variableName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Variable' />
    ),
    cell: ({ row }) => (
      <div className='flex min-w-0 flex-col gap-1'>
        <span className='font-medium'>{row.original.variableName}</span>
        <span className='text-xs text-muted-foreground'>
          {row.original.scope}
        </span>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: 'secretRef',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='SecretRef' />
    ),
    cell: ({ row }) => (
      <LongText className='max-w-[320px] text-sm'>
        {row.original.secretRef}
      </LongText>
    ),
  },
  {
    accessorKey: 'provider',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Provider / source' />
    ),
    cell: ({ row }) => (
      <div className='flex min-w-0 flex-col gap-1'>
        <span>{row.original.provider}</span>
        <span className='text-xs text-muted-foreground'>
          {row.original.source}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => <MappingStatusBadge status={row.original.status} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'lastValidation',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Last validation' />
    ),
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground'>
        {row.original.lastValidation}
      </span>
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => (
      <div className='flex flex-wrap gap-2'>
        <Button asChild size='sm' variant='outline'>
          <Link
            to='/services/$serviceId'
            params={{ serviceId: row.original.serviceId }}
          >
            Service
          </Link>
        </Button>
        <Button asChild size='sm' variant='outline'>
          <Link to='/secrets-broker/sources'>Source</Link>
        </Button>
        <Button asChild size='sm' variant='outline'>
          <Link to='/secrets-broker/diagnostics'>Diagnostics</Link>
        </Button>
      </div>
    ),
    enableSorting: false,
  },
]

function SecretsBrokerTopologyTable({
  rows,
}: {
  rows: SecretVariableMappingRow[]
}) {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'serviceName', desc: false },
  ])

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { key: 'mapping' },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: mappingColumns,
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onPaginationChange,
    onColumnFiltersChange,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange,
    globalFilterFn: (row, _columnId, value) =>
      row.original.searchText.includes(String(value).toLowerCase()),
    getPaginationRowModel: getPaginationRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  useEffect(() => {
    ensurePageInRange(table.getPageCount())
  }, [table, ensurePageInRange])

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <DataTableToolbar
        table={table}
        searchPlaceholder='Search services, variables, refs, sources, and status...'
        filters={[
          {
            columnId: 'status',
            title: 'Status',
            options: Object.entries(mappingStatusLabels).map(
              ([value, label]) => ({ value, label })
            ),
          },
        ]}
      />
      <div className='overflow-hidden rounded-md border'>
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
                  colSpan={mappingColumns.length}
                  className='h-24 text-center'
                >
                  No secret variable mappings match the current filters.
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

function TopologyLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-52' />
        <Skeleton className='h-4 w-96' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[520px] w-full' />
      </CardContent>
    </Card>
  )
}

export function SecretsBrokerTopologyPage() {
  usePageMetadata({
    title: 'Service Admin - Secrets Broker Topology',
    description: 'Inspect safe service variable to SecretRef mapping metadata.',
  })

  const servicesQuery = useServices()
  const [topologySearchQuery, setTopologySearchQuery] = useState('')
  const topology = useMemo(
    () => buildSecretsBrokerTopology(servicesQuery.data ?? []),
    [servicesQuery.data]
  )
  const filteredTopology = useMemo(
    () => filterSecretsBrokerTopology(topology, topologySearchQuery),
    [topology, topologySearchQuery]
  )
  const graph = useMemo(
    () => toReactFlowSecretsBrokerTopology(filteredTopology),
    [filteredTopology]
  )
  const unmappedCount = topology.rows.filter(
    (row) => row.status !== 'mapped'
  ).length
  const hasTopologySearch = topologySearchQuery.trim().length > 0
  const topologyHasMatches =
    filteredTopology.nodes.length > 0 || filteredTopology.rows.length > 0

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
              Secrets Broker topology
            </h2>
            <p className='text-muted-foreground'>
              Service variables, SecretRef mappings, sources, and unmapped
              secret-like entries from the runtime service inventory.
            </p>
          </div>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <ShieldCheck className='size-4' />
            Values hidden
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <TopologyLoading />
        ) : (
          <>
            <div className='grid gap-3 md:grid-cols-4'>
              <Card>
                <CardContent className='p-4'>
                  <div className='text-xs text-muted-foreground'>Mappings</div>
                  <div className='text-2xl font-bold'>
                    {topology.rows.length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className='p-4'>
                  <div className='text-xs text-muted-foreground'>Mapped</div>
                  <div className='text-2xl font-bold'>
                    {topology.rows.length - unmappedCount}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className='p-4'>
                  <div className='text-xs text-muted-foreground'>
                    Needs action
                  </div>
                  <div className='text-2xl font-bold'>{unmappedCount}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className='flex items-center gap-2 p-4 text-sm text-muted-foreground'>
                  <Activity className='size-4' />
                  Runtime inventory source
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className='space-y-1'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div className='flex items-center gap-2 font-semibold'>
                    <Network className='size-4' />
                    Mapping graph
                  </div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='secondary'>Derived from table rows</Badge>
                    {hasTopologySearch ? (
                      <Badge variant='outline'>
                        {filteredTopology.nodes.length} of{' '}
                        {topology.nodes.length} nodes
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className='flex flex-col gap-2 pt-2 sm:flex-row sm:items-end sm:justify-between'>
                  <div className='min-w-0 flex-1 space-y-1'>
                    <label
                      htmlFor='secrets-topology-search'
                      className='text-xs font-medium text-muted-foreground'
                    >
                      Search topology
                    </label>
                    <div className='relative max-w-xl'>
                      <SearchIcon className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                      <Input
                        id='secrets-topology-search'
                        value={topologySearchQuery}
                        onChange={(event) =>
                          setTopologySearchQuery(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            setTopologySearchQuery('')
                          }
                        }}
                        placeholder='Search services, refs, providers, routes, or variables...'
                        className='ps-9 pe-10'
                        aria-describedby='secrets-topology-search-summary'
                      />
                      {hasTopologySearch ? (
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='absolute end-1 top-1/2 size-7 -translate-y-1/2'
                          onClick={() => setTopologySearchQuery('')}
                          aria-label='Clear topology search'
                        >
                          <X className='size-4' />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p
                    id='secrets-topology-search-summary'
                    className='text-sm text-muted-foreground'
                  >
                    Showing {filteredTopology.nodes.length} of{' '}
                    {topology.nodes.length} nodes and{' '}
                    {filteredTopology.edges.length} of {topology.edges.length}{' '}
                    relationships.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {topology.rows.length && topologyHasMatches ? (
                  <DependencyGraphCanvas
                    nodes={graph.nodes}
                    edges={graph.edges}
                    height={420}
                    draggable={false}
                    selectable={false}
                    showMiniMap={false}
                    legendItems={[
                      { label: 'mapped', color: '#16a34a' },
                      {
                        label: 'missing / unmapped',
                        color: '#f97316',
                        dashed: true,
                      },
                      { label: 'unknown', color: '#64748b', dashed: true },
                    ]}
                  />
                ) : hasTopologySearch ? (
                  <div className='flex min-h-[240px] items-center justify-center rounded-md border text-sm text-muted-foreground'>
                    No topology nodes or relationships match the current search.
                  </div>
                ) : (
                  <div className='flex min-h-[240px] items-center justify-center rounded-md border text-sm text-muted-foreground'>
                    No secret-like service variables were reported by the
                    runtime.
                  </div>
                )}
              </CardContent>
            </Card>

            {unmappedCount ? (
              <div className='flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100'>
                <AlertTriangle className='size-4' />
                {unmappedCount} secret-like variable
                {unmappedCount === 1 ? '' : 's'} need mapping review.
              </div>
            ) : null}

            <SecretsBrokerTopologyTable rows={filteredTopology.rows} />
          </>
        )}
      </Main>
    </>
  )
}
