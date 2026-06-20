import { useMemo, useState } from 'react'
import {
  ArrowDownUp,
  DatabaseZap,
  KeyRound,
  Plus,
  Search as SearchIcon,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AwsSecretsManagerProviderDetail } from './aws-secrets-manager-provider-detail'
import { BitwardenBwsProviderDetail } from './bitwarden-bws-provider-detail'
import { LocalBootstrapProviderDetails } from './local-bootstrap-provider-details'
import { LocalEncryptedStoreProviderDetail } from './local-encrypted-store-detail'
import { MountedSecretsProviderDetail } from './mounted-secrets-provider-detail'
import { OnePasswordCliProviderDetail } from './onepassword-cli-provider-detail'
import {
  buildProvidersManagementSummary,
  filterProviderManagementRows,
  getAddableSecretsBrokerProviders,
  getConfiguredSecretsBrokerProviders,
  secretsBrokerSourceBackends,
  type SecretsBrokerProviderLifecycle,
  type SecretsBrokerSourceBackend,
  type SecretsBrokerSourceState,
} from './source-backends'
import { VaultProviderDetail } from './vault-provider-detail'

type ProviderOrder = 'priority' | 'name' | 'status'

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

function sortProviders(
  providers: SecretsBrokerSourceBackend[],
  order: ProviderOrder
) {
  return [...providers].sort((left, right) => {
    if (order === 'name') return left.title.localeCompare(right.title)
    if (order === 'status') {
      return `${left.state}-${left.lifecycle}-${left.title}`.localeCompare(
        `${right.state}-${right.lifecycle}-${right.title}`
      )
    }

    return (left.priority ?? 999) - (right.priority ?? 999)
  })
}

function providerTypeLabel(provider: SecretsBrokerSourceBackend) {
  return provider.type === 'local' ? 'local-encrypted-store' : provider.type
}

