import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  KeyRound,
  RadioTower,
  ShieldAlert,
  Terminal,
  UsersRound,
} from 'lucide-react'
import { copyText } from '@/lib/copy-text'
import { usePageMetadata } from '@/lib/page-metadata'
import { useMcpState } from '@/lib/service-lasso-dashboard/hooks'
import { getRuntimeApiUnavailableCopy } from '@/lib/service-lasso-dashboard/stub'
import type {
  McpState,
  SecurityPermissionRisk,
} from '@/lib/service-lasso-dashboard/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

function HealthBadge({ health }: { health: McpState['health'] }) {
  if (health === 'healthy') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Healthy</Badge>
    )
  }
  if (health === 'critical')
    return <Badge variant='destructive'>Critical</Badge>
  if (health === 'warning')
    return <Badge className='bg-amber-600'>Warning</Badge>
  return <Badge variant='outline'>Unknown</Badge>
}

function RiskBadge({ risk }: { risk: SecurityPermissionRisk }) {
  if (risk === 'critical') return <Badge variant='destructive'>Critical</Badge>
  if (risk === 'high') return <Badge className='bg-amber-600'>High</Badge>
  if (risk === 'medium') return <Badge variant='secondary'>Medium</Badge>
  return <Badge variant='outline'>Low</Badge>
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <Button
      type='button'
      variant='outline'
      size='icon'
      className='size-8 shrink-0'
      title={label}
      onClick={() => void copyText(value)}
    >
      <Copy className='size-4' />
    </Button>
  )
}

function McpLoading() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className='h-6 w-48' />
        <Skeleton className='h-4 w-96' />
      </CardHeader>
      <CardContent>
        <Skeleton className='h-[460px] w-full' />
      </CardContent>
    </Card>
  )
}

function McpUnavailable({ error }: { error: unknown }) {
  const copy = getRuntimeApiUnavailableCopy(error)

  return (
    <Alert variant='destructive'>
      <AlertTriangle className='size-4' />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription>
        {copy.description} {copy.guidance}
      </AlertDescription>
    </Alert>
  )
}

function McpSummary({ state }: { state: McpState }) {
  const enabledExposure = Object.entries(state.exposure)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name)

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <RadioTower className='size-4' /> Health
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-1'>
          <HealthBadge health={state.health} />
          <p className='text-xs text-muted-foreground'>
            {state.enabled ? 'enabled' : 'disabled'} · {state.operatingMode}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <Terminal className='size-4' /> Transports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-semibold'>
            {state.transports.length}
          </div>
          <p className='truncate text-xs text-muted-foreground'>
            {state.transports.join(', ')}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <ShieldAlert className='size-4' /> Exposure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-semibold'>{enabledExposure.length}</div>
          <p className='truncate text-xs text-muted-foreground'>
            {enabledExposure.length ? enabledExposure.join(', ') : 'none'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <UsersRound className='size-4' /> Clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-semibold'>{state.clients.length}</div>
          <p className='text-xs text-muted-foreground'>recent clients</p>
        </CardContent>
      </Card>
    </div>
  )
}

