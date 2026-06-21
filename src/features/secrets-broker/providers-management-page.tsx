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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  getAddableSecretsBrokerProviders,
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

type ProviderAction =
  | 'add'
  | 'edit'
  | 'test'
  | 'reconnect'
  | 'disable'
  | 'remove'

type SelectedProviderAction = {
  provider: SecretsBrokerSourceBackend
  action: ProviderAction
}

const actionTitles: Record<ProviderAction, string> = {
  add: 'Add provider metadata setup',
  edit: 'Provider configuration',
  test: 'Provider connection test',
  reconnect: 'Provider reconnect workflow',
  disable: 'Disable provider preview',
  remove: 'Remove provider preview',
}

function actionSummary({ provider, action }: SelectedProviderAction): {
  status: string
  nextAction: string
  details: string[]
} {
  if (action === 'add') {
    return {
      status: 'setup preview ready',
      nextAction: provider.nextAction,
      details: [
        'metadata-only setup is staged before provider enablement',
        'provider credentials stay outside Service Admin',
        'test connection remains disabled until required handles are configured',
      ],
    }
  }

  if (action === 'test') {
    return {
      status:
        provider.testResult.outcome === 'success'
          ? 'latest metadata test succeeded'
          : provider.testResult.outcome === 'failure'
            ? 'latest metadata test failed closed'
            : 'metadata test has not run',
      nextAction: provider.lifecycleDetail?.nextAction ?? provider.nextAction,
      details: provider.testResult.metadata,
    }
  }

  if (action === 'reconnect') {
    return {
      status: ['auth-required', 'locked', 'invalid', 'setup-needed'].includes(
        provider.lifecycle
      )
        ? 'reconnect required before provider-backed actions'
        : 'reconnect is not currently required',
      nextAction: provider.lifecycleDetail?.nextAction ?? provider.nextAction,
      details: [
        'reconnect accepts safe credential references only',
        'raw provider credentials are never entered here',
        'affected refs stay blocked until provider status is refreshed',
      ],
    }
  }

  if (action === 'disable') {
    return {
      status: 'disable requires broker confirmation',
      nextAction: 'preview dependent refs and service impact before disable',
      details: [
        'disable is confirmation-gated',
        'default provider cannot be disabled without replacement metadata',
        'no secret values are exported during disable preview',
      ],
    }
  }

  if (action === 'remove') {
    return {
      status: 'remove requires dependency and recovery review',
      nextAction: 'verify dependent refs and recovery plan before removal',
      details: [
        'remove is blocked while namespaces still route to this provider',
        'recovery metadata must be retained for audit',
        'provider-owned credentials are not revealed or copied',
      ],
    }
  }

  return {
    status: provider.configured
      ? 'configuration metadata available'
      : 'configuration metadata setup required',
    nextAction: provider.nextAction,
    details: [provider.connection, provider.summary, `mode: ${provider.mode}`],
  }
}

