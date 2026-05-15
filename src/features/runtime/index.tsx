import { useMemo, useState } from 'react'
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
import { Activity } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

function RuntimeLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-44' />
        <Skeleton className='h-4 w-96' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[420px] w-full' />
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: DashboardService['status'] }) {
  if (status === 'running') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Running</Badge>
    )
  }
  if (status === 'available') {
    return <Badge className='bg-sky-600 hover:bg-sky-600'>Available</Badge>
  }
  if (status === 'degraded') return <Badge variant='secondary'>Degraded</Badge>
  return <Badge variant='outline'>Stopped</Badge>
}

const statusSortRank: Record<DashboardService['status'], number> = {
  degraded: 0,
  stopped: 1,
  available: 2,
  running: 3,
}

const columns: ColumnDef<DashboardService>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Service' />
    ),
    cell: ({ row }) => (
      <div className='flex max-w-[180px] min-w-0 flex-col'>
        <Link
          to='/services/$serviceId'
          params={{ serviceId: row.original.id }}
          className='truncate font-medium hover:underline'
          title={row.original.name}
        >
          {row.original.name}
        </Link>
        <span
          className='truncate text-xs text-muted-foreground'
          title={row.original.id}
        >
          {row.original.id}
        </span>
      </div>
    ),
    enableHiding: false,
  },
  {
    id: 'status',
    accessorFn: (row) => row.status,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    sortingFn: (rowA, rowB, columnId) =>
      statusSortRank[rowA.getValue(columnId) as DashboardService['status']] -
      statusSortRank[rowB.getValue(columnId) as DashboardService['status']],
  },
  {
    id: 'runtime',
    accessorFn: (row) => row.role,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Runtime' />
    ),
    cell: ({ row }) => (
      <div className='max-w-[220px] truncate' title={row.original.role}>
        {row.original.role}
      </div>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'summary',
    accessorFn: (row) => row.runtimeHealth.summary,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Summary' />
    ),
    cell: ({ row }) => (
      <div className='max-w-[320px] min-w-0'>
        <div
          className='overflow-hidden text-sm text-ellipsis whitespace-nowrap text-muted-foreground'
          title={row.original.runtimeHealth.summary}
        >
          {row.original.runtimeHealth.summary}
        </div>
      </div>
    ),
  },
  {
    id: 'uptime',
    accessorFn: (row) => row.runtimeHealth.uptime,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Uptime' />
    ),
    cell: ({ row }) => (
      <div className='whitespace-nowrap'>
        {row.original.runtimeHealth.uptime}
      </div>
    ),
  },
  {
    id: 'lastCheckAt',
    accessorFn: (row) => row.runtimeHealth.lastCheckAt,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Last check' />
    ),
    cell: ({ row }) => (
      <div
        className='max-w-[190px] truncate whitespace-nowrap'
        title={row.original.runtimeHealth.lastCheckAt}
      >
        {row.original.runtimeHealth.lastCheckAt}
      </div>
    ),
  },
  {
    id: 'lastRestartAt',
    accessorFn: (row) => row.runtimeHealth.lastRestartAt ?? 'Not recorded',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Last restart' />
    ),
    cell: ({ row }) => {
      const value = row.original.runtimeHealth.lastRestartAt ?? 'Not recorded'
      return (
        <div className='max-w-[190px] truncate whitespace-nowrap' title={value}>
          {value}
        </div>
      )
    },
  },
]

export function Runtime() {
  usePageMetadata({
    title: 'Service Admin - Runtime',
    description: 'Service Admin runtime status and health view.',
  })

  const servicesQuery = useServices()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'status', desc: false },
    { id: 'name', desc: false },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data: servicesQuery.data ?? [],
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const unhealthyCount = useMemo(
    () =>
      (servicesQuery.data ?? []).filter(
        (service) => service.runtimeHealth.health !== 'healthy'
      ).length,
    [servicesQuery.data]
  )

  const runtimes = useMemo(
    () =>
      Array.from(
        new Set((servicesQuery.data ?? []).map((service) => service.role))
      ).sort(),
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
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Runtime</h2>
            <p className='text-muted-foreground'>
              Runtime state, health, and check history in the standard operator
              table.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/logs'>Logs</Link>
            </Button>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <RuntimeLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Activity className='size-4' /> Runtime status
              </CardTitle>
              <CardDescription>
                {table.getFilteredRowModel().rows.length} services shown,{' '}
                {unhealthyCount} with warning or critical health.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <DataTableToolbar
                table={table}
                searchPlaceholder='Search services, summaries, checks, or runtime...'
                searchKey='name'
                filters={[
                  {
                    columnId: 'status',
                    title: 'Status',
                    options: [
                      { label: 'Running', value: 'running' },
                      { label: 'Available', value: 'available' },
                      { label: 'Degraded', value: 'degraded' },
                      { label: 'Stopped', value: 'stopped' },
                    ],
                  },
                  {
                    columnId: 'runtime',
                    title: 'Runtime',
                    options: runtimes.map((runtime) => ({
                      label: runtime,
                      value: runtime,
                    })),
                  },
                ]}
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
                          No runtime rows match the current filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <DataTablePagination table={table} className='mt-auto' />
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}

