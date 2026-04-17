import { type ElementType, useMemo, useState } from 'react'
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
import { Copy, FolderCog, PackageCheck, ScanSearch } from 'lucide-react'
import { copyText } from '@/lib/copy-text'
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

function PathCell({ icon, value }: { icon: ElementType; value?: string }) {
  const Icon = icon
  const displayValue = value ?? 'Not recorded'

  return (
    <div className='flex min-w-0 items-start gap-2'>
      <Icon className='mt-1 size-4 shrink-0 text-muted-foreground' />
      <div className='min-w-0 flex-1'>
        <span
          className='block truncate text-sm text-muted-foreground'
          title={displayValue}
        >
          {displayValue}
        </span>
      </div>
      <Button
        type='button'
        variant='outline'
        size='icon'
        className='size-7 shrink-0'
        title='Copy value'
        disabled={!value}
        onClick={() => {
          if (value) void copyText(value)
        }}
      >
        <Copy className='size-3.5' />
        <span className='sr-only'>Copy value</span>
      </Button>
    </div>
  )
}

function InstalledLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-40' />
        <Skeleton className='h-4 w-80' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[420px] w-full' />
      </CardContent>
    </Card>
  )
}

const columns: ColumnDef<DashboardService>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Service' />
    ),
    cell: ({ row }) => (
      <div className='flex min-w-0 flex-col'>
        <Link
          to='/services/$serviceId'
          params={{ serviceId: row.original.id }}
          className='truncate font-medium hover:underline'
        >
          {row.original.name}
        </Link>
        <span className='text-xs text-muted-foreground'>{row.original.id}</span>
      </div>
    ),
    enableHiding: false,
  },
  {
    id: 'installed',
    accessorFn: (row) => (row.installed ? 'installed' : 'missing'),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Installed' />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.installed ? 'default' : 'outline'}>
        {row.original.installed ? 'Installed' : 'Missing'}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'runtime',
    accessorFn: (row) => row.metadata.runtime,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Runtime' />
    ),
    cell: ({ row }) => row.original.metadata.runtime,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'version',
    accessorFn: (row) => row.metadata.version,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Version' />
    ),
    cell: ({ row }) => row.original.metadata.version,
  },
  {
    id: 'packageId',
    accessorFn: (row) => row.metadata.packageId ?? 'Not recorded',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Package' />
    ),
    cell: ({ row }) => row.original.metadata.packageId ?? 'Not recorded',
  },
  {
    id: 'installPath',
    accessorFn: (row) => row.metadata.installPath ?? '',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Install path' />
    ),
    cell: ({ row }) => (
      <PathCell icon={PackageCheck} value={row.original.metadata.installPath} />
    ),
  },
  {
    id: 'configPath',
    accessorFn: (row) => row.metadata.configPath ?? '',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Config path' />
    ),
    cell: ({ row }) => (
      <PathCell icon={FolderCog} value={row.original.metadata.configPath} />
    ),
  },
  {
    id: 'dataPath',
    accessorFn: (row) => row.metadata.dataPath ?? '',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Data path' />
    ),
    cell: ({ row }) => (
      <PathCell icon={ScanSearch} value={row.original.metadata.dataPath} />
    ),
  },
]

export function Installed() {
  usePageMetadata({
    title: 'Service Admin - Installed',
    description: 'Service Admin installed services and paths view.',
  })

  const servicesQuery = useServices()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'installed', desc: false },
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

  const runtimes = useMemo(
    () =>
      Array.from(
        new Set(
          (servicesQuery.data ?? []).map((service) => service.metadata.runtime)
        )
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
            <h2 className='text-2xl font-bold tracking-tight'>Installed</h2>
            <p className='text-muted-foreground'>
              Installed services and paths in the standard operator table.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/network'>Network</Link>
            </Button>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <InstalledLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <PackageCheck className='size-4' /> Installed services
              </CardTitle>
              <CardDescription>
                {table.getFilteredRowModel().rows.length} services shown with
                package, version, and path details.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <DataTableToolbar
                table={table}
                searchPlaceholder='Search services, packages, versions, or paths...'
                searchKey='name'
                filters={[
                  {
                    columnId: 'installed',
                    title: 'Installed',
                    options: [
                      { label: 'Installed', value: 'installed' },
                      { label: 'Missing', value: 'missing' },
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
                <Table>
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
                            <TableCell key={cell.id}>
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
                          No installed services match the current filters.
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
