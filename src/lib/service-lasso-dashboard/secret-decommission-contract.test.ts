import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

function response(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      serviceId: '@secretsbroker',
      apiVersion: 'secretsbroker.local/v1',
      requestId: 'core-generated-request',
      operationId: 'serviceadmin-decommission-fixed',
      ref: 'services/app/runtime/KEY',
      operation: 'decommission',
      mode: 'dry-run',
      outcome: 'dry_run_ready',
      applied: false,
      requiresConfirmation: true,
      auditStatus: 'audit_recorded',
      policyResult: 'allowed',
      expectedVersion: 'version-1',
      dependencyStatus: 'clear',
      dependencySnapshot: `sha256:${'b'.repeat(64)}`,
      dependencies: [],
      recoverable: true,
      plan: {
        ref: 'services/app/runtime/KEY',
        operationId: 'serviceadmin-decommission-fixed',
        expectedVersion: 'version-1',
        dependencyStatus: 'clear',
        dependencySnapshot: `sha256:${'b'.repeat(64)}`,
        expiresAt: '2026-08-14T07:00:00Z',
        signature: `hmac-sha256:${'c'.repeat(43)}`,
      },
      affectedRefs: ['services/app/runtime/KEY'],
      affectedServices: [],
      ...overrides,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

describe('managed secret decommission client', () => {
  it('uses core-derived dependency evidence and returns only metadata-bound plans', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const fetchMock = vi.fn().mockResolvedValue(response())
    vi.stubGlobal('fetch', fetchMock)

    const client = await import('./stub')
    const result = await client.previewSecretDecommission({
      ref: 'services/app/runtime/KEY',
      operationId: 'serviceadmin-decommission-fixed',
    })

    expect(result).toMatchObject({
      outcome: 'dry_run_ready',
      dependencyStatus: 'clear',
      dependencies: [],
      plan: { expectedVersion: 'version-1' },
    })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toEqual({
      ref: 'services/app/runtime/KEY',
      operationId: 'serviceadmin-decommission-fixed',
    })
    expect(body).not.toHaveProperty('dependencyStatus')
    expect(body).not.toHaveProperty('dependencies')
    expect(body).not.toHaveProperty('dependencySnapshot')
  })

  it('rejects tombstone responses carrying entry or payload material', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          mode: 'apply',
          outcome: 'applied',
          applied: true,
          requiresConfirmation: false,
          plan: undefined,
          tombstone: {
            state: 'decommissioned',
            version: 'version-1',
            decommissionOperationId: 'serviceadmin-decommission-fixed',
            decommissionedAt: '2026-08-14T06:59:00Z',
            entry: { value: 'must-not-cross-ui-boundary' },
          },
        })
      )
    )

    const client = await import('./stub')
    await expect(
      client.applySecretDecommission({
        ref: 'services/app/runtime/KEY',
        operationId: 'serviceadmin-decommission-fixed',
        reason: 'approved retirement',
        plan: {
          ref: 'services/app/runtime/KEY',
          operationId: 'serviceadmin-decommission-fixed',
          expectedVersion: 'version-1',
          dependencyStatus: 'clear',
          dependencySnapshot: `sha256:${'b'.repeat(64)}`,
          expiresAt: '2026-08-14T07:00:00Z',
          signature: `hmac-sha256:${'c'.repeat(43)}`,
        },
      })
    ).rejects.toThrow(/invalid tombstone metadata/i)
  })
})
