import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
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
import { Copy, Eye } from 'lucide-react'
import { copyText } from '@/lib/copy-text'
import type { ServiceEnvironmentVariable } from '@/lib/service-lasso-dashboard/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DataTableColumnHeader,
  DataTablePagination,
  DataTableScrollRegion,
  DataTableToolbar,
  dataTableStickyHeaderClassName,
} from '@/components/data-table'

type EnvironmentTableProps = {
  serviceId: string
  variables: ServiceEnvironmentVariable[]
}

type ServiceDetailVariableRow = {
  id: string
  key: string
  value: string
  secret: boolean
  scope: ServiceEnvironmentVariable['scope']
  source: string
  searchText: string
}

/**
 * Build operator search text for a service-detail variable row.
 * Masked secret values are omitted so search cannot newly reveal them.
 */
export function buildServiceDetailVariableSearchText(
  variable: ServiceEnvironmentVariable
): string {
  const source = variable.source ?? 'Not recorded'
  const parts = [variable.key, variable.scope, source]

  if (!variable.secret) {
    parts.push(variable.value)
  }

  return parts.join(' ').toLowerCase()
}

/**
 * Map runtime environment variables into table rows with stable ids.
 */
export function buildServiceDetailVariableRows(
  variables: ServiceEnvironmentVariable[]
): ServiceDetailVariableRow[] {
  return variables.map((variable, index) => {
    const source = variable.source ?? 'Not recorded'

    return {
      id: [variable.key, variable.scope, source, String(index)].join('|'),
      key: variable.key,
      value: variable.value,
      secret: Boolean(variable.secret),
      scope: variable.scope,
      source,
      searchText: buildServiceDetailVariableSearchText(variable),
    }
  })
}

function CopyVariableValueButton({ value }: { value: string }) {
  return (
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
  )
}

function buildColumns(
  serviceId: string
): ColumnDef<ServiceDetailVariableRow>[] {
  return [
    {
      accessorKey: 'key',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Key' />
      ),
      cell: ({ row }) => (
        <div className='truncate font-medium' title={row.original.key}>
          {row.original.key}
        </div>
      ),
      enableHiding: false,
    },
    {
      id: 'value',
      accessorFn: (row) => (row.secret ? '' : row.value),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Value' />
      ),
      cell: ({ row }) => (
        <div
          className='truncate text-sm text-muted-foreground'
          data-testid='service-detail-variable-value'
          title={row.original.secret ? undefined : row.original.value}
        >
          {row.original.secret ? '••••••••' : row.original.value}
        </div>
      ),
    },
    {
      id: 'scope',
      accessorFn: (row) => row.scope,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Scope' />
      ),
      cell: ({ row }) => (
        <Badge
          variant={row.original.scope === 'global' ? 'secondary' : 'outline'}
        >
          {row.original.scope}
        </Badge>
      ),
      filterFn: (row, id, value) =>
        Array.isArray(value) ? value.includes(row.getValue(id)) : true,
    },
    {
      id: 'source',
      accessorFn: (row) => row.source,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Source' />
      ),
      cell: ({ row }) => (
        <div
          className='truncate text-sm text-muted-foreground'
          title={row.original.source}
        >
          {row.original.source}
        </div>
      ),
      filterFn: (row, id, value) =>
        Array.isArray(value) ? value.includes(row.getValue(id)) : true,
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <div
          className='flex min-w-[8.75rem] flex-wrap items-center gap-2'
          data-testid='service-detail-variable-actions'
        >
          <CopyVariableValueButton value={row.original.value} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='outline' size='icon' asChild>
                <Link
                  to='/variables'
                  search={{ service: serviceId, key: row.original.key }}
                  aria-label='View variable'
                  title='View variable'
                  className='size-7'
                >
                  <Eye className='size-3.5' />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>View variable</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ]
}

/**
 * Service-detail Variables operator table with search, scope/source filters,
 * pagination, and a remaining-height scroll body.
 */
export function EnvironmentTable({
  serviceId,
  variables,
}: EnvironmentTableProps) {
  const columns = useMemo(() => buildColumns(serviceId), [serviceId])
  const rows = useMemo(
    () => buildServiceDetailVariableRows(variables),
    [variables]
  )
  const sources = useMemo(
    () => Array.from(new Set(rows.map((row) => row.source))).sort(),
    [rows]
  )
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'key', desc: false },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

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
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
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
    getRowId: (row) => row.id,
  })

  const pageCount = table.getPageCount()

  useEffect(() => {
    setPagination((previous) =>
      previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 }
    )
  }, [columnFilters, globalFilter, rows])

  useEffect(() => {
    if (pageCount > 0 && pagination.pageIndex >= pageCount) {
      setPagination((previous) => ({
        ...previous,
        pageIndex: pageCount - 1,
      }))
    }
  }, [pageCount, pagination.pageIndex])

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-4'>
      <DataTableToolbar
        table={table}
        searchPlaceholder='Search keys, visible values, scope, or sources...'
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
        ]}
      />

      <DataTableScrollRegion testId='service-detail-variables-table'>
        <Table contained={false} className='min-w-[860px] table-fixed'>
          <colgroup>
            <col className='w-[20%]' />
            <col className='w-[34%]' />
            <col className='w-[11%]' />
            <col className='w-[19%]' />
            <col className='w-[16%]' />
          </colgroup>
          <TableHeader className={dataTableStickyHeaderClassName}>
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
                        'min-w-0 bg-background group-hover/row:bg-muted',
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
                  {variables.length
                    ? 'No variables match the current filters.'
                    : 'No environment variables are recorded for this service yet.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableScrollRegion>

      <DataTablePagination table={table} className='mt-auto' />
    </div>
  )
}
