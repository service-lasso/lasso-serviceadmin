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
              activeVersionId: 'version-2',
              previousVersionId: 'version-1',
              stagedVersionId: 'version-2',
              completedOperations: ['app:restart:'],
              rollbackCompletedOperations: [],
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
              value: 'must-not-cross-the-admin-boundary',
              completedOperations: [],
              rollbackCompletedOperations: [],
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
})
