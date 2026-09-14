import { describe, expect, it } from 'vitest'
import type {
  BrokerBulkCampaignResult,
  SecretBulkCampaignPlan,
} from '@/lib/service-lasso-dashboard/types'
import {
  BROKER_BULK_CAMPAIGN_FAMILIES,
  buildLiveBulkCampaignGate,
  buildLiveBulkCampaignRequest,
  bulkCampaignRecoveryCopy,
  bulkCampaignSurfaceHasSecretMaterial,
  isExecutableBulkCampaignApply,
  isFixtureBulkCampaignApplyDisabled,
} from './bulk-campaign-contract'

function fixturePlan(
  overrides: Partial<SecretBulkCampaignPlan> = {}
): SecretBulkCampaignPlan {
  return {
    id: 'bulk-campaign-runtime-keys-stage-1',
    planRevision: 'bulk-dry-run',
    operation: 'rotate_reset',
    operationLabel: 'Bulk rotate/reset',
    generatedAt: '2026-04-11T00:00:00.000Z',
    expiresAt: '2026-04-11T00:15:00.000Z',
    dryRunOnly: true,
    applySupported: false,
    auditReasonRequired: true,
    highRiskConfirmationRequired: true,
    selectedCount: 3,
    applicableCount: 1,
    deniedCount: 1,
    unsupportedCount: 1,
    highRiskCount: 1,
    items: [],
    safeNextAction: 'review dry run',
    ...overrides,
  }
}

