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

const backup = {
  schema: 'service-lasso.secretsbroker.backup-metadata.v1',
  backupId: 'backup-20260814-safe',
  createdAt: '2026-08-14T00:00:00Z',
  storeKeyId: 'mk-safe',
  storeKeyVersion: 'v1',
  secretCount: 2,
  sizeBytes: 4096,
  artifactHash: 'sha256-safe-backup-hash',
  verification: 'verified',
}

function response(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function backupResult(applied = false) {
  return {
    serviceId: '@secretsbroker',
    apiVersion: 'secretsbroker.local/v1',
    outcome: 'ready',
    applied,
    backup,
    backups: [backup],
    auditStatus: 'audit_recorded',
    nextAction: 'operate_normally',
  }
}

function restoreResult(applied: boolean) {
  return {
    serviceId: '@secretsbroker',
    apiVersion: 'secretsbroker.local/v1',
    outcome: 'ready',
    applied,
    backup,
    planToken: applied ? undefined : 'restore-plan-safe',
    planExpiresAt: applied ? undefined : '2026-08-14T00:05:00Z',
    expectedKeyId: 'mk-safe',
    expectedStoreHash: 'sha256-safe-store-hash',
    requiresConfirmation: !applied,
    auditStatus: 'audit_recorded',
    nextAction: applied ? 'restart_and_verify' : 'confirm_exact_restore_plan',
  }
}

describe('canonical Broker lifecycle client', () => {
  it('loads live metadata without accepting key material, paths, or shares', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        serviceId: '@secretsbroker',
        apiVersion: 'secretsbroker.local/v1',
        outcome: 'ready',
        key: {
          available: true,
          keyId: 'mk-safe',
          keyVersion: 'v1',
          secretCount: 2,
        },
        wrapper: {
          available: true,
          supported: true,
          wrapperKind: 'dpapi-user-scope',
          os: 'windows',
          keyId: 'mk-safe',
          keyVersion: 'v1',
          state: 'ready',
          nextAction: 'operate_normally',
        },
        recovery: {
          outcome: 'active',
          policy: {
            policyId: 'policy-1',
            keyId: 'mk-safe',
            keyVersion: 'v1',
            threshold: 2,
            shareCount: 3,
            shareFingerprints: ['fp-1', 'fp-2', 'fp-3'],
            createdAt: '2026-08-14T00:00:00Z',
            status: 'active',
            nextAction: 'monitor_recovery_policy',
          },
          nextAction: 'monitor_recovery_policy',
        },
        backups: [backup],
        auditStatus: 'audit_recorded',
        nextAction: 'operate_normally',
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()

    const status = await client.fetchBrokerLifecycleStatus()

    expect(status.key.keyId).toBe('mk-safe')
    expect(status.recovery.policy?.recipientFingerprints).toEqual([])
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://runtime.test/api/services/%40secretsbroker/lifecycle/status'
    )
  })

  it('creates and verifies backups using metadata-only requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(backupResult(true)))
      .mockResolvedValueOnce(response(backupResult(false)))
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()

    await client.createBrokerLifecycleBackup({
      operationId: 'serviceadmin-backup-create',
      reason: 'release backup',
    })
    await client.verifyBrokerLifecycleBackup({
      operationId: 'serviceadmin-backup-verify',
      reason: 'release verification',
      backupId: backup.backupId,
    })

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'http://runtime.test/api/services/%40secretsbroker/lifecycle/backups/create',
      'http://runtime.test/api/services/%40secretsbroker/lifecycle/backups/verify',
    ])
    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse(String(call[1]?.body))
      expect(body).not.toHaveProperty('path')
      expect(body).not.toHaveProperty('masterKey')
      expect(body).not.toHaveProperty('recoveryShare')
      expect(body).not.toHaveProperty('passphrase')
    }
  })

  it('binds restore apply to the exact dry-run plan and explicit confirmation', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(restoreResult(false)))
      .mockResolvedValueOnce(response(restoreResult(true)))
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()
    const base = {
      operationId: 'serviceadmin-restore-fixed',
      reason: 'approved recovery',
      backupId: backup.backupId,
    }

    const plan = await client.previewBrokerLifecycleRestore(base)
    await client.applyBrokerLifecycleRestore({
      ...base,
      planToken: plan.planToken,
      expectedKeyId: plan.expectedKeyId,
      expectedStoreHash: plan.expectedStoreHash,
      confirm: true,
    })

    const previewBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const applyBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
    expect(previewBody.confirm).toBe(false)
    expect(applyBody).toMatchObject({
      confirm: true,
      operationId: base.operationId,
      backupId: backup.backupId,
      planToken: 'restore-plan-safe',
      expectedKeyId: 'mk-safe',
      expectedStoreHash: 'sha256-safe-store-hash',
    })
  })

  it('asks the Broker to generate a new key and never accepts key bytes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        serviceId: '@secretsbroker',
        apiVersion: 'secretsbroker.local/v1',
        outcome: 'ready',
        applied: true,
        rotatedAt: '2026-08-14T00:02:00Z',
        oldKeyId: 'mk-safe',
        newKeyId: 'mk-new-safe',
        keyVersion: 'v2',
        secretCount: 2,
        requiresConfirmation: false,
        auditStatus: 'audit_recorded',
        nextAction: 'create_and_verify_backup',
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()

    await client.rotateBrokerLifecycleKey({
      operationId: 'serviceadmin-rotate-fixed',
      reason: 'scheduled rotation',
      expectedKeyId: 'mk-safe',
      confirm: true,
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://runtime.test/api/services/%40secretsbroker/lifecycle/key/rotate'
    )
    expect(body).toEqual({
      operationId: 'serviceadmin-rotate-fixed',
      reason: 'scheduled rotation',
      expectedKeyId: 'mk-safe',
      confirm: true,
    })
  })

  it.each([
    ['masterKey', 'raw-key'],
    ['recoveryShare', 'share'],
    ['payload', 'ciphertext'],
    ['ciphertext', 'blob'],
    ['path', 'C:/private/backup'],
    ['secretValue', 'value'],
  ])(
    'rejects nested %s in Broker lifecycle responses',
    async (field, value) => {
      const fetchMock = vi.fn().mockResolvedValue(
        response({
          ...backupResult(false),
          evidence: { nested: { [field]: value } },
        })
      )
      vi.stubGlobal('fetch', fetchMock)
      const client = await runtimeClient()

      await expect(client.fetchBrokerLifecycleBackups()).rejects.toThrow(
        /lifecycle secret material/i
      )
    }
  )
})
