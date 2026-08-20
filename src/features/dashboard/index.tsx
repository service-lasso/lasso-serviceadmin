import { Link } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  Boxes,
  FileText,
  Globe,
  Inbox,
  Play,
  RefreshCcw,
  Route,
  ShieldAlert,
  ShieldCheck,
  Waypoints,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  useBrokerTelemetry,
  useDashboardAction,
  useDashboardSummary,
  useFleetMetrics,
  useInboxCounts,
  useNetworkHome,
  useRuntimeInstanceHome,
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
import { HeaderActions } from '@/components/page-toolbar'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { FavoriteToggle } from '@/features/services/components/favorite-toggle'
import {
  brokerReadyLabel,
  deriveBrokerReadyState,
  findSecretsBrokerService,
  formatBrokerLockoutCount,
} from './broker-home-posture'
import {
  deriveFleetMix,
  deriveGenerationLane,
  deriveLogVolume,
  deriveProblemRows,
  deriveTraefikStrip,
  formatFleetMixDescription,
  formatGenerationId,
  formatInboxUnread,
  formatListenPortSummary,
  formatOperatorInstant,
  primaryListenPort,
  uniqueListenPorts,
} from './dashboard-home-metrics'

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
  valueAriaLabel,
}: {
  title: string
  value: string
  description: string
  icon: React.ElementType
  action?: React.ReactNode
  valueAriaLabel?: string
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='h-4 w-4 text-muted-foreground' />
      </CardHeader>
      <CardContent className='space-y-3'>
        <div>
          <div className='text-2xl font-bold' aria-label={valueAriaLabel}>
            {value}
          </div>
          <p className='text-xs text-muted-foreground'>{description}</p>
        </div>
        {action ? <div>{action}</div> : null}
      </CardContent>
    </Card>
  )
}

