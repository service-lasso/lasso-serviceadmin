import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Cable,
  Globe,
  Server,
} from 'lucide-react'
import {
  useRunRuntimeAction,
  useRuntimeSummary,
  useServices,
} from '@/lib/service-lasso-api/hooks'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatusBadge } from '@/features/service-lasso/status-badge'

export function Dashboard() {
  const { data: runtime } = useRuntimeSummary()
  const { data: services } = useServices()
  const runtimeAction = useRunRuntimeAction()

  if (!runtime || !services) {
    return null
  }

  const problemServices = services.filter((service) =>
    ['degraded', 'error', 'starting'].includes(service.status)
  )

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-3xl font-semibold tracking-tight'>
            Service Lasso operator dashboard
          </h1>
          <p className='text-muted-foreground'>
            First-pass admin UI shell grounded in the ref docs and wired to
            harness-backed API stubs.
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            onClick={() => runtimeAction.mutate('reload')}
          >
            Reload runtime
          </Button>
          <Button onClick={() => runtimeAction.mutate('start')}>
            Stub start-all
          </Button>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Runtime</CardDescription>
            <CardTitle className='flex items-center gap-2 text-2xl'>
              <Server className='size-5' />
              {runtime.version}
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            <StatusBadge
              status={
                runtime.status === 'healthy'
                  ? 'running'
                  : runtime.status === 'degraded'
                    ? 'degraded'
                    : 'error'
              }
            />
            <p className='text-sm text-muted-foreground'>
              Host {runtime.host}, profile {runtime.profile}, uptime{' '}
              {runtime.uptime}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Services</CardDescription>
            <CardTitle className='text-2xl'>
              {runtime.serviceCounts.total}
            </CardTitle>
          </CardHeader>
          <CardContent className='text-sm text-muted-foreground'>
            {runtime.serviceCounts.running} running,{' '}
            {runtime.serviceCounts.stopped} stopped,{' '}
            {runtime.serviceCounts.degraded} degraded.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Dependency graph</CardDescription>
            <CardTitle className='flex items-center gap-2 text-2xl'>
              <Cable className='size-5' />4 edges
            </CardTitle>
          </CardHeader>
          <CardContent className='text-sm text-muted-foreground'>
            Current stub captures runtime, UI, router, cert helper, and
            observability relationships.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Network exposure</CardDescription>
            <CardTitle className='flex items-center gap-2 text-2xl'>
              <Globe className='size-5' />4 URLs
            </CardTitle>
          </CardHeader>
          <CardContent className='text-sm text-muted-foreground'>
            Surfacing local URLs and routed hostnames is a first-class operator
            concern.
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 xl:grid-cols-[1.6fr_1fr]'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Boxes className='size-5' />
              Problem and transition services
            </CardTitle>
            <CardDescription>
              Focus list for the first dashboard slice, grounded in the UI
              OpenSpec draft.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {problemServices.map((service) => (
              <div
                key={service.id}
                className='flex items-center justify-between rounded-lg border p-3'
              >
                <div>
                  <div className='font-medium'>{service.name}</div>
                  <div className='text-sm text-muted-foreground'>
                    {service.note ??
                      'Needs operator attention or is still transitioning.'}
                  </div>
                </div>
                <div className='flex items-center gap-3'>
                  <StatusBadge status={service.status} />
                  <Button asChild variant='ghost' size='sm'>
                    <Link
                      to='/services/$serviceId'
                      params={{ serviceId: service.id }}
                    >
                      Open
                      <ArrowRight className='ml-2 size-4' />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <AlertTriangle className='size-5' />
              Current warnings
            </CardTitle>
            <CardDescription>
              These come straight from the runtime summary contract stub.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {runtime.warnings.map((warning) => (
              <div
                key={warning}
                className='rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm'
              >
                {warning}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
