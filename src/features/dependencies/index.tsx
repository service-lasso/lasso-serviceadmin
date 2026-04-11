import { memo, useMemo, useState } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import {
  Background,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowRight,
  GitBranch,
  Link2,
  Minus,
  Network,
  Plus,
  Search,
  Star,
  Workflow,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  useFavoriteFeatureState,
  useServices,
  useToggleFavorite,
} from '@/lib/service-lasso-dashboard/hooks'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'

const route = getRouteApi('/_authenticated/dependencies/')

type GraphCategory =
  | 'app'
  | 'runtime'
  | 'infrastructure'
  | 'utility'
  | 'security'
  | 'workflow'
  | 'other'

type GraphNodeData = {
  serviceId: string
  label: string
  subtitle: string
  status: DashboardService['status']
  category: GraphCategory
  version: string
  runtime: string
  favorite: boolean
  favoritesEnabled: boolean
  emphasis: 'selected' | 'related' | 'surrounding'
  onToggleFavorite?: (serviceId: string) => void
}

function getCategory(service: DashboardService): GraphCategory {
  const type = service.metadata.serviceType.toLowerCase()
  if (type.includes('ui') || type.includes('app')) return 'app'
  if (type.includes('runtime')) return 'runtime'
  if (type.includes('infra') || type.includes('core-platform'))
    return 'infrastructure'
  if (type.includes('utility')) return 'utility'
  if (
    type.includes('identity') ||
    type.includes('security') ||
    type.includes('auth')
  )
    return 'security'
  if (type.includes('workflow')) return 'workflow'
  return 'other'
}