export function ProvidersManagementPage() {
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<ProviderOrder>('priority')

  usePageMetadata({
    title: 'Service Admin - Secrets Broker Providers',
    description:
      'Secrets Broker provider management for configured providers, add-provider options, priority ordering, and metadata-only status.',
  })

  const configuredProviders = useMemo(
    () =>
      sortProviders(
        filterProviderManagementRows(
          getConfiguredSecretsBrokerProviders(),
          query
        ),
        order
      ),
    [order, query]
  )
  const addableProviders = useMemo(
    () =>
      filterProviderManagementRows(getAddableSecretsBrokerProviders(), query),
    [query]
  )
  const summary = buildProvidersManagementSummary(secretsBrokerSourceBackends)

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

      <Main id='content' className='space-y-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <KeyRound className='size-5' /> Secrets Broker providers
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Manage configured providers, default/fallback ordering, and
              addable provider types without rendering credential values.
            </p>
          </div>
          <Badge variant='secondary'>Metadata only</Badge>
        </div>

        <div className='grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Configured providers</CardDescription>
              <CardTitle className='text-3xl'>
                {summary.configuredCount}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Healthy / ready</CardDescription>
              <CardTitle className='text-3xl'>{summary.readyCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Needing action</CardDescription>
              <CardTitle className='text-3xl'>
                {summary.needsActionCount}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Default / fallback</CardDescription>
              <CardTitle className='text-xl'>
                {summary.defaultProvider}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <DatabaseZap className='size-4' /> Configured provider table
                </CardTitle>
                <CardDescription>
                  Only the Local encrypted store is configured by default.
                  Additional provider types appear in Add Provider until an
                  operator configures and tests them.
                </CardDescription>
              </div>
              <div className='flex flex-wrap gap-2'>
                <Badge variant='outline'>No raw values</Badge>
                <Badge variant='outline'>Credentials as refs only</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]'>
              <label className='relative block'>
                <span className='sr-only'>Search providers</span>
                <SearchIcon className='pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground' />
                <Input
                  aria-label='Search providers'
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className='pl-9'
                  placeholder='Search provider name, kind, namespace, status'
                />
              </label>
              <label className='flex items-center gap-2'>
                <ArrowDownUp className='size-4 text-muted-foreground' />
                <span className='sr-only'>Provider order</span>
                <select
                  aria-label='Provider order'
                  className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                  value={order}
                  onChange={(event) =>
                    setOrder(event.target.value as ProviderOrder)
                  }
                >
                  <option value='priority'>Resolution priority</option>
                  <option value='name'>Provider name</option>
                  <option value='status'>Status</option>
                </select>
              </label>
            </div>

            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Configured / enabled</TableHead>
                    <TableHead>Status / lifecycle</TableHead>
                    <TableHead>Priority / ownership</TableHead>
                    <TableHead>Last tested</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configuredProviders.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell className='min-w-72 align-top'>
                        <div className='font-medium'>{provider.title}</div>
                        <div className='text-sm text-muted-foreground'>
                          {providerTypeLabel(provider)} · {provider.source}
                        </div>
                        <div className='mt-1 text-xs text-muted-foreground'>
                          {provider.summary}
                        </div>
                      </TableCell>
                      <TableCell className='min-w-44 align-top'>
                        <div>
                          {provider.configured ? 'configured' : 'addable'}
                        </div>
                        <div className='text-sm text-muted-foreground'>
                          {provider.enabled ? 'enabled' : 'disabled'}
                        </div>
                        <Badge className='mt-2' variant='outline'>
                          {provider.defaultRole}
                        </Badge>
                      </TableCell>
                      <TableCell className='min-w-48 align-top'>
                        <Badge variant={stateVariant[provider.state]}>
                          {provider.state}
                        </Badge>
                        <Badge
                          className='mt-2 ml-2'
                          variant={lifecycleVariant[provider.lifecycle]}
                        >
                          {provider.lifecycle}
                        </Badge>
                        <div className='mt-2 text-sm text-muted-foreground'>
                          {provider.testResult.outcome}
                        </div>
                      </TableCell>
                      <TableCell className='min-w-64 align-top'>
                        <div>
                          Priority {provider.priority ?? 'not assigned'}
                        </div>
                        <div className='mt-1 text-sm text-muted-foreground'>
                          Namespaces:{' '}
                          {provider.namespaces.length
                            ? provider.namespaces.join(', ')
                            : 'not mapped'}
                        </div>
                      </TableCell>
                      <TableCell className='min-w-48 align-top'>
                        <div>{provider.testResult.checkedAt}</div>
                        <div className='text-sm text-muted-foreground'>
                          {provider.lastCheckedAt}
                        </div>
                      </TableCell>
                      <TableCell className='min-w-56 align-top'>
                        <div className='flex flex-wrap gap-2'>
                          <Button type='button' size='sm' variant='outline'>
                            <Settings className='size-4' /> Configure
                          </Button>
                          <Button type='button' size='sm' variant='outline'>
                            <ShieldCheck className='size-4' /> Test
                          </Button>
                        </div>
                        <div className='mt-2 text-xs text-muted-foreground'>
                          {provider.nextAction}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {configuredProviders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className='h-24 text-center'>
                        No configured providers match the current filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <LocalEncryptedStoreProviderDetail />

        <LocalBootstrapProviderDetails query={query} />

        <VaultProviderDetail query={query} />

        <AwsSecretsManagerProviderDetail query={query} />

        <OnePasswordCliProviderDetail query={query} />

        <BitwardenBwsProviderDetail query={query} />

        <MountedSecretsProviderDetail query={query} />

        <Card>
          <CardHeader>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <Plus className='size-4' /> Add Provider
                </CardTitle>
                <CardDescription>
                  Supported provider types stay unconfigured until an operator
                  adds provider-specific metadata, mappings, priority, and a
                  safe test result.
                </CardDescription>
              </div>
              <Badge variant='outline'>{summary.addableCount} available</Badge>
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
              {addableProviders.map((provider) => (
                <div
                  key={provider.id}
                  className='rounded-md border p-4 text-sm'
                >
                  <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div>
                      <div className='font-medium'>{provider.title}</div>
                      <div className='text-xs text-muted-foreground'>
                        {providerTypeLabel(provider)}
                      </div>
                    </div>
                    <Badge variant='outline'>addable</Badge>
                  </div>
                  <p className='mt-3 text-muted-foreground'>
                    {provider.summary}
                  </p>
                  {provider.warnings.length ? (
                    <div className='mt-3 flex flex-wrap gap-1'>
                      {provider.warnings.map((warning) => (
                        <Badge key={warning.code} variant='secondary'>
                          {warning.title}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className='mt-3 rounded-md bg-muted/40 p-3'>
                    {provider.nextAction}
                  </div>
                  <Button type='button' className='mt-3' variant='outline'>
                    <Plus className='size-4' /> Add {provider.title}
                  </Button>
                </div>
              ))}
            </div>
            {addableProviders.length === 0 ? (
              <div className='rounded-md border border-dashed p-6 text-sm text-muted-foreground'>
                No addable provider options match the current filters.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
