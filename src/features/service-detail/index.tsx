import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link } from '@tanstack/react-router'
import {
  Position,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Copy,
  ExternalLink,
  HeartPulse,
  KeyRound,
  Link2,
  Network,
  PackageCheck,
  Pause,
  Play,
  RefreshCw,
  Save,
  ScanSearch,
  ScrollText,
  Send,
  Split,
  Square,
  Terminal,
  Undo2,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/lib/copy-text'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  buildApiUsageEdge,
  buildDependencyEdge,
  buildServiceNodeLabel,
  buildServiceNodeStyle,
  getServiceNodeImage,
} from '@/lib/service-graph'
import { renderServiceEndpointUrl } from '@/lib/service-lasso-dashboard/access-host-urls'
import { lifecycleActionButtonClass } from '@/lib/service-lasso-dashboard/action-styles'
import {
  useDashboardAction,
  useDashboardService,
  useServiceLifecycleAction,
  useServiceSetup,
  useServiceSetupAction,
} from '@/lib/service-lasso-dashboard/hooks'
import {
  hasLifecycleAction,
  isLifecycleAction,
  isLifecycleActionEnabled,
  type LifecycleActionKind,
} from '@/lib/service-lasso-dashboard/lifecycle-actions'
import { serviceSecretsKvBucketPath } from '@/lib/service-lasso-dashboard/service-secrets-kv-path'
import { serviceLassoApiBaseUrl } from '@/lib/service-lasso-dashboard/stub'
import type {
  DashboardService,
  ServiceAction,
  ServiceDependency,
  ServiceEndpoint,
  ServiceLifecycleActionKind,
  ServiceStatus,
} from '@/lib/service-lasso-dashboard/types'
import { useTheme } from '@/context/theme-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DependencyGraphCanvas } from '@/components/dependency-graph-canvas'
import { DependencyGraphPanel } from '@/components/dependency-graph-panel'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { HeaderActions } from '@/components/page-toolbar'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  fetchServiceLogChunk,
  fetchServiceLogInfo,
  sendServiceTerminalInput,
  terminalLinesFromChunk,
  type ServiceLogChunk,
  type ServiceLogInfo,
  type ServiceTerminalStdinCapability,
} from '@/features/logs/provider'
import { ServiceDetailLogsPanel } from '@/features/logs/service-log-viewer'
import { FavoriteToggle } from '@/features/services/components/favorite-toggle'
import { EnvironmentTable } from './environment-table'
import { buildMetadataTableRows } from './metadata-table'
import {
  SecretsBrokerSecretsPanel,
  ServiceAccessPanel,
  ServiceSetupPanel,
} from './release-capability-panels'
import { SecretsBrokerLifecyclePanel } from './secrets-lifecycle-panel'
import { SecretsBrokerOperationsPanel } from './secrets-operations-panel'
import { SecretsBrokerTopologyPanel } from './secrets-topology-panel'
import { ServiceConfigEditor } from './service-config-editor'
import {
  defaultServiceDetailTab,
  normalizeServiceDetailTab,
  serviceDetailTabs,
  serviceDetailTabsByShortcut,
  getServiceDetailTabShortcutLabel,
  type ServiceDetailTabId,
} from './service-detail-tabs'
import { ServiceRunStatusCards } from './service-run-status-cards'

const editableShortcutTargetSelector = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '.monaco-editor',
  '[data-monaco-editor]',
  '[data-service-detail-terminal]',
  '[data-terminal-input]',
  '.xterm',
].join(', ')

type EndpointAccessLocation = Parameters<typeof renderServiceEndpointUrl>[1]

export function buildServiceEndpointDisplayRows(
  endpoints: ServiceEndpoint[],
  accessLocation?: EndpointAccessLocation
) {
  return endpoints.map((endpoint) => {
    const endpointUrl = renderServiceEndpointUrl(endpoint, accessLocation)

    return {
      endpoint,
      endpointUrl,
      hasResolvedUrl: Boolean(endpointUrl),
      showSourceUrl: Boolean(endpointUrl) && endpointUrl !== endpoint.url,
    }
  })
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === 'running') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Running</Badge>
    )
  }

  if (status === 'available') {
    return <Badge className='bg-sky-600 hover:bg-sky-600'>Available</Badge>
  }

  if (status === 'degraded') {
    return <Badge variant='secondary'>Degraded</Badge>
  }

  return <Badge variant='outline'>Stopped</Badge>
}

function HealthBadge({
  health,
}: {
  health: DashboardService['runtimeHealth']['health']
}) {
  if (health === 'healthy') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Healthy</Badge>
    )
  }

  if (health === 'warning') {
    return <Badge variant='secondary'>Warning</Badge>
  }

  return <Badge variant='destructive'>Critical</Badge>
}

function CopyValueButton({
  value,
  label = 'Copy value',
}: {
  value?: string
  label?: string
}) {
  return (
    <Button
      type='button'
      variant='outline'
      size='icon'
      className='size-7 shrink-0'
      title={label}
      disabled={!value}
      onClick={() => {
        if (value) void copyText(value)
      }}
    >
      <Copy className='size-3.5' />
      <span className='sr-only'>{label}</span>
    </Button>
  )
}

function canOpenEndpointUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function EndpointRowActions({
  endpoint,
  endpointUrl,
}: {
  endpoint: ServiceEndpoint
  endpointUrl: string
}) {
  const canOpen = canOpenEndpointUrl(endpointUrl)

  return (
    <div className='flex items-center gap-1'>
      <Button
        asChild={canOpen}
        type='button'
        size='icon'
        variant='outline'
        className='size-8 shrink-0'
        title={
          canOpen
            ? `Open ${endpoint.label} endpoint`
            : `Endpoint URL unavailable for ${endpoint.label}`
        }
        disabled={!canOpen}
      >
        {canOpen ? (
          <a href={endpointUrl} target='_blank' rel='noreferrer'>
            <ExternalLink className='size-3.5' />
            <span className='sr-only'>Open {endpoint.label} endpoint</span>
          </a>
        ) : (
          <>
            <ExternalLink className='size-3.5' />
            <span className='sr-only'>
              Endpoint URL unavailable for {endpoint.label}
            </span>
          </>
        )}
      </Button>
      <CopyValueButton
        value={endpointUrl}
        label={`Copy ${endpoint.label} URL`}
      />
      <Button
        asChild
        type='button'
        size='icon'
        variant='outline'
        className='size-8 shrink-0'
        title={`Open ${endpoint.label} in route inventory`}
      >
        <Link
          to='/service-routes'
          search={{ route: endpointUrl, page: 1, pageSize: 10 }}
        >
          <Network className='size-3.5' />
          <span className='sr-only'>
            Open {endpoint.label} in route inventory
          </span>
        </Link>
      </Button>
    </div>
  )
}

function endpointSelector(endpoint: ServiceEndpoint) {
  return endpoint.id ? `\${endpoint.${endpoint.id}.port}` : null
}

function endpointResolutionMessages(endpoint: ServiceEndpoint) {
  return [
    endpoint.resolution?.message,
    endpoint.error,
    ...(endpoint.resolution?.errors ?? []),
    ...(endpoint.resolution?.conflicts ?? []),
    ...(endpoint.errors ?? []),
    ...(endpoint.conflicts ?? []),
  ].filter((message): message is string => Boolean(message))
}

function EndpointResolutionBadge({ endpoint }: { endpoint: ServiceEndpoint }) {
  const messages = endpointResolutionMessages(endpoint)
  const status =
    endpoint.resolution?.status ??
    (messages.length > 0
      ? 'failed'
      : endpoint.url || endpoint.port
        ? 'resolved'
        : 'unknown')

  if (status === 'resolved') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Resolved</Badge>
    )
  }
  if (status === 'failed' || status === 'conflict') {
    return <Badge variant='destructive'>{status}</Badge>
  }
  if (status === 'warning') {
    return <Badge variant='secondary'>Warning</Badge>
  }
  return <Badge variant='outline'>Unknown</Badge>
}

