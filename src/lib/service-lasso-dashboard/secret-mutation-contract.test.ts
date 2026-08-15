import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('managed secret mutation client', () => {
  it('sends replacement material only on confirmed apply and rejects a value-bearing response', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            serviceId: '@secretsbroker',
            apiVersion: 'secretsbroker.local/v1',
            requestId: 'core-generated-preview',
            ref: 'services/app/runtime/KEY',
            operation: 'edit',
            mode: 'dry-run',
            outcome: 'dry_run_ready',
            applied: false,
            requiresConfirmation: true,
            auditStatus: 'audit_ready',
            affectedRefs: ['services/app/runtime/KEY'],
            affectedServices: ['app'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            serviceId: '@secretsbroker',
            apiVersion: 'secretsbroker.local/v1',
            requestId: 'core-generated-apply',
            ref: 'services/app/runtime/KEY',
            operation: 'edit',
            mode: 'apply',
            outcome: 'applied',
            applied: true,
            requiresConfirmation: false,
            auditStatus: 'audit_recorded',
            affectedRefs: ['services/app/runtime/KEY'],
            affectedServices: ['app'],
            value: 'must-not-cross-response-boundary',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    vi.stubGlobal('fetch', fetchMock)

    vi.resetModules()
    const client = await import('./stub')
    const request = {
      operation: 'edit' as const,
      ref: 'services/app/runtime/KEY',
      reason: 'approved replacement',
      value: 'replacement-only-in-apply-request',
    }
    await expect(
      client.previewManagedSecretMutation(request)
    ).resolves.toMatchObject({
      outcome: 'dry_run_ready',
    })
    const previewBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(previewBody).not.toHaveProperty('value')

    await expect(client.applyManagedSecretMutation(request)).rejects.toThrow(
      /invalid mutation response/i
    )
    const applyBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(applyBody).toMatchObject({
      confirm: true,
      value: 'replacement-only-in-apply-request',
    })
  })
})
