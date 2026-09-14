import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrokerBulkCampaignResult } from '@/lib/service-lasso-dashboard/types'
import { LiveBulkCampaignPlanner } from './bulk-campaign-planner'

const campaignApi = vi.hoisted(() => ({
  create: vi.fn(),
  revalidate: vi.fn(),
  apply: vi.fn(),
}))

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useSecretsManagement: () => ({
    data: {
      results: [
        {
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          name: 'SESSION_SIGNING_KEY',
          sourceId: 'local',
          providerKind: 'local-encrypted-store',
          ownerServiceId: '@serviceadmin',
          outcome: 'ready',
          state: 'present',
        },
        {
          ref: 'services/echo-service/env/API_TOKEN',
          name: 'API_TOKEN',
          sourceId: 'legacy-env',
          providerKind: 'legacy-env-file',
          ownerServiceId: 'echo-service',
          outcome: 'policy_denied',
          state: 'present',
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useBrokerProviderStatus: () => ({
    data: {
      providers: [
        {
          providerId: 'vault-target',
          providerKind: 'vault',
          displayName: 'Vault migration target',
          operations: [
            {
              path: '/v1/providers/migration/apply',
              maturity: 'validated',
            },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useBrokerBulkCampaignCreate: () => ({
    mutateAsync: campaignApi.create,
    isPending: false,
    reset: vi.fn(),
  }),
  useBrokerBulkCampaignRevalidate: () => ({
    mutateAsync: campaignApi.revalidate,
    isPending: false,
    reset: vi.fn(),
  }),
  useBrokerBulkCampaignApply: () => ({
    mutateAsync: campaignApi.apply,
    isPending: false,
    reset: vi.fn(),
  }),
}))

function campaignResult(
  mode: BrokerBulkCampaignResult['mode'],
  overrides: Partial<BrokerBulkCampaignResult> = {}
): BrokerBulkCampaignResult {
  return {
    serviceId: '@secretsbroker',
    apiVersion: 'secretsbroker.local/v1',
    requestId: `req-${mode}`,
    campaignId: 'campaign-fixed',
    planToken: 'plan-fixed',
    operationId: 'op-fixed',
    operation: 'migrate_remap_provider',
    mode,
    outcome: mode === 'apply' ? 'applied' : 'dry_run_ready',
    applied: mode === 'apply',
    requiresConfirmation: mode !== 'apply',
    requiresAuditReason: mode !== 'apply',
    requiresRevalidation: mode === 'create',
    auditStatus: 'audit_recorded',
    staleAfterSeconds: 300,
    results: [
      {
        ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
        sourceId: 'local',
        providerKind: 'local-encrypted-store',
        ownerServiceId: '@serviceadmin',
        operation: 'migrate_remap_provider',
        capabilityResult: 'supported',
        policyResult: 'allowed',
        auditRequirement: 'required',
        risk: 'high',
        expectedAction: 'copy_or_remap_value_inside_broker_to_target_provider',
        outcome: mode === 'apply' ? 'migrated' : 'dry_run_ready',
        idempotencyKey: 'item-key',
        operationItemId: 'item-fixed',
        applied: mode === 'apply',
        retrySafe: true,
        verified: mode === 'apply',
      },
    ],
    summary: {
      selectedCount: 1,
      applicableCount: 1,
      deniedCount: 0,
      unsupportedCount: 0,
      authRequiredCount: 0,
      skippedCount: 0,
      appliedCount: mode === 'apply' ? 1 : 0,
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

describe('Live bulk campaign planner', () => {
  beforeEach(() => {
    campaignApi.create.mockReset()
    campaignApi.revalidate.mockReset()
    campaignApi.apply.mockReset()
    campaignApi.create.mockResolvedValue(campaignResult('create'))
    campaignApi.revalidate.mockResolvedValue(campaignResult('revalidate'))
    campaignApi.apply.mockResolvedValue(campaignResult('apply'))
  })

  it('keeps apply disabled until dry-run, revalidation, audit reason, and typed campaign id', async () => {
    const user = userEvent.setup()
    render(<LiveBulkCampaignPlanner />)

    expect(
      screen.queryByRole('button', { name: /Apply migration campaign/i })
    ).toBeNull()
    await user.click(
      screen.getByLabelText(
        'Select services/@serviceadmin/runtime/SESSION_SIGNING_KEY for bulk campaign'
      )
    )
    await user.click(screen.getByRole('button', { name: /Dry-run campaign/i }))
    expect(await screen.findByText(/audit reason is required/i)).toBeVisible()
    expect(campaignApi.create).not.toHaveBeenCalled()

    await user.type(
      screen.getByLabelText(/Audit reason/i),
      'approved bulk provider migration'
    )
    await user.click(screen.getByRole('button', { name: /Dry-run campaign/i }))
    expect(await screen.findByText(/Dry-run outcome/i)).toBeVisible()
    const applyButton = screen.getByRole('button', {
      name: /Apply migration campaign/i,
    })
    expect(applyButton).toBeDisabled()
    await user.type(
      screen.getByLabelText(/Type campaign id to confirm/i),
      'campaign-fixed'
    )
    expect(applyButton).toBeEnabled()
    expect(screen.queryByText(/secret-value/i)).toBeNull()
    expect(screen.queryByText(/provider token/i)).toBeNull()
  })

  it('revalidates immediately before apply and shows per-item campaign outcomes', async () => {
    const user = userEvent.setup()
    render(<LiveBulkCampaignPlanner />)

    await user.click(
      screen.getByLabelText(
        'Select services/@serviceadmin/runtime/SESSION_SIGNING_KEY for bulk campaign'
      )
    )
    await user.type(
      screen.getByLabelText(/Audit reason/i),
      'approved bulk provider migration'
    )
    await user.click(screen.getByRole('button', { name: /Dry-run campaign/i }))
    await user.type(
      await screen.findByLabelText(/Type campaign id to confirm/i),
      'campaign-fixed'
    )
    await user.click(
      screen.getByRole('button', { name: /Apply migration campaign/i })
    )

    expect(await screen.findByText(/Campaign outcome: applied/i)).toBeVisible()
    expect(screen.getByText(/1 verified/i)).toBeVisible()
    expect(screen.getAllByText(/retry-safe/i).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(campaignApi.revalidate).toHaveBeenCalled()
      expect(campaignApi.apply).toHaveBeenCalled()
    })
    const applyRequest = campaignApi.apply.mock.calls[0]?.[0] as {
      confirm?: boolean
      highRiskConfirm?: string
    }
    expect(applyRequest.confirm).toBe(true)
    expect(applyRequest.highRiskConfirm).toBe('campaign-fixed')
  })

  it('fails closed on a stale revalidation instead of sending apply', async () => {
    const user = userEvent.setup()
    campaignApi.revalidate
      .mockResolvedValueOnce(campaignResult('revalidate'))
      .mockResolvedValueOnce(
        campaignResult('revalidate', {
          outcome: 'stale_plan',
          planToken: 'other-plan',
        })
      )
    render(<LiveBulkCampaignPlanner />)

    await user.click(
      screen.getByLabelText(
        'Select services/@serviceadmin/runtime/SESSION_SIGNING_KEY for bulk campaign'
      )
    )
    await user.type(
      screen.getByLabelText(/Audit reason/i),
      'approved bulk provider migration'
    )
    await user.click(screen.getByRole('button', { name: /Dry-run campaign/i }))
    await user.type(
      await screen.findByLabelText(/Type campaign id to confirm/i),
      'campaign-fixed'
    )
    await user.click(
      screen.getByRole('button', { name: /Apply migration campaign/i })
    )

    expect(await screen.findByText(/stale or mismatched plan/i)).toBeVisible()
    expect(campaignApi.apply).not.toHaveBeenCalled()
  })
})