function EndpointPanel({ state }: { state: McpState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection</CardTitle>
        <CardDescription>
          Protocol, SDK, endpoint, command, and identity discovery state.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 md:grid-cols-2'>
          <div className='rounded-md border p-3'>
            <div className='text-sm font-medium'>Streamable HTTP URL</div>
            <div className='mt-2 flex min-w-0 items-center gap-2'>
              <code className='min-w-0 flex-1 overflow-hidden rounded bg-muted px-2 py-1 text-xs text-ellipsis whitespace-nowrap'>
                {state.canonicalEndpoint}
              </code>
              <CopyButton
                value={state.canonicalEndpoint}
                label='Copy HTTP URL'
              />
            </div>
          </div>
          <div className='rounded-md border p-3'>
            <div className='text-sm font-medium'>stdio command</div>
            <div className='mt-2 flex min-w-0 items-center gap-2'>
              <code className='min-w-0 flex-1 overflow-hidden rounded bg-muted px-2 py-1 text-xs text-ellipsis whitespace-nowrap'>
                {state.stdioCommand}
              </code>
              <CopyButton
                value={state.stdioCommand}
                label='Copy stdio command'
              />
            </div>
          </div>
        </div>

        <div className='grid gap-3 text-sm md:grid-cols-3'>
          <div>
            <div className='text-muted-foreground'>Protocol</div>
            <div className='font-medium'>{state.protocolVersion}</div>
          </div>
          <div>
            <div className='text-muted-foreground'>SDK</div>
            <div className='font-medium'>{state.sdkVersion}</div>
          </div>
          <div>
            <div className='text-muted-foreground'>Identity Provider</div>
            <div className='font-medium'>
              {state.identityProvider.name} ·{' '}
              {state.identityProvider.discoveryStatus}
            </div>
          </div>
        </div>

        <div className='flex flex-wrap gap-2'>
          {state.allowedOrigins.map((origin) => (
            <Badge key={origin} variant='outline'>
              {origin}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function PermissionsTable({ state }: { state: McpState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Matrix</CardTitle>
        <CardDescription>
          Effective MCP modes, scopes, and denials reported by the server.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Denied State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.permissions.map((permission) => (
                <TableRow key={permission.role}>
                  <TableCell className='font-medium'>
                    {permission.role}
                  </TableCell>
                  <TableCell>
                    <Badge variant='secondary'>{permission.mode}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className='flex max-w-[520px] flex-wrap gap-1'>
                      {permission.scopes.map((scope) => (
                        <Badge key={scope} variant='outline'>
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {permission.deniedReason ?? 'No denial reported'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function ClientsAndOperations({ state }: { state: McpState }) {
  return (
    <div className='grid gap-4 xl:grid-cols-2'>
      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>
            Safe client identifiers and metadata.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {state.clients.map((client) => (
              <div key={client.id} className='rounded-md border p-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='font-medium'>{client.name}</div>
                  <Badge variant='outline'>{client.transport}</Badge>
                </div>
                <div className='mt-2 grid gap-1 text-sm text-muted-foreground'>
                  <span>{client.actor}</span>
                  <span>{client.lastSeenAt}</span>
                  <span>{client.remoteAddress ?? 'local stdio'}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operations</CardTitle>
          <CardDescription>
            In-progress and recent MCP tool activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {state.operations.map((operation) => (
              <div key={operation.id} className='rounded-md border p-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='font-medium'>{operation.tool}</div>
                  <Badge variant='secondary'>{operation.status}</Badge>
                </div>
                <div className='mt-2 grid gap-1 text-sm text-muted-foreground'>
                  <span>{operation.actor}</span>
                  <span>{operation.startedAt}</span>
                  <code className='text-xs'>{operation.correlationId}</code>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Confirmations({ state }: { state: McpState }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirmations</CardTitle>
        <CardDescription>
          Pending, expired, and completed guarded action confirmations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {state.confirmations.length ? (
            state.confirmations.map((confirmation) => (
              <div key={confirmation.id} className='rounded-md border p-3'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='space-y-1'>
                    <div className='font-medium'>
                      {confirmation.tool} · {confirmation.target}
                    </div>
                    <p className='max-w-3xl text-sm text-muted-foreground'>
                      {confirmation.parameterSummary}
                    </p>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <RiskBadge risk={confirmation.risk} />
                    <Badge variant='outline'>{confirmation.status}</Badge>
                  </div>
                </div>
                <div className='mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-3'>
                  <span>{confirmation.actor}</span>
                  <span>{confirmation.expiresAt}</span>
                  <code className='text-xs'>{confirmation.correlationId}</code>
                </div>
                <div className='mt-3 flex flex-wrap gap-2'>
                  <Button size='sm' disabled={!confirmation.canApprove}>
                    <CheckCircle2 className='size-4' />
                    Approve
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={!confirmation.canDeny}
                  >
                    <ClipboardCheck className='size-4' />
                    Deny
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className='rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
              No confirmations are waiting for review.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function Mcp() {
  usePageMetadata({
    title: 'Service Admin - MCP',
    description: 'Service Admin MCP settings, health, and supervision.',
  })

  const mcpQuery = useMcpState()

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
            <h2 className='text-2xl font-bold tracking-tight'>MCP</h2>
            <p className='text-muted-foreground'>
              Settings, permissions, approvals, clients, and health from the
              runtime MCP surface.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/security'>
                <KeyRound className='size-4' />
                Security
              </Link>
            </Button>
            <Button variant='outline' size='sm' asChild>
              <Link to='/logs'>Audit</Link>
            </Button>
          </div>
        </div>

        {mcpQuery.isLoading ? (
          <McpLoading />
        ) : mcpQuery.isError ? (
          <McpUnavailable error={mcpQuery.error} />
        ) : mcpQuery.data ? (
          <>
            {mcpQuery.data.lastError ? (
              <Alert>
                <AlertTriangle className='size-4' />
                <AlertTitle>MCP warning</AlertTitle>
                <AlertDescription>{mcpQuery.data.lastError}</AlertDescription>
              </Alert>
            ) : null}

            <McpSummary state={mcpQuery.data} />
            <EndpointPanel state={mcpQuery.data} />

            <Tabs defaultValue='permissions' className='space-y-4'>
              <TabsList className='grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4'>
                <TabsTrigger value='permissions'>Permissions</TabsTrigger>
                <TabsTrigger value='clients'>Clients</TabsTrigger>
                <TabsTrigger value='confirmations'>Approvals</TabsTrigger>
                <TabsTrigger value='audit'>Audit</TabsTrigger>
              </TabsList>
              <TabsContent value='permissions'>
                <PermissionsTable state={mcpQuery.data} />
              </TabsContent>
              <TabsContent value='clients'>
                <ClientsAndOperations state={mcpQuery.data} />
              </TabsContent>
              <TabsContent value='confirmations'>
                <Confirmations state={mcpQuery.data} />
              </TabsContent>
              <TabsContent value='audit'>
                <Card>
                  <CardHeader>
                    <CardTitle>Audit Links</CardTitle>
                    <CardDescription>
                      Filtered audit trails and correlation entry points.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='flex flex-wrap gap-2'>
                    {mcpQuery.data.auditLinks.map((link) => (
                      <Button
                        key={link.url}
                        variant='outline'
                        size='sm'
                        asChild
                      >
                        <a href={link.url}>
                          {link.label}
                          <Badge variant='secondary'>{link.count}</Badge>
                        </a>
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </Main>
    </>
  )
}
