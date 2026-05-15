import {
  Activity,
  AlertTriangle,
  Boxes,
  Globe,
  PackageOpen,
  Play,
  RefreshCcw,
  Star,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  useDashboardAction,
  useDashboardSummary,
  useFavoriteFeatureState,
  useToggleFavorite,
} from '@/lib/service-lasso-dashboard/hooks'
import type {
  DashboardService,
  ServiceStatus,
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

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  action,
}: {
  title: string
  value: string
  description: string
  icon: React.ElementType
  action?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent className='space-y-3'>
        <div>
          <div className='text-2xl font-bold'>{value}</div>
          <p className='text-xs text-muted-foreground'>{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </CardContent>
    </Card>
  )
}

function ServiceCard({ service }: { service: DashboardService }) {
  const toggleFavorite = useToggleFavorite()
  const favoriteFeature = useFavoriteFeatureState()

  const openDetail = () => {
    window.location.href = `/services/${service.id}`
  }

  return (
    <div
      role='link'
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openDetail()
        }
      }}
      className='cursor-pointer rounded-lg border p-3 transition-colors hover:bg-accent/40'
    >
      <div className='space-y-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='truncate text-sm font-medium'>{service.name}</div>
          </div>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              aria-label={service.favorite ? 'Remove favorite' : 'Add favorite'}
              title={
                favoriteFeature.enabled
                  ? service.favorite
                    ? 'Remove favorite'
                    : 'Add favorite'
                  : 'Favorites editing is disabled until Service Lasso API endpoint and favorites flag are enabled'
              }
              disabled={!favoriteFeature.enabled}
              className='inline-flex items-center rounded-md border p-1.5 hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50'
              onClick={(event) => {
                event.stopPropagation()
                if (!favoriteFeature.enabled) return
                void toggleFavorite.mutateAsync(service.id)
              }}
            >
              <Star
                className={`size-4 ${service.favorite ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`}
              />
            </button>
            <StatusBadge status={service.status} />
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          {service.links.slice(0, 2).map((link) => (
            <Button
              key={`${service.id}-${link.label}`}
              asChild
              size='sm'
              variant='outline'
              className='h-8 w-fit px-3 text-xs sm:h-6 sm:px-2'
            >
              <a
                href={link.url}
                target='_blank'
                rel='noreferrer'
                onClick={(event) => event.stopPropagation()}
              >
                {link.label}
              </a>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

function DashboardLoading() {
  return (
    <>
      <Header>
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
            <h2 className='text-2xl font-bold tracking-tight'>Dashboard</h2>
            <p className='text-muted-foreground'>
              Monitor runtime health, launch service actions, and jump to the
              services you use most.
            </p>
          </div>
        </div>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className='h-4 w-24' />
              </CardHeader>
              <CardContent>
                <Skeleton className='h-8 w-16' />
                <Skeleton className='mt-2 h-3 w-28' />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
          <Card className='col-span-1 lg:col-span-4'>
            <CardHeader>
              <CardTitle>Favorite services quick access</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className='h-24 w-full' />
              ))}
            </CardContent>
          </Card>
          <Card className='col-span-1 lg:col-span-3'>
            <CardHeader>
              <CardTitle>Warnings and problem services</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className='h-16 w-full' />
              ))}
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}

export function Dashboard() {
  usePageMetadata({
    title: 'Service Admin - Dashboard',
    description:
      'Service Admin dashboard for Service Lasso operator status and quick actions.',
  })

  const summaryQuery = useDashboardSummary()
  const actionMutation = useDashboardAction()

  if (summaryQuery.isLoading || !summaryQuery.data) {
    return <DashboardLoading />
  }

  const summary = summaryQuery.data

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Dashboard</h2>
            <p className='text-muted-foreground'>
              Monitor runtime health, launch service actions, and jump to the
              services you use most.
            </p>
          </div>
        </div>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <SummaryCard
            title='Runtime health'
            value={summary.runtime.status === 'healthy' ? 'Healthy' : 'Warning'}
            description={`${summary.runtime.warningCount} warning(s)`}
            icon={Activity}
            action={
              <Button
                size='sm'
                variant='outline'
                onClick={() => actionMutation.mutate('reload-runtime')}
                disabled={actionMutation.isPending}
                className='w-full justify-start'
              >
                <RefreshCcw className='mr-2 h-4 w-4' />
                Reload runtime
              </Button>
            }
          />
          <SummaryCard
            title='Services'
            value={`${summary.servicesRunning}/${summary.servicesTotal}`}
            description={`${summary.servicesAvailable ?? 0} available, ${summary.servicesStopped} stopped, ${summary.servicesDegraded} degraded`}
            icon={Boxes}
            action={
              <Button
                size='sm'
                onClick={() => actionMutation.mutate('start-services')}
                disabled={actionMutation.isPending}
                className='w-full justify-start'
              >
                <Play className='mr-2 h-4 w-4' />
                Start services
              </Button>
            }
          />
          <SummaryCard
            title='Network exposure'
            value={String(summary.networkExposureCount)}
            description='Reachable links across managed services'
            icon={Globe}
          />
          <SummaryCard
            title='Installed'
            value={String(summary.installedCount)}
            description='Installed services tracked by the stub'
            icon={PackageOpen}
          />
        </div>
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
          <Card className='col-span-1 lg:col-span-4'>
            <CardHeader>
              <CardTitle>Favorite services quick access</CardTitle>
              <CardDescription>
                Quick links for the services you want at the top.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
              {summary.favorites.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </CardContent>
          </Card>
          <Card className='col-span-1 lg:col-span-3'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <AlertTriangle className='h-4 w-4' />
                Warnings and problem services
              </CardTitle>
              <CardDescription>
                Current runtime warnings surfaced from the dashboard stub.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='max-h-96 space-y-3 overflow-y-auto pr-1'>
                {summary.warnings.map((warning) => (
                  <div
                    key={warning}
                    className='rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm'
                  >
                    {warning}
                  </div>
                ))}
                {summary.problemServices.map((service) => (
                  <div key={service.id} className='rounded-lg border p-3'>
                    <div className='flex items-center gap-2'>
                      <div className='font-medium'>{service.name}</div>
                      <StatusBadge status={service.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>All other services</CardTitle>
            <CardDescription>
              Non-favorited services stay visible here without crowding the
              quick-access block.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {summary.others.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

