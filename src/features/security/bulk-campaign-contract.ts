import type {
  BrokerBulkCampaignFamily,
  BrokerBulkCampaignRequest,
  BrokerBulkCampaignResult,
  SecretBulkCampaignPlan,
} from '@/lib/service-lasso-dashboard/types'
import { managedSecretAuditReasonHasSecretMaterial } from '@/features/secrets-broker/secrets-management'

/**
 * Broker planning families for bulk campaigns. Apply is executable only for
 * migrate_remap_provider; every other family must fail closed.
 */
export const BROKER_BULK_CAMPAIGN_FAMILIES: readonly BrokerBulkCampaignFamily[] =
  [
    'rotate_reset',
    'update_edit',
    'apply_policy',
    'migrate_remap_provider',
    'mark_action_required',
  ]

const campaignMaterialPattern =
  /(secret-value|plaintext|fixture-revealed-value|provider token|password\s*=|bearer\s+|private key|cookie=)/i

export type LiveBulkCampaignGateInput = {
  operation: BrokerBulkCampaignFamily
  refs: string[]
  targetProviderId: string
  reason: string
  plan: BrokerBulkCampaignResult | null
  highRiskConfirm: string
  revalidated: boolean
}

export type LiveBulkCampaignGate = {
  previewBlockers: string[]
  applyBlockers: string[]
  canPreview: boolean
  canRevalidate: boolean
  canApply: boolean
  confirmationRequired: boolean
  confirmationPhrase: string
  confirmationAccepted: boolean
  applyExecutable: boolean
}

/**
 * True when apply is allowed to call a registered Vault/OpenBao or AWS executor.
 */
export function isExecutableBulkCampaignApply(
  operation: string
): operation is 'migrate_remap_provider' {
  return operation === 'migrate_remap_provider'
}

/**
 * Fixture Stage 1 mixed plans stay dry-run only. Apply stays disabled even if
 * a later fixture flag is flipped without a live migrate contract.
 */
export function isFixtureBulkCampaignApplyDisabled(
  plan: SecretBulkCampaignPlan
) {
  return (
    plan.dryRunOnly ||
    !plan.applySupported ||
    plan.operation !== 'migrate_provider'
  )
}

/**
 * Builds preview and apply gates for the live Security campaign planner.
 */
export function buildLiveBulkCampaignGate(
  input: LiveBulkCampaignGateInput
): LiveBulkCampaignGate {
  const previewBlockers: string[] = []
  const reason = input.reason.trim()
  if (input.refs.length === 0) {
    previewBlockers.push('select at least one ref')
  }
  if (
    isExecutableBulkCampaignApply(input.operation) &&
    !input.targetProviderId.trim()
  ) {
    previewBlockers.push('select an executable Vault or AWS target')
  }
  if (!reason) {
    previewBlockers.push('audit reason is required')
  } else if (managedSecretAuditReasonHasSecretMaterial(reason)) {
    previewBlockers.push('audit reason contains secret-like material')
  }

  const applyExecutable = isExecutableBulkCampaignApply(input.operation)
  const confirmationPhrase = input.plan?.campaignId ?? ''
  const confirmationRequired = Boolean(input.plan)
  const confirmationAccepted =
    confirmationPhrase.length > 0 &&
    input.highRiskConfirm.trim() === confirmationPhrase
  const applyBlockers = [...previewBlockers]
  if (!applyExecutable) {
    applyBlockers.push(
      'apply is executable only for migrate_remap_provider to a registered executor'
    )
  }
  if (!input.plan) {
    applyBlockers.push('generate a broker-backed dry-run first')
  } else {
    if (input.plan.outcome === 'stale_plan') {
      applyBlockers.push('stale plan; create a fresh dry-run')
    }
    if (input.plan.auditStatus === 'audit_unavailable') {
      applyBlockers.push('audit unavailable; apply fails closed')
    }
    if (input.plan.summary.applicableCount === 0) {
      applyBlockers.push('no selected refs are applicable for apply')
    }
    if (input.plan.applied) {
      applyBlockers.push('this campaign already has an apply receipt')
    }
  }
  if (!input.revalidated) {
    applyBlockers.push('revalidate immediately before apply')
  }
  if (confirmationRequired && !confirmationAccepted) {
    applyBlockers.push('type the exact campaign id to confirm')
  }

  const canPreview = previewBlockers.length === 0
  const canRevalidate =
    canPreview && input.plan !== null && input.plan.applied !== true
  const canApply = applyBlockers.length === 0

  return {
    previewBlockers,
    applyBlockers,
    canPreview,
    canRevalidate,
    canApply,
    confirmationRequired,
    confirmationPhrase,
    confirmationAccepted,
    applyExecutable,
  }
}

/**
 * Builds the durable campaign request. Apply always sends confirm plus the
 * exact campaign id; preview and revalidate never claim apply success.
 */
export function buildLiveBulkCampaignRequest(
  input: {
    operationId: string
    operation: BrokerBulkCampaignFamily
    refs: string[]
    targetProviderId: string
    reason: string
    highRiskConfirm?: string
  },
  plan: BrokerBulkCampaignResult | undefined,
  confirm: boolean
): BrokerBulkCampaignRequest {
  return {
    campaignId: plan?.campaignId,
    planToken: plan?.planToken,
    operationId: input.operationId,
    operation: input.operation,
    refs: [...input.refs].sort(),
    targetProviderId: input.targetProviderId,
    reason: input.reason.trim(),
    confirm,
    highRiskConfirm: confirm ? plan?.campaignId : undefined,
  }
}

/**
 * Creates a retry-safe browser operation id for one campaign attempt.
 */
export function createBulkCampaignOperationId() {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `serviceadmin-bulk-campaign-${randomPart}`
}

/**
 * True when serialized campaign metadata looks like secret or credential text.
 */
export function bulkCampaignSurfaceHasSecretMaterial(value: unknown) {
  return campaignMaterialPattern.test(JSON.stringify(value))
}

/**
 * Operator-visible recovery copy. Never invents a blind retry.
 */
export function bulkCampaignRecoveryCopy(result: BrokerBulkCampaignResult) {
  if (result.outcome === 'stale_plan') {
    return 'Create a fresh dry-run. Do not replay the previous plan token.'
  }
  if (result.outcome === 'unsupported') {
    return 'Apply is unsupported for this family. Use migrate_remap_provider with a registered executor.'
  }
  if (result.outcome === 'audit_unavailable') {
    return 'Restore audit persistence, then create a fresh campaign. Source refs were not mutated.'
  }
  if (result.outcome === 'partial_failure') {
    return 'Retry only items whose operation IDs are still retry-safe. Do not blindly replay the whole campaign.'
  }
  if (result.applied) {
    return 'Inspect verified items. Retry remaining retry-safe operation IDs only.'
  }
  return 'Fix typed blockers, then generate a new dry-run. Source secrets remain authoritative.'
}
