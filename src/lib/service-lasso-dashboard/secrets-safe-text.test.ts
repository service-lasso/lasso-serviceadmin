import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

const managementPayload = {
  serviceId: '@secretsbroker',
  apiVersion: 'secretsbroker.local/v1',
  valueSearch: false,
  outcome: 'ready',
  results: [
    {
      ref: 'services/app/runtime/API_KEY',
      name: 'API_KEY',
      sourceId: 'generated:app',
      providerKind: 'local-encrypted-store',
      ownerServiceId: 'app',
      state: 'ready',
      outcome: 'ready',
      capabilities: ['metadata', 'reveal', 'edit'],
      policy: 'local-writeback-policy',
      auditStatus: 'audit_available',
    },
  ],
}

describe('Secrets Broker safe text boundary', () => {
  it('preserves safe identifiers while withholding credential-like display text', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...managementPayload,
            results: [
              {
                ...managementPayload.results[0],
                policy: 'password=hunter2-unsafe-sentinel',
                auditStatus: 'Bearer unsafe.jwt.material',
                unexpectedSecret: 'must-not-survive-normalization',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )

    const client = await import('./stub')
    const state = await client.fetchSecretsManagementState('API_KEY')

    expect(state.results[0]).toMatchObject({
      ref: 'services/app/runtime/API_KEY',
      sourceId: 'generated:app',
      policy: '[unsafe metadata withheld]',
      auditStatus: '[unsafe metadata withheld]',
    })
    expect(JSON.stringify(state)).not.toContain('hunter2-unsafe-sentinel')
    expect(JSON.stringify(state)).not.toContain(
      'must-not-survive-normalization'
    )
  })

  it('blocks unsafe search locally before any broker request', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const client = await import('./stub')
    await expect(
      client.fetchSecretsManagementState(
        'authorization=Bearer unsafe-search-sentinel'
      )
    ).rejects.toThrow(/unsafe input/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps the reveal value only in its dedicated boundary and sanitizes metadata', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            serviceId: '@secretsbroker',
            apiVersion: 'secretsbroker.local/v1',
            requestId: 'request-123',
            ref: 'services/app/runtime/API_KEY',
            operation: 'reveal',
            outcome: 'ready',
            value: 'dedicated-reveal-only-sentinel',
            metadata: {
              sourceId: 'generated:app',
              status: 'token=must-not-render',
            },
            ttlSeconds: 60,
            auditStatus: 'audit_recorded',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )

    const client = await import('./stub')
    const result = await client.revealManagedSecret(
      {
        ref: 'services/app/runtime/API_KEY',
        reason: 'approved troubleshooting',
        confirm: true,
      },
      { actorId: 'local-root', actorKind: 'local-root' }
    )

    expect(result.value).toBe('dedicated-reveal-only-sentinel')
    expect(result.metadata).toEqual({
      sourceId: 'generated:app',
      status: '[unsafe metadata withheld]',
    })
    expect(JSON.stringify(result.metadata)).not.toContain('must-not-render')
  })
})