function EndpointsTable({ endpoints }: { endpoints: ServiceEndpoint[] }) {
  const rows = buildServiceEndpointDisplayRows(endpoints)

  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Protocol</TableHead>
            <TableHead>Transport</TableHead>
            <TableHead>Bind</TableHead>
            <TableHead>Port</TableHead>
            <TableHead>Exposure</TableHead>
            <TableHead>Selector</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Resolution</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {endpoints.length ? (
            rows.map(
              ({ endpoint, endpointUrl, hasResolvedUrl, showSourceUrl }) => {
                const selector = endpointSelector(endpoint)
                const resolutionMessages = endpointResolutionMessages(endpoint)
                return (
                  <TableRow
                    key={`${endpoint.id ?? endpoint.label}-${endpointUrl}`}
                  >
                    <TableCell className='font-mono text-xs'>
                      {endpoint.id ?? 'legacy'}
                    </TableCell>
                    <TableCell>{endpoint.kind ?? 'url'}</TableCell>
                    <TableCell className='font-medium'>
                      <div>{endpoint.label}</div>
                      <div className='text-xs text-muted-foreground'>
                        {endpoint.source ?? 'runtime'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {endpoint.protocol?.toUpperCase() ?? 'UNKNOWN'}
                    </TableCell>
                    <TableCell>{endpoint.transport ?? '-'}</TableCell>
                    <TableCell>{endpoint.bind}</TableCell>
                    <TableCell>
                      {endpoint.port ?? endpoint.portDefault ?? '-'}
                    </TableCell>
                    <TableCell>{endpoint.exposure}</TableCell>
                    <TableCell className='font-mono text-xs'>
                      {selector ?? '-'}
                    </TableCell>
                    <TableCell>
                      {endpoint.health ?? endpoint.readiness ?? '-'}
                    </TableCell>
                    <TableCell className='max-w-[220px] text-sm'>
                      <div className='space-y-1'>
                        <EndpointResolutionBadge endpoint={endpoint} />
                        {resolutionMessages.map((message) => (
                          <div
                            key={message}
                            className='text-xs break-words text-muted-foreground'
                          >
                            {message}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className='max-w-[360px] min-w-[220px] font-mono text-xs break-all text-muted-foreground'>
                      <div>
                        {hasResolvedUrl ? endpointUrl : 'No URL recorded'}
                      </div>
                      {showSourceUrl ? (
                        <div className='mt-1 text-[11px] text-muted-foreground/75'>
                          Source: {endpoint.url}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <EndpointRowActions
                        endpoint={endpoint}
                        endpointUrl={endpointUrl}
                      />
                    </TableCell>
                  </TableRow>
                )
              }
            )
          ) : (
            <TableRow>
              <TableCell colSpan={13} className='h-20 text-center'>
                No endpoints are recorded for this service.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function RelationshipList({
  title,
  items,
}: {
  title: string
  items: ServiceDependency[]
}) {
  return (
    <div className='space-y-3'>
      <div className='text-sm font-medium'>{title}</div>
      {items.length ? (
        items.map((item) => (
          <div
            key={`${item.relation}-${item.id}`}
            className='rounded-lg border p-3'
          >
            <div className='flex items-center gap-2'>
              <div className='font-medium'>{item.name}</div>
              <StatusBadge status={item.status} />
            </div>
            {item.note ? (
              <p className='mt-2 text-sm text-muted-foreground'>{item.note}</p>
            ) : null}
          </div>
        ))
      ) : (
        <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
          None recorded by the runtime API.
        </div>
      )}
    </div>
  )
}

type GraphOrientation = 'horizontal' | 'vertical'

type GraphLayoutMap = Record<string, { x: number; y: number }>

async function persistNodeLayoutToMeta(
  serviceId: string,
  x: number,
  y: number
) {
  if (!serviceLassoApiBaseUrl) {
    throw new Error('Service Lasso API base URL is not configured')
  }

  const response = await fetch(
    `${serviceLassoApiBaseUrl}/api/services/${serviceId}/meta`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dependencyGraphPosition: { x, y },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to persist layout for ${serviceId}`)
  }
}

function LocalDependencyGraph({ service }: { service: DashboardService }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [graphOrientation, setGraphOrientation] =
    useState<GraphOrientation>('horizontal')
  const [savedLayoutMap, setSavedLayoutMap] = useState<GraphLayoutMap>({})
  const [layoutMap, setLayoutMap] = useState<GraphLayoutMap>({})

  const graphModel = useMemo(() => {
    const xStep = graphOrientation === 'horizontal' ? 250 : 190
    const yStep = graphOrientation === 'horizontal' ? 110 : 180

    const dependencyNodes: Node[] = service.dependencies.map(
      (dependency, index) => ({
        id: `dep-${dependency.id}`,
        position:
          layoutMap[`dep-${dependency.id}`] ??
          (graphOrientation === 'horizontal'
            ? { x: 0, y: index * yStep + 30 }
            : { x: index * xStep, y: 0 }),
        data: {
          label: buildServiceNodeLabel({
            name: dependency.name,
            id: dependency.id,
            serviceType: 'dependency',
            isDark,
          }),
        },
        style: buildServiceNodeStyle({ selected: false, isDark }),
        sourcePosition:
          graphOrientation === 'horizontal' ? Position.Right : Position.Bottom,
        targetPosition:
          graphOrientation === 'horizontal' ? Position.Left : Position.Top,
      })
    )

    const dependentNodes: Node[] = service.dependents.map(
      (dependent, index) => ({
        id: `dnt-${dependent.id}`,
        position:
          layoutMap[`dnt-${dependent.id}`] ??
          (graphOrientation === 'horizontal'
            ? { x: xStep * 2, y: index * yStep + 30 }
            : { x: index * xStep, y: yStep * 2 }),
        data: {
          label: buildServiceNodeLabel({
            name: dependent.name,
            id: dependent.id,
            serviceType: 'dependent',
            isDark,
          }),
        },
        style: buildServiceNodeStyle({ selected: false, isDark }),
        sourcePosition:
          graphOrientation === 'horizontal' ? Position.Right : Position.Bottom,
        targetPosition:
          graphOrientation === 'horizontal' ? Position.Left : Position.Top,
      })
    )

    const centerNode: Node = {
      id: `svc-${service.id}`,
      position:
        layoutMap[`svc-${service.id}`] ??
        (graphOrientation === 'horizontal'
          ? {
              x: xStep,
              y:
                Math.max(dependencyNodes.length, dependentNodes.length) *
                  yStep *
                  0.5 +
                30,
            }
          : {
              x:
                Math.max(dependencyNodes.length, dependentNodes.length) *
                xStep *
                0.5,
              y: yStep,
            }),
      data: {
        label: buildServiceNodeLabel({
          name: service.name,
          id: service.id,
          serviceType: service.metadata.serviceType,
          imageUrl: getServiceNodeImage(service, isDark),
          isDark,
        }),
      },
      style: buildServiceNodeStyle({ selected: true, isDark }),
      sourcePosition:
        graphOrientation === 'horizontal' ? Position.Right : Position.Bottom,
      targetPosition:
        graphOrientation === 'horizontal' ? Position.Left : Position.Top,
    }

    const edges: Edge[] = [
      ...service.dependencies.map((dependency) =>
        buildDependencyEdge({
          id: `dep-${dependency.id}->svc-${service.id}`,
          source: `dep-${dependency.id}`,
          target: `svc-${service.id}`,
          selected: true,
          isDark,
        })
      ),
      ...service.dependents.map((dependent) =>
        buildApiUsageEdge({
          id: `svc-${service.id}->dnt-${dependent.id}`,
          source: `svc-${service.id}`,
          target: `dnt-${dependent.id}`,
          isDark,
          label: 'child_of',
        })
      ),
    ]

    return {
      nodes: [...dependencyNodes, centerNode, ...dependentNodes],
      edges,
    }
  }, [graphOrientation, isDark, layoutMap, service])

  const [nodes, setNodes, onNodesChange] = useNodesState(graphModel.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphModel.edges)

  useEffect(() => {
    setNodes(graphModel.nodes)
    setEdges(graphModel.edges)
  }, [graphModel.edges, graphModel.nodes, setEdges, setNodes])

  const isLayoutDirty = useMemo(() => {
    return JSON.stringify(layoutMap) !== JSON.stringify(savedLayoutMap)
  }, [layoutMap, savedLayoutMap])

  const onNodeDragStop = (_: unknown, node: Node) => {
    setLayoutMap((previous) => ({
      ...previous,
      [node.id]: { x: node.position.x, y: node.position.y },
    }))
  }

  const resetGraphLayout = () => {
    setLayoutMap({})
    toast.message('Reset graph layout to the default arrangement.')
  }

  const discardLayoutChanges = () => {
    setLayoutMap(savedLayoutMap)
    toast.message('Discarded unsaved graph layout changes.')
  }

  const toggleGraphOrientation = () => {
    setGraphOrientation((previous) =>
      previous === 'horizontal' ? 'vertical' : 'horizontal'
    )
    setLayoutMap({})
    setSavedLayoutMap({})
    toast.message(
      `Switched graph to ${
        graphOrientation === 'horizontal' ? 'vertical' : 'horizontal'
      } layout.`
    )
  }

  const saveLayoutToMeta = async () => {
    setSavedLayoutMap(layoutMap)

    if (!serviceLassoApiBaseUrl) {
      toast.error(
        'Layout save triggered, but API base URL is not configured, so this will reset after reload.'
      )
      return
    }

    try {
      await Promise.all(
        Object.entries(layoutMap).map(([nodeId, position]) => {
          const serviceId = nodeId
            .replace(/^dep-/, '')
            .replace(/^dnt-/, '')
            .replace(/^svc-/, '')
          return persistNodeLayoutToMeta(serviceId, position.x, position.y)
        })
      )
      toast.success('Graph layout saved to service meta.')
    } catch {
      toast.error('Could not save graph layout to service meta.')
    }
  }

  return (
    <DependencyGraphPanel
      title='Dependency graph'
      description='Relationship map for this service and its immediate neighborhood.'
      actions={
        <>
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='size-8'
            title={`Switch graph to ${graphOrientation === 'horizontal' ? 'vertical' : 'horizontal'} layout`}
            onClick={toggleGraphOrientation}
          >
            {graphOrientation === 'horizontal' ? (
              <ArrowDown className='size-4' />
            ) : (
              <ArrowRight className='size-4' />
            )}
          </Button>
          <Separator orientation='vertical' className='h-6' />
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='size-8'
            title='Reset graph layout'
            onClick={resetGraphLayout}
          >
            <Wrench className='size-4' />
          </Button>
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='size-8'
            title='Discard unsaved graph layout changes'
            disabled={!isLayoutDirty}
            onClick={discardLayoutChanges}
          >
            <Undo2 className='size-4' />
          </Button>
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='size-8'
            title='Save graph layout to service meta'
            disabled={!isLayoutDirty}
            onClick={() => void saveLayoutToMeta()}
          >
            <Save className='size-4' />
          </Button>
        </>
      }
      graph={
        <DependencyGraphCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          height={420}
          draggable
          selectable={true}
          showControls={true}
          showMiniMap={true}
          legendItems={[
            { label: 'Dependency to selected service', color: '#22c55e' },
            {
              label: 'Selected service to dependent',
              color: '#0ea5e9',
              dashed: true,
            },
          ]}
        />
      }
    />
  )
}

const SERVICE_DETAIL_LOG_STREAM_POLL_MS = 4000
const SERVICE_DETAIL_TERMINAL_LIMIT = 240

function resolveStdinCapability(
  service: DashboardService,
  info: ServiceLogInfo | null
): ServiceTerminalStdinCapability {
  const advertised = info?.stdin ?? info?.capabilities?.stdin

  if (service.status !== 'running') {
    return {
      available: false,
      reason: 'The managed process is not running.',
    }
  }

  if (advertised?.available) {
    return advertised
  }

  return {
    available: false,
    reason:
      advertised?.reason ??
      'The runtime has not advertised a safe stdin channel for this service.',
  }
}

function ServiceTerminalPanel({ service }: { service: DashboardService }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<ServiceLogInfo | null>(null)
  const [chunk, setChunk] = useState<ServiceLogChunk | null>(null)
  const [paused, setPaused] = useState(false)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)

  const loadCombinedOutput = useCallback(async () => {
    setError(null)

    try {
      const [nextInfo, nextChunk] = await Promise.all([
        fetchServiceLogInfo(service, 'combined'),
        fetchServiceLogChunk(
          service,
          'combined',
          undefined,
          SERVICE_DETAIL_TERMINAL_LIMIT
        ),
      ])

      setInfo(nextInfo)
      setChunk(nextChunk)
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'The runtime did not return combined terminal history.'
      )
    } finally {
      setLoading(false)
    }
  }, [service])

  useEffect(() => {
    let cancelled = false

    setLoading(true)
    setInfo(null)
    setChunk(null)

    void (async () => {
      await loadCombinedOutput()
      if (cancelled) return
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [loadCombinedOutput])

  useEffect(() => {
    if (service.status !== 'running' || paused) return

    const intervalId = window.setInterval(() => {
      void fetchServiceLogChunk(
        service,
        'combined',
        undefined,
        SERVICE_DETAIL_TERMINAL_LIMIT
      )
        .then((nextChunk) => {
          setError(null)
          setChunk(nextChunk)
        })
        .catch(() => {
          // Preserve the visible scrollback during transient tail failures.
        })
    }, SERVICE_DETAIL_LOG_STREAM_POLL_MS)

    return () => window.clearInterval(intervalId)
  }, [paused, service])

  const stdinCapability = resolveStdinCapability(service, info)
  const canSendInput = stdinCapability.available && input.trim().length > 0
  const lines = chunk ? terminalLinesFromChunk(chunk) : []
  const logText = lines.join('\n')

  async function handleSubmitInput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedInput = input.trim()
    if (!stdinCapability.available || !trimmedInput) return

    setSubmitting(true)
    setSubmitMessage(null)

    try {
      const result = await sendServiceTerminalInput(service, trimmedInput)
      setSubmitMessage(
        result.message ??
          (result.accepted
            ? 'Input accepted by runtime stdin.'
            : 'Runtime rejected the stdin write.')
      )
      setInput('')
      await loadCombinedOutput()
    } catch (nextError) {
      setSubmitMessage(
        nextError instanceof Error
          ? nextError.message
          : 'Runtime stdin write failed.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card data-service-detail-terminal data-testid='service-detail-terminal'>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Terminal className='size-4' /> Terminal
            </CardTitle>
            <CardDescription>
              Combined stdout and stderr with optional safe process input.
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? (
                <Play className='mr-2 size-4' />
              ) : (
                <Pause className='mr-2 size-4' />
              )}
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => void loadCombinedOutput()}
            >
              <RefreshCw className='mr-2 size-4' />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='rounded-md border bg-muted/20'>
          <div className='flex flex-wrap items-center justify-between gap-2 border-b p-3'>
            <div className='font-medium'>Combined I/O</div>
            <Badge variant={paused ? 'outline' : 'secondary'}>
              {paused ? 'paused' : 'following'}
            </Badge>
          </div>
          <div className='p-3'>
            {loading ? (
              <div className='rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
                Loading combined terminal history...
              </div>
            ) : error ? (
              <div className='rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
                Combined terminal history unavailable. {error}
              </div>
            ) : lines.length ? (
              <div>
                <pre
                  className='sr-only'
                  data-testid='service-detail-terminal-lines'
                >
                  {logText}
                </pre>
                <div
                  className='max-h-[480px] overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed'
                  data-testid='service-detail-terminal-visible-lines'
                >
                  {lines.map((line, index) => (
                    <div
                      key={`${index}-${line}`}
                      className='break-words whitespace-pre-wrap'
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className='rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
                No combined output is available for this service run.
              </div>
            )}
          </div>
        </div>

        <form className='space-y-3' onSubmit={handleSubmitInput}>
          <div className='grid gap-3 lg:grid-cols-[1fr_auto]'>
            <Textarea
              aria-label='Terminal input'
              data-terminal-input
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              disabled={!stdinCapability.available || submitting}
              placeholder={
                stdinCapability.available
                  ? 'Write to managed process stdin'
                  : (stdinCapability.reason ?? 'Stdin is unavailable')
              }
              className='min-h-24 font-mono'
            />
            <Button
              type='submit'
              disabled={!canSendInput || submitting}
              className='self-end'
            >
              <Send className='mr-2 size-4' />
              Send input
            </Button>
          </div>
          {!stdinCapability.available ? (
            <div className='rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
              Input disabled. {stdinCapability.reason}
            </div>
          ) : null}
          {submitMessage ? (
            <div className='rounded-md border p-3 text-sm text-muted-foreground'>
              {submitMessage}
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}

function ServiceMetadataTable({ service }: { service: DashboardService }) {
  const rows = buildMetadataTableRows(service.metadata)

  return (
    <Card data-testid='service-detail-overview-metadata'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <ScanSearch className='size-4' /> Metadata
        </CardTitle>
        <CardDescription>
          Runtime metadata recorded for this service.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className='overflow-x-auto rounded-md border'
          data-testid='service-detail-metadata-table'
        >
          <Table className='min-w-[640px] table-fixed'>
            <colgroup>
              <col className='w-[28%]' />
              <col className='w-[60%]' />
              <col className='w-[12%]' />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className='align-top font-medium whitespace-normal'>
                      {row.label}
                    </TableCell>
                    <TableCell className='min-w-0 align-top text-sm whitespace-normal text-muted-foreground'>
                      <div
                        className='max-w-full overflow-hidden leading-relaxed break-all text-ellipsis'
                        title={row.value}
                        data-testid='service-detail-metadata-value'
                      >
                        {row.value}
                      </div>
                    </TableCell>
                    <TableCell className='align-top'>
                      <CopyValueButton
                        value={row.value}
                        label={`Copy ${row.label}`}
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className='h-16 text-center'>
                    No runtime metadata fields are recorded for this service.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function ServiceDetailQuickAction({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant='outline' size='icon' asChild>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

const lifecycleHeaderActions: Array<{
  kind: LifecycleActionKind
  label: string
  icon: ReactNode
}> = [
  { kind: 'start', label: 'Start service', icon: <Play className='size-4' /> },
  { kind: 'stop', label: 'Stop service', icon: <Square className='size-4' /> },
  {
    kind: 'restart',
    label: 'Restart service',
    icon: <RefreshCw className='size-4' />,
  },
]

function ServiceLifecycleHeaderControls({
  service,
}: {
  service: DashboardService
}) {
  const actionMutation = useDashboardAction()
  const pendingAction =
    typeof actionMutation.variables === 'object' &&
    actionMutation.variables?.kind === 'service-lifecycle'
      ? actionMutation.variables.action
      : null

  const runAction = (action: LifecycleActionKind) => {
    actionMutation.mutate({
      kind: 'service-lifecycle',
      serviceId: service.id,
      action,
    })
  }

  return (
    <div
      className='flex flex-wrap items-center justify-center gap-2'
      data-testid='service-detail-lifecycle-controls'
    >
      {lifecycleHeaderActions.map((action) => {
        const serviceAction = service.actions.find(
          (candidate) => candidate.kind === action.kind
        )
        if (serviceAction?.permission) {
          return (
            <ServiceActionButton
              key={serviceAction.id}
              action={serviceAction}
              service={service}
            />
          )
        }

        const isAvailable = isLifecycleActionEnabled(service, action.kind)
        const isPending =
          actionMutation.isPending && pendingAction === action.kind
        const disabled = actionMutation.isPending || !isAvailable
        const title = isAvailable
          ? action.label
          : `${action.label} unavailable for ${service.name}`

        return (
          <Tooltip key={action.kind}>
            <TooltipTrigger asChild>
              <span className='inline-flex'>
                <Button
                  type='button'
                  size='icon'
                  variant='outline'
                  className={lifecycleActionButtonClass(
                    action.kind,
                    'size-10 shrink-0'
                  )}
                  aria-label={action.label}
                  title={title}
                  disabled={disabled}
                  onClick={() => runAction(action.kind)}
                >
                  {isPending ? (
                    <RefreshCw className='size-4 animate-spin' />
                  ) : (
                    action.icon
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{title}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}

export function ServiceActionButton({
  action,
  service,
}: {
  action: ServiceAction
  service: DashboardService
}) {
  const key = action.id
  const [confirmOpen, setConfirmOpen] = useState(false)
  const lifecycleAction = useServiceLifecycleAction()

  const lifecycleKinds: ServiceLifecycleActionKind[] = [
    'install',
    'config',
    'start',
    'stop',
    'restart',
    'reload',
  ]
  const isServiceLifecycleAction = lifecycleKinds.includes(
    action.kind as ServiceLifecycleActionKind
  )
  const isDaemonLifecycleAction = isLifecycleAction(action)
  const defaultPermissionAllowed =
    action.permission?.allowed ??
    (isDaemonLifecycleAction
      ? isLifecycleActionEnabled(service, action.kind)
      : !isServiceLifecycleAction)
  const permission = action.permission ?? {
    allowed: defaultPermissionAllowed,
    reason: defaultPermissionAllowed
      ? undefined
      : `${action.label} is unavailable for the current service state.`,
  }

  const runLifecycleAction = (confirm: boolean) => {
    if (!isServiceLifecycleAction || lifecycleAction.isPending) return
    lifecycleAction.mutate(
      {
        serviceId: service.id,
        action: action.kind as ServiceLifecycleActionKind,
        confirm,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          toast.success(`${action.label} completed.`)
        },
        onError: () => {
          toast.error(
            `${action.label} failed. The runtime made no UI-side assumptions.`
          )
        },
      }
    )
  }

  if (!permission.allowed) {
    return (
      <Button
        key={key}
        variant='outline'
        size='sm'
        disabled
        aria-label={action.label}
        title={permission.reason}
        className='h-auto max-w-full flex-col items-start gap-0.5 text-left whitespace-normal'
      >
        <span>{action.label}</span>
        {permission.reason ? (
          <span className='text-[11px] font-normal text-muted-foreground'>
            {permission.reason}
          </span>
        ) : null}
      </Button>
    )
  }

  if (action.kind === 'open_logs') {
    return (
      <Button key={key} variant='outline' size='sm' asChild>
        <Link to='/logs' search={{ service: service.id }}>
          {action.label}
        </Link>
      </Button>
    )
  }

  if (action.kind === 'open_config') {
    return (
      <CopyValueButton
        key={key}
        value={service.metadata.configPath}
        label={action.label}
      />
    )
  }

  if (action.kind === 'open_admin') {
    const adminTarget =
      service.links.find(
        (link) => link.kind === 'admin' || link.kind === 'remote'
      )?.url ?? service.endpoints[0]?.url

    return (
      <Button key={key} variant='outline' size='sm' asChild>
        <a href={adminTarget ?? '#'} target='_blank' rel='noreferrer'>
          {action.label}
        </a>
      </Button>
    )
  }

  if (!isServiceLifecycleAction) {
    return (
      <Button key={key} variant='outline' size='sm' disabled>
        {action.label}
      </Button>
    )
  }

  if (permission.requiresConfirmation) {
    return (
      <>
        <Button
          key={key}
          variant='outline'
          size='sm'
          title={permission.reason}
          onClick={() => setConfirmOpen(true)}
          disabled={lifecycleAction.isPending}
        >
          {action.label}
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title='Confirm elevated action'
          desc={
            <div className='space-y-2'>
              <p>
                {permission.reason ?? 'Core marked this action as elevated.'}
              </p>
              <p>
                Actor: {permission.actor ?? 'unknown'}; mode:{' '}
                {permission.mode ?? 'unknown'}.
              </p>
            </div>
          }
          confirmText={permission.confirmationLabel ?? action.label}
          isLoading={lifecycleAction.isPending}
          destructive={
            action.kind === 'stop' ||
            action.kind === 'restart' ||
            action.kind === 'uninstall'
          }
          handleConfirm={() => {
            runLifecycleAction(true)
          }}
        />
      </>
    )
  }

  return (
    <Button
      key={key}
      variant='outline'
      size='sm'
      title={permission.reason}
      disabled={lifecycleAction.isPending}
      onClick={() => runLifecycleAction(false)}
    >
      {lifecycleAction.isPending ? (
        <RefreshCw className='mr-2 size-4 animate-spin' />
      ) : null}
      {action.label}
    </Button>
  )
}

function ServiceDetailLoading() {
  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-4 w-96' />
      </div>
      <div className='grid gap-4 md:grid-cols-3'>
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        <Skeleton className='h-80 w-full lg:col-span-2' />
        <Skeleton className='h-80 w-full' />
      </div>
    </div>
  )
}

export function ServiceDetail({
  serviceId,
  activeTab,
  onActiveTabChange,
  rotationOperationId,
  onRotationOperationChange = () => undefined,
}: {
  serviceId: string
  activeTab?: ServiceDetailTabId
  onActiveTabChange?: (tab: ServiceDetailTabId) => void
  rotationOperationId?: string
  onRotationOperationChange?: (operationId: string | undefined) => void
}) {
  const serviceQuery = useDashboardService(serviceId)
  const setupQuery = useServiceSetup(serviceId)
  const setupAction = useServiceSetupAction()
  const serviceName = serviceQuery.data?.name ?? serviceId
  const [forceSetupRerun, setForceSetupRerun] = useState(false)
  const [pendingSetupStepId, setPendingSetupStepId] = useState<string>()
  const [localActiveTab, setLocalActiveTab] = useState<ServiceDetailTabId>(
    activeTab ?? defaultServiceDetailTab
  )
  const selectedTab =
    rotationOperationId && serviceId === '@secretsbroker'
      ? 'secrets'
      : (activeTab ?? localActiveTab)
  const setSelectedTab = useCallback(
    (nextTab: ServiceDetailTabId) => {
      if (activeTab === undefined) {
        setLocalActiveTab(nextTab)
      }

      onActiveTabChange?.(nextTab)
    },
    [activeTab, onActiveTabChange]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey) return

      const target = event.target
      if (
        target instanceof Element &&
        target.closest(editableShortcutTargetSelector)
      ) {
        return
      }

      const nextTab = serviceDetailTabsByShortcut[event.key]

      if (!nextTab) return
      event.preventDefault()
      setSelectedTab(nextTab)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setSelectedTab])

  usePageMetadata({
    title: `Service Admin - Service - ${serviceName}`,
    description: `Service Admin operator view for service ${serviceName}.`,
  })

  const runSetup = (stepId?: string) => {
    const pendingId = stepId ?? 'all'
    setPendingSetupStepId(pendingId)
    setupAction.mutate(
      { serviceId, stepId, force: forceSetupRerun },
      {
        onSuccess: (result) => toast.success(result.message),
        onError: () => toast.error('Setup run failed.'),
        onSettled: () => setPendingSetupStepId(undefined),
      }
    )
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
        {serviceQuery.isLoading ? (
          <ServiceDetailLoading />
        ) : !serviceQuery.data ? (
          <Card>
            <CardHeader>
              <CardTitle>Service not found</CardTitle>
              <CardDescription>
                The requested service is not present in Service Lasso runtime
                data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant='outline'>
                <Link to='/services'>
                  <ArrowLeft className='mr-2 size-4' />
                  Back to services
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          (() => {
            const service = serviceQuery.data
            const overviewActions = service.actions.filter((action) => {
              if (action.kind === 'open_config') {
                return false
              }
              if (action.kind === 'start') {
                return hasLifecycleAction(service, 'start')
              }
              return !isLifecycleAction(action)
            })

            return (
              <div className='flex min-h-0 flex-1 flex-col gap-4 sm:gap-6'>
                <div className='grid shrink-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'>
                  <div className='space-y-3'>
                    <div className='flex items-center gap-3'>
                      <Button asChild size='sm' variant='outline'>
                        <Link to='/services'>
                          <ArrowLeft className='mr-2 size-4' />
                          Services
                        </Link>
                      </Button>
                      <StatusBadge status={service.status} />
                      <HealthBadge health={service.runtimeHealth.health} />
                    </div>
                    <div>
                      <div className='flex items-center gap-2'>
                        <h2 className='text-2xl font-bold tracking-tight'>
                          {service.name}
                        </h2>
                        <FavoriteToggle service={service} />
                      </div>
                      <p className='text-sm text-muted-foreground'>
                        {service.id} · {service.role}
                      </p>
                    </div>
                  </div>
                  <ServiceLifecycleHeaderControls service={service} />
                  <div
                    className='flex flex-wrap justify-start gap-2 lg:justify-end'
                    data-testid='service-detail-quick-actions'
                  >
                    <ServiceDetailQuickAction label='Logs'>
                      <Link
                        to='/logs'
                        search={{ service: service.id }}
                        aria-label='Open logs'
                      >
                        <ScrollText className='size-4' />
                      </Link>
                    </ServiceDetailQuickAction>
                    <ServiceDetailQuickAction label='Dependencies'>
                      <Link
                        to='/dependencies'
                        search={{ service: service.id }}
                        aria-label='Open dependencies'
                      >
                        <Split className='size-4' />
                      </Link>
                    </ServiceDetailQuickAction>
                    <ServiceDetailQuickAction label='Variables'>
                      <Link
                        to='/variables'
                        search={{ service: service.id }}
                        aria-label='Open variables'
                      >
                        <ArrowRight className='size-4' />
                      </Link>
                    </ServiceDetailQuickAction>
                    <ServiceDetailQuickAction label='Secrets'>
                      <Link
                        to='/secrets-broker/secrets'
                        search={{
                          path: serviceSecretsKvBucketPath(service.id),
                        }}
                        aria-label='Open secrets'
                      >
                        <KeyRound className='size-4' />
                      </Link>
                    </ServiceDetailQuickAction>
                    <ServiceDetailQuickAction label='Network'>
                      <Link
                        to='/network'
                        search={{ service: service.id }}
                        aria-label='Open network'
                      >
                        <Network className='size-4' />
                      </Link>
                    </ServiceDetailQuickAction>
                    <ServiceDetailQuickAction label='Runtime'>
                      <Link
                        to='/runtime'
                        search={{ service: service.id }}
                        aria-label='Open runtime'
                      >
                        <HeartPulse className='size-4' />
                      </Link>
                    </ServiceDetailQuickAction>
                  </div>
                </div>

                <Tabs
                  value={selectedTab}
                  onValueChange={(value) =>
                    setSelectedTab(normalizeServiceDetailTab(value))
                  }
                  className='flex min-h-0 flex-1 flex-col gap-4'
                >
                  <TabsList className='flex h-auto w-full shrink-0 flex-wrap justify-start gap-1 rounded-2xl border border-border bg-muted/70 p-1 text-muted-foreground shadow-sm dark:border-slate-700/70 dark:bg-slate-900/90 dark:text-slate-400 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
                    {serviceDetailTabs
                      .filter(
                        (tab) =>
                          tab.id !== 'secrets' ||
                          service.id === '@secretsbroker'
                      )
                      .map((tab) => (
                        <TabsTrigger
                          key={tab.id}
                          value={tab.id}
                          className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                        >
                          {tab.label}{' '}
                          <span className='ml-1 italic opacity-80'>
                            ({getServiceDetailTabShortcutLabel(tab.shortcut)})
                          </span>
                        </TabsTrigger>
                      ))}
                  </TabsList>

                  <TabsContent
                    value='overview'
                    className='mt-0 min-h-0 flex-1 space-y-4 overflow-auto'
                  >
                    <ServiceRunStatusCards key={service.id} service={service} />
                    <div className='grid gap-4 md:grid-cols-3'>
                      <Card>
                        <CardHeader className='pb-2'>
                          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                            <HeartPulse className='size-4' /> Runtime + health
                          </CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-2 text-sm'>
                          <div>
                            <div className='font-medium'>Summary</div>
                            <p className='text-muted-foreground'>
                              {service.runtimeHealth.summary}
                            </p>
                          </div>
                          <div className='text-muted-foreground'>
                            Uptime: {service.runtimeHealth.uptime}
                          </div>
                          <div className='text-muted-foreground'>
                            Last check: {service.runtimeHealth.lastCheckAt}
                          </div>
                          <div className='text-muted-foreground'>
                            Last restart:{' '}
                            {service.runtimeHealth.lastRestartAt ??
                              'Not recorded'}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className='pb-2'>
                          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                            <PackageCheck className='size-4' /> Build + install
                          </CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-2 text-sm text-muted-foreground'>
                          <div>Type: {service.metadata.serviceType}</div>
                          <div>Runtime: {service.metadata.runtime}</div>
                          <div>Version: {service.metadata.version}</div>
                          <div>Build: {service.metadata.build}</div>
                          <div>
                            Installed: {service.installed ? 'Yes' : 'No'}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className='pb-2'>
                          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                            <Wrench className='size-4' /> Actions
                          </CardTitle>
                        </CardHeader>
                        <CardContent
                          className='flex flex-wrap gap-2'
                          data-testid='service-detail-overview-actions'
                        >
                          {overviewActions.length ? (
                            overviewActions.map((action) => (
                              <ServiceActionButton
                                key={action.id}
                                action={action}
                                service={service}
                              />
                            ))
                          ) : (
                            <p className='text-sm text-muted-foreground'>
                              No secondary actions are available.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                    <ServiceMetadataTable service={service} />
                  </TabsContent>

                  <TabsContent
                    value='dependencies'
                    className='mt-0 min-h-0 flex-1 space-y-4 overflow-auto'
                  >
                    <LocalDependencyGraph service={service} />

                    <Card>
                      <CardHeader>
                        <CardTitle>Relationship lists</CardTitle>
                        <CardDescription>
                          Direct dependencies and dependents for this service.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className='grid gap-5 lg:grid-cols-2'>
                        <RelationshipList
                          title='Depends on'
                          items={service.dependencies}
                        />
                        <RelationshipList
                          title='Dependents'
                          items={service.dependents}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent
                    value='setup'
                    className='mt-0 min-h-0 flex-1 overflow-auto'
                  >
                    <ServiceSetupPanel
                      setup={setupQuery.data}
                      loading={setupQuery.isLoading}
                      pendingStepId={pendingSetupStepId}
                      forceRerun={forceSetupRerun}
                      onForceRerunChange={setForceSetupRerun}
                      onRunAll={() => runSetup()}
                      onRunStep={(stepId) => runSetup(stepId)}
                    />
                  </TabsContent>

                  <TabsContent
                    value='access'
                    className='mt-0 min-h-0 flex-1 overflow-auto'
                  >
                    <ServiceAccessPanel service={service} />
                  </TabsContent>

                  <TabsContent
                    value='endpoints'
                    className='mt-0 min-h-0 flex-1 overflow-auto'
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle className='flex items-center gap-2'>
                          <Link2 className='size-4' /> Endpoints
                        </CardTitle>
                        <CardDescription>
                          Operator-facing endpoint table for this service.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <EndpointsTable endpoints={service.endpoints} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent
                    value='variables'
                    className='mt-0 flex min-h-0 flex-1 flex-col overflow-hidden'
                  >
                    <Card className='flex min-h-0 flex-1 flex-col overflow-hidden'>
                      <CardHeader className='shrink-0'>
                        <CardTitle>Environment variables</CardTitle>
                        <CardDescription>
                          Service-local and shared environment values surfaced
                          in a searchable top-level Variables page as well.
                        </CardDescription>
                        <CardAction>
                          <Button variant='outline' size='sm' asChild>
                            <Link
                              to='/variables'
                              search={{ service: service.id }}
                            >
                              Open all variables
                            </Link>
                          </Button>
                        </CardAction>
                      </CardHeader>
                      <CardContent className='flex min-h-0 flex-1 flex-col'>
                        <EnvironmentTable
                          serviceId={service.id}
                          variables={service.environmentVariables}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {service.id === '@secretsbroker' ? (
                    <TabsContent
                      value='secrets'
                      className='mt-0 min-h-0 flex-1 space-y-4 overflow-auto'
                    >
                      <SecretsBrokerOperationsPanel />
                      <SecretsBrokerLifecyclePanel />
                      <SecretsBrokerTopologyPanel />
                      <SecretsBrokerSecretsPanel
                        rotationOperationId={rotationOperationId}
                        onRotationOperationChange={onRotationOperationChange}
                      />
                    </TabsContent>
                  ) : null}

                  <TabsContent
                    value='config'
                    className='mt-0 min-h-0 flex-1 overflow-auto'
                  >
                    <ServiceConfigEditor service={service} />
                  </TabsContent>

                  <TabsContent
                    value='logs'
                    className='mt-0 flex min-h-[32rem] flex-1 flex-col'
                  >
                    <ServiceDetailLogsPanel service={service} />
                  </TabsContent>

                  <TabsContent
                    value='terminal'
                    className='mt-0 min-h-0 flex-1 overflow-auto'
                  >
                    <ServiceTerminalPanel service={service} />
                  </TabsContent>
                </Tabs>
              </div>
            )
          })()
        )}
      </Main>
    </>
  )
}
