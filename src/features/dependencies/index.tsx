import { useEffect, useMemo, useState } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { GitBranch, Link2, Network, Search, Star, Workflow } from 'lucide-react'
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

function getCategory(service: DashboardService): GraphCategory {
  const type = service.metadata.serviceType.toLowerCase()
  if (type.includes('ui') || type.includes('app')) return 'app'
  if (type.includes('runtime')) return 'runtime'
  if (type.includes('infra') || type.includes('core-platform')) {
    return 'infrastructure'
  }
  if (type.includes('utility')) return 'utility'
  if (
    type.includes('identity') ||
    type.includes('security') ||
    type.includes('auth')
  ) {
    return 'security'
  }
  if (type.includes('workflow')) return 'workflow'
  return 'other'
}

function categoryNodeColor(category: GraphCategory) {
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
      return '#d97706'
    case 'workflow':
      return '#10b981'
    default:
      return '#6b7280'
  }
}

function StatusBadge({ status }: { status: DashboardService['status'] }) {
  if (status === 'running') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Running</Badge>
    )
  }
  if (status === 'degraded') return <Badge variant='secondary'>Degraded</Badge>
  return <Badge variant='outline'>Stopped</Badge>
}

function DependenciesLoading() {
  return (
    <div className='space-y-4'>
      <div className='grid gap-4 md:grid-cols-4'>
        <Skeleton className='h-28 w-full' />
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
    description: 'Service Admin dependency graph and relationship table.',
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

  const toggleFavorite = useToggleFavorite()
  const favoriteFeature = useFavoriteFeatureState()

  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data])

  const availableCategories = useMemo(
    () => Array.from(new Set(services.map((service) => getCategory(service)))),
    [services]
  )

  const filteredServices = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return services.filter((service) => {
      if (normalized) {
        const matches = [service.name, service.id, service.role]
          .join(' ')
          .toLowerCase()
          .includes(normalized)
        if (!matches) return false
      }

      if (statusFilter !== 'all' && service.status !== statusFilter)
        return false

      const category = getCategory(service)
      if (categoryFilter !== 'all' && category !== categoryFilter) return false
      if (hideUtility && category === 'utility') return false

      return true
    })
  }, [categoryFilter, hideUtility, query, services, statusFilter])

  const byId = useMemo(
    () => new Map(filteredServices.map((service) => [service.id, service])),
    [filteredServices]
  )

  const selectedService = useMemo(() => {
    return (
      filteredServices.find((service) => service.id === searchState.service) ??
      filteredServices[0] ??
      null
    )
  }, [filteredServices, searchState.service])

  const selectedDependencies = useMemo(() => {
    if (!selectedService) return []
    return selectedService.dependencies
      .map((item) => byId.get(item.id))
      .filter((service): service is DashboardService => Boolean(service))
  }, [byId, selectedService])

  const selectedDependents = useMemo(() => {
    if (!selectedService) return []
    return selectedService.dependents
      .map((item) => byId.get(item.id))
      .filter((service): service is DashboardService => Boolean(service))
  }, [byId, selectedService])

  const relationshipEdges = services.reduce(
    (count, service) => count + service.dependencies.length,
    0
  )

  const inferredApiUsageEdges = services.reduce(
    (count, service) =>
      count +
      service.dependencies.filter((dependency) => {
        const dependencyService = services.find(
          (item) => item.id === dependency.id
        )
        return (dependencyService?.endpoints.length ?? 0) > 0
      }).length,
    0
  )

  const graph = useMemo(() => {
    const rowSize = 4
    const xStep = 260
    const yStep = 130

    const nodes: Node[] = filteredServices.map((service, index) => {
      const col = index % rowSize
      const row = Math.floor(index / rowSize)
      const selected = selectedService?.id === service.id
      const category = getCategory(service)

      return {
        id: service.id,
        position: { x: col * xStep, y: row * yStep },
        data: {
          label: (
            <div className='min-w-[170px]'>
              <div className='truncate text-sm font-semibold'>
                {service.name}
              </div>
              <div className='truncate text-xs text-muted-foreground'>
                {service.id}
              </div>
            </div>
          ),
        },
        style: {
          border: selected ? '2px solid #22c55e' : '1px solid #334155',
          borderRadius: 10,
          background: selected ? '#052e16' : '#0f172a',
          color: '#e2e8f0',
          boxShadow: selected ? '0 0 0 2px rgba(34,197,94,0.25)' : 'none',
        },
        draggable: true,
        connectable: false,
        className: `category-${category}`,
      }
    })

    const structuralEdges: Edge[] = filteredServices.flatMap((service) =>
      service.dependencies
        .filter((dependency) => byId.has(dependency.id))
        .map((dependency) => {
          const selectedEdge =
            selectedService?.id === service.id ||
            selectedService?.id === dependency.id

          return {
            id: `${dependency.id}->${service.id}`,
            source: dependency.id,
            target: service.id,
            label: 'depends_on',
            labelStyle: { fill: '#94a3b8', fontSize: 10, fontWeight: 600 },
            labelBgStyle: {
              fill: '#0f172a',
              fillOpacity: 0.9,
            },
            labelBgPadding: [4, 2] as [number, number],
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: selectedEdge ? '#22c55e' : '#64748b',
              width: 18,
              height: 18,
            },
            animated: selectedEdge,
            style: {
              stroke: selectedEdge ? '#22c55e' : '#64748b',
              strokeWidth: selectedEdge ? 2.5 : 1.25,
            },
          }
        })
    )

    const inferredApiEdges: Edge[] = filteredServices.flatMap((service) =>
      service.dependencies
        .filter((dependency) => {
          const dependencyService = byId.get(dependency.id)
          return (dependencyService?.endpoints.length ?? 0) > 0
        })
        .map((dependency) => {
          const selectedEdge =
            selectedService?.id === service.id ||
            selectedService?.id === dependency.id

          return {
            id: `${dependency.id}->${service.id}:api`,
            source: dependency.id,
            target: service.id,
            label: 'api_usage',
            labelStyle: { fill: '#7dd3fc', fontSize: 10, fontWeight: 600 },
            labelBgStyle: {
              fill: '#0f172a',
              fillOpacity: 0.9,
            },
            labelBgPadding: [4, 2] as [number, number],
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#38bdf8',
              width: 18,
              height: 18,
            },
            animated: selectedEdge,
            style: {
              stroke: '#38bdf8',
              strokeWidth: selectedEdge ? 2.25 : 1.5,
              strokeDasharray: '6 4',
            },
          }
        })
    )

    return { nodes, edges: [...structuralEdges, ...inferredApiEdges] }
  }, [byId, filteredServices, selectedService?.id])

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges)

  useEffect(() => {
    setNodes((previousNodes) => {
      const previousPositions = new Map(
        previousNodes.map((node) => [node.id, node.position])
      )

      return graph.nodes.map((node) => ({
        ...node,
        position: previousPositions.get(node.id) ?? node.position,
      }))
    })

    setEdges(graph.edges)
  }, [graph.edges, graph.nodes, setEdges, setNodes])

  const selectService = (serviceId: string) => {
    navigate({
      search: (prev) => ({
        ...(prev as Record<string, unknown>),
        service: serviceId,
      }),
    })
  }

  const onToggleFavorite = (serviceId: string) => {
    if (!favoriteFeature.enabled) return
    void toggleFavorite.mutateAsync(serviceId)
  }

  return (
    <>
      <Header fixed>
        <div className='relative w-full max-w-sm'>
          <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search services in dependencies...'
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
              Graph rendering is back: inspect dependency topology, then drill
              into selected service relationships.
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
            <div className='grid gap-4 md:grid-cols-4'>
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
                    Visible services after filters.
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
                    Structural dependency links.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                    <Link2 className='size-4' /> API usage edges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {inferredApiUsageEdges}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Inferred from endpoint-exposing dependencies.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                    <Workflow className='size-4' /> Selected service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {selectedService ? selectedService.name : 'None'}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Click a node in the graph to focus.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <GitBranch className='size-4' /> Graph controls
                </CardTitle>
                <CardDescription>
                  Filter graph nodes before selecting a service.
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
                  <Button
                    type='button'
                    size='sm'
                    variant={hideUtility ? 'default' : 'outline'}
                    onClick={() => setHideUtility((value) => !value)}
                  >
                    {hideUtility ? 'utility hidden' : 'hide utility'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className='grid gap-4 lg:grid-cols-3'>
              <Card className='lg:col-span-2'>
                <CardHeader>
                  <CardTitle>Dependency graph</CardTitle>
                  <CardDescription>
                    React Flow topology of the currently visible services.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='h-[520px] rounded-lg border bg-slate-950'>
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      fitView
                      minZoom={0.35}
                      maxZoom={1.6}
                      onNodeClick={(_, node) => selectService(node.id)}
                    >
                      <Background gap={20} size={1} color='#1f2937' />
                      <Controls />
                      <MiniMap
                        pannable
                        zoomable
                        nodeColor={(node) => {
                          const service = byId.get(node.id)
                          return service
                            ? categoryNodeColor(getCategory(service))
                            : '#6b7280'
                        }}
                        maskColor='rgba(2, 6, 23, 0.5)'
                        className='!border !border-slate-700 !bg-slate-900'
                      />
                    </ReactFlow>
                  </div>

                  <div className='flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200'>
                    <div className='flex items-center gap-2'>
                      <span className='inline-block h-[2px] w-8 rounded bg-slate-300' />
                      Structural dependency
                    </div>
                    <div className='flex items-center gap-2'>
                      <span className='inline-block h-[2px] w-8 rounded bg-emerald-500' />
                      Selected-path dependency
                    </div>
                    <div className='flex items-center gap-2'>
                      <span className='inline-block h-[2px] w-8 border-t-2 border-dashed border-sky-400' />
                      Inferred API usage
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Selected service details</CardTitle>
                  <CardDescription>
                    Relationship context and quick actions.
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
                            onClick={() => onToggleFavorite(selectedService.id)}
                          >
                            <Star
                              className={`size-4 ${selectedService.favorite ? 'fill-amber-400 text-amber-400' : ''}`}
                            />
                          </button>
                        </div>

                        <div className='mt-3 flex flex-wrap gap-2'>
                          <StatusBadge status={selectedService.status} />
                          <Badge variant='outline'>
                            {selectedService.dependencies.length} deps
                          </Badge>
                          <Badge variant='outline'>
                            {selectedService.dependents.length} dependents
                          </Badge>
                        </div>
                      </div>

                      <div className='space-y-3'>
                        <div className='text-sm font-medium'>Depends on</div>
                        {selectedDependencies.length ? (
                          selectedDependencies.map((service) => (
                            <button
                              key={service.id}
                              type='button'
                              className='w-full rounded-lg border p-3 text-left hover:bg-accent'
                              onClick={() => selectService(service.id)}
                            >
                              <div className='font-medium'>{service.name}</div>
                              <div className='text-xs text-muted-foreground'>
                                {service.id}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
                            No dependencies in current graph scope.
                          </div>
                        )}
                      </div>

                      <div className='space-y-3'>
                        <div className='text-sm font-medium'>Dependents</div>
                        {selectedDependents.length ? (
                          selectedDependents.map((service) => (
                            <button
                              key={service.id}
                              type='button'
                              className='w-full rounded-lg border p-3 text-left hover:bg-accent'
                              onClick={() => selectService(service.id)}
                            >
                              <div className='font-medium'>{service.name}</div>
                              <div className='text-xs text-muted-foreground'>
                                {service.id}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
                            No dependents in current graph scope.
                          </div>
                        )}
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
                      No service selected.
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
