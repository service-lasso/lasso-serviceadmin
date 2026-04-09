import { useServiceDetail } from '@/lib/service-lasso-api/hooks'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ServiceActionButtons } from '@/features/service-lasso/action-buttons'
import { StatusBadge } from '@/features/service-lasso/status-badge'

export function ServiceDetailPage({ serviceId }: { serviceId: string }) {
  const { data: service } = useServiceDetail(serviceId)

  if (!service) {
    return null
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
        <div>
          <h1 className='text-3xl font-semibold tracking-tight'>
            {service.name}
          </h1>
          <p className='text-muted-foreground'>{service.description}</p>
        </div>
        <div className='flex items-center gap-3'>
          <StatusBadge status={service.status} />
        </div>
      </div>

      <div className='grid gap-4 lg:grid-cols-3'>
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle>Operator controls</CardTitle>
            <CardDescription>
              Action surface is stubbed now, but aligned with the planned
              Service Lasso action contract.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <ServiceActionButtons
              serviceId={service.id}
              actions={service.actions}
            />
            <div className='grid gap-4 md:grid-cols-2'>
              <InfoBlock
                label='Selected version'
                value={service.selectedVersion}
              />
              <InfoBlock
                label='Installed version'
                value={service.installedVersion}
              />
              <InfoBlock label='Config path' value={service.configPath} />
              <InfoBlock label='State path' value={service.statePath} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reachability</CardTitle>
            <CardDescription>
              Ports and browser-facing URLs stay visible on the service page.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <InfoBlock
              label='Ports'
              value={service.ports.length ? service.ports.join(', ') : '—'}
            />
            <InfoBlock
              label='URLs'
              value={service.urls.length ? service.urls.join('\n') : '—'}
            />
            <InfoBlock label='Acquisition' value={service.acquisition} />
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Dependencies</CardTitle>
            <CardDescription>
              Keep the per-service dependency subgraph visible from day one.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
            <InfoBlock
              label='Depends on'
              value={service.dependencies.join(', ') || 'None'}
            />
            <InfoBlock
              label='Dependents'
              value={service.dependents.join(', ') || 'None'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent logs</CardTitle>
            <CardDescription>
              Stubbed log tail for the first page-contract slice.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            {service.logs.map((entry) => (
              <div
                key={`${entry.timestamp}-${entry.message}`}
                className='rounded-lg border p-3 text-sm'
              >
                <div className='font-medium'>
                  {entry.timestamp} · {entry.level}
                </div>
                <div className='text-muted-foreground'>{entry.message}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border p-3'>
      <div className='text-xs tracking-wide text-muted-foreground uppercase'>
        {label}
      </div>
      <div className='mt-1 text-sm whitespace-pre-wrap'>{value}</div>
    </div>
  )
}
