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
import {
  Activity,
  PauseCircle,
  PlayCircle,
  ScrollText,
  Wifi,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import type { ServiceLogType } from '@/lib/service-lasso-dashboard/types'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  debugLogs,
  fetchServiceLogChunk,
  fetchServiceLogInfo,
  fetchServiceLogsOverview,
  type ServiceLogOverview,
  type ServiceLogInfo,
  type ServiceLogSource,
} from './provider'

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
const ALL_LOG_SOURCE = 'default'

type LogViewerScrollArgs = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

type LogSourceOption = {
  id: ServiceLogType
  label: string
  description: string
  path?: string | null
  available?: boolean
  source?: ServiceLogSource
}

function titleCaseSource(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function labelForLogSource(sourceId: string, source?: ServiceLogSource) {
  if (source?.label) return source.label
  if (source?.name) return source.name
  if (sourceId === ALL_LOG_SOURCE || sourceId === 'combined') return 'All'
  if (sourceId === 'stdout') return 'stdout'
  if (sourceId === 'stderr') return 'stderr'
  if (sourceId === 'access') return 'Access log'
  if (sourceId === 'error') return 'Error log'
  return titleCaseSource(sourceId)
}

function sourceIdFor(source: ServiceLogSource) {
  return source.id ?? source.stream ?? source.kind ?? source.path ?? ''
}

function buildLogSourceOptions(
  logInfo: ServiceLogInfo | null,
  overview: ServiceLogOverview | null
) {
  const sourceMap = new Map<string, LogSourceOption>()

  function addSource(option: LogSourceOption) {
    const existing = sourceMap.get(option.id)
    sourceMap.set(option.id, {
      ...existing,
      ...option,
      available: option.available ?? existing?.available,
      path: option.path ?? existing?.path,
      source: option.source ?? existing?.source,
    })
  }

  addSource({
    id: ALL_LOG_SOURCE,
    label: 'All',
    description: 'Merged stdout, stderr, and service log entries.',
    available: logInfo?.available,
    path: logInfo?.path ?? overview?.logPath,
  })

  for (const type of logInfo?.availableTypes ?? []) {
    addSource({
      id: type,
      label: labelForLogSource(type),
      description:
        type === ALL_LOG_SOURCE
          ? 'Merged stdout, stderr, and service log entries.'
          : `${labelForLogSource(type)} source reported by the runtime.`,
    })
  }

  for (const source of logInfo?.sources ?? []) {
    const id = sourceIdFor(source)
    if (!id) continue

    addSource({
      id,
      label: labelForLogSource(id, source),
      description: [
        source.stream ?? source.kind ?? 'runtime source',
        source.fileName ?? source.path,
      ]
        .filter(Boolean)
        .join(' - '),
      path: source.path,
      available: source.available,
      source,
    })
  }

  if (overview?.stdoutPath) {
    addSource({
      id: 'stdout',
      label: 'stdout',
      description: 'Process stdout stream.',
      path: overview.stdoutPath,
      available: true,
    })
  }

  if (overview?.stderrPath) {
    addSource({
      id: 'stderr',
      label: 'stderr',
      description: 'Process stderr stream.',
      path: overview.stderrPath,
      available: true,
    })
  }

  return Array.from(sourceMap.values()).sort((left, right) => {
    const order = [ALL_LOG_SOURCE, 'stdout', 'stderr', 'access', 'error']
    const leftOrder = order.indexOf(left.id)
    const rightOrder = order.indexOf(right.id)
    if (leftOrder !== -1 || rightOrder !== -1) {
      return (
        (leftOrder === -1 ? 999 : leftOrder) -
        (rightOrder === -1 ? 999 : rightOrder)
      )
    }
    return left.label.localeCompare(right.label)
  })
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

function buildLogEmptyState(
  service: DashboardService,
  logInfo: ServiceLogInfo | null
) {
  if (!service.installed) {
    return {
      title: 'No logs because the service is not installed yet',
      description:
        'The runtime knows about this service, but install/config/start has not produced a current log file in this environment.',
    }
  }

  const isProvider =
    service.role === 'provider' || service.metadata.serviceType === 'provider'

  if (logInfo?.available === false) {
    return {
      title: 'Selected log source is unavailable',
      description:
        'The runtime reported this source, but it is not readable in the current environment.',
    }
  }

  if (isProvider) {
    return {
      title: 'Provider service has no daemon log entries',
      description:
        'Provider-role services may only emit install or configuration events. They can be valid even when no long-running process writes stdout or stderr.',
    }
  }

  if (service.status === 'stopped') {
    return {
      title: 'No current logs because the service is stopped',
      description:
        'Start or restart the service to create new runtime output. Existing archived logs appear when the runtime reports them.',
    }
  }

  return {
    title: 'No current log entries yet',
    description: logInfo?.path
      ? 'The runtime resolved a log file, but there are no entries in the selected tail window yet.'
      : 'The runtime has not resolved a current log source for this service yet.',
  }
}

function ServiceLogsOverviewPanel({
  overview,
}: {
  overview: ServiceLogOverview | null
}) {
  if (!overview) return null

  const archiveCount = overview.archives.length
  const paths = [
    { label: 'Service log', value: overview.logPath },
    { label: 'Stdout', value: overview.stdoutPath },
    { label: 'Stderr', value: overview.stderrPath },
  ].filter((item) => Boolean(item.value))

  return (
    <div className='space-y-3 rounded-md border bg-muted/20 p-3 text-sm'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='font-medium'>Runtime log overview</div>
        <div className='text-xs text-muted-foreground'>
          {overview.entries.length.toLocaleString()} current entries ·{' '}
          {archiveCount.toLocaleString()} archives
        </div>
      </div>
      {paths.length ? (
        <div className='grid gap-2 md:grid-cols-3'>
          {paths.map((item) => (
            <div key={item.label} className='min-w-0'>
              <div className='text-xs font-medium'>{item.label}</div>
              <div className='truncate text-xs text-muted-foreground'>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ServiceLogEmptyState({
  service,
  logInfo,
  overview,
  sourceLabel,
}: {
  service: DashboardService
  logInfo: ServiceLogInfo | null
  overview: ServiceLogOverview | null
  sourceLabel: string
}) {
  const state = buildLogEmptyState(service, logInfo)
  const entries = overview?.entries.slice(0, 5) ?? []

  return (
    <div className='space-y-3'>
      <div className='rounded-md border border-dashed bg-muted/20 p-6'>
        <div className='font-medium'>{state.title}</div>
        <p className='mt-1 text-sm text-muted-foreground'>
          {state.description}
        </p>
        <p className='mt-3 text-xs text-muted-foreground'>
          Selected source: <span className='font-medium'>{sourceLabel}</span>
        </p>
      </div>
      {entries.length ? (
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Recent runtime event</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => (
                <TableRow key={`${entry.level}-${index}`}>
                  <TableCell className='w-28'>
                    <Badge variant='outline'>{entry.level}</Badge>
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {entry.message}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}

function ServiceLazyLogViewer({
  service,
  selectedSource,
  onSourceChange,
  paused,
}: {
  service: DashboardService | null
  selectedSource: ServiceLogType
  onSourceChange: (source: ServiceLogType) => void
  paused: boolean
}) {
  const [logInfo, setLogInfo] = useState<ServiceLogInfo | null>(null)
  const [logOverview, setLogOverview] = useState<ServiceLogOverview | null>(
    null
  )
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
        selectedSource,
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
  }, [hasMore, loadingOlder, nextBefore, selectedSource, service])

  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      if (!service) {
        debugLogs('loadInitial skipped because no service is selected')
        setLogInfo(null)
        setLogOverview(null)
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
        source: selectedSource,
        paused,
      })

      try {
        setLoading(true)
        setError(null)
        const [defaultInfo, chunk, overview] = await Promise.all([
          fetchServiceLogInfo(service, 'default'),
          fetchServiceLogChunk(
            service,
            selectedSource,
            undefined,
            DEFAULT_LOG_CHUNK_SIZE
          ),
          fetchServiceLogsOverview(service).catch(() => null),
        ])
        const sourceInfo =
          selectedSource === ALL_LOG_SOURCE
            ? defaultInfo
            : {
                ...defaultInfo,
                type: selectedSource,
                available:
                  chunk.available ??
                  defaultInfo.sources?.find(
                    (source) => sourceIdFor(source) === selectedSource
                  )?.available ??
                  defaultInfo.available,
                path:
                  chunk.path ??
                  defaultInfo.sources?.find(
                    (source) => sourceIdFor(source) === selectedSource
                  )?.path ??
                  defaultInfo.path,
                source:
                  chunk.source ??
                  defaultInfo.sources?.find(
                    (source) => sourceIdFor(source) === selectedSource
                  ),
              }

        if (cancelled) return

        setLogInfo(sourceInfo)
        setLogOverview(overview)
        setLines(chunk.lines)
        setHasMore(chunk.hasMore)
        setNextBefore(chunk.nextBefore)
        setTotalLines(chunk.totalLines)

        debugLogs('loadInitial state applied', {
          serviceId: service.id,
          source: selectedSource,
          logPath: sourceInfo.path,
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
        setLogOverview(null)
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
  }, [paused, selectedSource, service])

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
          selectedSource,
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
  }, [loading, loadingOlder, paused, selectedSource, service])

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
      selectedSource,
      hasError: Boolean(error),
      loading,
      loadingOlder,
      logPath: logInfo?.path ?? null,
      overviewEntries: logOverview?.entries.length ?? null,
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
    logOverview?.entries.length,
    nextBefore,
    selectedSource,
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

  const sourceOptions = buildLogSourceOptions(logInfo, logOverview)
  const activeSource =
    sourceOptions.find((source) => source.id === selectedSource) ??
    sourceOptions[0]
  const sourceLabel = activeSource?.label ?? labelForLogSource(selectedSource)

  return (
    <div className='space-y-3'>
      <ServiceLogsOverviewPanel overview={logOverview} />
      <div className='space-y-2'>
        <Tabs
          value={selectedSource}
          onValueChange={(value) => onSourceChange(value as ServiceLogType)}
        >
          <TabsList className='h-auto flex-wrap justify-start'>
            {sourceOptions.map((source) => (
              <TabsTrigger
                key={source.id}
                value={source.id}
                className={
                  source.id === 'stderr'
                    ? 'data-[state=active]:text-destructive'
                    : undefined
                }
              >
                {source.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
          <span>
            Source: <span className='font-medium'>{sourceLabel}</span>
          </span>
          {activeSource?.path ? <span>{activeSource.path}</span> : null}
          {activeSource?.source?.runId ? (
            <span>Run: {activeSource.source.runId}</span>
          ) : null}
          {activeSource?.source?.cursor ? (
            <span>Cursor: {activeSource.source.cursor}</span>
          ) : null}
          {activeSource?.source?.offset ? (
            <span>Offset: {activeSource.source.offset}</span>
          ) : null}
        </div>
      </div>
      {error ? (
        <div className='flex h-[640px] items-center justify-center rounded-md border bg-muted/30 px-6 text-sm text-destructive'>
          {error}
        </div>
      ) : loading ? (
        <Skeleton className='h-[640px] w-full' />
      ) : (
        <>
          <div className='space-y-1 text-xs text-muted-foreground'>
            <div
              className='truncate whitespace-nowrap'
              title={
                logInfo?.path ??
                service.metadata.logPath ??
                'resolved by service endpoint'
              }
            >
              Source:{' '}
              <span className='font-medium'>
                {logInfo?.path ??
                  service.metadata.logPath ??
                  'resolved by service endpoint'}
              </span>
            </div>
            <div
              className='truncate whitespace-nowrap'
              title={`Showing newest tail first, chunk size ${DEFAULT_LOG_CHUNK_SIZE}, total ${totalLines.toLocaleString()} lines`}
            >
              Showing newest tail first, chunk size {DEFAULT_LOG_CHUNK_SIZE},
              total {totalLines.toLocaleString()} lines
            </div>
          </div>
          {lines.length ? (
            <div ref={viewerRef}>
              <RealServiceLogViewer
                key={`${service.id}:${selectedSource}:${logInfo?.path ?? 'default'}`}
                service={service}
                paused={paused}
                lines={lines}
                loadingOlder={loadingOlder}
                hasMore={hasMore}
                onScroll={handleViewerScroll}
              />
            </div>
          ) : (
            <ServiceLogEmptyState
              service={service}
              logInfo={logInfo}
              overview={logOverview}
              sourceLabel={sourceLabel}
            />
          )}
        </>
      )}
    </div>
  )
}

export function Logs() {
  usePageMetadata({
    title: 'Service Admin - Logs',
    description:
      'Service Admin log viewing surface for Service Lasso services.',
  })

  const searchState = route.useSearch()
  const navigate = route.useNavigate()
  const servicesQuery = useServices()
  const [paused, setPaused] = useState(true)
  const [serviceQuery, setServiceQuery] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState('')

  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data])
  const effectiveSelectedServiceId = searchState.service ?? selectedServiceId
  const selectedSource = (searchState.source ??
    ALL_LOG_SOURCE) as ServiceLogType

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

  const selectSource = (source: ServiceLogType) => {
    void navigate({
      search: (previous) => ({
        ...(previous as Record<string, unknown>),
        service: selectedService?.id,
        source: source === ALL_LOG_SOURCE ? undefined : source,
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
            <h2 className='text-2xl font-bold tracking-tight'>Logs</h2>
            <p className='text-muted-foreground'>
              Safe service log viewer backed by service-resolved API endpoints.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services' search={{}}>
                Services
              </Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/runtime' search={{}}>
                Runtime
              </Link>
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
                    Uses the resolved service log endpoint and scroll-follow
                    behavior.
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
                    {labelForLogSource(selectedSource)}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Deep links can focus service and source. The server resolves
                    the real path.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className='grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]'>
              <Card>
                <CardHeader>
                  <CardTitle>Services</CardTitle>
                  <CardDescription>
                    Search and select the service whose logs you want to
                    inspect.
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
                              data-state={
                                selectedService?.id === service.id
                                  ? 'selected'
                                  : undefined
                              }
                              onClick={() => selectService(service.id)}
                            >
                              <TableCell>
                                <div className='flex min-w-0 flex-col'>
                                  <span className='font-medium'>
                                    {service.name}
                                  </span>
                                  <span className='text-xs text-muted-foreground'>
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
                  <ServiceLazyLogViewer
                    service={selectedService}
                    selectedSource={selectedSource}
                    onSourceChange={selectSource}
                    paused={paused}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </Main>
    </>
  )
}
