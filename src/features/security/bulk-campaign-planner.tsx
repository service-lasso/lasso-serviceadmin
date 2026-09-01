import { useEffect, useMemo, useState } from 'react'
import {
  useBrokerBulkCampaignApply,
  useBrokerBulkCampaignCreate,
  useBrokerBulkCampaignRevalidate,
  useBrokerProviderStatus,
  useSecretsManagement,
} from '@/lib/service-lasso-dashboard/hooks'
import { providerSupportsMigrationApply } from '@/lib/service-lasso-dashboard/stub'
import type {
  BrokerBulkCampaignFamily,
  BrokerBulkCampaignResult,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  BROKER_BULK_CAMPAIGN_FAMILIES,
  buildLiveBulkCampaignGate,
  buildLiveBulkCampaignRequest,
  bulkCampaignRecoveryCopy,
  createBulkCampaignOperationId,
  isExecutableBulkCampaignApply,
} from './bulk-campaign-contract'

const familyLabels: Record<BrokerBulkCampaignFamily, string> = {
  rotate_reset: 'Rotate / reset (plan only)',
  update_edit: 'Update / edit (plan only)',
  apply_policy: 'Apply policy (plan only)',
  migrate_remap_provider: 'Migrate / remap provider (apply executable)',
  mark_action_required: 'Mark action required (plan only)',
}

function isBrokerBulkCampaignFamily(
  value: string
): value is BrokerBulkCampaignFamily {
  return BROKER_BULK_CAMPAIGN_FAMILIES.some((family) => family === value)
}

function campaignFailureCopy(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return fallback
}

/**
 * Live Stage 2/3 campaign planner. Apply is enabled only after dry-run,
 * revalidation, audit reason, and typed campaign-id confirmation.
 */
