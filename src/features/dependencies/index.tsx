import { useEffect, useMemo, useState } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import {
  Position,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import {
  ArrowDown,
  ArrowRight,
  GitBranch,
  Link2,
  Network,
  Save,
  Search,
  Star,
  Undo2,
  Workflow,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTheme } from '@/context/theme-provider'
import {
  buildApiUsageEdge,
  buildDependencyEdge,
  buildServiceNodeLabel,
  buildServiceNodeStyle,
  categoryNodeColor,
  getGraphCategory,
  getServiceNodeImage,
} from '@/lib/service-graph'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfigDrawer } from '@/components/config-drawer'
import { DependencyGraphCanvas } from '@/components/dependency-graph-canvas'
import { DependencyGraphPanel } from '@/components/dependency-graph-panel'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search as GlobalSearch } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

const route = getRouteApi('/_authenticated/dependencies/')

const serviceLassoApiBaseUrl =
  import.meta.env.VITE_SERVICE_LASSO_API_BASE_URL?.replace(/\/$/, '') || null

type GraphLayoutMap = Record<string, { x: number; y: number }>
type GraphOrientation = 'horizontal' | 'vertical'

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

type GraphCategory = ReturnType<typeof getGraphCategory>

function getCategory(service: DashboardService): GraphCategory {
  return getGraphCategory(service.metadata.serviceType)
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
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [query, setQuery] = useState('')
  const [savedLayoutMap, setSavedLayoutMap] = useState<GraphLayoutMap>({})
  const [layoutMap, setLayoutMap] = useState<GraphLayoutMap>({})
  const [graphOrientation, setGraphOrientation] =
    useState<GraphOrientation>('horizontal')
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

  const autoLayoutMap = useMemo(() => {
    const map: GraphLayoutMap = {}
    if (!filteredServices.length) return map

    const byId = new Map(
      filteredServices.map((service) => [service.id, service])
    )

    const outgoing = new Map<string, string[]>()
    const incomingCount = new Map<string, number>()

    filteredServices.forEach((service) => {
      outgoing.set(service.id, [])
      incomingCount.set(service.id, 0)
    })

    filteredServices.forEach((service) => {
      service.dependencies.forEach((dependency) => {
        if (!byId.has(dependency.id)) return

        outgoing.get(dependency.id)?.push(service.id)
        incomingCount.set(service.id, (incomingCount.get(service.id) ?? 0) + 1)
      })
    })

    const queue = filteredServices
      .map((service) => service.id)
      .filter((id) => (incomingCount.get(id) ?? 0) === 0)

    const depth = new Map<string, number>()
    filteredServices.forEach((service) => depth.set(service.id, 0))

    while (queue.length) {
      const current = queue.shift()
      if (!current) continue

      const currentDepth = depth.get(current) ?? 0
      const nextNodes = outgoing.get(current) ?? []

      nextNodes.forEach((nextId) => {
        depth.set(nextId, Math.max(depth.get(nextId) ?? 0, currentDepth + 1))
        incomingCount.set(nextId, (incomingCount.get(nextId) ?? 1) - 1)
        if ((incomingCount.get(nextId) ?? 0) <= 0) queue.push(nextId)
      })
    }

    // Any cyclic/unresolved nodes get pushed to the rightmost layer.
    const maxDepth = Math.max(...Array.from(depth.values()))
    filteredServices.forEach((service) => {
      if ((incomingCount.get(service.id) ?? 0) > 0)
        depth.set(service.id, maxDepth + 1)
    })

    const layers = new Map<number, string[]>()
    filteredServices.forEach((service) => {
      const layer = depth.get(service.id) ?? 0
      layers.set(layer, [...(layers.get(layer) ?? []), service.id])
    })

    const layerSpacingX = 310
    const layerSpacingY = 190
    const nodeSpacingX = 250
    const nodeSpacingY = 130

    Array.from(layers.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([layer, ids]) => {
        const sortedIds = ids.sort((a, b) => a.localeCompare(b))
        const centerOffset = (sortedIds.length - 1) / 2

        sortedIds.forEach((id, index) => {
          map[id] =
            graphOrientation === 'horizontal'
              ? {
                  x: layer * layerSpacingX,
                  y: (index - centerOffset) * nodeSpacingY,
                }
              : {
                  x: (index - centerOffset) * nodeSpacingX,
                  y: layer * layerSpacingY,
                }
        })
      })

    // If a selected node exists, shift the layout so that selected stays closer to center.
    if (selectedService && map[selectedService.id]) {
      const selectedPos = map[selectedService.id]
      const shiftX = selectedPos.x
      const shiftY = selectedPos.y

      Object.keys(map).forEach((id) => {
        map[id] = { x: map[id].x - shiftX, y: map[id].y - shiftY }
      })
    }

    return map
  }, [filteredServices, graphOrientation, selectedService])

  const graph = useMemo(() => {
    const nodes: Node[] = filteredServices.map((service) => {
      const selected = selectedService?.id === service.id
      const category = getCategory(service)

      return {
        id: service.id,
        position: layoutMap[service.id] ??
          autoLayoutMap[service.id] ?? { x: 0, y: 0 },
        sourcePosition:
          graphOrientation === 'horizontal' ? Position.Right : Position.Bottom,
        targetPosition:
          graphOrientation === 'horizontal' ? Position.Left : Position.Top,
        data: {
          label: buildServiceNodeLabel({
            name: service.name,
            id: service.id,
            serviceType: service.metadata.serviceType,
            imageUrl: getServiceNodeImage(service, isDark),
            isDark,
          }),
        },
        style: buildServiceNodeStyle({ selected, isDark }),
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

          return buildDependencyEdge({
            id: `${dependency.id}->${service.id}`,
            source: dependency.id,
            target: service.id,
            selected: selectedEdge,
            isDark,
          })
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

          return buildApiUsageEdge({
            id: `${dependency.id}->${service.id}:api`,
            source: dependency.id,
            target: service.id,
            isDark,
            animated: selectedEdge,
          })
        })
    )

    return { nodes, edges: [...structuralEdges, ...inferredApiEdges] }
  }, [
    autoLayoutMap,
    byId,
    filteredServices,
    graphOrientation,
    isDark,
    layoutMap,
    selectedService?.id,
  ])

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges)

  useEffect(() => {
    setNodes(graph.nodes)
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

  const isLayoutDirty = useMemo(() => {
    const current = JSON.stringify(layoutMap)
    const saved = JSON.stringify(savedLayoutMap)
    return current !== saved
  }, [layoutMap, savedLayoutMap])

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
        Object.entries(layoutMap).map(([serviceId, position]) =>
          persistNodeLayoutToMeta(serviceId, position.x, position.y)
        )
      )
      toast.success('Graph layout saved to service meta.')
    } catch {
      toast.error('Could not save graph layout to service meta.')
    }
  }

  const discardLayoutChanges = () => {
    setLayoutMap(savedLayoutMap)
    toast.message('Discarded unsaved graph layout changes.')
  }

  return (
    <>
      <Header fixed>
        <GlobalSearch />
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
              <CardContent>
                <div className='flex flex-wrap items-end gap-3'>
                  <div className='min-w-[280px] flex-1'>
                    <label className='mb-1 block text-xs text-muted-foreground'>
                      Search
                    </label>
                    <div className='relative'>
                      <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder='Search services in dependencies...'
                        className='pl-9'
                      />
                    </div>
                  </div>

                  <div className='min-w-[150px]'>
                    <label className='mb-1 block text-xs text-muted-foreground'>
                      Status
                    </label>
                    <select
                      className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(
                          event.target.value as
                            | 'all'
                            | DashboardService['status']
                        )
                      }
                    >
                      <option value='all'>all</option>
                      <option value='running'>running</option>
                      <option value='degraded'>degraded</option>
                      <option value='stopped'>stopped</option>
                    </select>
                  </div>

                  <div className='min-w-[170px]'>
                    <label className='mb-1 block text-xs text-muted-foreground'>
                      Category
                    </label>
                    <select
                      className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                      value={categoryFilter}
                      onChange={(event) =>
                        setCategoryFilter(
                          event.target.value as GraphCategory | 'all'
                        )
                      }
                    >
                      <option value='all'>all</option>
                      {availableCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className='min-w-[170px]'>
                    <label className='mb-1 block text-xs text-muted-foreground'>
                      Utility nodes
                    </label>
                    <select
                      className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                      value={hideUtility ? 'hidden' : 'shown'}
                      onChange={(event) =>
                        setHideUtility(event.target.value === 'hidden')
                      }
                    >
                      <option value='shown'>shown</option>
                      <option value='hidden'>hidden</option>
                    </select>
                  </div>

                  <div className='min-w-[140px]'>
                    <label className='mb-1 block text-xs text-muted-foreground'>
                      Layout
                    </label>
                    <Button
                      type='button'
                      variant='outline'
                      className='h-9 w-full'
                      onClick={resetGraphLayout}
                    >
                      Reset graph
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className='grid gap-4 lg:grid-cols-3'>
              <div className='lg:col-span-2'>
                <DependencyGraphPanel
                  title='Dependency graph'
                  description='Relationship map of the currently visible services.'
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
                        <span className='sr-only'>
                          Switch graph to {graphOrientation === 'horizontal' ? 'vertical' : 'horizontal'} layout
                        </span>
                      </Button>
                      <Separator orientation='vertical' className='h-6' />
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
                        <span className='sr-only'>Discard layout changes</span>
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
                        <span className='sr-only'>Save layout changes</span>
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
                      onNodeClick={selectService}
                      legendItems={[
                        {
                          label: 'Structural dependency',
                          color: '#cbd5e1',
                        },
                        {
                          label: 'Selected-path dependency',
                          color: '#22c55e',
                        },
                        {
                          label: 'Inferred API usage',
                          color: '#38bdf8',
                          dashed: true,
                        },
                      ]}
                      miniMapNodeColor={(node) => {
                        const service = byId.get(node.id)
                        return service
                          ? categoryNodeColor(getCategory(service))
                          : '#6b7280'
                      }}
                    />
                  }
                />
              </div>

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
