import { useEffect, useState } from 'react'
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
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
import type { SecretAccessAssignmentRow } from '@/lib/service-lasso-dashboard/secret-access-policy'
import { cn } from '@/lib/utils'
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

const statusLabels: Record<SecretAccessAssignmentRow['status'], string> = {
  assigned: 'Assigned',
  missing: 'Missing',
  malformed: 'Malformed',
}

function AssignmentStatusBadge({
  status,
}: {
  status: SecretAccessAssignmentRow['status']
}) {
  if (status === 'assigned') {
    return <Badge className='bg-emerald-600 hover:bg-emerald-600'>Assigned</Badge>
  }
  if (status === 'malformed') {
    return <Badge variant='destructive'>Malformed</Badge>
  }
  return <Badge variant='destructive'>Missing</Badge>
}

const columns: ColumnDef<SecretAccessAssignmentRow>[] = [
  {
    id: 'query',
    accessorFn: (row) =>
      [
        row.serviceId,
        row.workspace ?? '',
        row.namespace,
        row.refsLabel,
        row.operationsLabel,
        row.purpose,
        row.status,
      ].join(' '),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Service' />
    ),
    cell: ({ row }) => (
      <div className='min-w-40'>
        <div className='font-medium'>{row.original.serviceId}</div>
        {row.original.workspace ? (
          <div className='text-xs text-muted-foreground'>
            {row.original.workspace}
          </div>
        ) : null}
      </div>
    ),
    filterFn: (row, id, value) =>
      String(row.getValue(id))
        .toLowerCase()
        .includes(String(value).toLowerCase()),
    enableHiding: false,
  },
  {
    accessorKey: 'namespace',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Namespace' />
    ),
    cell: ({ row }) => (
      <div className='font-mono text-sm break-all'>{row.original.namespace}</div>
    ),
  },
  {
    accessorKey: 'refsLabel',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Refs' />
    ),
    cell: ({ row }) => (
      <div className='font-mono text-sm break-all'>{row.original.refsLabel}</div>
    ),
  },
  {
    accessorKey: 'operationsLabel',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Operations' />
    ),
    cell: ({ row }) => (
      <div className='text-sm'>{row.original.operationsLabel}</div>
    ),
  },
  {
    accessorKey: 'purpose',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Purpose' />
    ),
    cell: ({ row }) => (
      <div className='max-w-md text-sm text-muted-foreground'>
        {row.original.purpose}
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Assignment' />
    ),
    cell: ({ row }) => <AssignmentStatusBadge status={row.original.status} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
]

type SecretAccessAssignmentsTableProps = {
  rows: SecretAccessAssignmentRow[]
  search: Record<string, unknown>
  navigate: NavigateFn
}

/**
 * Searchable, filterable, paginated inspector for live accessPolicy grants.
 */
export function SecretAccessAssignmentsTable({
  rows,
  search,
  navigate,
}: SecretAccessAssignmentsTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'query', desc: false },
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
      { columnId: 'query', searchKey: 'query', type: 'string' },
      { columnId: 'status', searchKey: 'status', type: 'array' },
    ],
  })

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
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
    <div className='space-y-4'>
      <DataTableToolbar
        table={table}
        searchKey='query'
        searchPlaceholder='Search service, namespace, refs, operations, purpose...'
        filters={[
          {
            columnId: 'status',
            title: 'Assignment',
            options: Object.entries(statusLabels).map(([value, label]) => ({
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
                        'align-top',
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
                  className='h-24 text-center text-muted-foreground'
                >
                  No broker.accessPolicy assignments match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}
