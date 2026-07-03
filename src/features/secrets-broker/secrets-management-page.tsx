import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  CheckCircle2,
  DatabaseZap,
  Eye,
  ListChecks,
  PlugZap,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { usePageMetadata } from '@/lib/page-metadata'
import {
  fetchSecretsBrokerOverview,
  type SecretsBrokerLiveState,
  type SecretsBrokerOverview,
} from '@/lib/secrets-broker/client'
import { isServiceAdminStubModeEnabled } from '@/lib/service-lasso-dashboard/stub'
import { cn } from '@/lib/utils'
import { type NavigateFn, useTableUrlState } from '@/hooks/use-table-url-state'
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
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfigDrawer } from '@/components/config-drawer'
import {
  DataTableColumnHeader,
  DataTablePagination,
  DataTableToolbar,
} from '@/components/data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  buildBulkSecretCampaignPlan,
  buildBulkSecretCampaignApplyGate,
  buildBulkSecretCampaignApplyResult,
  buildBulkSecretCampaignClosureReview,
  buildBulkSecretCampaignOperatorHandoff,
  buildBulkSecretCampaignOwnerActionTicket,
  buildBulkSecretCampaignRecoveryChecklist,
  buildManagedSecretActionPreview,
  buildManagedSecretActionReadiness,
  buildSingleSecretDecommissionPreview,
  buildSingleSecretEditPreview,
  buildSingleSecretAuditReceipt,
  buildSingleSecretEvidenceBundle,
  buildSingleSecretExportGuardrail,
  buildSingleSecretConfirmationReceipt,
  buildSingleSecretClosureReview,
  buildSingleSecretLeakEvidence,
  buildSingleSecretOperationHistoryReview,
  buildSingleSecretOperationAuditTrail,
  buildSingleSecretOperationHistoryEntry,
  buildSingleSecretPolicyPreview,
  buildSingleSecretOperatorHandoff,
  buildSingleSecretOwnerActionTicket,
  buildSingleSecretRecoveryDecision,
  buildSingleSecretRevealLifecycle,
  buildSingleSecretRevealPreview,
  buildSingleSecretRotationPreview,
  buildSingleSecretOperationResult,
  buildSingleSecretOperationPlan,
  buildSingleSecretReplayGuard,
  buildSingleSecretStatusMonitor,
  buildSingleSecretSubmitEnvelope,
  buildStubSecretMutationPreview,
  bulkSecretCampaignApplyModes,
  bulkSecretCampaignOperations,
  bulkSecretCampaignRevalidationStates,
  managedSecretAuditReasonHasSecretMaterial,
  managedSecretRows,
  singleSecretRevealLifecycleStates,
  singleSecretOperationOutcomes,
  stubSecretMutationStates,
  valueSearchManagedSecrets,
  type BulkSecretCampaignApplyMode,
  type BulkSecretCampaignApplyResult,
  type BulkSecretCampaignOperation,
  type BulkSecretCampaignRevalidationState,
  type ManagedSecretAction,
  type ManagedSecretRow,
  type ManagedSecretState,
  type SingleSecretOperationHistoryFilter,
  type SingleSecretRevealLifecycleState,
  type SingleSecretOperationHistoryEntry,
  type SingleSecretOperationOutcome,
  type SingleSecretOperationResult,
  type StubSecretMutationState,
} from './secrets-management'

const stateVariant: Record<
  ManagedSecretState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  present: 'default',
  missing: 'destructive',
  stale: 'secondary',
  'rotation-due': 'outline',
}

const stateOptions: Array<{ label: string; value: ManagedSecretState }> = [
  { label: 'Present', value: 'present' },
  { label: 'Rotation due', value: 'rotation-due' },
  { label: 'Stale', value: 'stale' },
  { label: 'Missing', value: 'missing' },
]

const liveStateVariant: Record<
  SecretsBrokerLiveState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  ready: 'default',
  loading: 'secondary',
  unavailable: 'destructive',
  'setup-needed': 'outline',
  locked: 'secondary',
  'auth-required': 'destructive',
  'policy-denied': 'destructive',
  unsupported: 'outline',
  degraded: 'destructive',
  'audit-unavailable': 'destructive',
}

const providerOptions = Array.from(
  new Set(managedSecretRows.map((row) => row.provider))
)
  .sort()
  .map((provider) => ({ label: provider, value: provider }))

const actionButtonLabels: Record<
  Exclude<ManagedSecretAction, 'metadata'>,
  string
> = {
  reveal: 'Controlled reveal',
  edit: 'Edit/update dry-run',
  reset: 'Reset/rotate dry-run',
  delete: 'Delete dry-run',
  policy: 'Apply policy preview',
}

const managedSecretActionValues: ManagedSecretAction[] = [
  'metadata',
  'reveal',
  'edit',
  'reset',
  'delete',
  'policy',
]

function isManagedSecretAction(value: unknown): value is ManagedSecretAction {
  return (
    typeof value === 'string' &&
    managedSecretActionValues.includes(value as ManagedSecretAction)
  )
}

