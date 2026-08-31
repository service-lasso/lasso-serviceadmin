import { useMemo, useState } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
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
import { Copy, ExternalLink } from 'lucide-react'
import { copyText } from '@/lib/copy-text'
import { usePageMetadata } from '@/lib/page-metadata'
import { renderServiceEndpointUrl } from '@/lib/service-lasso-dashboard/access-host-urls'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
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
  DataTableScrollRegion,
  DataTableToolbar,
  dataTableStickyHeaderClassName,
} from '@/components/data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { HeaderActions, usePageToolbar } from '@/components/page-toolbar'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

type NetworkRow = {
  id: string
  service: DashboardService
  endpoint: DashboardService['endpoints'][number]
  url: string
}

const route = getRouteApi('/_authenticated/network/')

/**
 * Keep only endpoints that belong to the service id from search params.
 */
function networkRowsForService(
  rows: NetworkRow[],
  serviceId: string | undefined
): NetworkRow[] {
  const normalized = serviceId?.trim() ?? ''
  if (!normalized) {
    return rows
  }
  return rows.filter((row) => row.service.id === normalized)
}

const nonServiceEndpointLabelTerms = [
  'artifact',
  'download',
  'docs',
  'documentation',
  'homepage',
  'metadata',
  'release',
  'source',
  'vendor',
]

const nonServiceEndpointPathTerms = [
  '/artifact',
  '/artifacts',
  '/download',
  '/downloads',
  '/docs',
  '/documentation',
  '/manual',
  '/metadata',
  '/release',
  '/releases',
]

const artifactExtensions = new Set([
  '.7z',
  '.deb',
  '.dmg',
  '.exe',
  '.gz',
  '.msi',
  '.pkg',
  '.rpm',
  '.tar',
  '.tgz',
  '.zip',
])

function isOperatorNetworkEndpoint(
  endpoint: DashboardService['endpoints'][number]
) {
  const label = endpoint.label.toLowerCase()

  if (nonServiceEndpointLabelTerms.some((term) => label.includes(term))) {
    return false
  }

  if (!endpoint.url) {
    return true
  }

  try {
    const parsed = new URL(endpoint.url)
    const pathname = parsed.pathname.toLowerCase()
    const urlParts = `${pathname}${parsed.search.toLowerCase()}${parsed.hash.toLowerCase()}`

    if (nonServiceEndpointPathTerms.some((term) => urlParts.includes(term))) {
      return false
    }

    if (artifactExtensions.has(pathname.slice(pathname.lastIndexOf('.')))) {
      return false
    }
  } catch {
    return true
  }

  return true
}

function NetworkLoading() {
  return (
    <div className='flex flex-1 flex-col gap-4'>
      <Skeleton className='h-10 w-full max-w-md' />
      <Skeleton className='min-h-[420px] w-full flex-1' />
    </div>
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
    accessorFn: (row) => row.url,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='URL' />
    ),
    cell: ({ row }) => (
      <div className='flex items-start gap-2'>
        <span className='max-w-[360px] text-sm break-all text-muted-foreground'>
          {row.original.url}
        </span>
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='size-7 shrink-0'
          title='Copy URL'
          onClick={() => void copyText(row.original.url)}
        >
          <Copy className='size-3.5' />
        </Button>
        <Button
          variant='outline'
          size='icon'
          className='size-7 shrink-0'
          asChild
        >
          <a href={row.original.url} target='_blank' rel='noreferrer'>
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
  usePageToolbar({
    quickNav: [
      { id: 'services', label: 'Services', to: '/services' },
      { id: 'runtime', label: 'Runtime', to: '/runtime' },
    ],
  })

  const searchState = route.useSearch()
  const servicesQuery = useServices()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'serviceName', desc: false },
    { id: 'label', desc: false },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const rows = useMemo<NetworkRow[]>(() => {
    const allRows = (servicesQuery.data ?? []).flatMap((service) =>
      service.endpoints
        .filter(isOperatorNetworkEndpoint)
        .map((endpoint, index) => ({
          id: `${service.id}-${endpoint.label}-${index}`,
          service,
          endpoint,
          url: renderServiceEndpointUrl(endpoint),
        }))
    )
    return networkRowsForService(allRows, searchState.service)
  }, [searchState.service, servicesQuery.data])

  const protocols = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.endpoint.protocol)
            .filter((protocol): protocol is string => Boolean(protocol))
        )
      ).sort(),
    [rows]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
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
        <HeaderActions>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </HeaderActions>
      </Header>

      <Main fixed className='min-h-0 gap-4 sm:gap-6'>
        <div className='shrink-0'>
          <h2 className='text-2xl font-bold tracking-tight'>Network</h2>
          <p className='text-muted-foreground'>
            Endpoints and exposure facts in the standard operator table.
          </p>
        </div>
        {servicesQuery.isLoading ? (
          <NetworkLoading />
        ) : (
          <div className='flex min-h-0 flex-1 flex-col gap-4'>
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

            <DataTableScrollRegion>
              <Table contained={false}>
                <TableHeader className={dataTableStickyHeaderClassName}>
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
            </DataTableScrollRegion>

            <DataTablePagination table={table} className='mt-auto' />
          </div>
        )}
      </Main>
    </>
  )
}