function livePlan(
  overrides: Partial<BrokerBulkCampaignResult> = {}
): BrokerBulkCampaignResult {
  return {
    serviceId: '@secretsbroker',
    apiVersion: 'secretsbroker.local/v1',
    requestId: 'req-1',
    campaignId: 'campaign-fixed',
    planToken: 'plan-fixed',
    operationId: 'op-fixed',
    operation: 'migrate_remap_provider',
    mode: 'revalidate',
    outcome: 'dry_run_ready',
    applied: false,
    requiresConfirmation: true,
    requiresAuditReason: true,
    requiresRevalidation: false,
    auditStatus: 'audit_recorded',
    staleAfterSeconds: 300,
    results: [],
    summary: {
      selectedCount: 1,
      applicableCount: 1,
      deniedCount: 0,
      unsupportedCount: 0,
      authRequiredCount: 0,
      skippedCount: 0,
      appliedCount: 0,
      failedCount: 0,
      staleCount: 0,
      highRiskCount: 1,
    },
    affectedRefs: ['services/@serviceadmin/runtime/SESSION_SIGNING_KEY'],
    affectedServices: ['@serviceadmin'],
    durable: true,
    maxConcurrency: 1,
    backpressurePolicy: 'stop_and_defer_remaining',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('Security bulk campaign contract', () => {
  it('keeps mixed fixture apply disabled and executable apply limited to migrate_remap_provider', () => {
    expect(isFixtureBulkCampaignApplyDisabled(fixturePlan())).toBe(true)
    expect(
      isFixtureBulkCampaignApplyDisabled(
        fixturePlan({ dryRunOnly: false, applySupported: true })
      )
    ).toBe(true)
    expect(isExecutableBulkCampaignApply('migrate_remap_provider')).toBe(true)
    for (const family of BROKER_BULK_CAMPAIGN_FAMILIES) {
      if (family !== 'migrate_remap_provider') {
        expect(isExecutableBulkCampaignApply(family)).toBe(false)
      }
    }
  })

  it('requires audit reason, revalidation, and exact campaign id before apply', () => {
    const missingReason = buildLiveBulkCampaignGate({
      operation: 'migrate_remap_provider',
      refs: ['services/@serviceadmin/runtime/SESSION_SIGNING_KEY'],
      targetProviderId: 'vault-target',
      reason: '',
      plan: null,
      highRiskConfirm: '',
      revalidated: false,
    })
    expect(missingReason.canPreview).toBe(false)
    expect(missingReason.previewBlockers).toContain('audit reason is required')

    const secretReason = buildLiveBulkCampaignGate({
      operation: 'migrate_remap_provider',
      refs: ['services/@serviceadmin/runtime/SESSION_SIGNING_KEY'],
      targetProviderId: 'vault-target',
      reason: 'rotate because password=super-secret',
      plan: null,
      highRiskConfirm: '',
      revalidated: false,
    })
    expect(secretReason.canPreview).toBe(false)
    expect(secretReason.previewBlockers[0]).toMatch(/secret-like material/)

    const readyPlan = livePlan()
    const unconfirmed = buildLiveBulkCampaignGate({
      operation: 'migrate_remap_provider',
      refs: readyPlan.affectedRefs,
      targetProviderId: 'vault-target',
      reason: 'approved bulk provider migration',
      plan: readyPlan,
      highRiskConfirm: 'wrong-id',
      revalidated: true,
    })
    expect(unconfirmed.canApply).toBe(false)
    expect(unconfirmed.applyBlockers).toContain(
      'type the exact campaign id to confirm'
    )

    const confirmed = buildLiveBulkCampaignGate({
      operation: 'migrate_remap_provider',
      refs: readyPlan.affectedRefs,
      targetProviderId: 'vault-target',
      reason: 'approved bulk provider migration',
      plan: readyPlan,
      highRiskConfirm: 'campaign-fixed',
      revalidated: true,
    })
    expect(confirmed.canApply).toBe(true)
  })

  it('fails closed for unsupported families, stale plans, and audit-unavailable apply', () => {
    const rotateGate = buildLiveBulkCampaignGate({
      operation: 'rotate_reset',
      refs: ['services/@serviceadmin/runtime/SESSION_SIGNING_KEY'],
      targetProviderId: '',
      reason: 'approved bulk rotation planning',
      plan: livePlan({ operation: 'rotate_reset' }),
      highRiskConfirm: 'campaign-fixed',
      revalidated: true,
    })
    expect(rotateGate.canPreview).toBe(true)
    expect(rotateGate.canApply).toBe(false)
    expect(rotateGate.applyBlockers[0]).toMatch(/migrate_remap_provider/)

    const staleGate = buildLiveBulkCampaignGate({
      operation: 'migrate_remap_provider',
      refs: ['services/@serviceadmin/runtime/SESSION_SIGNING_KEY'],
      targetProviderId: 'vault-target',
      reason: 'approved bulk provider migration',
      plan: livePlan({ outcome: 'stale_plan' }),
      highRiskConfirm: 'campaign-fixed',
      revalidated: true,
    })
    expect(staleGate.canApply).toBe(false)
    expect(staleGate.applyBlockers).toContain(
      'stale plan; create a fresh dry-run'
    )

    const auditGate = buildLiveBulkCampaignGate({
      operation: 'migrate_remap_provider',
      refs: ['services/payments-api/runtime/WEBHOOK_DIGEST'],
      targetProviderId: 'vault-target',
      reason: 'approved bulk provider migration',
      plan: livePlan({
        auditStatus: 'audit_unavailable',
        summary: {
          selectedCount: 1,
          applicableCount: 1,
          deniedCount: 0,
          unsupportedCount: 0,
          authRequiredCount: 0,
          skippedCount: 0,
          appliedCount: 0,
          failedCount: 1,
          staleCount: 0,
          highRiskCount: 1,
        },
      }),
      highRiskConfirm: 'campaign-fixed',
      revalidated: true,
    })
    expect(auditGate.canApply).toBe(false)
    expect(auditGate.applyBlockers).toContain(
      'audit unavailable; apply fails closed'
    )
  })

  it('keeps apply requests confirm-gated and redacts secret-like surfaces', () => {
    const plan = livePlan()
    const preview = buildLiveBulkCampaignRequest(
      {
        operationId: 'op-fixed',
        operation: 'migrate_remap_provider',
        refs: plan.affectedRefs,
        targetProviderId: 'vault-target',
        reason: 'approved bulk provider migration',
      },
      plan,
      false
    )
    expect(preview.confirm).toBe(false)
    expect(preview.highRiskConfirm).toBeUndefined()

    const apply = buildLiveBulkCampaignRequest(
      {
        operationId: 'op-fixed',
        operation: 'migrate_remap_provider',
        refs: plan.affectedRefs,
        targetProviderId: 'vault-target',
        reason: 'approved bulk provider migration',
      },
      plan,
      true
    )
    expect(apply.confirm).toBe(true)
    expect(apply.highRiskConfirm).toBe('campaign-fixed')
    expect(bulkCampaignSurfaceHasSecretMaterial(plan)).toBe(false)
    expect(
      bulkCampaignSurfaceHasSecretMaterial({
        value: 'fixture-revealed-value',
      })
    ).toBe(true)
    expect(
      bulkCampaignRecoveryCopy(livePlan({ outcome: 'partial_failure' }))
    ).toMatch(/Retry only items/)
    expect(
      bulkCampaignRecoveryCopy(
        livePlan({ outcome: 'unsupported', applied: false })
      )
    ).toMatch(/registered executor/)
  })
})
