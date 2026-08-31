import { useMemo, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { PauseCircle, PlayCircle, ScrollText } from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
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
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import { HeaderActions, usePageToolbar } from '@/components/page-toolbar'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ALL_LOG_SOURCE, canonicalLogSourceId } from './provider'
import { ServiceLazyLogViewer } from './service-log-viewer'

const route = getRouteApi('/_authenticated/logs/')

function selectedServiceFromSearch(
  services: DashboardService[],
  selectedId?: string
) {
  return (
    services.find((service) => service.id === selectedId) ?? services[0] ?? null
  )
}

function StatusBadge({ status }: { status: DashboardService['status'] }) {
  if (status === 'running') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Running</Badge>
    )
  }
  if (status === 'available') {
    return <Badge className='bg-sky-600 hover:bg-sky-600'>Available</Badge>
  }
  if (status === 'degraded') return <Badge variant='secondary'>Degraded</Badge>
  return <Badge variant='outline'>Stopped</Badge>
}

function LogsLoading() {
  return (
    <div className='grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]'>
      <Skeleton className='min-h-0 flex-1' />
      <Skeleton className='min-h-0 flex-1' />
    </div>
  )
}

export function Logs() {
  usePageMetadata({
    title: 'Service Admin - Logs',
    description:
      'Service Admin log viewing surface for Service Lasso services.',
  })
  usePageToolbar({
    quickNav: [
      { id: 'services', label: 'Services', to: '/services' },
      { id: 'runtime', label: 'Runtime', to: '/runtime' },
    ],
  })

  const searchState = route.useSearch()
  const navigate = route.useNavigate()
  const servicesQuery = useServices()
  const [paused, setPaused] = useState(true)
  const [serviceQuery, setServiceQuery] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')

  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data])
  const effectiveSelectedServiceId = searchState.service ?? selectedServiceId
  const selectedSource = canonicalLogSourceId(
    searchState.source ?? ALL_LOG_SOURCE
  )

  const filteredServices = useMemo(() => {
    const normalized = serviceQuery.trim().toLowerCase()
    if (!normalized) return services

    return services.filter((service) =>
      [service.name, service.id, service.status]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    )
  }, [serviceQuery, services])

  const selectedService = useMemo(() => {
    return (
      filteredServices.find(
        (service) => service.id === effectiveSelectedServiceId
      ) ?? selectedServiceFromSearch(services, effectiveSelectedServiceId)
    )
  }, [effectiveSelectedServiceId, filteredServices, services])

  const selectService = (serviceId: string) => {
    setSelectedServiceId(serviceId)
    void navigate({
      search: (previous) => ({
        ...(previous as Record<string, unknown>),
        service: serviceId,
        source: searchState.source,
      }),
    })
  }

  const selectSource = (source: ReturnType<typeof canonicalLogSourceId>) => {
    const canonicalSource = canonicalLogSourceId(source)
    void navigate({
      search: (previous) => ({
        ...(previous as Record<string, unknown>),
        service: selectedService?.id,
        source:
          canonicalSource === ALL_LOG_SOURCE ? undefined : canonicalSource,
      }),
    })
  }

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
        {servicesQuery.isLoading ? (
          <LogsLoading />
        ) : (
          <div className='grid min-h-0 min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]'>
            <Card className='flex min-h-0 min-w-0 flex-col overflow-hidden'>
              <CardHeader className='shrink-0'>
                <CardTitle>Services</CardTitle>
                <CardDescription>
                  Search and select the service whose logs you want to inspect.
                </CardDescription>
              </CardHeader>
              <CardContent className='flex min-h-0 min-w-0 flex-1 flex-col gap-4'>
                <Input
                  value={serviceQuery}
                  onChange={(event) => setServiceQuery(event.target.value)}
                  placeholder='Search services...'
                  className='h-9 shrink-0'
                />
                <div className='min-h-0 min-w-0 flex-1 overflow-auto rounded-md border'>
                  <Table contained={false}>
                    <TableHeader className='sticky top-0 z-10 bg-background'>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredServices.length ? (
                        filteredServices.map((service) => (
                          <TableRow
                            key={service.id}
                            className='cursor-pointer'
                            data-state={
                              selectedService?.id === service.id
                                ? 'selected'
                                : undefined
                            }
                            onClick={() => selectService(service.id)}
                          >
                            <TableCell>
                              <div className='flex min-w-0 flex-col'>
                                <span className='font-medium break-words'>
                                  {service.name}
                                </span>
                                <span className='text-xs break-words text-muted-foreground'>
                                  {service.id}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={service.status} />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} className='h-24 text-center'>
                            No services match the current search.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className='flex min-h-0 min-w-0 flex-col overflow-hidden'>
              <CardHeader className='shrink-0'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <CardTitle className='flex items-center gap-2'>
                      <ScrollText className='size-4' /> Log entries
                    </CardTitle>
                    <CardDescription className='break-words'>
                      {selectedService
                        ? `${selectedService.name} log output via resolved service endpoint.`
                        : 'Select a service to inspect logs.'}
                    </CardDescription>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => setPaused((current) => !current)}
                    >
                      {paused ? (
                        <>
                          <PlayCircle className='mr-2 size-4' /> Resume follow
                        </>
                      ) : (
                        <>
                          <PauseCircle className='mr-2 size-4' /> Pause follow
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className='flex min-h-0 min-w-0 flex-1 flex-col'>
                <ServiceLazyLogViewer
                  service={selectedService}
                  selectedSource={selectedSource}
                  onSourceChange={selectSource}
                  paused={paused}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </Main>
    </>
  )
}
