import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('managed secret policy preview client', () => {
  it('requests metadata-only policy status and reports apply as unsupported', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          serviceId: '@secretsbroker',
          apiVersion: 'secretsbroker.local/v1',
          requestId: 'policy-preview-1',
          ref: 'services/app/runtime/API_KEY',
          operation: 'policy',
          mode: 'preview',
          outcome: 'unsupported',
          applied: false,
          requiresConfirmation: false,
          auditStatus: 'audit_recorded',
          nextAction: 'wait_for_policy_binding_persistence',
          unsupportedCapability: 'policy_binding_persistence',
          record: {
            ref: 'services/app/runtime/API_KEY',
            policy: 'local-writeback-policy',
          },
          affectedRefs: ['services/app/runtime/API_KEY'],
          affectedServices: ['app'],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const { previewManagedSecretPolicy } = await import('./stub')

    const result = await previewManagedSecretPolicy({
      ref: 'services/app/runtime/API_KEY',
    })

    expect(result).toMatchObject({
      outcome: 'unsupported',
      applied: false,
      unsupportedCapability: 'policy_binding_persistence',
      currentPolicy: 'local-writeback-policy',
    })
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(String(init.body))).toEqual({
      ref: 'services/app/runtime/API_KEY',
    })
  })

  it('rejects falsely applied or secret-bearing policy responses', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const response = {
      serviceId: '@secretsbroker',
      apiVersion: 'secretsbroker.local/v1',
      requestId: 'policy-preview-2',
      ref: 'services/app/runtime/API_KEY',
      operation: 'policy',
      mode: 'preview',
      outcome: 'applied',
      applied: true,
      requiresConfirmation: false,
      auditStatus: 'audit_recorded',
      nextAction: 'none',
      unsupportedCapability: 'policy_binding_persistence',
      value: 'must-not-cross-policy-contract',
      record: { ref: 'services/app/runtime/API_KEY', policy: 'unsafe' },
      affectedRefs: ['services/app/runtime/API_KEY'],
      affectedServices: ['app'],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    const { previewManagedSecretPolicy } = await import('./stub')

    await expect(
      previewManagedSecretPolicy({ ref: 'services/app/runtime/API_KEY' })
    ).rejects.toThrow('invalid policy preview')
  })
})
