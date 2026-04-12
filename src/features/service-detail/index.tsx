import { Link } from '@tanstack/react-router'
import { Background, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  HeartPulse,
  Link2,
  PackageCheck,
  ScanSearch,
  Wrench,
} from 'lucide-react'
import { copyText } from '@/lib/copy-text'
import { usePageMetadata } from '@/lib/page-metadata'
import { useDashboardService } from '@/lib/service-lasso-dashboard/hooks'
import type {
  DashboardService,
  ServiceAction,
  ServiceDependency,
  ServiceEndpoint,
  ServiceEnvironmentVariable,
  ServiceLogPreviewEntry,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

function EndpointCard({ endpoint }: { endpoint: ServiceEndpoint }) {
  return (
    <div className='rounded-lg border p-4'>
      <div className='flex items-start justify-between gap-2'>
        <div>
          <div className='font-medium'>{endpoint.label}</div>
          <div className='text-xs text-muted-foreground'>
            {endpoint.protocol.toUpperCase()} · {endpoint.bind}:{endpoint.port}{' '}
            · {endpoint.exposure}
          </div>
        </div>
        <Button asChild size='sm' variant='outline'>
          <a href={endpoint.url} target='_blank' rel='noreferrer'>
            Open
            <ExternalLink className='ml-2 size-3.5' />
          </a>
        </Button>
      </div>
      <p className='mt-3 text-xs break-all text-muted-foreground'>
        {endpoint.url}
      </p>
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

function LocalDependencyGraph({ service }: { service: DashboardService }) {
  const xStep = 250
  const yStep = 110

  const dependencyNodes: Node[] = service.dependencies.map(
    (dependency, index) => ({
      id: `dep-${dependency.id}`,
      position: { x: 0, y: index * yStep + 30 },
      data: {
        label: (
          <div className='min-w-[150px]'>
            <div className='truncate text-sm font-medium'>
              {dependency.name}
            </div>
            <div className='truncate text-xs text-muted-foreground'>
              {dependency.id}
            </div>
          </div>
        ),
      },
      style: {
        border: '1px solid #334155',
        borderRadius: 10,
        background: '#0f172a',
        color: '#e2e8f0',
      },
    })
  )

  const dependentNodes: Node[] = service.dependents.map((dependent, index) => ({
    id: `dnt-${dependent.id}`,
    position: { x: xStep * 2, y: index * yStep + 30 },
    data: {
      label: (
        <div className='min-w-[150px]'>
          <div className='truncate text-sm font-medium'>{dependent.name}</div>
          <div className='truncate text-xs text-muted-foreground'>
            {dependent.id}
          </div>
        </div>
      ),
    },
    style: {
      border: '1px solid #334155',
      borderRadius: 10,
      background: '#0f172a',
      color: '#e2e8f0',
    },
  }))

  const centerY =
    Math.max(dependencyNodes.length, dependentNodes.length) * yStep * 0.5 + 30

  const centerNode: Node = {
    id: `svc-${service.id}`,
    position: { x: xStep, y: centerY },
    data: {
      label: (
        <div className='min-w-[170px]'>
          <div className='truncate text-sm font-semibold'>{service.name}</div>
          <div className='truncate text-xs text-muted-foreground'>
            {service.id}
          </div>
        </div>
      ),
    },
    style: {
      border: '2px solid #22c55e',
      borderRadius: 10,
      background: '#052e16',
      color: '#e2e8f0',
      boxShadow: '0 0 0 2px rgba(34,197,94,0.25)',
    },
  }

  const edges: Edge[] = [
    ...service.dependencies.map((dependency) => ({
      id: `dep-${dependency.id}->svc-${service.id}`,
      source: `dep-${dependency.id}`,
      target: `svc-${service.id}`,
      animated: true,
      style: { stroke: '#22c55e', strokeWidth: 2.25 },
    })),
    ...service.dependents.map((dependent) => ({
      id: `svc-${service.id}->dnt-${dependent.id}`,
      source: `svc-${service.id}`,
      target: `dnt-${dependent.id}`,
      animated: true,
      style: { stroke: '#0ea5e9', strokeWidth: 2.25 },
    })),
  ]

  const nodes = [...dependencyNodes, centerNode, ...dependentNodes]

  return (
    <div className='h-[320px] rounded-lg border bg-slate-950'>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background gap={20} size={1} color='#1f2937' />
      </ReactFlow>
    </div>
  )
}

function LogPreview({ entries }: { entries: ServiceLogPreviewEntry[] }) {
  return (
    <div className='space-y-3'>
      {entries.length ? (
        entries.map((entry, index) => (
          <div
            key={`${entry.timestamp}-${index}`}
            className='rounded-lg border p-3'
          >
            <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
              <Badge variant='outline'>{entry.level}</Badge>
              <span>{entry.source}</span>
              <span>{entry.timestamp}</span>
            </div>
            <p className='mt-2 text-sm'>{entry.message}</p>
          </div>
        ))
      ) : (
        <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
          No recent log preview entries yet.
        </div>
      )}
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
                      <p className='mt-2 text-muted-foreground'>
                        {service.note}
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
                        {service.runtimeHealth.lastRestartAt ?? 'Not recorded'}
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
                      <div>Installed: {service.installed ? 'Yes' : 'No'}</div>
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

                <div className='grid gap-4 lg:grid-cols-3'>
                  <Card className='lg:col-span-2'>
                    <CardHeader>
                      <CardTitle className='flex items-center gap-2'>
                        <Link2 className='size-4' /> Endpoints + exposure
                      </CardTitle>
                      <CardDescription>
                        Operator-facing entry points and bind/exposure facts for
                        this service.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='grid gap-3 sm:grid-cols-2'>
                      {service.endpoints.map((endpoint) => (
                        <EndpointCard
                          key={`${endpoint.label}-${endpoint.url}`}
                          endpoint={endpoint}
                        />
                      ))}
                    </CardContent>
                  </Card>

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
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Environment variables</CardTitle>
                    <CardDescription>
                      Service-local and shared environment values surfaced in a
                      searchable top-level Variables page as well.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <EnvironmentTable
                      serviceId={service.id}
                      variables={service.environmentVariables}
                    />
                    <div className='flex justify-end'>
                      <Button variant='outline' size='sm' asChild>
                        <Link to='/variables' search={{ service: service.id }}>
                          Open all variables
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className='grid gap-4 lg:grid-cols-2'>
                  <Card>
                    <CardHeader>
                      <CardTitle>Dependencies + relationships</CardTitle>
                      <CardDescription>
                        Local dependency slice for this service, with the
                        broader graph intended to live on the Dependencies page.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-5'>
                      <LocalDependencyGraph service={service} />
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
                      <LogPreview entries={service.recentLogs} />
                      <div className='grid gap-2 sm:grid-cols-2'>
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
                          <Link to='/runtime' search={{ service: service.id }}>
                            Open runtime view
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )
          })()
        )}
      </Main>
    </>
  )
}
