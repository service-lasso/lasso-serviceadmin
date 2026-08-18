import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

function version(versionId: string, state: string) {
  return {
    versionId,
    sourceId: 'local-test',
    state,
    fingerprint: `sha256:${'e'.repeat(64)}`,
    createdAt: '2026-08-14T06:00:00Z',
    updatedAt: '2026-08-14T06:00:00Z',
    auditStatus: 'audit_ready',
    policyResult: 'allowed',
  }
}

describe('managed secret versioned rotation client', () => {
  it('omits replacement material from preview and sends it only to confirmed stage', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            serviceId: '@secretsbroker',
            apiVersion: 'secretsbroker.local/v1',
            requestId: 'preview-request',
            operationId: 'serviceadmin-rotate-fixed',
            operation: 'credential_rotation',
            mode: 'dry-run',
            outcome: 'dry_run_ready',
            applied: false,
            requiresConfirmation: true,
            auditStatus: 'audit_ready',
            staleAfterSeconds: 300,
            results: [
              {
                ref: 'services/app/runtime/KEY',
                sourceId: 'local-test',
                providerKind: 'local-encrypted-store',
                ownerServiceId: 'app',
                capability: 'rotate/reset',
                capabilityResult: 'supported',
                policyResult: 'allowed',
                auditRequirement: 'required',
                risk: 'high',
                expectedAction: 'stage_then_activate',
                outcome: 'dry_run_ready',
                operationId: 'serviceadmin-rotate-fixed',
                idempotencyKey: `sha256:${'d'.repeat(64)}`,
              },
            ],
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
            requestId: 'stage-request',
            ref: 'services/app/runtime/KEY',
            operation: 'rotation_stage',
            mode: 'stage',
            outcome: 'staged',
            applied: false,
            requiresConfirmation: true,
            auditStatus: 'audit_recorded',
            policyResult: 'allowed',
            activeVersionId: 'version-1',
            currentVersion: version('version-1', 'active'),
            stagedVersion: version('rv-serviceadmin-rotate-fixed', 'staged'),
            versions: [version('version-1', 'active')],
            affectedRefs: ['services/app/runtime/KEY'],
            affectedServices: ['app'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    vi.stubGlobal('fetch', fetchMock)

    const client = await import('./stub')
    await client.previewSecretRotation({
      ref: 'services/app/runtime/KEY',
      operationId: 'serviceadmin-rotate-fixed',
      reason: 'approved rotation',
    })
    const previewBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(previewBody).not.toHaveProperty('value')

    await client.runSecretRotationVersionAction({
      action: 'stage',
      ref: 'services/app/runtime/KEY',
      operationId: 'serviceadmin-rotate-fixed',
      expectedCurrentVersion: 'version-1',
      reason: 'approved rotation',
      value: 'stage-only-secret-value',
    })
    const stageBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(stageBody).toMatchObject({
      confirm: true,
      value: 'stage-only-secret-value',
    })
  })

  it('rejects value-bearing rotation responses', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            serviceId: '@secretsbroker',
            apiVersion: 'secretsbroker.local/v1',
            requestId: 'status-request',
            ref: 'services/app/runtime/KEY',
            operation: 'rotation_status',
            mode: 'status',
            outcome: 'ready',
            applied: false,
            requiresConfirmation: false,
            auditStatus: 'audit_available',
            policyResult: 'allowed',
            currentVersion: version('version-1', 'active'),
            versions: [version('version-1', 'active')],
            affectedRefs: ['services/app/runtime/KEY'],
            affectedServices: [],
            value: 'must-not-cross-ui-boundary',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )

    const client = await import('./stub')
    await expect(
      client.runSecretRotationVersionAction({
        action: 'status',
        ref: 'services/app/runtime/KEY',
      })
    ).rejects.toThrow(/invalid rotation response/i)
  })
})
