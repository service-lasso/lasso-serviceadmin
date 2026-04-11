import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ExternalLink,
  HeartPulse,
  Link2,
  PackageCheck,
  ScanSearch,
  Wrench,
} from 'lucide-react'
import { useDashboardService } from '@/lib/service-lasso-dashboard/hooks'
import type {
  DashboardService,
  ServiceDependency,
  ServiceEndpoint,
  ServiceLogPreviewEntry,
  ServiceStatus,
} from '@/lib/service-lasso-dashboard/types'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === 'running') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Running</Badge>
    )
  }

  if (status === 'degraded') {
    return <Badge variant='secondary'>Degraded</Badge>
  }

  return <Badge variant='outline'>Stopped</Badge>
}

function HealthBadge({
  health,
}: {
  health: DashboardService['runtimeHealth']['health']
}) {
  if (health === 'healthy') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Healthy</Badge>
    )
  }

  if (health === 'warning') {
    return <Badge variant='secondary'>Warning</Badge>
  }

  return <Badge variant='destructive'>Critical</Badge>
}

function EndpointCard({ endpoint }: { endpoint: ServiceEndpoint }) {
  return (
    <div className='rounded-lg border p-4'>
      <div className='flex items-start justify-between gap-2'>
        <div>
          <div className='font-medium'>{endpoint.label}</div>
          <div className='text-xs text-muted-foreground'>
            {endpoint.protocol.toUpperCase()} · {endpoint.bind}:{endpoint.port}{' '}
            · {endpoint.exposure}
          </div>
        </div>
        <Button asChild size='sm' variant='outline'>
          <a href={endpoint.url} target='_blank' rel='noreferrer'>
            Open
            <ExternalLink className='ml-2 size-3.5' />
          </a>
        </Button>
      </div>
      <p className='mt-3 text-xs break-all text-muted-foreground'>
        {endpoint.url}
      </p>
    </div>
  )
}

function RelationshipList({
  title,
  items,
}: {
  title: string
  items: ServiceDependency[]
}) {
  return (
    <div className='space-y-3'>
      <div className='text-sm font-medium'>{title}</div>
      {items.length ? (
        items.map((item) => (
          <div
            key={`${item.relation}-${item.id}`}
            className='rounded-lg border p-3'
          >
            <div className='flex items-center gap-2'>
              <div className='font-medium'>{item.name}</div>
              <StatusBadge status={item.status} />
            </div>
            {item.note ? (
              <p className='mt-2 text-sm text-muted-foreground'>{item.note}</p>
            ) : null}
          </div>
        ))
      ) : (
        <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
          None recorded in the current stub.
        </div>
      )}
    </div>
  )
}

function LogPreview({ entries }: { entries: ServiceLogPreviewEntry[] }) {
  return (
    <div className='space-y-3'>
      {entries.length ? (
        entries.map((entry, index) => (
          <div
            key={`${entry.timestamp}-${index}`}
            className='rounded-lg border p-3'
          >
            <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
              <Badge variant='outline'>{entry.level}</Badge>
              <span>{entry.source}</span>
              <span>{entry.timestamp}</span>
            </div>
            <p className='mt-2 text-sm'>{entry.message}</p>
          </div>
        ))
      ) : (
        <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
          No recent log preview entries yet.
        </div>
      )}
    </div>
  )
}

function ServiceDetailLoading() {
  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-4 w-96' />
      </div>
      <div className='grid gap-4 md:grid-cols-3'>
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        <Skeleton className='h-80 w-full lg:col-span-2' />
        <Skeleton className='h-80 w-full' />
      </div>
    </div>
  )
}