function categoryTone(category: GraphCategory) {
  switch (category) {
    case 'app':
      return 'bg-sky-500/15 text-sky-700 border-sky-500/30'
    case 'runtime':
      return 'bg-violet-500/15 text-violet-700 border-violet-500/30'
    case 'infrastructure':
      return 'bg-slate-500/15 text-slate-700 border-slate-500/30'
    case 'utility':
      return 'bg-zinc-500/15 text-zinc-700 border-zinc-500/30'
    case 'security':
      return 'bg-amber-500/15 text-amber-700 border-amber-500/30'
    case 'workflow':
      return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

function statusTone(status: DashboardService['status']) {
  if (status === 'running') return 'bg-emerald-600 hover:bg-emerald-600'
  if (status === 'degraded') return undefined
  return undefined
}

function statusColor(status: DashboardService['status']) {
  if (status === 'running') return '#16a34a'
  if (status === 'degraded') return '#f59e0b'
  return '#6b7280'
}

function categoryColor(category: GraphCategory) {
  switch (category) {
    case 'app':
      return '#0ea5e9'
    case 'runtime':
      return '#8b5cf6'
    case 'infrastructure':
      return '#64748b'
    case 'utility':
      return '#71717a'
    case 'security':
      return '#f59e0b'
    case 'workflow':
      return '#10b981'
    default:
      return '#6b7280'
  }
}

function GraphControlPanel() {
  const reactFlow = useReactFlow()

  return (
    <Panel position='bottom-left'>
      <div className='flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm'>
        <button
          type='button'
          className='flex h-10 w-10 items-center justify-center border-b border-border text-foreground transition-colors hover:bg-accent'
          onClick={() => void reactFlow.zoomIn()}
          aria-label='Zoom in'
        >
          <Plus className='size-4' />
        </button>
        <button
          type='button'
          className='flex h-10 w-10 items-center justify-center border-b border-border text-foreground transition-colors hover:bg-accent'
          onClick={() => void reactFlow.zoomOut()}
          aria-label='Zoom out'
        >
          <Minus className='size-4' />
        </button>
        <button
          type='button'
          className='flex h-10 w-10 items-center justify-center text-[10px] font-medium text-foreground transition-colors hover:bg-accent'
          onClick={() => void reactFlow.fitView({ padding: 0.18 })}
          aria-label='Fit graph to view'
        >
          FIT
        </button>
      </div>
    </Panel>
  )
}

const GraphServiceNode = memo(({ data }: NodeProps) => {
  const graphData = data as GraphNodeData
  const emphasisTone =
    graphData.emphasis === 'selected'
      ? 'border-emerald-500 bg-emerald-500/10 shadow-lg ring-2 ring-emerald-500/25'
      : graphData.emphasis === 'related'
        ? 'border-border bg-background'
        : 'border-dashed border-muted-foreground/30 bg-muted/15'

  return (
    <div
      className={`graph-node-drag relative w-[240px] cursor-grab rounded-xl border p-3 active:cursor-grabbing ${emphasisTone}`}
    >
      <Handle
        type='target'
        position={Position.Left}
        className='!size-3 !border-2 !border-background !bg-primary/80'
      />
      <Handle
        type='source'
        position={Position.Right}
        className='!size-3 !border-2 !border-background !bg-primary/80'
      />
      <div className='space-y-2'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex min-w-0 items-start gap-2'>
            <button
              type='button'
              aria-label={
                graphData.favorite
                  ? `Remove ${graphData.label} from favorites`
                  : `Add ${graphData.label} to favorites`
              }
              title={
                graphData.favoritesEnabled
                  ? graphData.favorite
                    ? `Remove ${graphData.label} from favorites`
                    : `Add ${graphData.label} to favorites`
                  : 'Favorites editing is disabled until Service Lasso API endpoint and favorites flag are enabled'
              }
              disabled={!graphData.favoritesEnabled}
              className='mt-0.5 rounded-sm text-muted-foreground transition-colors hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50'
              onClick={(event) => {
                event.stopPropagation()
                if (!graphData.favoritesEnabled) return
                graphData.onToggleFavorite?.(graphData.serviceId)
              }}
            >
              <Star
                className={`size-4 ${graphData.favorite ? 'fill-amber-400 text-amber-400' : ''}`}
              />
            </button>
            <div className='min-w-0'>
              <div className='truncate text-sm font-semibold'>
                {graphData.label}
              </div>
              <div className='truncate text-xs text-muted-foreground'>
                {graphData.subtitle}
              </div>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <Badge
              className={statusTone(graphData.status)}
              variant={
                graphData.status === 'degraded'
                  ? 'secondary'
                  : graphData.status === 'stopped'
                    ? 'outline'
                    : undefined
              }
            >
              {graphData.status}
            </Badge>
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <span
            className={`rounded-md border px-2 py-0.5 text-[11px] ${categoryTone(graphData.category)}`}
          >
            {graphData.category}
          </span>
          <span className='rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground'>
            {graphData.runtime}
          </span>
        </div>
        <div className='text-[11px] text-muted-foreground'>
          {graphData.version}
        </div>
      </div>
    </div>
  )
})
GraphServiceNode.displayName = 'GraphServiceNode'

const nodeTypes = { service: GraphServiceNode as never }

function buildNode(
  service: DashboardService,
  position: { x: number; y: number },
  emphasis: GraphNodeData['emphasis'],
  favoritesEnabled: boolean,
  onToggleFavorite?: (serviceId: string) => void
): Node<GraphNodeData> {
  return {
    id: service.id,
    type: 'service',
    position,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    dragHandle: '.graph-node-drag',
    data: {
      serviceId: service.id,
      label: service.name,
      subtitle: `${service.id} · ${service.role}`,
      status: service.status,
      category: getCategory(service),
      version: service.metadata.version,
      runtime: service.metadata.runtime,
      favorite: service.favorite,
      favoritesEnabled,
      emphasis,
      onToggleFavorite,
    },
  }
}

function buildGraph(
  services: DashboardService[],
  selectedService: DashboardService | null,
  showSurrounding: boolean,
  favoritesEnabled: boolean,
  onToggleFavorite?: (serviceId: string) => void
) {
  if (!selectedService) {
    return { nodes: [] as Node<GraphNodeData>[], edges: [] as Edge[] }
  }

  const byId = new Map(services.map((service) => [service.id, service]))
  const dependencyServices = selectedService.dependencies
    .map((item) => byId.get(item.id))
    .filter((service): service is DashboardService => Boolean(service))
  const dependentServices = selectedService.dependents
    .map((item) => byId.get(item.id))
    .filter((service): service is DashboardService => Boolean(service))

  const relatedIds = new Set([
    selectedService.id,
    ...dependencyServices.map((service) => service.id),
    ...dependentServices.map((service) => service.id),
  ])

  const surroundingServices = showSurrounding
    ? services.filter((service) => !relatedIds.has(service.id))
    : []

  const nodes: Node<GraphNodeData>[] = [
    buildNode(
      selectedService,
      { x: 420, y: 180 },
      'selected',
      favoritesEnabled,
      onToggleFavorite
    ),
    ...dependencyServices.map((service, index) =>
      buildNode(
        service,
        { x: 60, y: 40 + index * 150 },
        'related',
        favoritesEnabled,
        onToggleFavorite
      )
    ),
    ...dependentServices.map((service, index) =>
      buildNode(
        service,
        { x: 780, y: 40 + index * 150 },
        'related',
        favoritesEnabled,
        onToggleFavorite
      )
    ),
    ...surroundingServices.map((service, index) =>
      buildNode(
        service,
        {
          x: 60 + (index % 4) * 250,
          y: 470 + Math.floor(index / 4) * 150,
        },
        'surrounding',
        favoritesEnabled,
        onToggleFavorite
      )
    ),
  ]

  const edges: Edge[] = [
    ...dependencyServices.map((service) => ({
      id: `${service.id}->${selectedService.id}`,
      source: service.id,
      target: selectedService.id,
      animated: service.status === 'degraded',
      type: 'straight',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: statusColor(service.status), strokeWidth: 2.25 },
      label: 'depends on',
      labelStyle: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
    })),
    ...dependentServices.map((service) => ({
      id: `${selectedService.id}->${service.id}`,
      source: selectedService.id,
      target: service.id,
      animated: service.status === 'degraded',
      type: 'straight',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: statusColor(service.status), strokeWidth: 2.25 },
      label: 'feeds',
      labelStyle: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' },
    })),
  ]

  return { nodes, edges }
}

