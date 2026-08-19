import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { LazyLog, ScrollFollow } from '@melloware/react-logviewer'
import { PauseCircle, PlayCircle, ScrollText } from 'lucide-react'
import type {
  DashboardService,
  ServiceLogType,
} from '@/lib/service-lasso-dashboard/types'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ALL_LOG_SOURCE,
  canonicalLogSourceId,
  debugLogs,
  fetchServiceLogChunk,
  fetchServiceLogInfo,
  fetchServiceLogsOverview,
  type ServiceLogOverview,
  type ServiceLogInfo,
  type ServiceLogSource,
} from './provider'

const DEFAULT_LOG_CHUNK_SIZE = 100
const LOAD_OLDER_THRESHOLD_PX = 48
const FOLLOW_POLL_MS = 4000

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

/**
 * Viewer chrome for the main Logs page versus the service-details Logs tab.
 * `page` keeps source tabs and the runtime overview. `service-split` lists
 * this service's logs on the left and uses STDOUT/STDERR toggle buttons.
 */
type ServiceLogViewerLayout = 'page' | 'service-split'

/**
 * Finds the LazyLog scroll container without a non-null assertion.
 */
function queryLazyLogScroller(root: HTMLDivElement | null) {
  const element = root?.querySelector('.react-lazylog')
  return element instanceof HTMLElement ? element : null
}

/**
 * Title-cases a runtime source id for operator-facing labels.
 */
