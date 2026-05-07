import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  KeyRound,
  Link2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  getSecretsBrokerProviderConnectionDetail,
  secretsBrokerProviderConnections,
  type SecretsBrokerProviderConnectionAction,
  type SecretsBrokerProviderConnectionDetail,
  type SecretsBrokerProviderConnectionState,
  type SecretsBrokerSecretMaterialState,
} from './provider-connections'

const connectionStateCopy: Record<
  SecretsBrokerProviderConnectionState,
  string
> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  failed: 'Failed',
  disabled: 'Disabled',
  missing: 'Missing',
}

const connectionStateVariant: Record<
  SecretsBrokerProviderConnectionState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  healthy: 'default',
  degraded: 'secondary',
  failed: 'destructive',
  disabled: 'outline',
  missing: 'destructive',
}

const materialStateCopy: Record<SecretsBrokerSecretMaterialState, string> = {
  present: 'Present',
  missing: 'Missing',
  expired: 'Expired',
  'rotation-due': 'Rotation due',
  revoked: 'Revoked',
}

const actionVariant: Record<
  SecretsBrokerProviderConnectionAction['state'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  available: 'secondary',
  disabled: 'outline',
  danger: 'destructive',
}

function StateIcon({ state }: { state: SecretsBrokerProviderConnectionState }) {
  if (state === 'healthy') return <CheckCircle2 className='size-4' />
  if (state === 'degraded') return <AlertTriangle className='size-4' />
  return <XCircle className='size-4' />
}

