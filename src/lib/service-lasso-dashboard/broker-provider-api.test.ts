import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  BrokerMigrationPlan,
  BrokerProviderConfigurationState,
  BrokerProviderValidationResult,
} from './types'

async function importRuntimeBrokerClient() {
  vi.resetModules()
  vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
  vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://127.0.0.1:17883')

  return import('./stub')
}

describe('broker provider runtime API', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('loads provider configuration from the broker runtime API', async () => {
    const configuration = {
      updatedAt: '2026-08-01T10:00:00Z',
      activeProviderId: 'local-vault',
      providers: [
        {
          id: 'local-vault',
          name: 'Local vault',
          status: 'valid',
          lastValidatedAt: '2026-08-01T09:59:00Z',
          capabilities: [{ key: 'migration_apply', executable: true }],
          references: [
            {
              handle: 'ref://local/service-admin/session-key',
              label: 'Service Admin session key',
              kind: 'secret',
            },
          ],
          recoveryGuidance: ['Revalidate before applying.'],
          warnings: [],
        },
      ],
    } satisfies BrokerProviderConfigurationState
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ configuration }), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { fetchBrokerProviderConfiguration } =
      await importRuntimeBrokerClient()
    const result = await fetchBrokerProviderConfiguration()

    expect(result).toEqual(configuration)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:17883/api/broker/providers/configuration',
      expect.objectContaining({ method: undefined })
    )
  })

  it('validates provider references without sending credential material', async () => {
    const validation = {
      ok: true,
      providerId: 'local-vault',
      validatedAt: '2026-08-01T10:02:00Z',
      staleAfter: '2026-08-01T10:12:00Z',
      deniedReason: null,
      warnings: [],
    } satisfies BrokerProviderValidationResult
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify(validation), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { runBrokerProviderValidation } = await importRuntimeBrokerClient()
    const result = await runBrokerProviderValidation({
      providerId: 'local-vault',
      referenceHandles: ['ref://handle/service-admin/session-key'],
      auditReason: 'pre-migration validation',
    })
    const [, request] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    const body = JSON.parse(String(request.body))

    expect(result).toEqual(validation)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:17883/api/broker/providers/local-vault/validate',
      expect.objectContaining({ method: 'POST' })
    )
    expect(body).toEqual({
      referenceHandles: ['ref://handle/service-admin/session-key'],
      auditReason: 'pre-migration validation',
    })
    expect(JSON.stringify(body)).not.toMatch(/password|credential|token/i)
  })

  it('posts migration dry-run requests and apply confirmations separately', async () => {
    const plan = {
      planId: 'plan-123',
      sourceProviderId: 'local-vault',
      targetProviderId: 'remote-provider',
      createdAt: '2026-08-01T10:03:00Z',
      validationRequiredAt: '2026-08-01T10:13:00Z',
      executable: true,
      disabledReason: null,
      outcomes: [
        {
          handle: 'ref://handle/service-admin/session-key',
          status: 'success',
          reason: null,
          targetMetadata: { providerId: 'remote-provider' },
        },
      ],
      rollbackGuidance: ['Restore the previous provider reference mapping.'],
    } satisfies BrokerMigrationPlan
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(plan), {
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            planId: 'plan-123',
            appliedAt: '2026-08-01T10:04:00Z',
            outcomes: plan.outcomes,
            rollbackGuidance: plan.rollbackGuidance,
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    vi.stubGlobal('fetch', fetchMock)

    const { runBrokerMigrationApply, runBrokerMigrationDryRun } =
      await importRuntimeBrokerClient()

    await runBrokerMigrationDryRun({
      sourceProviderId: 'local-vault',
      targetProviderId: 'remote-provider',
      referenceHandles: ['ref://handle/service-admin/session-key'],
      auditReason: 'dry-run before apply',
    })
    await runBrokerMigrationApply({
      planId: 'plan-123',
      confirmation: true,
      auditReason: 'apply validated migration',
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://127.0.0.1:17883/api/broker/migrations/dry-run'
    )
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      sourceProviderId: 'local-vault',
      targetProviderId: 'remote-provider',
      referenceHandles: ['ref://handle/service-admin/session-key'],
      auditReason: 'dry-run before apply',
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://127.0.0.1:17883/api/broker/migrations/plan-123/apply'
    )
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      confirmation: true,
      auditReason: 'apply validated migration',
    })
  })

  it('requires fresh target-provider validation before migration apply', async () => {
    const { canApplyBrokerMigrationPlan } = await importRuntimeBrokerClient()
    const plan = {
      planId: 'plan-123',
      sourceProviderId: 'local-vault',
      targetProviderId: 'remote-provider',
      createdAt: '2026-08-01T10:03:00Z',
      validationRequiredAt: '2026-08-01T10:13:00Z',
      executable: true,
      disabledReason: null,
      outcomes: [],
      rollbackGuidance: [],
    } satisfies BrokerMigrationPlan

    expect(
      canApplyBrokerMigrationPlan(
        plan,
        {
          ok: true,
          providerId: 'remote-provider',
          validatedAt: '2026-08-01T10:04:00Z',
          staleAfter: '2026-08-01T10:14:00Z',
          deniedReason: null,
          warnings: [],
        },
        new Date('2026-08-01T10:05:00Z')
      )
    ).toBe(true)
    expect(
      canApplyBrokerMigrationPlan(
        plan,
        {
          ok: true,
          providerId: 'remote-provider',
          validatedAt: '2026-08-01T09:54:00Z',
          staleAfter: '2026-08-01T10:04:00Z',
          deniedReason: null,
          warnings: [],
        },
        new Date('2026-08-01T10:05:00Z')
      )
    ).toBe(false)
    expect(
      canApplyBrokerMigrationPlan(
        { ...plan, executable: false, disabledReason: 'Unsupported writes.' },
        {
          ok: true,
          providerId: 'remote-provider',
          validatedAt: '2026-08-01T10:04:00Z',
          staleAfter: '2026-08-01T10:14:00Z',
          deniedReason: null,
          warnings: [],
        },
        new Date('2026-08-01T10:05:00Z')
      )
    ).toBe(false)
  })
})
