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
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { LongText } from '@/components/long-text'
import { usePageToolbar } from '@/components/page-toolbar'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  buildSecretsBrokerTopology,
  type SecretVariableMappingRow,
  type SecretVariableMappingStatus,
} from './topology'

const route = getRouteApi('/_authenticated/secrets-broker/review')

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
          <Link to='/secrets-broker/sources'>Provider status</Link>
        </Button>
      </div>
    ),
    enableSorting: false,
  },
]

function SecretsBrokerReviewTable({
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

function ReviewLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-52' />
        <Skeleton className='h-4 w-96' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[420px] w-full' />
      </CardContent>
    </Card>
  )
}

/**
 * Secrets Broker Review page: mapping table only.
 */
export function SecretsBrokerReviewPage() {
  usePageMetadata({
    title: 'Service Admin - Secrets Broker Review',
    description: 'Review SecretRef mappings without the topology graph.',
  })
  usePageToolbar({
    quickNav: [
      { id: 'topology', label: 'Topology', to: '/secrets-broker/topology' },
      { id: 'providers', label: 'Providers', to: '/secrets-broker/sources' },
    ],
  })

  const servicesQuery = useServices()
  const rows = useMemo(
    () => buildSecretsBrokerTopology(servicesQuery.data ?? []).rows,
    [servicesQuery.data]
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
        {servicesQuery.isLoading ? (
          <ReviewLoading />
        ) : (
          <SecretsBrokerReviewTable rows={rows} />
        )}
      </Main>
    </>
  )
}
