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
import { Copy, SlidersHorizontal } from 'lucide-react'
import { copyText } from '@/lib/copy-text'
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
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

type VariablesProps = {
  service?: string
  keyFilter?: string
}

type VariableRow = {
  id: string
  key: string
  value: string
  scope: 'global' | 'service'
  secret: 'secret' | 'plain'
  source: string
  services: { id: string; name: string }[]
}

function VariablesLoading() {
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

const columns: ColumnDef<VariableRow>[] = [
  {
    accessorKey: 'key',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Key' />
    ),
    cell: ({ row }) => <span className='font-medium'>{row.original.key}</span>,
    enableHiding: false,
  },
  {
    id: 'value',
    accessorFn: (row) => row.value,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Value' />
    ),
    cell: ({ row }) => (
      <div className='flex items-start gap-2'>
        <span className='max-w-[320px] text-sm break-all text-muted-foreground'>
          {row.original.secret === 'secret' ? '••••••••' : row.original.value}
        </span>
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='size-7 shrink-0'
          title='Copy value'
          onClick={() => void copyText(row.original.value)}
        >
          <Copy className='size-3.5' />
        </Button>
      </div>
    ),
  },
  {
    id: 'scope',
    accessorFn: (row) => row.scope,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Scope' />
    ),
    cell: ({ row }) => <Badge variant='outline'>{row.original.scope}</Badge>,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'secret',
    accessorFn: (row) => row.secret,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Visibility' />
    ),
    cell: ({ row }) => (
      <Badge
        variant={row.original.secret === 'secret' ? 'secondary' : 'outline'}
      >
        {row.original.secret}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'source',
    accessorFn: (row) => row.source,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Source' />
    ),
    cell: ({ row }) => row.original.source,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'services',
    accessorFn: (row) => row.services.map((service) => service.name).join(', '),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Services' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-wrap gap-2'>
        {row.original.services.map((service) => (
          <Button
            key={service.id}
            variant='outline'
            size='sm'
            className='h-8'
            asChild
          >
            <Link to='/services/$serviceId' params={{ serviceId: service.id }}>
              {service.name}
            </Link>
          </Button>
        ))}
      </div>
    ),
  },
]

export function Variables({ service, keyFilter }: VariablesProps) {
  usePageMetadata({
    title: 'Service Admin - Variables',
    description: 'Service Admin environment variables and config values view.',
  })

  const servicesQuery = useServices()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'key', desc: false },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    keyFilter ? [{ id: 'key', value: keyFilter }] : []
  )

  const rows = useMemo<VariableRow[]>(() => {
    const services = (servicesQuery.data ?? []).filter(
      (item) => !service || item.id === service
    )
    const map = new Map<string, VariableRow>()

    for (const service of services) {
      for (const variable of service.environmentVariables) {
        const id = [
          variable.key,
          variable.value,
          variable.scope,
          variable.secret ? 'secret' : 'plain',
          variable.source ?? 'Not recorded',
        ].join('|')

        const existing = map.get(id)
        if (existing) {
          existing.services.push({ id: service.id, name: service.name })
          continue
        }

        map.set(id, {
          id,
          key: variable.key,
          value: variable.value,
          scope: variable.scope,
          secret: variable.secret ? 'secret' : 'plain',
          source: variable.source ?? 'Not recorded',
          services: [{ id: service.id, name: service.name }],
        })
      }
    }

    return Array.from(map.values())
  }, [service, servicesQuery.data])

  const sources = useMemo(
    () => Array.from(new Set(rows.map((row) => row.source))).sort(),
    [rows]
  )

  const table = useReactTable({
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
            <h2 className='text-2xl font-bold tracking-tight'>Variables</h2>
            <p className='text-muted-foreground'>
              Shared and service-local values in the standard operator table.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/installed'>Installed</Link>
            </Button>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <VariablesLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <SlidersHorizontal className='size-4' /> Environment variables
              </CardTitle>
              <CardDescription>
                {table.getFilteredRowModel().rows.length} variable rows shown
                across all services.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <DataTableToolbar
                table={table}
                searchPlaceholder='Search variable keys, values, sources, or services...'
                searchKey='key'
                filters={[
                  {
                    columnId: 'scope',
                    title: 'Scope',
                    options: [
                      { label: 'Global', value: 'global' },
                      { label: 'Service', value: 'service' },
                    ],
                  },
                  {
                    columnId: 'source',
                    title: 'Source',
                    options: sources.map((source) => ({
                      label: source,
                      value: source,
                    })),
                  },
                  {
                    columnId: 'secret',
                    title: 'Visibility',
                    options: [
                      { label: 'Secret', value: 'secret' },
                      { label: 'Plain', value: 'plain' },
                    ],
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
                          No variables match the current filters.
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