function ConnectionDetailMissing({ connectionId }: { connectionId: string }) {
  usePageMetadata({
    title: 'Service Admin - Secrets Broker Connection Missing',
    description: 'Missing Secrets Broker provider connection detail.',
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
        <Card>
          <CardHeader>
            <CardTitle>Provider connection not found</CardTitle>
            <CardDescription>
              No safe stub data exists for connection id {connectionId}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant='secondary'>
              <Link to='/secrets-broker'>Back to Secrets Broker setup</Link>
            </Button>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

function MetadataGrid({
  connection,
}: {
  connection: SecretsBrokerProviderConnectionDetail
}) {
  return (
    <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
      {connection.metadata.map((item) => (
        <div key={item.label} className='rounded-lg border p-3'>
          <div className='text-xs text-muted-foreground'>{item.label}</div>
          <div className='font-medium'>{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function ActionButton({
  action,
}: {
  action: SecretsBrokerProviderConnectionAction
}) {
  return (
    <div className='rounded-lg border p-3'>
      <Button
        type='button'
        variant={actionVariant[action.state]}
        disabled={action.state === 'disabled'}
        className='w-full justify-start'
      >
        {action.label}
      </Button>
      {action.confirmationCopy ? (
        <p className='mt-2 text-xs text-muted-foreground'>
          Confirmation: {action.confirmationCopy}
        </p>
      ) : null}
      {action.disabledReason ? (
        <p className='mt-2 text-xs text-muted-foreground'>
          Disabled: {action.disabledReason}
        </p>
      ) : null}
    </div>
  )
}

export function SecretsBrokerProviderConnectionDetailPage({
  connectionId,
}: {
  connectionId: string
}) {
  const connection = getSecretsBrokerProviderConnectionDetail(connectionId)

  usePageMetadata({
    title: connection
      ? `Service Admin - ${connection.title}`
      : 'Service Admin - Secrets Broker Connection Missing',
    description:
      'Safe Secrets Broker provider connection detail with metadata-only secret material state.',
  })

  if (!connection)
    return <ConnectionDetailMissing connectionId={connectionId} />

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
            <div className='mb-2 flex items-center gap-2 text-sm text-muted-foreground'>
              <Link to='/secrets-broker' className='hover:underline'>
                Secrets Broker
              </Link>
              <span>/</span>
              <span>Provider connection detail</span>
            </div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <KeyRound className='size-5' /> {connection.title}
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Safe metadata, health, material state, usage, and actions for one
              provider connection. Raw secret values are never rendered or
              copied.
            </p>
          </div>
          <Badge variant={connectionStateVariant[connection.state]}>
            <StateIcon state={connection.state} />
            {connectionStateCopy[connection.state]}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <ShieldCheck className='size-4' /> Safe metadata summary
            </CardTitle>
            <CardDescription>
              Provider {connection.provider}, source {connection.source}, ref{' '}
              {connection.connectionRef}. Values are hidden.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <MetadataGrid connection={connection} />
          </CardContent>
        </Card>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Clock3 className='size-4' /> Status and health
              </CardTitle>
              <CardDescription>{connection.health.label}</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3 text-sm'>
              <div className='flex justify-between gap-3 rounded-lg border p-3'>
                <span className='text-muted-foreground'>Last checked</span>
                <span className='font-medium'>
                  {connection.health.checkedAt}
                </span>
              </div>
              {connection.health.failureReason ? (
                <div className='flex justify-between gap-3 rounded-lg border p-3'>
                  <span className='text-muted-foreground'>
                    Last failure reason
                  </span>
                  <span className='font-medium'>
                    {connection.health.failureReason}
                  </span>
                </div>
              ) : null}
              <div className='rounded-lg border p-3'>
                <div className='text-muted-foreground'>Next action</div>
                <div className='font-medium'>
                  {connection.health.nextAction}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <ShieldAlert className='size-4' /> Secret material state
              </CardTitle>
              <CardDescription>
                Presence and lifecycle metadata only; no value material is
                loaded.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3 text-sm'>
              <div className='flex flex-wrap gap-2'>
                <Badge variant='secondary'>
                  Presence:{' '}
                  {materialStateCopy[connection.secretMaterial.presence]}
                </Badge>
                <Badge variant='outline'>Raw value: hidden</Badge>
                <Badge variant='outline'>Copy value: unavailable</Badge>
              </div>
              <p>{connection.secretMaterial.safeDescriptor}</p>
              <div className='grid gap-2 md:grid-cols-2'>
                {connection.secretMaterial.version ? (
                  <div className='rounded-lg border p-3'>
                    <div className='text-muted-foreground'>Key version</div>
                    <div className='font-medium'>
                      {connection.secretMaterial.version}
                    </div>
                  </div>
                ) : null}
                {connection.secretMaterial.updatedAt ? (
                  <div className='rounded-lg border p-3'>
                    <div className='text-muted-foreground'>Updated</div>
                    <div className='font-medium'>
                      {connection.secretMaterial.updatedAt}
                    </div>
                  </div>
                ) : null}
                {connection.secretMaterial.expiresAt ? (
                  <div className='rounded-lg border p-3'>
                    <div className='text-muted-foreground'>Expiry</div>
                    <div className='font-medium'>
                      {connection.secretMaterial.expiresAt}
                    </div>
                  </div>
                ) : null}
                {connection.secretMaterial.refreshWindow ? (
                  <div className='rounded-lg border p-3'>
                    <div className='text-muted-foreground'>
                      Refresh timeline
                    </div>
                    <div className='font-medium'>
                      {connection.secretMaterial.refreshWindow}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle>Scopes and permissions</CardTitle>
              <CardDescription>
                Permission decisions are rendered as policy metadata only.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-2'>
              {connection.scopes.map((scope) => (
                <div
                  key={scope.label}
                  className='flex items-center justify-between gap-3 rounded-lg border p-3 text-sm'
                >
                  <span>{scope.label}</span>
                  <Badge
                    variant={
                      scope.decision === 'allowed'
                        ? 'default'
                        : scope.decision === 'denied'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {scope.decision}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Link2 className='size-4' /> Linked services, workflows, and
                runs
              </CardTitle>
              <CardDescription>
                Consumers that depend on this provider connection.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3 md:grid-cols-3'>
              <div>
                <div className='mb-2 text-xs font-medium text-muted-foreground uppercase'>
                  Services
                </div>
                <div className='space-y-1'>
                  {connection.usage.linkedServices.map((item) => (
                    <Badge key={item} variant='outline'>
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className='mb-2 text-xs font-medium text-muted-foreground uppercase'>
                  Workflows
                </div>
                <div className='space-y-1'>
                  {connection.usage.linkedWorkflows.map((item) => (
                    <Badge key={item} variant='outline'>
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className='mb-2 text-xs font-medium text-muted-foreground uppercase'>
                  Runs
                </div>
                <div className='space-y-1'>
                  {connection.usage.linkedRuns.map((item) => (
                    <Badge key={item} variant='outline'>
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className='grid gap-2 md:col-span-3 md:grid-cols-2'>
                {connection.usage.lastSuccessfulResolve ? (
                  <div className='rounded-lg border p-3 text-sm'>
                    <div className='text-muted-foreground'>
                      Last successful resolve/use
                    </div>
                    <div className='font-medium'>
                      {connection.usage.lastSuccessfulResolve}
                    </div>
                  </div>
                ) : null}
                {connection.usage.lastFailure ? (
                  <div className='rounded-lg border p-3 text-sm'>
                    <div className='text-muted-foreground'>Last failure</div>
                    <div className='font-medium'>
                      {connection.usage.lastFailure}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent audit events</CardTitle>
            <CardDescription>
              Safe event metadata for this connection.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            {connection.recentAuditEvents.map((event) => (
              <div
                key={event.id}
                className='grid gap-2 rounded-lg border p-3 text-sm md:grid-cols-[1fr_auto]'
              >
                <div>
                  <div className='font-medium'>{event.type}</div>
                  <div className='text-muted-foreground'>
                    {event.at} · {event.actor} · {event.reason}
                  </div>
                </div>
                <Badge
                  variant={
                    event.outcome === 'success'
                      ? 'default'
                      : event.outcome === 'denied'
                        ? 'destructive'
                        : 'secondary'
                  }
                >
                  {event.outcome}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connection actions</CardTitle>
            <CardDescription>
              Dangerous actions include explicit confirmation copy and do not
              expose raw secret material.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {connection.actions.map((action) => (
              <ActionButton key={action.id} action={action} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available stub detail connections</CardTitle>
            <CardDescription>
              API/stub-backed detail records currently available for tests and
              local preview.
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-2'>
            {secretsBrokerProviderConnections.map((item) => (
              <Button key={item.id} asChild variant='outline' size='sm'>
                <Link
                  to='/secrets-broker/$connectionId'
                  params={{ connectionId: item.id }}
                >
                  {item.title}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
