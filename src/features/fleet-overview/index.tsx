import { Building2, MapPinned, ShieldCheck } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
  countFleetInstancesByKind,
  fleetDiscoveryAssumptions,
  fleetInstanceSummaries,
  fleetSecurityBoundaries,
  type FleetInstanceHealth,
  type FleetInstanceKind,
} from './fleet-overview'

const kindVariant: Record<
  FleetInstanceKind,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  local: 'default',
  'future-remote': 'outline',
}

const healthVariant: Record<
  FleetInstanceHealth,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  healthy: 'default',
  degraded: 'destructive',
  unknown: 'secondary',
  planned: 'outline',
}

export function FleetOverviewPage() {
  const counts = countFleetInstancesByKind()
  const localInstance = fleetInstanceSummaries.find(
    (instance) => instance.kind === 'local'
  )

  usePageMetadata({
    title: 'Service Admin - Fleet Overview',
    description:
      'Local-only multi-instance and fleet overview planning metadata surface.',
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
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <Building2 className='size-5' /> Fleet overview planning
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Planning metadata for future Service Lasso multi-instance and
              fleet visibility. Today this is explicitly local-only: remote
              instances are placeholders, with no remote control, cross-instance
              secret access, or privileged fleet actions.
            </p>
          </div>
          <Badge variant='secondary'>Local-only current state</Badge>
        </div>

        <Alert>
          <ShieldCheck className='size-4' />
          <AlertTitle>No cross-instance control in this slice</AlertTitle>
          <AlertDescription>
            This surface models metadata shape and security boundaries only. It
            does not create remote connections, store credentials, read remote
            logs, or access Secrets Broker values across instances.
          </AlertDescription>
        </Alert>

        <div className='grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total modeled instances</CardDescription>
              <CardTitle className='text-3xl'>
                {fleetInstanceSummaries.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Local active</CardDescription>
              <CardTitle className='text-3xl'>{counts.local}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Future remote placeholders</CardDescription>
              <CardTitle className='text-3xl'>
                {counts['future-remote']}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Local services</CardDescription>
              <CardTitle className='text-3xl'>
                {localInstance?.servicesCount ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Instance summaries</CardTitle>
            <CardDescription>
              Current local instance plus future remote placeholders. Rows show
              metadata and boundaries only.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {fleetInstanceSummaries.map((instance) => (
              <div key={instance.id} className='rounded-lg border p-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <h2 className='font-semibold'>{instance.name}</h2>
                      <Badge variant={kindVariant[instance.kind]}>
                        {instance.kind === 'local' ? 'Local' : 'Future remote'}
                      </Badge>
                      <Badge variant={healthVariant[instance.health]}>
                        {instance.health}
                      </Badge>
                    </div>
                    <p className='mt-1 text-sm text-muted-foreground'>
                      {instance.securityBoundary}
                    </p>
                  </div>
                  <Badge variant='outline'>{instance.brokerState}</Badge>
                </div>

                <div className='mt-4 grid gap-3 text-sm md:grid-cols-3'>
                  <div className='rounded-md border p-3'>
                    <div className='text-muted-foreground'>Instance id</div>
                    <div className='font-medium break-all'>{instance.id}</div>
                  </div>
                  <div className='rounded-md border p-3'>
                    <div className='text-muted-foreground'>Version</div>
                    <div className='font-medium'>{instance.version}</div>
                  </div>
                  <div className='rounded-md border p-3'>
                    <div className='text-muted-foreground'>Last check</div>
                    <div className='font-medium'>{instance.lastCheck}</div>
                  </div>
                  <div className='rounded-md border p-3'>
                    <div className='text-muted-foreground'>Region</div>
                    <div className='font-medium'>{instance.region}</div>
                  </div>
                  <div className='rounded-md border p-3'>
                    <div className='text-muted-foreground'>Services</div>
                    <div className='font-medium'>{instance.servicesCount}</div>
                  </div>
                  <div className='rounded-md border p-3'>
                    <div className='text-muted-foreground'>Discovery ref</div>
                    <div className='font-medium break-all'>
                      {instance.discoveryRef}
                    </div>
                  </div>
                  <div className='rounded-md border p-3 md:col-span-3'>
                    <div className='text-muted-foreground'>
                      Registration state
                    </div>
                    <div className='font-medium'>
                      {instance.registrationState}
                    </div>
                  </div>
                </div>

                <div className='mt-4 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-md border p-3'>
                    <div className='text-sm font-medium'>Available now</div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-sm text-muted-foreground'>
                      {instance.allowedActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                  <div className='rounded-md border p-3'>
                    <div className='text-sm font-medium'>Unavailable here</div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-sm text-muted-foreground'>
                      {instance.unavailableActions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <MapPinned className='size-4' /> Discovery assumptions
              </CardTitle>
              <CardDescription>
                Explicit assumptions before adding any real remote registration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className='list-disc space-y-2 ps-5 text-sm text-muted-foreground'>
                {fleetDiscoveryAssumptions.map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security boundaries</CardTitle>
              <CardDescription>
                Guardrails for future fleet work and current local-only UI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className='list-disc space-y-2 ps-5 text-sm text-muted-foreground'>
                {fleetSecurityBoundaries.map((boundary) => (
                  <li key={boundary}>{boundary}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
