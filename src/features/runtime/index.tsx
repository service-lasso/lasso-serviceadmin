import { Link, getRouteApi } from '@tanstack/react-router'
import { Activity, Clock3, HeartPulse, RotateCcw } from 'lucide-react'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
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

const route = getRouteApi('/_authenticated/runtime/')

function selectedServiceFromSearch(
  services: DashboardService[],
  selectedId?: string
) {
  return (
    services.find((service) => service.id === selectedId) ?? services[0] ?? null
  )
}

function RuntimeLoading() {
  return (
    <div className='space-y-4'>
      <div className='grid gap-4 md:grid-cols-3'>
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        <Skeleton className='h-96 w-full' />
        <Skeleton className='h-96 w-full lg:col-span-2' />
      </div>
    </div>
  )
}

export function Runtime() {
  const searchState = route.useSearch()
  const navigate = route.useNavigate()
  const servicesQuery = useServices()

  const services = servicesQuery.data ?? []
  const selectedService = selectedServiceFromSearch(
    services,
    searchState.service
  )

  const selectService = (serviceId: string) => {
    navigate({
      search: (prev) => ({
        ...(prev as Record<string, unknown>),
        service: serviceId,
      }),
    })
  }

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
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Runtime</h2>
            <p className='text-muted-foreground'>
              Review current runtime state, health timing, and service restart
              context without mixing it up with the full logs flow.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/network'>Network</Link>
            </Button>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <RuntimeLoading />
        ) : (
          <>
            <div className='grid gap-4 md:grid-cols-3'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                    <Activity className='size-4' /> Selected service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {selectedService ? selectedService.name : 'None'}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Current runtime focus.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                    <HeartPulse className='size-4' /> Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {selectedService
                      ? selectedService.runtimeHealth.health
                      : 'Unknown'}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Most recent runtime health signal.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                    <RotateCcw className='size-4' /> Uptime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {selectedService
                      ? selectedService.runtimeHealth.uptime
                      : 'n/a'}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Current uptime for the selected service.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className='grid gap-4 lg:grid-cols-3'>
              <Card>
                <CardHeader>
                  <CardTitle>Services</CardTitle>
                  <CardDescription>
                    Select the runtime context to inspect.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {services.map((service) => (
                    <button
                      key={service.id}
                      type='button'
                      onClick={() => selectService(service.id)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/40 ${selectedService?.id === service.id ? 'border-primary bg-accent/30' : ''}`}
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <div>
                          <div className='font-medium'>{service.name}</div>
                          <div className='text-xs text-muted-foreground'>
                            {service.id}
                          </div>
                        </div>
                        <Badge variant='outline'>{service.status}</Badge>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className='lg:col-span-2'>
                <CardHeader>
                  <CardTitle>Runtime state</CardTitle>
                  <CardDescription>
                    Current runtime and health facts for the selected service.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {selectedService ? (
                    <>
                      <div className='grid gap-4 md:grid-cols-2'>
                        <div className='rounded-lg border p-4'>
                          <div className='mb-2 font-medium'>State summary</div>
                          <p className='text-sm text-muted-foreground'>
                            {selectedService.runtimeHealth.summary}
                          </p>
                        </div>
                        <div className='rounded-lg border p-4'>
                          <div className='mb-2 font-medium'>Timing</div>
                          <div className='space-y-2 text-sm text-muted-foreground'>
                            <div className='flex items-center gap-2'>
                              <Clock3 className='size-4' /> Last check:{' '}
                              {selectedService.runtimeHealth.lastCheckAt}
                            </div>
                            <div>
                              Last restart:{' '}
                              {selectedService.runtimeHealth.lastRestartAt ??
                                'Not recorded'}
                            </div>
                            <div>
                              Uptime: {selectedService.runtimeHealth.uptime}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className='grid gap-3 md:grid-cols-2'>
                        {selectedService.actions.map((action) => (
                          <div
                            key={action.id}
                            className='rounded-lg border p-3'
                          >
                            <div className='font-medium'>{action.label}</div>
                            <div className='text-xs text-muted-foreground'>
                              {action.kind}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className='flex flex-wrap gap-2'>
                        <Button variant='outline' asChild>
                          <Link
                            to='/services/$serviceId'
                            params={{ serviceId: selectedService.id }}
                          >
                            Open service details
                          </Link>
                        </Button>
                        <Button variant='outline' asChild>
                          <Link
                            to='/logs'
                            search={{ service: selectedService.id }}
                          >
                            Open live logs
                          </Link>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
                      No service selected.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </Main>
    </>
  )
}
