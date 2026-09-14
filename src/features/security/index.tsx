import { Link, getRouteApi } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  History,
  KeyRound,
  Link2,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  XCircle,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  useSecretAccessAssignments,
  useSecurityState,
} from '@/lib/service-lasso-dashboard/hooks'
import { buildSecretAccessAssignmentRows } from '@/lib/service-lasso-dashboard/secret-access-policy'
import { getRuntimeApiUnavailableCopy } from '@/lib/service-lasso-dashboard/stub'
import type {
  SecurityGroup,
  SecurityPermission,
  SecretBulkCampaignPlan,
  SecretAccessAssignmentAudit,
  SecretRotationImpactPlan,
  SecretRotationImpactServiceAction,
  SecretRotationOperation,
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
import { SecretAccessAssignmentsTable } from '@/features/secret-access-assignments/access-assignments-table'
import { isFixtureBulkCampaignApplyDisabled } from './bulk-campaign-contract'
import { LiveBulkCampaignPlanner } from './bulk-campaign-planner'

const securityRoute = getRouteApi('/_authenticated/security/')

const securityTabs = [
  'groups',
  'permissions',
  'mappings',
  'actors',
  'secret-access',
  'rotations',
] as const

type SecurityTab = (typeof securityTabs)[number]

function isSecurityTab(value: string): value is SecurityTab {
  return securityTabs.some((tab) => tab === value)
}

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

function ReadinessBadge({
  state,
}: {
  state: SecretRotationImpactPlan['capabilityStatus']
}) {
  if (state === 'ready') {
    return <Badge className='bg-emerald-600'>Ready</Badge>
  }
  if (state === 'unsupported')
    return <Badge variant='outline'>Unsupported</Badge>
  if (state === 'requires_auth') {
    return <Badge className='bg-amber-600'>Auth required</Badge>
  }
  if (state === 'denied') return <Badge variant='destructive'>Denied</Badge>
  if (state === 'unavailable') {
    return <Badge variant='destructive'>Unavailable</Badge>
  }
  return <Badge variant='destructive'>Blocked</Badge>
}

function ActionBadge({
  action,
}: {
  action: SecretRotationImpactServiceAction
}) {
  if (action === 'restart')
    return <Badge className='bg-amber-600'>Restart</Badge>
  if (action === 'reload') return <Badge className='bg-sky-600'>Reload</Badge>
  if (action === 'action') return <Badge variant='secondary'>Action</Badge>
  if (action === 'manual') return <Badge variant='destructive'>Manual</Badge>
  return <Badge variant='outline'>None</Badge>
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

function SecretAccessAssignments({
  audit,
}: {
  audit: SecretAccessAssignmentAudit
}) {
  const search = securityRoute.useSearch()
  const navigate = securityRoute.useNavigate()
  const rows = buildSecretAccessAssignmentRows(audit)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Manifest Secret Access</CardTitle>
        <CardDescription>
          Live broker.accessPolicy grants from installed service manifests
          (service id, namespace, refs, operations, purpose). Missing import
          assignments come from Core secret-reference audit. This is not a
          dry-run playground.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            No broker.accessPolicy grants or missing import assignments are
            declared on this instance.
          </p>
        ) : (
          <SecretAccessAssignmentsTable
            rows={rows}
            search={search}
            navigate={navigate}
          />
        )}
      </CardContent>
    </Card>
  )
}

function RotationOperationBadge({
  operation,
}: {
  operation?: SecretRotationOperation
}) {
  if (!operation) return <Badge variant='outline'>Dry run only</Badge>
  if (operation.phase === 'failed' || operation.phase === 'rolled_back') {
    return <Badge variant='destructive'>{operation.phaseLabel}</Badge>
  }
  if (operation.phase === 'committed') {
    return <Badge className='bg-emerald-600'>{operation.phaseLabel}</Badge>
  }
  return <Badge className='bg-sky-600'>{operation.phaseLabel}</Badge>
}

