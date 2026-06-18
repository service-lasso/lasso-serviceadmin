import {
  AlertTriangle,
  ClipboardCheck,
  FileKey2,
  HardDrive,
  LockKeyhole,
  Route,
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
import { secretsBrokerBackupKeyStatus } from './backup-key-management'
import { getLocalEncryptedStoreProvider } from './source-backends'

const resolutionSteps = [
  'Service requests a SecretRef from @secretsbroker.',
  'Enabled providers match explicit refs or claimed namespaces.',
  'Priority order is evaluated from the lowest number first.',
  'Local encrypted store owns the wildcard namespace fallback in this demo.',
  'Locked, policy_denied, auth_required, or config_error states fail closed.',
]

export function LocalEncryptedStoreProviderDetail() {
  const provider = getLocalEncryptedStoreProvider()
  const backupStatus = secretsBrokerBackupKeyStatus

  if (!provider) return null

  return (
    <section className='space-y-4' aria-labelledby='local-store-heading'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2
            id='local-store-heading'
            className='flex items-center gap-2 text-xl font-semibold'
          >
            <LockKeyhole className='size-5' /> Local encrypted store
          </h2>
          <p className='mt-1 text-sm text-muted-foreground'>
            Built-in metadata-only provider detail for the local Secrets Broker
            store, using the current demo status shape from /v1/sources/status.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='secondary'>{provider.brokerState}</Badge>
          <Badge variant='outline'>{provider.lifecycleDetail?.outcome}</Badge>
          <Badge variant='outline'>Metadata only</Badge>
        </div>
      </div>

      <div className='grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <HardDrive className='size-4' /> Overview
            </CardTitle>
            <CardDescription>
              Source identity, lifecycle, priority, namespace ownership, and
              capabilities reported for the built-in local source.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-3 text-sm md:grid-cols-2'>
              <div>
                <div className='text-xs text-muted-foreground'>source id</div>
                <div className='font-medium'>{provider.sourceId}</div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>kind</div>
                <div className='font-medium'>{provider.kind}</div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>
                  display name
                </div>
                <div className='font-medium'>{provider.title}</div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>priority</div>
                <div className='font-medium'>{provider.priority}</div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>enabled</div>
                <div className='font-medium'>{String(provider.enabled)}</div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>critical</div>
                <div className='font-medium'>{String(provider.critical)}</div>
              </div>
            </div>

            <div className='rounded-md border p-3 text-sm'>
              <div className='mb-2 font-medium'>Lifecycle</div>
              <div className='grid gap-2 md:grid-cols-4'>
                <Badge variant='secondary'>
                  {provider.lifecycleDetail?.state}
                </Badge>
                <Badge variant='secondary'>
                  {provider.lifecycleDetail?.outcome}
                </Badge>
                <Badge variant='outline'>
                  {provider.lifecycleDetail?.nextAction}
                </Badge>
                <Badge variant='outline'>
                  retryable {String(provider.lifecycleDetail?.retryable)}
                </Badge>
              </div>
            </div>

            <div className='space-y-2 text-sm'>
              <div className='font-medium'>Capabilities</div>
              <div className='flex flex-wrap gap-2'>
                {provider.capabilities?.map((capability) => (
                  <Badge key={capability} variant='outline'>
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <AlertTriangle className='size-4' /> Setup / unlock state
            </CardTitle>
            <CardDescription>
              The current canonical demo is healthy but not unsealed, so
              mutation and reveal flows stay blocked.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'>
              <div className='font-medium'>unlock_or_unseal_source</div>
              <p className='mt-1'>
                Import, unlock, or unseal the local store before resolving,
                revealing, rotating, or migrating stored refs.
              </p>
            </div>
            <div className='grid gap-2 md:grid-cols-2'>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground'>
                  Broker state
                </div>
                <div className='font-medium'>setup_needed</div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground'>
                  Store outcome
                </div>
                <div className='font-medium'>locked</div>
              </div>
            </div>
            <p className='text-muted-foreground'>
              Master keys, recovery shares, raw values, provider credentials,
              tokens, and private keys are never rendered or requested by this
              view.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Route className='size-4' /> Resolution order and fallback
          </CardTitle>
          <CardDescription>
            Local encrypted store establishes the reusable provider template for
            future provider detail pages.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]'>
          <div className='space-y-2 text-sm'>
            {resolutionSteps.map((step, index) => (
              <div key={step} className='flex gap-2 rounded-md border p-3'>
                <Badge variant='secondary'>{index + 1}</Badge>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namespace / ref</TableHead>
                  <TableHead>Resolution role</TableHead>
                  <TableHead>Failure state</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>*</TableCell>
                  <TableCell>default fallback provider</TableCell>
                  <TableCell>locked blocks fallback</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>explicit refs</TableCell>
                  <TableCell>not configured yet</TableCell>
                  <TableCell>missing_ref fails closed</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>production namespaces</TableCell>
                  <TableCell>should map to explicit providers later</TableCell>
                  <TableCell>policy_denied is not hidden</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className='grid gap-4 xl:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <FileKey2 className='size-4' /> Backup and keys
            </CardTitle>
            <CardDescription>
              Backup / Keys is scoped under Local encrypted store while keeping
              the legacy route compatible.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div className='grid gap-3 md:grid-cols-2'>
              <div>
                <div className='text-xs text-muted-foreground'>
                  encrypted backup
                </div>
                <div className='font-medium'>{backupStatus.backup.state}</div>
                <div className='text-muted-foreground'>
                  {backupStatus.backup.artifact}
                </div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>
                  restore metadata
                </div>
                <div className='font-medium'>
                  {backupStatus.backup.restoreReadiness}
                </div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>
                  master key status
                </div>
                <div className='font-medium'>
                  {backupStatus.key.rotationStatus}
                </div>
              </div>
              <div>
                <div className='text-xs text-muted-foreground'>
                  recovery share metadata
                </div>
                <div className='font-medium'>
                  {backupStatus.key.recoveryMaterial}
                </div>
              </div>
            </div>
            <div className='flex flex-wrap gap-2'>
              {backupStatus.actions.map((action) => (
                <Button
                  key={action.id}
                  type='button'
                  size='sm'
                  variant={
                    action.state === 'danger' ? 'destructive' : 'outline'
                  }
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <ClipboardCheck className='size-4' /> Diagnostics and audit
            </CardTitle>
            <CardDescription>
              Health and lifecycle diagnostics stay redacted and metadata-only.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            {provider.testResult.metadata.map((item) => (
              <div key={item} className='rounded-md border p-3'>
                {item}
              </div>
            ))}
            <div className='rounded-md border p-3'>
              source config path: not exposed by current demo status endpoint
            </div>
            <div className='rounded-md border p-3'>
              SECRETSBROKER_SOURCES_PATH: no external config active in demo
            </div>
            <div className='flex gap-3 rounded-md border p-3'>
              <ShieldCheck className='mt-0.5 size-4 shrink-0' />
              <div>
                Raw values, credential payloads, provider tokens, private keys,
                cookies, passwords, environment values, and recovery material
                are excluded from routes, diagnostics, storage, and rendered
                fixtures.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

export function LocalEncryptedStoreProviderDetailPage() {
  usePageMetadata({
    title: 'Service Admin - Local Encrypted Store',
    description:
      'Metadata-only Local encrypted store provider detail for Secrets Broker.',
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

      <Main id='content' className='space-y-6'>
        <LocalEncryptedStoreProviderDetail />
      </Main>
    </>
  )
}
