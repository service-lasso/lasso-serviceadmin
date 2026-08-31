import { useState } from 'react'
import {
  ArchiveRestore,
  DatabaseBackup,
  KeyRound,
  ShieldCheck,
} from 'lucide-react'
import {
  OPERATOR_BACKUP_DESTINATION,
  lifecycleAuditIsRecorded,
  restorePlanIsStale,
} from '@/lib/service-lasso-dashboard/broker-lifecycle-gates'
import {
  useBrokerLifecycleBackupCreate,
  useBrokerLifecycleBackups,
  useBrokerLifecycleBackupVerify,
  useBrokerLifecycleKeyRotate,
  useBrokerLifecycleRestoreApply,
  useBrokerLifecycleRestorePreview,
  useBrokerLifecycleStatus,
  useRuntimeIdentity,
} from '@/lib/service-lasso-dashboard/hooks'
import { serviceLassoStubDataEnabled } from '@/lib/service-lasso-dashboard/stub'
import type {
  BrokerLifecycleBackup,
  BrokerLifecycleRestoreResult,
} from '@/lib/service-lasso-dashboard/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function operationId(kind: 'backup' | 'restore' | 'rotate') {
  const suffix =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `serviceadmin-${kind}-${suffix}`
}

function shorten(value?: string) {
  if (!value) return 'Not available'
  return value.length > 28 ? `${value.slice(0, 18)}…${value.slice(-8)}` : value
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`
}

export function SecretsBrokerLifecyclePanel() {
  const identity = useRuntimeIdentity()
  const permissions = identity.data?.permissions ?? []
  const permitted = (permission: string) =>
    permissions.includes('*') || permissions.includes(permission)
  const canReadBackups = permitted('backup:read')
  const canCreateBackup = permitted('backup:create')
  const canRestore = permitted('backup:restore')
  const canManageKeys = permitted('security:manage')
  const status = useBrokerLifecycleStatus(canManageKeys)
  const auditRecorded = lifecycleAuditIsRecorded(status.data?.auditStatus ?? '')
  const mutationsLocked = Boolean(status.data) && !auditRecorded
  const canRotateManagedKey =
    canManageKeys &&
    !mutationsLocked &&
    status.data?.wrapper.supported === true &&
    status.data.wrapper.available === true &&
    status.data.wrapper.state === 'ready'
  const backups = useBrokerLifecycleBackups(canReadBackups)
  const createBackup = useBrokerLifecycleBackupCreate()
  const verifyBackup = useBrokerLifecycleBackupVerify()
  const previewRestore = useBrokerLifecycleRestorePreview()
  const applyRestore = useBrokerLifecycleRestoreApply()
  const rotateKey = useBrokerLifecycleKeyRotate()
  const [reason, setReason] = useState('')
  const [backupOperationId, setBackupOperationId] = useState(() =>
    operationId('backup')
  )
  const [selectedBackup, setSelectedBackup] =
    useState<BrokerLifecycleBackup | null>(null)
  const [restoreOperationId, setRestoreOperationId] = useState('')
  const [restorePlan, setRestorePlan] =
    useState<BrokerLifecycleRestoreResult | null>(null)
  const [restoreConfirmed, setRestoreConfirmed] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [rotateConfirmed, setRotateConfirmed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requireReason = () => {
    if (reason.trim()) return true
    setError('An audit reason is required before this lifecycle operation.')
    return false
  }

  const runBackupCreate = async () => {
    if (!requireReason()) return
    setError(null)
    setMessage(null)
    try {
      const result = await createBackup.mutateAsync({
        operationId: backupOperationId,
        reason: reason.trim(),
        destinationPolicy: OPERATOR_BACKUP_DESTINATION,
      })
      if (
        result.outcome !== 'ready' ||
        !result.backup ||
        result.backup.verification !== 'verified' ||
        result.auditStatus !== 'audit_recorded'
      ) {
        throw new Error('Backup did not reach verified state.')
      }
      setMessage(
        result.applied
          ? `Encrypted backup ${result.backup.backupId} created and verified.`
          : `Encrypted backup ${result.backup.backupId} was already complete.`
      )
      setBackupOperationId(operationId('backup'))
    } catch {
      setError('The Broker did not create a verified encrypted backup.')
    }
  }

  const runBackupVerify = async (backup: BrokerLifecycleBackup) => {
    if (!requireReason()) return
    setError(null)
    setMessage(null)
    try {
      const result = await verifyBackup.mutateAsync({
        operationId: operationId('backup'),
        reason: reason.trim(),
        backupId: backup.backupId,
      })
      if (
        result.outcome !== 'ready' ||
        result.backup?.verification !== 'verified' ||
        result.auditStatus !== 'audit_recorded'
      ) {
        throw new Error('Backup verification failed.')
      }
      setMessage(`Backup ${backup.backupId} passed integrity verification.`)
    } catch {
      setError('The selected backup failed safe verification.')
    }
  }

  const openRestore = async (backup: BrokerLifecycleBackup) => {
    if (!requireReason()) return
    const nextOperationId = operationId('restore')
    setSelectedBackup(backup)
    setRestoreOperationId(nextOperationId)
    setRestorePlan(null)
    setRestoreConfirmed(false)
    setError(null)
    setMessage(null)
    try {
      const result = await previewRestore.mutateAsync({
        operationId: nextOperationId,
        reason: reason.trim(),
        backupId: backup.backupId,
      })
      if (
        result.outcome !== 'ready' ||
        result.applied ||
        !result.requiresConfirmation ||
        !result.planToken ||
        !result.expectedKeyId ||
        !result.expectedStoreHash ||
        result.auditStatus !== 'audit_recorded'
      ) {
        throw new Error('Restore plan was incomplete.')
      }
      setRestorePlan(result)
    } catch {
      setError('The Broker did not return a fresh exact-state restore plan.')
    }
  }

  const runRestore = async () => {
    if (!selectedBackup || !restorePlan || !restoreConfirmed) return
    if (restorePlanIsStale(restorePlan.planExpiresAt)) {
      setRestoreConfirmed(false)
      setError(
        'Restore did not reach a verified terminal state. Inspect Broker audit and current store status, then create a fresh plan before retrying.'
      )
      return
    }
    setError(null)
    try {
      const result = await applyRestore.mutateAsync({
        operationId: restoreOperationId,
        reason: reason.trim(),
        backupId: selectedBackup.backupId,
        planToken: restorePlan.planToken,
        expectedKeyId: restorePlan.expectedKeyId,
        expectedStoreHash: restorePlan.expectedStoreHash,
        confirm: true,
      })
      if (
        result.outcome !== 'ready' ||
        !result.applied ||
        result.requiresConfirmation ||
        result.auditStatus !== 'audit_recorded'
      ) {
        throw new Error('Restore did not reach terminal state.')
      }
      setMessage(
        `Backup ${selectedBackup.backupId} restored. Restart verification is required.`
      )
      setSelectedBackup(null)
      setRestorePlan(null)
      setRestoreConfirmed(false)
    } catch {
      setRestoreConfirmed(false)
      setError(
        'Restore did not reach a verified terminal state. Inspect Broker audit and current store status, then create a fresh plan before retrying.'
      )
    }
  }

  const runKeyRotation = async () => {
    if (!requireReason() || !rotateConfirmed || !status.data?.key.keyId) return
    setError(null)
    setMessage(null)
    try {
      const result = await rotateKey.mutateAsync({
        operationId: operationId('rotate'),
        reason: reason.trim(),
        expectedKeyId: status.data.key.keyId,
        confirm: true,
      })
      if (
        result.outcome !== 'ready' ||
        !result.applied ||
        result.requiresConfirmation ||
        result.auditStatus !== 'audit_recorded' ||
        !result.newKeyId
      ) {
        throw new Error('Key rotation was incomplete.')
      }
      setMessage(
        `Master key rotated to ${shorten(result.newKeyId)}. Create and verify a new backup now.`
      )
      setRotateOpen(false)
      setRotateConfirmed(false)
    } catch {
      setRotateConfirmed(false)
      setError(
        'Master-key rotation failed closed. Inspect Broker audit and wrapper state before retrying.'
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <ShieldCheck className='size-5' /> Backup, keys and recovery
        </CardTitle>
        <CardDescription>
          Live Broker lifecycle metadata and audited operations. Key bytes,
          recovery shares, passphrases and backup paths never enter this page.
          Encrypted backups are retained as operator-held artifacts, separate
          from recovery material.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-5'>
        {serviceLassoStubDataEnabled ? (
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            Stub/fixture mode. These results are labelled fixtures, not live
            Broker lifecycle operations.
          </p>
        ) : null}
        {mutationsLocked ? (
          <p className='text-sm text-destructive'>
            Lifecycle mutations are locked because Broker audit is unavailable.
          </p>
        ) : null}
        <div className='grid gap-3 md:grid-cols-3'>
          <div className='rounded-lg border p-3'>
            <div className='flex items-center gap-2 font-medium'>
              <KeyRound className='size-4' /> Master key
            </div>
            <p className='mt-2 text-sm text-muted-foreground'>
              {status.isLoading
                ? 'Loading live status…'
                : status.data
                  ? `${status.data.key.available ? 'Available' : 'Locked'} · ${shorten(status.data.key.keyId)} · ${status.data.key.keyVersion ?? 'unknown version'}`
                  : canManageKeys
                    ? 'Live key status unavailable.'
                    : 'Security administration permission required.'}
            </p>
          </div>
          <div className='rounded-lg border p-3'>
            <div className='font-medium'>Local wrapper</div>
            <p className='mt-2 text-sm text-muted-foreground'>
              {status.data
                ? `${status.data.wrapper.state} · ${status.data.wrapper.wrapperKind} · ${status.data.wrapper.os}`
                : 'No authorized live wrapper status.'}
            </p>
          </div>
          <div className='rounded-lg border p-3'>
            <div className='font-medium'>Recovery policy</div>
            <p className='mt-2 text-sm text-muted-foreground'>
              {status.data?.recovery.policy
                ? `${status.data.recovery.policy.status} · ${status.data.recovery.policy.threshold}-of-${status.data.recovery.policy.shareCount} · ${status.data.recovery.policy.shareFingerprints.length} fingerprints recorded`
                : (status.data?.recovery.nextAction ??
                  'No authorized live recovery metadata.')}
            </p>
          </div>
        </div>

        <div className='grid gap-2 md:grid-cols-[1fr_auto_auto] md:items-end'>
          <div className='space-y-2'>
            <Label htmlFor='broker-lifecycle-reason'>Audit reason</Label>
            <Input
              id='broker-lifecycle-reason'
              value={reason}
              maxLength={256}
              onChange={(event) => setReason(event.target.value)}
              placeholder='Why is this lifecycle operation required?'
            />
          </div>
          <Button
            type='button'
            variant='outline'
            disabled={
              !canCreateBackup || mutationsLocked || createBackup.isPending
            }
            onClick={runBackupCreate}
          >
            <DatabaseBackup className='mr-2 size-4' /> Create encrypted backup
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={!canRotateManagedKey || !status.data?.key.keyId}
            onClick={() => {
              setRotateOpen(true)
              setRotateConfirmed(false)
              setError(null)
            }}
          >
            <KeyRound className='mr-2 size-4' /> Rotate master key
          </Button>
        </div>

        {canManageKeys && status.data && !canRotateManagedKey ? (
          <p className='text-sm text-muted-foreground'>
            Master-key rotation requires a ready OS-backed local wrapper. This
            runtime is using portable key injection, so rotation is unavailable
            until a supported wrapper is configured.
          </p>
        ) : null}

        {message ? (
          <p className='text-sm text-emerald-700 dark:text-emerald-300'>
            {message}
          </p>
        ) : null}
        {error ? <p className='text-sm text-destructive'>{error}</p> : null}

        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Backup</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Contents</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(backups.data?.backups ?? []).map((backup) => (
                <TableRow key={backup.backupId}>
                  <TableCell className='font-mono text-xs'>
                    {shorten(backup.backupId)}
                  </TableCell>
                  <TableCell>
                    {backup.createdAt
                      ? new Date(backup.createdAt).toLocaleString()
                      : 'Unavailable'}
                  </TableCell>
                  <TableCell>
                    {backup.secretCount} refs · {formatBytes(backup.sizeBytes)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        backup.verification === 'verified'
                          ? 'outline'
                          : 'destructive'
                      }
                    >
                      {backup.verification}
                    </Badge>
                  </TableCell>
                  <TableCell className='space-x-2 text-right'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={
                        !canReadBackups ||
                        mutationsLocked ||
                        backup.verification !== 'verified' ||
                        verifyBackup.isPending
                      }
                      onClick={() => runBackupVerify(backup)}
                    >
                      Verify
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={
                        !canRestore ||
                        mutationsLocked ||
                        backup.verification !== 'verified'
                      }
                      onClick={() => openRestore(backup)}
                    >
                      <ArchiveRestore className='mr-2 size-4' /> Restore
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!backups.isLoading &&
              (backups.data?.backups.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-muted-foreground'>
                    {canReadBackups
                      ? 'No broker-managed encrypted backups exist yet.'
                      : 'Backup history permission is required.'}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog
        open={Boolean(selectedBackup)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBackup(null)
            setRestorePlan(null)
            setRestoreConfirmed(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore encrypted Broker backup</DialogTitle>
            <DialogDescription>
              This replaces the current encrypted store only if the signed plan,
              current key and current store digest still match.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-3 text-sm'>
            <div>Backup: {selectedBackup?.backupId}</div>
            <div>Plan: {restorePlan ? 'ready' : 'loading or unavailable'}</div>
            <div>Expires: {restorePlan?.planExpiresAt ?? 'Not available'}</div>
            <label className='flex items-start gap-2'>
              <Checkbox
                checked={restoreConfirmed}
                onCheckedChange={(checked) =>
                  setRestoreConfirmed(checked === true)
                }
                aria-label='Confirm exact Broker restore'
              />
              <span>
                I confirm replacement from this exact verified backup and will
                restart and verify the Broker afterward.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setSelectedBackup(null)}
            >
              Cancel
            </Button>
            <Button
              type='button'
              disabled={
                !restorePlan ||
                !restoreConfirmed ||
                restorePlanIsStale(restorePlan.planExpiresAt) ||
                applyRestore.isPending
              }
              onClick={runRestore}
            >
              Apply exact restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate Broker master key</DialogTitle>
            <DialogDescription>
              The Broker generates the replacement internally, re-encrypts the
              store and refreshes the local wrapper. No key bytes enter the UI.
            </DialogDescription>
          </DialogHeader>
          <label className='flex items-start gap-2 text-sm'>
            <Checkbox
              checked={rotateConfirmed}
              onCheckedChange={(checked) =>
                setRotateConfirmed(checked === true)
              }
              aria-label='Confirm Broker master key rotation'
            />
            <span>
              I confirm rotation from key {shorten(status.data?.key.keyId)} and
              will create and verify a new backup immediately afterward.
            </span>
          </label>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setRotateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type='button'
              disabled={!rotateConfirmed || rotateKey.isPending}
              onClick={runKeyRotation}
            >
              Rotate and rewrap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
