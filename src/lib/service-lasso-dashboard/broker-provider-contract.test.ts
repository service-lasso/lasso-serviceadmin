import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function runtimeClient() {
  vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
  vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
  return import('./stub')
}

function operation(
  maturity = 'validated',
  path = '/v1/providers/migration/apply'
) {
  return {
    operationId: 'post_v1_providers_migration_apply',
    method: 'POST',
    path,
    maturity,
    classification: 'mutation',
    authenticationRequired: true,
    policyRequired: true,
    auditRequired: true,
    scope: 'provider-remote',
    completionMode: 'synchronous',
    limitationCode: 'runtime_auth_policy_audit_revalidated',
    reasonCode: 'validated',
    nextAction: 'execute_guarded_operation',
  }
}

function provider(providerId = 'vault-target') {
  return {
    providerId,
    providerKind: providerId === 'local' ? 'local-encrypted-store' : 'vault',
    displayName: providerId,
    state: 'ready',
    outcome: 'ready',
    credentialHandle: 'configured-ref-or-env',
    address: 'https://vault.example.invalid',
    namespaces: ['services'],
    capabilities: ['read', 'migration'],
    operations: [operation()],
    auditStatus: 'audit_available',
  }
}

function migrationResponse(apply: boolean) {
  return {
    serviceId: '@secretsbroker',
    apiVersion: 'secretsbroker.local/v1',
    requestId: apply ? 'migration-apply-request' : 'migration-preview-request',
    operationId: 'serviceadmin-migration-fixed',
    operation: apply ? 'migration_apply' : 'migration_dry_run',
    outcome: apply ? 'applied' : 'dry_run_ready',
    applied: apply,
    requiresConfirmation: !apply,
    auditStatus: 'audit_recorded',
    sourceProviderId: 'local',
    targetProviderId: 'vault-target',
    results: [
      {
        ref: 'services/app/runtime/API_KEY',
        sourceProviderId: 'local',
        targetProviderId: 'vault-target',
        ownerServiceId: 'app',
        state: apply ? 'migrated' : 'planned',
        outcome: apply ? 'migrated' : 'dry_run_ready',
        risk: 'high',
        expectedAction: 'copy_value_inside_broker',
        policyResult: 'allowed',
        auditRequirement: 'required',
        recovery: 'retry_after_fix_or_restore_from_backup',
      },
    ],
    rollback: 'restore_from_encrypted_backup',
  }
}

function campaignResponse(
  mode: 'create' | 'revalidate' | 'apply',
  apply = false
) {
  return {
    serviceId: '@secretsbroker',
    apiVersion: 'secretsbroker.local/v1',
    requestId: `campaign-${mode}-request`,
    campaignId: 'campaign-fixed',
    planToken: 'plan-fixed',
    operationId: 'serviceadmin-bulk-fixed',
    operation: 'migrate_remap_provider',
    mode,
    outcome: apply ? 'applied' : 'dry_run_ready',
    applied: apply,
    requiresConfirmation: !apply,
    requiresAuditReason: !apply,
    requiresRevalidation: mode === 'create',
    auditStatus: 'audit_recorded',
    staleAfterSeconds: 300,
    nextAction: apply ? 'verify_target_metadata' : 'confirm_exact_campaign',
    results: [
      {
        ref: 'services/app/runtime/API_KEY',
        sourceId: 'local',
        providerKind: 'local-encrypted-store',
        ownerServiceId: 'app',
        operation: 'migrate_remap_provider',
        capabilityResult: 'supported',
        policyResult: 'allowed',
        auditRequirement: 'required',
        risk: 'high',
        expectedAction: 'copy_value_inside_broker',
        outcome: apply ? 'migrated' : 'dry_run_ready',
        idempotencyKey: 'campaign-item-key',
        operationItemId: 'campaign-item-fixed',
        recovery: 'retry_after_fix_or_restore_from_backup',
        targetProviderId: 'vault-target',
        providerAction: 'write_and_verify',
        applied: apply,
        retrySafe: true,
        verified: apply,
        attempts: apply ? 1 : 0,
      },
    ],
    summary: {
      selectedCount: 1,
      applicableCount: apply ? 0 : 1,
      deniedCount: 0,
      unsupportedCount: 0,
      authRequiredCount: 0,
      skippedCount: 0,
      appliedCount: apply ? 1 : 0,
      failedCount: 0,
      staleCount: 0,
      highRiskCount: 1,
    },
    affectedRefs: ['services/app/runtime/API_KEY'],
    affectedServices: ['app'],
    durable: true,
    maxConcurrency: 1,
    backpressurePolicy: 'stop_and_defer_remaining',
    createdAt: '2026-08-14T00:00:00.000Z',
    revalidatedAt: mode === 'create' ? undefined : '2026-08-14T00:00:01.000Z',
    updatedAt: '2026-08-14T00:00:01.000Z',
  }
}