function ProviderActions({
  provider,
  onSelect,
}: {
  provider: SecretsBrokerSourceBackend
  onSelect: (action: ProviderAction) => void
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
        <DropdownMenuItem disabled={!canEdit} onSelect={() => onSelect('edit')}>
          <Settings className='size-4' /> View/Edit configuration
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canTest} onSelect={() => onSelect('test')}>
          <ShieldCheck className='size-4' /> Test connection
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!needsReconnect}
          onSelect={() => onSelect('reconnect')}
        >
          <RefreshCw className='size-4' /> Reconnect / reauth
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSelect('disable')}>
          <Ban className='size-4' /> Disable provider
        </DropdownMenuItem>
        <DropdownMenuItem
          variant='destructive'
          onSelect={() => onSelect('remove')}
        >
          <Trash2 className='size-4' /> Remove provider
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProviderActionPanel({
  selection,
  onClear,
}: {
  selection: SelectedProviderAction | null
  onClear: () => void
}) {
  if (!selection) return null

  const preview = actionSummary(selection)

  return (
    <section
      aria-label='Provider action detail'
      className='rounded-md border bg-muted/20 p-4'
    >
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='text-sm font-medium'>
            {actionTitles[selection.action]}
          </div>
          <div className='truncate text-sm text-muted-foreground'>
            {selection.provider.title}
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='secondary'>Metadata only</Badge>
          <Button type='button' size='sm' variant='outline' onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>
      <div className='mt-4 grid gap-3 md:grid-cols-3'>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Status
          </div>
          <div className='mt-1 text-sm'>{preview.status}</div>
        </div>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Next action
          </div>
          <div className='mt-1 text-sm'>{preview.nextAction}</div>
        </div>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Safe contract
          </div>
          <div className='mt-1 text-sm'>
            refs, namespaces, state, and audit metadata only
          </div>
        </div>
      </div>
      <ul className='mt-4 list-disc space-y-1 ps-5 text-sm text-muted-foreground'>
        {preview.details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    </section>
  )
}

function AddProviderDialog({
  providers,
  open,
  onOpenChange,
  onSelect,
}: {
  providers: SecretsBrokerSourceBackend[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (provider: SecretsBrokerSourceBackend) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[88vh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Add provider</DialogTitle>
          <DialogDescription>
            Choose a provider setup path. This page stages metadata only; raw
            credentials stay in the provider or Secrets Broker.
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-3 md:grid-cols-2'>
          {providers.map((provider) => (
            <button
              key={provider.id}
              type='button'
              className='rounded-md border p-4 text-left transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
              onClick={() => {
                onSelect(provider)
                onOpenChange(false)
              }}
            >
              <div className='flex flex-wrap items-center gap-2'>
                <div className='font-medium'>{provider.title}</div>
                <Badge variant={stateVariant[provider.state]}>
                  {provider.state}
                </Badge>
              </div>
              <div className='mt-2 text-sm text-muted-foreground'>
                {provider.connection}
              </div>
              <div className='mt-3 text-xs text-muted-foreground'>
                {provider.nextAction}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function providerColumns(
  onActionSelect: (
    provider: SecretsBrokerSourceBackend,
    action: ProviderAction
  ) => void
): ColumnDef<SecretsBrokerSourceBackend>[] {
  return [
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
        <div className='flex min-w-0 flex-col'>
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
        <div className='min-w-0'>
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
          className='truncate text-sm'
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
          className='truncate whitespace-nowrap'
          title={row.original.lastCheckedAt}
        >
          {row.original.lastCheckedAt}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <ProviderActions
          provider={row.original}
          onSelect={(action) => onActionSelect(row.original, action)}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ]
}

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
  const addableProviders = useMemo(() => getAddableSecretsBrokerProviders(), [])
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'priority', desc: false },
    { id: 'provider', desc: false },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [addProviderOpen, setAddProviderOpen] = useState(false)
  const [selectedAction, setSelectedAction] =
    useState<SelectedProviderAction | null>(null)
  const columns = useMemo(
    () =>
      providerColumns((provider, action) =>
        setSelectedAction({ provider, action })
      ),
    []
  )

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
            <Button
              type='button'
              size='sm'
              onClick={() => setAddProviderOpen(true)}
            >
              <CirclePlus className='size-4' /> Add provider
            </Button>
          </div>
        </div>

        <div className='flex flex-1 flex-col gap-4'>
          <ProviderActionPanel
            selection={selectedAction}
            onClear={() => setSelectedAction(null)}
          />

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
              <Table className='min-w-[940px] table-fixed'>
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
        <AddProviderDialog
          providers={addableProviders}
          open={addProviderOpen}
          onOpenChange={setAddProviderOpen}
          onSelect={(provider) =>
            setSelectedAction({ provider, action: 'add' })
          }
        />
      </Main>
    </>
  )
}
