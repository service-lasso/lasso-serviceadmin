import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  History,
  KeyRound,
  Link2,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import { useSecurityState } from '@/lib/service-lasso-dashboard/hooks'
import { getRuntimeApiUnavailableCopy } from '@/lib/service-lasso-dashboard/stub'
import type {
  SecurityGroup,
  SecurityPermission,
  ServiceSecurityState,
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

function RiskBadge({ risk }: { risk: SecurityPermission['riskLevel'] }) {
  if (risk === 'critical') {
    return <Badge variant='destructive'>Critical</Badge>
  }
  if (risk === 'high') return <Badge className='bg-amber-600'>High</Badge>
  if (risk === 'medium') return <Badge variant='secondary'>Medium</Badge>
  return <Badge variant='outline'>Low</Badge>
}

function GroupBadges({ group }: { group: SecurityGroup }) {
  return (
    <div className='flex flex-wrap gap-1'>
      {group.builtIn ? (
        <Badge variant='secondary'>Built-in</Badge>
      ) : (
        <Badge variant='outline'>Custom</Badge>
      )}
      {group.ownerCapable ? <Badge variant='destructive'>Owner</Badge> : null}
      {group.elevated ? <Badge className='bg-amber-600'>Elevated</Badge> : null}
    </div>
  )
}

function SecurityLoading() {
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

function SecurityUnavailable({ error }: { error: unknown }) {
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

function SecuritySummary({ state }: { state: ServiceSecurityState }) {
  const elevatedGroups = state.groups.filter((group) => group.elevated).length
  const enabledMappings = state.providerMappings.filter(
    (mapping) => mapping.enabled
  ).length
  const providers = Array.from(
    new Set(state.providerMappings.map((mapping) => mapping.provider))
  ).join(', ')

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <UsersRound className='size-4' /> Groups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-semibold'>{state.groups.length}</div>
          <p className='text-xs text-muted-foreground'>
            {elevatedGroups} elevated
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <KeyRound className='size-4' /> Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-semibold'>
            {state.permissions.length}
          </div>
          <p className='text-xs text-muted-foreground'>catalogue entries</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <Link2 className='size-4' /> Provider Mappings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-semibold'>{enabledMappings}</div>
          <p
            className='truncate text-xs text-muted-foreground'
            title={providers}
          >
            {providers}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
            <UserRoundCheck className='size-4' /> Current Actor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='truncate text-lg font-semibold'>
            {state.currentActor}
          </div>
          <p className='text-xs text-muted-foreground'>
            active security context
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function GroupsTable({ state }: { state: ServiceSecurityState }) {
  const permissionsByKey = new Map(
    state.permissions.map((permission) => [permission.key, permission])
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Groups</CardTitle>
        <CardDescription>
          Built-in and custom groups with actor, mapping, and scope context.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Actors</TableHead>
                <TableHead>Mappings</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className='min-w-[220px] align-top'>
                    <div className='space-y-2'>
                      <div>
                        <div className='font-medium'>{group.name}</div>
                        <div className='text-sm text-muted-foreground'>
                          {group.description}
                        </div>
                      </div>
                      <GroupBadges group={group} />
                    </div>
                  </TableCell>
                  <TableCell className='align-top'>
                    <div className='flex max-w-[340px] flex-wrap gap-1'>
                      {group.permissionKeys.map((key) => {
                        const permission = permissionsByKey.get(key)
                        return (
                          <Badge key={key} variant='outline'>
                            {permission?.displayName ?? key}
                          </Badge>
                        )
                      })}
                    </div>
                  </TableCell>
                  <TableCell className='align-top'>
                    {group.actorCount}
                  </TableCell>
                  <TableCell className='align-top'>
                    {group.mappingCount}
                  </TableCell>
                  <TableCell className='align-top'>
                    <div className='flex max-w-[220px] flex-wrap gap-1'>
                      {group.scopeRules.map((rule) => (
                        <Badge key={rule} variant='secondary'>
                          {rule}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className='align-top'>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={!group.canEdit}
                      >
                        Edit
                      </Button>
                      <Button size='sm' variant='outline'>
                        Copy
                      </Button>
                      {group.canReset ? (
                        <Button size='sm' variant='outline'>
                          Reset
                        </Button>
                      ) : null}
                    </div>
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

function PermissionsTable({
  permissions,
}: {
  permissions: SecurityPermission[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Permission Catalogue</CardTitle>
        <CardDescription>
          Permission keys, risk, confirmation, and runtime usage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permission</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Confirmation</TableHead>
                <TableHead>Used By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.key}>
                  <TableCell className='min-w-[260px] align-top'>
                    <div className='font-medium'>{permission.displayName}</div>
                    <div className='font-mono text-xs text-muted-foreground'>
                      {permission.key}
                    </div>
                    <div className='mt-1 text-sm text-muted-foreground'>
                      {permission.description}
                    </div>
                  </TableCell>
                  <TableCell className='align-top'>
                    {permission.category}
                  </TableCell>
                  <TableCell className='align-top'>
                    <RiskBadge risk={permission.riskLevel} />
                  </TableCell>
                  <TableCell className='align-top'>
                    {permission.requiresConfirmation ? 'Required' : 'Standard'}
                  </TableCell>
                  <TableCell className='align-top'>
                    <div className='flex max-w-[260px] flex-wrap gap-1'>
                      {permission.usedBy.map((usage) => (
                        <Badge key={usage} variant='outline'>
                          {usage}
                        </Badge>
                      ))}
                    </div>
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

function MappingsTable({ state }: { state: ServiceSecurityState }) {
  const groupById = new Map(state.groups.map((group) => [group.id, group]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider Mappings</CardTitle>
        <CardDescription>
          External claims mapped to Service Lasso groups.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Claim</TableHead>
                <TableHead>Target Group</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Conflicts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.providerMappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell className='font-medium'>
                    {mapping.provider}
                  </TableCell>
                  <TableCell>
                    <div>{mapping.claimType}</div>
                    <div className='font-mono text-xs text-muted-foreground'>
                      {mapping.claimValue}
                    </div>
                  </TableCell>
                  <TableCell>
                    {groupById.get(mapping.targetGroupId)?.name ??
                      mapping.targetGroupId}
                  </TableCell>
                  <TableCell>
                    {mapping.enabled ? (
                      <Badge className='bg-emerald-600'>Enabled</Badge>
                    ) : (
                      <Badge variant='outline'>Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell>{mapping.priority}</TableCell>
                  <TableCell>
                    {mapping.conflicts.length > 0
                      ? mapping.conflicts.join(', ')
                      : 'None'}
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

function ActorsTable({ state }: { state: ServiceSecurityState }) {
  const groupById = new Map(state.groups.map((group) => [group.id, group]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actor Assignments</CardTitle>
        <CardDescription>
          Local, provider, and service-account group assignments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Actor</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Protection</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.actorAssignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className='font-medium'>
                    {assignment.actor}
                  </TableCell>
                  <TableCell>
                    {groupById.get(assignment.groupId)?.name ??
                      assignment.groupId}
                  </TableCell>
                  <TableCell>{assignment.source}</TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-1'>
                      {assignment.self ? (
                        <Badge variant='secondary'>Current actor</Badge>
                      ) : null}
                      {assignment.lastOwner ? (
                        <Badge variant='destructive'>Last owner</Badge>
                      ) : null}
                      {!assignment.self && !assignment.lastOwner ? (
                        <Badge variant='outline'>Standard</Badge>
                      ) : null}
                    </div>
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

export function Security() {
  usePageMetadata({
    title: 'Service Admin - Security',
    description: 'Service Admin groups, permissions, and provider mappings.',
  })

  const securityQuery = useSecurityState()

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
            <h2 className='text-2xl font-bold tracking-tight'>Security</h2>
            <p className='text-muted-foreground'>
              Groups, permission catalogue, actor access, and provider mappings.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' size='sm' asChild>
              <Link to='/logs'>
                <History className='size-4' />
                Audit
              </Link>
            </Button>
            <Button size='sm'>
              <ShieldCheck className='size-4' />
              New group
            </Button>
          </div>
        </div>

        {securityQuery.isLoading ? (
          <SecurityLoading />
        ) : securityQuery.isError ? (
          <SecurityUnavailable error={securityQuery.error} />
        ) : securityQuery.data ? (
          <>
            {(securityQuery.data.safety.lastOwnerProtected ||
              securityQuery.data.safety.selfSecurityAccessProtected) && (
              <Alert>
                <AlertTriangle className='size-4' />
                <AlertTitle>Last-owner protection active</AlertTitle>
                <AlertDescription>
                  Owner-capable and current-actor access changes require a safe
                  replacement assignment before removal.
                </AlertDescription>
              </Alert>
            )}

            <SecuritySummary state={securityQuery.data} />

            <Tabs defaultValue='groups' className='space-y-4'>
              <TabsList className='grid w-full grid-cols-2 sm:w-auto sm:grid-cols-4'>
                <TabsTrigger value='groups'>Groups</TabsTrigger>
                <TabsTrigger value='permissions'>Permissions</TabsTrigger>
                <TabsTrigger value='mappings'>Mappings</TabsTrigger>
                <TabsTrigger value='actors'>Actors</TabsTrigger>
              </TabsList>
              <TabsContent value='groups'>
                <GroupsTable state={securityQuery.data} />
              </TabsContent>
              <TabsContent value='permissions'>
                <PermissionsTable
                  permissions={securityQuery.data.permissions}
                />
              </TabsContent>
              <TabsContent value='mappings'>
                <MappingsTable state={securityQuery.data} />
              </TabsContent>
              <TabsContent value='actors'>
                <ActorsTable state={securityQuery.data} />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </Main>
    </>
  )
}
