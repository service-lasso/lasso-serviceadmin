import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { LazyLog, ScrollFollow } from '@melloware/react-logviewer'
import {
  Position,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  HeartPulse,
  Link2,
  PackageCheck,
  Play,
  Plus,
  RefreshCw,
  Save,
  ScanSearch,
  ShieldAlert,
  Users,
  Undo2,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { copyText } from '@/lib/copy-text'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  buildApiUsageEdge,
  buildDependencyEdge,
  buildServiceNodeLabel,
  buildServiceNodeStyle,
  getServiceNodeImage,
} from '@/lib/service-graph'
import {
  classifyMigrationRefOutcome,
  migrationApplyBlocked,
  migrationPlansMatch,
} from '@/lib/service-lasso-dashboard/broker-migration'
import {
  useBrokerBulkCampaignApply,
  useBrokerBulkCampaignCreate,
  useBrokerBulkCampaignRevalidate,
  useBrokerMigrationApply,
  useBrokerMigrationPreview,
  useBrokerProviderStatus,
  useDashboardService,
  useServices,
  useSecretDecommissionApply,
  useSecretDecommissionPreview,
  useSecretDecommissionRestore,
  useSecretCreateApply,
  useSecretCreatePreview,
  useSecretMutationApply,
  useSecretMutationPreview,
  useSecretPolicyPreview,
  useSecretReveal,
  useSecretRotationPreview,
  useSecretRotationVersionAction,
  useCoreSecretRotationPlan,
  useCoreSecretRotationOperation,
  useCoreSecretRotationExecution,
  useSecretsManagement,
  useRuntimeIdentity,
  useServiceSetup,
  useServiceSetupAction,
  useServiceLifecycleAction,
  useServiceUpdateAction,
} from '@/lib/service-lasso-dashboard/hooks'
import {
  isRuntimeApiUnavailableError,
  providerSupportsMigrationApply,
  serviceLassoApiBaseUrl,
} from '@/lib/service-lasso-dashboard/stub'
import type {
  BrokerBulkCampaignResult,
  BrokerMigrationResult,
  DashboardService,
  ServiceAction,
  ServiceLifecycleActionKind,
  ServiceDependency,
  ServiceEndpoint,
  ServiceEnvironmentVariable,
  ServiceLogPreviewEntry,
  ServicePermissionGrant,
  SecretManagementRecord,
  SecretCreateGenerationMode,
  SecretCreateResult,
  SecretDecommissionResult,
  SecretMutationOperation,
  SecretMutationResult,
  SecretPolicyPreviewResult,
  SecretRevealResult,
  SecretRotationPreviewResult,
  SecretRotationVersionResult,
  CoreSecretRotationImpactPlan,
  CoreSecretRotationExecutionState,
  ServiceSetupState,
  ServiceSetupStep,
  ServiceStatus,
} from '@/lib/service-lasso-dashboard/types'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
import { Textarea } from '@/components/ui/textarea'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DependencyGraphCanvas } from '@/components/dependency-graph-canvas'
import { DependencyGraphPanel } from '@/components/dependency-graph-panel'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import {
  getServiceRecoveryDescription,
  ServiceRecoveryBadge,
  ServiceRecoveryDoctorButton,
} from '@/components/service-recovery-status'
import {
  getServiceUpdateDescription,
  ServiceUpdateActions,
  ServiceUpdateBadge,
} from '@/components/service-update-status'
import { ThemeSwitch } from '@/components/theme-switch'
import { SecretsBrokerLifecyclePanel } from './secrets-lifecycle-panel'
import { SecretsBrokerOperationsPanel } from './secrets-operations-panel'
import { SecretsBrokerProvidersPanel } from './secrets-providers-panel'

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

function endpointSelector(endpoint: ServiceEndpoint) {
  return endpoint.id ? `\${endpoint.${endpoint.id}.port}` : null
}

function endpointUrl(endpoint: ServiceEndpoint) {
  if (endpoint.url) return endpoint.url
  if (endpoint.port === undefined) return undefined

  const protocol =
    endpoint.protocol === 'http' ||
    endpoint.protocol === 'https' ||
    endpoint.protocol === 'tcp'
      ? endpoint.protocol
      : 'tcp'

  return `${protocol}://${endpoint.bind ?? '127.0.0.1'}:${endpoint.port}/`
}

function endpointResolutionMessages(endpoint: ServiceEndpoint) {
  return [
    endpoint.resolution?.message,
    endpoint.error,
    ...(endpoint.resolution?.errors ?? []),
    ...(endpoint.resolution?.conflicts ?? []),
    ...(endpoint.errors ?? []),
    ...(endpoint.conflicts ?? []),
  ].filter((message): message is string => Boolean(message))
}

function EndpointResolutionBadge({ endpoint }: { endpoint: ServiceEndpoint }) {
  const messages = endpointResolutionMessages(endpoint)
  const status =
    endpoint.resolution?.status ??
    (messages.length > 0
      ? 'failed'
      : endpoint.url || endpoint.port
        ? 'resolved'
        : 'unknown')

  if (status === 'resolved') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Resolved</Badge>
    )
  }

  if (status === 'failed' || status === 'conflict') {
    return <Badge variant='destructive'>{status}</Badge>
  }

  if (status === 'warning') {
    return <Badge variant='secondary'>Warning</Badge>
  }

  return <Badge variant='outline'>Unknown</Badge>
}

