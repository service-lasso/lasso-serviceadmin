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
import { ExternalLink, Route, ShieldCheck } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import type {
  DashboardService,
  ServiceEndpoint,
} from '@/lib/service-lasso-dashboard/types'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
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
import { LongText } from '@/components/long-text'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

const route = getRouteApi('/_authenticated/service-routes/')

type ServiceRouteRow = {
  id: string
  serviceId: string
  serviceName: string
  serviceStatus: DashboardService['status']
  routeLabel: string
  url: string
  bind: string
  port: number
  protocol: ServiceEndpoint['protocol']
  exposure: ServiceEndpoint['exposure']
  routeKind: 'Local' | 'LAN' | 'Traefik / public'
  searchText: string
}

const statusLabels: Record<DashboardService['status'], string> = {
  available: 'Available',
  degraded: 'Degraded',
  running: 'Running',
  stopped: 'Stopped',
}

const exposureLabels: Record<ServiceEndpoint['exposure'], string> = {
  lan: 'LAN',
  local: 'Local',
  public: 'Public',
}

function routeKindForExposure(exposure: ServiceEndpoint['exposure']) {
  if (exposure === 'public') return 'Traefik / public'
  if (exposure === 'lan') return 'LAN'
  return 'Local'
}

function buildServiceRouteRows(services: DashboardService[]) {
  return services.flatMap((service) =>
    service.endpoints.map((endpoint) => {
      const routeKind = routeKindForExposure(endpoint.exposure)
      const row: ServiceRouteRow = {
        id: `${service.id}:${endpoint.label}:${endpoint.url}`,
        serviceId: service.id,
        serviceName: service.name,
        serviceStatus: service.status,
        routeLabel: endpoint.label,
        url: endpoint.url,
        bind: endpoint.bind,
        port: endpoint.port,
        protocol: endpoint.protocol,
        exposure: endpoint.exposure,
        routeKind,
        searchText: '',
      }

      return {
        ...row,
        searchText: [
          service.id,
          service.name,
          endpoint.label,
          endpoint.url,
          endpoint.bind,
          endpoint.port,
          endpoint.protocol,
          endpoint.exposure,
          routeKind,
        ]
          .join(' ')
          .toLowerCase(),
      }
    })
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

  if (status === 'degraded') {
    return <Badge variant='secondary'>Degraded</Badge>
  }

  return <Badge variant='outline'>Stopped</Badge>
}

function ExposureBadge({
  exposure,
}: {
  exposure: ServiceEndpoint['exposure']
}) {
  if (exposure === 'public') {
    return <Badge className='bg-violet-600 hover:bg-violet-600'>Public</Badge>
  }

  if (exposure === 'lan') {
    return <Badge className='bg-cyan-700 hover:bg-cyan-700'>LAN</Badge>
  }

  return <Badge variant='outline'>Local</Badge>
}

const serviceRouteColumns: ColumnDef<ServiceRouteRow>[] = [
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
    accessorKey: 'routeLabel',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Route' />
    ),
    cell: ({ row }) => (
      <div className='flex min-w-0 flex-col gap-1'>
        <span className='font-medium'>{row.original.routeLabel}</span>
        <span className='text-xs text-muted-foreground'>
          {row.original.routeKind}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'serviceStatus',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => <StatusBadge status={row.original.serviceStatus} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'protocol',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Protocol' />
    ),
    cell: ({ row }) => row.original.protocol.toUpperCase(),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'bind',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Bind' />
    ),
    cell: ({ row }) => (
      <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>
        {row.original.bind}
      </code>
    ),
  },
  {
    accessorKey: 'port',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Port' />
    ),
    cell: ({ row }) => row.original.port,
  },
  {
    accessorKey: 'exposure',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Exposure' />
    ),
    cell: ({ row }) => <ExposureBadge exposure={row.original.exposure} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'url',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='URL' />
    ),
    cell: ({ row }) => (
      <div className='flex max-w-[360px] items-center gap-2'>
        <LongText className='text-sm text-muted-foreground'>
          {row.original.url}
        </LongText>
        <Button type='button' size='icon' variant='ghost' asChild>
          <a
            href={row.original.url}
            target='_blank'
            rel='noreferrer'
            title={`Open ${row.original.routeLabel}`}
          >
            <ExternalLink className='size-4' />
            <span className='sr-only'>Open {row.original.routeLabel}</span>
          </a>
        </Button>
      </div>
    ),
    enableSorting: false,
  },
]

function ServiceRoutesLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-40' />
        <Skeleton className='h-4 w-96' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[420px] w-full' />
      </CardContent>
    </Card>
  )
}

function RouteSummary({ rows }: { rows: ServiceRouteRow[] }) {
  const publicRoutes = rows.filter((row) => row.exposure === 'public').length
  const lanRoutes = rows.filter((row) => row.exposure === 'lan').length
  const localRoutes = rows.filter((row) => row.exposure === 'local').length

  return (
    <div className='grid gap-3 sm:grid-cols-3'>
      <Card>
        <CardHeader className='gap-2'>
          <CardDescription>Traefik / public</CardDescription>
          <CardTitle className='text-2xl'>{publicRoutes}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className='gap-2'>
          <CardDescription>LAN routes</CardDescription>
          <CardTitle className='text-2xl'>{lanRoutes}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className='gap-2'>
          <CardDescription>Local endpoints</CardDescription>
          <CardTitle className='text-2xl'>{localRoutes}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}

function ServiceRoutesTable({ rows }: { rows: ServiceRouteRow[] }) {
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
    globalFilter: { key: 'route' },
    columnFilters: [
      { columnId: 'serviceStatus', searchKey: 'status', type: 'array' },
      { columnId: 'protocol', searchKey: 'protocol', type: 'array' },
      { columnId: 'exposure', searchKey: 'exposure', type: 'array' },
    ],
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns: serviceRouteColumns,
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
        searchPlaceholder='Search services, URLs, binds, ports, and route labels...'
        filters={[
          {
            columnId: 'serviceStatus',
            title: 'Status',
            options: Object.entries(statusLabels).map(([value, label]) => ({
              value,
              label,
            })),
          },
          {
            columnId: 'protocol',
            title: 'Protocol',
            options: [
              { label: 'HTTP', value: 'http' },
              { label: 'HTTPS', value: 'https' },
              { label: 'TCP', value: 'tcp' },
            ],
          },
          {
            columnId: 'exposure',
            title: 'Exposure',
            options: Object.entries(exposureLabels).map(([value, label]) => ({
              value,
              label,
            })),
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
                  colSpan={serviceRouteColumns.length}
                  className='h-24 text-center'
                >
                  No service routes match the current filters.
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

export function ServiceRoutes() {
  usePageMetadata({
    title: 'Service Admin - Service Routes',
    description:
      'Service Admin route inventory for Service Lasso and Traefik-facing operators.',
  })

  const servicesQuery = useServices()
  const rows = useMemo(
    () => buildServiceRouteRows(servicesQuery.data ?? []),
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
            <h2 className='text-2xl font-bold tracking-tight'>
              Service routes
            </h2>
            <p className='text-muted-foreground'>
              Inspect each service endpoint, bind address, exposure level, and
              operator URL in one searchable table.
            </p>
          </div>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <ShieldCheck className='size-4' />
            Metadata only
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <ServiceRoutesLoading />
        ) : (
          <>
            <RouteSummary rows={rows} />
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Route className='size-5' />
                  Route inventory
                </CardTitle>
                <CardDescription>
                  Runtime and stub data stay value-safe: no env values, tokens,
                  or secret material are displayed on this page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ServiceRoutesTable rows={rows} />
              </CardContent>
            </Card>
          </>
        )}
      </Main>
    </>
  )
}
