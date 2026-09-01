import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadStub() {
  vi.resetModules()
  return import('@/lib/service-lasso-dashboard/stub')
}

const migrateRef = 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY'
const digestRef = 'services/echo-service/runtime/CONFIG_DIGEST'
const deniedRef = 'services/echo-service/env/API_TOKEN'
const unsupportedRef = 'services/archive/runtime/RECOVERABLE_TOKEN'
const authRef = 'zitadel/traefik-oidc-auth/client-secret'
const auditRef = 'services/payments-api/runtime/WEBHOOK_DIGEST'

describe('stub bulk campaign Stage 2/3 contract', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'true')
  })

  it('plans mixed dry-run outcomes without enabling unsupported apply as success', async () => {
    const client = await loadStub()
    client.resetStubBulkCampaigns()
    const request = {
      operationId: 'stub-mixed-plan',
      operation: 'rotate_reset' as const,
      refs: [migrateRef, deniedRef, unsupportedRef, authRef],
      targetProviderId: '',
      reason: 'approved bulk rotation planning',
    }
    const created = await client.createBrokerBulkCampaign(request)
    expect(created.applied).toBe(false)
    expect(created.requiresRevalidation).toBe(true)
    expect(created.results.map((item) => item.outcome).sort()).toEqual([
      'dry_run_ready',
      'policy_denied',
      'source_auth_required',
      'unsupported',
    ])
    const revalidated = await client.revalidateBrokerBulkCampaign({
      ...request,
      campaignId: created.campaignId,
      planToken: created.planToken,
    })
    const applied = await client.applyBrokerBulkCampaign({
      ...request,
      campaignId: revalidated.campaignId,
      planToken: revalidated.planToken,
      confirm: true,
      highRiskConfirm: revalidated.campaignId,
    })
    expect(applied.applied).toBe(false)
    expect(applied.outcome).toBe('unsupported')
    expect(applied.results.every((item) => item.applied === false)).toBe(true)
    expect(JSON.stringify(applied)).not.toMatch(/secret-value|provider token/i)
  })

  it('applies migrate_remap_provider after revalidation and exact campaign confirmation', async () => {
    const client = await loadStub()
    client.resetStubBulkCampaigns()
    const request = {
      operationId: 'stub-migrate-success',
      operation: 'migrate_remap_provider' as const,
      refs: [migrateRef],
      targetProviderId: 'vault-target',
      reason: 'approved bulk provider migration',
    }
    const created = await client.createBrokerBulkCampaign(request)
    const withoutRevalidate = await client.applyBrokerBulkCampaign({
      ...request,
      campaignId: created.campaignId,
      planToken: created.planToken,
      confirm: true,
      highRiskConfirm: created.campaignId,
    })
    expect(withoutRevalidate.outcome).toBe('stale_plan')
    expect(withoutRevalidate.applied).toBe(false)

    const revalidated = await client.revalidateBrokerBulkCampaign({
      ...request,
      campaignId: created.campaignId,
      planToken: created.planToken,
    })
    const deniedConfirm = await client.applyBrokerBulkCampaign({
      ...request,
      campaignId: revalidated.campaignId,
      planToken: revalidated.planToken,
      confirm: true,
      highRiskConfirm: 'wrong-campaign-id',
    })
    expect(deniedConfirm.outcome).toBe('policy_denied')
    expect(deniedConfirm.applied).toBe(false)

    const applied = await client.applyBrokerBulkCampaign({
      ...request,
      campaignId: revalidated.campaignId,
      planToken: revalidated.planToken,
      confirm: true,
      highRiskConfirm: revalidated.campaignId,
    })
    expect(applied.outcome).toBe('applied')
    expect(applied.applied).toBe(true)
    expect(applied.results[0]?.verified).toBe(true)
    expect(applied.results[0]?.operationItemId.length).toBeGreaterThan(0)
  })

  it('shows denied, unsupported, auth-required, audit-unavailable, partial, and retry-safe recovery', async () => {
    const client = await loadStub()
    client.resetStubBulkCampaigns()

    const denied = await client.createBrokerBulkCampaign({
      operationId: 'stub-denied',
      operation: 'migrate_remap_provider',
      refs: [deniedRef],
      targetProviderId: 'vault-target',
      reason: 'approved bulk provider migration',
    })
    expect(denied.outcome).toBe('policy_denied')
    expect(denied.summary.deniedCount).toBe(1)

    const unsupported = await client.createBrokerBulkCampaign({
      operationId: 'stub-unsupported',
      operation: 'migrate_remap_provider',
      refs: [unsupportedRef],
      targetProviderId: 'vault-target',
      reason: 'approved bulk provider migration',
    })
    expect(unsupported.outcome).toBe('unsupported')

    const authRequired = await client.createBrokerBulkCampaign({
      operationId: 'stub-auth',
      operation: 'migrate_remap_provider',
      refs: [authRef],
      targetProviderId: 'vault-target',
      reason: 'approved bulk provider migration',
    })
    expect(authRequired.outcome).toBe('source_auth_required')

    const auditUnavailable = await client.createBrokerBulkCampaign({
      operationId: 'stub-audit',
      operation: 'migrate_remap_provider',
      refs: [auditRef],
      targetProviderId: 'vault-target',
      reason: 'approved bulk provider migration',
    })
    expect(auditUnavailable.outcome).toBe('audit_unavailable')

    const partialRequest = {
      operationId: 'stub-partial',
      operation: 'migrate_remap_provider' as const,
      refs: [digestRef, migrateRef],
      targetProviderId: 'vault-target',
      reason: 'approved bulk provider migration',
    }
    const created = await client.createBrokerBulkCampaign(partialRequest)
    const revalidated = await client.revalidateBrokerBulkCampaign({
      ...partialRequest,
      campaignId: created.campaignId,
      planToken: created.planToken,
    })
    const firstApply = await client.applyBrokerBulkCampaign({
      ...partialRequest,
      campaignId: revalidated.campaignId,
      planToken: revalidated.planToken,
      confirm: true,
      highRiskConfirm: revalidated.campaignId,
    })
    expect(firstApply.outcome).toBe('partial_failure')
    expect(firstApply.summary.appliedCount).toBe(1)
    expect(firstApply.summary.failedCount).toBe(1)
    const failed = firstApply.results.find(
      (item) => item.outcome === 'verification_failed'
    )
    expect(failed?.retrySafe).toBe(true)
    expect(failed?.applied).toBe(false)

    const retried = await client.applyBrokerBulkCampaign({
      ...partialRequest,
      campaignId: revalidated.campaignId,
      planToken: revalidated.planToken,
      confirm: true,
      highRiskConfirm: revalidated.campaignId,
    })
    expect(retried.outcome).toBe('applied')
    expect(retried.summary.appliedCount).toBe(2)
    expect(retried.results.every((item) => item.verified && item.applied)).toBe(
      true
    )
  })

  it('treats a mismatched plan token as a stale campaign', async () => {
    const client = await loadStub()
    client.resetStubBulkCampaigns()
    const request = {
      operationId: 'stub-stale',
      operation: 'migrate_remap_provider' as const,
      refs: [migrateRef],
      targetProviderId: 'vault-target',
      reason: 'approved bulk provider migration',
      planToken: 'unknown-plan-token',
    }
    const stale = await client.revalidateBrokerBulkCampaign(request)
    expect(stale.outcome).toBe('stale_plan')
    expect(stale.applied).toBe(false)
  })
})