function EndpointsTable({ endpoints }: { endpoints: ServiceEndpoint[] }) {
  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Protocol</TableHead>
            <TableHead>Transport</TableHead>
            <TableHead>Bind</TableHead>
            <TableHead>Port</TableHead>
            <TableHead>Exposure</TableHead>
            <TableHead>Selector</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Resolution</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {endpoints.length ? (
            endpoints.map((endpoint, index) => {
              const url = endpointUrl(endpoint)
              const selector = endpointSelector(endpoint)
              const resolutionMessages = endpointResolutionMessages(endpoint)

              return (
                <TableRow
                  key={`${endpoint.id ?? endpoint.label}-${url ?? index}`}
                >
                  <TableCell className='font-mono text-xs'>
                    {endpoint.id ?? 'legacy'}
                  </TableCell>
                  <TableCell>{endpoint.kind ?? 'url'}</TableCell>
                  <TableCell className='font-medium'>
                    <div>{endpoint.label}</div>
                    <div className='text-xs text-muted-foreground'>
                      {endpoint.source ?? 'runtime'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {endpoint.protocol?.toUpperCase() ?? '-'}
                  </TableCell>
                  <TableCell>{endpoint.transport ?? '-'}</TableCell>
                  <TableCell>{endpoint.bind ?? '-'}</TableCell>
                  <TableCell>
                    {endpoint.port ?? endpoint.portDefault ?? '-'}
                  </TableCell>
                  <TableCell>
                    {endpoint.exposure ? (
                      <Badge variant='outline'>{endpoint.exposure}</Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {selector ?? '-'}
                  </TableCell>
                  <TableCell>
                    {endpoint.health ?? endpoint.readiness ?? '-'}
                  </TableCell>
                  <TableCell className='max-w-[220px] text-sm'>
                    <div className='space-y-1'>
                      <EndpointResolutionBadge endpoint={endpoint} />
                      {resolutionMessages.map((message) => (
                        <div
                          key={message}
                          className='text-xs break-words text-muted-foreground'
                        >
                          {message}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className='max-w-[280px] text-sm break-all text-muted-foreground'>
                    {url ?? 'Not resolved'}
                  </TableCell>
                  <TableCell>
                    <Button asChild size='sm' variant='outline' disabled={!url}>
                      {url ? (
                        <a href={url} target='_blank' rel='noreferrer'>
                          Open
                          <ExternalLink className='ml-2 size-3.5' />
                        </a>
                      ) : (
                        <span>Open</span>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={13} className='h-20 text-center'>
                No endpoints are recorded for this service.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
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
          None recorded for this service.
        </div>
      )}
    </div>
  )
}

type GraphOrientation = 'horizontal' | 'vertical'

type GraphLayoutMap = Record<string, { x: number; y: number }>

async function persistNodeLayoutToMeta(
  serviceId: string,
  x: number,
  y: number
) {
  if (serviceLassoApiBaseUrl === null) {
    throw new Error('Service Lasso API base URL is not configured')
  }

  const response = await fetch(
    `${serviceLassoApiBaseUrl}/api/services/${serviceId}/meta`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dependencyGraphPosition: { x, y },
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to persist layout for ${serviceId}`)
  }
}

function LocalDependencyGraph({ service }: { service: DashboardService }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [graphOrientation, setGraphOrientation] =
    useState<GraphOrientation>('horizontal')
  const [savedLayoutMap, setSavedLayoutMap] = useState<GraphLayoutMap>({})
  const [layoutMap, setLayoutMap] = useState<GraphLayoutMap>({})

  const graphModel = useMemo(() => {
    const xStep = graphOrientation === 'horizontal' ? 250 : 190
    const yStep = graphOrientation === 'horizontal' ? 110 : 180

    const dependencyNodes: Node[] = service.dependencies.map(
      (dependency, index) => ({
        id: `dep-${dependency.id}`,
        position:
          layoutMap[`dep-${dependency.id}`] ??
          (graphOrientation === 'horizontal'
            ? { x: 0, y: index * yStep + 30 }
            : { x: index * xStep, y: 0 }),
        data: {
          label: buildServiceNodeLabel({
            name: dependency.name,
            id: dependency.id,
            serviceType: 'dependency',
            isDark,
          }),
        },
        style: buildServiceNodeStyle({ selected: false, isDark }),
        sourcePosition:
          graphOrientation === 'horizontal' ? Position.Right : Position.Bottom,
        targetPosition:
          graphOrientation === 'horizontal' ? Position.Left : Position.Top,
      })
    )

    const dependentNodes: Node[] = service.dependents.map(
      (dependent, index) => ({
        id: `dnt-${dependent.id}`,
        position:
          layoutMap[`dnt-${dependent.id}`] ??
          (graphOrientation === 'horizontal'
            ? { x: xStep * 2, y: index * yStep + 30 }
            : { x: index * xStep, y: yStep * 2 }),
        data: {
          label: buildServiceNodeLabel({
            name: dependent.name,
            id: dependent.id,
            serviceType: 'dependent',
            isDark,
          }),
        },
        style: buildServiceNodeStyle({ selected: false, isDark }),
        sourcePosition:
          graphOrientation === 'horizontal' ? Position.Right : Position.Bottom,
        targetPosition:
          graphOrientation === 'horizontal' ? Position.Left : Position.Top,
      })
    )

    const centerNode: Node = {
      id: `svc-${service.id}`,
      position:
        layoutMap[`svc-${service.id}`] ??
        (graphOrientation === 'horizontal'
          ? {
              x: xStep,
              y:
                Math.max(dependencyNodes.length, dependentNodes.length) *
                  yStep *
                  0.5 +
                30,
            }
          : {
              x:
                Math.max(dependencyNodes.length, dependentNodes.length) *
                xStep *
                0.5,
              y: yStep,
            }),
      data: {
        label: buildServiceNodeLabel({
          name: service.name,
          id: service.id,
          serviceType: service.metadata.serviceType,
          imageUrl: getServiceNodeImage(service, isDark),
          isDark,
        }),
      },
      style: buildServiceNodeStyle({ selected: true, isDark }),
      sourcePosition:
        graphOrientation === 'horizontal' ? Position.Right : Position.Bottom,
      targetPosition:
        graphOrientation === 'horizontal' ? Position.Left : Position.Top,
    }

    const edges: Edge[] = [
      ...service.dependencies.map((dependency) =>
        buildDependencyEdge({
          id: `dep-${dependency.id}->svc-${service.id}`,
          source: `dep-${dependency.id}`,
          target: `svc-${service.id}`,
          selected: true,
          isDark,
        })
      ),
      ...service.dependents.map((dependent) =>
        buildApiUsageEdge({
          id: `svc-${service.id}->dnt-${dependent.id}`,
          source: `svc-${service.id}`,
          target: `dnt-${dependent.id}`,
          isDark,
          label: 'child_of',
        })
      ),
    ]

    return {
      nodes: [...dependencyNodes, centerNode, ...dependentNodes],
      edges,
    }
  }, [graphOrientation, isDark, layoutMap, service])

  const [nodes, setNodes, onNodesChange] = useNodesState(graphModel.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphModel.edges)

  useEffect(() => {
    setNodes(graphModel.nodes)
    setEdges(graphModel.edges)
  }, [graphModel.edges, graphModel.nodes, setEdges, setNodes])

  const isLayoutDirty = useMemo(() => {
    return JSON.stringify(layoutMap) !== JSON.stringify(savedLayoutMap)
  }, [layoutMap, savedLayoutMap])

  const onNodeDragStop = (_: unknown, node: Node) => {
    setLayoutMap((previous) => ({
      ...previous,
      [node.id]: { x: node.position.x, y: node.position.y },
    }))
  }

  const resetGraphLayout = () => {
    setLayoutMap({})
    toast.message('Reset graph layout to the default arrangement.')
  }

  const discardLayoutChanges = () => {
    setLayoutMap(savedLayoutMap)
    toast.message('Discarded unsaved graph layout changes.')
  }

  const toggleGraphOrientation = () => {
    setGraphOrientation((previous) =>
      previous === 'horizontal' ? 'vertical' : 'horizontal'
    )
    setLayoutMap({})
    setSavedLayoutMap({})
    toast.message(
      `Switched graph to ${
        graphOrientation === 'horizontal' ? 'vertical' : 'horizontal'
      } layout.`
    )
  }

  const saveLayoutToMeta = async () => {
    setSavedLayoutMap(layoutMap)

    if (serviceLassoApiBaseUrl === null) {
      toast.error(
        'Layout save triggered, but API base URL is not configured, so this will reset after reload.'
      )
      return
    }

    try {
      await Promise.all(
        Object.entries(layoutMap).map(([nodeId, position]) => {
          const serviceId = nodeId
            .replace(/^dep-/, '')
            .replace(/^dnt-/, '')
            .replace(/^svc-/, '')
          return persistNodeLayoutToMeta(serviceId, position.x, position.y)
        })
      )
      toast.success('Graph layout saved to service meta.')
    } catch {
      toast.error('Could not save graph layout to service meta.')
    }
  }

  return (
    <DependencyGraphPanel
      title='Dependency graph'
      description='Relationship map for this service and its immediate neighborhood.'
      actions={
        <>
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='size-8'
            title={`Switch graph to ${graphOrientation === 'horizontal' ? 'vertical' : 'horizontal'} layout`}
            onClick={toggleGraphOrientation}
          >
            {graphOrientation === 'horizontal' ? (
              <ArrowDown className='size-4' />
            ) : (
              <ArrowRight className='size-4' />
            )}
          </Button>
          <Separator orientation='vertical' className='h-6' />
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='size-8'
            title='Reset graph layout'
            onClick={resetGraphLayout}
          >
            <Wrench className='size-4' />
          </Button>
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='size-8'
            title='Discard unsaved graph layout changes'
            disabled={!isLayoutDirty}
            onClick={discardLayoutChanges}
          >
            <Undo2 className='size-4' />
          </Button>
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='size-8'
            title='Save graph layout to service meta'
            disabled={!isLayoutDirty}
            onClick={() => void saveLayoutToMeta()}
          >
            <Save className='size-4' />
          </Button>
        </>
      }
      graph={
        <DependencyGraphCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          height={420}
          draggable
          selectable={true}
          showControls={true}
          showMiniMap={true}
          legendItems={[
            { label: 'Dependency to selected service', color: '#22c55e' },
            {
              label: 'Selected service to dependent',
              color: '#0ea5e9',
              dashed: true,
            },
          ]}
        />
      }
    />
  )
}

function ServiceLogViewer({ entries }: { entries: ServiceLogPreviewEntry[] }) {
  const logText = entries
    .map(
      (entry) =>
        `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`
    )
    .join('\n')

  if (!entries.length) {
    return (
      <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
        No recent log preview entries yet.
      </div>
    )
  }

  return (
    <div className='h-[260px] rounded-md border'>
      <ScrollFollow
        startFollowing={true}
        render={({ follow }) => (
          <LazyLog
            text={logText}
            follow={follow}
            enableSearch
            selectableLines
            style={{
              height: '260px',
              width: '100%',
              background: 'transparent',
            }}
          />
        )}
      />
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

function isSecretsBrokerService(serviceId: string) {
  return serviceId === 'secrets-broker' || serviceId === '@secretsbroker'
}

function canRevealSecret(
  record: SecretManagementRecord,
  permissionGranted = true
) {
  return (
    permissionGranted &&
    record.outcome === 'ready' &&
    record.capabilities.includes('reveal') &&
    record.auditStatus === 'audit_available'
  )
}

function canMutateSecret(
  record: SecretManagementRecord,
  operation: SecretMutationOperation,
  permissionGranted = true
) {
  return (
    permissionGranted &&
    record.outcome === 'ready' &&
    record.providerKind === 'local-encrypted-store' &&
    record.capabilities.includes(operation) &&
    record.auditStatus === 'audit_available'
  )
}

function canDecommissionSecret(
  record: SecretManagementRecord,
  permissionGranted = true
) {
  return (
    permissionGranted &&
    record.outcome === 'ready' &&
    record.providerKind === 'local-encrypted-store' &&
    record.capabilities.includes('decommission') &&
    record.auditStatus === 'audit_available'
  )
}

function canRotateSecret(
  record: SecretManagementRecord,
  permissionGranted = true
) {
  return (
    permissionGranted &&
    record.outcome === 'ready' &&
    record.providerKind === 'local-encrypted-store' &&
    record.capabilities.includes('rotation') &&
    record.auditStatus === 'audit_available'
  )
}

function canInspectSecretPolicy(
  record: SecretManagementRecord,
  permissionGranted = true
) {
  return (
    permissionGranted &&
    record.outcome === 'ready' &&
    record.capabilities.includes('policy') &&
    record.auditStatus === 'audit_available'
  )
}

function migrationSourceProviderId(record: SecretManagementRecord) {
  return record.providerKind === 'local-encrypted-store'
    ? 'local'
    : record.sourceId
}

function createSecretOperationId(
  kind:
    | 'decommission'
    | 'restore'
    | 'rotate'
    | 'rollback'
    | 'retire'
    | 'migration'
    | 'bulk-migration'
    | 'create'
) {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `serviceadmin-${kind}-${randomPart}`
}

type RotationUiFailureKind =
  | 'contract_incompatible'
  | 'authentication_required'
  | 'permission_denied'
  | 'audit_unavailable'
  | 'unsupported'
  | 'plan_blocked'

class RotationUiFailure extends Error {
  readonly kind: RotationUiFailureKind

  constructor(kind: RotationUiFailureKind) {
    super(kind)
    this.name = 'RotationUiFailure'
    this.kind = kind
  }
}

function rotationFailureCopy(error: unknown, fallback: string) {
  const kind =
    error instanceof RotationUiFailure
      ? error.kind
      : isRuntimeApiUnavailableError(error)
        ? error.details.status === 401
          ? 'authentication_required'
          : error.details.status === 403
            ? 'permission_denied'
            : [
                  'broker_contract_invalid',
                  'rotation_plan_invalid',
                  'rotation_state_invalid',
                ].includes(error.details.errorCode ?? '')
              ? 'contract_incompatible'
              : ['audit_unavailable', 'broker_audit_unavailable'].includes(
                    error.details.errorCode ?? ''
                  )
                ? 'audit_unavailable'
                : ['unsupported', 'rotation_unsupported'].includes(
                      error.details.errorCode ?? ''
                    )
                  ? 'unsupported'
                  : null
        : error instanceof Error &&
            /Core returned invalid rotation/i.test(error.message)
          ? 'contract_incompatible'
          : null

  if (kind === 'contract_incompatible') {
    return 'Core returned incompatible rotation metadata. Keep the exact Admin and Core versions aligned before retrying.'
  }
  if (kind === 'authentication_required') {
    return 'Rotation requires an authenticated local operator session. Re-authenticate, then request a fresh plan.'
  }
  if (kind === 'permission_denied') {
    return 'Rotation was denied by operator permission or provider policy. No version transition was attempted.'
  }
  if (kind === 'audit_unavailable') {
    return 'Rotation audit storage is unavailable. Mutation remains fail-closed until audit readiness is restored.'
  }
  if (kind === 'unsupported') {
    return 'This provider does not support audited version rotation. No mutation is available for this secret.'
  }
  if (kind === 'plan_blocked') {
    return 'Core blocked this rotation plan because a declared consumer action is unresolved. Update the service policy, then request a fresh plan.'
  }
  return fallback
}

function rotationActionLabel(
  service: CoreSecretRotationImpactPlan['services'][number]
) {
  if (service.action === 'restart') return 'Restart service'
  if (service.action === 'reload') return 'Reload service'
  if (service.action === 'action') {
    return service.actionId ? `Run ${service.actionId}` : 'Named action missing'
  }
  if (service.action === 'manual') return 'Manual operator action'
  return 'No runtime action'
}

function rotationSafeNextAction(operation: CoreSecretRotationExecutionState) {
  if (operation.outcome === 'committed') {
    return 'Verify linked service health; the previous version remains retained.'
  }
  if (operation.outcome === 'rolled_back') {
    return 'Inspect the failed consumer, correct readiness, then request a fresh impact plan.'
  }
  if (operation.outcome === 'blocked') {
    return 'Do not replay the mutation. Inspect the safe failure code and recover the durable Core operation.'
  }
  if (operation.phase === 'rolling_back') {
    return 'Wait for Core to finish automatic rollback; do not retry the mutation.'
  }
  return 'Wait for Core to reach a terminal phase; this view refreshes from the durable operation.'
}

function SecretOutcomeBadge({ outcome }: { outcome: string }) {
  if (outcome === 'ready') {
    return <Badge className='bg-emerald-600 hover:bg-emerald-600'>ready</Badge>
  }

  if (
    outcome === 'policy_denied' ||
    outcome === 'source_auth_required' ||
    outcome === 'locked' ||
    outcome === 'audit_unavailable'
  ) {
    return <Badge variant='destructive'>{outcome}</Badge>
  }

  return <Badge variant='secondary'>{outcome}</Badge>
}

export function SecretsBrokerSecretsPanel({
  rotationOperationId: requestedRotationOperationId,
  onRotationOperationChange,
}: {
  rotationOperationId?: string
  onRotationOperationChange: (operationId: string | undefined) => void
}) {
  const identity = useRuntimeIdentity()
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryProvider, setInventoryProvider] = useState('all')
  const [inventoryOutcome, setInventoryOutcome] = useState('all')
  const [inventoryPage, setInventoryPage] = useState(1)
  const [inventoryPageSize, setInventoryPageSize] = useState(5)
  const [providerStatusRevalidating, setProviderStatusRevalidating] =
    useState(false)
  const secretsQuery = useSecretsManagement(inventorySearch.trim())
  const servicesQuery = useServices()
  const refetchLinkedServices = servicesQuery.refetch
  const providerQuery = useBrokerProviderStatus()
  const providerStatusUnavailable =
    providerStatusRevalidating || providerQuery.isError
  const previewMigration = useBrokerMigrationPreview()
  const applyMigration = useBrokerMigrationApply()
  const createBulkCampaign = useBrokerBulkCampaignCreate()
  const revalidateBulkCampaign = useBrokerBulkCampaignRevalidate()
  const applyBulkCampaign = useBrokerBulkCampaignApply()
  const revealSecret = useSecretReveal()
  const previewCreate = useSecretCreatePreview()
  const applyCreate = useSecretCreateApply()
  const previewMutation = useSecretMutationPreview()
  const applyMutation = useSecretMutationApply()
  const previewDecommission = useSecretDecommissionPreview()
  const applyDecommission = useSecretDecommissionApply()
  const restoreDecommission = useSecretDecommissionRestore()
  const previewRotation = useSecretRotationPreview()
  const runRotationAction = useSecretRotationVersionAction()
  const coreRotationPlan = useCoreSecretRotationPlan()
  const [rotationSubmissionInFlight, setRotationSubmissionInFlight] =
    useState(false)
  const coreRotationOperation = useCoreSecretRotationOperation(
    requestedRotationOperationId,
    !rotationSubmissionInFlight
  )
  const coreRotationExecution = useCoreSecretRotationExecution()
  const previewPolicy = useSecretPolicyPreview()
  const [selectedSecret, setSelectedSecret] =
    useState<SecretManagementRecord | null>(null)
  const [auditReason, setAuditReason] = useState('')
  const [revealConfirmed, setRevealConfirmed] = useState(false)
  const [revealedSecret, setRevealedSecret] = useState<{
    result: SecretRevealResult
    expiresAt: number
  } | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createRef, setCreateRef] = useState('')
  const [createOperationId, setCreateOperationId] = useState('')
  const [createGenerationMode, setCreateGenerationMode] =
    useState<SecretCreateGenerationMode>('broker_generated')
  const [createReason, setCreateReason] = useState('')
  const [createValue, setCreateValue] = useState('')
  const [createConfirmed, setCreateConfirmed] = useState(false)
  const [createPlan, setCreatePlan] = useState<SecretCreateResult | null>(null)
  const [createReceipt, setCreateReceipt] = useState<SecretCreateResult | null>(
    null
  )
  const [createError, setCreateError] = useState<string | null>(null)
  const [mutationTarget, setMutationTarget] = useState<{
    record: SecretManagementRecord
    operation: SecretMutationOperation
  } | null>(null)
  const [mutationReason, setMutationReason] = useState('')
  const [replacementValue, setReplacementValue] = useState('')
  const [mutationConfirmed, setMutationConfirmed] = useState(false)
  const [mutationPlan, setMutationPlan] = useState<SecretMutationResult | null>(
    null
  )
  const [mutationReceipt, setMutationReceipt] =
    useState<SecretMutationResult | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [decommissionTarget, setDecommissionTarget] =
    useState<SecretManagementRecord | null>(null)
  const [decommissionOperationId, setDecommissionOperationId] = useState('')
  const [decommissionReason, setDecommissionReason] = useState('')
  const [decommissionConfirmed, setDecommissionConfirmed] = useState(false)
  const [restoreConfirmed, setRestoreConfirmed] = useState(false)
  const [decommissionPlan, setDecommissionPlan] =
    useState<SecretDecommissionResult | null>(null)
  const [decommissionReceipt, setDecommissionReceipt] =
    useState<SecretDecommissionResult | null>(null)
  const [decommissionError, setDecommissionError] = useState<string | null>(
    null
  )
  const [rotationTarget, setRotationTarget] =
    useState<SecretManagementRecord | null>(null)
  const [rotationOperationId, setRotationOperationId] = useState('')
  const dismissedRotationOperationId = useRef<string | null>(null)
  const [rotationReason, setRotationReason] = useState('')
  const [rotationValue, setRotationValue] = useState('')
  const [rotationConfirmed, setRotationConfirmed] = useState(false)
  const [rotationPreview, setRotationPreview] =
    useState<SecretRotationPreviewResult | null>(null)
  const [rotationStatus, setRotationStatus] =
    useState<SecretRotationVersionResult | null>(null)
  const [rotationReceipt, setRotationReceipt] =
    useState<SecretRotationVersionResult | null>(null)
  const [rotationImpactPlan, setRotationImpactPlan] =
    useState<CoreSecretRotationImpactPlan | null>(null)
  const [rotationExecution, setRotationExecution] =
    useState<CoreSecretRotationExecutionState | null>(null)
  const [rotationError, setRotationError] = useState<string | null>(null)
  const [rotationRecoveryError, setRotationRecoveryError] = useState<
    string | null
  >(null)
  const [policyTarget, setPolicyTarget] =
    useState<SecretManagementRecord | null>(null)
  const [policyPreview, setPolicyPreview] =
    useState<SecretPolicyPreviewResult | null>(null)
  const [policyError, setPolicyError] = useState<string | null>(null)
  const [migrationTarget, setMigrationTarget] =
    useState<SecretManagementRecord | null>(null)
  const [migrationTargetProviderId, setMigrationTargetProviderId] = useState('')
  const [migrationOperationId, setMigrationOperationId] = useState('')
  const [migrationReason, setMigrationReason] = useState('')
  const [migrationConfirmed, setMigrationConfirmed] = useState(false)
  const [migrationRevalidated, setMigrationRevalidated] = useState(false)
  const [migrationPreview, setMigrationPreview] =
    useState<BrokerMigrationResult | null>(null)
  const [migrationReceipt, setMigrationReceipt] =
    useState<BrokerMigrationResult | null>(null)
  const [migrationError, setMigrationError] = useState<string | null>(null)
  const [bulkCampaignOpen, setBulkCampaignOpen] = useState(false)
  const [bulkCampaignRefs, setBulkCampaignRefs] = useState<string[]>([])
  const [bulkCampaignTargetProviderId, setBulkCampaignTargetProviderId] =
    useState('')
  const [bulkCampaignOperationId, setBulkCampaignOperationId] = useState('')
  const [bulkCampaignReason, setBulkCampaignReason] = useState('')
  const [bulkCampaignConfirmed, setBulkCampaignConfirmed] = useState(false)
  const [bulkCampaignPlan, setBulkCampaignPlan] =
    useState<BrokerBulkCampaignResult | null>(null)
  const [bulkCampaignReceipt, setBulkCampaignReceipt] =
    useState<BrokerBulkCampaignResult | null>(null)
  const [bulkCampaignError, setBulkCampaignError] = useState<string | null>(
    null
  )
  const canManageSecrets = Boolean(
    identity.data?.permissions.includes('*') ||
    identity.data?.permissions.includes('security:manage')
  )
  const records = useMemo(
    () => secretsQuery.data?.results ?? [],
    [secretsQuery.data?.results]
  )
  const linkedServiceHealth = useMemo(
    () =>
      new Map(
        (servicesQuery.data ?? []).map((service) => [service.id, service])
      ),
    [servicesQuery.data]
  )
  const inventoryProviders = useMemo(
    () => [...new Set(records.map((record) => record.sourceId))].sort(),
    [records]
  )
  const inventoryOutcomes = useMemo(
    () => [...new Set(records.map((record) => record.outcome))].sort(),
    [records]
  )
  const bulkCampaignCandidates = useMemo(
    () =>
      records.filter(
        (record) =>
          record.outcome === 'ready' &&
          record.providerKind === 'local-encrypted-store'
      ),
    [records]
  )
  const executableMigrationProviders = useMemo(
    () =>
      (providerQuery.data?.providers ?? []).filter(
        providerSupportsMigrationApply
      ),
    [providerQuery.data?.providers]
  )
  const filteredRecords = useMemo(() => {
    const query = inventorySearch.trim().toLowerCase()
    return records.filter((record) => {
      const matchesSearch =
        query.length === 0 ||
        [
          record.ref,
          record.name,
          record.sourceId,
          record.providerKind,
          record.ownerServiceId,
          record.outcome,
          record.state,
        ].some((value) => value?.toLowerCase().includes(query))
      return (
        matchesSearch &&
        (inventoryProvider === 'all' ||
          record.sourceId === inventoryProvider) &&
        (inventoryOutcome === 'all' || record.outcome === inventoryOutcome)
      )
    })
  }, [records, inventoryOutcome, inventoryProvider, inventorySearch])
  const inventoryPageCount = Math.max(
    1,
    Math.ceil(filteredRecords.length / inventoryPageSize)
  )
  const visibleRecords = filteredRecords.slice(
    (inventoryPage - 1) * inventoryPageSize,
    inventoryPage * inventoryPageSize
  )

  useEffect(() => {
    setInventoryPage(1)
  }, [inventoryOutcome, inventoryPageSize, inventoryProvider, inventorySearch])

  useEffect(() => {
    setInventoryPage((current) => Math.min(current, inventoryPageCount))
  }, [inventoryPageCount])

  useEffect(() => {
    if (requestedRotationOperationId !== dismissedRotationOperationId.current) {
      dismissedRotationOperationId.current = null
    }
  }, [requestedRotationOperationId])

  useEffect(() => {
    const operation = coreRotationOperation.data
    if (
      !requestedRotationOperationId ||
      !operation ||
      operation.operationId !== requestedRotationOperationId ||
      dismissedRotationOperationId.current === requestedRotationOperationId
    ) {
      return
    }
    const record = records.find((candidate) => candidate.ref === operation.ref)
    if (!record) {
      if (!secretsQuery.isFetching) {
        setRotationRecoveryError(
          'The durable rotation operation exists, but its secret is not in the current Broker inventory.'
        )
      }
      return
    }
    if (
      rotationExecution?.updatedAt === operation.updatedAt &&
      rotationTarget?.ref === record.ref
    ) {
      return
    }
    setRotationRecoveryError(null)
    setRotationTarget(record)
    setRotationOperationId(operation.operationId)
    setRotationImpactPlan(operation.plan)
    setRotationExecution(operation)
    setRotationValue('')
    setRotationConfirmed(false)
    void refetchLinkedServices()
  }, [
    coreRotationOperation.data,
    records,
    requestedRotationOperationId,
    rotationExecution?.updatedAt,
    rotationTarget?.ref,
    secretsQuery.isFetching,
    refetchLinkedServices,
  ])

  useEffect(() => {
    if (!coreRotationOperation.error) return
    setRotationRecoveryError(
      rotationFailureCopy(
        coreRotationOperation.error,
        isRuntimeApiUnavailableError(coreRotationOperation.error) &&
          coreRotationOperation.error.details.status === 404
          ? 'The durable Core rotation operation was not found. Start a new rotation from a fresh impact plan.'
          : 'The durable Core rotation operation is temporarily unavailable. No mutation was replayed.'
      )
    )
  }, [coreRotationOperation.error])

  useEffect(() => {
    if (!revealedSecret) return

    const timeout = window.setTimeout(
      () => {
        setRevealedSecret(null)
      },
      Math.max(1, revealedSecret.result.ttlSeconds) * 1000
    )

    return () => window.clearTimeout(timeout)
  }, [revealedSecret])

  const clearCreateState = () => {
    setCreateOpen(false)
    setCreateRef('')
    setCreateOperationId('')
    setCreateGenerationMode('broker_generated')
    setCreateReason('')
    setCreateValue('')
    setCreateConfirmed(false)
    setCreatePlan(null)
    setCreateReceipt(null)
    setCreateError(null)
    previewCreate.reset()
    applyCreate.reset()
  }

  const openCreate = () => {
    clearCreateState()
    setCreateOperationId(createSecretOperationId('create'))
    setCreateOpen(true)
  }

  const closeCreate = (open: boolean) => {
    if (!open) clearCreateState()
  }

  const runCreatePreview = async () => {
    const ref = createRef.trim()
    if (!/^[A-Za-z0-9@._-]+(?:\/[A-Za-z0-9@._-]+)*$/.test(ref)) {
      setCreateError('Enter a canonical, relative secret reference.')
      return
    }
    if (!createReason.trim()) {
      setCreateError('Audit reason is required before create preview.')
      return
    }
    setCreateError(null)
    setCreateReceipt(null)
    setCreateConfirmed(false)
    setCreateValue('')
    try {
      const result = await previewCreate.mutateAsync({
        ref,
        operationId: createOperationId,
        generationMode: createGenerationMode,
        reason: createReason.trim(),
      })
      if (
        result.outcome !== 'dry_run_ready' ||
        result.applied ||
        !result.requiresConfirmation ||
        result.auditStatus !== 'audit_recorded' ||
        result.policyResult !== 'allowed' ||
        !result.plan
      ) {
        throw new Error('Create plan was not safely executable.')
      }
      setCreatePlan(result)
    } catch {
      setCreatePlan(null)
      setCreateError(
        'The Broker did not return a fresh signed no-overwrite create plan.'
      )
    }
  }

  const runCreateApply = async () => {
    if (!createPlan?.plan || !createConfirmed) return
    if (createGenerationMode === 'operator_supplied' && !createValue.trim()) {
      setCreateError('Enter the secret value for operator-supplied create.')
      return
    }
    setCreateError(null)
    try {
      const result = await applyCreate.mutateAsync({
        ref: createPlan.ref,
        operationId: createOperationId,
        generationMode: createGenerationMode,
        reason: createReason.trim(),
        value:
          createGenerationMode === 'operator_supplied'
            ? createValue
            : undefined,
        plan: createPlan.plan,
      })
      if (
        !['applied', 'already_applied'].includes(result.outcome) ||
        result.auditStatus !== 'audit_recorded' ||
        result.policyResult !== 'allowed'
      ) {
        throw new Error('Create did not return an accepted receipt.')
      }
      setCreateReceipt(result)
      setCreatePlan(null)
      setCreateConfirmed(false)
    } catch {
      setCreatePlan(null)
      setCreateConfirmed(false)
      setCreateError(
        'The Broker did not create the secret. No-overwrite and audit controls failed closed; refresh inventory before retrying.'
      )
    } finally {
      setCreateValue('')
    }
  }

  const openReveal = (record: SecretManagementRecord) => {
    setSelectedSecret(record)
    setAuditReason('')
    setRevealConfirmed(false)
    setRevealedSecret(null)
    setLocalError(null)
  }

  const openPolicy = async (record: SecretManagementRecord) => {
    setPolicyTarget(record)
    setPolicyPreview(null)
    setPolicyError(null)
    previewPolicy.reset()
    try {
      const result = await previewPolicy.mutateAsync({ ref: record.ref })
      if (
        result.outcome !== 'unsupported' ||
        result.applied ||
        result.unsupportedCapability !== 'policy_binding_persistence'
      ) {
        throw new Error('Policy capability was reported inconsistently.')
      }
      setPolicyPreview(result)
    } catch {
      setPolicyPreview(null)
      setPolicyError(
        'The broker could not provide a safe policy capability preview.'
      )
    }
  }

  const closePolicy = (open: boolean) => {
    if (open) return
    setPolicyTarget(null)
    setPolicyPreview(null)
    setPolicyError(null)
    previewPolicy.reset()
  }

  const closeMigration = (open: boolean) => {
    if (open) return
    setMigrationTarget(null)
    setMigrationTargetProviderId('')
    setMigrationOperationId('')
    setMigrationReason('')
    setMigrationConfirmed(false)
    setMigrationRevalidated(false)
    setMigrationPreview(null)
    setMigrationReceipt(null)
    setMigrationError(null)
    previewMigration.reset()
    applyMigration.reset()
  }

  const openMigration = (record: SecretManagementRecord) => {
    closeMigration(false)
    const sourceProviderId = migrationSourceProviderId(record)
    const target = providerQuery.data?.providers.find(
      (provider) =>
        provider.providerId !== sourceProviderId && provider.outcome === 'ready'
    )
    setMigrationTarget(record)
    setMigrationTargetProviderId(target?.providerId ?? '')
    setMigrationOperationId(createSecretOperationId('migration'))
  }

  const selectedMigrationProvider = providerQuery.data?.providers.find(
    (provider) => provider.providerId === migrationTargetProviderId
  )
  const migrationApplyExecutable = Boolean(
    selectedMigrationProvider &&
    providerSupportsMigrationApply(selectedMigrationProvider)
  )
  const migrationApplyGate = migrationApplyBlocked({
    target: selectedMigrationProvider,
    revalidated: migrationRevalidated,
    confirmed: migrationConfirmed,
  })

  const clearBulkCampaign = () => {
    setBulkCampaignOpen(false)
    setBulkCampaignRefs([])
    setBulkCampaignTargetProviderId('')
    setBulkCampaignOperationId('')
    setBulkCampaignReason('')
    setBulkCampaignConfirmed(false)
    setBulkCampaignPlan(null)
    setBulkCampaignReceipt(null)
    setBulkCampaignError(null)
    createBulkCampaign.reset()
    revalidateBulkCampaign.reset()
    applyBulkCampaign.reset()
  }

  const openBulkCampaign = () => {
    clearBulkCampaign()
    setBulkCampaignOperationId(createSecretOperationId('bulk-migration'))
    setBulkCampaignTargetProviderId(
      executableMigrationProviders[0]?.providerId ?? ''
    )
    setBulkCampaignOpen(true)
  }

  const closeBulkCampaign = (open: boolean) => {
    if (!open) clearBulkCampaign()
  }

  const toggleBulkCampaignRef = (ref: string, selected: boolean) => {
    setBulkCampaignRefs((current) =>
      selected
        ? [...new Set([...current, ref])].sort()
        : current.filter((candidate) => candidate !== ref)
    )
    setBulkCampaignPlan(null)
    setBulkCampaignReceipt(null)
    setBulkCampaignConfirmed(false)
    setBulkCampaignError(null)
  }

  const buildBulkCampaignRequest = (
    result?: BrokerBulkCampaignResult,
    confirm = false
  ) => ({
    campaignId: result?.campaignId,
    planToken: result?.planToken,
    operationId: bulkCampaignOperationId,
    operation: 'migrate_remap_provider' as const,
    refs: bulkCampaignRefs,
    targetProviderId: bulkCampaignTargetProviderId,
    reason: bulkCampaignReason.trim(),
    confirm,
    highRiskConfirm: confirm ? result?.campaignId : undefined,
  })

  const runBulkCampaignPreview = async () => {
    if (
      !bulkCampaignRefs.length ||
      !bulkCampaignTargetProviderId ||
      !bulkCampaignReason.trim()
    ) {
      setBulkCampaignError(
        'Select at least one local secret, an executable target, and an audit reason.'
      )
      return
    }
    setBulkCampaignError(null)
    setBulkCampaignReceipt(null)
    setBulkCampaignConfirmed(false)
    try {
      const created = await createBulkCampaign.mutateAsync(
        buildBulkCampaignRequest()
      )
      if (
        !['dry_run_ready', 'partial_failure'].includes(created.outcome) ||
        created.applied ||
        !created.requiresRevalidation ||
        created.auditStatus !== 'audit_recorded' ||
        !created.durable ||
        created.maxConcurrency !== 1
      ) {
        throw new Error('Campaign creation did not return a durable plan.')
      }
      const revalidated = await revalidateBulkCampaign.mutateAsync(
        buildBulkCampaignRequest(created)
      )
      if (
        !['dry_run_ready', 'partial_failure'].includes(revalidated.outcome) ||
        revalidated.applied ||
        revalidated.requiresRevalidation ||
        revalidated.auditStatus !== 'audit_recorded' ||
        revalidated.planToken !== created.planToken ||
        revalidated.campaignId !== created.campaignId
      ) {
        throw new Error('Campaign revalidation did not converge.')
      }
      setBulkCampaignPlan(revalidated)
    } catch {
      setBulkCampaignPlan(null)
      setBulkCampaignError(
        'The Broker did not return a fresh durable campaign. No provider write was attempted.'
      )
    }
  }

  const runBulkCampaignRevalidate = async () => {
    if (!bulkCampaignPlan) return
    setBulkCampaignError(null)
    setBulkCampaignConfirmed(false)
    try {
      const result = await revalidateBulkCampaign.mutateAsync(
        buildBulkCampaignRequest(bulkCampaignPlan)
      )
      if (
        !['dry_run_ready', 'partial_failure'].includes(result.outcome) ||
        result.requiresRevalidation ||
        result.auditStatus !== 'audit_recorded'
      ) {
        throw new Error('Campaign revalidation failed.')
      }
      setBulkCampaignPlan(result)
    } catch {
      setBulkCampaignError(
        'Campaign revalidation failed closed. Create a new plan if provider readiness changed.'
      )
    }
  }

  const runBulkCampaignApply = async () => {
    if (!bulkCampaignPlan || !bulkCampaignConfirmed) return
    setBulkCampaignError(null)
    try {
      const result = await applyBulkCampaign.mutateAsync(
        buildBulkCampaignRequest(bulkCampaignPlan, true)
      )
      if (
        !['applied', 'partial_failure'].includes(result.outcome) ||
        result.auditStatus !== 'audit_recorded' ||
        result.requiresRevalidation ||
        result.results.some((item) => item.applied && !item.verified)
      ) {
        throw new Error('Campaign apply did not return verified outcomes.')
      }
      setBulkCampaignReceipt(result)
      setBulkCampaignPlan(null)
      setBulkCampaignConfirmed(false)
    } catch {
      setBulkCampaignConfirmed(false)
      setBulkCampaignError(
        'Campaign apply failed closed or requires revalidation. Source secrets remain authoritative; inspect each metadata-only result before retrying.'
      )
    }
  }

  const runMigrationPreview = async () => {
    if (!migrationTarget || !migrationTargetProviderId) return
    if (!migrationReason.trim()) {
      setMigrationError('Audit reason is required before migration preview.')
      return
    }
    setMigrationError(null)
    setMigrationReceipt(null)
    setMigrationConfirmed(false)
    setMigrationRevalidated(false)
    try {
      const result = await previewMigration.mutateAsync({
        operationId: migrationOperationId,
        sourceProviderId: migrationSourceProviderId(migrationTarget),
        targetProviderId: migrationTargetProviderId,
        refs: [migrationTarget.ref],
        reason: migrationReason,
      })
      if (
        result.outcome !== 'dry_run_ready' ||
        result.applied ||
        !result.requiresConfirmation ||
        result.auditStatus !== 'audit_recorded' ||
        result.results.length !== 1 ||
        result.results[0]?.outcome !== 'dry_run_ready'
      ) {
        throw new Error('Migration preview was not safely executable.')
      }
      setMigrationPreview(result)
    } catch {
      setMigrationPreview(null)
      setMigrationRevalidated(false)
      setMigrationError(
        'The broker did not return a safe migration plan. Revalidate provider readiness and audit state.'
      )
    }
  }

  const runMigrationRevalidate = async () => {
    if (!migrationTarget || !migrationPreview) return
    setMigrationError(null)
    setMigrationConfirmed(false)
    try {
      const result = await previewMigration.mutateAsync({
        operationId: migrationOperationId,
        sourceProviderId: migrationSourceProviderId(migrationTarget),
        targetProviderId: migrationTargetProviderId,
        refs: [migrationTarget.ref],
        reason: migrationReason,
      })
      if (
        result.applied ||
        result.auditStatus !== 'audit_recorded' ||
        !migrationPlansMatch(migrationPreview.results, result.results)
      ) {
        throw new Error('Migration revalidation did not match the dry-run.')
      }
      setMigrationPreview(result)
      setMigrationRevalidated(true)
    } catch {
      setMigrationRevalidated(false)
      setMigrationError(
        'Fresh revalidation failed closed. Source data remains authoritative; preview again after provider readiness is stable.'
      )
    }
  }

  const runMigrationApply = async () => {
    if (
      !migrationTarget ||
      !migrationPreview ||
      !migrationApplyExecutable ||
      !migrationRevalidated ||
      !migrationConfirmed
    )
      return
    setMigrationError(null)
    try {
      const result = await applyMigration.mutateAsync({
        operationId: migrationOperationId,
        sourceProviderId: migrationSourceProviderId(migrationTarget),
        targetProviderId: migrationTargetProviderId,
        refs: [migrationTarget.ref],
        reason: migrationReason,
        revalidated: true,
        planRequestId: migrationPreview.requestId,
      })
      if (
        result.outcome === 'stale_plan' ||
        result.results.some((item) => item.outcome === 'stale')
      ) {
        setMigrationReceipt(result)
        setMigrationPreview(null)
        setMigrationRevalidated(false)
        setMigrationConfirmed(false)
        setMigrationError(
          'The Broker plan is stale. Source data remains authoritative; preview and revalidate before apply.'
        )
        return
      }
      if (
        !['applied', 'partial_failure'].includes(result.outcome) ||
        result.auditStatus !== 'audit_recorded'
      ) {
        throw new Error('Migration apply did not return a terminal outcome.')
      }
      setMigrationReceipt(result)
      setMigrationPreview(null)
      setMigrationConfirmed(false)
      setMigrationRevalidated(false)
    } catch {
      setMigrationConfirmed(false)
      setMigrationRevalidated(false)
      setMigrationError(
        'The broker did not complete the migration. Source data remains authoritative; follow the metadata-only recovery guidance.'
      )
    }
  }

  const closeReveal = (open: boolean) => {
    if (open) return
    setSelectedSecret(null)
    setAuditReason('')
    setRevealConfirmed(false)
    setRevealedSecret(null)
    setLocalError(null)
  }

  const runReveal = async () => {
    if (!selectedSecret) return

    const reason = auditReason.trim()
    if (!reason) {
      setLocalError('Audit reason is required before reveal.')
      setRevealedSecret(null)
      return
    }
    if (!revealConfirmed) {
      setLocalError('Explicit confirmation is required before reveal.')
      setRevealedSecret(null)
      return
    }

    setLocalError(null)
    try {
      const result = await revealSecret.mutateAsync({
        ref: selectedSecret.ref,
        reason,
        confirm: true,
      })
      setRevealedSecret({
        result,
        expiresAt: Date.now() + Math.max(1, result.ttlSeconds) * 1000,
      })
    } catch (error) {
      setRevealedSecret(null)
      setLocalError(
        error instanceof Error ? error.message : 'Secret reveal failed.'
      )
    }
  }

  const clearMutationState = () => {
    setMutationTarget(null)
    setMutationReason('')
    setReplacementValue('')
    setMutationConfirmed(false)
    setMutationPlan(null)
    setMutationReceipt(null)
    setMutationError(null)
    previewMutation.reset()
    applyMutation.reset()
  }

  const openMutation = (
    record: SecretManagementRecord,
    operation: SecretMutationOperation
  ) => {
    clearMutationState()
    setMutationTarget({ record, operation })
  }

  const closeMutation = (open: boolean) => {
    if (!open) clearMutationState()
  }

  const runMutationPreview = async () => {
    if (!mutationTarget) return
    if (!mutationReason.trim()) {
      setMutationError('Audit reason is required before mutation.')
      return
    }

    setMutationError(null)
    setMutationReceipt(null)
    setMutationConfirmed(false)
    try {
      const result = await previewMutation.mutateAsync({
        operation: mutationTarget.operation,
        ref: mutationTarget.record.ref,
        reason: mutationReason,
      })
      if (
        result.outcome !== 'dry_run_ready' ||
        !result.requiresConfirmation ||
        result.auditStatus !== 'audit_ready'
      ) {
        throw new Error('Mutation plan was not ready.')
      }
      setMutationPlan(result)
    } catch {
      setMutationPlan(null)
      setMutationError(
        'The broker did not return a confirmable metadata-only mutation plan.'
      )
    }
  }

  const runMutationApply = async () => {
    if (!mutationTarget || !mutationPlan) return
    if (!mutationConfirmed) {
      setMutationError('Explicit confirmation is required before apply.')
      return
    }
    if (!replacementValue.trim()) {
      setMutationError('A replacement value is required before apply.')
      return
    }

    setMutationError(null)
    setMutationReceipt(null)
    try {
      const result = await applyMutation.mutateAsync({
        operation: mutationTarget.operation,
        ref: mutationTarget.record.ref,
        reason: mutationReason,
        value: replacementValue,
      })
      if (
        result.outcome !== 'applied' ||
        !result.applied ||
        result.auditStatus !== 'audit_recorded'
      ) {
        throw new Error('Mutation was not applied.')
      }
      setMutationReceipt(result)
      setMutationPlan(null)
      setMutationConfirmed(false)
    } catch {
      setMutationPlan(null)
      setMutationConfirmed(false)
      setMutationError(
        'The broker did not apply the mutation. Review broker audit and readiness state.'
      )
    } finally {
      setReplacementValue('')
    }
  }

  const clearDecommissionState = () => {
    setDecommissionTarget(null)
    setDecommissionOperationId('')
    setDecommissionReason('')
    setDecommissionConfirmed(false)
    setRestoreConfirmed(false)
    setDecommissionPlan(null)
    setDecommissionReceipt(null)
    setDecommissionError(null)
    previewDecommission.reset()
    applyDecommission.reset()
    restoreDecommission.reset()
  }

  const openDecommission = (record: SecretManagementRecord) => {
    clearDecommissionState()
    setDecommissionTarget(record)
    setDecommissionOperationId(createSecretOperationId('decommission'))
  }

  const openTombstoneRestore = (record: SecretManagementRecord) => {
    if (!record.tombstone) return
    clearDecommissionState()
    setDecommissionTarget(record)
    setDecommissionOperationId(createSecretOperationId('restore'))
    setDecommissionReceipt({
      serviceId: '@secretsbroker',
      apiVersion: secretsQuery.data?.apiVersion ?? 'secretsbroker.local/v1',
      requestId: 'inventory-tombstone',
      operationId: record.tombstone.decommissionOperationId,
      ref: record.ref,
      operation: 'decommission',
      mode: 'apply',
      outcome: 'applied',
      applied: true,
      requiresConfirmation: false,
      auditStatus: record.auditStatus ?? 'audit_available',
      policyResult: 'allowed',
      dependencyStatus: 'clear',
      dependencies: [],
      recoverable: true,
      tombstone: record.tombstone,
      affectedRefs: [record.ref],
      affectedServices: record.ownerServiceId ? [record.ownerServiceId] : [],
    })
  }

  const closeDecommission = (open: boolean) => {
    if (!open) clearDecommissionState()
  }

  const runDecommissionPreview = async () => {
    if (!decommissionTarget) return
    setDecommissionError(null)
    setDecommissionReceipt(null)
    setDecommissionConfirmed(false)
    try {
      const result = await previewDecommission.mutateAsync({
        ref: decommissionTarget.ref,
        operationId: decommissionOperationId,
      })
      if (
        result.outcome !== 'dry_run_ready' ||
        result.dependencyStatus !== 'clear' ||
        result.dependencies.length !== 0 ||
        !result.requiresConfirmation ||
        result.policyResult !== 'allowed' ||
        result.auditStatus !== 'audit_recorded' ||
        !result.plan
      ) {
        throw new Error('Decommission plan is not safely executable.')
      }
      setDecommissionPlan(result)
    } catch {
      setDecommissionPlan(null)
      setDecommissionError(
        'The broker did not return a dependency-clear, signed decommission plan. Resolve consumers, audit availability, and broker readiness before retrying.'
      )
    }
  }

  const runDecommissionApply = async () => {
    if (!decommissionTarget || !decommissionPlan?.plan) return
    if (!decommissionReason.trim()) {
      setDecommissionError('Audit reason is required before decommission.')
      return
    }
    if (!decommissionConfirmed) {
      setDecommissionError(
        'Explicit confirmation is required before decommission.'
      )
      return
    }

    setDecommissionError(null)
    try {
      const result = await applyDecommission.mutateAsync({
        ref: decommissionTarget.ref,
        operationId: decommissionOperationId,
        reason: decommissionReason,
        plan: decommissionPlan.plan,
      })
      if (
        result.outcome !== 'applied' ||
        !result.applied ||
        result.auditStatus !== 'audit_recorded' ||
        result.tombstone?.state !== 'decommissioned' ||
        !result.recoverable
      ) {
        throw new Error('Decommission was not applied.')
      }
      setDecommissionReceipt(result)
      setDecommissionPlan(null)
      setDecommissionConfirmed(false)
      setRestoreConfirmed(false)
    } catch {
      setDecommissionPlan(null)
      setDecommissionConfirmed(false)
      setDecommissionError(
        'The broker did not decommission this secret. Refresh metadata and inspect the safe broker audit outcome before retrying.'
      )
    }
  }

  const runDecommissionRestore = async () => {
    if (!decommissionTarget || !decommissionReceipt?.tombstone) return
    if (!decommissionReason.trim()) {
      setDecommissionError('Audit reason is required before restore.')
      return
    }
    if (!restoreConfirmed) {
      setDecommissionError('Explicit confirmation is required before restore.')
      return
    }

    setDecommissionError(null)
    try {
      const result = await restoreDecommission.mutateAsync({
        ref: decommissionTarget.ref,
        operationId: createSecretOperationId('restore'),
        reason: decommissionReason,
        expectedVersion: decommissionReceipt.tombstone.version,
      })
      if (
        result.outcome !== 'applied' ||
        !result.applied ||
        result.auditStatus !== 'audit_recorded' ||
        result.tombstone?.state !== 'restored'
      ) {
        throw new Error('Restore was not applied.')
      }
      setDecommissionReceipt(result)
      setRestoreConfirmed(false)
    } catch {
      setRestoreConfirmed(false)
      setDecommissionError(
        'The broker did not restore this secret from its encrypted tombstone.'
      )
    }
  }

  const clearRotationState = () => {
    onRotationOperationChange(undefined)
    setRotationTarget(null)
    setRotationOperationId('')
    setRotationReason('')
    setRotationValue('')
    setRotationConfirmed(false)
    setRotationPreview(null)
    setRotationStatus(null)
    setRotationReceipt(null)
    setRotationImpactPlan(null)
    setRotationExecution(null)
    setRotationError(null)
    setRotationRecoveryError(null)
    previewRotation.reset()
    runRotationAction.reset()
    coreRotationPlan.reset()
    coreRotationExecution.reset()
  }

  const openRotation = (record: SecretManagementRecord) => {
    clearRotationState()
    setRotationTarget(record)
    setRotationOperationId(createSecretOperationId('rotate'))
  }

  const closeRotation = (open: boolean) => {
    if (!open) {
      dismissedRotationOperationId.current =
        requestedRotationOperationId ?? rotationOperationId
      clearRotationState()
    }
  }

  const runRotationPreview = async () => {
    if (!rotationTarget) return
    if (!rotationReason.trim()) {
      setRotationError('Audit reason is required before rotation preview.')
      return
    }

    setRotationError(null)
    setRotationReceipt(null)
    setRotationExecution(null)
    setRotationConfirmed(false)
    try {
      const impactPlan = await coreRotationPlan.mutateAsync(rotationTarget.ref)
      setRotationImpactPlan(impactPlan)
      if (impactPlan.status !== 'ready' || impactPlan.blockers.length > 0) {
        throw new RotationUiFailure('plan_blocked')
      }
      const preview = await previewRotation.mutateAsync({
        ref: rotationTarget.ref,
        operationId: rotationOperationId,
        reason: rotationReason,
      })
      const item = preview.results.find(
        (candidate) => candidate.ref === rotationTarget.ref
      )
      if (!item) throw new RotationUiFailure('contract_incompatible')
      if (
        preview.auditStatus !== 'audit_ready' ||
        item.auditRequirement !== 'required'
      ) {
        throw new RotationUiFailure('audit_unavailable')
      }
      if (item.capabilityResult !== 'supported') {
        throw new RotationUiFailure('unsupported')
      }
      if (item.policyResult !== 'allowed') {
        throw new RotationUiFailure('permission_denied')
      }
      if (
        preview.outcome !== 'dry_run_ready' ||
        !preview.requiresConfirmation ||
        item.outcome !== 'dry_run_ready'
      ) {
        throw new RotationUiFailure('contract_incompatible')
      }
      const status = await runRotationAction.mutateAsync({
        action: 'status',
        ref: rotationTarget.ref,
      })
      if (status.outcome !== 'ready' || !status.currentVersion?.versionId) {
        throw new Error('Rotation version status is unavailable.')
      }
      setRotationPreview(preview)
      setRotationStatus(status)
      setRotationImpactPlan(impactPlan)
    } catch (error) {
      setRotationPreview(null)
      setRotationStatus(null)
      if (
        !(error instanceof RotationUiFailure) ||
        error.kind !== 'plan_blocked'
      ) {
        setRotationImpactPlan(null)
      }
      setRotationError(
        rotationFailureCopy(
          error,
          'Core and the Broker did not return an executable, version-bound consumer impact plan. Resolve provider readiness before retrying.'
        )
      )
    }
  }

  const runRotationStage = async () => {
    if (!rotationTarget || !rotationPreview || !rotationStatus?.currentVersion)
      return
    if (!rotationValue.trim()) {
      setRotationError('A replacement value is required before stage.')
      return
    }
    if (!rotationConfirmed) {
      setRotationError('Explicit confirmation is required before stage.')
      return
    }

    setRotationError(null)
    try {
      if (rotationImpactPlan) {
        setRotationSubmissionInFlight(true)
        onRotationOperationChange(rotationOperationId)
        const operation = await coreRotationExecution.mutateAsync({
          operationId: rotationOperationId,
          ref: rotationTarget.ref,
          planFingerprint: rotationImpactPlan.planFingerprint,
          reason: rotationReason,
          confirm: true,
          value: rotationValue,
        })
        setRotationValue('')
        setRotationConfirmed(false)
        setRotationExecution(operation)
        setRotationImpactPlan(operation.plan)
        setProviderStatusRevalidating(true)
        try {
          await Promise.all([providerQuery.refetch(), refetchLinkedServices()])
        } finally {
          setProviderStatusRevalidating(false)
        }
        if (operation.outcome !== 'committed') {
          setRotationError(
            operation.outcome === 'rolled_back'
              ? 'Consumer convergence failed; Core restored the previous Broker version and service state.'
              : 'Rotation is blocked and requires operator recovery from the durable Core operation.'
          )
        }
        return
      }
      const result = await runRotationAction.mutateAsync({
        action: 'stage',
        ref: rotationTarget.ref,
        operationId: rotationOperationId,
        expectedCurrentVersion: rotationStatus.currentVersion.versionId,
        reason: rotationReason,
        value: rotationValue,
      })
      if (
        result.outcome !== 'staged' ||
        result.auditStatus !== 'audit_recorded' ||
        !result.stagedVersion?.versionId
      ) {
        throw new Error('Rotation candidate was not staged.')
      }
      setRotationReceipt(result)
      setRotationValue('')
      setRotationConfirmed(false)
    } catch (error) {
      setRotationValue('')
      setRotationConfirmed(false)
      setRotationError(
        rotationFailureCopy(
          error,
          rotationImpactPlan
            ? 'Core did not return a terminal rotation operation. The durable operation will be reloaded without replaying the mutation.'
            : 'The broker did not stage the candidate. Refresh status before retrying.'
        )
      )
    } finally {
      setRotationSubmissionInFlight(false)
    }
  }

  const runRotationActivate = async () => {
    if (
      !rotationTarget ||
      !rotationStatus?.currentVersion ||
      !rotationReceipt?.stagedVersion
    )
      return
    if (!rotationConfirmed) {
      setRotationError('Explicit confirmation is required before activation.')
      return
    }

    setRotationError(null)
    try {
      const result = await runRotationAction.mutateAsync({
        action: 'activate',
        ref: rotationTarget.ref,
        operationId: rotationOperationId,
        versionId: rotationReceipt.stagedVersion.versionId,
        expectedCurrentVersion: rotationStatus.currentVersion.versionId,
        reason: rotationReason,
      })
      if (
        result.outcome !== 'applied' ||
        !result.applied ||
        result.auditStatus !== 'audit_recorded' ||
        !result.previousVersion?.versionId
      ) {
        throw new Error('Rotation candidate was not activated.')
      }
      setRotationReceipt(result)
      setRotationStatus(result)
      setRotationConfirmed(false)
    } catch {
      setRotationConfirmed(false)
      setRotationError(
        'The broker did not activate the staged version. Inspect current version status before retrying.'
      )
    }
  }

  const runRotationPostAction = async (action: 'rollback' | 'retire') => {
    if (!rotationTarget || !rotationReceipt?.previousVersion?.versionId) return
    if (!rotationConfirmed) {
      setRotationError(`Explicit confirmation is required before ${action}.`)
      return
    }

    setRotationError(null)
    try {
      const result = await runRotationAction.mutateAsync({
        action,
        ref: rotationTarget.ref,
        operationId: createSecretOperationId(action),
        versionId: rotationReceipt.previousVersion.versionId,
        reason: rotationReason,
      })
      const expectedOutcome = action === 'rollback' ? 'rolled_back' : 'retired'
      if (
        result.outcome !== expectedOutcome ||
        !result.applied ||
        result.auditStatus !== 'audit_recorded'
      ) {
        throw new Error(`Rotation ${action} was not applied.`)
      }
      setRotationReceipt(result)
      setRotationStatus(result)
      setRotationConfirmed(false)
    } catch {
      setRotationConfirmed(false)
      setRotationError(
        `The broker did not ${action} the selected version. Refresh status before retrying.`
      )
    }
  }

  if (secretsQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Managed secrets</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className='h-32 w-full' />
        </CardContent>
      </Card>
    )
  }

  if (secretsQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Managed secrets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground'>
            <span>Secrets Broker management is unavailable.</span>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={secretsQuery.isFetching}
              onClick={() => void secretsQuery.refetch()}
            >
              <RefreshCw
                className={`mr-2 size-4 ${secretsQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Retry inventory
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {requestedRotationOperationId &&
      (coreRotationOperation.isLoading || rotationRecoveryError) ? (
        <Card>
          <CardHeader>
            <CardTitle>Durable rotation operation</CardTitle>
            <CardDescription>
              Rehydrating metadata-only state from Core. No mutation is
              replayed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {coreRotationOperation.isLoading ? (
              <Skeleton className='h-16 w-full' />
            ) : (
              <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                {rotationRecoveryError}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
      <SecretsBrokerProvidersPanel />

      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-4'>
          <div>
            <CardTitle>Managed secrets</CardTitle>
            <CardDescription>
              Metadata, capability state, and explicit audited actions.
            </CardDescription>
          </div>
          <div className='flex flex-wrap justify-end gap-2'>
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={
                !canManageSecrets ||
                !bulkCampaignCandidates.length ||
                !executableMigrationProviders.length
              }
              title={
                canManageSecrets
                  ? 'Build a durable, audited provider migration campaign'
                  : 'Security management permission is required'
              }
              onClick={openBulkCampaign}
            >
              Bulk provider migration
            </Button>
            <Button
              type='button'
              size='sm'
              disabled={!canManageSecrets}
              title={
                canManageSecrets
                  ? 'Create a new local encrypted secret'
                  : 'Security management permission is required'
              }
              onClick={openCreate}
            >
              <Plus className='mr-2 size-4' />
              Create secret
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='mb-4 grid gap-3 md:grid-cols-4'>
            <div className='space-y-1.5 md:col-span-2'>
              <Label htmlFor='secret-inventory-search'>Search inventory</Label>
              <Input
                id='secret-inventory-search'
                value={inventorySearch}
                placeholder='Search refs, owners, providers, or state'
                onChange={(event) => setInventorySearch(event.target.value)}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='secret-inventory-provider'>Provider</Label>
              <select
                id='secret-inventory-provider'
                aria-label='Filter secrets by provider'
                className='h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs'
                value={inventoryProvider}
                onChange={(event) => setInventoryProvider(event.target.value)}
              >
                <option value='all'>All providers</option>
                {inventoryProviders.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='secret-inventory-outcome'>Outcome</Label>
              <select
                id='secret-inventory-outcome'
                aria-label='Filter secrets by outcome'
                className='h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs'
                value={inventoryOutcome}
                onChange={(event) => setInventoryOutcome(event.target.value)}
              >
                <option value='all'>All outcomes</option>
                {inventoryOutcomes.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className='overflow-x-auto rounded-md border'>
            <Table data-testid='managed-secrets-inventory'>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Capabilities</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead>Audit</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRecords.length ? (
                  visibleRecords.map((record) => (
                    <TableRow key={record.ref}>
                      <TableCell className='max-w-[320px] font-mono text-xs break-all'>
                        {record.ref}
                      </TableCell>
                      <TableCell>
                        <div className='font-medium'>{record.sourceId}</div>
                        <div className='text-xs text-muted-foreground'>
                          {record.providerKind}
                        </div>
                      </TableCell>
                      <TableCell>
                        <SecretOutcomeBadge outcome={record.outcome} />
                      </TableCell>
                      <TableCell className='max-w-[260px]'>
                        <div className='flex flex-wrap gap-1'>
                          {record.capabilities.map((capability) => (
                            <Badge key={capability} variant='outline'>
                              {capability}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{record.policy ?? 'Not recorded'}</TableCell>
                      <TableCell>{record.auditStatus ?? 'unknown'}</TableCell>
                      <TableCell>
                        <div className='flex flex-wrap gap-2'>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={
                              !canManageSecrets ||
                              record.outcome !== 'ready' ||
                              providerStatusUnavailable ||
                              !providerQuery.data?.providers.some(
                                (provider) =>
                                  provider.providerId !==
                                    migrationSourceProviderId(record) &&
                                  provider.outcome === 'ready'
                              )
                            }
                            title={
                              canManageSecrets
                                ? 'Build a Broker migration dry run'
                                : 'Security management permission is required'
                            }
                            onClick={() => openMigration(record)}
                          >
                            Migrate {record.name}
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={
                              !canInspectSecretPolicy(record, canManageSecrets)
                            }
                            title={
                              canInspectSecretPolicy(record, canManageSecrets)
                                ? 'Inspect policy capability and current binding'
                                : canManageSecrets
                                  ? 'Policy inspection is unavailable for this provider'
                                  : 'Security management permission is required'
                            }
                            onClick={() => void openPolicy(record)}
                          >
                            Policy {record.name}
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={
                              !canRotateSecret(record, canManageSecrets)
                            }
                            title={
                              canRotateSecret(record, canManageSecrets)
                                ? 'Rotate through preview, stage, and activation'
                                : canManageSecrets
                                  ? 'Versioned rotation is unavailable for this provider'
                                  : 'Security management permission is required'
                            }
                            onClick={() => openRotation(record)}
                          >
                            Rotate {record.name}
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={
                              !canRevealSecret(record, canManageSecrets)
                            }
                            title={
                              canRevealSecret(record, canManageSecrets)
                                ? 'Reveal secret'
                                : canManageSecrets
                                  ? 'Reveal is unavailable for this record'
                                  : 'Security management permission is required'
                            }
                            onClick={() => openReveal(record)}
                          >
                            <Eye className='mr-2 size-4' />
                            Reveal {record.name}
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={
                              !canMutateSecret(record, 'edit', canManageSecrets)
                            }
                            title={
                              canMutateSecret(record, 'edit', canManageSecrets)
                                ? 'Edit secret with dry-run and confirmation'
                                : canManageSecrets
                                  ? 'Edit apply is unavailable for this provider'
                                  : 'Security management permission is required'
                            }
                            onClick={() => openMutation(record, 'edit')}
                          >
                            Edit {record.name}
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            disabled={
                              !canMutateSecret(
                                record,
                                'reset',
                                canManageSecrets
                              )
                            }
                            title={
                              canMutateSecret(record, 'reset', canManageSecrets)
                                ? 'Reset secret with dry-run and confirmation'
                                : canManageSecrets
                                  ? 'Reset apply is unavailable for this provider'
                                  : 'Security management permission is required'
                            }
                            onClick={() => openMutation(record, 'reset')}
                          >
                            Reset {record.name}
                          </Button>
                          {record.tombstone?.state === 'decommissioned' ? (
                            <Button
                              type='button'
                              size='sm'
                              variant='outline'
                              disabled={!canManageSecrets}
                              title='Restore from the persisted encrypted tombstone'
                              onClick={() => openTombstoneRestore(record)}
                            >
                              <Undo2 className='mr-2 size-4' />
                              Restore {record.name}
                            </Button>
                          ) : (
                            <Button
                              type='button'
                              size='sm'
                              variant='outline'
                              disabled={
                                !canDecommissionSecret(record, canManageSecrets)
                              }
                              title={
                                canDecommissionSecret(record, canManageSecrets)
                                  ? 'Decommission with dependency preflight and recoverable tombstone'
                                  : canManageSecrets
                                    ? 'Decommission is unavailable for this provider'
                                    : 'Security management permission is required'
                              }
                              onClick={() => openDecommission(record)}
                            >
                              Decommission {record.name}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className='h-20 text-center'>
                      No managed secrets match this view.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className='mt-4 flex flex-wrap items-center justify-between gap-3 text-sm'>
            <span className='text-muted-foreground'>
              {filteredRecords.length} result
              {filteredRecords.length === 1 ? '' : 's'} · page {inventoryPage}{' '}
              of {inventoryPageCount}
            </span>
            <div className='flex items-center gap-2'>
              <Label htmlFor='secret-inventory-page-size' className='sr-only'>
                Results per page
              </Label>
              <select
                id='secret-inventory-page-size'
                aria-label='Results per page'
                className='h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs'
                value={inventoryPageSize}
                onChange={(event) =>
                  setInventoryPageSize(Number(event.target.value))
                }
              >
                {[1, 5, 10, 25].map((size) => (
                  <option key={size} value={size}>
                    {size} per page
                  </option>
                ))}
              </select>
              <Button
                type='button'
                size='sm'
                variant='outline'
                aria-label='Previous secrets page'
                disabled={inventoryPage <= 1}
                onClick={() =>
                  setInventoryPage((page) => Math.max(1, page - 1))
                }
              >
                Previous
              </Button>
              <Button
                type='button'
                size='sm'
                variant='outline'
                aria-label='Next secrets page'
                disabled={inventoryPage >= inventoryPageCount}
                onClick={() =>
                  setInventoryPage((page) =>
                    Math.min(inventoryPageCount, page + 1)
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={migrationTarget !== null} onOpenChange={closeMigration}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Migrate secret provider</DialogTitle>
            <DialogDescription>{migrationTarget?.ref}</DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='migration-target-provider'>Target provider</Label>
              <select
                id='migration-target-provider'
                className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
                value={migrationTargetProviderId}
                disabled={
                  migrationPreview !== null || migrationReceipt !== null
                }
                onChange={(event) => {
                  setMigrationTargetProviderId(event.target.value)
                  setMigrationPreview(null)
                  setMigrationRevalidated(false)
                  setMigrationConfirmed(false)
                  setMigrationError(null)
                }}
              >
                <option value=''>Select a target</option>
                {providerQuery.data?.providers
                  .filter(
                    (provider) =>
                      provider.providerId !== migrationTarget?.sourceId
                  )
                  .map((provider) => (
                    <option
                      key={provider.providerId}
                      value={provider.providerId}
                    >
                      {provider.displayName} ({provider.outcome})
                    </option>
                  ))}
              </select>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='migration-audit-reason'>Audit reason</Label>
              <Textarea
                id='migration-audit-reason'
                value={migrationReason}
                disabled={
                  migrationPreview !== null || migrationReceipt !== null
                }
                onChange={(event) => {
                  setMigrationReason(event.target.value)
                  setMigrationPreview(null)
                  setMigrationRevalidated(false)
                  setMigrationConfirmed(false)
                }}
                placeholder='Approved provider migration'
              />
            </div>

            {migrationPreview ? (
              <div className='space-y-3 rounded-md border p-3 text-sm'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='font-medium'>Migration dry run ready</span>
                  <Badge variant='secondary'>
                    {migrationRevalidated ? 'revalidated' : 'audit recorded'}
                  </Badge>
                </div>
                <ul className='space-y-1' data-testid='migration-ref-outcomes'>
                  {migrationPreview.results.map((item) => (
                    <li key={item.ref} className='text-xs'>
                      {item.ref}: {classifyMigrationRefOutcome(item.outcome)} ·{' '}
                      {item.recovery}
                    </li>
                  ))}
                </ul>
                <p className='text-xs text-muted-foreground'>
                  Recovery: {migrationPreview.rollback}
                </p>
                {!migrationApplyExecutable ? (
                  <div className='rounded-md border border-amber-500/40 bg-amber-500/5 p-2'>
                    {migrationApplyGate.reason}
                  </div>
                ) : (
                  <>
                    {!migrationRevalidated ? (
                      <p className='text-xs text-muted-foreground'>
                        Revalidate this exact dry-run before confirmation.
                      </p>
                    ) : (
                      <label className='flex items-start gap-3'>
                        <Checkbox
                          checked={migrationConfirmed}
                          onCheckedChange={(checked) =>
                            setMigrationConfirmed(checked === true)
                          }
                          aria-label='Confirm provider migration'
                        />
                        <span>
                          I confirm this exact provider, reference, operation
                          ID, and audit reason.
                        </span>
                      </label>
                    )}
                  </>
                )}
              </div>
            ) : null}

            {migrationReceipt ? (
              <div
                data-testid='migration-terminal-outcome'
                data-outcome={migrationReceipt.outcome}
                className={cn(
                  'space-y-2 rounded-md border p-3 text-sm',
                  migrationReceipt.outcome === 'applied'
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-destructive/40 bg-destructive/5 text-destructive'
                )}
              >
                <p className='font-medium'>
                  Migration outcome: {migrationReceipt.outcome}
                </p>
                {migrationReceipt.results.map((result) => (
                  <p key={result.ref} className='text-xs'>
                    {result.ref}: {result.outcome} · {result.recovery}
                  </p>
                ))}
                {migrationReceipt.outcome !== 'applied' ? (
                  <p className='text-xs'>
                    The source remains authoritative. Follow the safe recovery
                    action before retrying this exact operation.
                  </p>
                ) : null}
              </div>
            ) : null}

            {migrationError ? (
              <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                {migrationError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => closeMigration(false)}
            >
              Close
            </Button>
            {!migrationPreview && !migrationReceipt ? (
              <Button
                type='button'
                disabled={
                  previewMigration.isPending ||
                  !migrationTargetProviderId ||
                  !migrationReason.trim()
                }
                onClick={() => void runMigrationPreview()}
              >
                Preview migration
              </Button>
            ) : null}
            {migrationPreview ? (
              <>
                <Button
                  type='button'
                  variant='outline'
                  disabled={previewMigration.isPending}
                  onClick={() => void runMigrationRevalidate()}
                >
                  Revalidate plan
                </Button>
                <Button
                  type='button'
                  disabled={
                    migrationApplyGate.blocked || applyMigration.isPending
                  }
                  title={migrationApplyGate.reason}
                  onClick={() => void runMigrationApply()}
                >
                  Apply migration
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkCampaignOpen} onOpenChange={closeBulkCampaign}>
        <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-3xl'>
          <DialogHeader>
            <DialogTitle>Bulk provider migration</DialogTitle>
            <DialogDescription>
              Build, revalidate, and confirm one durable Broker campaign. The
              browser sends secret references only; secret values remain inside
              the Broker.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='bulk-migration-target-provider'>
                Executable target provider
              </Label>
              <select
                id='bulk-migration-target-provider'
                className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
                value={bulkCampaignTargetProviderId}
                disabled={
                  bulkCampaignPlan !== null || bulkCampaignReceipt !== null
                }
                onChange={(event) => {
                  setBulkCampaignTargetProviderId(event.target.value)
                  setBulkCampaignPlan(null)
                  setBulkCampaignConfirmed(false)
                  setBulkCampaignError(null)
                }}
              >
                <option value=''>Select a validated target</option>
                {executableMigrationProviders.map((provider) => (
                  <option key={provider.providerId} value={provider.providerId}>
                    {provider.displayName} ({provider.providerKind})
                  </option>
                ))}
              </select>
              <p className='text-xs text-muted-foreground'>
                Only connections advertising a registered write-and-verify
                executor are selectable.
              </p>
            </div>

            <fieldset
              className='space-y-2 rounded-md border p-3'
              disabled={
                bulkCampaignPlan !== null || bulkCampaignReceipt !== null
              }
            >
              <legend className='px-1 text-sm font-medium'>
                Local secrets
              </legend>
              {bulkCampaignCandidates.length ? (
                <div className='max-h-48 space-y-2 overflow-y-auto'>
                  {bulkCampaignCandidates.map((record) => (
                    <label
                      key={record.ref}
                      className='flex items-start gap-3 rounded border p-2 text-sm'
                    >
                      <Checkbox
                        checked={bulkCampaignRefs.includes(record.ref)}
                        onCheckedChange={(checked) =>
                          toggleBulkCampaignRef(record.ref, checked === true)
                        }
                        aria-label={`Select ${record.ref} for bulk migration`}
                      />
                      <span className='min-w-0'>
                        <span className='block font-mono text-xs break-all'>
                          {record.ref}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          {record.ownerServiceId ?? 'unowned'} ·{' '}
                          {record.sourceId}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  No ready local encrypted-store records are eligible.
                </p>
              )}
            </fieldset>

            <div className='space-y-2'>
              <Label htmlFor='bulk-migration-audit-reason'>Audit reason</Label>
              <Textarea
                id='bulk-migration-audit-reason'
                value={bulkCampaignReason}
                disabled={
                  bulkCampaignPlan !== null || bulkCampaignReceipt !== null
                }
                onChange={(event) => {
                  setBulkCampaignReason(event.target.value)
                  setBulkCampaignPlan(null)
                  setBulkCampaignConfirmed(false)
                }}
                placeholder='Approved bulk provider migration'
              />
            </div>

            {bulkCampaignPlan ? (
              <div className='space-y-3 rounded-md border p-3 text-sm'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='font-medium'>Durable campaign ready</span>
                  <div className='flex gap-2'>
                    <Badge variant='secondary'>audit recorded</Badge>
                    <Badge variant='outline'>concurrency 1</Badge>
                  </div>
                </div>
                <p>
                  {bulkCampaignPlan.summary.applicableCount} of{' '}
                  {bulkCampaignPlan.summary.selectedCount} selected refs are
                  applicable. High risk:{' '}
                  {bulkCampaignPlan.summary.highRiskCount}.
                </p>
                <p className='font-mono text-xs break-all'>
                  Campaign {bulkCampaignPlan.campaignId}
                </p>
                <p className='text-xs text-muted-foreground'>
                  Valid for {bulkCampaignPlan.staleAfterSeconds}s after
                  revalidation. Backpressure policy:{' '}
                  {bulkCampaignPlan.backpressurePolicy}.
                </p>
                <div className='max-h-44 space-y-2 overflow-y-auto'>
                  {bulkCampaignPlan.results.map((item) => (
                    <div
                      key={item.operationItemId}
                      className='rounded border p-2'
                    >
                      <div className='font-mono text-xs break-all'>
                        {item.ref}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {item.outcome} · {item.expectedAction} · {item.risk}
                      </div>
                    </div>
                  ))}
                </div>
                <label className='flex items-start gap-3'>
                  <Checkbox
                    checked={bulkCampaignConfirmed}
                    onCheckedChange={(checked) =>
                      setBulkCampaignConfirmed(checked === true)
                    }
                    aria-label='Confirm exact bulk migration campaign'
                  />
                  <span>
                    I confirm this exact campaign ID, selected references,
                    target provider, and audit reason. The Broker must verify
                    every reported write.
                  </span>
                </label>
              </div>
            ) : null}

            {bulkCampaignReceipt ? (
              <div className='space-y-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='font-medium'>
                    Campaign outcome: {bulkCampaignReceipt.outcome}
                  </span>
                  <Badge variant='secondary'>durable</Badge>
                </div>
                <p>
                  {bulkCampaignReceipt.summary.appliedCount} verified;{' '}
                  {bulkCampaignReceipt.summary.failedCount} failed;{' '}
                  {bulkCampaignReceipt.summary.skippedCount} deferred.
                </p>
                {bulkCampaignReceipt.results.map((item) => (
                  <p key={item.operationItemId} className='text-xs'>
                    <span className='font-mono'>{item.ref}</span>:{' '}
                    {item.outcome}
                    {item.verified ? ' · verified' : ''}
                    {item.nextAction ? ` · ${item.nextAction}` : ''}
                  </p>
                ))}
              </div>
            ) : null}

            {bulkCampaignError ? (
              <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                {bulkCampaignError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => closeBulkCampaign(false)}
            >
              Close
            </Button>
            {!bulkCampaignPlan && !bulkCampaignReceipt ? (
              <Button
                type='button'
                disabled={
                  createBulkCampaign.isPending ||
                  revalidateBulkCampaign.isPending ||
                  !bulkCampaignRefs.length ||
                  !bulkCampaignTargetProviderId ||
                  !bulkCampaignReason.trim()
                }
                onClick={() => void runBulkCampaignPreview()}
              >
                Create and revalidate campaign
              </Button>
            ) : null}
            {bulkCampaignPlan ? (
              <>
                <Button
                  type='button'
                  variant='outline'
                  disabled={revalidateBulkCampaign.isPending}
                  onClick={() => void runBulkCampaignRevalidate()}
                >
                  Revalidate plan
                </Button>
                <Button
                  type='button'
                  disabled={
                    !bulkCampaignConfirmed || applyBulkCampaign.isPending
                  }
                  onClick={() => void runBulkCampaignApply()}
                >
                  Apply exact campaign
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={policyTarget !== null} onOpenChange={closePolicy}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Secret policy status</DialogTitle>
            <DialogDescription>{policyTarget?.ref}</DialogDescription>
          </DialogHeader>

          <div className='space-y-3'>
            {previewPolicy.isPending ? (
              <div className='rounded-md border p-3 text-sm'>
                Checking Broker policy capability…
              </div>
            ) : null}
            {policyPreview ? (
              <div className='space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='font-medium'>Policy apply unavailable</span>
                  <Badge variant='secondary'>planning only</Badge>
                </div>
                <p>
                  Current binding:{' '}
                  {policyPreview.currentPolicy ?? 'not recorded'}.
                </p>
                <p className='text-xs text-muted-foreground'>
                  The Broker does not yet persist policy bindings. No policy was
                  changed, and this UI will not claim enforcement until the
                  apply capability is implemented and release-qualified.
                </p>
                <p className='text-xs text-muted-foreground'>
                  Audit status: {policyPreview.auditStatus}. Next action:{' '}
                  {policyPreview.nextAction}.
                </p>
              </div>
            ) : null}
            {policyError ? (
              <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                {policyError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => closePolicy(false)}
            >
              Close
            </Button>
            <Button type='button' disabled>
              Apply policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={closeCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create local secret</DialogTitle>
            <DialogDescription>
              The Broker first signs a short-lived no-overwrite plan. The value
              is accepted only during confirmed apply and is never returned.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='secret-create-ref'>Secret reference</Label>
              <Input
                id='secret-create-ref'
                value={createRef}
                placeholder='services/my-service/runtime/API_TOKEN'
                autoComplete='off'
                spellCheck={false}
                disabled={createPlan !== null || createReceipt !== null}
                onChange={(event) => setCreateRef(event.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='secret-create-mode'>Value source</Label>
              <select
                id='secret-create-mode'
                className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm'
                value={createGenerationMode}
                disabled={createPlan !== null || createReceipt !== null}
                onChange={(event) => {
                  setCreateGenerationMode(
                    event.target.value as SecretCreateGenerationMode
                  )
                  setCreateValue('')
                }}
              >
                <option value='broker_generated'>Broker generated</option>
                <option value='operator_supplied'>Operator supplied</option>
              </select>
              <p className='text-xs text-muted-foreground'>
                Broker-generated is recommended and never exposes the value to
                the browser. Operator-supplied values exist only in this form
                and the confirmed request body.
              </p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='secret-create-reason'>Audit reason</Label>
              <Textarea
                id='secret-create-reason'
                value={createReason}
                placeholder='Approved initial credential provision'
                disabled={createPlan !== null || createReceipt !== null}
                onChange={(event) => setCreateReason(event.target.value)}
              />
            </div>
            {createPlan && createGenerationMode === 'operator_supplied' ? (
              <div className='space-y-2'>
                <Label htmlFor='secret-create-value'>Secret value</Label>
                <Input
                  id='secret-create-value'
                  type='password'
                  value={createValue}
                  autoComplete='new-password'
                  spellCheck={false}
                  onChange={(event) => setCreateValue(event.target.value)}
                />
              </div>
            ) : null}
            {createPlan ? (
              <div className='space-y-3 rounded-md border p-3'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-sm font-medium'>Signed plan ready</span>
                  <Badge variant='secondary'>no overwrite</Badge>
                </div>
                <label className='flex items-start gap-3 text-sm'>
                  <Checkbox
                    checked={createConfirmed}
                    onCheckedChange={(checked) =>
                      setCreateConfirmed(checked === true)
                    }
                    aria-label='Confirm secret create'
                  />
                  <span>
                    I confirm creation of this new local encrypted secret from
                    the exact signed plan.
                  </span>
                </label>
              </div>
            ) : null}
            {createReceipt ? (
              <div className='rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm'>
                Secret created and audit recorded. No secret value was returned.
              </div>
            ) : null}
            {createError ? (
              <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                {createError}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={clearCreateState}>
              Close
            </Button>
            {!createPlan ? (
              <Button
                type='button'
                disabled={previewCreate.isPending || createReceipt !== null}
                onClick={() => void runCreatePreview()}
              >
                Preview create
              </Button>
            ) : (
              <Button
                type='button'
                disabled={
                  applyCreate.isPending ||
                  !createConfirmed ||
                  (createGenerationMode === 'operator_supplied' &&
                    !createValue.trim())
                }
                onClick={() => void runCreateApply()}
              >
                Create secret
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedSecret !== null} onOpenChange={closeReveal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reveal secret</DialogTitle>
            <DialogDescription>{selectedSecret?.ref}</DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='secret-reveal-reason'>Audit reason</Label>
              <Textarea
                id='secret-reveal-reason'
                value={auditReason}
                onChange={(event) => setAuditReason(event.target.value)}
                placeholder='Operator troubleshooting'
              />
            </div>

            <label className='flex items-start gap-3 text-sm'>
              <Checkbox
                checked={revealConfirmed}
                onCheckedChange={(checked) =>
                  setRevealConfirmed(checked === true)
                }
                aria-label='Confirm secret reveal'
              />
              <span>
                I confirm this time-limited reveal will be recorded in the
                broker audit trail.
              </span>
            </label>

            {localError ? (
              <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                {localError}
              </div>
            ) : null}

            {revealedSecret ? (
              <div className='space-y-2 rounded-md border p-3'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='text-sm font-medium'>Value</div>
                  <Badge variant='secondary'>
                    Expires in {revealedSecret.result.ttlSeconds}s
                  </Badge>
                </div>
                <code
                  data-testid='secret-reveal-value'
                  className='block rounded bg-muted p-2 text-sm break-all'
                >
                  {revealedSecret.result.value}
                </code>
                <div className='flex flex-wrap gap-2'>
                  <CopyValueButton
                    value={revealedSecret.result.value}
                    label='Copy revealed value'
                  />
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => setRevealedSecret(null)}
                  >
                    <EyeOff className='mr-2 size-4' />
                    Clear reveal
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => closeReveal(false)}
            >
              Close
            </Button>
            <Button
              type='button'
              disabled={revealSecret.isPending || !revealConfirmed}
              onClick={() => void runReveal()}
            >
              Reveal value
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mutationTarget !== null} onOpenChange={closeMutation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mutationTarget?.operation === 'reset' ? 'Reset' : 'Edit'} secret
            </DialogTitle>
            <DialogDescription>{mutationTarget?.record.ref}</DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='secret-mutation-reason'>Audit reason</Label>
              <Textarea
                id='secret-mutation-reason'
                value={mutationReason}
                onChange={(event) => {
                  setMutationReason(event.target.value)
                  setMutationPlan(null)
                  setMutationConfirmed(false)
                }}
                placeholder='Approved credential replacement'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='secret-replacement-value'>
                Replacement value
              </Label>
              <Input
                id='secret-replacement-value'
                type='password'
                value={replacementValue}
                autoComplete='new-password'
                spellCheck={false}
                onChange={(event) => setReplacementValue(event.target.value)}
              />
              <p className='text-xs text-muted-foreground'>
                This value is sent only for the confirmed apply request. It is
                never included in the broker response and is cleared after the
                attempt.
              </p>
            </div>

            {mutationPlan ? (
              <div className='space-y-3 rounded-md border p-3'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-sm font-medium'>Dry run ready</span>
                  <Badge variant='secondary'>audit ready</Badge>
                </div>
                <label className='flex items-start gap-3 text-sm'>
                  <Checkbox
                    checked={mutationConfirmed}
                    onCheckedChange={(checked) =>
                      setMutationConfirmed(checked === true)
                    }
                    aria-label='Confirm secret mutation'
                  />
                  <span>
                    I confirm this replacement for the selected local secret.
                  </span>
                </label>
              </div>
            ) : null}

            {mutationReceipt ? (
              <div className='rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm'>
                Mutation applied and audit recorded. No secret value was
                returned.
              </div>
            ) : null}

            {mutationError ? (
              <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                {mutationError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => closeMutation(false)}
            >
              Close
            </Button>
            {!mutationPlan ? (
              <Button
                type='button'
                disabled={previewMutation.isPending || mutationReceipt !== null}
                onClick={() => void runMutationPreview()}
              >
                Preview mutation
              </Button>
            ) : (
              <Button
                type='button'
                disabled={
                  !mutationConfirmed ||
                  !replacementValue.trim() ||
                  applyMutation.isPending
                }
                onClick={() => void runMutationApply()}
              >
                Apply mutation
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={decommissionTarget !== null}
        onOpenChange={closeDecommission}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decommissionTarget?.tombstone
                ? 'Restore secret'
                : 'Decommission secret'}
            </DialogTitle>
            <DialogDescription>
              {decommissionTarget?.ref}.{' '}
              {decommissionTarget?.tombstone
                ? 'Restore uses the exact persisted tombstone version and requires a fresh audit reason.'
                : 'Core derives dependency evidence from the current manifests; the browser cannot override it.'}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='secret-decommission-reason'>Audit reason</Label>
              <Textarea
                id='secret-decommission-reason'
                value={decommissionReason}
                onChange={(event) => {
                  setDecommissionReason(event.target.value)
                  setDecommissionConfirmed(false)
                }}
                placeholder='Approved secret retirement'
              />
            </div>

            {decommissionPlan?.plan ? (
              <div className='space-y-3 rounded-md border p-3'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-sm font-medium'>Signed plan ready</span>
                  <Badge variant='secondary'>no dependencies</Badge>
                </div>
                <p className='text-xs text-muted-foreground'>
                  Version-bound plan expires{' '}
                  {new Date(decommissionPlan.plan.expiresAt).toLocaleString()}.
                  The signature is retained only in memory for this apply.
                </p>
                <label className='flex items-start gap-3 text-sm'>
                  <Checkbox
                    checked={decommissionConfirmed}
                    onCheckedChange={(checked) =>
                      setDecommissionConfirmed(checked === true)
                    }
                    aria-label='Confirm secret decommission'
                  />
                  <span>
                    I confirm this secret will move into an encrypted,
                    recoverable tombstone.
                  </span>
                </label>
              </div>
            ) : null}

            {decommissionReceipt?.tombstone?.state === 'decommissioned' ? (
              <div className='space-y-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm'>
                <p>
                  Secret decommissioned and audit recorded. The encrypted
                  tombstone is recoverable.
                </p>
                <label className='flex items-start gap-3'>
                  <Checkbox
                    checked={restoreConfirmed}
                    onCheckedChange={(checked) =>
                      setRestoreConfirmed(checked === true)
                    }
                    aria-label='Confirm secret restore'
                  />
                  <span>
                    I confirm restore from this exact tombstone version.
                  </span>
                </label>
              </div>
            ) : null}

            {decommissionReceipt?.tombstone?.state === 'restored' ? (
              <div className='rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm'>
                Secret restored and audit recorded. Refresh confirmed the
                managed record is active again.
              </div>
            ) : null}

            {decommissionError ? (
              <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                {decommissionError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => closeDecommission(false)}
            >
              Close
            </Button>
            {!decommissionPlan && !decommissionReceipt ? (
              <Button
                type='button'
                disabled={previewDecommission.isPending}
                onClick={() => void runDecommissionPreview()}
              >
                Check dependencies
              </Button>
            ) : null}
            {decommissionPlan ? (
              <Button
                type='button'
                variant='destructive'
                disabled={
                  !decommissionReason.trim() ||
                  !decommissionConfirmed ||
                  applyDecommission.isPending
                }
                onClick={() => void runDecommissionApply()}
              >
                Decommission secret
              </Button>
            ) : null}
            {decommissionReceipt?.tombstone?.state === 'decommissioned' ? (
              <Button
                type='button'
                disabled={!restoreConfirmed || restoreDecommission.isPending}
                onClick={() => void runDecommissionRestore()}
              >
                Restore secret
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rotationTarget !== null} onOpenChange={closeRotation}>
        <DialogContent className='max-h-[calc(100vh-2rem)] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Rotate secret</DialogTitle>
            <DialogDescription>
              {rotationTarget?.ref}. The replacement remains only in the
              password field until a confirmed stage request and is then
              cleared.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='secret-rotation-reason'>Audit reason</Label>
              <Textarea
                id='secret-rotation-reason'
                value={rotationReason}
                disabled={rotationReceipt !== null}
                onChange={(event) => {
                  setRotationReason(event.target.value)
                  setRotationPreview(null)
                  setRotationStatus(null)
                  setRotationConfirmed(false)
                }}
                placeholder='Approved versioned secret rotation'
              />
            </div>

            {!rotationReceipt && !rotationExecution ? (
              <div className='space-y-2'>
                <Label htmlFor='secret-rotation-value'>Replacement value</Label>
                <Input
                  id='secret-rotation-value'
                  type='password'
                  value={rotationValue}
                  autoComplete='new-password'
                  spellCheck={false}
                  onChange={(event) => setRotationValue(event.target.value)}
                />
                <p className='text-xs text-muted-foreground'>
                  Preview and status requests omit this value. It is sent only
                  to the confirmed stage endpoint and cleared after that call.
                </p>
              </div>
            ) : null}

            {rotationPreview && rotationStatus?.currentVersion ? (
              <div className='space-y-3 rounded-md border p-3'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-sm font-medium'>Rotation ready</span>
                  <Badge variant='secondary'>version bound</Badge>
                </div>
                <p className='text-xs text-muted-foreground'>
                  Current version {rotationStatus.currentVersion.versionId}.
                  Preview expires in {rotationPreview.staleAfterSeconds}s.
                </p>
              </div>
            ) : null}

            {rotationImpactPlan ? (
              <div className='space-y-3 rounded-md border p-3'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-sm font-medium'>Linked consumers</span>
                  <Badge
                    variant={
                      rotationImpactPlan.status === 'ready'
                        ? 'outline'
                        : 'destructive'
                    }
                  >
                    {rotationImpactPlan.status === 'ready'
                      ? 'Core orchestrated'
                      : 'Plan blocked'}
                  </Badge>
                </div>
                <p className='text-xs text-muted-foreground'>
                  Core will stop, rematerialize, restart or reload only the
                  services in this dependency-ordered plan. A failed convergence
                  automatically restores the previous version.
                </p>
                <div className='space-y-2'>
                  {rotationImpactPlan.services.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No linked consumer action is required. Core still owns the
                      audited version transition.
                    </p>
                  ) : null}
                  {rotationImpactPlan.services.map((service) => {
                    const currentHealth = linkedServiceHealth.get(
                      service.serviceId
                    )
                    return (
                      <div
                        key={service.serviceId}
                        className='grid gap-1 rounded-md border p-2 text-sm sm:grid-cols-[1fr_auto]'
                      >
                        <div>
                          <span className='font-mono'>{service.serviceId}</span>
                          <div className='text-xs text-muted-foreground'>
                            {service.role} consumer
                          </div>
                        </div>
                        <div className='text-left sm:text-right'>
                          <div>{rotationActionLabel(service)}</div>
                          <div className='text-xs text-muted-foreground'>
                            {currentHealth
                              ? `${currentHealth.status} · ${currentHealth.runtimeHealth.health}`
                              : 'current health unavailable'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {rotationImpactPlan.ownerAction ? (
                  <div className='rounded-md border p-2 text-sm'>
                    <div className='font-medium'>Rotation owner</div>
                    <div className='text-muted-foreground'>
                      {rotationImpactPlan.ownerAction.status === 'ready'
                        ? `Run ${rotationImpactPlan.ownerAction.actionId ?? 'declared owner action'}`
                        : 'Manual owner action required'}{' '}
                      · {rotationImpactPlan.ownerAction.authority}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {rotationExecution ? (
              <div
                className={
                  rotationExecution.outcome === 'committed'
                    ? 'rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm'
                    : 'rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm'
                }
              >
                <div className='space-y-3'>
                  <div className='font-medium'>
                    Core rotation {rotationExecution.outcome}
                  </div>
                  <div className='grid gap-2 text-xs sm:grid-cols-3'>
                    <div>
                      <div className='text-muted-foreground'>
                        Active version
                      </div>
                      <div className='font-mono'>
                        {rotationExecution.activeVersionId ?? 'not committed'}
                      </div>
                    </div>
                    <div>
                      <div className='text-muted-foreground'>
                        Previous version
                      </div>
                      <div className='font-mono'>
                        {rotationExecution.previousVersionId ?? 'none'}
                      </div>
                    </div>
                    <div>
                      <div className='text-muted-foreground'>
                        Staged version
                      </div>
                      <div className='font-mono'>
                        {rotationExecution.stagedVersionId ?? 'none'}
                      </div>
                    </div>
                  </div>
                  <div>
                    Phase {rotationExecution.phase};{' '}
                    {rotationExecution.completedOperations.length} consumer
                    actions completed;{' '}
                    {rotationExecution.rollbackCompletedOperations.length}{' '}
                    rollback actions completed.
                  </div>
                  {rotationExecution.failureCode ? (
                    <div>
                      Safe failure code:{' '}
                      <span className='font-mono'>
                        {rotationExecution.failureCode}
                      </span>
                    </div>
                  ) : null}
                  <div>
                    <span className='font-medium'>Safe next action:</span>{' '}
                    {rotationSafeNextAction(rotationExecution)}
                  </div>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={coreRotationOperation.isFetching}
                    onClick={() => void coreRotationOperation.refetch()}
                  >
                    <RefreshCw
                      className={`mr-2 size-4 ${coreRotationOperation.isFetching ? 'animate-spin' : ''}`}
                    />
                    Refresh operation status
                  </Button>
                </div>
              </div>
            ) : null}

            {rotationReceipt?.operation === 'rotation_stage' ? (
              <div className='rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm'>
                Candidate {rotationReceipt.stagedVersion?.versionId} is staged,
                encrypted, and audited. Activation still requires confirmation.
              </div>
            ) : null}

            {rotationReceipt?.operation === 'rotation_activate' ? (
              <div className='rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm'>
                Version {rotationReceipt.currentVersion?.versionId} is active.
                The previous version remains retained for rollback or
                retirement.
              </div>
            ) : null}

            {rotationReceipt?.operation === 'rotation_rollback' ? (
              <div className='rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm'>
                Previous version restored and audit recorded.
              </div>
            ) : null}

            {rotationReceipt?.operation === 'rotation_retire' ? (
              <div className='rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm'>
                Retained version retired and audit recorded.
              </div>
            ) : null}

            {(rotationPreview || rotationReceipt) &&
            !rotationExecution &&
            rotationReceipt?.operation !== 'rotation_rollback' &&
            rotationReceipt?.operation !== 'rotation_retire' ? (
              <label className='flex items-start gap-3 text-sm'>
                <Checkbox
                  checked={rotationConfirmed}
                  onCheckedChange={(checked) =>
                    setRotationConfirmed(checked === true)
                  }
                  aria-label='Confirm secret rotation transition'
                />
                <span>
                  I confirm the next version transition and its durable audit
                  record.
                </span>
              </label>
            ) : null}

            {rotationError ? (
              <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
                {rotationError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => closeRotation(false)}
            >
              Close
            </Button>
            {!rotationPreview && !rotationReceipt && !rotationExecution ? (
              <Button
                type='button'
                disabled={
                  previewRotation.isPending ||
                  coreRotationPlan.isPending ||
                  !rotationReason.trim()
                }
                onClick={() => void runRotationPreview()}
              >
                Preview rotation
              </Button>
            ) : null}
            {rotationPreview && !rotationReceipt && !rotationExecution ? (
              <Button
                type='button'
                disabled={
                  !rotationConfirmed ||
                  !rotationValue.trim() ||
                  runRotationAction.isPending ||
                  coreRotationExecution.isPending
                }
                onClick={() => void runRotationStage()}
              >
                {rotationImpactPlan
                  ? 'Rotate and converge consumers'
                  : 'Stage candidate'}
              </Button>
            ) : null}
            {rotationReceipt?.operation === 'rotation_stage' ? (
              <Button
                type='button'
                disabled={!rotationConfirmed || runRotationAction.isPending}
                onClick={() => void runRotationActivate()}
              >
                Activate staged version
              </Button>
            ) : null}
            {rotationReceipt?.operation === 'rotation_activate' ? (
              <>
                <Button
                  type='button'
                  variant='outline'
                  disabled={!rotationConfirmed || runRotationAction.isPending}
                  onClick={() => void runRotationPostAction('rollback')}
                >
                  Roll back
                </Button>
                <Button
                  type='button'
                  variant='destructive'
                  disabled={!rotationConfirmed || runRotationAction.isPending}
                  onClick={() => void runRotationPostAction('retire')}
                >
                  Retire previous version
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SetupStatusBadge({ status }: { status: ServiceSetupStep['status'] }) {
  if (status === 'succeeded') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>Succeeded</Badge>
    )
  }

  if (status === 'failed' || status === 'timeout') {
    return <Badge variant='destructive'>{status}</Badge>
  }

  if (status === 'skipped') {
    return <Badge variant='secondary'>Skipped</Badge>
  }

  return <Badge variant='outline'>Pending</Badge>
}

function formatSetupDuration(durationMs?: number) {
  if (typeof durationMs !== 'number') return 'Not recorded'
  if (durationMs < 1000) return `${durationMs}ms`
  return `${(durationMs / 1000).toFixed(1)}s`
}

function SetupLogLinks({ step }: { step: ServiceSetupStep }) {
  const logs = step.lastRun?.logs
  const links = [
    { label: 'log', path: logs?.logPath },
    { label: 'stdout', path: logs?.stdoutPath },
    { label: 'stderr', path: logs?.stderrPath },
  ].filter((link): link is { label: string; path: string } =>
    Boolean(link.path)
  )

  if (!links.length) return <span className='text-muted-foreground'>None</span>

  return (
    <div className='flex flex-wrap gap-2'>
      {links.map((link) => (
        <Button key={link.label} variant='outline' size='sm' asChild>
          <Link to='/logs' search={{ service: step.lastRun?.serviceId }}>
            {link.label}
          </Link>
        </Button>
      ))}
    </div>
  )
}

function SetupStepsTable({
  setup,
  pendingStepId,
  forceRerun,
  onRunStep,
}: {
  setup: ServiceSetupState
  pendingStepId?: string
  forceRerun: boolean
  onRunStep: (stepId: string) => void
}) {
  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Step</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last run</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Exit</TableHead>
            <TableHead>Logs</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {setup.steps.map((step) => (
            <TableRow
              key={step.id}
              className={
                step.status === 'failed' || step.status === 'timeout'
                  ? 'bg-destructive/5'
                  : undefined
              }
            >
              <TableCell className='min-w-[220px] align-top'>
                <div className='font-medium'>{step.id}</div>
                <div className='text-sm text-muted-foreground'>
                  {step.description ?? 'No description recorded.'}
                </div>
                <div className='mt-2 flex flex-wrap gap-2'>
                  {step.rerun ? (
                    <Badge variant='outline'>rerun: {step.rerun}</Badge>
                  ) : null}
                  {step.rerun === 'manual' ? (
                    <Badge variant='secondary'>manual-only</Badge>
                  ) : null}
                  {step.dependOn?.length ? (
                    <Badge variant='outline'>
                      depends: {step.dependOn.join(', ')}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className='align-top'>
                <SetupStatusBadge status={step.status} />
                {step.skipReason ? (
                  <div className='mt-2 text-xs text-muted-foreground'>
                    {step.skipReason}
                  </div>
                ) : null}
                {step.lastRun?.message && !step.skipReason ? (
                  <div className='mt-2 text-xs text-muted-foreground'>
                    {step.lastRun.message}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className='align-top text-sm text-muted-foreground'>
                {step.lastRun?.finishedAt ?? 'Never'}
              </TableCell>
              <TableCell className='align-top text-sm text-muted-foreground'>
                {formatSetupDuration(step.lastRun?.durationMs)}
              </TableCell>
              <TableCell className='align-top text-sm text-muted-foreground'>
                {step.lastRun
                  ? (step.lastRun.exitCode ?? step.lastRun.signal ?? 'none')
                  : 'Not recorded'}
              </TableCell>
              <TableCell className='align-top'>
                <SetupLogLinks step={step} />
              </TableCell>
              <TableCell className='align-top'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  disabled={pendingStepId === step.id}
                  onClick={() => onRunStep(step.id)}
                >
                  {pendingStepId === step.id ? (
                    <RefreshCw className='mr-2 size-3.5 animate-spin' />
                  ) : (
                    <Play className='mr-2 size-3.5' />
                  )}
                  {forceRerun ? 'Force step' : 'Run step'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function ServiceSetupPanel({
  setup,
  loading,
  pendingStepId,
  forceRerun,
  onForceRerunChange,
  onRunAll,
  onRunStep,
}: {
  setup?: ServiceSetupState
  loading: boolean
  pendingStepId?: string
  forceRerun: boolean
  onForceRerunChange: (checked: boolean) => void
  onRunAll: () => void
  onRunStep: (stepId: string) => void
}) {
  if (loading) {
    return <Skeleton className='h-40 w-full' />
  }

  const steps = setup?.steps ?? []

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle>Setup steps</CardTitle>
            <CardDescription>
              Last run state and rerun controls from the Service Lasso runtime.
            </CardDescription>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <label className='flex items-center gap-2 rounded-md border px-3 py-2 text-sm'>
              <input
                type='checkbox'
                checked={forceRerun}
                onChange={(event) =>
                  onForceRerunChange(event.currentTarget.checked)
                }
              />
              Force rerun
            </label>
            <Button
              type='button'
              variant='outline'
              disabled={!steps.length || pendingStepId === 'all'}
              onClick={onRunAll}
            >
              {pendingStepId === 'all' ? (
                <RefreshCw className='mr-2 size-4 animate-spin' />
              ) : (
                <Play className='mr-2 size-4' />
              )}
              Run all
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {steps.length ? (
          <SetupStepsTable
            setup={setup!}
            pendingStepId={pendingStepId}
            forceRerun={forceRerun}
            onRunStep={onRunStep}
          />
        ) : (
          <div className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
            No setup steps are declared for this service.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ServiceActionButton({
  action,
  service,
}: {
  action: ServiceAction
  service: DashboardService
}) {
  const key = action.id
  const [confirmOpen, setConfirmOpen] = useState(false)
  const lifecycleAction = useServiceLifecycleAction()
  const permission = action.permission ?? {
    allowed: false,
    reason: 'Runtime action wiring is the next backend slice.',
  }

  const lifecycleKinds: ServiceLifecycleActionKind[] = [
    'install',
    'config',
    'start',
    'stop',
    'restart',
    'reload',
  ]
  const isLifecycleAction = lifecycleKinds.includes(
    action.kind as ServiceLifecycleActionKind
  )

  const runLifecycleAction = (confirm: boolean) => {
    if (!isLifecycleAction || lifecycleAction.isPending) return
    lifecycleAction.mutate(
      {
        serviceId: service.id,
        action: action.kind as ServiceLifecycleActionKind,
        confirm,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          toast.success(`${action.label} completed.`)
        },
        onError: () => {
          toast.error(
            `${action.label} failed. The runtime made no UI-side assumptions.`
          )
        },
      }
    )
  }

  if (!permission.allowed) {
    return (
      <Button
        key={key}
        variant='outline'
        size='sm'
        disabled
        title={permission.reason}
        className='h-auto max-w-full flex-col items-start gap-0.5 text-left whitespace-normal'
      >
        <span>{action.label}</span>
        {permission.reason ? (
          <span className='text-[11px] font-normal text-muted-foreground'>
            {permission.reason}
          </span>
        ) : null}
      </Button>
    )
  }

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

  if (!isLifecycleAction) {
    return (
      <Button key={key} variant='outline' size='sm' disabled>
        {action.label}
      </Button>
    )
  }

  if (permission.requiresConfirmation) {
    return (
      <>
        <Button
          key={key}
          variant='outline'
          size='sm'
          title={permission.reason}
          onClick={() => setConfirmOpen(true)}
          disabled={lifecycleAction.isPending}
        >
          {action.label}
        </Button>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title='Confirm elevated action'
          desc={
            <div className='space-y-2'>
              <p>
                {permission.reason ?? 'Core marked this action as elevated.'}
              </p>
              <p>
                Actor: {permission.actor ?? 'unknown'}; mode:{' '}
                {permission.mode ?? 'unknown'}.
              </p>
            </div>
          }
          confirmText={permission.confirmationLabel ?? action.label}
          isLoading={lifecycleAction.isPending}
          destructive={
            action.kind === 'stop' ||
            action.kind === 'restart' ||
            action.kind === 'uninstall'
          }
          handleConfirm={() => {
            runLifecycleAction(true)
          }}
        />
      </>
    )
  }

  return (
    <Button
      key={key}
      variant='outline'
      size='sm'
      title={permission.reason}
      disabled={lifecycleAction.isPending}
      onClick={() => runLifecycleAction(false)}
    >
      {lifecycleAction.isPending ? (
        <RefreshCw className='mr-2 size-4 animate-spin' />
      ) : null}
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

function AccessGrantBadges({ grant }: { grant: ServicePermissionGrant }) {
  return (
    <div className='flex flex-wrap gap-1'>
      <Badge variant='outline'>{grant.scope.kind}</Badge>
      {grant.sensitive ? <Badge variant='destructive'>Sensitive</Badge> : null}
      {grant.elevated ? <Badge variant='secondary'>Elevated</Badge> : null}
    </div>
  )
}

export function ServiceAccessPanel({ service }: { service: DashboardService }) {
  const access = service.access
  const grantsByScope = new Map<string, ServicePermissionGrant[]>()

  for (const grant of access?.grants ?? []) {
    const scopeKey = grant.scope.label
    grantsByScope.set(scopeKey, [...(grantsByScope.get(scopeKey) ?? []), grant])
  }

  if (!access) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Users className='size-4' /> Access
          </CardTitle>
          <CardDescription>
            Core access grants are not available for this service yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
            No service access grants are recorded.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-4'>
      {access.lastOwnerProtected ? (
        <Card className='border-amber-300 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/20'>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <ShieldAlert className='size-4' /> Last-owner protection
            </CardTitle>
            <CardDescription>
              Owner-capable grants are protected from final removal.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Users className='size-4' /> Provider-mapped groups
          </CardTitle>
          <CardDescription>
            Groups with direct or provider-mapped service access.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
          {access.groups.map((group) => (
            <div key={group.id} className='rounded-lg border p-3'>
              <div className='font-medium'>{group.name}</div>
              <div className='mt-2 space-y-1 text-sm text-muted-foreground'>
                {group.providerMappings.map((mapping) => (
                  <div key={mapping}>{mapping}</div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Granted permissions by scope</CardTitle>
          <CardDescription>
            Service-level access surfaced from catalogue-backed grants.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {Array.from(grantsByScope.entries()).map(([scope, grants]) => (
            <div key={scope} className='rounded-md border'>
              <div className='border-b px-3 py-2 font-medium'>{scope}</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Permission</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Last changed</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grants.map((grant) => (
                    <TableRow key={grant.id}>
                      <TableCell className='font-medium'>
                        {grant.groupName}
                      </TableCell>
                      <TableCell>
                        <div>{grant.permissionLabel}</div>
                        <div className='font-mono text-xs text-muted-foreground'>
                          {grant.permissionKey}
                        </div>
                      </TableCell>
                      <TableCell>
                        <AccessGrantBadges grant={grant} />
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {grant.lastChangedAt}
                      </TableCell>
                      <TableCell>
                        <Button size='sm' variant='outline' disabled>
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

type ServiceDetailTab =
  | 'overview'
  | 'dependencies'
  | 'setup'
  | 'access'
  | 'metadata'
  | 'endpoints'
  | 'variables'
  | 'secrets'
  | 'logs'

export function ServiceDetail({
  serviceId,
  rotationOperationId,
  onRotationOperationChange = () => undefined,
}: {
  serviceId: string
  rotationOperationId?: string
  onRotationOperationChange?: (operationId: string | undefined) => void
}) {
  const serviceQuery = useDashboardService(serviceId)
  const setupQuery = useServiceSetup(serviceId)
  const setupAction = useServiceSetupAction()
  const updateAction = useServiceUpdateAction()
  const serviceName = serviceQuery.data?.name ?? serviceId
  const [forceSetupRerun, setForceSetupRerun] = useState(false)
  const [pendingSetupStepId, setPendingSetupStepId] = useState<string>()
  const [tabState, setTabState] = useState<{
    serviceId: string
    activeTab: ServiceDetailTab
  }>({
    serviceId,
    activeTab:
      rotationOperationId && isSecretsBrokerService(serviceId)
        ? 'secrets'
        : 'overview',
  })
  const activeTab =
    rotationOperationId && isSecretsBrokerService(serviceId)
      ? 'secrets'
      : tabState.serviceId === serviceId
        ? tabState.activeTab
        : 'overview'
  const setActiveTab = useCallback(
    (nextTab: ServiceDetailTab) => {
      setTabState({ serviceId, activeTab: nextTab })
    },
    [serviceId]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }

      const nextTab = {
        '1': 'overview',
        '2': 'dependencies',
        '3': 'setup',
        '4': 'access',
        '5': 'metadata',
        '6': 'endpoints',
        '7': 'variables',
        '8': 'logs',
      }[event.key] as ServiceDetailTab | undefined

      if (!nextTab) return
      event.preventDefault()
      setActiveTab(nextTab)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setActiveTab])

  usePageMetadata({
    title: `Service Admin - Service - ${serviceName}`,
    description: `Service Admin operator view for service ${serviceName}.`,
  })

  const runSetup = (stepId?: string) => {
    const pendingId = stepId ?? 'all'
    setPendingSetupStepId(pendingId)
    setupAction.mutate(
      { serviceId, stepId, force: forceSetupRerun },
      {
        onSuccess: (result) => {
          toast.success(result.message)
        },
        onError: () => {
          toast.error('Setup run failed.')
        },
        onSettled: () => {
          setPendingSetupStepId(undefined)
        },
      }
    )
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
        {serviceQuery.isLoading ? (
          <ServiceDetailLoading />
        ) : !serviceQuery.data ? (
          <Card>
            <CardHeader>
              <CardTitle>Service not found</CardTitle>
              <CardDescription>
                The requested service is not present in the current service
                inventory.
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
            const showSecretsManagement = isSecretsBrokerService(service.id)

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
                      <ServiceUpdateBadge updates={service.updates} />
                      <ServiceRecoveryBadge recovery={service.recovery} />
                    </div>
                    <div>
                      <h2 className='text-2xl font-bold tracking-tight'>
                        {service.name}
                      </h2>
                      <p className='text-sm text-muted-foreground'>
                        {service.id} · {service.role}
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

                <Tabs
                  value={activeTab}
                  onValueChange={(value) =>
                    setActiveTab(value as typeof activeTab)
                  }
                  className='space-y-4'
                >
                  <TabsList className='flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl border border-border bg-muted/70 p-1 text-muted-foreground shadow-sm dark:border-slate-700/70 dark:bg-slate-900/90 dark:text-slate-400 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
                    <TabsTrigger
                      value='overview'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Overview{' '}
                      <span className='ml-1 italic opacity-80'>(1)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='dependencies'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Dependencies{' '}
                      <span className='ml-1 italic opacity-80'>(2)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='setup'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Setup <span className='ml-1 italic opacity-80'>(3)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='access'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Access <span className='ml-1 italic opacity-80'>(4)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='metadata'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Metadata{' '}
                      <span className='ml-1 italic opacity-80'>(5)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='endpoints'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Endpoints{' '}
                      <span className='ml-1 italic opacity-80'>(6)</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value='variables'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Variables{' '}
                      <span className='ml-1 italic opacity-80'>(7)</span>
                    </TabsTrigger>
                    {showSecretsManagement ? (
                      <TabsTrigger
                        value='secrets'
                        className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                      >
                        Secrets{' '}
                        <span className='ml-1 italic opacity-80'>(8)</span>
                      </TabsTrigger>
                    ) : null}
                    <TabsTrigger
                      value='logs'
                      className='h-11 rounded-xl border-transparent px-5 text-base font-semibold text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:text-slate-400 dark:data-[state=active]:border-slate-600 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-white dark:data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_1px_2px_rgba(0,0,0,0.45)]'
                    >
                      Logs{' '}
                      <span className='ml-1 italic opacity-80'>
                        ({showSecretsManagement ? 9 : 8})
                      </span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value='overview' className='mt-0'>
                    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
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
                            {service.runtimeHealth.lastRestartAt ??
                              'Not recorded'}
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
                          <div>
                            Installed: {service.installed ? 'Yes' : 'No'}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className='pb-2'>
                          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                            <PackageCheck className='size-4' /> Updates
                          </CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-3 text-sm'>
                          <div className='flex items-center justify-between gap-3'>
                            <span className='font-medium'>Status</span>
                            <ServiceUpdateBadge updates={service.updates} />
                          </div>
                          <p className='text-muted-foreground'>
                            {getServiceUpdateDescription(service.updates)}
                          </p>
                          {service.updates?.installDeferred?.nextEligibleAt ? (
                            <p className='text-xs text-muted-foreground'>
                              Next eligible:{' '}
                              {service.updates.installDeferred.nextEligibleAt}
                            </p>
                          ) : null}
                          <ServiceUpdateActions
                            updates={service.updates}
                            pending={updateAction.isPending}
                            onAction={(action) =>
                              updateAction.mutate({
                                action,
                                serviceId: service.id,
                              })
                            }
                          />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className='pb-2'>
                          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                            <HeartPulse className='size-4' /> Recovery
                          </CardTitle>
                        </CardHeader>
                        <CardContent className='space-y-3 text-sm'>
                          <div className='flex items-center justify-between gap-3'>
                            <span className='font-medium'>Status</span>
                            <ServiceRecoveryBadge recovery={service.recovery} />
                          </div>
                          <p className='text-muted-foreground'>
                            {getServiceRecoveryDescription(service.recovery)}
                          </p>
                          <div className='text-xs text-muted-foreground'>
                            Events: {service.recovery?.events.length ?? 0}
                          </div>
                          <ServiceRecoveryDoctorButton serviceId={service.id} />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className='pb-2'>
                          <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                            <Wrench className='size-4' /> Actions
                          </CardTitle>
                        </CardHeader>
                        <CardContent className='flex flex-wrap gap-2'>
                          {service.actions.map((action) => (
                            <ServiceActionButton
                              key={action.id}
                              action={action}
                              service={service}
                            />
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value='dependencies' className='mt-0 space-y-4'>
                    <LocalDependencyGraph service={service} />

                    <Card>
                      <CardHeader>
                        <CardTitle>Relationship lists</CardTitle>
                        <CardDescription>
                          Direct dependencies and dependents for this service.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className='grid gap-5 lg:grid-cols-2'>
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
                  </TabsContent>

                  <TabsContent value='setup' className='mt-0'>
                    <ServiceSetupPanel
                      setup={setupQuery.data}
                      loading={setupQuery.isLoading}
                      pendingStepId={pendingSetupStepId}
                      forceRerun={forceSetupRerun}
                      onForceRerunChange={setForceSetupRerun}
                      onRunAll={() => runSetup()}
                      onRunStep={(stepId) => runSetup(stepId)}
                    />
                  </TabsContent>

                  <TabsContent value='access' className='mt-0'>
                    <ServiceAccessPanel service={service} />
                  </TabsContent>

                  <TabsContent value='metadata' className='mt-0'>
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
                  </TabsContent>

                  <TabsContent value='endpoints' className='mt-0'>
                    <Card>
                      <CardHeader>
                        <CardTitle className='flex items-center gap-2'>
                          <Link2 className='size-4' /> Endpoints
                        </CardTitle>
                        <CardDescription>
                          Resolved endpoint records, selectors, exposure, and
                          resolution state for this service.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <EndpointsTable endpoints={service.endpoints} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value='variables' className='mt-0'>
                    <Card>
                      <CardHeader>
                        <CardTitle>Environment variables</CardTitle>
                        <CardDescription>
                          Service-local and shared environment values surfaced
                          in a searchable top-level Variables page as well.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className='space-y-4'>
                        <EnvironmentTable
                          serviceId={service.id}
                          variables={service.environmentVariables}
                        />
                        <div className='flex justify-end'>
                          <Button variant='outline' size='sm' asChild>
                            <Link
                              to='/variables'
                              search={{ service: service.id }}
                            >
                              Open all variables
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {showSecretsManagement ? (
                    <TabsContent value='secrets' className='mt-0 space-y-4'>
                      <SecretsBrokerOperationsPanel />
                      <SecretsBrokerLifecyclePanel />
                      <SecretsBrokerSecretsPanel
                        rotationOperationId={rotationOperationId}
                        onRotationOperationChange={onRotationOperationChange}
                      />
                    </TabsContent>
                  ) : null}

                  <TabsContent value='logs' className='mt-0'>
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
                        <ServiceLogViewer entries={service.recentLogs} />
                        <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
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
                            <Link
                              to='/runtime'
                              search={{ service: service.id }}
                            >
                              Open runtime view
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )
          })()
        )}
      </Main>
    </>
  )
}