describe('canonical Broker provider and migration client', () => {
  it('loads live operation maturity from the canonical core proxy', async () => {
    const local = provider('local')
    local.operations = [operation('validated', '/v1/kv/data/{path}')]
    const target = provider()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          serviceId: '@secretsbroker',
          apiVersion: 'secretsbroker.local/v1',
          contractVersion: '1.0.0',
          manifestVersion: '1.0.0',
          outcome: 'ready',
          currentProvider: local,
          providers: [local, target],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()

    const status = await client.fetchBrokerProviderStatus()

    expect(client.providerSupportsMigrationApply(status.providers[1]!)).toBe(
      true
    )
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://runtime.test/api/services/%40secretsbroker/providers/config/status'
    )
  })

  it('accepts the Broker local provider wildcard namespace without widening other identifiers', async () => {
    const local = {
      ...provider('local'),
      namespaces: ['*'],
      capabilities: ['read', 'write/update', 'rotate/reset'],
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          serviceId: '@secretsbroker',
          apiVersion: 'secretsbroker.local/v1',
          contractVersion: '1.1.0',
          manifestVersion: '1.0.0',
          outcome: 'ready',
          currentProvider: local,
          providers: [local],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()

    const status = await client.fetchBrokerProviderStatus()

    expect(status.currentProvider.namespaces).toEqual(['*'])
    expect(status.providers[0]?.capabilities).toEqual([
      'read',
      'write/update',
      'rotate/reset',
    ])
  })

  it('validates the canonical local provider wildcard through the Broker', async () => {
    const local = {
      ...provider('local'),
      namespaces: ['*'],
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          serviceId: '@secretsbroker',
          apiVersion: 'secretsbroker.local/v1',
          requestId: 'local-provider-validation',
          operation: 'validate',
          outcome: 'ready',
          applied: false,
          requiresConfirmation: false,
          auditStatus: 'audit_recorded',
          provider: local,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()

    await client.validateBrokerProviderConfiguration({
      providerId: 'local',
      providerKind: 'local-encrypted-store',
      displayName: 'Local encrypted store',
      credentialRef: 'local-master-key',
      namespaces: ['*'],
      reason: 'operator validation',
    })

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({ providerId: 'local', namespaces: ['*'] })
    )
  })

  it('validates configuration using a reference handle and never a credential value', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          serviceId: '@secretsbroker',
          apiVersion: 'secretsbroker.local/v1',
          requestId: 'provider-validation-request',
          operation: 'validate',
          outcome: 'ready',
          applied: false,
          requiresConfirmation: false,
          auditStatus: 'audit_recorded',
          provider: provider(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()

    await client.validateBrokerProviderConfiguration({
      providerId: 'vault-target',
      providerKind: 'vault',
      displayName: 'vault-target',
      address: 'https://vault.example.invalid',
      credentialRef: 'providers/vault/credential',
      namespaces: ['services'],
      reason: 'operator validation',
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(body.credentialRef).toBe('providers/vault/credential')
    expect(body).not.toHaveProperty('credentialValue')
    expect(JSON.stringify(body)).not.toContain('Bearer ')
  })

  it('separates dry-run from confirmed apply and rejects returned values', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(migrationResponse(false)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(migrationResponse(true)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...migrationResponse(false),
            value: 'must-not-cross-provider-contract',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()
    const request = {
      operationId: 'serviceadmin-migration-fixed',
      sourceProviderId: 'local',
      targetProviderId: 'vault-target',
      refs: ['services/app/runtime/API_KEY'],
      reason: 'approved migration',
    }

    await client.previewBrokerMigration(request)
    await client.applyBrokerMigration(request)

    const previewBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const applyBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(previewBody.confirm).toBe(false)
    expect(applyBody.confirm).toBe(true)
    expect(previewBody).not.toHaveProperty('value')
    expect(applyBody).not.toHaveProperty('value')
    await expect(client.previewBrokerMigration(request)).rejects.toThrow(
      /credential-bearing metadata/i
    )
  })

  it('binds bulk migration create, revalidate, and apply to one durable high-risk campaign', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(campaignResponse('create')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(campaignResponse('revalidate')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(campaignResponse('apply', true)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()
    const baseRequest = {
      operationId: 'serviceadmin-bulk-fixed',
      operation: 'migrate_remap_provider' as const,
      refs: ['services/app/runtime/API_KEY'],
      targetProviderId: 'vault-target',
      reason: 'approved bulk migration',
    }

    const created = await client.createBrokerBulkCampaign(baseRequest)
    const revalidated = await client.revalidateBrokerBulkCampaign({
      ...baseRequest,
      campaignId: created.campaignId,
      planToken: created.planToken,
    })
    const applied = await client.applyBrokerBulkCampaign({
      ...baseRequest,
      campaignId: revalidated.campaignId,
      planToken: revalidated.planToken,
      confirm: true,
      highRiskConfirm: revalidated.campaignId,
    })

    expect(created.requiresRevalidation).toBe(true)
    expect(revalidated.requiresRevalidation).toBe(false)
    expect(applied.results[0]).toMatchObject({
      outcome: 'migrated',
      applied: true,
      verified: true,
    })
    const bodies = fetchMock.mock.calls.map((call) =>
      JSON.parse(String(call[1]?.body))
    )
    expect(bodies.map((body) => body.confirm)).toEqual([false, false, true])
    expect(bodies[2]?.highRiskConfirm).toBe('campaign-fixed')
    expect(bodies.every((body) => !('value' in body))).toBe(true)
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'http://runtime.test/api/services/%40secretsbroker/secrets/campaigns/create',
      'http://runtime.test/api/services/%40secretsbroker/secrets/campaigns/revalidate',
      'http://runtime.test/api/services/%40secretsbroker/secrets/campaigns/apply',
    ])
  })

  it('rejects credential-bearing bulk campaign responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ...campaignResponse('create'),
          results: [
            {
              ...campaignResponse('create').results[0],
              secretValue: 'must-not-cross-bulk-contract',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()

    await expect(
      client.createBrokerBulkCampaign({
        operationId: 'serviceadmin-bulk-fixed',
        operation: 'migrate_remap_provider',
        refs: ['services/app/runtime/API_KEY'],
        targetProviderId: 'vault-target',
        reason: 'approved bulk migration',
      })
    ).rejects.toThrow(/credential-bearing metadata/i)
  })
})
