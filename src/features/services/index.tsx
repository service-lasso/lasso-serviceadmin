import { getRouteApi } from '@tanstack/react-router'
import { Play, RotateCcw, Square } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  useDashboardAction,
  useServices,
} from '@/lib/service-lasso-dashboard/hooks'
import { Button } from '@/components/ui/button'
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
  const actionMutation = useDashboardAction()

  const services = servicesQuery.data ?? []
  const actionsDisabled = actionMutation.isPending || services.length === 0

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
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              type='button'
              size='sm'
              disabled={actionsDisabled}
              onClick={() => actionMutation.mutate('start-services')}
            >
              <Play className='size-3.5' />
              Start all
            </Button>
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={actionsDisabled}
              onClick={() => actionMutation.mutate('stop-services')}
            >
              <Square className='size-3.5' />
              Stop all
            </Button>
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={actionsDisabled}
              onClick={() => actionMutation.mutate('restart-services')}
            >
              <RotateCcw className='size-3.5' />
              Restart all
            </Button>
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
