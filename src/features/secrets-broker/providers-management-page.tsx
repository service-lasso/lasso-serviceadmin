import { useMemo, useState } from 'react'
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
import {
  Ban,
  CirclePlus,
  KeyRound,
  MoreHorizontal,
  PlugZap,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  getConfiguredSecretsBrokerProviders,
  type SecretsBrokerProviderLifecycle,
  type SecretsBrokerSourceBackend,
  type SecretsBrokerSourceState,
} from './source-backends'

const stateVariant: Record<
  SecretsBrokerSourceState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  configured: 'secondary',
  'not-configured': 'outline',
  reachable: 'default',
  failing: 'destructive',
  untested: 'outline',
}

const lifecycleVariant: Record<
  SecretsBrokerProviderLifecycle,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  'setup-needed': 'outline',
  locked: 'secondary',
  unlocked: 'default',
  'auth-required': 'destructive',
  invalid: 'destructive',
  ready: 'default',
}

function providerTypeLabel(provider: SecretsBrokerSourceBackend) {
  return provider.type === 'local' ? 'local-encrypted-store' : provider.type
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge className='bg-emerald-600 hover:bg-emerald-600'>Enabled</Badge>
  ) : (
    <Badge variant='outline'>Disabled</Badge>
  )
}

function ProviderActions({
  provider,
}: {
  provider: SecretsBrokerSourceBackend
}) {
  const canEdit = provider.supportedActions.includes('edit-configuration')
  const canTest = provider.supportedActions.includes('test-source')
  const needsReconnect = [
    'auth-required',
    'locked',
    'invalid',
    'setup-needed',
  ].includes(provider.lifecycle)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type='button' size='sm' variant='outline'>
          <MoreHorizontal className='size-4' /> Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-48'>
        <DropdownMenuItem disabled={!canEdit}>
          <Settings className='size-4' /> View/Edit configuration
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canTest}>
          <ShieldCheck className='size-4' /> Test connection
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!needsReconnect}>
          <RefreshCw className='size-4' /> Reconnect / reauth
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Ban className='size-4' /> Disable provider
        </DropdownMenuItem>
        <DropdownMenuItem variant='destructive'>
          <Trash2 className='size-4' /> Remove provider
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const columns: ColumnDef<SecretsBrokerSourceBackend>[] = [
  {
    id: 'provider',
    accessorFn: (provider) =>
      [
        provider.title,
        provider.type,
        provider.provider,
        provider.source,
        provider.connection,
        provider.namespaces.join(' '),
        provider.summary,
      ].join(' '),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Provider' />
    ),
    cell: ({ row }) => (
      <div className='flex max-w-[320px] min-w-0 flex-col'>
        <span className='truncate font-medium' title={row.original.title}>
          {row.original.title}
        </span>
        <span
          className='truncate text-xs text-muted-foreground'
          title={row.original.source}
        >
          {providerTypeLabel(row.original)} · {row.original.source}
        </span>
      </div>
    ),
    enableHiding: false,
  },
  {
    id: 'enabled',
    accessorFn: (provider) => (provider.enabled ? 'enabled' : 'disabled'),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Enabled' />
    ),
    cell: ({ row }) => <EnabledBadge enabled={row.original.enabled} />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'status',
    accessorFn: (provider) => provider.state,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Health' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-wrap gap-2'>
        <Badge variant={stateVariant[row.original.state]}>
          {row.original.state}
        </Badge>
        <Badge variant={lifecycleVariant[row.original.lifecycle]}>
          {row.original.lifecycle}
        </Badge>
      </div>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'lifecycle',
    accessorFn: (provider) => provider.lifecycle,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Lifecycle' />
    ),
    cell: ({ row }) => (
      <div className='max-w-[260px] min-w-0'>
        <div
          className='truncate text-sm'
          title={
            row.original.lifecycleDetail?.state ??
            row.original.testResult.outcome
          }
        >
          {row.original.lifecycleDetail?.state ??
            row.original.testResult.outcome}
        </div>
        <div
          className='truncate text-xs text-muted-foreground'
          title={row.original.nextAction}
        >
          {row.original.nextAction}
        </div>
      </div>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'priority',
    accessorFn: (provider) => provider.priority ?? 999,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Priority' />
    ),
    cell: ({ row }) => (
      <div className='whitespace-nowrap'>
        {row.original.priority ?? 'Not assigned'}
      </div>
    ),
  },
  {
    id: 'namespaces',
    accessorFn: (provider) =>
      provider.namespaces.length
        ? provider.namespaces.join(', ')
        : 'not mapped',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Namespaces' />
    ),
    cell: ({ row }) => (
      <div
        className='max-w-[240px] truncate text-sm'
        title={
          row.original.namespaces.length
            ? row.original.namespaces.join(', ')
            : 'not mapped'
        }
      >
        {row.original.namespaces.length
          ? row.original.namespaces.join(', ')
          : 'not mapped'}
      </div>
    ),
  },
  {
    id: 'lastCheckedAt',
    accessorFn: (provider) => provider.lastCheckedAt,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Last checked' />
    ),
    cell: ({ row }) => (
      <div
        className='max-w-[190px] truncate whitespace-nowrap'
        title={row.original.lastCheckedAt}
      >
        {row.original.lastCheckedAt}
      </div>
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => <ProviderActions provider={row.original} />,
    enableSorting: false,
    enableHiding: false,
  },
]

