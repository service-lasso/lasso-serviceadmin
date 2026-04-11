import { Link, getRouteApi } from '@tanstack/react-router'
import { FolderCog, PackageCheck, ScanSearch } from 'lucide-react'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
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

const route = getRouteApi('/_authenticated/installed/')

function InstalledLoading() {
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

export function Installed() {
  const searchState = route.useSearch()
  const servicesQuery = useServices()

  const query = (searchState.filter ?? '').toLowerCase()
  const services = (servicesQuery.data ?? []).filter((service) => {
    if (!query) return true
    return (
      service.name.toLowerCase().includes(query) ||
      service.id.toLowerCase().includes(query) ||
      service.metadata.version.toLowerCase().includes(query)
    )
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

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Installed</h2>
            <p className='text-muted-foreground'>
              Review installed-state facts, versions, package identifiers, and
              path references in a table-style operator view.
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
          <InstalledLoading />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <PackageCheck className='size-4' /> Installed services
              </CardTitle>
              <CardDescription>
                Current install/build facts for services in the stub model.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              {services.map((service) => (
                <div key={service.id} className='rounded-lg border p-4'>
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <div className='font-medium'>{service.name}</div>
                      <div className='text-xs text-muted-foreground'>
                        {service.id}
                      </div>
                    </div>
                    <Badge variant={service.installed ? 'default' : 'outline'}>
                      {service.installed ? 'Installed' : 'Missing'}
                    </Badge>
                  </div>
                  <div className='mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4'>
                    <div>
                      <div className='font-medium'>Version</div>
                      <div className='text-muted-foreground'>
                        {service.metadata.version}
                      </div>
                    </div>
                    <div>
                      <div className='font-medium'>Runtime</div>
                      <div className='text-muted-foreground'>
                        {service.metadata.runtime}
                      </div>
                    </div>
                    <div>
                      <div className='font-medium'>Build</div>
                      <div className='text-muted-foreground'>
                        {service.metadata.build}
                      </div>
                    </div>
                    <div>
                      <div className='font-medium'>Package</div>
                      <div className='break-all text-muted-foreground'>
                        {service.metadata.packageId ?? 'Not recorded'}
                      </div>
                    </div>
                  </div>
                  <div className='mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3'>
                    <div className='rounded-md bg-muted/40 p-3'>
                      <div className='mb-1 flex items-center gap-2 font-medium'>
                        <FolderCog className='size-4' /> Install path
                      </div>
                      <div className='break-all text-muted-foreground'>
                        {service.metadata.installPath ?? 'Not recorded'}
                      </div>
                    </div>
                    <div className='rounded-md bg-muted/40 p-3'>
                      <div className='mb-1 flex items-center gap-2 font-medium'>
                        <ScanSearch className='size-4' /> Config path
                      </div>
                      <div className='break-all text-muted-foreground'>
                        {service.metadata.configPath ?? 'Not recorded'}
                      </div>
                    </div>
                    <div className='rounded-md bg-muted/40 p-3'>
                      <div className='mb-1 flex items-center gap-2 font-medium'>
                        <FolderCog className='size-4' /> Data path
                      </div>
                      <div className='break-all text-muted-foreground'>
                        {service.metadata.dataPath ?? 'Not recorded'}
                      </div>
                    </div>
                  </div>
                  <div className='mt-4'>
                    <Button variant='outline' size='sm' asChild>
                      <Link
                        to='/services/$serviceId'
                        params={{ serviceId: service.id }}
                      >
                        Open service details
                      </Link>
                    </Button>
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
