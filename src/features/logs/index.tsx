import { useEffect, useMemo, useState } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import { LazyLog, ScrollFollow } from '@melloware/react-logviewer'
import { Activity, PauseCircle, PlayCircle, ScrollText, Wifi } from 'lucide-react'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import { usePageMetadata } from '@/lib/page-metadata'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import {
  debugLogs,
  fetchServiceLogInfo,
  fetchServiceLogText,
  resolveServiceLogContentUrl,
  type ServiceLogInfo,
} from './provider'
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
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

const route = getRouteApi('/_authenticated/logs/')

function selectedServiceFromSearch(
  services: DashboardService[],
  selectedId?: string
) {
  return services.find((service) => service.id === selectedId) ?? services[0] ?? null
}

function StatusBadge({ status }: { status: DashboardService['status'] }) {
  if (status === 'running') {
    return <Badge className='bg-emerald-600 hover:bg-emerald-600'>Running</Badge>
  }
  if (status === 'degraded') return <Badge variant='secondary'>Degraded</Badge>
  return <Badge variant='outline'>Stopped</Badge>
}

function LogsLoading() {
  return (
    <div className='space-y-4'>
      <div className='grid gap-4 md:grid-cols-3'>
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
      </div>
      <div className='grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]'>
        <Skeleton className='h-96 w-full' />
        <Skeleton className='h-96 w-full' />
      </div>
    </div>
  )
}


function RealServiceLogViewer({
  service,
  paused,
  logText,
}: {
  service: DashboardService
  paused: boolean
  logText: string
}) {
  const logUrl = resolveServiceLogContentUrl(service, 'default')

  useEffect(() => {
    debugLogs('lazylog mount', {
      serviceId: service.id,
      paused,
      logUrl,
      textLength: logText.length,
    })

    return () => {
      debugLogs('lazylog unmount', {
        serviceId: service.id,
        logUrl,
      })
    }
  }, [logText.length, logUrl, paused, service.id])

  return (
    <div
      className='overflow-hidden rounded-md border'
      style={{ height: '640px', minHeight: '640px' }}
    >
      <ScrollFollow
        startFollowing={!paused}
        render={({ follow, onScroll }) => (
          <LazyLog
            caseInsensitive
            enableSearch
            extraLines={1}
            follow={follow}
            selectableLines
            text={logText}
            onLoad={() => {
              debugLogs('lazylog onLoad', {
                serviceId: service.id,
                logUrl,
                textLength: logText.length,
              })
            }}
            onError={(error) => {
              debugLogs('lazylog onError', {
                serviceId: service.id,
                logUrl,
                error: error instanceof Error ? error.message : String(error),
              })
            }}
            onScroll={(args) => {
              debugLogs('lazylog onScroll', {
                serviceId: service.id,
                logUrl,
                ...args,
              })
              onScroll(args)
            }}
            style={{
              height: '640px',
              minHeight: '640px',
              width: '100%',
              background: 'transparent',
            }}
          />
        )}
      />
    </div>
  )
}

