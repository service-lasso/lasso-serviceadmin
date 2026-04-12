import { getRouteApi } from '@tanstack/react-router'
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ServicesTable } from './components/services-table'

const route = getRouteApi('/_authenticated/services/')

function ServicesLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-40' />
        <Skeleton className='h-4 w-96' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[420px] w-full' />
      </CardContent>
    </Card>
  )
}

export function Services() {
  usePageMetadata({
    title: 'Service Admin - Services',
    description: 'Service Admin services list for Service Lasso operators.',
  })

  const search = route.useSearch()
  const navigate = route.useNavigate()
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
            <h2 className='text-2xl font-bold tracking-tight'>Services</h2>
            <p className='text-muted-foreground'>
              Manage Service Lasso services, inspect runtime state, and open the
              detail view from the table below.
            </p>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <ServicesLoading />
        ) : (
          <ServicesTable data={services} search={search} navigate={navigate} />
        )}
      </Main>
    </>
  )
}