function RotationPlanCard({
  plan,
  operation,
}: {
  plan: SecretRotationImpactPlan
  operation?: SecretRotationOperation
}) {
  const impacted = [...plan.services].sort((a, b) => a.order - b.order)
  const auditReasonCaptured = false
  const applyDisabled =
    !auditReasonCaptured ||
    !plan.applySupported ||
    !plan.contractCompatible ||
    plan.blockedReasons.length > 0

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <CardTitle className='break-words'>{plan.ref}</CardTitle>
            <CardDescription>
              {plan.provider} / {plan.store} / {plan.planRevision}
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <ReadinessBadge state={plan.capabilityStatus} />
            <RotationOperationBadge operation={operation} />
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 md:grid-cols-4'>
          <div className='rounded-md border p-3'>
            <div className='text-xs text-muted-foreground'>Auth</div>
            <ReadinessBadge state={plan.authStatus} />
          </div>
          <div className='rounded-md border p-3'>
            <div className='text-xs text-muted-foreground'>Policy</div>
            <ReadinessBadge state={plan.policyStatus} />
          </div>
          <div className='rounded-md border p-3'>
            <div className='text-xs text-muted-foreground'>Audit</div>
            <ReadinessBadge state={plan.auditStatus} />
          </div>
          <div className='rounded-md border p-3'>
            <div className='text-xs text-muted-foreground'>Contract</div>
            {plan.contractCompatible ? (
              <Badge className='bg-emerald-600'>{plan.contractVersion}</Badge>
            ) : (
              <Badge variant='destructive'>{plan.contractVersion}</Badge>
            )}
          </div>
        </div>

        <div className='grid gap-3 md:grid-cols-2'>
          <div className='rounded-md border p-3'>
            <div className='text-xs text-muted-foreground'>Current version</div>
            <div className='font-mono text-sm'>{plan.currentVersion.id}</div>
            <div className='text-xs text-muted-foreground'>
              Activated{' '}
              {new Date(plan.currentVersion.activatedAt).toLocaleString()}
            </div>
          </div>
          <div className='rounded-md border p-3'>
            <div className='text-xs text-muted-foreground'>
              Candidate version
            </div>
            <div className='font-mono text-sm'>{plan.candidateVersion.id}</div>
            <div className='text-xs text-muted-foreground'>
              Staged by {plan.candidateVersion.stagedBy}
            </div>
          </div>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Relation</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Rematerialise</TableHead>
                <TableHead>Health checks</TableHead>
                <TableHead>Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {impacted.map((service) => (
                <TableRow key={`${plan.id}-${service.serviceId}`}>
                  <TableCell className='font-mono'>{service.order}</TableCell>
                  <TableCell className='min-w-[180px]'>
                    <div className='font-medium'>{service.serviceName}</div>
                    <div className='text-xs text-muted-foreground'>
                      {service.estimatedDisruption}
                    </div>
                    {service.manualBlockers.map((blocker) => (
                      <div
                        className='mt-1 text-xs text-destructive'
                        key={blocker}
                      >
                        {blocker}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className='capitalize'>
                    {service.relation}
                  </TableCell>
                  <TableCell>
                    <div className='space-y-1'>
                      <ActionBadge action={service.action} />
                      <div className='text-xs text-muted-foreground'>
                        {service.actionLabel}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {service.rematerializeConfig ? (
                      <CheckCircle2 className='size-4 text-emerald-600' />
                    ) : (
                      <XCircle className='size-4 text-muted-foreground' />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className='flex max-w-[240px] flex-wrap gap-1'>
                      {service.expectedHealthChecks.map((check) => (
                        <Badge key={check} variant='outline'>
                          {check}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-2'>
                      <Button size='sm' variant='outline' asChild>
                        <Link to={service.serviceHref}>Details</Link>
                      </Button>
                      <Button size='sm' variant='outline' asChild>
                        <Link to={service.logsHref}>Logs</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {plan.blockedReasons.length > 0 ? (
          <Alert variant='destructive'>
            <AlertTriangle className='size-4' />
            <AlertTitle>Apply disabled</AlertTitle>
            <AlertDescription>{plan.blockedReasons.join(' ')}</AlertDescription>
          </Alert>
        ) : null}

        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <RotateCcw className='size-4' />
            {plan.rollbackAvailable
              ? plan.rollbackReason
              : `Rollback unavailable: ${plan.rollbackReason}`}
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' disabled>
              <ArrowUpDown className='size-4' />
              Refresh plan
            </Button>
            <Button disabled={applyDisabled}>
              <LockKeyhole className='size-4' />
              Apply selected revision
            </Button>
          </div>
        </div>

        {operation ? (
          <div className='rounded-md border p-3 text-sm'>
            <div className='font-medium'>Durable operation status</div>
            <div className='mt-1 text-muted-foreground'>
              {operation.safeNextAction} Updated{' '}
              {new Date(operation.updatedAt).toLocaleString()}.
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function RotationImpactPlans({ state }: { state: ServiceSecurityState }) {
  const rotation = state.secretRotation
  const operationsByPlan = new Map(
    rotation?.operations.map((operation) => [operation.planId, operation]) ?? []
  )

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h3 className='text-lg font-semibold'>Rotation Impact Plans</h3>
          <p className='text-sm text-muted-foreground'>
            Metadata-only dry runs from core rotation planning.
          </p>
        </div>
        <Button variant='outline' size='sm' disabled>
          <LockKeyhole className='size-4' />
          Audit reason required
        </Button>
      </div>
      {rotation?.plans.length ? (
        rotation.plans.map((plan) => (
          <RotationPlanCard
            key={plan.id}
            operation={operationsByPlan.get(plan.id)}
            plan={plan}
          />
        ))
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No rotation plans</CardTitle>
            <CardDescription>
              Core has not returned a linked service impact plan.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}

function BulkCampaignRiskBadge({
  risk,
}: {
  risk: SecretBulkCampaignPlan['items'][number]['riskLevel']
}) {
  if (risk === 'critical') return <Badge variant='destructive'>Critical</Badge>
  if (risk === 'high') return <Badge className='bg-amber-600'>High</Badge>
  if (risk === 'medium') return <Badge variant='secondary'>Medium</Badge>
  return <Badge variant='outline'>Low</Badge>
}

function BulkCampaignCard({ plan }: { plan: SecretBulkCampaignPlan }) {
  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <CardTitle className='break-words'>{plan.operationLabel}</CardTitle>
            <CardDescription>
              {plan.planRevision} / expires{' '}
              {new Date(plan.expiresAt).toLocaleString()}
            </CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='secondary'>Dry run only</Badge>
            {plan.highRiskConfirmationRequired ? (
              <Badge className='bg-amber-600'>Confirmation required</Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
          <div className='rounded-md border p-3'>
            <div className='text-xs text-muted-foreground'>Selected</div>
            <div className='text-xl font-semibold'>{plan.selectedCount}</div>
          </div>
          <div className='rounded-md border p-3'>
            <div className='text-xs text-muted-foreground'>Applicable</div>
            <div className='text-xl font-semibold'>{plan.applicableCount}</div>
          </div>
          <div className='rounded-md border p-3'>
            <div className='text-xs text-muted-foreground'>Denied</div>
            <div className='text-xl font-semibold'>{plan.deniedCount}</div>
          </div>
          <div className='rounded-md border p-3'>
            <div className='text-xs text-muted-foreground'>Unsupported</div>
            <div className='text-xl font-semibold'>{plan.unsupportedCount}</div>
          </div>
          <div className='rounded-md border p-3'>
            <div className='text-xs text-muted-foreground'>High risk</div>
            <div className='text-xl font-semibold'>{plan.highRiskCount}</div>
          </div>
        </div>

        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Capability</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead>Audit</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Expected action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.items.map((item) => (
                <TableRow key={`${plan.id}-${item.ref}`}>
                  <TableCell className='min-w-[260px] align-top'>
                    <div className='font-mono text-sm'>{item.ref}</div>
                    <div className='text-xs text-muted-foreground'>
                      {item.ownerServiceId ?? 'workspace'}
                    </div>
                  </TableCell>
                  <TableCell className='align-top'>
                    <div>{item.sourceProvider}</div>
                    <div className='text-xs text-muted-foreground'>
                      {item.targetProvider ??
                        item.targetPolicy ??
                        'same target'}
                    </div>
                  </TableCell>
                  <TableCell className='align-top'>
                    <ReadinessBadge state={item.capabilityStatus} />
                  </TableCell>
                  <TableCell className='align-top'>
                    <ReadinessBadge state={item.policyStatus} />
                  </TableCell>
                  <TableCell className='align-top'>
                    <ReadinessBadge state={item.auditStatus} />
                  </TableCell>
                  <TableCell className='align-top'>
                    <BulkCampaignRiskBadge risk={item.riskLevel} />
                  </TableCell>
                  <TableCell className='min-w-[280px] align-top'>
                    <div className='text-sm'>{item.expectedAction}</div>
                    {item.blockers.map((blocker) => (
                      <div
                        className='mt-1 text-xs text-destructive'
                        key={blocker}
                      >
                        {blocker}
                      </div>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='max-w-2xl text-sm text-muted-foreground'>
            {plan.safeNextAction}
          </div>
          <Button disabled={isFixtureBulkCampaignApplyDisabled(plan)}>
            <LockKeyhole className='size-4' />
            Apply campaign
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function BulkCampaignPlans({ state }: { state: ServiceSecurityState }) {
  const campaigns = state.secretRotation?.bulkCampaigns ?? []

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h3 className='text-lg font-semibold'>Bulk Campaign Planner</h3>
          <p className='text-sm text-muted-foreground'>
            Mixed dry-run fixture stays non-mutating. Live apply requires
            dry-run, revalidation, audit reason, and the exact campaign id.
          </p>
        </div>
        <Button variant='outline' size='sm' disabled>
          <LockKeyhole className='size-4' />
          Audit reason required
        </Button>
      </div>
      <LiveBulkCampaignPlanner />
      {campaigns.length ? (
        campaigns.map((plan) => <BulkCampaignCard key={plan.id} plan={plan} />)
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No bulk campaign plans</CardTitle>
            <CardDescription>
              Core has not returned a broker-backed dry run.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}

export function Security() {
  usePageMetadata({
    title: 'Service Admin - Security',
    description: 'Service Admin groups, permissions, and provider mappings.',
  })

  const securityQuery = useSecurityState()
  const secretAccessQuery = useSecretAccessAssignments()
  const search = securityRoute.useSearch()
  const navigate = securityRoute.useNavigate()
  const requestedTab = search.tab ?? 'groups'
  const activeTab = isSecurityTab(requestedTab) ? requestedTab : 'groups'

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
              Groups, permissions, provider mappings, and enforced service
              manifest secret access.
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

            <Tabs
              value={activeTab}
              onValueChange={(nextTab) => {
                if (!isSecurityTab(nextTab)) return
                void navigate({
                  search: (previous) => ({ ...previous, tab: nextTab }),
                })
              }}
              className='space-y-4'
            >
              <TabsList className='grid w-full grid-cols-2 sm:w-auto sm:grid-cols-6'>
                <TabsTrigger value='groups'>Groups</TabsTrigger>
                <TabsTrigger value='permissions'>Permissions</TabsTrigger>
                <TabsTrigger value='mappings'>Mappings</TabsTrigger>
                <TabsTrigger value='actors'>Actors</TabsTrigger>
                <TabsTrigger value='secret-access'>Secret access</TabsTrigger>
                <TabsTrigger value='rotations'>Rotations</TabsTrigger>
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
              <TabsContent value='secret-access'>
                {secretAccessQuery.isLoading ? (
                  <SecurityLoading />
                ) : secretAccessQuery.isError ? (
                  <SecurityUnavailable error={secretAccessQuery.error} />
                ) : secretAccessQuery.data ? (
                  <SecretAccessAssignments audit={secretAccessQuery.data} />
                ) : null}
              </TabsContent>
              <TabsContent value='rotations'>
                <div className='space-y-6'>
                  <RotationImpactPlans state={securityQuery.data} />
                  <BulkCampaignPlans state={securityQuery.data} />
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </Main>
    </>
  )
}
