import { Link } from '@tanstack/react-router'
import { Globe, Link2, Network as NetworkIcon } from 'lucide-react'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
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

function NetworkLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-40' />
        <Skeleton className='h-4 w-80' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[420px] w-full' />
      </CardContent>
    </Card>
  )
}

export function Network() {
  const servicesQuery = useServices()
  const services = servicesQuery.data ?? []

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
            <h2 className='text-2xl font-bold tracking-tight'>Network</h2>
            <p className='text-muted-foreground'>
              Review bind addresses, exposed URLs, ports, and route surfaces in
              one operator-facing network view.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/runtime'>Runtime</Link>
            </Button>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <NetworkLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <NetworkIcon className='size-4' /> Service endpoints
              </CardTitle>
              <CardDescription>
                Clickable local/LAN/remote endpoints with exposure facts.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {services.map((service) => (
                <div key={service.id} className='rounded-lg border p-4'>
                  <div className='mb-4 flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <div className='font-medium'>{service.name}</div>
                      <div className='text-xs text-muted-foreground'>
                        {service.id}
                      </div>
                    </div>
                    <Button variant='outline' size='sm' asChild>
                      <Link
                        to='/services/$serviceId'
                        params={{ serviceId: service.id }}
                      >
                        Open service details
                      </Link>
                    </Button>
                  </div>
                  <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                    {service.endpoints.map((endpoint) => (
                      <div
                        key={`${service.id}-${endpoint.url}`}
                        className='rounded-lg border bg-muted/20 p-3'
                      >
                        <div className='mb-2 flex items-center gap-2 font-medium'>
                          <Globe className='size-4' /> {endpoint.label}
                        </div>
                        <div className='space-y-1 text-sm text-muted-foreground'>
                          <div className='break-all'>{endpoint.url}</div>
                          <div>
                            {endpoint.protocol.toUpperCase()} · {endpoint.bind}:
                            {endpoint.port}
                          </div>
                          <div>Exposure: {endpoint.exposure}</div>
                        </div>
                        <div className='mt-3'>
                          <Button variant='outline' size='sm' asChild>
                            <a
                              href={endpoint.url}
                              target='_blank'
                              rel='noreferrer'
                            >
                              Open endpoint
                              <Link2 className='ml-2 size-3.5' />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </Main>
    </>
  )
}
