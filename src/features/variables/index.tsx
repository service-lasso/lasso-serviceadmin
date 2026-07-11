import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  type ColumnDef,
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
import { Copy } from 'lucide-react'
import { copyText } from '@/lib/copy-text'
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import { cn } from '@/lib/utils'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
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

type VariablesProps = {
  service?: string
  search: Record<string, unknown>
  navigate: NavigateFn
}

type VariableRow = {
  id: string
  key: string
  value: string
  templateValue: string | null
  scope: 'global' | 'service'
  secret: 'secret' | 'plain'
  source: string
  services: { id: string; name: string }[]
  searchText: string
}

function VariablesLoading() {
  return (
    <div className='flex flex-1 flex-col gap-4'>
      <Skeleton className='h-10 w-full max-w-xl' />
      <Skeleton className='h-[420px] w-full' />
      <Skeleton className='mt-auto h-9 w-full max-w-md' />
    </div>
  )
}

const columns: ColumnDef<VariableRow>[] = [
  {
    accessorKey: 'key',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Key' />
    ),
    cell: ({ row }) => (
      <span
        className='block max-w-[220px] truncate font-medium'
        title={row.original.key}
      >
        {row.original.key}
      </span>
    ),
    enableHiding: false,
  },
  {
    id: 'value',
    accessorFn: (row) => row.value,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Resolved value' />
    ),
    cell: ({ row }) => (
      <div className='flex min-w-0 items-center gap-2'>
        <span
          className='block max-w-[320px] truncate text-sm text-muted-foreground'
          title={
            row.original.secret === 'secret' ? undefined : row.original.value
          }
        >
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
    id: 'templateValue',
    accessorFn: (row) => row.templateValue ?? '',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Template value' />
    ),
    cell: ({ row }) => {
      const displayValue =
        row.original.secret === 'secret'
          ? '••••••••'
          : (row.original.templateValue ?? 'Not recorded')

      return (
        <span
          className='block max-w-[320px] truncate text-sm text-muted-foreground'
          title={
            row.original.secret === 'secret'
              ? undefined
              : (row.original.templateValue ?? 'Not recorded')
          }
        >
          {displayValue}
        </span>
      )
    },
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
    cell: ({ row }) => (
      <span
        className='block max-w-[220px] truncate'
        title={row.original.source}
      >
        {row.original.source}
      </span>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'services',
    accessorFn: (row) => row.services.map((service) => service.name).join(', '),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Services' />
    ),
    cell: ({ row }) => {
      const visibleServices = row.original.services.slice(0, 2)
      const hiddenCount = row.original.services.length - visibleServices.length

      return (
        <div className='flex min-w-0 items-center gap-2 overflow-hidden'>
          {visibleServices.map((service) => (
            <Button
              key={service.id}
              variant='outline'
              size='sm'
              className='h-7 max-w-[150px] shrink truncate px-2'
              asChild
            >
              <Link
                to='/services/$serviceId'
                params={{ serviceId: service.id }}
                title={service.name}
              >
                {service.name}
              </Link>
            </Button>
          ))}
          {hiddenCount > 0 ? (
            <Badge variant='outline' className='shrink-0'>
              +{hiddenCount}
            </Badge>
          ) : null}
        </div>
      )
    },
  },
]

export function Variables({ service, search, navigate }: VariablesProps) {
  usePageMetadata({
    title: 'Service Admin - Variables',
    description: 'Service Admin environment variables and config values view.',
  })

  const servicesQuery = useServices()
  const focusedRowRef = useRef<HTMLTableRowElement | null>(null)
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'key', desc: false },
  ])
  const focusedVariableKey =
    typeof search.key === 'string' ? search.key : undefined

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
    globalFilter: { key: 'q' },
    columnFilters: [
      { columnId: 'key', searchKey: 'key', type: 'string' },
      { columnId: 'scope', searchKey: 'scope', type: 'array' },
      { columnId: 'source', searchKey: 'source', type: 'array' },
      { columnId: 'secret', searchKey: 'visibility', type: 'array' },
    ],
  })

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
          variable.templateValue ?? '',
          variable.scope,
          variable.secret ? 'secret' : 'plain',
          variable.source ?? 'Not recorded',
        ].join('|')

        const existing = map.get(id)
        if (existing) {
          const serviceRef = { id: service.id, name: service.name }
          existing.services.push(serviceRef)
          existing.searchText = [
            existing.searchText,
            serviceRef.id,
            serviceRef.name,
          ]
            .join(' ')
            .toLowerCase()
          continue
        }

        const safeValue = variable.secret ? '' : variable.value
        const safeTemplateValue = variable.secret
          ? ''
          : (variable.templateValue ?? '')
        const serviceRef = { id: service.id, name: service.name }

        map.set(id, {
          id,
          key: variable.key,
          value: variable.value,
          templateValue: variable.templateValue ?? null,
          scope: variable.scope,
          secret: variable.secret ? 'secret' : 'plain',
          source: variable.source ?? 'Not recorded',
          services: [serviceRef],
          searchText: [
            variable.key,
            safeValue,
            safeTemplateValue,
            variable.scope,
            variable.secret ? 'secret' : 'plain',
            variable.source ?? 'Not recorded',
            serviceRef.id,
            serviceRef.name,
          ]
            .join(' ')
            .toLowerCase(),
        })
      }
    }

    return Array.from(map.values())
  }, [service, servicesQuery.data])

  const sources = useMemo(
    () => Array.from(new Set(rows.map((row) => row.source))).sort(),
    [rows]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onPaginationChange,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue ?? '')
        .trim()
        .toLowerCase()
      if (!query) return true
      return row.original.searchText.includes(query)
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  useEffect(() => {
    ensurePageInRange(table.getPageCount())
  }, [table, ensurePageInRange])

  const visibleFocusedRowId = focusedVariableKey
    ? table
        .getRowModel()
        .rows.find((row) => row.original.key === focusedVariableKey)?.id
    : undefined

  useEffect(() => {
    if (!visibleFocusedRowId) return

    focusedRowRef.current?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
    })
    focusedRowRef.current?.focus({ preventScroll: true })
  }, [visibleFocusedRowId])

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

      <Main fixed className='min-h-0 gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-end gap-2'>
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
          <div className='flex min-h-0 flex-1 flex-col gap-4'>
            <DataTableToolbar
              table={table}
              searchPlaceholder='Search variable keys, values, sources, or services...'
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

            <div
              className='min-h-[320px] flex-1 overflow-auto rounded-md border'
              data-testid='variables-table-scroll-region'
            >
              <Table className='table-fixed'>
                <TableHeader className='sticky top-0 z-10 bg-background'>
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
                    table.getRowModel().rows.map((row) => {
                      const isFocused = row.id === visibleFocusedRowId

                      return (
                        <TableRow
                          key={row.id}
                          ref={isFocused ? focusedRowRef : undefined}
                          className={cn(
                            'group/row outline-none',
                            isFocused &&
                              'ring-2 ring-primary/55 ring-offset-2 ring-offset-background'
                          )}
                          tabIndex={isFocused ? -1 : undefined}
                          data-variable-focused={isFocused ? 'true' : undefined}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              className={cn(
                                'min-w-0 bg-background align-top group-hover/row:bg-muted',
                                isFocused &&
                                  'bg-primary/10 group-hover/row:bg-primary/15',
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
                      )
                    })
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
          </div>
        )}
      </Main>
    </>
  )
}
