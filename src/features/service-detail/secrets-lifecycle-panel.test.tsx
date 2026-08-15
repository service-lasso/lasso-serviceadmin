import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SecretsBrokerLifecyclePanel } from './secrets-lifecycle-panel'

const mutations = vi.hoisted(() => ({
  create: vi.fn(),
  verify: vi.fn(),
  preview: vi.fn(),
  restore: vi.fn(),
  rotate: vi.fn(),
}))

const backup = {
  schema: 'service-lasso.secretsbroker.backup-metadata.v1' as const,
  backupId: 'backup-20260814-safe',
  createdAt: '2026-08-14T00:00:00Z',
  storeKeyId: 'mk-safe',
  storeKeyVersion: 'v1',
  secretCount: 2,
  sizeBytes: 4096,
  artifactHash: 'sha256-safe-backup-hash',
  verification: 'verified' as const,
}

vi.mock('@/lib/service-lasso-dashboard/hooks', () => ({
  useRuntimeIdentity: () => ({ data: { permissions: ['*'] } }),
  useBrokerLifecycleStatus: () => ({
    isLoading: false,
    data: {
      key: {
        available: true,
        keyId: 'mk-safe',
        keyVersion: 'v1',
        secretCount: 2,
      },
      wrapper: {
        available: true,
        supported: true,
        state: 'ready',
        wrapperKind: 'dpapi-user-scope',
        os: 'windows',
      },
      recovery: {
        nextAction: 'monitor_recovery_policy',
        policy: {
          status: 'active',
          threshold: 2,
          shareCount: 3,
          shareFingerprints: ['fp-1', 'fp-2', 'fp-3'],
        },
      },
    },
  }),
  useBrokerLifecycleBackups: () => ({
    isLoading: false,
    data: { backups: [backup] },
  }),
  useBrokerLifecycleBackupCreate: () => ({
    isPending: false,
    mutateAsync: mutations.create,
  }),
  useBrokerLifecycleBackupVerify: () => ({
    isPending: false,
    mutateAsync: mutations.verify,
  }),
  useBrokerLifecycleRestorePreview: () => ({
    isPending: false,
    mutateAsync: mutations.preview,
  }),
  useBrokerLifecycleRestoreApply: () => ({
    isPending: false,
    mutateAsync: mutations.restore,
  }),
  useBrokerLifecycleKeyRotate: () => ({
    isPending: false,
    mutateAsync: mutations.rotate,
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mutations.create.mockResolvedValue({
    outcome: 'ready',
    applied: true,
    backup,
    auditStatus: 'audit_recorded',
  })
  mutations.verify.mockResolvedValue({
    outcome: 'ready',
    applied: false,
    backup,
    auditStatus: 'audit_recorded',
  })
  mutations.preview.mockResolvedValue({
    outcome: 'ready',
    applied: false,
    requiresConfirmation: true,
    planToken: 'restore-plan-safe',
    planExpiresAt: '2026-08-14T00:05:00Z',
    expectedKeyId: 'mk-safe',
    expectedStoreHash: 'sha256-safe-store-hash',
    auditStatus: 'audit_recorded',
  })
  mutations.restore.mockResolvedValue({
    outcome: 'ready',
    applied: true,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
  })
  mutations.rotate.mockResolvedValue({
    outcome: 'ready',
    applied: true,
    requiresConfirmation: false,
    auditStatus: 'audit_recorded',
    newKeyId: 'mk-new-safe',
  })
})

describe('Secrets Broker lifecycle panel', () => {
  it('executes backup, verification, exact restore, and internal key rotation without collecting secrets', async () => {
    const user = userEvent.setup()
    render(<SecretsBrokerLifecyclePanel />)

    expect(screen.getByText(/2-of-3/i)).toBeVisible()
    expect(screen.getByText(/dpapi-user-scope/i)).toBeVisible()

    await user.type(
      screen.getByLabelText(/Audit reason/i),
      'release lifecycle verification'
    )
    await user.click(
      screen.getByRole('button', { name: /Create encrypted backup/i })
    )
    expect(await screen.findByText(/created and verified/i)).toBeVisible()
    expect(mutations.create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'release lifecycle verification' })
    )

    await user.click(screen.getByRole('button', { name: /^Verify$/i }))
    expect(
      await screen.findByText(/passed integrity verification/i)
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Restore/i }))
    const restoreDialog = await screen.findByRole('dialog', {
      name: /Restore encrypted Broker backup/i,
    })
    expect(await within(restoreDialog).findByText(/Plan: ready/i)).toBeVisible()
    await user.click(
      within(restoreDialog).getByLabelText(/Confirm exact Broker restore/i)
    )
    await user.click(
      within(restoreDialog).getByRole('button', {
        name: /Apply exact restore/i,
      })
    )
    await waitFor(() => {
      expect(mutations.restore).toHaveBeenCalledWith(
        expect.objectContaining({
          backupId: backup.backupId,
          planToken: 'restore-plan-safe',
          expectedKeyId: 'mk-safe',
          expectedStoreHash: 'sha256-safe-store-hash',
          confirm: true,
        })
      )
    })

    await user.click(screen.getByRole('button', { name: /Rotate master key/i }))
    const rotateDialog = await screen.findByRole('dialog', {
      name: /Rotate Broker master key/i,
    })
    expect(within(rotateDialog).queryByLabelText(/new key/i)).toBeNull()
    await user.click(
      within(rotateDialog).getByLabelText(/Confirm Broker master key rotation/i)
    )
    await user.click(
      within(rotateDialog).getByRole('button', { name: /Rotate and rewrap/i })
    )
    await waitFor(() => {
      expect(mutations.rotate).toHaveBeenCalledWith(
        expect.objectContaining({ expectedKeyId: 'mk-safe', confirm: true })
      )
    })

    const rendered = document.body.textContent ?? ''
    expect(rendered).not.toContain('raw-master-key')
    expect(rendered).not.toContain('recovery-share-value')
  })
})