function titleCaseSource(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/**
 * Resolves a display label for a canonical log source id.
 */
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

/**
 * Canonical id for a runtime-advertised source row.
 */
function sourceIdFor(source: ServiceLogSource) {
  return canonicalLogSourceId(
    source.id ?? source.stream ?? source.kind ?? source.path ?? ''
  )
}

/**
 * Builds the selectable log-source list for one service.
 * Combined/all ids collapse onto Core `default` so the UI never requests
 * an invalid `type=combined` value.
 */
function buildLogSourceOptions(
  logInfo: ServiceLogInfo | null,
  overview: ServiceLogOverview | null
) {
  const sourceMap = new Map<string, LogSourceOption>()

  function addSource(option: LogSourceOption) {
    const id = canonicalLogSourceId(option.id)
    const existing = sourceMap.get(id)
    sourceMap.set(id, {
      ...existing,
      ...option,
      id,
      label:
        id === ALL_LOG_SOURCE
          ? (existing?.label ?? 'All')
          : (option.label ?? existing?.label),
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
    <div className='flex min-h-0 flex-1 flex-col gap-2'>
      <pre className='sr-only' data-testid='logs-viewer-lines'>
        {logText}
      </pre>
      <div
        className='min-h-[240px] flex-1 overflow-hidden rounded-md border'
        data-testid='logs-viewer'
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
                height: '100%',
                minHeight: '100%',
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

/**
 * STDOUT/STDERR toggles for the service-details Logs tab.
 * Pressing the active stream returns to Combined/All (`default`).
 */
function StreamToggleButtons({
  selectedSource,
  onSourceChange,
}: {
  selectedSource: ServiceLogType
  onSourceChange: (source: ServiceLogType) => void
}) {
  const stdoutActive = selectedSource === 'stdout'
  const stderrActive = selectedSource === 'stderr'

  return (
    <div
      className='flex flex-wrap gap-2'
      data-testid='service-detail-stream-toggles'
    >
      <Button
        type='button'
        size='sm'
        variant={stdoutActive ? 'default' : 'outline'}
        aria-pressed={stdoutActive}
        onClick={() => onSourceChange(stdoutActive ? ALL_LOG_SOURCE : 'stdout')}
      >
        STDOUT
      </Button>
      <Button
        type='button'
        size='sm'
        variant={stderrActive ? 'default' : 'outline'}
        aria-pressed={stderrActive}
        onClick={() => onSourceChange(stderrActive ? ALL_LOG_SOURCE : 'stderr')}
      >
        STDERR
      </Button>
    </div>
  )
}

/**
 * Shared LazyLog/file-editor used by the main Logs page and service details.
 */
export function ServiceLazyLogViewer({
  service,
  selectedSource,
  onSourceChange,
  paused,
  layout = 'page',
  onPausedChange,
}: {
  service: DashboardService | null
  selectedSource: ServiceLogType
  onSourceChange: (source: ServiceLogType) => void
  paused: boolean
  layout?: ServiceLogViewerLayout
  onPausedChange?: (paused: boolean) => void
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
  const isServiceSplit = layout === 'service-split'

  const loadOlder = useCallback(async () => {
    if (!service || !hasMore || loadingOlder || nextBefore == null) {
      return
    }

    const scrollElement = queryLazyLogScroller(viewerRef.current)

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
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
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
      } catch (loadError) {
        if (cancelled) return
        debugLogs('loadInitial failed', {
          serviceId: service.id,
          error:
            loadError instanceof Error ? loadError.message : String(loadError),
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

    const scrollElement = queryLazyLogScroller(viewerRef.current)

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
      } catch (pollError) {
        debugLogs('follow poll failed', {
          serviceId: service.id,
          error:
            pollError instanceof Error ? pollError.message : String(pollError),
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

  const sourceOptions = buildLogSourceOptions(logInfo, logOverview)
  const activeSource =
    sourceOptions.find((source) => source.id === selectedSource) ??
    sourceOptions[0]
  const sourceLabel = activeSource?.label ?? labelForLogSource(selectedSource)
  const showFileEditor =
    lines.length > 0 || (Boolean(logInfo?.path) && logInfo?.available !== false)

  const viewerBody = !service ? (
    <div className='flex min-h-[240px] flex-1 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground'>
      Select a service to inspect logs.
    </div>
  ) : error ? (
    <div className='flex min-h-[240px] flex-1 items-center justify-center rounded-md border bg-muted/30 px-6 text-sm text-destructive'>
      {error}
    </div>
  ) : loading ? (
    <Skeleton className='min-h-[240px] w-full flex-1' />
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
          Showing newest tail first, chunk size {DEFAULT_LOG_CHUNK_SIZE}, total{' '}
          {totalLines.toLocaleString()} lines
        </div>
      </div>
      {showFileEditor ? (
        <div className='flex min-h-0 flex-1 flex-col' ref={viewerRef}>
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
  )

  if (isServiceSplit) {
    return (
      <div
        className='grid min-h-[32rem] min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]'
        data-testid='service-detail-logs-workspace'
      >
        <Card className='flex min-h-0 min-w-0 flex-col overflow-hidden'>
          <CardHeader className='shrink-0'>
            <CardTitle>Logs</CardTitle>
            <CardDescription>
              All log sources for this service. Combined/All reads the default
              service log.
            </CardDescription>
          </CardHeader>
          <CardContent className='flex min-h-0 min-w-0 flex-1 flex-col'>
            <div
              className='min-h-0 min-w-0 flex-1 overflow-auto rounded-md border'
              data-testid='service-detail-log-sources'
            >
              <Table contained={false}>
                <TableHeader className='sticky top-0 z-10 bg-background'>
                  <TableRow>
                    <TableHead>Log</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceOptions.map((source) => (
                    <TableRow
                      key={source.id}
                      className='cursor-pointer'
                      data-state={
                        selectedSource === source.id ? 'selected' : undefined
                      }
                      onClick={() => onSourceChange(source.id)}
                    >
                      <TableCell>
                        <div className='flex min-w-0 flex-col'>
                          <span className='font-medium break-words'>
                            {source.label}
                          </span>
                          {source.path ? (
                            <span className='text-xs break-words text-muted-foreground'>
                              {source.path}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            source.available === false ? 'outline' : 'secondary'
                          }
                        >
                          {source.available === false
                            ? 'unavailable'
                            : 'source'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
                  {service
                    ? `${service.name} log output for this service only.`
                    : 'Select a log source to inspect.'}
                </CardDescription>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <StreamToggleButtons
                  selectedSource={selectedSource}
                  onSourceChange={onSourceChange}
                />
                {onPausedChange ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => onPausedChange(!paused)}
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
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className='flex min-h-0 min-w-0 flex-1 flex-col gap-3'>
            <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
              <span>
                Source: <span className='font-medium'>{sourceLabel}</span>
              </span>
              {activeSource?.path ? <span>{activeSource.path}</span> : null}
              {activeSource?.source?.runId ? (
                <span>Run: {activeSource.source.runId}</span>
              ) : null}
            </div>
            {viewerBody}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!service) {
    return (
      <div className='flex min-h-[240px] flex-1 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground'>
        Select a service to inspect logs.
      </div>
    )
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <ServiceLogsOverviewPanel overview={logOverview} />
      <div className='space-y-2'>
        <Tabs
          value={selectedSource}
          onValueChange={(value) => onSourceChange(canonicalLogSourceId(value))}
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
      {viewerBody}
    </div>
  )
}

/**
 * Service-details Logs tab: this service's log list plus the shared viewer.
 */
export function ServiceDetailLogsPanel({
  service,
}: {
  service: DashboardService
}) {
  const [paused, setPaused] = useState(true)
  const [selectedSource, setSelectedSource] =
    useState<ServiceLogType>(ALL_LOG_SOURCE)

  return (
    <ServiceLazyLogViewer
      service={service}
      selectedSource={selectedSource}
      onSourceChange={setSelectedSource}
      paused={paused}
      onPausedChange={setPaused}
      layout='service-split'
    />
  )
}
