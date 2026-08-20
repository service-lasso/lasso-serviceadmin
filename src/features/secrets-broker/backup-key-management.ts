export type SecretsBrokerBackupState = 'ready' | 'missing' | 'stale' | 'blocked'

export type SecretsBrokerRotationState =
  | 'current'
  | 'rotation-due'
  | 'recovery-risk'
  | 'blocked'

export type SecretsBrokerBackupKeyAction = {
  id:
    | 'create-backup'
    | 'verify-restore-readiness'
    | 'restore-from-backup'
    | 'rotate-master-key'
  label: string
  state: 'available' | 'disabled' | 'danger'
  confirmationCopy?: string
  disabledReason?: string
}

export type SecretsBrokerBackupKeyStatus = {
  serviceId: string
  backup: {
    state: SecretsBrokerBackupState
    lastBackupAt?: string
    artifact: string
    location: string
    restoreReadiness: string
    restoreLastVerifiedAt?: string
    warning?: string
  }
  key: {
    state: SecretsBrokerRotationState
    keyVersion: string
    keyId: string
    rotationStatus: string
    recoveryMaterial: string
    warning?: string
  }
  actions: SecretsBrokerBackupKeyAction[]
  audit: Array<{
    id: string
    operation: string
    outcome: string
    at: string
    metadata: string
  }>
}

export const secretsBrokerBackupKeyStatus: SecretsBrokerBackupKeyStatus = {
  serviceId: '@secretsbroker',
  backup: {
    state: 'stale',
    lastBackupAt: '2026-05-08T08:56:00Z',
    artifact: 'backup-20260508-085600.sbk.json',
    location: 'operator-controlled encrypted artifact store',
    restoreReadiness: 'key id matched; decryptability verified in dry-run',
    restoreLastVerifiedAt: '2026-05-08T09:05:00Z',
    warning:
      'Backup is older than the latest key rotation. Create a fresh encrypted artifact before planned maintenance.',
  },
  key: {
    state: 'recovery-risk',
    keyVersion: 'v4',
    keyId: 'mkid_7f3a…9c21',
    rotationStatus: 'rotation available after fresh backup',
    recoveryMaterial: 'recovery material registered but not recently verified',
    warning:
      'Verify portable master-key recovery material before restore or rotation. The UI never displays key material.',
  },
  actions: [
    {
      id: 'create-backup',
      label: 'Create encrypted backup',
      state: 'available',
    },
    {
      id: 'verify-restore-readiness',
      label: 'Verify restore readiness',
      state: 'available',
    },
    {
      id: 'restore-from-backup',
      label: 'Restore from backup',
      state: 'danger',
      confirmationCopy:
        'Restore @secretsbroker from encrypted backup metadata only. Confirm artifact path, key id match, and maintenance window; raw secret values and key material stay hidden.',
    },
    {
      id: 'rotate-master-key',
      label: 'Rotate master key',
      state: 'danger',
      confirmationCopy:
        'Rotate the portable master key after a fresh encrypted backup. Existing services may need restart; never paste key material into Service Admin.',
    },
  ],
  audit: [
    {
      id: 'evt-backup-001',
      operation: 'backup_create',
      outcome: 'ready',
      at: '2026-05-08T08:56:00Z',
      metadata: 'encrypted artifact created · 12 refs · key version v4',
    },
    {
      id: 'evt-backup-002',
      operation: 'backup_restore_verify',
      outcome: 'ready',
      at: '2026-05-08T09:05:00Z',
      metadata: 'dry-run decryptability verified · no store overwrite',
    },
    {
      id: 'evt-backup-003',
      operation: 'key_rotate_preview',
      outcome: 'recovery_risk',
      at: '2026-05-08T09:12:00Z',
      metadata: 'fresh backup recommended before rotation',
    },
  ],
}

const secretLikePattern =
  /(secret-value|plaintext|correct-horse-battery-staple|portable-master-key|raw key|api[_-]?key\s*=|sk-[a-z0-9]|ghp_[a-z0-9])/i

export function backupKeyStatusHasSecretMaterial(
  status: SecretsBrokerBackupKeyStatus
): boolean {
  return secretLikePattern.test(JSON.stringify(status))
}