function ServiceLazyLogViewer({
  service,
  paused,
}: {
  service: DashboardService | null
  paused: boolean
}) {
  const [logInfo, setLogInfo] = useState<ServiceLogInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logText, setLogText] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      if (!service) {
        debugLogs('loadInitial skipped because no service is selected')
        setLogInfo(null)
        setLogText('')
        setLoading(false)
        setError(null)
        return
      }

      debugLogs('loadInitial start', {
        serviceId: service.id,
        paused,
      })

      try {
        setLoading(true)
        setError(null)
        const info = await fetchServiceLogInfo(service, 'default')
        const text = await fetchServiceLogText(service, 'default')
        if (cancelled) return
        setLogInfo(info)
        setLogText(text)
        debugLogs('loadInitial state applied', {
          serviceId: service.id,
          logPath: info.path,
          contentUrl: resolveServiceLogContentUrl(service, 'default'),
          textLength: text.length,
        })
      } catch (error) {
        if (cancelled) return
        debugLogs('loadInitial failed', {
          serviceId: service.id,
          error: error instanceof Error ? error.message : String(error),
        })
        setError('Unable to load log content right now.')
        setLogInfo(null)
        setLogText('')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadInitial()
    return () => {
      cancelled = true
    }
  }, [service?.id])

  useEffect(() => {
    debugLogs('viewer render state', {
      serviceId: service?.id ?? null,
      hasError: Boolean(error),
      loading,
      logPath: logInfo?.path ?? null,
      contentUrl: service ? resolveServiceLogContentUrl(service, 'default') : null,
      textLength: logText.length,
    })
  }, [error, loading, logInfo?.path, logText.length, service])

  if (!service) {
    return (
      <div className='flex h-[640px] items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground'>
        Select a service to inspect logs.
      </div>
    )
  }

  if (error) {
    return (
      <div className='flex h-[640px] items-center justify-center rounded-md border bg-muted/30 px-6 text-sm text-destructive'>
        {error}
      </div>
    )
  }

  if (loading) {
    return <Skeleton className='h-[640px] w-full' />
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground'>
        <div>
          Source: <span className='font-medium'>{logInfo?.path ?? service.metadata.logPath ?? 'resolved by service endpoint'}</span>
        </div>
      </div>
      <RealServiceLogViewer
        key={`${service.id}:${logInfo?.path ?? 'default'}`}
        service={service}
        paused={paused}
        logText={logText}
      />
    </div>
  )
}

export function Logs() {
  usePageMetadata({
    title: 'Service Admin - Logs',
    description: 'Service Admin log viewing surface for Service Lasso services.',
  })

  const searchState = route.useSearch()
  const servicesQuery = useServices()
  const [paused, setPaused] = useState(true)
  const [serviceQuery, setServiceQuery] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState(searchState.service ?? '')

  const services = servicesQuery.data ?? []

  useEffect(() => {
    if (searchState.service) {
      setSelectedServiceId(searchState.service)
    }
  }, [searchState.service])

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
      filteredServices.find((service) => service.id === selectedServiceId) ??
      selectedServiceFromSearch(services, selectedServiceId)
    )
  }, [filteredServices, selectedServiceId, services])

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
            <h2 className='text-2xl font-bold tracking-tight'>Logs</h2>
            <p className='text-muted-foreground'>
              Safe service log viewer backed by service-resolved API endpoints.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services' search={{}}>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/runtime' search={{}}>Runtime</Link>
            </Button>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <LogsLoading />
        ) : (
          <>
            <div className='grid gap-4 md:grid-cols-3'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                    <ScrollText className='size-4' /> Selected service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {selectedService ? selectedService.name : 'None'}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Choose a service from the table to change log context.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                    <Wifi className='size-4' /> Viewer mode
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {paused ? 'Paused' : 'Following'}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Uses the resolved service log endpoint and scroll-follow behavior.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                    <Activity className='size-4' /> Source
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-sm font-medium'>
                    {selectedService?.metadata.logPath ?? 'Resolved by API'}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    The browser only requests service + type. The server resolves the real path.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className='grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]'>
              <Card>
                <CardHeader>
                  <CardTitle>Services</CardTitle>
                  <CardDescription>
                    Search and select the service whose logs you want to inspect.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <Input
                    value={serviceQuery}
                    onChange={(event) => setServiceQuery(event.target.value)}
                    placeholder='Search services...'
                    className='h-9'
                  />
                  <div className='overflow-hidden rounded-md border'>
                    <Table>
                      <TableHeader>
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
                              data-state={selectedService?.id === service.id ? 'selected' : undefined}
                              onClick={() => setSelectedServiceId(service.id)}
                            >
                              <TableCell>
                                <div className='flex min-w-0 flex-col'>
                                  <span className='font-medium'>{service.name}</span>
                                  <span className='text-xs text-muted-foreground'>{service.id}</span>
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

              <Card>
                <CardHeader>
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <CardTitle className='flex items-center gap-2'>
                        <ScrollText className='size-4' /> Log entries
                      </CardTitle>
                      <CardDescription>
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
                <CardContent>
                  <ServiceLazyLogViewer service={selectedService} paused={paused} />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </Main>
    </>
  )
}