function ServiceCard({ service }: { service: DashboardService }) {
  const openDetail = () => {
    window.location.href = `/services/${service.id}`
  }
  const lastStart = formatOperatorInstant(service.runtimeHealth.lastRestartAt)
  const listen = primaryListenPort(service)

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
            <p className='mt-1 text-xs text-muted-foreground'>
              {[
                lastStart ? `Last start ${lastStart}` : null,
                listen ? `:${listen.port}` : null,
              ]
                .filter((entry): entry is string => entry !== null)
                .join(' · ') || 'No last start or listen port'}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <FavoriteToggle service={service} />
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
        <HeaderActions>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </HeaderActions>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 9 }).map((_, index) => (
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

function DashboardUnavailable({ error }: { error: unknown }) {
  const message =
    error instanceof Error
      ? error.message
      : 'Service Lasso runtime API is unavailable.'

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

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <Card className='border-amber-500/40'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <AlertTriangle className='h-4 w-4' />
              Runtime API unavailable
            </CardTitle>
            <CardDescription>
              No sample service data is loaded by default. Connect Service Admin
              to Service Lasso or explicitly enable the dev fixture mode.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='rounded-md border bg-muted/40 p-3 font-mono text-xs'>
              {message}
            </div>
            <p className='text-muted-foreground'>
              Set VITE_SERVICE_LASSO_API_BASE_URL for a separate runtime, or set
              VITE_SERVICE_LASSO_ENABLE_STUB_DATA=true only for local UI fixture
              development.
            </p>
          </CardContent>
        </Card>
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
  const brokerTelemetry = useBrokerTelemetry()
  const inboxCounts = useInboxCounts()
  const fleetMetrics = useFleetMetrics()
  const instanceHome = useRuntimeInstanceHome()
  const networkHome = useNetworkHome()
  const actionMutation = useDashboardAction()

  if (summaryQuery.isLoading) {
    return <DashboardLoading />
  }

  if (summaryQuery.isError || !summaryQuery.data) {
    return <DashboardUnavailable error={summaryQuery.error} />
  }

  const summary = summaryQuery.data
  const metrics = fleetMetrics.data ?? null
  const mix = deriveFleetMix(summary, metrics)
  const listenPorts = uniqueListenPorts([
    ...summary.favorites,
    ...summary.others,
    ...summary.problemServices,
  ])
  const problems = deriveProblemRows(summary, metrics)
  const generation = deriveGenerationLane(instanceHome.data ?? null)
  const traefik = deriveTraefikStrip(summary, networkHome.data ?? null)
  const logs = deriveLogVolume(metrics)
  const inboxUnread =
    inboxCounts.isError || inboxCounts.isLoading
      ? null
      : (inboxCounts.data?.unread ?? null)
  const brokerService = findSecretsBrokerService(summary)
  const brokerReadyState = deriveBrokerReadyState(brokerService)
  const brokerReadyDisplay = brokerReadyLabel(brokerReadyState)
  const brokerLockoutDisplay = formatBrokerLockoutCount(
    brokerTelemetry.isError || brokerTelemetry.isLoading
      ? null
      : (brokerTelemetry.data?.counters.activeLockouts ?? null)
  )
  const isReloadingRuntime =
    actionMutation.isPending && actionMutation.variables === 'reload-runtime'
  const isStartingServices =
    actionMutation.isPending && actionMutation.variables === 'start-services'
  const openSecretsAction = (
    <Button
      asChild
      size='sm'
      variant='outline'
      className='w-full justify-start'
    >
      <Link to='/secrets-broker/secrets'>Open Secrets</Link>
    </Button>
  )

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

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
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
                <RefreshCcw
                  className={`mr-2 h-4 w-4 ${isReloadingRuntime ? 'animate-spin' : ''}`}
                />
                {isReloadingRuntime ? 'Reloading runtime...' : 'Reload runtime'}
              </Button>
            }
          />
          <SummaryCard
            title='Services'
            value={`${mix.running}/${mix.total}`}
            description={formatFleetMixDescription(mix)}
            icon={Boxes}
            action={
              <Button
                size='sm'
                onClick={() => actionMutation.mutate('start-services')}
                disabled={actionMutation.isPending}
                className='w-full justify-start'
              >
                <Play className='mr-2 h-4 w-4' />
                {isStartingServices ? 'Starting services...' : 'Start services'}
              </Button>
            }
          />
          <SummaryCard
            title='Listen ports'
            value={String(listenPorts.length)}
            valueAriaLabel={`Listen ports ${listenPorts.length}`}
            description={formatListenPortSummary(listenPorts)}
            icon={Globe}
            action={
              <Button
                asChild
                size='sm'
                variant='outline'
                className='w-full justify-start'
              >
                <Link to='/network'>Open Network</Link>
              </Button>
            }
          />
          <SummaryCard
            title='Inbox unread'
            value={formatInboxUnread(inboxUnread)}
            valueAriaLabel={`Inbox unread ${formatInboxUnread(inboxUnread)}`}
            description='Durable operator attention queue'
            icon={Inbox}
            action={
              <Button
                asChild
                size='sm'
                variant='outline'
                className='w-full justify-start'
              >
                <Link to='/inbox'>Open Inbox</Link>
              </Button>
            }
          />
          <SummaryCard
            title='Broker ready'
            value={brokerReadyDisplay}
            valueAriaLabel={`Broker ready ${brokerReadyDisplay}`}
            description={
              brokerService
                ? `${brokerService.name} process is ${brokerService.status}`
                : '@secretsbroker is not on this runtime'
            }
            icon={ShieldCheck}
            action={openSecretsAction}
          />
          <SummaryCard
            title='Broker lockouts'
            value={brokerLockoutDisplay}
            valueAriaLabel={`Broker lockout count ${brokerLockoutDisplay}`}
            description='Active lockout count from Broker telemetry'
            icon={ShieldAlert}
            action={openSecretsAction}
          />
          <SummaryCard
            title='Generation lane'
            value={generation.available ? generation.phase : '—'}
            valueAriaLabel={`Generation lane ${generation.available ? generation.phase : 'unavailable'}`}
            description={
              generation.available
                ? `${formatGenerationId(generation.activeGenerationId)} · ${generation.classification} · ${generation.staleCount} stale`
                : 'Runtime instance snapshot unavailable'
            }
            icon={Waypoints}
          />
          <SummaryCard
            title='Traefik'
            value={
              traefik.available
                ? traefik.status === 'running'
                  ? 'Up'
                  : traefik.status
                : '—'
            }
            valueAriaLabel={`Traefik ${traefik.available ? traefik.status : 'missing'}`}
            description={
              traefik.available
                ? `${traefik.entrypoints.join(', ') || 'no entrypoints'} · ${traefik.liveBackendCount} live · ${traefik.reservedEmptyCount} reserved empty`
                : '@traefik is not on this runtime'
            }
            icon={Route}
          />
          <SummaryCard
            title='Log volume'
            value={logs.available ? String(logs.stderrLines) : '—'}
            valueAriaLabel={`Log stderr lines ${logs.available ? logs.stderrLines : 'unavailable'}`}
            description={
              logs.available
                ? `${logs.stdoutLines} stdout · ${logs.stderrLines} stderr · ${logs.servicesWithStderr} with stderr (not always an app error)`
                : 'Metrics snapshot unavailable'
            }
            icon={FileText}
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
              {summary.favorites.length === 0 ? (
                <p className='text-sm text-muted-foreground sm:col-span-2 xl:col-span-3'>
                  Star a service here, in the services list, or on service
                  details to pin it for quick access.
                </p>
              ) : (
                summary.favorites.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))
              )}
            </CardContent>
          </Card>
          <Card className='col-span-1 lg:col-span-3'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <AlertTriangle className='h-4 w-4' />
                Warnings and problem services
              </CardTitle>
              <CardDescription>
                Named failures with last start and install state.
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
                {problems.map((service) => (
                  <div key={service.id} className='rounded-lg border p-3'>
                    <div className='flex items-center gap-2'>
                      <div className='font-medium'>{service.name}</div>
                      {service.crashed ? (
                        <Badge variant='destructive'>Crashed</Badge>
                      ) : (
                        <StatusBadge status={service.status} />
                      )}
                    </div>
                    {service.note ? (
                      <p className='mt-1 text-sm text-muted-foreground'>
                        {service.note}
                      </p>
                    ) : null}
                    <p className='mt-1 text-xs text-muted-foreground'>
                      {[
                        service.lastStart
                          ? `Last start ${service.lastStart}`
                          : 'Never started',
                        service.installed ? null : 'Not installed',
                      ]
                        .filter((entry): entry is string => entry !== null)
                        .join(' · ')}
                    </p>
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
