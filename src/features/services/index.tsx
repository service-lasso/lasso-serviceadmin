import { getRouteApi } from '@tanstack/react-router'
import { Play, RotateCcw, Square } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  useDashboardAction,
  useServices,
} from '@/lib/service-lasso-dashboard/hooks'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { HeaderActions, usePageToolbar } from '@/components/page-toolbar'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { AddServiceSourceDialog } from './components/add-service-source-dialog'
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

  usePageToolbar({
    actions: [
      {
        id: 'start-all',
        label: 'Start all',
        icon: Play,
        tone: 'start',
        disabled: actionsDisabled,
        onClick: () => actionMutation.mutate('start-services'),
      },
      {
        id: 'stop-all',
        label: 'Stop all',
        icon: Square,
        tone: 'stop',
        disabled: actionsDisabled,
        onClick: () => actionMutation.mutate('stop-services'),
      },
      {
        id: 'restart-all',
        label: 'Restart all',
        icon: RotateCcw,
        tone: 'restart',
        disabled: actionsDisabled,
        onClick: () => actionMutation.mutate('restart-services'),
      },
    ],
  })

  return (
    <>
      <Header fixed>
        <Search />
        <HeaderActions>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </HeaderActions>
      </Header>

      <Main fixed className='min-h-0 gap-4 sm:gap-6'>
        <div className='flex shrink-0 flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Services</h2>
            <p className='text-muted-foreground'>
              Manage Service Lasso services, inspect runtime state, and open the
              detail view from the table below.
            </p>
          </div>
          <AddServiceSourceDialog />
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