export function ServiceDetail({ serviceId }: { serviceId: string }) {
  const serviceQuery = useDashboardService(serviceId)

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
        {serviceQuery.isLoading ? (
          <ServiceDetailLoading />
        ) : !serviceQuery.data ? (
          <Card>
            <CardHeader>
              <CardTitle>Service not found</CardTitle>
              <CardDescription>
                The requested service is not present in the current stub.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant='outline'>
                <Link to='/services'>
                  <ArrowLeft className='mr-2 size-4' />
                  Back to services
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          (() => {
            const service = serviceQuery.data

            return (
              <>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='space-y-3'>
                    <div className='flex items-center gap-3'>
                      <Button asChild size='sm' variant='outline'>
                        <Link to='/services'>
                          <ArrowLeft className='mr-2 size-4' />
                          Services
                        </Link>
                      </Button>
                      <StatusBadge status={service.status} />
                      <HealthBadge health={service.runtimeHealth.health} />
                    </div>
                    <div>
                      <h2 className='text-2xl font-bold tracking-tight'>
                        {service.name}
                      </h2>
                      <p className='text-sm text-muted-foreground'>
                        {service.id} · {service.role}
                      </p>
                      <p className='mt-2 text-muted-foreground'>
                        {service.note}
                      </p>
                    </div>
                  </div>
                </div>

                <div className='grid gap-4 md:grid-cols-3'>
                  <Card>
                    <CardHeader className='pb-2'>
                      <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                        <HeartPulse className='size-4' /> Runtime + health
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-2 text-sm'>
                      <div>
                        <div className='font-medium'>Summary</div>
                        <p className='text-muted-foreground'>
                          {service.runtimeHealth.summary}
                        </p>
                      </div>
                      <div className='text-muted-foreground'>
                        Uptime: {service.runtimeHealth.uptime}
                      </div>
                      <div className='text-muted-foreground'>
                        Last check: {service.runtimeHealth.lastCheckAt}
                      </div>
                      <div className='text-muted-foreground'>
                        Last restart:{' '}
                        {service.runtimeHealth.lastRestartAt ?? 'Not recorded'}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className='pb-2'>
                      <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                        <PackageCheck className='size-4' /> Build + install
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-2 text-sm text-muted-foreground'>
                      <div>Type: {service.metadata.serviceType}</div>
                      <div>Runtime: {service.metadata.runtime}</div>
                      <div>Version: {service.metadata.version}</div>
                      <div>Build: {service.metadata.build}</div>
                      <div>Installed: {service.installed ? 'Yes' : 'No'}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className='pb-2'>
                      <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                        <Wrench className='size-4' /> Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-2'>
                      {service.actions.map((action) => (
                        <div
                          key={action.id}
                          className='flex items-center justify-between rounded-lg border px-3 py-2 text-sm'
                        >
                          <span>{action.label}</span>
                          <Badge variant='outline'>{action.kind}</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <div className='grid gap-4 lg:grid-cols-3'>
                  <Card className='lg:col-span-2'>
                    <CardHeader>
                      <CardTitle className='flex items-center gap-2'>
                        <Link2 className='size-4' /> Endpoints + exposure
                      </CardTitle>
                      <CardDescription>
                        Operator-facing entry points and bind/exposure facts for
                        this service.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='grid gap-3 sm:grid-cols-2'>
                      {service.endpoints.map((endpoint) => (
                        <EndpointCard
                          key={`${endpoint.label}-${endpoint.url}`}
                          endpoint={endpoint}
                        />
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className='flex items-center gap-2'>
                        <ScanSearch className='size-4' /> Runtime metadata
                      </CardTitle>
                      <CardDescription>
                        Concrete service facts useful during operator review.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-3 text-sm'>
                      <div>
                        <div className='font-medium'>Package</div>
                        <div className='break-all text-muted-foreground'>
                          {service.metadata.packageId ?? 'Not recorded'}
                        </div>
                      </div>
                      <div>
                        <div className='font-medium'>Install path</div>
                        <div className='break-all text-muted-foreground'>
                          {service.metadata.installPath ?? 'Not recorded'}
                        </div>
                      </div>
                      <div>
                        <div className='font-medium'>Config path</div>
                        <div className='break-all text-muted-foreground'>
                          {service.metadata.configPath ?? 'Not recorded'}
                        </div>
                      </div>
                      <div>
                        <div className='font-medium'>Data path</div>
                        <div className='break-all text-muted-foreground'>
                          {service.metadata.dataPath ?? 'Not recorded'}
                        </div>
                      </div>
                      <div>
                        <div className='font-medium'>Profile</div>
                        <div className='text-muted-foreground'>
                          {service.metadata.profile ?? 'Not recorded'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className='grid gap-4 lg:grid-cols-2'>
                  <Card>
                    <CardHeader>
                      <CardTitle>Dependencies + relationships</CardTitle>
                      <CardDescription>
                        Local dependency slice for this service, with the
                        broader graph intended to live on the Dependencies page.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-5'>
                      <RelationshipList
                        title='Depends on'
                        items={service.dependencies}
                      />
                      <RelationshipList
                        title='Dependents'
                        items={service.dependents}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Diagnostics + recent logs</CardTitle>
                      <CardDescription>
                        Recent activity preview plus the next operator jump
                        points.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <LogPreview entries={service.recentLogs} />
                      <div className='grid gap-2 sm:grid-cols-2'>
                        <Button variant='outline' asChild>
                          <Link to='/logs' search={{ service: service.id }}>
                            Open live logs
                          </Link>
                        </Button>
                        <Button variant='outline' asChild>
                          <Link
                            to='/dependencies'
                            search={{ service: service.id }}
                          >
                            Open dependencies
                          </Link>
                        </Button>
                        <Button variant='outline' asChild>
                          <Link to='/network'>Open network view</Link>
                        </Button>
                        <Button variant='outline' asChild>
                          <Link to='/runtime' search={{ service: service.id }}>
                            Open runtime view
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )
          })()
        )}
      </Main>
    </>
  )
}