function LiveSecretMetadata({
  overview,
  loading,
  error,
}: {
  overview: SecretsBrokerOverview | undefined
  loading: boolean
  error: boolean
}) {
  const visibleSources = overview?.sources.slice(0, 3) ?? []
  const managementAvailable = overview?.capabilities.managementSecrets ?? false

  return (
    <section
      aria-label='Live secret metadata status'
      className='rounded-md border p-4'
    >
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <div className='flex flex-wrap items-center gap-2 font-medium'>
            <PlugZap className='size-4' /> Live secret metadata status
            {overview ? (
              <Badge variant={liveStateVariant[overview.state]}>
                {overview.state}
              </Badge>
            ) : error ? (
              <Badge variant='destructive'>unavailable</Badge>
            ) : (
              <Badge variant='secondary'>loading</Badge>
            )}
          </div>
          <p className='mt-1 text-sm text-muted-foreground'>
            {overview
              ? overview.summary
              : error
                ? 'Live broker secret metadata could not be read from the runtime boundary.'
                : loading
                  ? 'Checking broker secret metadata and management capability.'
                  : 'Broker secret metadata has not returned yet.'}
          </p>
        </div>
        {overview ? (
          <Badge variant='outline'>
            {overview.stubMode ? 'stub fixture metadata' : 'runtime metadata'}
          </Badge>
        ) : null}
      </div>

      <div className='mt-3 grid gap-3 text-sm md:grid-cols-4'>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Sources
          </div>
          <div>{overview?.sourceCount ?? 0}</div>
        </div>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Management API
          </div>
          <div>{managementAvailable ? 'available' : 'blocked'}</div>
        </div>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Reveal API
          </div>
          <div>{overview?.capabilities.reveal ? 'available' : 'blocked'}</div>
        </div>
        <div>
          <div className='text-xs font-medium text-muted-foreground uppercase'>
            Audit
          </div>
          <div>{overview?.auditAvailable ? 'available' : 'blocked'}</div>
        </div>
      </div>

      {visibleSources.length ? (
        <div className='mt-3 grid gap-2 md:grid-cols-3'>
          {visibleSources.map((source) => (
            <div key={source.id} className='rounded-md border bg-muted/30 p-3'>
              <div className='flex flex-wrap items-center gap-2 text-sm'>
                <span className='font-medium'>{source.label}</span>
                <Badge variant='outline'>{source.state}</Badge>
              </div>
              <div className='mt-1 text-xs text-muted-foreground'>
                {source.provider} · {source.reason}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

type SecretsManagementPageProps = {
  search: Record<string, unknown>
  navigate: NavigateFn
}

export function SecretsManagementPage({
  search,
  navigate,
}: SecretsManagementPageProps) {
  const stubModeEnabled = isServiceAdminStubModeEnabled()
  const {
    data: liveOverview,
    isLoading: liveOverviewLoading,
    isError: liveOverviewError,
  } = useQuery({
    queryKey: ['secrets-broker', 'management-secrets', 'overview'],
    queryFn: fetchSecretsBrokerOverview,
  })
  const selectedSearchRef =
    typeof search.ref === 'string' ? search.ref.trim() : ''
  const selectedSearchRow =
    managedSecretRows.find(
      (row) => row.ref === selectedSearchRef || row.id === selectedSearchRef
    ) ?? null
  const selectedSearchAction = selectedSearchRow
    ? isManagedSecretAction(search.action)
      ? search.action
      : 'metadata'
    : 'metadata'
  const selectedSearchRowId = selectedSearchRow?.id ?? managedSecretRows[0].id
  const [valueQuery, setValueQuery] = useState('')
  const [valueSearchSupported, setValueSearchSupported] = useState(false)
  const [selectedRowId, setSelectedRowId] = useState(selectedSearchRowId)
  const [selectedAction, setSelectedAction] =
    useState<ManagedSecretAction>(selectedSearchAction)
  const [stubState, setStubState] = useState<StubSecretMutationState>('ready')
  const [auditReason, setAuditReason] = useState('')
  const [auditReasonRejected, setAuditReasonRejected] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [singleApplyResult, setSingleApplyResult] =
    useState<SingleSecretOperationResult | null>(null)
  const [singleOperationOutcome, setSingleOperationOutcome] =
    useState<SingleSecretOperationOutcome>('submitted')
  const [singleRevealLifecycleState, setSingleRevealLifecycleState] =
    useState<SingleSecretRevealLifecycleState>('pending')
  const [singleOperationHistory, setSingleOperationHistory] = useState<
    SingleSecretOperationHistoryEntry[]
  >([])
  const [singleHistoryFilter, setSingleHistoryFilter] =
    useState<SingleSecretOperationHistoryFilter>({
      action: 'all',
      outcome: 'all',
      query: '',
    })
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([
    managedSecretRows[0].id,
    managedSecretRows[1].id,
  ])
  const [bulkOperation, setBulkOperation] =
    useState<BulkSecretCampaignOperation>('rotate-reset')
  const [bulkPlanGenerated, setBulkPlanGenerated] = useState(false)
  const [bulkAuditReason, setBulkAuditReason] = useState('')
  const [bulkAuditReasonRejected, setBulkAuditReasonRejected] = useState(false)
  const [bulkConfirmation, setBulkConfirmation] = useState('')
  const [bulkRevalidationState, setBulkRevalidationState] =
    useState<BulkSecretCampaignRevalidationState>('ready')
  const [bulkRevalidated, setBulkRevalidated] = useState(false)
  const [bulkApplyMode, setBulkApplyMode] =
    useState<BulkSecretCampaignApplyMode>('success')
  const [bulkApplyResult, setBulkApplyResult] =
    useState<BulkSecretCampaignApplyResult | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: 10 },
    globalFilter: { key: 'secret' },
    columnFilters: [
      { columnId: 'provider', searchKey: 'provider', type: 'array' },
      { columnId: 'state', searchKey: 'state', type: 'array' },
    ],
  })

  usePageMetadata({
    title: 'Service Admin - Secrets Broker Secrets',
    description:
      'Searchable metadata-first Secrets Broker management table for controlled reveal, dry-run edit/reset, and policy preview actions.',
  })

  const valueSearchRows = useMemo(
    () =>
      valueSearchManagedSecrets(
        managedSecretRows,
        valueQuery,
        valueSearchSupported
      ),
    [valueQuery, valueSearchSupported]
  )
  const selectedRow =
    managedSecretRows.find((row) => row.id === selectedRowId) ??
    managedSecretRows[0]
  const actionPreview = buildManagedSecretActionPreview(
    selectedRow,
    selectedAction
  )
  const selectedActionReadiness = buildManagedSecretActionReadiness(selectedRow)
  const selectedActionReadinessDetail =
    selectedActionReadiness.find((item) => item.action === selectedAction) ??
    null
  const stubMutationPreview = buildStubSecretMutationPreview(
    selectedRow,
    selectedAction === 'metadata' || selectedAction === 'policy'
      ? 'edit'
      : selectedAction,
    stubState,
    auditReason,
    confirmed
  )
  const singleOperationPlan = buildSingleSecretOperationPlan(
    selectedRow,
    selectedAction,
    auditReason,
    confirmed,
    stubState
  )
  const singleSubmitEnvelope = buildSingleSecretSubmitEnvelope(
    selectedRow,
    singleOperationPlan
  )
  const singleConfirmationReceipt = buildSingleSecretConfirmationReceipt(
    selectedRow,
    singleOperationPlan,
    singleSubmitEnvelope,
    auditReason,
    confirmed
  )
  const singleReplayGuard = buildSingleSecretReplayGuard(
    selectedRow,
    singleOperationPlan,
    singleSubmitEnvelope
  )
  const singleLeakEvidence = buildSingleSecretLeakEvidence(
    selectedRow,
    singleOperationPlan,
    singleSubmitEnvelope
  )
  const singleExportGuardrail = buildSingleSecretExportGuardrail(
    selectedRow,
    singleOperationPlan,
    singleSubmitEnvelope
  )
  const editPreview =
    selectedAction === 'edit'
      ? buildSingleSecretEditPreview(selectedRow, singleOperationPlan)
      : null
  const revealPreview =
    selectedAction === 'reveal'
      ? buildSingleSecretRevealPreview(selectedRow, singleOperationPlan)
      : null
  const revealLifecycle = revealPreview
    ? buildSingleSecretRevealLifecycle(
        selectedRow,
        revealPreview,
        singleRevealLifecycleState
      )
    : null
  const rotationPreview =
    selectedAction === 'reset'
      ? buildSingleSecretRotationPreview(selectedRow, singleOperationPlan)
      : null
  const decommissionPreview =
    selectedAction === 'delete'
      ? buildSingleSecretDecommissionPreview(selectedRow, singleOperationPlan)
      : null
  const policyPreview =
    selectedAction === 'policy'
      ? buildSingleSecretPolicyPreview(selectedRow, singleOperationPlan)
      : null
  const bulkPlan = useMemo(
    () =>
      buildBulkSecretCampaignPlan(
        managedSecretRows,
        bulkSelectedIds,
        bulkOperation
      ),
    [bulkOperation, bulkSelectedIds]
  )
  const bulkApplyGate = buildBulkSecretCampaignApplyGate(
    bulkPlan,
    bulkAuditReason,
    bulkConfirmation,
    bulkRevalidationState,
    bulkRevalidated,
    bulkPlan.applyAvailable
  )
  const bulkClosureReview = bulkApplyResult
    ? buildBulkSecretCampaignClosureReview(bulkApplyResult)
    : null
  const bulkOperatorHandoff =
    bulkApplyResult && bulkClosureReview
      ? buildBulkSecretCampaignOperatorHandoff(
          bulkApplyResult,
          bulkClosureReview
        )
      : null
  const bulkOwnerActionTicket = bulkOperatorHandoff
    ? buildBulkSecretCampaignOwnerActionTicket(bulkOperatorHandoff)
    : null
  const bulkRecoveryChecklist =
    bulkApplyResult && bulkOperatorHandoff && bulkOwnerActionTicket
      ? buildBulkSecretCampaignRecoveryChecklist(
          bulkApplyResult,
          bulkOperatorHandoff,
          bulkOwnerActionTicket
        )
      : null
  const singleOperationAuditTrail = singleApplyResult
    ? buildSingleSecretOperationAuditTrail(
        selectedRow,
        singleOperationPlan,
        singleApplyResult.outcome
      )
    : []
  const singleAuditReceipt =
    singleApplyResult && singleOperationAuditTrail.length > 0
      ? buildSingleSecretAuditReceipt(
          selectedRow,
          singleOperationPlan,
          singleApplyResult,
          singleOperationAuditTrail
        )
      : null
  const singleStatusMonitor = singleApplyResult
    ? buildSingleSecretStatusMonitor(
        selectedRow,
        singleOperationPlan,
        singleApplyResult
      )
    : null
  const singleEvidenceBundle =
    singleApplyResult && singleStatusMonitor
      ? buildSingleSecretEvidenceBundle(
          selectedRow,
          singleOperationPlan,
          singleApplyResult,
          singleStatusMonitor
        )
      : null
  const singleRecoveryDecision =
    singleApplyResult && singleStatusMonitor
      ? buildSingleSecretRecoveryDecision(
          selectedRow,
          singleOperationPlan,
          singleApplyResult,
          singleStatusMonitor
        )
      : null
  const singleOperatorHandoff =
    singleApplyResult && singleStatusMonitor && singleRecoveryDecision
      ? buildSingleSecretOperatorHandoff(
          selectedRow,
          singleOperationPlan,
          singleApplyResult,
          singleStatusMonitor,
          singleRecoveryDecision
        )
      : null
  const singleOwnerActionTicket = singleOperatorHandoff
    ? buildSingleSecretOwnerActionTicket(
        selectedRow,
        singleOperationPlan,
        singleOperatorHandoff
      )
    : null
  const singleClosureReview =
    singleApplyResult &&
    singleStatusMonitor &&
    singleEvidenceBundle &&
    singleAuditReceipt &&
    singleOperatorHandoff &&
    singleOwnerActionTicket
      ? buildSingleSecretClosureReview(
          selectedRow,
          singleOperationPlan,
          singleApplyResult,
          singleStatusMonitor,
          singleEvidenceBundle,
          singleAuditReceipt,
          singleOperatorHandoff,
          singleOwnerActionTicket
        )
      : null
  const singleHistoryReview = useMemo(
    () =>
      buildSingleSecretOperationHistoryReview(
        singleOperationHistory,
        singleHistoryFilter
      ),
    [singleOperationHistory, singleHistoryFilter]
  )

  const resetBulkApplyGate = useCallback(() => {
    setBulkRevalidated(false)
    setBulkApplyResult(null)
  }, [])

  function setSafeSingleAuditReason(nextReason: string) {
    if (managedSecretAuditReasonHasSecretMaterial(nextReason)) {
      setAuditReason('')
      setAuditReasonRejected(true)
    } else {
      setAuditReason(nextReason)
      setAuditReasonRejected(false)
    }
    setSingleApplyResult(null)
  }

  function setSafeBulkAuditReason(nextReason: string) {
    if (managedSecretAuditReasonHasSecretMaterial(nextReason)) {
      setBulkAuditReason('')
      setBulkAuditReasonRejected(true)
    } else {
      setBulkAuditReason(nextReason)
      setBulkAuditReasonRejected(false)
    }
    resetBulkApplyGate()
  }

  useEffect(() => {
    setSelectedRowId(selectedSearchRowId)
    setSelectedAction(selectedSearchAction)
    setSingleApplyResult(null)
  }, [selectedSearchAction, selectedSearchRowId])

  function resetBulkApplyResult() {
    setBulkApplyResult(null)
  }

  const chooseAction = useCallback(
    (rowId: string, action: ManagedSecretAction) => {
      const row = managedSecretRows.find((item) => item.id === rowId)
      const isDefaultSelection =
        row?.id === managedSecretRows[0].id && action === 'metadata'
      setSelectedRowId(rowId)
      setSelectedAction(action)
      setSingleApplyResult(null)
      navigate({
        search: (prev) => ({
          ...(prev as Record<string, unknown>),
          ref: isDefaultSelection ? undefined : row?.ref,
          action: action === 'metadata' ? undefined : action,
        }),
      })
    },
    [navigate]
  )

  const toggleBulkSelection = useCallback(
    (rowId: string, checked: boolean) => {
      setBulkPlanGenerated(false)
      resetBulkApplyGate()
      setBulkSelectedIds((current) =>
        checked
          ? [...new Set([...current, rowId])]
          : current.filter((id) => id !== rowId)
      )
    },
    [resetBulkApplyGate]
  )

  function setOperation(operation: BulkSecretCampaignOperation) {
    setBulkPlanGenerated(false)
    resetBulkApplyGate()
    setBulkOperation(operation)
  }

  function applyBulkCampaign() {
    setBulkApplyResult(
      buildBulkSecretCampaignApplyResult(bulkPlan, bulkApplyMode)
    )
  }

  function applySingleSecretOperation() {
    const result = buildSingleSecretOperationResult(
      selectedRow,
      singleOperationPlan,
      singleOperationOutcome
    )
    setSingleApplyResult(result)
    setSingleOperationHistory((current) => [
      buildSingleSecretOperationHistoryEntry(
        selectedRow,
        singleOperationPlan,
        current.length + 1,
        singleOperationOutcome
      ),
      ...current,
    ])
    setStubState('success')
  }

  function cancelSingleSecretOperation() {
    const result = buildSingleSecretOperationResult(
      selectedRow,
      singleOperationPlan,
      'cancelled'
    )
    setSingleApplyResult(result)
    setSingleOperationHistory((current) => [
      buildSingleSecretOperationHistoryEntry(
        selectedRow,
        singleOperationPlan,
        current.length + 1,
        'cancelled'
      ),
      ...current,
    ])
    setAuditReason('')
    setConfirmed(false)
    setStubState('cancelled')
    setSingleOperationOutcome('submitted')
  }

  const columns = useMemo<ColumnDef<ManagedSecretRow>[]>(
    () => [
      {
        id: 'plan',
        header: 'Plan',
        cell: ({ row }) => (
          <input
            type='checkbox'
            aria-label={`Select ${row.original.name} for bulk dry-run`}
            checked={bulkSelectedIds.includes(row.original.id)}
            onChange={(event) =>
              toggleBulkSelection(row.original.id, event.target.checked)
            }
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: 'name',
        accessorFn: (row) =>
          [
            row.name,
            row.ref,
            row.owningService,
            row.provider,
            row.source,
            row.workspace,
            row.rotationStatus,
            row.policy,
            row.auditStatus,
            row.backendCapability,
            row.safeTags.join(' '),
          ].join(' '),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Secret ref' />
        ),
        cell: ({ row }) => (
          <div className='min-w-80 align-top'>
            <div className='font-medium'>{row.original.name}</div>
            <div className='text-sm break-all text-muted-foreground'>
              {row.original.ref}
            </div>
            <div className='mt-2 flex flex-wrap gap-1'>
              {row.original.safeTags.map((tag) => (
                <Badge key={tag} variant='outline'>
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        ),
        filterFn: (row, id, value) =>
          String(row.getValue(id))
            .toLowerCase()
            .includes(String(value).toLowerCase()),
        enableHiding: false,
      },
      {
        accessorKey: 'provider',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Owner / provider' />
        ),
        cell: ({ row }) => (
          <div className='min-w-56 align-top'>
            <div className='font-medium'>{row.original.owningService}</div>
            <div className='text-sm text-muted-foreground'>
              {row.original.provider} · {row.original.source}
            </div>
            <div className='text-xs text-muted-foreground'>
              {row.original.workspace}
            </div>
          </div>
        ),
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        accessorKey: 'state',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Status' />
        ),
        cell: ({ row }) => (
          <div className='min-w-48 align-top'>
            <Badge variant={stateVariant[row.original.state]}>
              {row.original.state}
            </Badge>
            <div className='mt-2 text-sm'>{row.original.rotationStatus}</div>
            <div className='text-xs text-muted-foreground'>
              Updated: {row.original.lastUpdatedAt}
            </div>
          </div>
        ),
        filterFn: (row, id, value) => value.includes(row.getValue(id)),
      },
      {
        accessorKey: 'policy',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title='Policy / audit' />
        ),
        cell: ({ row }) => (
          <div className='min-w-64 align-top text-sm'>
            <div className='break-all'>{row.original.policy}</div>
            <div className='mt-2 text-muted-foreground'>
              {row.original.auditStatus}
            </div>
            <div className='text-xs text-muted-foreground'>
              Capability: {row.original.backendCapability}
            </div>
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const readiness = buildManagedSecretActionReadiness(row.original)
          const readyCount = readiness.filter((item) => item.canPreview).length

          return (
            <div className='min-w-80 space-y-3 align-top'>
              <div className='text-xs text-muted-foreground'>
                Readiness: {readyCount} ready / {readiness.length - readyCount}{' '}
                blocked
              </div>
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => chooseAction(row.original.id, 'metadata')}
                >
                  View metadata
                </Button>
                {readiness.map((item) => (
                  <Button
                    key={item.action}
                    type='button'
                    size='sm'
                    variant={item.canPreview ? 'outline' : 'secondary'}
                    onClick={() => chooseAction(row.original.id, item.action)}
                  >
                    {actionButtonLabels[item.action]}
                  </Button>
                ))}
              </div>
              <div className='flex flex-wrap gap-1'>
                {readiness.map((item) => (
                  <Badge
                    key={`${item.action}-${item.status}`}
                    variant={item.canPreview ? 'outline' : 'secondary'}
                  >
                    {item.label}: {item.badge}
                  </Badge>
                ))}
              </div>
            </div>
          )
        },
        enableSorting: false,
      },
    ],
    [bulkSelectedIds, chooseAction, toggleBulkSelection]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: managedSecretRows,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onPaginationChange,
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue ?? '')
        .trim()
        .toLowerCase()
      if (!query) return true
      return [
        row.original.ref,
        row.original.name,
        row.original.owningService,
        row.original.provider,
        row.original.source,
        row.original.workspace,
        row.original.rotationStatus,
        row.original.policy,
        row.original.auditStatus,
        row.original.backendCapability,
        ...row.original.safeTags,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  useEffect(() => {
    ensurePageInRange(table.getPageCount())
  }, [table, ensurePageInRange])

  if (!stubModeEnabled) {
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

        <Main id='content' className='space-y-6'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div>
              <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
                <DatabaseZap className='size-5' /> Secrets
              </h1>
              <p className='mt-1 text-muted-foreground'>
                Secrets Broker management table for safe metadata search,
                controlled reveal entry, and dry-run edit/reset/delete/policy
                actions. Rows never render raw secret values.
              </p>
            </div>
            <Badge variant='outline'>Live API required</Badge>
          </div>

          <Alert>
            <ShieldCheck className='size-4' />
            <AlertTitle>Secrets Broker API unavailable</AlertTitle>
            <AlertDescription>
              No local stub data is rendered because Service Admin stub mode is
              disabled. Live metadata remains visible when the runtime exposes
              it, but fixture rows and simulated mutations stay hidden until the
              broker advertises supported management actions.
            </AlertDescription>
          </Alert>

          <LiveSecretMetadata
            overview={liveOverview}
            loading={liveOverviewLoading}
            error={liveOverviewError}
          />

          <Card>
            <CardHeader>
              <CardTitle>Secrets management unavailable</CardTitle>
              <CardDescription>
                The production mutation contract is not connected in this UI
                build, so fixture rows, stub previews, and simulated apply
                controls stay hidden by default.
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-wrap gap-2 text-sm text-muted-foreground'>
              <Badge variant='outline'>No fixture rows</Badge>
              <Badge variant='outline'>No simulated mutations</Badge>
              <Badge variant='outline'>No raw values</Badge>
            </CardContent>
          </Card>
        </Main>
      </>
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

      <Main id='content' className='space-y-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <DatabaseZap className='size-5' /> Secrets
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Search refs, review provider state, and launch dry-run actions
              without raw values.
            </p>
          </div>
          <Badge variant='secondary'>Stub preview · values hidden</Badge>
        </div>

        <LiveSecretMetadata
          overview={liveOverview}
          loading={liveOverviewLoading}
          error={liveOverviewError}
        />

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <ShieldCheck className='size-4' /> Operator queue
            </CardTitle>
            <CardDescription>
              Current controls are metadata-first and dry-run gated.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-3 md:grid-cols-3'>
            <div className='rounded-md border p-3 text-sm'>
              <div className='font-medium'>Find a ref</div>
              <div className='text-muted-foreground'>
                Use table search, filters, sorting, and pagination.
              </div>
            </div>
            <div className='rounded-md border p-3 text-sm'>
              <div className='font-medium'>Pick row action</div>
              <div className='text-muted-foreground'>
                Reveal, edit, reset, delete, and policy actions open previews.
              </div>
            </div>
            <div className='rounded-md border p-3 text-sm'>
              <div className='font-medium'>Dry-run before apply</div>
              <div className='text-muted-foreground'>
                Apply stays locked without preview, audit reason, and
                confirmation.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total refs</CardDescription>
              <CardTitle className='text-3xl'>
                {managedSecretRows.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Visible values</CardDescription>
              <CardTitle className='text-3xl'>0</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Preview actions</CardDescription>
              <CardTitle className='text-3xl'>5</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Bulk mutations</CardDescription>
              <CardTitle className='text-3xl'>0</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <DatabaseZap className='size-4' /> Search and value-search posture
            </CardTitle>
            <CardDescription>
              Table controls search safe metadata; value search returns
              refs/metadata only when the broker supports it.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-4 lg:grid-cols-2'>
            <div className='space-y-2'>
              <div className='text-sm font-medium text-muted-foreground'>
                Shared table metadata controls
              </div>
              <div className='rounded-md border bg-muted/40 p-3 text-sm'>
                Use the table toolbar below to search safe refs, owners,
                providers, tags, policy names, and audit metadata. The search
                index excludes raw values and provider credentials.
              </div>
              <div className='text-sm text-muted-foreground'>
                Metadata matches: {table.getFilteredRowModel().rows.length}
              </div>
            </div>

            <div className='space-y-2'>
              <label
                htmlFor='value-search'
                className='text-sm font-medium text-muted-foreground'
              >
                Broker-backed value search
              </label>
              <Input
                id='value-search'
                value={valueQuery}
                onChange={(event) => setValueQuery(event.target.value)}
                placeholder='Broker receives search request; UI receives refs only'
              />
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  variant={valueSearchSupported ? 'default' : 'outline'}
                  onClick={() => setValueSearchSupported(true)}
                >
                  Simulate supported value search
                </Button>
                <Button
                  type='button'
                  variant={!valueSearchSupported ? 'default' : 'outline'}
                  onClick={() => setValueSearchSupported(false)}
                >
                  Simulate unsupported value search
                </Button>
              </div>
              <div className='rounded-md border p-3 text-sm'>
                {valueSearchSupported ? (
                  <div>
                    Value search supported: {valueSearchRows.length} safe ref
                    metadata match
                    {valueSearchRows.length === 1 ? '' : 'es'} returned; raw
                    values are never returned to the table.
                  </div>
                ) : (
                  <div>
                    Value search unsupported by this broker/source; the table
                    fails closed and keeps raw values hidden.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Secrets management table</CardTitle>
            <CardDescription>
              Searchable safe metadata rows with controlled row actions and
              multi-ref selection for non-mutating campaign planning. Apply
              controls are represented as dry-run/preview states, not direct
              mutation.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <DataTableToolbar
              table={table}
              searchPlaceholder='Search secret metadata...'
              filters={[
                {
                  columnId: 'state',
                  title: 'State',
                  options: stateOptions,
                },
                {
                  columnId: 'provider',
                  title: 'Provider',
                  options: providerOptions,
                },
              ]}
            />
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className='group/row'>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className={cn(
                            'bg-background group-hover/row:bg-muted',
                            header.column.columnDef.meta?.className,
                            header.column.columnDef.meta?.thClassName
                          )}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className='group/row'>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              'bg-background align-top group-hover/row:bg-muted',
                              cell.column.columnDef.meta?.className,
                              cell.column.columnDef.meta?.tdClassName
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className='h-24 text-center'
                      >
                        No secrets match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination table={table} className='mt-auto' />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <ListChecks className='size-4' /> Bulk campaign dry-run planner
            </CardTitle>
            <CardDescription>
              Selected refs become a broker campaign plan, then supported
              rotate/reset/update, policy, and provider migration campaigns can
              apply through operation IDs.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]'>
              <div className='space-y-2'>
                <label
                  htmlFor='bulk-operation'
                  className='text-sm font-medium text-muted-foreground'
                >
                  Campaign operation
                </label>
                <select
                  id='bulk-operation'
                  className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                  value={bulkOperation}
                  onChange={(event) =>
                    setOperation(
                      event.target.value as BulkSecretCampaignOperation
                    )
                  }
                >
                  {bulkSecretCampaignOperations.map((operation) => (
                    <option key={operation.id} value={operation.id}>
                      {operation.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className='flex items-end'>
                <Button
                  type='button'
                  disabled={bulkSelectedIds.length === 0}
                  onClick={() => {
                    setBulkPlanGenerated(true)
                    resetBulkApplyGate()
                  }}
                >
                  Generate bulk dry-run plan
                </Button>
              </div>
            </div>

            <div className='grid gap-3 md:grid-cols-3 xl:grid-cols-6'>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  Selected
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.selectedCount}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  Applicable
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.applicableCount}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  Denied
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.deniedCount}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  Unsupported
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.unsupportedCount}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  Auth required
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.authRequiredCount}
                </div>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs text-muted-foreground uppercase'>
                  High risk
                </div>
                <div className='text-2xl font-semibold'>
                  {bulkPlan.highRiskCount}
                </div>
              </div>
            </div>

            {bulkSelectedIds.length === 0 ? (
              <div className='rounded-md border bg-muted/40 p-3'>
                No refs selected. Select at least one metadata row before
                generating a campaign dry-run plan.
              </div>
            ) : bulkPlanGenerated ? (
              <div className='overflow-x-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>Provider / target</TableHead>
                      <TableHead>Capability / policy</TableHead>
                      <TableHead>Risk / audit</TableHead>
                      <TableHead>Operation IDs</TableHead>
                      <TableHead>Expected action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkPlan.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className='min-w-72 align-top'>
                          <div className='font-medium'>{item.name}</div>
                          <div className='text-sm break-all text-muted-foreground'>
                            {item.ref}
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            {item.owningService}
                          </div>
                        </TableCell>
                        <TableCell className='min-w-56 align-top'>
                          <div>{item.sourceProvider}</div>
                          <div className='mt-2 text-xs text-muted-foreground'>
                            Target: {item.targetProvider}
                          </div>
                          <div className='text-xs break-all text-muted-foreground'>
                            {item.targetPolicy}
                          </div>
                        </TableCell>
                        <TableCell className='min-w-64 align-top'>
                          <div>{item.capabilityResult}</div>
                          <div className='mt-2 text-muted-foreground'>
                            {item.policyResult}
                          </div>
                          {item.blockers.length > 0 ? (
                            <div className='mt-2 flex flex-wrap gap-1'>
                              {item.blockers.map((blocker) => (
                                <Badge key={blocker} variant='outline'>
                                  {blocker}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className='min-w-56 align-top'>
                          <Badge
                            variant={
                              item.risk === 'high' ? 'destructive' : 'outline'
                            }
                          >
                            {item.risk} risk
                          </Badge>
                          <div className='mt-2 text-muted-foreground'>
                            {item.auditRequirement}
                          </div>
                        </TableCell>
                        <TableCell className='min-w-72 align-top text-xs'>
                          <div className='break-all'>
                            Item: {item.operationItemId}
                          </div>
                          <div className='mt-2 break-all text-muted-foreground'>
                            Idempotency: {item.idempotencyKey}
                          </div>
                          <Badge className='mt-2' variant='outline'>
                            {item.retrySafe ? 'retry safe' : 'fresh plan first'}
                          </Badge>
                        </TableCell>
                        <TableCell className='min-w-56 align-top'>
                          {item.expectedAction}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className='rounded-md border bg-muted/40 p-3'>
                {bulkPlan.selectedCount} refs selected. Generate dry-run to
                calculate capability, policy, risk, audit, and blocker metadata.
              </div>
            )}

            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                disabled={!bulkApplyGate.canApply}
                onClick={applyBulkCampaign}
              >
                Apply bulk campaign
              </Button>
              <Badge variant='secondary'>Dry-run plus revalidation</Badge>
              <Badge variant={bulkPlan.applyAvailable ? 'default' : 'outline'}>
                {bulkPlan.applyAvailable
                  ? 'Broker campaign API wired'
                  : 'Apply unavailable for this operation'}
              </Badge>
              <Badge variant='outline'>No raw values</Badge>
              <Badge variant='outline'>No provider credentials</Badge>
              <Badge variant='outline'>No export</Badge>
            </div>

            {bulkPlanGenerated ? (
              <div className='grid gap-4 rounded-md border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]'>
                <div className='space-y-4'>
                  <div>
                    <h3 className='font-medium'>
                      Campaign confirmation and revalidation
                    </h3>
                    <p className='mt-1 text-muted-foreground'>
                      Apply remains fail-closed until audit reason,
                      confirmation, and immediate revalidation all pass. Denied,
                      unsupported, auth-required, skipped, failed, and stale
                      items remain typed per row.
                    </p>
                  </div>

                  <div className='grid gap-3 md:grid-cols-3'>
                    <div className='space-y-2'>
                      <label
                        htmlFor='bulk-audit-reason'
                        className='text-sm font-medium text-muted-foreground'
                      >
                        Campaign audit reason
                      </label>
                      <Input
                        id='bulk-audit-reason'
                        value={bulkAuditReason}
                        onChange={(event) => {
                          setSafeBulkAuditReason(event.target.value)
                        }}
                        placeholder='Required before revalidation'
                      />
                      {bulkAuditReasonRejected ? (
                        <div className='text-xs text-destructive'>
                          Secret-like material was rejected; enter operator
                          intent only.
                        </div>
                      ) : null}
                    </div>

                    <div className='space-y-2'>
                      <label
                        htmlFor='bulk-confirmation'
                        className='text-sm font-medium text-muted-foreground'
                      >
                        Explicit confirmation
                      </label>
                      <Input
                        id='bulk-confirmation'
                        value={bulkConfirmation}
                        onChange={(event) => {
                          setBulkConfirmation(event.target.value)
                          resetBulkApplyGate()
                        }}
                        placeholder={bulkApplyGate.confirmationPhrase}
                      />
                      <div className='text-xs text-muted-foreground'>
                        Required phrase: {bulkApplyGate.confirmationPhrase}
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <label
                        htmlFor='bulk-apply-mode'
                        className='text-sm font-medium text-muted-foreground'
                      >
                        Apply result mode
                      </label>
                      <select
                        id='bulk-apply-mode'
                        className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                        value={bulkApplyMode}
                        onChange={(event) => {
                          setBulkApplyMode(
                            event.target.value as BulkSecretCampaignApplyMode
                          )
                          resetBulkApplyResult()
                        }}
                      >
                        {bulkSecretCampaignApplyModes.map((mode) => (
                          <option key={mode.id} value={mode.id}>
                            {mode.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]'>
                    <div className='space-y-2'>
                      <label
                        htmlFor='bulk-revalidation-state'
                        className='text-sm font-medium text-muted-foreground'
                      >
                        Revalidation outcome
                      </label>
                      <select
                        id='bulk-revalidation-state'
                        className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                        value={bulkRevalidationState}
                        onChange={(event) => {
                          setBulkRevalidationState(
                            event.target
                              .value as BulkSecretCampaignRevalidationState
                          )
                          resetBulkApplyGate()
                        }}
                      >
                        {bulkSecretCampaignRevalidationStates.map((state) => (
                          <option key={state.id} value={state.id}>
                            {state.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className='flex items-end'>
                      <Button
                        type='button'
                        variant='outline'
                        disabled={!bulkApplyGate.auditReasonAccepted}
                        onClick={() => setBulkRevalidated(true)}
                      >
                        Revalidate dry-run
                      </Button>
                    </div>
                  </div>
                </div>

                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='mb-3 flex flex-wrap gap-2'>
                    <Badge
                      variant={
                        bulkApplyGate.revalidationPassed
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {bulkApplyGate.revalidationPassed
                        ? 'Revalidated'
                        : 'Revalidation blocked'}
                    </Badge>
                    <Badge variant='outline'>
                      {bulkApplyGate.applyDisabledReason}
                    </Badge>
                  </div>

                  <dl className='space-y-2'>
                    <div>
                      <dt className='text-muted-foreground'>Campaign</dt>
                      <dd className='break-all'>{bulkPlan.campaignId}</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>Operation</dt>
                      <dd className='break-all'>{bulkPlan.operationId}</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>
                        Revalidation status
                      </dt>
                      <dd>{bulkApplyGate.revalidationStatus}</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>Apply state</dt>
                      <dd>
                        {bulkApplyGate.canApply
                          ? 'campaign apply ready'
                          : 'campaign apply disabled'}
                      </dd>
                    </div>
                  </dl>

                  <ul className='mt-3 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {bulkApplyGate.statusRows.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>

                  {bulkApplyGate.blockers.length > 0 ? (
                    <div className='mt-3 space-y-1'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Blockers
                      </div>
                      <div className='flex flex-wrap gap-1'>
                        {bulkApplyGate.blockers.map((blocker) => (
                          <Badge key={blocker} variant='outline'>
                            {blocker}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {bulkApplyResult ? (
              <div className='space-y-4 rounded-md border p-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div>
                    <h3 className='font-medium'>
                      Campaign apply result: {bulkApplyResult.outcome}
                    </h3>
                    <p className='mt-1 text-muted-foreground'>
                      {bulkApplyResult.auditStatus}; next action:{' '}
                      {bulkApplyResult.nextAction}.
                    </p>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <Badge variant='default'>
                      Applied {bulkApplyResult.appliedCount}
                    </Badge>
                    <Badge variant='outline'>
                      Failed {bulkApplyResult.failedCount}
                    </Badge>
                    <Badge variant='outline'>
                      Denied {bulkApplyResult.deniedCount}
                    </Badge>
                    <Badge variant='outline'>
                      Skipped {bulkApplyResult.skippedCount}
                    </Badge>
                    <Badge variant='outline'>
                      Unsupported {bulkApplyResult.unsupportedCount}
                    </Badge>
                    <Badge variant='outline'>
                      Auth {bulkApplyResult.authRequiredCount}
                    </Badge>
                    <Badge variant='outline'>
                      Audit {bulkApplyResult.auditUnavailableCount}
                    </Badge>
                    <Badge variant='outline'>
                      Provider {bulkApplyResult.providerUnavailableCount}
                    </Badge>
                    <Badge variant='outline'>
                      Stale {bulkApplyResult.staleCount}
                    </Badge>
                  </div>
                </div>

                <div className='grid gap-3 md:grid-cols-3'>
                  <div className='rounded-md border p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Campaign ID
                    </div>
                    <div className='mt-1 break-all'>
                      {bulkApplyResult.campaignId}
                    </div>
                  </div>
                  <div className='rounded-md border p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Operation ID
                    </div>
                    <div className='mt-1 break-all'>
                      {bulkApplyResult.operationId}
                    </div>
                  </div>
                  <div className='rounded-md border p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Plan token
                    </div>
                    <div className='mt-1 break-all'>
                      {bulkApplyResult.planToken}
                    </div>
                  </div>
                </div>

                <div className='overflow-x-auto rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ref</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead>Operation identity</TableHead>
                        <TableHead>Audit / recovery</TableHead>
                        <TableHead>Next action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkApplyResult.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className='min-w-72 align-top'>
                            <div className='font-medium'>{item.name}</div>
                            <div className='text-sm break-all text-muted-foreground'>
                              {item.ref}
                            </div>
                          </TableCell>
                          <TableCell className='min-w-40 align-top'>
                            <Badge
                              variant={
                                item.outcome === 'applied'
                                  ? 'default'
                                  : item.outcome === 'failed'
                                    ? 'destructive'
                                    : item.outcome === 'audit-unavailable' ||
                                        item.outcome === 'provider-unavailable'
                                      ? 'secondary'
                                      : 'outline'
                              }
                            >
                              {item.outcome}
                            </Badge>
                            <div className='mt-2 text-xs text-muted-foreground'>
                              {item.applied ? 'Applied' : 'Not applied'}
                            </div>
                          </TableCell>
                          <TableCell className='min-w-72 align-top text-xs'>
                            <div className='break-all'>
                              Item: {item.operationItemId}
                            </div>
                            <div className='mt-2 break-all text-muted-foreground'>
                              Idempotency: {item.idempotencyKey}
                            </div>
                            <Badge className='mt-2' variant='outline'>
                              {item.retrySafe
                                ? 'retry by operation id'
                                : 'fresh plan required'}
                            </Badge>
                          </TableCell>
                          <TableCell className='min-w-64 align-top'>
                            <div>{item.auditStatus}</div>
                            <div className='mt-2 text-muted-foreground'>
                              {item.recovery}
                            </div>
                          </TableCell>
                          <TableCell className='min-w-56 align-top'>
                            {item.nextAction}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {bulkClosureReview ? (
                  <div className='grid gap-4 rounded-md border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]'>
                    <div className='space-y-4'>
                      <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div>
                          <h3 className='font-medium'>
                            Bulk campaign closure review
                          </h3>
                          <p className='mt-1 text-muted-foreground'>
                            {bulkClosureReview.canCloseCampaignReview
                              ? 'Campaign review can close after audit acknowledgement.'
                              : bulkClosureReview.reviewState === 'monitoring'
                                ? 'Campaign review stays open while retry-safe item recovery is monitored.'
                                : 'Campaign review is blocked until recovery creates a fresh plan.'}
                          </p>
                        </div>
                        <Badge
                          variant={
                            bulkClosureReview.canCloseCampaignReview
                              ? 'default'
                              : bulkClosureReview.reviewState === 'monitoring'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {bulkClosureReview.reviewState}
                        </Badge>
                      </div>

                      <dl className='grid gap-3 md:grid-cols-3'>
                        <div>
                          <dt className='text-muted-foreground'>Closure ID</dt>
                          <dd className='break-all'>
                            {bulkClosureReview.closureId}
                          </dd>
                        </div>
                        <div>
                          <dt className='text-muted-foreground'>Outcome</dt>
                          <dd>{bulkClosureReview.outcome}</dd>
                        </div>
                        <div>
                          <dt className='text-muted-foreground'>
                            Close decision
                          </dt>
                          <dd>
                            {bulkClosureReview.canCloseCampaignReview
                              ? 'operator review can close'
                              : 'operator review remains open'}
                          </dd>
                        </div>
                      </dl>

                      <div className='grid gap-3 md:grid-cols-2'>
                        <div>
                          <div className='text-xs font-medium text-muted-foreground uppercase'>
                            Required before close
                          </div>
                          <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                            {bulkClosureReview.requiredBeforeClose.map(
                              (item) => (
                                <li key={item}>{item}</li>
                              )
                            )}
                          </ul>
                        </div>
                        <div>
                          <div className='text-xs font-medium text-muted-foreground uppercase'>
                            Item outcome summary
                          </div>
                          <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                            {bulkClosureReview.itemOutcomeSummary.map(
                              (item) => (
                                <li key={item}>{item}</li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>

                      <div className='space-y-2'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Safe closure evidence
                        </div>
                        <ul className='list-disc space-y-1 ps-5 text-muted-foreground'>
                          {bulkClosureReview.safeClosureRows.map((row) => (
                            <li key={row}>{row}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className='space-y-3 rounded-md bg-muted/40 p-3 text-sm'>
                      <div>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Retained evidence refs
                        </div>
                        <div className='mt-1 space-y-1'>
                          {bulkClosureReview.retainedEvidenceRefs.map((ref) => (
                            <div key={ref} className='break-all'>
                              {ref}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Audit refs
                        </div>
                        <div className='mt-1 space-y-1'>
                          {bulkClosureReview.auditRefs.map((ref) => (
                            <div key={ref} className='break-all'>
                              {ref}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Support refs
                        </div>
                        <div className='mt-1 space-y-1'>
                          {bulkClosureReview.supportRefs.map((ref) => (
                            <div key={ref} className='break-all'>
                              {ref}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Allowed closure fields
                        </div>
                        <div className='mt-1 flex flex-wrap gap-1'>
                          {bulkClosureReview.allowedClosureFields.map(
                            (field) => (
                              <Badge key={field} variant='outline'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      <div>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Omitted closure fields
                        </div>
                        <div className='mt-1 flex flex-wrap gap-1'>
                          {bulkClosureReview.omittedClosureFields.map(
                            (field) => (
                              <Badge key={field} variant='secondary'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {bulkOperatorHandoff && bulkOwnerActionTicket ? (
                  <div className='grid gap-4 rounded-md border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]'>
                    <div className='space-y-4'>
                      <div className='flex flex-wrap items-start justify-between gap-3'>
                        <div>
                          <h3 className='font-medium'>
                            Bulk campaign owner handoff
                          </h3>
                          <p className='mt-1 text-muted-foreground'>
                            {bulkOperatorHandoff.requiredAction}
                          </p>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                          <Badge
                            variant={
                              bulkOperatorHandoff.severity === 'critical'
                                ? 'destructive'
                                : bulkOperatorHandoff.severity === 'warning'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {bulkOperatorHandoff.severity}
                          </Badge>
                          <Badge variant='outline'>
                            {bulkOperatorHandoff.badge}
                          </Badge>
                        </div>
                      </div>

                      <dl className='grid gap-3 md:grid-cols-3'>
                        <div>
                          <dt className='text-muted-foreground'>Handoff ID</dt>
                          <dd className='break-all'>
                            {bulkOperatorHandoff.handoffId}
                          </dd>
                        </div>
                        <div>
                          <dt className='text-muted-foreground'>Owner lane</dt>
                          <dd>{bulkOperatorHandoff.lane}</dd>
                        </div>
                        <div>
                          <dt className='text-muted-foreground'>Owner</dt>
                          <dd>{bulkOperatorHandoff.owner}</dd>
                        </div>
                      </dl>

                      <div className='grid gap-3 md:grid-cols-2'>
                        <div>
                          <div className='text-xs font-medium text-muted-foreground uppercase'>
                            Safe handoff rows
                          </div>
                          <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                            {bulkOperatorHandoff.safeHandoffRows.map((row) => (
                              <li key={row}>{row}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className='text-xs font-medium text-muted-foreground uppercase'>
                            Owner action ticket
                          </div>
                          <dl className='mt-2 space-y-2 text-muted-foreground'>
                            <div>
                              <dt className='text-foreground'>Ticket ID</dt>
                              <dd className='break-all'>
                                {bulkOwnerActionTicket.ticketId}
                              </dd>
                            </div>
                            <div>
                              <dt className='text-foreground'>
                                Acknowledgement
                              </dt>
                              <dd>
                                {bulkOwnerActionTicket.acknowledgementStatus}
                              </dd>
                            </div>
                            <div>
                              <dt className='text-foreground'>
                                Escalation route
                              </dt>
                              <dd>
                                {bulkOwnerActionTicket.safeEscalationRoute}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      <div className='space-y-2'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Safe ticket rows
                        </div>
                        <ul className='list-disc space-y-1 ps-5 text-muted-foreground'>
                          {bulkOwnerActionTicket.safeTicketRows.map((row) => (
                            <li key={row}>{row}</li>
                          ))}
                        </ul>
                      </div>

                      {bulkRecoveryChecklist ? (
                        <div className='grid gap-3 rounded-md border bg-background p-3 md:grid-cols-2'>
                          <div>
                            <div className='text-xs font-medium text-muted-foreground uppercase'>
                              Bulk recovery checklist
                            </div>
                            <dl className='mt-2 space-y-2 text-muted-foreground'>
                              <div>
                                <dt className='text-foreground'>
                                  Checklist ID
                                </dt>
                                <dd className='break-all'>
                                  {bulkRecoveryChecklist.checklistId}
                                </dd>
                              </div>
                              <div>
                                <dt className='text-foreground'>
                                  Retry eligibility
                                </dt>
                                <dd>
                                  {bulkRecoveryChecklist.retryEligibility}
                                </dd>
                              </div>
                              <div>
                                <dt className='text-foreground'>
                                  Terminal evidence
                                </dt>
                                <dd>
                                  {
                                    bulkRecoveryChecklist.terminalEvidenceRequired
                                  }
                                </dd>
                              </div>
                            </dl>
                          </div>
                          <div>
                            <div className='text-xs font-medium text-muted-foreground uppercase'>
                              Checklist rows
                            </div>
                            <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                              {bulkRecoveryChecklist.safeChecklistRows.map(
                                (row) => (
                                  <li key={row}>{row}</li>
                                )
                              )}
                            </ul>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className='space-y-3 rounded-md bg-muted/40 p-3 text-sm'>
                      <div>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Shareable evidence refs
                        </div>
                        <div className='mt-1 space-y-1'>
                          {bulkOperatorHandoff.shareableEvidenceRefs.map(
                            (ref) => (
                              <div key={ref} className='break-all'>
                                {ref}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                      {bulkOperatorHandoff.blockedReason ? (
                        <div>
                          <div className='text-xs font-medium text-muted-foreground uppercase'>
                            Blocked reason
                          </div>
                          <div className='mt-1'>
                            {bulkOperatorHandoff.blockedReason}
                          </div>
                        </div>
                      ) : null}
                      <div>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Validator note
                        </div>
                        <div className='mt-1'>
                          {bulkOperatorHandoff.validatorNote}
                        </div>
                      </div>
                      <div>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Allowed handoff fields
                        </div>
                        <div className='mt-1 flex flex-wrap gap-1'>
                          {bulkOperatorHandoff.allowedHandoffFields.map(
                            (field) => (
                              <Badge key={field} variant='outline'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      <div>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Omitted ticket fields
                        </div>
                        <div className='mt-1 flex flex-wrap gap-1'>
                          {bulkOwnerActionTicket.omittedTicketFields.map(
                            (field) => (
                              <Badge key={field} variant='secondary'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      {bulkRecoveryChecklist ? (
                        <>
                          <div>
                            <div className='text-xs font-medium text-muted-foreground uppercase'>
                              Recovery item rows
                            </div>
                            <div className='mt-1 space-y-1'>
                              {bulkRecoveryChecklist.itemRecoveryRows.map(
                                (row) => (
                                  <div key={row}>{row}</div>
                                )
                              )}
                            </div>
                          </div>
                          <div>
                            <div className='text-xs font-medium text-muted-foreground uppercase'>
                              Omitted checklist fields
                            </div>
                            <div className='mt-1 flex flex-wrap gap-1'>
                              {bulkRecoveryChecklist.omittedChecklistFields.map(
                                (field) => (
                                  <Badge key={field} variant='secondary'>
                                    {field}
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              {actionPreview.action === 'reveal' ? (
                <Eye className='size-4' />
              ) : actionPreview.action === 'reset' ? (
                <RotateCcw className='size-4' />
              ) : actionPreview.action === 'delete' ? (
                <Trash2 className='size-4' />
              ) : (
                <SlidersHorizontal className='size-4' />
              )}
              {actionPreview.title}
            </CardTitle>
            <CardDescription>
              Selected row action preview. No apply occurs from this table
              without dry-run, audit reason, and explicit confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <Badge
              variant={
                actionPreview.requiresConfirmation ? 'outline' : 'secondary'
              }
            >
              {actionPreview.status}
            </Badge>
            <p>{actionPreview.preview}</p>
            <div className='rounded-md border bg-muted/40 p-3'>
              <div className='text-xs font-medium text-muted-foreground uppercase'>
                Next step
              </div>
              <div>{actionPreview.nextStep}</div>
            </div>
            {selectedActionReadinessDetail ? (
              <div className='grid gap-3 rounded-md border p-3 md:grid-cols-3'>
                <div>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Selected action readiness
                  </div>
                  <Badge
                    className='mt-1'
                    variant={
                      selectedActionReadinessDetail.canPreview
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {selectedActionReadinessDetail.badge}
                  </Badge>
                  <div className='mt-2 text-muted-foreground'>
                    {selectedActionReadinessDetail.nextStep}
                  </div>
                </div>
                <div>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Readiness blockers
                  </div>
                  {selectedActionReadinessDetail.blockers.length > 0 ? (
                    <div className='mt-2 flex flex-wrap gap-1'>
                      {selectedActionReadinessDetail.blockers.map((blocker) => (
                        <Badge key={blocker} variant='outline'>
                          {blocker}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className='mt-2 text-muted-foreground'>
                      No row-level blockers before the dry-run gate.
                    </div>
                  )}
                </div>
                <div>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Safe readiness checks
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {selectedActionReadinessDetail.safeChecks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            <div className='grid gap-3 rounded-md border p-3 md:grid-cols-3'>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Broker operation contract
                </div>
                <div className='mt-1 font-medium break-all'>
                  {singleOperationPlan.operationId}
                </div>
                <div className='mt-1 text-muted-foreground'>
                  {singleOperationPlan.endpoint}
                </div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Dry-run and policy
                </div>
                <div className='mt-1'>{singleOperationPlan.dryRunStatus}</div>
                <div className='mt-1 text-muted-foreground'>
                  {singleOperationPlan.policyDecision}
                </div>
              </div>
              <div>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Submit gate
                </div>
                <Badge
                  className='mt-1'
                  variant={
                    singleOperationPlan.canSubmit ? 'default' : 'secondary'
                  }
                >
                  {singleOperationPlan.applyGate}
                </Badge>
                <div className='mt-2 flex flex-wrap gap-1'>
                  {singleOperationPlan.safePayloadFields.map((field) => (
                    <Badge key={field} variant='outline'>
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className='grid gap-3 md:grid-cols-2'>
              <div className='rounded-md border p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Immediate revalidation checks
                </div>
                <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                  {singleOperationPlan.revalidationChecks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </div>
              <div className='rounded-md border p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Submit blockers
                </div>
                {singleOperationPlan.blockers.length > 0 ? (
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleOperationPlan.blockers.map((blocker) => (
                      <Badge key={blocker} variant='outline'>
                        {blocker}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className='mt-2 text-muted-foreground'>
                    No blockers after audit reason, confirmation, capability,
                    policy, and broker-state checks pass.
                  </div>
                )}
              </div>
            </div>
            <div className='rounded-md border p-3'>
              <div className='mb-3 flex flex-wrap items-center gap-2'>
                <ShieldCheck className='size-4 text-primary' />
                <div className='font-medium'>Metadata-only submit envelope</div>
                <Badge
                  variant={
                    singleSubmitEnvelope.readyForSubmit
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {singleSubmitEnvelope.readyForSubmit
                    ? 'Ready for broker submit'
                    : 'Submit blocked'}
                </Badge>
                <Badge variant='outline'>No raw payload</Badge>
              </div>
              <div className='grid gap-3 lg:grid-cols-4'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Endpoint
                  </div>
                  <div className='mt-1 break-all'>
                    {singleSubmitEnvelope.endpoint}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Idempotency
                  </div>
                  <div className='mt-1 break-all'>
                    {singleSubmitEnvelope.idempotencyKey}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Correlation
                  </div>
                  <div className='mt-1 break-all'>
                    {singleSubmitEnvelope.correlationId}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Gate
                  </div>
                  <div className='mt-1'>
                    {singleSubmitEnvelope.blockedReason}
                  </div>
                </div>
              </div>
              <div className='mt-3 grid gap-3 lg:grid-cols-2'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Allowed payload fields
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleSubmitEnvelope.payloadFields.map((field) => (
                      <Badge key={field} variant='outline'>
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Omitted unsafe fields
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleSubmitEnvelope.omittedFields.map((field) => (
                      <Badge key={field} variant='secondary'>
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className='mt-3 grid gap-3 md:grid-cols-3'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Transport
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {singleSubmitEnvelope.transportGuardrails.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Storage
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {singleSubmitEnvelope.storageGuardrails.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Diagnostics
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {singleSubmitEnvelope.diagnosticsGuardrails.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className='rounded-md border p-3'>
              <div className='mb-3 flex flex-wrap items-center gap-2'>
                <ShieldCheck className='size-4 text-primary' />
                <div className='font-medium'>Replay and idempotency guard</div>
                <Badge
                  variant={
                    singleReplayGuard.readyForReplaySafeSubmit
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {singleReplayGuard.readyForReplaySafeSubmit
                    ? 'Replay safe'
                    : 'Replay blocked'}
                </Badge>
                <Badge variant='outline'>No cross-ref replay</Badge>
              </div>
              <div className='grid gap-3 lg:grid-cols-4'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Scope
                  </div>
                  <div className='mt-1'>{singleReplayGuard.replayScope}</div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Plan fingerprint
                  </div>
                  <div className='mt-1 break-all'>
                    {singleReplayGuard.planFingerprint}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Binding
                  </div>
                  <div className='mt-1 break-all'>
                    {singleReplayGuard.selectedRefBinding}
                  </div>
                  <div className='mt-1 text-muted-foreground'>
                    {singleReplayGuard.actionBinding}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Decision
                  </div>
                  <div className='mt-1'>{singleReplayGuard.replayDecision}</div>
                </div>
              </div>
              <div className='mt-3 grid gap-3 lg:grid-cols-3'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Retry keys
                  </div>
                  <div className='mt-1 break-all'>
                    {singleReplayGuard.idempotencyKey}
                  </div>
                  <div className='mt-1 break-all text-muted-foreground'>
                    {singleReplayGuard.correlationId}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Stale plan guard
                  </div>
                  <div className='mt-1'>{singleReplayGuard.stalePlanGuard}</div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Omitted replay fields
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleReplayGuard.omittedReplayFields.map((field) => (
                      <Badge key={field} variant='secondary'>
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className='mt-3 grid gap-3 md:grid-cols-2'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Ref binding checks
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {singleReplayGuard.refBindingRows.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Safe replay evidence
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {singleReplayGuard.safeReplayRows.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className='rounded-md border p-3'>
              <div className='mb-3 flex flex-wrap items-center gap-2'>
                <DatabaseZap className='size-4 text-primary' />
                <div className='font-medium'>
                  Route and storage leak evidence
                </div>
                <Badge variant='secondary'>Metadata only</Badge>
                <Badge
                  variant={
                    singleLeakEvidence.safeForScreenshots
                      ? 'outline'
                      : 'destructive'
                  }
                >
                  Screenshot safe
                </Badge>
              </div>
              <div className='grid gap-3 lg:grid-cols-4'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Route
                  </div>
                  <div className='mt-1 break-all'>
                    {singleLeakEvidence.route}
                  </div>
                  <div className='mt-2 text-xs text-muted-foreground'>
                    {singleLeakEvidence.routeState}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Selected ref
                  </div>
                  <div className='mt-1 break-all'>
                    {singleLeakEvidence.selectedRef}
                  </div>
                  <div className='mt-2 text-xs text-muted-foreground'>
                    Action: {singleLeakEvidence.action}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Browser storage
                  </div>
                  <div className='mt-1'>
                    {singleLeakEvidence.browserStorageWrites}
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleLeakEvidence.browserStorageKeys.map((key) => (
                      <Badge key={key} variant='outline'>
                        {key}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Diagnostics
                  </div>
                  <div className='mt-1 break-all'>
                    {singleLeakEvidence.diagnosticsRef}
                  </div>
                  <div className='mt-2 text-xs break-all text-muted-foreground'>
                    {singleLeakEvidence.supportBundleRef}
                  </div>
                </div>
              </div>
              <div className='mt-3 grid gap-3 md:grid-cols-2'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Allowed route params
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleLeakEvidence.allowedRouteParams.map((param) => (
                      <Badge key={param} variant='outline'>
                        {param}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Omitted from browser surfaces
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleLeakEvidence.omittedFields.map((field) => (
                      <Badge key={field} variant='secondary'>
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Screenshot policy
                </div>
                <div className='mt-2'>
                  {singleLeakEvidence.screenshotPolicy}
                </div>
              </div>
              <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Safe evidence rows
                </div>
                <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                  {singleLeakEvidence.safeEvidenceRows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
                <div className='mt-3 text-xs break-all text-muted-foreground'>
                  Console event: {singleLeakEvidence.consoleEvent}
                </div>
              </div>
            </div>
            <div className='rounded-md border p-3'>
              <div className='mb-3 flex flex-wrap items-center gap-2'>
                <ListChecks className='size-4 text-primary' />
                <div className='font-medium'>Export and copy guardrail</div>
                <Badge variant='secondary'>Metadata only</Badge>
                <Badge variant='outline'>Raw export blocked</Badge>
              </div>
              <div className='grid gap-3 lg:grid-cols-4'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Guard
                  </div>
                  <div className='mt-1 break-all'>
                    {singleExportGuardrail.exportGuardId}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Operation
                  </div>
                  <div className='mt-1 break-all'>
                    {singleExportGuardrail.operationId}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Ref / action
                  </div>
                  <div className='mt-1 break-all'>
                    {singleExportGuardrail.ref}
                  </div>
                  <div className='mt-2 text-xs text-muted-foreground'>
                    {singleExportGuardrail.action}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Copy status
                  </div>
                  <div className='mt-1'>{singleExportGuardrail.copyStatus}</div>
                </div>
              </div>
              <div className='mt-3 grid gap-3 md:grid-cols-2'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Metadata export
                  </div>
                  <div className='mt-2'>
                    {singleExportGuardrail.metadataExportStatus}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Raw export
                  </div>
                  <div className='mt-2'>
                    {singleExportGuardrail.rawExportStatus}
                  </div>
                </div>
              </div>
              <div className='mt-3 grid gap-3 md:grid-cols-2'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Allowed export fields
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleExportGuardrail.allowedExportFields.map((field) => (
                      <Badge key={field} variant='outline'>
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Blocked export fields
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleExportGuardrail.blockedExportFields.map((field) => (
                      <Badge key={field} variant='secondary'>
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className='mt-3 grid gap-3 md:grid-cols-2'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Export routes
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {singleExportGuardrail.exportRoutes.map((route) => (
                      <li key={route}>{route}</li>
                    ))}
                  </ul>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Storage guardrails
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {singleExportGuardrail.storageGuardrails.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Safe export evidence
                </div>
                <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                  {singleExportGuardrail.safeExportRows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
              </div>
            </div>
            {revealPreview ? (
              <div className='rounded-md border p-3'>
                <div className='mb-3 flex flex-wrap items-center gap-2'>
                  <Eye className='size-4 text-primary' />
                  <div className='font-medium'>
                    Controlled reveal challenge preview
                  </div>
                  <Badge
                    variant={revealPreview.eligible ? 'default' : 'secondary'}
                  >
                    {revealPreview.badge}
                  </Badge>
                  <Badge variant='outline'>Value hidden</Badge>
                </div>
                <div className='grid gap-3 lg:grid-cols-4'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Challenge
                    </div>
                    <div className='mt-1 break-all'>
                      {revealPreview.revealChallengeId}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Expires
                    </div>
                    <div className='mt-1'>
                      {revealPreview.challengeExpiresAt}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Audit event
                    </div>
                    <div className='mt-1 break-all'>
                      {revealPreview.auditEventId}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Apply gate
                    </div>
                    <div className='mt-1'>{revealPreview.applyGate}</div>
                  </div>
                </div>
                <div className='mt-3 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Reveal window and auth
                    </div>
                    <div className='mt-2'>{revealPreview.revealWindow}</div>
                    <div className='mt-2 text-muted-foreground'>
                      {revealPreview.authRequirement}
                    </div>
                    <div className='mt-2 text-muted-foreground'>
                      {revealPreview.auditSinkStatus}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Dependent consumers
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {revealPreview.dependentConsumerRefs.map((ref) => (
                        <li key={ref}>{ref}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className='mt-3 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Display guardrails
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {revealPreview.displayGuardrails.map((guardrail) => (
                        <li key={guardrail}>{guardrail}</li>
                      ))}
                    </ul>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Safe metadata proof
                    </div>
                    <div className='mt-2'>{revealPreview.policyDecision}</div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {revealPreview.safeMetadataRows.map((row) => (
                        <li key={row}>{row}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {revealLifecycle ? (
                  <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                    <div className='mb-3 flex flex-wrap items-center gap-2'>
                      <div className='font-medium'>
                        Reveal challenge lifecycle
                      </div>
                      <Badge variant='secondary'>Metadata only</Badge>
                      <Badge variant='outline'>{revealLifecycle.badge}</Badge>
                    </div>
                    <div className='mb-3 max-w-sm space-y-2'>
                      <label
                        htmlFor='reveal-lifecycle-state'
                        className='text-sm font-medium text-muted-foreground'
                      >
                        Reveal lifecycle state
                      </label>
                      <select
                        id='reveal-lifecycle-state'
                        className='h-9 w-full rounded-md border bg-background px-3 text-sm'
                        value={singleRevealLifecycleState}
                        onChange={(event) =>
                          setSingleRevealLifecycleState(
                            event.target
                              .value as SingleSecretRevealLifecycleState
                          )
                        }
                      >
                        {singleSecretRevealLifecycleStates.map((state) => (
                          <option key={state.id} value={state.id}>
                            {state.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className='grid gap-3 lg:grid-cols-4'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Session ref
                        </div>
                        <div className='mt-1 break-all'>
                          {revealLifecycle.revealSessionRef}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Correlation
                        </div>
                        <div className='mt-1 break-all'>
                          {revealLifecycle.correlationId}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Revocation
                        </div>
                        <div className='mt-1 break-all'>
                          {revealLifecycle.revocationRef}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Value status
                        </div>
                        <div className='mt-1'>
                          {revealLifecycle.valueStatus}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-2'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Display status
                        </div>
                        <div className='mt-2'>
                          {revealLifecycle.displayStatus}
                        </div>
                        <div className='mt-2 text-muted-foreground'>
                          {revealLifecycle.nextAction}
                        </div>
                        {revealLifecycle.blockedReason ? (
                          <Badge className='mt-2' variant='outline'>
                            {revealLifecycle.blockedReason}
                          </Badge>
                        ) : null}
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Omitted unsafe fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {revealLifecycle.omittedUnsafeFields.map((field) => (
                            <Badge key={field} variant='secondary'>
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Safe lifecycle evidence
                      </div>
                      <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                        {revealLifecycle.safeEvidenceRows.map((row) => (
                          <li key={row}>{row}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
                {revealPreview.blockers.length > 0 ? (
                  <div className='mt-3 flex flex-wrap gap-1'>
                    {revealPreview.blockers.map((blocker) => (
                      <Badge key={blocker} variant='outline'>
                        {blocker}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {rotationPreview ? (
              <div className='rounded-md border p-3'>
                <div className='mb-3 flex flex-wrap items-center gap-2'>
                  <RotateCcw className='size-4 text-primary' />
                  <div className='font-medium'>Rotation safety preview</div>
                  <Badge
                    variant={rotationPreview.eligible ? 'default' : 'secondary'}
                  >
                    {rotationPreview.badge}
                  </Badge>
                  <Badge variant='outline'>No reveal required</Badge>
                </div>
                <div className='grid gap-3 lg:grid-cols-4'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Rotation plan
                    </div>
                    <div className='mt-1 break-all'>
                      {rotationPreview.rotationPlanRef}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Idempotency
                    </div>
                    <div className='mt-1 break-all'>
                      {rotationPreview.idempotencyRef}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Retry window
                    </div>
                    <div className='mt-1 break-all'>
                      {rotationPreview.retryWindowRef}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Apply gate
                    </div>
                    <div className='mt-1'>{rotationPreview.applyGate}</div>
                  </div>
                </div>
                <div className='mt-3 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Dependent services
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {rotationPreview.dependentServiceRefs.map((ref) => (
                        <li key={ref}>{ref}</li>
                      ))}
                    </ul>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Restart/reload refs
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {rotationPreview.restartPlanRefs.map((ref) => (
                        <li key={ref}>{ref}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Safe rotation proof
                  </div>
                  <div className='mt-2'>
                    {rotationPreview.providerCapabilityCheck}
                  </div>
                  <div className='mt-2 break-all text-muted-foreground'>
                    {rotationPreview.auditEventId}
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {rotationPreview.safeMetadataRows.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
                <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Omitted unsafe fields
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {rotationPreview.omittedUnsafeFields.map((field) => (
                      <Badge key={field} variant='secondary'>
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
                {rotationPreview.blockers.length > 0 ? (
                  <div className='mt-3 flex flex-wrap gap-1'>
                    {rotationPreview.blockers.map((blocker) => (
                      <Badge key={blocker} variant='outline'>
                        {blocker}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {editPreview ? (
              <div className='rounded-md border p-3'>
                <div className='mb-3 flex flex-wrap items-center gap-2'>
                  <SlidersHorizontal className='size-4 text-primary' />
                  <div className='font-medium'>Edit/update safety preview</div>
                  <Badge
                    variant={editPreview.eligible ? 'default' : 'secondary'}
                  >
                    {editPreview.badge}
                  </Badge>
                  <Badge variant='outline'>Metadata diff only</Badge>
                </div>
                <div className='grid gap-3 lg:grid-cols-4'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Patch plan
                    </div>
                    <div className='mt-1 break-all'>
                      {editPreview.patchPlanHash}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Conflict check
                    </div>
                    <div className='mt-1 break-all'>
                      {editPreview.conflictCheckRef}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Rollback plan
                    </div>
                    <div className='mt-1 break-all'>
                      {editPreview.rollbackPlanRef}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Apply gate
                    </div>
                    <div className='mt-1'>{editPreview.applyGate}</div>
                  </div>
                </div>
                <div className='mt-3 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Metadata fields
                    </div>
                    <div className='mt-2 flex flex-wrap gap-1'>
                      {editPreview.targetMetadataFields.map((field) => (
                        <Badge key={field} variant='outline'>
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Immutable fields
                    </div>
                    <div className='mt-2 flex flex-wrap gap-1'>
                      {editPreview.immutableFields.map((field) => (
                        <Badge key={field} variant='secondary'>
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className='mt-3 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Affected consumers
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {editPreview.affectedConsumerRefs.map((ref) => (
                        <li key={ref}>{ref}</li>
                      ))}
                    </ul>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Safe metadata proof
                    </div>
                    <div className='mt-2'>{editPreview.validationStatus}</div>
                    <div className='mt-2 text-muted-foreground'>
                      {editPreview.auditTrail}
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {editPreview.safeDiffRows.map((row) => (
                        <li key={row}>{row}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Omitted unsafe fields
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {editPreview.omittedUnsafeFields.map((field) => (
                      <Badge key={field} variant='secondary'>
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
                {editPreview.blockers.length > 0 ? (
                  <div className='mt-3 flex flex-wrap gap-1'>
                    {editPreview.blockers.map((blocker) => (
                      <Badge key={blocker} variant='outline'>
                        {blocker}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {decommissionPreview ? (
              <div className='rounded-md border p-3'>
                <div className='mb-3 flex flex-wrap items-center gap-2'>
                  <Trash2 className='size-4 text-primary' />
                  <div className='font-medium'>
                    Delete/decommission safety preview
                  </div>
                  <Badge
                    variant={
                      decommissionPreview.eligible ? 'default' : 'secondary'
                    }
                  >
                    {decommissionPreview.badge}
                  </Badge>
                  <Badge variant='outline'>{decommissionPreview.mode}</Badge>
                </div>
                <div className='grid gap-3 lg:grid-cols-4'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Recovery plan
                    </div>
                    <div className='mt-1 break-all'>
                      {decommissionPreview.recoveryPlanRef}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Tombstone
                    </div>
                    <div className='mt-1 break-all'>
                      {decommissionPreview.tombstoneRef}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Retention
                    </div>
                    <div className='mt-1'>
                      {decommissionPreview.retentionStatus}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Apply gate
                    </div>
                    <div className='mt-1'>{decommissionPreview.applyGate}</div>
                  </div>
                </div>
                <div className='mt-3 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Dependent services
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {decommissionPreview.dependentServiceRefs.map((ref) => (
                        <li key={ref}>{ref}</li>
                      ))}
                    </ul>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Safe metadata proof
                    </div>
                    <div className='mt-2'>{decommissionPreview.auditTrail}</div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {decommissionPreview.safeMetadataRows.map((row) => (
                        <li key={row}>{row}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {decommissionPreview.blockers.length > 0 ? (
                  <div className='mt-3 flex flex-wrap gap-1'>
                    {decommissionPreview.blockers.map((blocker) => (
                      <Badge key={blocker} variant='outline'>
                        {blocker}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {policyPreview ? (
              <div className='rounded-md border p-3'>
                <div className='mb-3 flex flex-wrap items-center gap-2'>
                  <ShieldCheck className='size-4 text-primary' />
                  <div className='font-medium'>
                    Policy assignment safety preview
                  </div>
                  <Badge
                    variant={policyPreview.eligible ? 'default' : 'secondary'}
                  >
                    {policyPreview.badge}
                  </Badge>
                  <Badge variant='outline'>Metadata only</Badge>
                </div>
                <div className='grid gap-3 lg:grid-cols-4'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Current policy
                    </div>
                    <div className='mt-1 break-all'>
                      {policyPreview.currentPolicyRef}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Target policy
                    </div>
                    <div className='mt-1 break-all'>
                      {policyPreview.targetPolicyRef}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Rollback plan
                    </div>
                    <div className='mt-1 break-all'>
                      {policyPreview.rollbackPlanRef}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Apply gate
                    </div>
                    <div className='mt-1'>{policyPreview.applyGate}</div>
                  </div>
                </div>
                <div className='mt-3 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Policy diff metadata
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {policyPreview.policyDiffMetadata.map((row) => (
                        <li key={row}>{row}</li>
                      ))}
                    </ul>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Affected consumers
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {policyPreview.affectedConsumerRefs.map((ref) => (
                        <li key={ref}>{ref}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className='mt-3 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Enforcement checks
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {policyPreview.enforcementChecks.map((check) => (
                        <li key={check}>{check}</li>
                      ))}
                    </ul>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Safe metadata proof
                    </div>
                    <div className='mt-2'>{policyPreview.auditTrail}</div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {policyPreview.safeMetadataRows.map((row) => (
                        <li key={row}>{row}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {policyPreview.blockers.length > 0 ? (
                  <div className='mt-3 flex flex-wrap gap-1'>
                    {policyPreview.blockers.map((blocker) => (
                      <Badge key={blocker} variant='outline'>
                        {blocker}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className='flex flex-wrap gap-2'>
              <Button type='button' disabled>
                Apply disabled until dry-run preview is accepted
              </Button>
              <Badge variant='secondary'>Raw values hidden</Badge>
              <Badge variant='outline'>No copy/export</Badge>
              <Badge variant='outline'>No bulk mutation</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Single-secret preview gate</CardTitle>
            <CardDescription>
              Deterministic non-production status model for one selected ref.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div className='grid gap-4 lg:grid-cols-4'>
              <div className='rounded-lg border p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Selected ref
                </div>
                <div className='mt-1 font-medium break-all'>
                  {selectedRow.ref}
                </div>
              </div>
              <div className='rounded-lg border p-3'>
                <label
                  htmlFor='stub-state'
                  className='text-xs font-medium text-muted-foreground uppercase'
                >
                  Stub API state
                </label>
                <select
                  id='stub-state'
                  className='mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm'
                  value={stubState}
                  onChange={(event) => {
                    setStubState(event.target.value as StubSecretMutationState)
                    setSingleApplyResult(null)
                  }}
                >
                  {stubSecretMutationStates.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className='rounded-lg border p-3'>
                <label
                  htmlFor='single-operation-outcome'
                  className='text-xs font-medium text-muted-foreground uppercase'
                >
                  Result status
                </label>
                <select
                  id='single-operation-outcome'
                  className='mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm'
                  value={singleOperationOutcome}
                  onChange={(event) => {
                    setSingleOperationOutcome(
                      event.target.value as SingleSecretOperationOutcome
                    )
                    setSingleApplyResult(null)
                  }}
                >
                  {singleSecretOperationOutcomes.map((outcome) => (
                    <option key={outcome.id} value={outcome.id}>
                      {outcome.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='text-xs font-medium text-muted-foreground uppercase'>
                  Apply readiness
                </div>
                <Badge
                  className='mt-2'
                  variant={
                    stubMutationPreview.canApply ? 'default' : 'secondary'
                  }
                >
                  {stubMutationPreview.canApply
                    ? 'Stub apply can be simulated'
                    : 'Stub apply blocked'}
                </Badge>
              </div>
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
              <div className='space-y-2'>
                <label
                  htmlFor='audit-reason'
                  className='text-sm font-medium text-muted-foreground'
                >
                  Audit reason for stub preview
                </label>
                <Input
                  id='audit-reason'
                  value={auditReason}
                  onChange={(event) => {
                    setSafeSingleAuditReason(event.target.value)
                  }}
                  placeholder='Required before simulated apply; no secret values'
                />
                {auditReasonRejected ? (
                  <div className='text-xs text-destructive'>
                    Secret-like material was rejected; enter operator intent
                    only.
                  </div>
                ) : null}
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    checked={confirmed}
                    onChange={(event) => {
                      setConfirmed(event.target.checked)
                      setSingleApplyResult(null)
                    }}
                  />
                  I confirm this is a stub preview and no production mutation
                  will be performed.
                </label>
              </div>
              <div className='rounded-lg border p-3'>
                <div className='mb-2 flex flex-wrap items-center gap-2'>
                  <Badge variant='outline'>{stubMutationPreview.badge}</Badge>
                  <Badge variant='secondary'>Stub API · preview only</Badge>
                </div>
                <div className='font-medium'>{stubMutationPreview.title}</div>
                <dl className='mt-3 grid gap-2 text-sm'>
                  <div>
                    <dt className='text-muted-foreground'>Dry-run status</dt>
                    <dd>{stubMutationPreview.dryRunStatus}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Apply status</dt>
                    <dd>{stubMutationPreview.applyStatus}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Policy decision</dt>
                    <dd>{stubMutationPreview.policyDecision}</dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>Audit requirement</dt>
                    <dd>{stubMutationPreview.auditRequirement}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className='rounded-lg border p-3'>
              <div className='text-xs font-medium text-muted-foreground uppercase'>
                Metadata-only dry-run diff
              </div>
              <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                {stubMutationPreview.safeDiff.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className='mt-3 rounded-md border bg-muted/40 p-3'>
                {stubMutationPreview.nextStep}
              </div>
            </div>

            <div className='rounded-lg border p-3'>
              <div className='mb-3 flex flex-wrap items-center gap-2'>
                <ShieldCheck className='size-4 text-primary' />
                <div className='font-medium'>Confirmation receipt</div>
                <Badge
                  variant={
                    singleConfirmationReceipt.accepted ? 'default' : 'secondary'
                  }
                >
                  {singleConfirmationReceipt.accepted ? 'Accepted' : 'Blocked'}
                </Badge>
                <Badge variant='outline'>Metadata only</Badge>
              </div>
              <div className='grid gap-3 md:grid-cols-3'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Receipt
                  </div>
                  <div className='mt-1 break-all'>
                    {singleConfirmationReceipt.receiptId}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Audit reason
                  </div>
                  <div className='mt-1'>
                    {singleConfirmationReceipt.auditReasonStatus}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Confirmation
                  </div>
                  <div className='mt-1'>
                    {singleConfirmationReceipt.confirmationStatus}
                  </div>
                </div>
              </div>
              <div className='mt-3 grid gap-3 md:grid-cols-2'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Dry-run binding
                  </div>
                  <div className='mt-1'>
                    {singleConfirmationReceipt.dryRunBinding}
                  </div>
                  <div className='mt-2 text-muted-foreground'>
                    Blocker: {singleConfirmationReceipt.blockedReason}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Policy and capability
                  </div>
                  <div className='mt-1'>
                    {singleConfirmationReceipt.policyBinding}
                  </div>
                  <div className='mt-2 text-muted-foreground'>
                    {singleConfirmationReceipt.capabilityBinding}
                  </div>
                </div>
              </div>
              <div className='mt-3 grid gap-3 md:grid-cols-3'>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Allowed receipt fields
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleConfirmationReceipt.allowedReceiptFields.map(
                      (field) => (
                        <Badge key={field} variant='outline'>
                          {field}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Omitted receipt fields
                  </div>
                  <div className='mt-2 flex flex-wrap gap-1'>
                    {singleConfirmationReceipt.omittedReceiptFields.map(
                      (field) => (
                        <Badge key={field} variant='secondary'>
                          {field}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
                <div className='rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Safe receipt evidence
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {singleConfirmationReceipt.safeReceiptRows.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {singleApplyResult ? (
              <div className='rounded-lg border p-3'>
                <div className='mb-3 flex flex-wrap items-center gap-2'>
                  <CheckCircle2 className='size-4 text-primary' />
                  <div className='font-medium'>
                    Single-secret operation result: {singleApplyResult.outcome}
                  </div>
                  <Badge variant='secondary'>Metadata only</Badge>
                  <Badge variant='outline'>
                    {singleApplyResult.resultBadge}
                  </Badge>
                  <Badge variant='outline'>
                    {singleApplyResult.applied ? 'Applied' : 'Not applied'}
                  </Badge>
                </div>
                <div className='grid gap-3 md:grid-cols-3'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Operation ID
                    </div>
                    <div className='mt-1 break-all'>
                      {singleApplyResult.operationId}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Ref
                    </div>
                    <div className='mt-1 break-all'>
                      {singleApplyResult.ref}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Audit
                    </div>
                    <div className='mt-1'>{singleApplyResult.auditStatus}</div>
                  </div>
                </div>
                <div className='mt-3 grid gap-3 lg:grid-cols-4'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Audit event
                    </div>
                    <div className='mt-1 break-all'>
                      {singleApplyResult.auditFeedback.auditEventId}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Correlation
                    </div>
                    <div className='mt-1 break-all'>
                      {singleApplyResult.auditFeedback.correlationId}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Audit status
                    </div>
                    <div className='mt-1'>
                      {singleApplyResult.auditFeedback.eventState}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Sink
                    </div>
                    <div className='mt-1'>
                      {singleApplyResult.auditFeedback.sinkStatus}
                    </div>
                  </div>
                </div>
                <div className='mt-3 rounded-md border bg-muted/40 p-3'>
                  <div>{singleApplyResult.resultStatus}</div>
                  <div className='mt-2 text-muted-foreground'>
                    {singleApplyResult.nextAction}
                  </div>
                </div>
                <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                  <div className='mb-3 flex flex-wrap items-center gap-2'>
                    <div className='font-medium'>
                      {singleApplyResult.impactEvidence.title}
                    </div>
                    <Badge variant='secondary'>Metadata only</Badge>
                  </div>
                  <div className='grid gap-3 md:grid-cols-3'>
                    <div className='rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Impact ref
                      </div>
                      <div className='mt-1 break-all'>
                        {singleApplyResult.impactEvidence.impactRef}
                      </div>
                    </div>
                    <div className='rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Rollback / recovery ref
                      </div>
                      <div className='mt-1 break-all'>
                        {singleApplyResult.impactEvidence.rollbackRef}
                      </div>
                    </div>
                    <div className='rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Fresh preview
                      </div>
                      <div className='mt-1'>
                        {
                          singleApplyResult.impactEvidence
                            .freshPreviewRequirement
                        }
                      </div>
                    </div>
                  </div>
                  <div className='mt-3 grid gap-3 md:grid-cols-2'>
                    <div className='rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Dependent service refs
                      </div>
                      <div className='mt-2 flex flex-wrap gap-1'>
                        {singleApplyResult.impactEvidence.dependentServiceRefs.map(
                          (ref) => (
                            <Badge key={ref} variant='outline'>
                              {ref}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                    <div className='rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Audit refs
                      </div>
                      <div className='mt-2 flex flex-wrap gap-1'>
                        {singleApplyResult.impactEvidence.auditRefs.map(
                          (ref) => (
                            <Badge key={ref} variant='outline'>
                              {ref}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='mt-3 grid gap-3 md:grid-cols-2'>
                    <div className='rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Omitted unsafe fields
                      </div>
                      <div className='mt-2 flex flex-wrap gap-1'>
                        {singleApplyResult.impactEvidence.omittedUnsafeFields.map(
                          (field) => (
                            <Badge key={field} variant='secondary'>
                              {field}
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                    <div className='rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Safe impact rows
                      </div>
                      <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                        {singleApplyResult.impactEvidence.safeEvidenceRows.map(
                          (row) => (
                            <li key={row}>{row}</li>
                          )
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
                {singleApplyResult.providerAuthChallengeRef ? (
                  <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Provider auth challenge
                    </div>
                    <div className='mt-1 break-all'>
                      {singleApplyResult.providerAuthChallengeRef}
                    </div>
                    <div className='mt-2 text-muted-foreground'>
                      Broker-owned challenge metadata only; provider
                      credentials, tokens, cookies, and recovery material stay
                      outside Service Admin.
                    </div>
                  </div>
                ) : null}
                {singleApplyResult.providerRecoveryRef ? (
                  <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Provider recovery evidence
                    </div>
                    <div className='mt-1 break-all'>
                      {singleApplyResult.providerRecoveryRef}
                    </div>
                    <div className='mt-2 text-muted-foreground'>
                      Broker-owned recovery metadata only; connector health,
                      capability refresh, and correlation refs are tracked
                      without provider credentials, tokens, cookies, request
                      bodies, response bodies, or raw secret material.
                    </div>
                  </div>
                ) : null}
                {singleApplyResult.brokerFailureRef ? (
                  <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Broker failure evidence
                    </div>
                    <div className='mt-1 break-all'>
                      {singleApplyResult.brokerFailureRef}
                    </div>
                    <div className='mt-2 text-muted-foreground'>
                      {singleApplyResult.brokerFailureCategory}
                    </div>
                    <div className='mt-2 text-muted-foreground'>
                      Metadata-only safe failure evidence; retry decisions stay
                      scoped to the operation id and omit request bodies,
                      response bodies, provider credentials, tokens, cookies,
                      environment values, and raw secret material.
                    </div>
                  </div>
                ) : null}
                <div className='mt-3 grid gap-3 md:grid-cols-2'>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Recovery guidance
                    </div>
                    <div className='mt-1'>
                      {singleApplyResult.recoveryStatus}
                    </div>
                    <div className='mt-2 text-muted-foreground'>
                      {singleApplyResult.retryPolicy}
                    </div>
                  </div>
                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Recovery steps
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {singleApplyResult.recoverySteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Redaction and dependent service evidence
                  </div>
                  <div className='mt-2'>
                    {singleApplyResult.auditFeedback.redactionStatus}
                  </div>
                  <div className='mt-2 text-muted-foreground'>
                    {singleApplyResult.auditFeedback.dependentServiceStatus}
                  </div>
                  <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                    {singleApplyResult.auditFeedback.evidenceRows.map((row) => (
                      <li key={row}>{row}</li>
                    ))}
                  </ul>
                </div>
                <ul className='mt-3 list-disc space-y-1 ps-5 text-muted-foreground'>
                  {singleApplyResult.safetyRows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
                {singleStatusMonitor ? (
                  <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                    <div className='mb-3 flex flex-wrap items-center gap-2'>
                      <div className='font-medium'>Broker status monitor</div>
                      <Badge variant='secondary'>Metadata only</Badge>
                      <Badge variant='outline'>
                        {singleStatusMonitor.stateBadge}
                      </Badge>
                      <Badge
                        variant={
                          singleStatusMonitor.retryAllowed
                            ? 'default'
                            : 'outline'
                        }
                      >
                        {singleStatusMonitor.retryAllowed
                          ? 'Retry safe'
                          : 'Fresh preview first'}
                      </Badge>
                    </div>
                    <div className='grid gap-3 lg:grid-cols-4'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Status endpoint
                        </div>
                        <div className='mt-1 break-all'>
                          {singleStatusMonitor.statusEndpoint}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Polling
                        </div>
                        <div className='mt-1'>
                          {singleStatusMonitor.pollCadence}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Terminal state
                        </div>
                        <div className='mt-1'>
                          {singleStatusMonitor.terminalState}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Retry token
                        </div>
                        <div className='mt-1 break-all'>
                          {singleStatusMonitor.retryToken}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Stale-plan guard
                      </div>
                      <div className='mt-2'>
                        {singleStatusMonitor.stalePlanGuard}
                      </div>
                      <div className='mt-2 text-muted-foreground'>
                        {singleStatusMonitor.operatorNextAction}
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-2'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Allowed status fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleStatusMonitor.allowedStatusFields.map(
                            (field) => (
                              <Badge key={field} variant='outline'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Omitted unsafe status fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleStatusMonitor.omittedStatusFields.map(
                            (field) => (
                              <Badge key={field} variant='secondary'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-2'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Status rows
                        </div>
                        <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                          {singleStatusMonitor.statusRows.map((row) => (
                            <li key={row}>{row}</li>
                          ))}
                        </ul>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Safe status evidence
                        </div>
                        <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                          {singleStatusMonitor.safeEvidenceRows.map((row) => (
                            <li key={row}>{row}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
                {singleEvidenceBundle ? (
                  <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                    <div className='mb-3 flex flex-wrap items-center gap-2'>
                      <div className='font-medium'>Support evidence bundle</div>
                      <Badge variant='secondary'>Metadata only</Badge>
                      <Badge variant='outline'>
                        {singleEvidenceBundle.supportBundleStatus}
                      </Badge>
                    </div>
                    <div className='grid gap-3 lg:grid-cols-4'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Bundle
                        </div>
                        <div className='mt-1 break-all'>
                          {singleEvidenceBundle.bundleId}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Report
                        </div>
                        <div className='mt-1 break-all'>
                          {singleEvidenceBundle.reportRef}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Diagnostics
                        </div>
                        <div className='mt-1 break-all'>
                          {singleEvidenceBundle.diagnosticsRef}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Storage
                        </div>
                        <div className='mt-1'>
                          {singleEvidenceBundle.storageEvidence}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Screenshot redaction
                      </div>
                      <div className='mt-2'>
                        {singleEvidenceBundle.screenshotRedaction}
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-2'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Allowed evidence fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleEvidenceBundle.allowedFields.map((field) => (
                            <Badge key={field} variant='outline'>
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Omitted evidence artifacts
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleEvidenceBundle.omittedArtifacts.map(
                            (artifact) => (
                              <Badge key={artifact} variant='secondary'>
                                {artifact}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Safe evidence rows
                      </div>
                      <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                        {singleEvidenceBundle.safeEvidenceRows.map((row) => (
                          <li key={row}>{row}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
                {singleRecoveryDecision ? (
                  <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                    <div className='mb-3 flex flex-wrap items-center gap-2'>
                      <RotateCcw className='size-4 text-primary' />
                      <div className='font-medium'>
                        Recovery and retry decision
                      </div>
                      <Badge variant='secondary'>Metadata only</Badge>
                      <Badge variant='outline'>
                        {singleRecoveryDecision.badge}
                      </Badge>
                      <Badge
                        variant={
                          singleRecoveryDecision.retryAllowed
                            ? 'default'
                            : 'outline'
                        }
                      >
                        {singleRecoveryDecision.retryAllowed
                          ? 'Retry eligible'
                          : 'Retry blocked'}
                      </Badge>
                    </div>
                    <div className='grid gap-3 lg:grid-cols-4'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Decision
                        </div>
                        <div className='mt-1 break-all'>
                          {singleRecoveryDecision.decisionId}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Recovery ref
                        </div>
                        <div className='mt-1 break-all'>
                          {singleRecoveryDecision.recoveryRef}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Rollback ref
                        </div>
                        <div className='mt-1 break-all'>
                          {singleRecoveryDecision.rollbackRef}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Status
                        </div>
                        <div className='mt-1 break-all'>
                          {singleRecoveryDecision.statusEndpoint}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-3'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Operator action
                        </div>
                        <div className='mt-2'>
                          {singleRecoveryDecision.operatorAction}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Broker action
                        </div>
                        <div className='mt-2'>
                          {singleRecoveryDecision.brokerAction}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Retry ref
                        </div>
                        <div className='mt-2 break-all'>
                          {singleRecoveryDecision.retryRef}
                        </div>
                        <div className='mt-2 text-muted-foreground'>
                          {singleRecoveryDecision.freshPreviewRequired
                            ? 'Fresh preview required'
                            : 'No fresh preview required for this state'}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-2'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Allowed recovery fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleRecoveryDecision.allowedRecoveryFields.map(
                            (field) => (
                              <Badge key={field} variant='outline'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Omitted recovery fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleRecoveryDecision.omittedRecoveryFields.map(
                            (field) => (
                              <Badge key={field} variant='secondary'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Safe recovery evidence
                      </div>
                      <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                        {singleRecoveryDecision.safeRecoveryRows.map((row) => (
                          <li key={row}>{row}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
                {singleOperatorHandoff ? (
                  <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                    <div className='mb-3 flex flex-wrap items-center gap-2'>
                      <ShieldCheck className='size-4 text-primary' />
                      <div className='font-medium'>Operator handoff packet</div>
                      <Badge variant='secondary'>Shareable metadata</Badge>
                      <Badge variant='outline'>
                        {singleOperatorHandoff.badge}
                      </Badge>
                      <Badge
                        variant={
                          singleOperatorHandoff.severity === 'critical'
                            ? 'destructive'
                            : singleOperatorHandoff.severity === 'warning'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {singleOperatorHandoff.lane}
                      </Badge>
                    </div>
                    <div className='grid gap-3 md:grid-cols-4'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Handoff
                        </div>
                        <div className='mt-1 break-all'>
                          {singleOperatorHandoff.handoffId}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Owner
                        </div>
                        <div className='mt-1'>
                          {singleOperatorHandoff.owner}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Outcome
                        </div>
                        <div className='mt-1'>
                          {singleOperatorHandoff.outcome}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Blocker
                        </div>
                        <div className='mt-1'>
                          {singleOperatorHandoff.blockedReason ?? 'none'}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-2'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Required action
                        </div>
                        <div className='mt-2'>
                          {singleOperatorHandoff.requiredAction}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Validator note
                        </div>
                        <div className='mt-2'>
                          {singleOperatorHandoff.validatorNote}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-3'>
                      <div className='rounded-md border bg-background p-3 md:col-span-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Shareable evidence refs
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleOperatorHandoff.shareableEvidenceRefs.map(
                            (ref) => (
                              <Badge key={ref} variant='outline'>
                                {ref}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Allowed handoff fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleOperatorHandoff.allowedHandoffFields.map(
                            (field) => (
                              <Badge key={field} variant='outline'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Omitted handoff fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleOperatorHandoff.omittedHandoffFields.map(
                            (field) => (
                              <Badge key={field} variant='secondary'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Safe handoff evidence
                        </div>
                        <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                          {singleOperatorHandoff.safeHandoffRows.map((row) => (
                            <li key={row}>{row}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
                {singleOwnerActionTicket ? (
                  <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                    <div className='mb-3 flex flex-wrap items-center gap-2'>
                      <ListChecks className='size-4 text-primary' />
                      <div className='font-medium'>Owner action ticket</div>
                      <Badge variant='secondary'>Metadata only</Badge>
                      <Badge variant='outline'>
                        {singleOwnerActionTicket.owner}
                      </Badge>
                      <Badge
                        variant={
                          singleOwnerActionTicket.severity === 'critical'
                            ? 'destructive'
                            : singleOwnerActionTicket.severity === 'warning'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {singleOwnerActionTicket.lane}
                      </Badge>
                    </div>
                    <div className='grid gap-3 md:grid-cols-3'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Ticket
                        </div>
                        <div className='mt-1 break-all'>
                          {singleOwnerActionTicket.ticketId}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Acknowledgement
                        </div>
                        <div className='mt-1'>
                          {singleOwnerActionTicket.acknowledgementStatus}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Escalation
                        </div>
                        <div className='mt-1'>
                          {singleOwnerActionTicket.safeEscalationRoute}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-2'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Required action
                        </div>
                        <div className='mt-2'>
                          {singleOwnerActionTicket.requiredAction}
                        </div>
                        <div className='mt-2 text-muted-foreground'>
                          {singleOwnerActionTicket.freshPreviewRequired
                            ? 'Fresh preview required before retry'
                            : 'No retry preview required for this state'}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Evidence refs
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleOwnerActionTicket.evidenceRefs.map((ref) => (
                            <Badge key={ref} variant='outline'>
                              {ref}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-3'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Allowed ticket fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleOwnerActionTicket.allowedTicketFields.map(
                            (field) => (
                              <Badge key={field} variant='outline'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Omitted ticket fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleOwnerActionTicket.omittedTicketFields.map(
                            (field) => (
                              <Badge key={field} variant='secondary'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Safe ticket evidence
                        </div>
                        <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                          {singleOwnerActionTicket.safeTicketRows.map((row) => (
                            <li key={row}>{row}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
                {singleClosureReview ? (
                  <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                    <div className='mb-3 flex flex-wrap items-center gap-2'>
                      <CheckCircle2 className='size-4 text-primary' />
                      <div className='font-medium'>Operator closure review</div>
                      <Badge variant='secondary'>Metadata only</Badge>
                      <Badge
                        variant={
                          singleClosureReview.canCloseOperatorReview
                            ? 'default'
                            : singleClosureReview.reviewState === 'monitoring'
                              ? 'outline'
                              : 'secondary'
                        }
                      >
                        {singleClosureReview.badge}
                      </Badge>
                    </div>
                    <div className='grid gap-3 md:grid-cols-3'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Closure review
                        </div>
                        <div className='mt-1 break-all'>
                          {singleClosureReview.closureId}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Review state
                        </div>
                        <div className='mt-1'>
                          {singleClosureReview.reviewState}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Operator close
                        </div>
                        <div className='mt-1'>
                          {singleClosureReview.canCloseOperatorReview
                            ? 'Allowed after audit acknowledgement'
                            : 'Blocked until required checks complete'}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-2'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Required before close
                        </div>
                        <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                          {singleClosureReview.requiredBeforeClose.map(
                            (row) => (
                              <li key={row}>{row}</li>
                            )
                          )}
                        </ul>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Retained evidence refs
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleClosureReview.retainedEvidenceRefs.map(
                            (ref) => (
                              <Badge key={ref} variant='outline'>
                                {ref}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-2'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Audit refs
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleClosureReview.auditRefs.map((ref) => (
                            <Badge key={ref} variant='outline'>
                              {ref}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Support refs
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleClosureReview.supportRefs.map((ref) => (
                            <Badge key={ref} variant='secondary'>
                              {ref}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-3'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Allowed closure fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleClosureReview.allowedClosureFields.map(
                            (field) => (
                              <Badge key={field} variant='outline'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Omitted closure fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleClosureReview.omittedClosureFields.map(
                            (field) => (
                              <Badge key={field} variant='secondary'>
                                {field}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Safe closure evidence
                        </div>
                        <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                          {singleClosureReview.safeClosureRows.map((row) => (
                            <li key={row}>{row}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                  <div className='text-xs font-medium text-muted-foreground uppercase'>
                    Operation audit timeline
                  </div>
                  <div className='mt-2 overflow-x-auto rounded-md border bg-background'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Step</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actor</TableHead>
                          <TableHead>Evidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {singleOperationAuditTrail.map((step) => (
                          <TableRow key={step.id}>
                            <TableCell className='min-w-56 align-top'>
                              <div className='font-medium'>{step.label}</div>
                              <div className='text-xs text-muted-foreground'>
                                {step.occurredAt}
                              </div>
                            </TableCell>
                            <TableCell className='min-w-64 align-top'>
                              <Badge
                                variant={step.terminal ? 'default' : 'outline'}
                              >
                                {step.terminal ? 'Terminal' : 'In progress'}
                              </Badge>
                              <div className='mt-2'>{step.status}</div>
                            </TableCell>
                            <TableCell className='min-w-44 align-top'>
                              {step.actorRef}
                            </TableCell>
                            <TableCell className='min-w-80 align-top'>
                              <div className='break-all'>{step.evidence}</div>
                              <div className='mt-2 text-xs text-muted-foreground'>
                                {step.redaction}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {singleAuditReceipt ? (
                  <div className='mt-3 rounded-md border bg-muted/30 p-3'>
                    <div className='mb-3 flex flex-wrap items-center gap-2'>
                      <ShieldCheck className='size-4 text-primary' />
                      <div className='font-medium'>Audit receipt</div>
                      <Badge variant='secondary'>Metadata only</Badge>
                      <Badge variant='outline'>
                        {singleAuditReceipt.retentionStatus}
                      </Badge>
                    </div>
                    <div className='grid gap-3 lg:grid-cols-4'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Receipt
                        </div>
                        <div className='mt-1 break-all'>
                          {singleAuditReceipt.receiptId}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Checksum
                        </div>
                        <div className='mt-1 break-all'>
                          {singleAuditReceipt.receiptChecksum}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Audit event
                        </div>
                        <div className='mt-1 break-all'>
                          {singleAuditReceipt.auditEventId}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Terminal evidence
                        </div>
                        <div className='mt-1'>
                          {singleAuditReceipt.terminalStepStatus}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 grid gap-3 md:grid-cols-2'>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Safe receipt fields
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleAuditReceipt.safeReceiptFields.map((field) => (
                            <Badge key={field} variant='outline'>
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className='rounded-md border bg-background p-3'>
                        <div className='text-xs font-medium text-muted-foreground uppercase'>
                          Omitted receipt artifacts
                        </div>
                        <div className='mt-2 flex flex-wrap gap-1'>
                          {singleAuditReceipt.omittedReceiptArtifacts.map(
                            (artifact) => (
                              <Badge key={artifact} variant='secondary'>
                                {artifact}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    <div className='mt-3 rounded-md border bg-background p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Safe receipt evidence
                      </div>
                      <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                        {singleAuditReceipt.safeReceiptRows.map((row) => (
                          <li key={row}>{row}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className='rounded-lg border p-3'>
              <div className='mb-3 flex flex-wrap items-center gap-2'>
                <ListChecks className='size-4 text-primary' />
                <div className='font-medium'>
                  Single-secret operation history
                </div>
                <Badge variant='secondary'>Metadata only</Badge>
                <Badge variant='outline'>
                  {singleHistoryReview.totalCount} submitted
                </Badge>
                <Badge variant='outline'>
                  {singleHistoryReview.filteredCount} shown
                </Badge>
              </div>
              {singleHistoryReview.totalCount > 0 ? (
                <div className='space-y-3'>
                  <div className='grid gap-3 lg:grid-cols-[1fr_12rem_12rem]'>
                    <div>
                      <label className='text-xs font-medium text-muted-foreground uppercase'>
                        History search
                      </label>
                      <Input
                        aria-label='History search'
                        className='mt-1'
                        placeholder='Filter operation ids, refs, audit refs'
                        value={singleHistoryFilter.query}
                        onChange={(event) =>
                          setSingleHistoryFilter((current) => ({
                            ...current,
                            query: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className='text-xs font-medium text-muted-foreground uppercase'>
                        Action
                      </label>
                      <select
                        aria-label='History action'
                        className='mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm'
                        value={singleHistoryFilter.action}
                        onChange={(event) =>
                          setSingleHistoryFilter((current) => ({
                            ...current,
                            action: event.target
                              .value as SingleSecretOperationHistoryFilter['action'],
                          }))
                        }
                      >
                        <option value='all'>All actions</option>
                        {Object.entries(actionButtonLabels).map(
                          ([action, label]) => (
                            <option key={action} value={action}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <label className='text-xs font-medium text-muted-foreground uppercase'>
                        Outcome
                      </label>
                      <select
                        aria-label='History outcome'
                        className='mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm'
                        value={singleHistoryFilter.outcome}
                        onChange={(event) =>
                          setSingleHistoryFilter((current) => ({
                            ...current,
                            outcome: event.target
                              .value as SingleSecretOperationHistoryFilter['outcome'],
                          }))
                        }
                      >
                        <option value='all'>All outcomes</option>
                        {singleSecretOperationOutcomes.map((outcome) => (
                          <option key={outcome.id} value={outcome.id}>
                            {outcome.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className='grid gap-3 md:grid-cols-4'>
                    <div className='rounded-md border bg-muted/30 p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Applied
                      </div>
                      <div className='mt-1 text-lg font-semibold'>
                        {singleHistoryReview.appliedCount}
                      </div>
                    </div>
                    <div className='rounded-md border bg-muted/30 p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Pending
                      </div>
                      <div className='mt-1 text-lg font-semibold'>
                        {singleHistoryReview.pendingCount}
                      </div>
                    </div>
                    <div className='rounded-md border bg-muted/30 p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Blocked
                      </div>
                      <div className='mt-1 text-lg font-semibold'>
                        {singleHistoryReview.blockedCount}
                      </div>
                    </div>
                    <div className='rounded-md border bg-muted/30 p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Search status
                      </div>
                      <div className='mt-1 text-sm'>
                        {singleHistoryReview.safeSearchStatus}
                      </div>
                    </div>
                  </div>

                  <div className='grid gap-3 md:grid-cols-2'>
                    <div className='rounded-md border bg-muted/30 p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Allowed history fields
                      </div>
                      <div className='mt-2 flex flex-wrap gap-1'>
                        {singleHistoryReview.allowedFields.map((field) => (
                          <Badge key={field} variant='outline'>
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className='rounded-md border bg-muted/30 p-3'>
                      <div className='text-xs font-medium text-muted-foreground uppercase'>
                        Omitted history fields
                      </div>
                      <div className='mt-2 flex flex-wrap gap-1'>
                        {singleHistoryReview.omittedFields.map((field) => (
                          <Badge key={field} variant='secondary'>
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {singleHistoryReview.filteredCount > 0 ? (
                    <div className='overflow-x-auto rounded-md border'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ref</TableHead>
                            <TableHead>Action / status</TableHead>
                            <TableHead>Audit event</TableHead>
                            <TableHead>Recovery</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {singleHistoryReview.entries.map((entry) => (
                            <TableRow key={entry.auditEventId}>
                              <TableCell className='min-w-72 align-top'>
                                <div className='font-medium'>
                                  {entry.rowName}
                                </div>
                                <div className='text-sm break-all text-muted-foreground'>
                                  {entry.ref}
                                </div>
                                <div className='mt-2 text-xs text-muted-foreground'>
                                  {entry.provider}
                                </div>
                              </TableCell>
                              <TableCell className='min-w-44 align-top'>
                                <Badge variant='outline'>{entry.action}</Badge>
                                <div className='mt-2'>{entry.statusBadge}</div>
                                <div className='text-xs text-muted-foreground'>
                                  {entry.submittedAt}
                                </div>
                              </TableCell>
                              <TableCell className='min-w-72 align-top'>
                                <div className='break-all'>
                                  {entry.auditEventId}
                                </div>
                                <div className='mt-2 text-xs break-all text-muted-foreground'>
                                  {entry.auditFeedback.correlationId}
                                </div>
                                <div className='mt-2 text-xs text-muted-foreground'>
                                  {entry.auditFeedback.eventState}
                                </div>
                                <div className='mt-2 text-xs break-all text-muted-foreground'>
                                  {entry.policy}
                                </div>
                              </TableCell>
                              <TableCell className='min-w-64 align-top'>
                                <div>{entry.nextAction}</div>
                                <div className='mt-2 text-muted-foreground'>
                                  {entry.recoveryStatus}
                                </div>
                                <div className='mt-2 text-muted-foreground'>
                                  {entry.auditFeedback.dependentServiceStatus}
                                </div>
                                <div className='mt-2 text-xs text-muted-foreground'>
                                  {entry.retryPolicy}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className='rounded-md border bg-muted/40 p-3 text-muted-foreground'>
                      No metadata-only history entries match the current
                      filters.
                    </div>
                  )}

                  <div className='rounded-md border bg-muted/30 p-3'>
                    <div className='text-xs font-medium text-muted-foreground uppercase'>
                      Safe history evidence
                    </div>
                    <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
                      {singleHistoryReview.safeEvidenceRows.map((row) => (
                        <li key={row}>{row}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className='rounded-md border bg-muted/40 p-3 text-muted-foreground'>
                  No submitted stub operations yet. History will list refs,
                  operation ids, audit event ids, and next actions only.
                </div>
              )}
            </div>

            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                disabled={!stubMutationPreview.canApply}
                onClick={applySingleSecretOperation}
              >
                Simulate stub apply
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={cancelSingleSecretOperation}
              >
                Cancel stub preview
              </Button>
              <Badge variant='outline'>No plaintext editing</Badge>
              <Badge variant='outline'>Single-secret only</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guardrails</CardTitle>
            <CardDescription>
              Boundaries enforced by this operator surface.
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-2'>
            <Badge variant='outline'>No plaintext table editing</Badge>
            <Badge variant='outline'>No copy/export</Badge>
            <Badge variant='outline'>Dry-run first</Badge>
            <Badge variant='outline'>Audit reason required</Badge>
            <Badge variant='outline'>Raw values hidden</Badge>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
