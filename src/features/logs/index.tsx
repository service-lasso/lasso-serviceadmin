import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import { LazyLog, ScrollFollow } from '@melloware/react-logviewer'
import { Activity, PauseCircle, PlayCircle, ScrollText, Wifi } from 'lucide-react'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import { usePageMetadata } from '@/lib/page-metadata'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import {
  debugLogs,
  fetchServiceLogChunk,
  fetchServiceLogInfo,
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


const DEFAULT_LOG_CHUNK_SIZE = 100
const LOAD_OLDER_THRESHOLD_PX = 48
const FOLLOW_POLL_MS = 4000

type LogViewerScrollArgs = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

function RealServiceLogViewer({
  service,
  paused,
  lines,
  loadingOlder,
  hasMore,
  onScroll,
}: {
  service: DashboardService
  paused: boolean
  lines: string[]
  loadingOlder: boolean
  hasMore: boolean
  onScroll: (args: LogViewerScrollArgs) => void
}) {
  const logText = useMemo(() => lines.join('\n'), [lines])

  useEffect(() => {
    debugLogs('lazylog mount', {
      serviceId: service.id,
      paused,
      lineCount: lines.length,
    })

    return () => {
      debugLogs('lazylog unmount', {
        serviceId: service.id,
      })
    }
  }, [lines.length, paused, service.id])

  return (
    <div className='space-y-2'>
      <div
        className='overflow-hidden rounded-md border'
        style={{ height: '640px', minHeight: '640px' }}
      >
        <ScrollFollow
          startFollowing={!paused}
          render={({ follow, onScroll: handleFollowScroll }) => (
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
                  lineCount: lines.length,
                })
              }}
              onError={(error) => {
                debugLogs('lazylog onError', {
                  serviceId: service.id,
                  error: error instanceof Error ? error.message : String(error),
                })
              }}
              onScroll={(args) => {
                debugLogs('lazylog onScroll', {
                  serviceId: service.id,
                  ...args,
                })
                handleFollowScroll(args)
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
      <div className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
        <div>
          {loadingOlder
            ? 'Loading older lines...'
            : hasMore
              ? 'Scroll upward to load older lines.'
              : 'Reached the start of the file.'}
        </div>
        <div>{lines.length.toLocaleString()} loaded lines</div>
      </div>
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
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [totalLines, setTotalLines] = useState(0)
  const viewerRef = useRef<HTMLDivElement | null>(null)
  const prependAdjustmentRef = useRef<{
    scrollTop: number
    scrollHeight: number
  } | null>(null)

  const loadOlder = useCallback(async () => {
    if (!service || !hasMore || loadingOlder || nextBefore == null) {
      return
    }

    const scrollElement = viewerRef.current?.querySelector(
      '.react-lazylog'
    ) as HTMLElement | null

    prependAdjustmentRef.current = scrollElement
      ? {
          scrollTop: scrollElement.scrollTop,
          scrollHeight: scrollElement.scrollHeight,
        }
      : null

    try {
      setLoadingOlder(true)
      const olderChunk = await fetchServiceLogChunk(
        service,
        'default',
        nextBefore,
        DEFAULT_LOG_CHUNK_SIZE
      )

      setLines((current) => [...olderChunk.lines, ...current])
      setHasMore(olderChunk.hasMore)
      setNextBefore(olderChunk.nextBefore)
      setTotalLines(olderChunk.totalLines)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to load older log lines right now.'
      )
    } finally {
      setLoadingOlder(false)
    }
  }, [hasMore, loadingOlder, nextBefore, service])

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      if (!service) {
        debugLogs('loadInitial skipped because no service is selected')
        setLogInfo(null)
        setLines([])
        setHasMore(false)
        setNextBefore(null)
        setTotalLines(0)
        setLoading(false)
        setLoadingOlder(false)
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
        const [info, chunk] = await Promise.all([
          fetchServiceLogInfo(service, 'default'),
          fetchServiceLogChunk(service, 'default', undefined, DEFAULT_LOG_CHUNK_SIZE),
        ])

        if (cancelled) return

        setLogInfo(info)
        setLines(chunk.lines)
        setHasMore(chunk.hasMore)
        setNextBefore(chunk.nextBefore)
        setTotalLines(chunk.totalLines)

        debugLogs('loadInitial state applied', {
          serviceId: service.id,
          logPath: info.path,
          lineCount: chunk.lines.length,
          totalLines: chunk.totalLines,
          hasMore: chunk.hasMore,
          nextBefore: chunk.nextBefore,
        })
      } catch (error) {
        if (cancelled) return
        debugLogs('loadInitial failed', {
          serviceId: service.id,
          error: error instanceof Error ? error.message : String(error),
        })
        setError('Unable to load log content right now.')
        setLogInfo(null)
        setLines([])
        setHasMore(false)
        setNextBefore(null)
        setTotalLines(0)
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
  }, [paused, service?.id])

  useLayoutEffect(() => {
    const adjustment = prependAdjustmentRef.current
    if (!adjustment) return

    const scrollElement = viewerRef.current?.querySelector(
      '.react-lazylog'
    ) as HTMLElement | null

    if (scrollElement) {
      const nextScrollHeight = scrollElement.scrollHeight
      const scrollDelta = nextScrollHeight - adjustment.scrollHeight
      scrollElement.scrollTop = adjustment.scrollTop + scrollDelta
    }

    prependAdjustmentRef.current = null
  }, [lines])

  useEffect(() => {
    if (!service || paused || loading || loadingOlder) {
      return
    }

    const intervalId = window.setInterval(async () => {
      try {
        const newestChunk = await fetchServiceLogChunk(
          service,
          'default',
          undefined,
          DEFAULT_LOG_CHUNK_SIZE
        )

        setTotalLines((currentTotalLines) => {
          const appendedLineCount = newestChunk.totalLines - currentTotalLines

          if (appendedLineCount <= 0) {
            return currentTotalLines
          }

          setLines((currentLines) => {
            if (appendedLineCount > newestChunk.lines.length) {
              return newestChunk.lines
            }

            return [
              ...currentLines,
              ...newestChunk.lines.slice(-appendedLineCount),
            ]
          })

          if (appendedLineCount > newestChunk.lines.length) {
            setHasMore(newestChunk.hasMore)
            setNextBefore(newestChunk.nextBefore)
          }

          return newestChunk.totalLines
        })
      } catch (error) {
        debugLogs('follow poll failed', {
          serviceId: service.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }, FOLLOW_POLL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loading, loadingOlder, paused, service])

  const handleViewerScroll = useCallback(
    (args: LogViewerScrollArgs) => {
      if (args.scrollTop <= LOAD_OLDER_THRESHOLD_PX) {
        void loadOlder()
      }
    },
    [loadOlder]
  )

  useEffect(() => {
    debugLogs('viewer render state', {
      serviceId: service?.id ?? null,
      hasError: Boolean(error),
      loading,
      loadingOlder,
      logPath: logInfo?.path ?? null,
      lineCount: lines.length,
      hasMore,
      nextBefore,
      totalLines,
    })
  }, [
    error,
    hasMore,
    lines.length,
    loading,
    loadingOlder,
    logInfo?.path,
    nextBefore,
    service,
    totalLines,
  ])

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
      <div className='flex items-center gap-3 text-xs text-muted-foreground'>
        <div
          className='min-w-0 flex-1 truncate whitespace-nowrap'
          title={logInfo?.path ?? service.metadata.logPath ?? 'resolved by service endpoint'}
        >
          Source:{' '}
          <span className='font-medium'>
            {logInfo?.path ?? service.metadata.logPath ?? 'resolved by service endpoint'}
          </span>
        </div>
        <div
          className='shrink-0 truncate whitespace-nowrap text-right'
          title={`Showing newest tail first, chunk size ${DEFAULT_LOG_CHUNK_SIZE}, total ${totalLines.toLocaleString()} lines`}
        >
          Showing newest tail first, chunk size {DEFAULT_LOG_CHUNK_SIZE}, total{' '}
          {totalLines.toLocaleString()} lines
        </div>
      </div>
      <div ref={viewerRef}>
        <RealServiceLogViewer
          key={`${service.id}:${logInfo?.path ?? 'default'}`}
          service={service}
          paused={paused}
          lines={lines}
          loadingOlder={loadingOlder}
          hasMore={hasMore}
          onScroll={handleViewerScroll}
        />
      </div>
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
