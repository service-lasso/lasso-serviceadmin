import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
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
import { cn } from '@/lib/utils'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTableColumnHeader,
  DataTablePagination,
  DataTableToolbar,
} from '@/components/data-table'
import {
  type SecretInventoryRow,
  type SecretInventorySource,
  type SecretInventoryState,
} from './secret-inventory'

const stateVariant: Record<
  SecretInventoryState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  present: 'default',
  missing: 'destructive',
  stale: 'secondary',
  'rotation-due': 'outline',
}

const stateOptions: Array<{ label: string; value: SecretInventoryState }> = [
  { label: 'Present', value: 'present' },
  { label: 'Rotation due', value: 'rotation-due' },
  { label: 'Stale', value: 'stale' },
  { label: 'Missing', value: 'missing' },
]

const sourceOptions: Array<{ label: string; value: SecretInventorySource }> = [
  { label: 'Local encrypted store', value: 'local encrypted store' },
  { label: 'Provider connection', value: 'provider connection' },
  { label: 'File source', value: 'file source' },
  { label: 'Generated write-back', value: 'generated write-back' },
]

const columns: ColumnDef<SecretInventoryRow>[] = [
  {
    id: 'ref',
    accessorFn: (row) =>
      [
        row.namespace,
        row.refId,
        row.owningService,
        row.workspace,
        row.backend,
        row.safeNotes,
      ].join(' '),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Namespace / ref' />
    ),
    cell: ({ row }) => (
      <div className='min-w-72 align-top'>
        <div className='font-medium'>{row.original.namespace}</div>
        <div className='text-sm break-all text-muted-foreground'>
          {row.original.refId}
        </div>
        <div className='mt-2 text-xs text-muted-foreground'>
          {row.original.safeNotes}
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
    accessorKey: 'source',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Source / backend' />
    ),
    cell: ({ row }) => (
      <div className='min-w-56 align-top'>
        <Badge variant='outline'>{row.original.source}</Badge>
        <div className='mt-2 text-sm text-muted-foreground'>
          {row.original.backend}
        </div>
      </div>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'owningService',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Owner' />
    ),
    cell: ({ row }) => (
      <div className='min-w-44 align-top'>
        <div className='font-medium'>{row.original.owningService}</div>
        <div className='text-sm text-muted-foreground'>
          {row.original.workspace}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'presenceState',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='State' />
    ),
    cell: ({ row }) => (
      <Badge variant={stateVariant[row.original.presenceState]}>
        {row.original.presenceState}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'rotationStatus',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Key / rotation' />
    ),
    cell: ({ row }) => (
      <div className='min-w-48 align-top'>
        <div>{row.original.keyVersion}</div>
        <div className='text-sm text-muted-foreground'>
          {row.original.rotationStatus}
        </div>
        <div className='text-xs text-muted-foreground'>
          Expiry: {row.original.expiry}
        </div>
      </div>
    ),
  },
  {
    accessorKey: 'lastUpdated',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Last updated / used' />
    ),
    cell: ({ row }) => (
      <div className='min-w-52 align-top text-sm'>
        <div>Updated: {row.original.lastUpdated}</div>
        <div className='text-muted-foreground'>
          Used: {row.original.lastUsed}
        </div>
      </div>
    ),
  },
  {
    id: 'links',
    header: 'Metadata links',
    cell: ({ row }) => (
      <div className='min-w-48 align-top'>
        <div className='space-y-1 text-sm'>
          {row.original.providerConnectionUrl ? (
            <Link
              to={row.original.providerConnectionUrl}
              className='block text-primary underline-offset-4 hover:underline'
            >
              provider metadata
            </Link>
          ) : null}
          <Link
            to={row.original.refUsageUrl}
            className='block text-primary underline-offset-4 hover:underline'
          >
            ref usage
          </Link>
          <Link
            to={row.original.auditUrl}
            className='block text-primary underline-offset-4 hover:underline'
          >
            audit events
          </Link>
        </div>
        <div className='mt-2 text-xs text-muted-foreground'>
          Unavailable: {row.original.unavailableActions.join(', ')}
        </div>
      </div>
    ),
    enableSorting: false,
  },
]

type SecretInventoryTableProps = {
  data: SecretInventoryRow[]
  search: Record<string, unknown>
  navigate: NavigateFn
}

export function SecretInventoryTable({
  data,
  search,
  navigate,
}: SecretInventoryTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'presenceState', desc: false },
  ])

  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { enabled: false },
    columnFilters: [
      { columnId: 'ref', searchKey: 'ref', type: 'string' },
      { columnId: 'presenceState', searchKey: 'state', type: 'array' },
      { columnId: 'source', searchKey: 'source', type: 'array' },
    ],
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
      columnFilters,
      columnVisibility,
    },
    onPaginationChange,
    onColumnFiltersChange,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
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
        searchPlaceholder='Search secret refs, owners, backends, and notes...'
        searchKey='ref'
        filters={[
          {
            columnId: 'presenceState',
            title: 'State',
            options: stateOptions,
          },
          {
            columnId: 'source',
            title: 'Source',
            options: sourceOptions,
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
                  No secret refs match the current filters.
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