export function LiveBulkCampaignPlanner() {
  const secretsQuery = useSecretsManagement()
  const providerQuery = useBrokerProviderStatus()
  const createCampaign = useBrokerBulkCampaignCreate()
  const revalidateCampaign = useBrokerBulkCampaignRevalidate()
  const applyCampaign = useBrokerBulkCampaignApply()
  const records = secretsQuery.data?.results ?? []
  const executableTargets = useMemo(
    () =>
      (providerQuery.data?.providers ?? []).filter(
        providerSupportsMigrationApply
      ),
    [providerQuery.data?.providers]
  )
  const [operation, setOperation] = useState<BrokerBulkCampaignFamily>(
    'migrate_remap_provider'
  )
  const [refs, setRefs] = useState<string[]>([])
  const [targetProviderId, setTargetProviderId] = useState(
    () => executableTargets[0]?.providerId ?? ''
  )
  const [reason, setReason] = useState('')
  const [highRiskConfirm, setHighRiskConfirm] = useState('')
  const [operationId, setOperationId] = useState(createBulkCampaignOperationId)
  const [plan, setPlan] = useState<BrokerBulkCampaignResult | null>(null)
  const [receipt, setReceipt] = useState<BrokerBulkCampaignResult | null>(null)
  const [revalidated, setRevalidated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const gate = buildLiveBulkCampaignGate({
    operation,
    refs,
    targetProviderId,
    reason,
    plan,
    highRiskConfirm,
    revalidated,
  })

  useEffect(() => {
    if (targetProviderId.length > 0 || executableTargets.length === 0) return
    const firstTarget = executableTargets[0]
    if (!firstTarget) return
    setTargetProviderId(firstTarget.providerId)
  }, [executableTargets, targetProviderId])

  const resetPlanState = () => {
    setPlan(null)
    setReceipt(null)
    setRevalidated(false)
    setHighRiskConfirm('')
    setError(null)
  }

  const toggleRef = (ref: string, selected: boolean) => {
    setRefs((current) =>
      selected
        ? [...new Set([...current, ref])].sort()
        : current.filter((candidate) => candidate !== ref)
    )
    resetPlanState()
  }

  const requestFields = {
    operationId,
    operation,
    refs,
    targetProviderId,
    reason,
    highRiskConfirm,
  }

  const runDryRun = async () => {
    if (!gate.canPreview) return
    setError(null)
    setReceipt(null)
    setRevalidated(false)
    setHighRiskConfirm('')
    try {
      const created = await createCampaign.mutateAsync(
        buildLiveBulkCampaignRequest(requestFields, undefined, false)
      )
      if (created.applied) {
        throw new Error(
          'Dry-run returned an applied campaign and was discarded.'
        )
      }
      const revalidatedPlan = await revalidateCampaign.mutateAsync(
        buildLiveBulkCampaignRequest(requestFields, created, false)
      )
      if (
        revalidatedPlan.applied ||
        revalidatedPlan.requiresRevalidation ||
        revalidatedPlan.planToken !== created.planToken
      ) {
        throw new Error('Campaign revalidation did not converge.')
      }
      setPlan(revalidatedPlan)
      setRevalidated(true)
    } catch (caught) {
      setPlan(null)
      setRevalidated(false)
      setError(
        campaignFailureCopy(
          caught,
          'The Broker did not return a durable dry-run. No provider write was attempted.'
        )
      )
    }
  }

  const runRevalidate = async () => {
    if (!plan || !gate.canRevalidate) return
    setError(null)
    setHighRiskConfirm('')
    try {
      const result = await revalidateCampaign.mutateAsync(
        buildLiveBulkCampaignRequest(requestFields, plan, false)
      )
      if (result.outcome === 'stale_plan' || result.applied) {
        throw new Error('Campaign revalidation failed closed.')
      }
      setPlan(result)
      setRevalidated(true)
    } catch (caught) {
      setRevalidated(false)
      setError(
        campaignFailureCopy(
          caught,
          'Campaign revalidation failed closed. Create a new dry-run if provider readiness changed.'
        )
      )
    }
  }

  const runApply = async () => {
    if (!plan || !gate.canApply) return
    setError(null)
    try {
      const fresh = await revalidateCampaign.mutateAsync(
        buildLiveBulkCampaignRequest(requestFields, plan, false)
      )
      if (
        fresh.outcome === 'stale_plan' ||
        fresh.planToken !== plan.planToken ||
        fresh.campaignId !== plan.campaignId
      ) {
        setPlan(fresh.outcome === 'stale_plan' ? fresh : null)
        setRevalidated(false)
        setError(
          'Revalidation found a stale or mismatched plan. Apply was not sent.'
        )
        return
      }
      setPlan(fresh)
      setRevalidated(true)
      const result = await applyCampaign.mutateAsync(
        buildLiveBulkCampaignRequest(requestFields, fresh, true)
      )
      if (
        !isExecutableBulkCampaignApply(operation) &&
        (result.applied || result.outcome === 'applied')
      ) {
        throw new Error(
          'Unsupported bulk campaign apply must fail closed rather than report metadata-only success.'
        )
      }
      setReceipt(result)
      setPlan(null)
      setHighRiskConfirm('')
    } catch (caught) {
      setError(
        campaignFailureCopy(
          caught,
          'Campaign apply failed closed. Source secrets remain authoritative; inspect each metadata-only result before retrying by operation ID.'
        )
      )
    }
  }

  const startFreshCampaign = () => {
    setOperationId(createBulkCampaignOperationId())
    setRefs([])
    setReason('')
    resetPlanState()
    createCampaign.reset()
    revalidateCampaign.reset()
    applyCampaign.reset()
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <CardTitle>Live migration campaign</CardTitle>
            <CardDescription>
              Broker-backed Stage 2/3 apply. Planning can preview every family;
              apply is executable only for migrate_remap_provider to a
              registered Vault/OpenBao or AWS executor.
            </CardDescription>
          </div>
          <Badge variant='outline'>Audit + typed campaign id</Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='bulk-campaign-family'>Operation family</Label>
            <select
              id='bulk-campaign-family'
              className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
              value={operation}
              disabled={plan !== null || receipt !== null}
              onChange={(event) => {
                const next = event.target.value
                if (!isBrokerBulkCampaignFamily(next)) return
                setOperation(next)
                resetPlanState()
              }}
            >
              {BROKER_BULK_CAMPAIGN_FAMILIES.map((family) => (
                <option key={family} value={family}>
                  {familyLabels[family]}
                </option>
              ))}
            </select>
          </div>
          {isExecutableBulkCampaignApply(operation) ? (
            <div className='space-y-2'>
              <Label htmlFor='bulk-campaign-target'>Executable target</Label>
              <select
                id='bulk-campaign-target'
                className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
                value={targetProviderId}
                disabled={plan !== null || receipt !== null}
                onChange={(event) => {
                  setTargetProviderId(event.target.value)
                  resetPlanState()
                }}
              >
                <option value=''>Select a validated target</option>
                {executableTargets.map((provider) => (
                  <option key={provider.providerId} value={provider.providerId}>
                    {provider.displayName} ({provider.providerKind})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <fieldset
          className='space-y-2 rounded-md border p-3'
          disabled={plan !== null || receipt !== null}
        >
          <legend className='px-1 text-sm font-medium'>Secret refs</legend>
          {records.length ? (
            <div className='max-h-48 space-y-2 overflow-y-auto'>
              {records.map((record) => (
                <label
                  key={record.ref}
                  className='flex items-start gap-3 rounded border p-2 text-sm'
                >
                  <Checkbox
                    checked={refs.includes(record.ref)}
                    onCheckedChange={(checked) =>
                      toggleRef(record.ref, checked === true)
                    }
                    aria-label={`Select ${record.ref} for bulk campaign`}
                  />
                  <span className='min-w-0'>
                    <span className='block font-mono text-xs break-all'>
                      {record.ref}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      {record.ownerServiceId ?? 'unowned'} · {record.outcome} ·{' '}
                      {record.providerKind}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className='text-sm text-muted-foreground'>
              Broker inventory is empty or unavailable.
            </p>
          )}
        </fieldset>

        <div className='space-y-2'>
          <Label htmlFor='bulk-campaign-audit-reason'>Audit reason</Label>
          <Textarea
            id='bulk-campaign-audit-reason'
            value={reason}
            disabled={plan !== null || receipt !== null}
            onChange={(event) => {
              setReason(event.target.value)
              resetPlanState()
            }}
            placeholder='Approved bulk provider migration'
          />
        </div>

        {plan ? (
          <div className='space-y-3 rounded-md border p-3 text-sm'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='font-medium'>
                Dry-run outcome: {plan.outcome}
              </span>
              <div className='flex flex-wrap gap-2'>
                <Badge variant='secondary'>{plan.auditStatus}</Badge>
                <Badge variant='outline'>
                  concurrency {plan.maxConcurrency}
                </Badge>
              </div>
            </div>
            <p>
              {plan.summary.applicableCount} of {plan.summary.selectedCount}{' '}
              selected refs are applicable. Denied {plan.summary.deniedCount},
              unsupported {plan.summary.unsupportedCount}, auth-required{' '}
              {plan.summary.authRequiredCount}, high risk{' '}
              {plan.summary.highRiskCount}.
            </p>
            <p className='font-mono text-xs break-all'>
              Campaign {plan.campaignId}
            </p>
            <div className='max-h-44 space-y-2 overflow-y-auto'>
              {plan.results.map((item) => (
                <div key={item.operationItemId} className='rounded border p-2'>
                  <div className='font-mono text-xs break-all'>{item.ref}</div>
                  <div className='text-xs text-muted-foreground'>
                    {item.outcome} · {item.capabilityResult} ·{' '}
                    {item.policyResult} · {item.expectedAction}
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    operation {item.operationItemId}
                  </div>
                </div>
              ))}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='bulk-campaign-id-confirm'>
                Type campaign id to confirm
              </Label>
              <Input
                id='bulk-campaign-id-confirm'
                value={highRiskConfirm}
                onChange={(event) => setHighRiskConfirm(event.target.value)}
                placeholder={plan.campaignId}
                autoComplete='off'
              />
            </div>
            {!gate.applyExecutable ? (
              <p className='text-sm text-destructive'>
                Apply is unsupported for {operation}. Other families fail closed
                instead of reporting metadata-only success.
              </p>
            ) : null}
          </div>
        ) : null}

        {receipt ? (
          <div className='space-y-3 rounded-md border p-3 text-sm'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='font-medium'>
                Campaign outcome: {receipt.outcome}
              </span>
              <Badge variant={receipt.applied ? 'secondary' : 'destructive'}>
                {receipt.applied ? 'applied' : 'not applied'}
              </Badge>
            </div>
            <p>
              {receipt.summary.appliedCount} verified;{' '}
              {receipt.summary.failedCount} failed;{' '}
              {receipt.summary.skippedCount} deferred;{' '}
              {receipt.summary.deniedCount} denied;{' '}
              {receipt.summary.unsupportedCount} unsupported.
            </p>
            {receipt.results.map((item) => (
              <p key={item.operationItemId} className='text-xs'>
                <span className='font-mono'>{item.ref}</span>: {item.outcome}
                {item.verified ? ' · verified' : ''}
                {item.retrySafe ? ' · retry-safe' : ' · do not blind-retry'}
                {item.nextAction ? ` · ${item.nextAction}` : ''}
              </p>
            ))}
            <p className='text-xs text-muted-foreground'>
              {bulkCampaignRecoveryCopy(receipt)}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
            {error}
          </div>
        ) : null}

        {gate.applyBlockers.length > 0 && !receipt ? (
          <p className='text-xs text-muted-foreground'>
            Apply blocked: {gate.applyBlockers[0]}
          </p>
        ) : null}

        <div className='flex flex-wrap items-center justify-end gap-2'>
          <Button type='button' variant='outline' onClick={startFreshCampaign}>
            Reset campaign
          </Button>
          {!plan && !receipt ? (
            <Button
              type='button'
              disabled={!gate.canPreview || createCampaign.isPending}
              onClick={() => void runDryRun()}
            >
              Dry-run campaign
            </Button>
          ) : null}
          {plan ? (
            <>
              <Button
                type='button'
                variant='outline'
                disabled={!gate.canRevalidate || revalidateCampaign.isPending}
                onClick={() => void runRevalidate()}
              >
                Revalidate campaign
              </Button>
              <Button
                type='button'
                disabled={!gate.canApply || applyCampaign.isPending}
                onClick={() => void runApply()}
              >
                Apply migration campaign
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
