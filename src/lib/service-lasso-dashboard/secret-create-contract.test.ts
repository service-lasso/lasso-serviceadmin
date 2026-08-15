import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

function response(mode: 'dry-run' | 'apply', includeValue = false) {
  const ref = 'services/app/runtime/CREATED_TOKEN'
  const operationId = 'serviceadmin-create-fixed'
  return new Response(
    JSON.stringify({
      serviceId: '@secretsbroker',
      apiVersion: 'secretsbroker.local/v1',
      requestId: `create-${mode}`,
      operationId,
      ref,
      operation: 'create',
      mode,
      generationMode: 'operator_supplied',
      outcome: mode === 'apply' ? 'applied' : 'dry_run_ready',
      applied: mode === 'apply',
      requiresConfirmation: mode !== 'apply',
      auditStatus: 'audit_recorded',
      policyResult: 'allowed',
      plan:
        mode === 'dry-run'
          ? {
              ref,
              operationId,
              generationMode: 'operator_supplied',
              expectedState: 'missing',
              expiresAt: '2026-08-14T12:05:00.000Z',
              signature: 'hmac-sha256:signed-plan-fixture',
            }
          : undefined,
      affectedRefs: [ref],
      affectedServices: ['app'],
      ...(includeValue ? { value: 'must-not-cross-response-boundary' } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

describe('managed secret create client', () => {
  it('uses a signed no-value preview and sends operator material only on confirmed apply', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response('dry-run'))
      .mockResolvedValueOnce(response('apply'))
    vi.stubGlobal('fetch', fetchMock)

    const client = await import('./stub')
    const base = {
      ref: 'services/app/runtime/CREATED_TOKEN',
      operationId: 'serviceadmin-create-fixed',
      generationMode: 'operator_supplied' as const,
      reason: 'approved initial credential',
    }
    const preview = await client.previewManagedSecretCreate(base)
    expect(preview).toMatchObject({
      outcome: 'dry_run_ready',
      applied: false,
      policyResult: 'allowed',
    })
    expect(preview.plan?.signature).toMatch(/^hmac-sha256:/)
    const previewBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(previewBody).not.toHaveProperty('value')
    expect(previewBody).not.toHaveProperty('confirm')

    await expect(
      client.applyManagedSecretCreate({
        ...base,
        value: 'operator-only-apply-value',
        plan: preview.plan,
      })
    ).resolves.toMatchObject({ outcome: 'applied', applied: true })
    const applyBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(applyBody).toMatchObject({
      confirm: true,
      value: 'operator-only-apply-value',
      plan: preview.plan,
    })
  })

  it('never sends a browser value for broker-generated create and rejects secret-bearing responses', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const fetchMock = vi.fn().mockResolvedValue(response('apply', true))
    vi.stubGlobal('fetch', fetchMock)

    const client = await import('./stub')
    await expect(
      client.applyManagedSecretCreate({
        ref: 'services/app/runtime/CREATED_TOKEN',
        operationId: 'serviceadmin-create-fixed',
        generationMode: 'broker_generated',
        reason: 'approved generated credential',
        plan: {
          ref: 'services/app/runtime/CREATED_TOKEN',
          operationId: 'serviceadmin-create-fixed',
          generationMode: 'broker_generated',
          expectedState: 'missing',
          expiresAt: '2026-08-14T12:05:00.000Z',
          signature: 'hmac-sha256:signed-plan-fixture',
        },
      })
    ).rejects.toThrow(/invalid create response/i)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('value')
  })
})
