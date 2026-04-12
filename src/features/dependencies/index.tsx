import { useMemo, useState } from 'react'
import { Link, getRouteApi } from '@tanstack/react-router'
import {
  ArrowRight,
  GitBranch,
  Link2,
  Network,
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

function ServiceBadgeRow({ service }: { service: DashboardService }) {
  return (
    <div className='mt-3 flex flex-wrap gap-2'>
      <Badge
        className={statusTone(service.status)}
        variant={
          service.status === 'degraded'
            ? 'secondary'
            : service.status === 'stopped'
              ? 'outline'
              : undefined
        }
      >
        {service.status}
      </Badge>
      <span
        className={`rounded-md border px-2 py-0.5 text-xs ${categoryTone(getCategory(service))}`}
      >
        {getCategory(service)}
      </span>
      <span className='rounded-md border px-2 py-0.5 text-xs text-muted-foreground'>
        {service.metadata.runtime}
      </span>
    </div>
  )
}

function RelationshipList({
  title,
  items,
  onSelect,
}: {
  title: string
  items: DashboardService[]
  onSelect: (serviceId: string) => void
}) {
  return (
    <div className='space-y-3'>
      <div className='text-sm font-medium'>{title}</div>
      {items.length ? (
        items.map((item) => (
          <button
            key={item.id}
            type='button'
            onClick={() => onSelect(item.id)}
            className='w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent'
          >
            <div className='flex items-start justify-between gap-3'>
              <div>
                <div className='font-medium'>{item.name}</div>
                <div className='text-xs text-muted-foreground'>
                  {item.id} · {item.role}
                </div>
              </div>
              <Badge
                className={statusTone(item.status)}
                variant={
                  item.status === 'degraded'
                    ? 'secondary'
                    : item.status === 'stopped'
                      ? 'outline'
                      : undefined
                }
              >
                {item.status}
              </Badge>
            </div>
            <p className='mt-2 text-sm text-muted-foreground'>{item.note}</p>
          </button>
        ))
      ) : (
        <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
          None recorded in the current stub.
        </div>
      )}
    </div>
  )
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
    description:
      'Service Admin dependency relationships for Service Lasso services.',
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

      if (statusFilter !== 'all' && service.status !== statusFilter) {
        return false
      }

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

  const selectService = (serviceId: string) => {
    navigate({
      search: (prev) => ({
        ...(prev as Record<string, unknown>),
        service: serviceId,
      }),
    })
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
              Stable dependency surface for selecting a service, reviewing what
              it depends on, and seeing what depends on it.
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
                    <Network className='size-4' /> Services in view
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>
                    {filteredServices.length}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Visible services after current filters.
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
                    Structural dependency links declared in the stub data.
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
                    Inferred where an exposing dependency is likely used.
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
                    Pick a service from the list below to inspect its dependency
                    slice.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className='grid gap-4 lg:grid-cols-3'>
              <Card className='lg:col-span-2'>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <GitBranch className='size-4' /> Service dependency map
                  </CardTitle>
                  <CardDescription>
                    Select a service and review its local dependency and
                    dependent relationships without the unstable graph runtime.
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
                          variant={
                            statusFilter === value ? 'default' : 'outline'
                          }
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

                  <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                    {filteredServices.length ? (
                      filteredServices.map((service) => (
                        <div
                          key={service.id}
                          role='button'
                          tabIndex={0}
                          onClick={() => selectService(service.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              selectService(service.id)
                            }
                          }}
                          className={`rounded-xl border p-4 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring ${
                            selectedService?.id === service.id
                              ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                              : ''
                          }`}
                        >
                          <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0'>
                              <div className='truncate font-semibold'>
                                {service.name}
                              </div>
                              <div className='truncate text-xs text-muted-foreground'>
                                {service.id} · {service.role}
                              </div>
                            </div>
                            <button
                              type='button'
                              aria-label={
                                service.favorite
                                  ? `Remove ${service.name} from favorites`
                                  : `Add ${service.name} to favorites`
                              }
                              title={
                                favoriteFeature.enabled
                                  ? service.favorite
                                    ? `Remove ${service.name} from favorites`
                                    : `Add ${service.name} to favorites`
                                  : 'Favorites editing is disabled until Service Lasso API endpoint and favorites flag are enabled'
                              }
                              disabled={!favoriteFeature.enabled}
                              className='rounded-sm text-muted-foreground transition-colors hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-50'
                              onClick={(event) => {
                                event.stopPropagation()
                                if (!favoriteFeature.enabled) return
                                void toggleFavorite.mutateAsync(service.id)
                              }}
                            >
                              <Star
                                className={`size-4 ${service.favorite ? 'fill-amber-400 text-amber-400' : ''}`}
                              />
                            </button>
                          </div>

                          <ServiceBadgeRow service={service} />

                          <div className='mt-3 flex items-center gap-2 text-sm text-muted-foreground'>
                            <span>
                              {service.dependencies.length} dependency
                            </span>
                            <ArrowRight className='size-4' />
                            <span>{service.dependents.length} dependent</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className='col-span-full rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
                        No services match the current dependency filters.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Selected service details</CardTitle>
                  <CardDescription>
                    Relationship context and next jumps for the focused service.
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
                                  : `Add ${selectedService.name} from favorites`
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

                        <ServiceBadgeRow service={selectedService} />
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
                          <span>{selectedDependencies.length} dependency</span>
                          <ArrowRight className='size-4' />
                          <span>{selectedDependents.length} dependent</span>
                        </div>
                      </div>

                      <RelationshipList
                        title='Depends on'
                        items={selectedDependencies}
                        onSelect={selectService}
                      />

                      <RelationshipList
                        title='Dependents'
                        items={selectedDependents}
                        onSelect={selectService}
                      />

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
