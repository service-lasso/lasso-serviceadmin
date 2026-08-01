import { describe, expect, it } from 'vitest'
import { applyRemoteServiceMeta, fetchDashboardService } from './stub'
import type { ServiceSecretsLifecycleState } from './types'

const remoteLifecycle: ServiceSecretsLifecycleState = {
  serviceId: 'secrets-broker',
  updatedAt: '2026-08-01T00:00:00.000Z',
  masterKey: {
    state: 'rotation_due',
    source: 'secret_file',
    fingerprint: 'sha256:7e5a...4b10',
    version: 'mk-2026-08',
    lastRotatedAt: '2026-05-01T00:00:00.000Z',
    nextRotationDueAt: '2026-08-01T00:00:00.000Z',
  },
  wrapper: {
    state: 'ready',
    algorithm: 'xchacha20-poly1305',
    version: 'v2',
  },
  backup: {
    state: 'ready',
    destinationPolicy: 'operator-approved encrypted archive',
    latestBackupId: 'backup-20260801-001',
    lastBackupAt: '2026-08-01T00:10:00.000Z',
    lastVerifiedAt: '2026-08-01T00:12:00.000Z',
    verificationStatus: 'verified',
  },
  restore: {
    state: 'dry_run_required',
    dryRunRequired: true,
    lastDryRunAt: null,
    lastRestoreAt: null,
  },
  recoveryPolicy: {
    state: 'ready',
    shareCount: 5,
    threshold: 3,
    materialExported: false,
    lastTestedAt: '2026-07-01T00:00:00.000Z',
  },
  warnings: ['Restore requires a passing dry run before apply.'],
  actions: [
    {
      id: 'rotate_master_key',
      label: 'Rotate master key',
      enabled: false,
      reason: 'Waiting for live broker key rotation endpoint wiring.',
      requiresConfirmation: true,
      permissionKey: 'broker.keys.rotate',
    },
  ],
}

describe('secrets broker lifecycle metadata', () => {
  it('accepts safe remote lifecycle metadata without key material', async () => {
    applyRemoteServiceMeta([
      {
        id: 'secrets-broker',
        secretsLifecycle: remoteLifecycle,
      },
    ])

    const service = await fetchDashboardService('secrets-broker')
    const lifecycle = service?.secretsLifecycle

    expect(lifecycle?.masterKey.fingerprint).toBe('sha256:7e5a...4b10')
    expect(lifecycle?.backup.latestBackupId).toBe('backup-20260801-001')
    expect(lifecycle?.recoveryPolicy.materialExported).toBe(false)
    expect(JSON.stringify(lifecycle)).not.toMatch(
      /passphrase|decrypted secret|recovery material/i
    )
  })
})
