import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { LazyLog, ScrollFollow } from '@melloware/react-logviewer'
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
  Link2,
  PackageCheck,
  Save,
  ScanSearch,
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
import { useDashboardService } from '@/lib/service-lasso-dashboard/hooks'
import { serviceLassoApiBaseUrl } from '@/lib/service-lasso-dashboard/stub'
import type {
  DashboardService,
  ServiceAction,
  ServiceDependency,
  ServiceEndpoint,
  ServiceEnvironmentVariable,
  ServiceLogPreviewEntry,
  ServiceStatus,
} from '@/lib/service-lasso-dashboard/types'
import { useTheme } from '@/context/theme-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
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
import { ConfigDrawer } from '@/components/config-drawer'
import { DependencyGraphCanvas } from '@/components/dependency-graph-canvas'
import { DependencyGraphPanel } from '@/components/dependency-graph-panel'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === 'running') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Running</Badge>
    )
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

function EndpointsTable({ endpoints }: { endpoints: ServiceEndpoint[] }) {
  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Protocol</TableHead>
            <TableHead>Bind</TableHead>
            <TableHead>Port</TableHead>
            <TableHead>Exposure</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {endpoints.length ? (
            endpoints.map((endpoint) => (
              <TableRow key={`${endpoint.label}-${endpoint.url}`}>
                <TableCell className='font-medium'>{endpoint.label}</TableCell>
                <TableCell>{endpoint.protocol.toUpperCase()}</TableCell>
                <TableCell>{endpoint.bind}</TableCell>
                <TableCell>{endpoint.port}</TableCell>
                <TableCell>{endpoint.exposure}</TableCell>
                <TableCell className='max-w-[280px] text-sm break-all text-muted-foreground'>
                  {endpoint.url}
                </TableCell>
                <TableCell>
                  <Button asChild size='sm' variant='outline'>
                    <a href={endpoint.url} target='_blank' rel='noreferrer'>
                      Open
                      <ExternalLink className='ml-2 size-3.5' />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className='h-20 text-center'>
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
          None recorded in the current stub.
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

function ServiceLogViewer({ entries }: { entries: ServiceLogPreviewEntry[] }) {
  const logText = entries
    .map(
      (entry) =>
        `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`
    )
    .join('\n')

  if (!entries.length) {
    return (
      <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
        No recent log preview entries yet.
      </div>
    )
  }

  return (
    <div className='h-[260px] rounded-md border'>
      <ScrollFollow
        startFollowing={true}
        render={({ follow }) => (
          <LazyLog
            text={logText}
            follow={follow}
            enableSearch
            selectableLines
            style={{
              height: '260px',
              width: '100%',
              background: 'transparent',
            }}
          />
        )}
      />
    </div>
  )
}

function MetadataRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className='rounded-lg border p-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <div className='font-medium'>{label}</div>
          <div className='text-sm break-all text-muted-foreground'>
            {value ?? 'Not recorded'}
          </div>
        </div>
        <CopyValueButton value={value} />
      </div>
    </div>
  )
}

function EnvironmentTable({
  serviceId,
  variables,
}: {
  serviceId: string
  variables: ServiceEnvironmentVariable[]
}) {
  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variables.length ? (
            variables.map((variable) => (
              <TableRow key={variable.key}>
                <TableCell className='font-medium'>{variable.key}</TableCell>
                <TableCell className='max-w-[360px] text-sm break-all text-muted-foreground'>
                  {variable.secret ? '••••••••' : variable.value}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      variable.scope === 'global' ? 'secondary' : 'outline'
                    }
                  >
                    {variable.scope}
                  </Badge>
                </TableCell>
                <TableCell>{variable.source ?? 'Not recorded'}</TableCell>
                <TableCell>
                  <div className='flex flex-wrap gap-2'>
                    <CopyValueButton value={variable.value} />
                    <Button variant='outline' size='sm' asChild>
                      <Link
                        to='/variables'
                        search={{ service: serviceId, key: variable.key }}
                      >
                        Open variables
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className='h-20 text-center'>
                No environment variables are recorded for this service yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function renderActionButton(action: ServiceAction, service: DashboardService) {
  const key = action.id

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

  return (
    <Button
      key={key}
      variant='outline'
      size='sm'
      disabled
      title='Runtime action wiring is the next backend slice'
    >
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

export function ServiceDetail({ serviceId }: { serviceId: string }) {
  const serviceQuery = useDashboardService(serviceId)
  const serviceName = serviceQuery.data?.name ?? serviceId
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'dependencies'
    | 'metadata'
    | 'endpoints'
    | 'variables'
    | 'logs'
  >('overview')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }

      const nextTab = {
        '1': 'overview',
        '2': 'dependencies',
        '3': 'metadata',
        '4': 'endpoints',
        '5': 'variables',
        '6': 'logs',
      }[event.key] as
        | 'overview'
        | 'dependencies'
        | 'metadata'
        | 'endpoints'
        | 'variables'
        | 'logs'
        | undefined

      if (!nextTab) return
      event.preventDefault()
      setActiveTab(nextTab)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  usePageMetadata({
    title: `Service Admin - Service - ${serviceName}`,
    description: `Service Admin operator view for service ${serviceName}.`,
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
        {serviceQuery.isLoading ? (
          <ServiceDetailLoading />
        ) : !serviceQuery.data ? (
          <Card>
            <CardHeader>
              <CardTitle>Service not found</CardTitle>
              <CardDescription>
                The requested service is not present in the current stub.
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

            return (
              <>
                <div className='flex flex-wrap items-start justify-between gap-3'>
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
                      <h2 className='text-2xl font-bold tracking-tight'>
                        {service.name}
                      </h2>
                      <p className='text-sm text-muted-foreground'>
                        {service.id} · {service.role}
                      </p>
                    </div>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <Button variant='outline' size='sm' asChild>
                      <Link to='/variables' search={{ service: service.id }}>
                        Variables
                      </Link>
                    </Button>
                    <Button variant='outline' size='sm' asChild>
                      <Link to='/network'>Network</Link>
                    </Button>
                  </div>
                </div>

                <Tabs
                  value={activeTab}
                  onValueChange={(value) =>
                    setActiveTab(value as typeof activeTab)
                  }
                  className='space-y-4'
                >
                  <TabsList className='flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border border-border bg-muted/70 p-1 text-muted-foreground shadow-sm dark:border-slate-700/70 dark:bg-slate-900/90 dark:text-slate-400 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
                    <TabsTrigger
                      value='overview'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Overview{' '}
                      <span className='ml-1 italic opacity-80'>(1)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='dependencies'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Dependencies{' '}
                      <span className='ml-1 italic opacity-80'>(2)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='metadata'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Metadata{' '}
                      <span className='ml-1 italic opacity-80'>(3)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='endpoints'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Endpoints{' '}
                      <span className='ml-1 italic opacity-80'>(4)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='variables'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Variables{' '}
                      <span className='ml-1 italic opacity-80'>(5)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='logs'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Logs <span className='ml-1 italic opacity-80'>(6)</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value='overview' className='mt-0'>
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
                        <CardContent className='flex flex-wrap gap-2'>
                          {service.actions.map((action) =>
                            renderActionButton(action, service)
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value='dependencies' className='mt-0 space-y-4'>
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

                  <TabsContent value='metadata' className='mt-0'>
                    <Card>
                      <CardHeader>
                        <CardTitle className='flex items-center gap-2'>
                          <ScanSearch className='size-4' /> Runtime metadata
                        </CardTitle>
                        <CardDescription>
                          Concrete service facts useful during operator review.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-3 text-sm'>
                        <MetadataRow
                          label='Package'
                          value={service.metadata.packageId}
                        />
                        <MetadataRow
                          label='Install path'
                          value={service.metadata.installPath}
                        />
                        <MetadataRow
                          label='Config path'
                          value={service.metadata.configPath}
                        />
                        <MetadataRow
                          label='Data path'
                          value={service.metadata.dataPath}
                        />
                        <MetadataRow
                          label='Log path'
                          value={service.metadata.logPath}
                        />
                        <MetadataRow
                          label='Work path'
                          value={service.metadata.workPath}
                        />
                        <div className='rounded-lg border p-3'>
                          <div className='font-medium'>Profile</div>
                          <div className='text-sm text-muted-foreground'>
                            {service.metadata.profile ?? 'Not recorded'}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value='endpoints' className='mt-0'>
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

                  <TabsContent value='variables' className='mt-0'>
                    <Card>
                      <CardHeader>
                        <CardTitle>Environment variables</CardTitle>
                        <CardDescription>
                          Service-local and shared environment values surfaced
                          in a searchable top-level Variables page as well.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-4'>
                        <EnvironmentTable
                          serviceId={service.id}
                          variables={service.environmentVariables}
                        />
                        <div className='flex justify-end'>
                          <Button variant='outline' size='sm' asChild>
                            <Link
                              to='/variables'
                              search={{ service: service.id }}
                            >
                              Open all variables
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value='logs' className='mt-0'>
                    <Card>
                      <CardHeader>
                        <CardTitle>Diagnostics + recent logs</CardTitle>
                        <CardDescription>
                          Recent activity preview plus the next operator jump
                          points.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-4'>
                        <MetadataRow
                          label='Current log file'
                          value={service.metadata.logPath}
                        />
                        <ServiceLogViewer entries={service.recentLogs} />
                        <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
                          <Button variant='outline' asChild>
                            <Link to='/logs' search={{ service: service.id }}>
                              Open live logs
                            </Link>
                          </Button>
                          <Button variant='outline' asChild>
                            <Link
                              to='/dependencies'
                              search={{ service: service.id }}
                            >
                              Open dependencies
                            </Link>
                          </Button>
                          <Button variant='outline' asChild>
                            <Link to='/network'>Open network view</Link>
                          </Button>
                          <Button variant='outline' asChild>
                            <Link
                              to='/runtime'
                              search={{ service: service.id }}
                            >
                              Open runtime view
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )
          })()
        )}
      </Main>
    </>
  )
}
