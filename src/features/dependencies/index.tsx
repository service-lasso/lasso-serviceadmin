import { Link, getRouteApi } from '@tanstack/react-router'
import { GitBranch, Link2, Network, ScanSearch } from 'lucide-react'
import { useServices } from '@/lib/service-lasso-dashboard/hooks'
import type {
  DashboardService,
  ServiceDependency,
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

const route = getRouteApi('/_authenticated/dependencies/')

function statusTone(status: DashboardService['status']) {
  if (status === 'running') return 'bg-emerald-600 hover:bg-emerald-600'
  if (status === 'degraded') return undefined
  return undefined
}

function selectedServiceFromSearch(
  services: DashboardService[],
  selectedId?: string
) {
  return (
    services.find((service) => service.id === selectedId) ?? services[0] ?? null
  )
}

function GraphNode({
  service,
  selected,
  onSelect,
}: {
  service: DashboardService
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type='button'
      onClick={() => onSelect(service.id)}
      className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent/40 ${selected ? 'border-primary bg-accent/30' : ''}`}
    >
      <div className='flex items-center justify-between gap-3'>
        <div>
          <div className='font-medium'>{service.name}</div>
          <div className='text-xs text-muted-foreground'>{service.id}</div>
        </div>
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
      </div>
      <div className='mt-2 text-xs text-muted-foreground'>
        {service.dependencies.length} dependency / {service.dependents.length}{' '}
        dependent
      </div>
    </button>
  )
}

function RelationshipItem({ item }: { item: ServiceDependency }) {
  return (
    <div className='rounded-lg border p-3'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <div className='font-medium'>{item.name}</div>
          <div className='text-xs text-muted-foreground'>{item.id}</div>
        </div>
        <Badge
          variant={
            item.status === 'degraded'
              ? 'secondary'
              : item.status === 'stopped'
                ? 'outline'
                : undefined
          }
          className={
            item.status === 'running'
              ? 'bg-emerald-600 hover:bg-emerald-600'
              : ''
          }
        >
          {item.status}
        </Badge>
      </div>
      {item.note ? (
        <p className='mt-2 text-sm text-muted-foreground'>{item.note}</p>
      ) : null}
    </div>
  )
}

function GraphLoading() {
  return (
    <div className='space-y-4'>
      <div className='grid gap-4 md:grid-cols-3'>
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
        <Skeleton className='h-28 w-full' />
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        <Skeleton className='h-96 w-full lg:col-span-2' />
        <Skeleton className='h-96 w-full' />
      </div>
    </div>
  )
}

export function Dependencies() {
  const searchState = route.useSearch()
  const navigate = route.useNavigate()
  const servicesQuery = useServices()

  if (servicesQuery.isLoading) {
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
          <GraphLoading />
        </Main>
      </>
    )
  }

  const services = servicesQuery.data ?? []
  const selectedService = selectedServiceFromSearch(
    services,
    searchState.service
  )
  const dependencyEdges = services.reduce(
    (count, service) => count + service.dependencies.length,
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
            <h2 className='text-2xl font-bold tracking-tight'>Dependencies</h2>
            <p className='text-muted-foreground'>
              Review the current service relationship graph, inspect a selected
              service, and follow dependency/dependent chains without leaving
              the operator flow.
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

        <div className='grid gap-4 md:grid-cols-3'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                <Network className='size-4' /> Services in graph
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{services.length}</div>
              <p className='text-xs text-muted-foreground'>
                Services currently participating in the relationship model.
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
              <div className='text-2xl font-bold'>{dependencyEdges}</div>
              <p className='text-xs text-muted-foreground'>
                Total dependency links currently declared in the stub graph.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                <ScanSearch className='size-4' /> Selected focus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>
                {selectedService ? selectedService.name : 'None'}
              </div>
              <p className='text-xs text-muted-foreground'>
                Click a service node to review its immediate graph slice.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className='grid gap-4 lg:grid-cols-3'>
          <Card className='lg:col-span-2'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Link2 className='size-4' /> Service relationship graph
              </CardTitle>
              <CardDescription>
                First deterministic graph slice using the current stub topology.
                The selected node drives the right-hand relationship detail.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
              {services.map((service) => (
                <GraphNode
                  key={service.id}
                  service={service}
                  selected={selectedService?.id === service.id}
                  onSelect={selectService}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selected service graph slice</CardTitle>
              <CardDescription>
                Direct dependencies and dependents for the chosen service.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-5'>
              {selectedService ? (
                <>
                  <div className='rounded-lg border p-3'>
                    <div className='font-medium'>{selectedService.name}</div>
                    <div className='text-xs text-muted-foreground'>
                      {selectedService.id} · {selectedService.role}
                    </div>
                    <div className='mt-3'>
                      <Button variant='outline' size='sm' asChild>
                        <Link
                          to='/services/$serviceId'
                          params={{ serviceId: selectedService.id }}
                        >
                          Open service details
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className='space-y-3'>
                    <div className='text-sm font-medium'>Depends on</div>
                    {selectedService.dependencies.length ? (
                      selectedService.dependencies.map((item) => (
                        <RelationshipItem
                          key={`depends_on-${item.id}`}
                          item={item}
                        />
                      ))
                    ) : (
                      <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
                        No direct dependencies recorded for this service.
                      </div>
                    )}
                  </div>

                  <div className='space-y-3'>
                    <div className='text-sm font-medium'>Dependents</div>
                    {selectedService.dependents.length ? (
                      selectedService.dependents.map((item) => (
                        <RelationshipItem
                          key={`dependent-${item.id}`}
                          item={item}
                        />
                      ))
                    ) : (
                      <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
                        No dependents recorded for this service.
                      </div>
                    )}
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
      </Main>
    </>
  )
}
