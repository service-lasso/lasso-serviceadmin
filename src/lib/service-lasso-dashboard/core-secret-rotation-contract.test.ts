import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const ref = 'services/app/runtime/secretsbroker.API_KEY'
const fingerprint = `sha256:${'a'.repeat(64)}`

function plan() {
  return {
    ref,
    planFingerprint: fingerprint,
    status: 'ready',
    confirmationRequired: true,
    valuePolicy: 'metadata_only',
    ownerAction: null,
    services: [
      {
        serviceId: 'app',
        role: 'direct',
        action: 'restart',
        reason: 'Restart after activation.',
        required: true,
        sources: ['broker.import', 'env'],
        locations: ['broker.imports[0].ref', 'env.API_KEY'],
        dependentsOf: [],
        blockers: [],
      },
    ],
    execution: {
      stopOrder: ['app'],
      startOrder: ['app'],
      operations: [
        {
          serviceId: 'app',
          action: 'restart',
          reason: 'Restart after activation.',
        },
      ],
    },
    summary: {
      directConsumers: 1,
      dependents: 0,
      restart: 1,
      reload: 0,
      action: 0,
      manual: 0,
      none: 0,
      blockers: 0,
      ownerAction: 0,
    },
    blockers: [],
  }
}

describe('Core secret rotation orchestration client', () => {
  it('fetches the metadata-only consumer plan and submits the value only to confirmed execution', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(plan()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            operation: {
              schema: 'service-lasso.secret-rotation-operation.v1',
              operationId: 'serviceadmin-rotate-fixed',
              ref,
              planFingerprint: fingerprint,
              phase: 'committed',
              outcome: 'committed',
              createdAt: '2026-08-14T09:59:00Z',
              activeVersionId: 'version-2',
              previousVersionId: 'version-1',
              stagedVersionId: 'version-2',
              initialRunningServiceIds: ['app'],
              stoppedServiceIds: ['app'],
              completedOperations: ['app:restart:'],
              rollbackCompletedOperations: [],
              ownerActionCompleted: false,
              ownerRollbackCompleted: false,
              failureCode: null,
              updatedAt: '2026-08-14T10:00:00Z',
              plan: plan(),
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    vi.stubGlobal('fetch', fetchMock)
    const client = await import('./stub')
    const impact = await client.fetchCoreSecretRotationImpactPlan(ref)
    expect(impact.services[0]).toMatchObject({
      serviceId: 'app',
      action: 'restart',
    })
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/api/secrets/rotation-plan?ref='
    )
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: undefined,
      body: undefined,
    })

    const replacement = 'value-only-for-confirmed-core-transaction'
    const operation = await client.executeCoreSecretRotation({
      operationId: 'serviceadmin-rotate-fixed',
      ref,
      planFingerprint: fingerprint,
      reason: 'approved linked service rotation',
      confirm: true,
      value: replacement,
    })
    expect(operation.outcome).toBe('committed')
    const body = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(body).toMatchObject({
      operationId: 'serviceadmin-rotate-fixed',
      planFingerprint: fingerprint,
      confirm: true,
      value: replacement,
    })
    expect(JSON.stringify(operation)).not.toContain(replacement)
  })

  it('rejects a value-bearing operation response at the UI boundary', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            operation: {
              schema: 'service-lasso.secret-rotation-operation.v1',
              operationId: 'serviceadmin-rotate-fixed',
              ref,
              planFingerprint: fingerprint,
              phase: 'committed',
              outcome: 'committed',
              createdAt: '2026-08-14T09:59:00Z',
              value: 'must-not-cross-the-admin-boundary',
              activeVersionId: 'version-2',
              previousVersionId: 'version-1',
              stagedVersionId: 'version-2',
              initialRunningServiceIds: ['app'],
              stoppedServiceIds: ['app'],
              completedOperations: [],
              rollbackCompletedOperations: [],
              ownerActionCompleted: false,
              ownerRollbackCompleted: false,
              failureCode: null,
              updatedAt: '2026-08-14T10:00:00Z',
              plan: plan(),
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    )
    const client = await import('./stub')
    await expect(
      client.executeCoreSecretRotation({
        operationId: 'serviceadmin-rotate-fixed',
        ref,
        planFingerprint: fingerprint,
        reason: 'approved linked service rotation',
        confirm: true,
        value: 'candidate',
      })
    ).rejects.toThrow(/secret material/i)
  })

  it('rehydrates a durable rolled-back operation with version and rollback metadata', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          operation: {
            schema: 'service-lasso.secret-rotation-operation.v1',
            operationId: 'serviceadmin-rotate-rehydrate',
            ref,
            planFingerprint: fingerprint,
            phase: 'rolled_back',
            outcome: 'rolled_back',
            createdAt: '2026-08-14T09:59:00Z',
            activeVersionId: 'version-1',
            previousVersionId: 'version-1',
            stagedVersionId: 'version-2',
            initialRunningServiceIds: ['app'],
            stoppedServiceIds: ['app'],
            completedOperations: [],
            rollbackCompletedOperations: ['app:restart:'],
            ownerActionCompleted: false,
            ownerRollbackCompleted: false,
            failureCode: 'rotation_consumer_not_ready',
            updatedAt: '2026-08-14T10:00:00Z',
            plan: plan(),
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = await import('./stub')
    const operation = await client.fetchCoreSecretRotationExecutionState(
      'serviceadmin-rotate-rehydrate'
    )

    expect(operation).toMatchObject({
      phase: 'rolled_back',
      outcome: 'rolled_back',
      activeVersionId: 'version-1',
      previousVersionId: 'version-1',
      stagedVersionId: 'version-2',
      rollbackCompletedOperations: ['app:restart:'],
      failureCode: 'rotation_consumer_not_ready',
    })
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/api/secrets/rotation/operations/serviceadmin-rotate-rehydrate'
    )
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: undefined,
      body: undefined,
    })
  })

  it('retains a typed blocked operation returned with HTTP 503', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            operation: {
              schema: 'service-lasso.secret-rotation-operation.v1',
              operationId: 'serviceadmin-rotate-blocked',
              ref,
              planFingerprint: fingerprint,
              phase: 'blocked',
              outcome: 'blocked',
              createdAt: '2026-08-14T09:59:00Z',
              activeVersionId: 'version-2',
              previousVersionId: 'version-1',
              stagedVersionId: 'version-2',
              initialRunningServiceIds: ['app'],
              stoppedServiceIds: ['app'],
              completedOperations: [],
              rollbackCompletedOperations: [],
              ownerActionCompleted: false,
              ownerRollbackCompleted: false,
              failureCode: 'rotation_rollback_blocked',
              updatedAt: '2026-08-14T10:00:00Z',
              plan: plan(),
            },
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    )
    const client = await import('./stub')
    const operation = await client.executeCoreSecretRotation({
      operationId: 'serviceadmin-rotate-blocked',
      ref,
      planFingerprint: fingerprint,
      reason: 'approved linked service rotation',
      confirm: true,
      value: 'candidate',
    })

    expect(operation).toMatchObject({
      outcome: 'blocked',
      phase: 'blocked',
      failureCode: 'rotation_rollback_blocked',
    })
  })

  it('keeps ordinary 503 failures typed without exposing the response message', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const sensitiveMessage = 'audit failed at C:\\private\\rotation-secret.txt'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'audit_unavailable',
            message: sensitiveMessage,
            statusCode: 503,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    )
    const client = await import('./stub')

    let failure: unknown
    try {
      await client.executeCoreSecretRotation({
        operationId: 'serviceadmin-rotate-audit-failure',
        ref,
        planFingerprint: fingerprint,
        reason: 'approved linked service rotation',
        confirm: true,
        value: 'candidate',
      })
    } catch (error) {
      failure = error
    }
    expect(failure).toMatchObject({
      details: {
        status: 503,
        errorCode: 'audit_unavailable',
      },
    })
    expect(String(failure)).not.toContain(sensitiveMessage)
  })
})