export function ProvidersManagementPage() {
  usePageMetadata({
    title: 'Service Admin - Secrets Broker Providers',
    description:
      'Focused Secrets Broker provider management table for configured providers and metadata-only status.',
  })

  const data = useMemo(
    () =>
      getConfiguredSecretsBrokerProviders().filter(
        (provider) => provider.enabled
      ),
    []
  )
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'priority', desc: false },
    { id: 'provider', desc: false },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
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

      <Main id='content' className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <KeyRound className='size-5' /> Secrets Broker providers
            </h1>
            <p className='text-muted-foreground'>
              Enabled provider configuration, health, and row actions.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary'>Metadata only</Badge>
            <Button type='button' size='sm'>
              <CirclePlus className='size-4' /> Add provider
            </Button>
          </div>
        </div>

        <div className='flex flex-1 flex-col gap-4'>
          <DataTableToolbar
            table={table}
            searchPlaceholder='Search providers, namespaces, source, or health...'
            searchKey='provider'
            filters={[
              {
                columnId: 'enabled',
                title: 'Enabled',
                options: [
                  { label: 'Enabled', value: 'enabled' },
                  { label: 'Disabled', value: 'disabled' },
                ],
              },
              {
                columnId: 'status',
                title: 'Health',
                options: [
                  { label: 'Configured', value: 'configured' },
                  { label: 'Reachable', value: 'reachable' },
                  { label: 'Failing', value: 'failing' },
                  { label: 'Untested', value: 'untested' },
                  { label: 'Not configured', value: 'not-configured' },
                ],
              },
              {
                columnId: 'lifecycle',
                title: 'Lifecycle',
                options: [
                  { label: 'Ready', value: 'ready' },
                  { label: 'Unlocked', value: 'unlocked' },
                  { label: 'Locked', value: 'locked' },
                  { label: 'Auth required', value: 'auth-required' },
                  { label: 'Invalid', value: 'invalid' },
                  { label: 'Setup needed', value: 'setup-needed' },
                ],
              },
            ]}
          />

          <div className='overflow-hidden rounded-md border'>
            <div className='overflow-x-auto'>
              <Table className='min-w-[1180px] table-fixed'>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className='group/row'>
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
                      <TableRow key={row.id} className='group/row'>
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
                        className='h-28 text-center'
                      >
                        <div className='mx-auto flex max-w-md flex-col items-center gap-2'>
                          <PlugZap className='size-5 text-muted-foreground' />
                          <div className='font-medium'>
                            No enabled providers match the current filters.
                          </div>
                          <div className='text-sm text-muted-foreground'>
                            Add a provider or clear filters to review enabled
                            provider state.
                          </div>
                          <Button type='button' size='sm'>
                            <CirclePlus className='size-4' /> Add provider
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <DataTablePagination table={table} className='mt-auto' />
        </div>
      </Main>
    </>
  )
}