function DependenciesLoading() {
  return (
    <div className='space-y-4'>
      <div className='grid gap-4 md:grid-cols-3'>
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        <Skeleton className='h-[620px] w-full lg:col-span-2' />
        <Skeleton className='h-[620px] w-full' />
      </div>
    </div>
  )
}

export function Dependencies() {
  usePageMetadata({
    title: 'Service Admin - Dependencies',
    description:
      'Service Admin dependency graph for Service Lasso services and relationships.',
  })

  const searchState = route.useSearch()
  const navigate = route.useNavigate()
  const servicesQuery = useServices()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | DashboardService['status']
  >('all')
  const [categoryFilter, setCategoryFilter] = useState<GraphCategory | 'all'>(
    'all'
  )
  const [hideUtility, setHideUtility] = useState(false)
  const [showSurrounding, setShowSurrounding] = useState(true)
  const [graphVersion, setGraphVersion] = useState(0)

  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data])
  const toggleFavorite = useToggleFavorite()
  const favoriteFeature = useFavoriteFeatureState()

  const availableCategories = useMemo(() => {
    return Array.from(new Set(services.map((service) => getCategory(service))))
  }, [services])

  const filteredServices = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return services.filter((service) => {
      if (normalized) {
        const matchesSearch = [service.name, service.id, service.role]
          .join(' ')
          .toLowerCase()
          .includes(normalized)
        if (!matchesSearch) return false
      }

      if (statusFilter !== 'all' && service.status !== statusFilter)
        return false
      const category = getCategory(service)
      if (categoryFilter !== 'all' && category !== categoryFilter) return false
      if (hideUtility && category === 'utility') return false
      return true
    })
  }, [categoryFilter, hideUtility, query, services, statusFilter])

  const selectedService = useMemo(() => {
    return (
      filteredServices.find((service) => service.id === searchState.service) ??
      filteredServices[0] ??
      null
    )
  }, [filteredServices, searchState.service])

  const relationshipEdges = services.reduce(
    (count, service) => count + service.dependencies.length,
    0
  )

  const { nodes, edges } = useMemo(
    () =>
      buildGraph(
        filteredServices,
        selectedService,
        showSurrounding,
        favoriteFeature.enabled,
        (serviceId) => {
          void toggleFavorite.mutateAsync(serviceId)
        }
      ),
    [
      favoriteFeature.enabled,
      filteredServices,
      selectedService,
      showSurrounding,
      toggleFavorite,
    ]
  )

  const selectService = (serviceId: string) => {
    navigate({
      search: (prev) => ({
        ...(prev as Record<string, unknown>),
        service: serviceId,
      }),
    })
  }

  const resetGraphView = () => setGraphVersion((value) => value + 1)

  return (
    <>
      <Header fixed>
        <div className='relative w-full max-w-sm'>
          <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search services in the dependency graph...'
            className='pl-9'
          />
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Dependencies</h2>
            <p className='text-muted-foreground'>
              React Flow dependency graph with selected-service focus,
              category/status semantics, and operator filters.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/services'>Services</Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/logs'>Logs</Link>
            </Button>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <DependenciesLoading />
        ) : (
          <>
            <div className='grid gap-4 md:grid-cols-3'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                    <Network className='size-4' /> Services in graph
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {filteredServices.length}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Visible nodes after current filters.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                    <GitBranch className='size-4' /> Relationship edges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{relationshipEdges}</div>
                  <p className='text-xs text-muted-foreground'>
                    Total dependency links declared in the graph data.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                    <Workflow className='size-4' /> Selected node
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {selectedService ? selectedService.name : 'None'}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Click any node to refocus the graph.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Graph controls</CardTitle>
                <CardDescription>
                  Use these filters to simplify the graph before drilling into a
                  selected service.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex flex-wrap gap-2'>
                  <span className='self-center text-sm text-muted-foreground'>
                    Status:
                  </span>
                  {(['all', 'running', 'degraded', 'stopped'] as const).map(
                    (value) => (
                      <Button
                        key={value}
                        type='button'
                        size='sm'
                        variant={statusFilter === value ? 'default' : 'outline'}
                        onClick={() => setStatusFilter(value)}
                      >
                        {value}
                      </Button>
                    )
                  )}
                </div>
                <div className='flex flex-wrap gap-2'>
                  <span className='self-center text-sm text-muted-foreground'>
                    Category:
                  </span>
                  <Button
                    type='button'
                    size='sm'
                    variant={categoryFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setCategoryFilter('all')}
                  >
                    all
                  </Button>
                  {availableCategories.map((category) => (
                    <Button
                      key={category}
                      type='button'
                      size='sm'
                      variant={
                        categoryFilter === category ? 'default' : 'outline'
                      }
                      onClick={() => setCategoryFilter(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Button
                    type='button'
                    size='sm'
                    variant={hideUtility ? 'default' : 'outline'}
                    onClick={() => setHideUtility((value) => !value)}
                  >
                    {hideUtility ? 'utility hidden' : 'hide utility'}
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant={showSurrounding ? 'default' : 'outline'}
                    onClick={() => setShowSurrounding((value) => !value)}
                  >
                    {showSurrounding ? 'surrounding shown' : 'show surrounding'}
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={resetGraphView}
                  >
                    reset view
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className='grid gap-4 lg:grid-cols-3'>
              <Card className='lg:col-span-2'>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Link2 className='size-4' /> Dependency graph
                  </CardTitle>
                  <CardDescription>
                    Selected service centered, dependencies to the left,
                    dependents to the right.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='h-[640px] overflow-hidden rounded-md border bg-background'>
                    <ReactFlow
                      key={graphVersion}
                      nodes={nodes}
                      edges={edges}
                      nodeTypes={nodeTypes}
                      fitView
                      fitViewOptions={{ padding: 0.18 }}
                      nodesDraggable
                      panOnDrag={[1, 2]}
                      proOptions={{ hideAttribution: true }}
                      onNodeClick={(_, node) => selectService(node.id)}
                    >
                      <MiniMap
                        bgColor='#020617'
                        maskColor='rgba(148, 163, 184, 0.22)'
                        style={{
                          backgroundColor: '#020617',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 12,
                          width: 200,
                          height: 132,
                        }}
                        nodeBorderRadius={10}
                        nodeStrokeWidth={3}
                        nodeColor={(node) =>
                          categoryColor(
                            (node.data as GraphNodeData | undefined)
                              ?.category ?? 'other'
                          )
                        }
                        nodeStrokeColor={(node) =>
                          statusColor(
                            (node.data as GraphNodeData | undefined)?.status ??
                              'stopped'
                          )
                        }
                        pannable
                        zoomable
                      />
                      <GraphControlPanel />
                      <Background gap={16} />
                    </ReactFlow>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Selected service details</CardTitle>
                  <CardDescription>
                    Relationship context and next jumps for the focused node.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                  {selectedService ? (
                    <>
                      <div className='rounded-lg border p-3'>
                        <div className='flex items-start justify-between gap-2'>
                          <div>
                            <div className='font-medium'>
                              {selectedService.name}
                            </div>
                            <div className='text-xs text-muted-foreground'>
                              {selectedService.id} · {selectedService.role}
                            </div>
                          </div>
                          <button
                            type='button'
                            aria-label={
                              selectedService.favorite
                                ? `Remove ${selectedService.name} from favorites`
                                : `Add ${selectedService.name} to favorites`
                            }
                            title={
                              favoriteFeature.enabled
                                ? selectedService.favorite
                                  ? `Remove ${selectedService.name} from favorites`
                                  : `Add ${selectedService.name} to favorites`
                                : 'Favorites editing is disabled until Service Lasso API endpoint and favorites flag are enabled'
                            }
                            disabled={!favoriteFeature.enabled}
                            className='rounded-sm text-muted-foreground transition-colors hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50'
                            onClick={() => {
                              if (!favoriteFeature.enabled) return
                              void toggleFavorite.mutateAsync(
                                selectedService.id
                              )
                            }}
                          >
                            <Star
                              className={`size-4 ${selectedService.favorite ? 'fill-amber-400 text-amber-400' : ''}`}
                            />
                          </button>
                        </div>
                        <div className='mt-3 flex flex-wrap gap-2'>
                          <Badge
                            className={statusTone(selectedService.status)}
                            variant={
                              selectedService.status === 'degraded'
                                ? 'secondary'
                                : selectedService.status === 'stopped'
                                  ? 'outline'
                                  : undefined
                            }
                          >
                            {selectedService.status}
                          </Badge>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-xs ${categoryTone(getCategory(selectedService))}`}
                          >
                            {getCategory(selectedService)}
                          </span>
                        </div>
                      </div>

                      <div className='space-y-2 text-sm text-muted-foreground'>
                        <p>{selectedService.note}</p>
                        <p>{selectedService.runtimeHealth.summary}</p>
                      </div>

                      <div className='rounded-lg border p-3'>
                        <div className='mb-2 text-sm font-medium'>
                          Relationship summary
                        </div>
                        <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                          <span>
                            {selectedService.dependencies.length} dependency
                          </span>
                          <ArrowRight className='size-4' />
                          <span>
                            {selectedService.dependents.length} dependent
                          </span>
                        </div>
                      </div>

                      <div className='flex flex-wrap gap-2'>
                        <Button variant='outline' size='sm' asChild>
                          <Link
                            to='/services/$serviceId'
                            params={{ serviceId: selectedService.id }}
                          >
                            Open service details
                          </Link>
                        </Button>
                        <Button variant='outline' size='sm' asChild>
                          <Link
                            to='/logs'
                            search={{ service: selectedService.id }}
                          >
                            Open logs
                          </Link>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
                      No graph node selected.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </Main>
    </>
  )
}
