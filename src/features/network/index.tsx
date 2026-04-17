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
import { Copy, ExternalLink, Network as NetworkIcon } from 'lucide-react'
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

type NetworkRow = {
  id: string
  service: DashboardService
  endpoint: DashboardService['endpoints'][number]
}

function NetworkLoading() {
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

const columns: ColumnDef<NetworkRow>[] = [
  {
    id: 'serviceName',
    accessorFn: (row) => row.service.name,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Service' />
    ),
    cell: ({ row }) => (
      <div className='flex min-w-0 flex-col'>
        <Link
          to='/services/$serviceId'
          params={{ serviceId: row.original.service.id }}
          className='truncate font-medium hover:underline'
        >
          {row.original.service.name}
        </Link>
        <span className='text-xs text-muted-foreground'>
          {row.original.service.id}
        </span>
      </div>
    ),
    enableHiding: false,
  },
  {
    id: 'label',
    accessorFn: (row) => row.endpoint.label,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Endpoint' />
    ),
    cell: ({ row }) => row.original.endpoint.label,
  },
  {
    id: 'url',
    accessorFn: (row) => row.endpoint.url,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='URL' />
    ),
    cell: ({ row }) => (
      <div className='flex items-start gap-2'>
        <span className='max-w-[360px] text-sm break-all text-muted-foreground'>
          {row.original.endpoint.url}
        </span>
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='size-7 shrink-0'
          title='Copy URL'
          onClick={() => void copyText(row.original.endpoint.url)}
        >
          <Copy className='size-3.5' />
        </Button>
        <Button
          variant='outline'
          size='icon'
          className='size-7 shrink-0'
          asChild
        >
          <a href={row.original.endpoint.url} target='_blank' rel='noreferrer'>
            <ExternalLink className='size-3.5' />
          </a>
        </Button>
      </div>
    ),
  },
  {
    id: 'bind',
    accessorFn: (row) => row.endpoint.bind,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Bind' />
    ),
    cell: ({ row }) => row.original.endpoint.bind,
  },
  {
    id: 'port',
    accessorFn: (row) => row.endpoint.port,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Port' />
    ),
    cell: ({ row }) => row.original.endpoint.port,
  },
  {
    id: 'protocol',
    accessorFn: (row) => row.endpoint.protocol,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Protocol' />
    ),
    cell: ({ row }) => row.original.endpoint.protocol,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'exposure',
    accessorFn: (row) => row.endpoint.exposure,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Exposure' />
    ),
    cell: ({ row }) => (
      <Badge variant='outline'>{row.original.endpoint.exposure}</Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
]

export function Network() {
  usePageMetadata({
    title: 'Service Admin - Network',
    description: 'Service Admin network endpoints and exposure view.',
  })

  const servicesQuery = useServices()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'serviceName', desc: false },
    { id: 'label', desc: false },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const rows = useMemo<NetworkRow[]>(() => {
    return (servicesQuery.data ?? []).flatMap((service) =>
      service.endpoints.map((endpoint, index) => ({
        id: `${service.id}-${endpoint.label}-${index}`,
        service,
        endpoint,
      }))
    )
  }, [servicesQuery.data])

  const protocols = useMemo(
    () => Array.from(new Set(rows.map((row) => row.endpoint.protocol))).sort(),
    [rows]
  )

  const table = useReactTable<NetworkRow>({
    data: rows,
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
            <h2 className='text-2xl font-bold tracking-tight'>Network</h2>
            <p className='text-muted-foreground'>
              Endpoints and exposure facts in the standard operator table.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/runtime'>Runtime</Link>
            </Button>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <NetworkLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <NetworkIcon className='size-4' /> Service endpoints
              </CardTitle>
              <CardDescription>
                {table.getFilteredRowModel().rows.length} endpoints shown with
                copy and open actions.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <DataTableToolbar
                table={table}
                searchPlaceholder='Search services, URLs, binds, ports, or exposure...'
                searchKey='serviceName'
                filters={[
                  {
                    columnId: 'exposure',
                    title: 'Exposure',
                    options: [
                      { label: 'Local', value: 'local' },
                      { label: 'LAN', value: 'lan' },
                      { label: 'Public', value: 'public' },
                    ],
                  },
                  {
                    columnId: 'protocol',
                    title: 'Protocol',
                    options: protocols.map((protocol) => ({
                      label: protocol,
                      value: protocol,
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
                          No endpoints match the current filters.
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
