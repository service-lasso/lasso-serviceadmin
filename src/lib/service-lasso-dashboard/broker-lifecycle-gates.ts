/**
 * Fail-closed gates for Broker backup, restore, and key rotation.
 */

/**
 * True when the Broker recorded a safe audit event for the mutation.
 */
export function lifecycleAuditIsRecorded(auditStatus: string): boolean {
  return auditStatus === 'audit_recorded'
}

/**
 * True when a restore dry-run is no longer exact-state.
 */
export function restorePlanIsStale(
  planExpiresAt: string | undefined,
  nowMs = Date.now()
): boolean {
  if (!planExpiresAt) return true
  const expires = Date.parse(planExpiresAt)
  return !Number.isFinite(expires) || expires <= nowMs
}

/**
 * Throws when a lifecycle mutation must not proceed.
 */
export function assertSafeLifecycleMutation(input: {
  auditStatus: string
  verification?: string
  outcome?: string
}): void {
  if (input.auditStatus === 'audit_unavailable') {
    throw new Error(
      'Lifecycle mutation failed closed because audit is unavailable.'
    )
  }
  if (!lifecycleAuditIsRecorded(input.auditStatus)) {
    throw new Error(
      'Lifecycle mutation failed closed because audit was not recorded.'
    )
  }
  if (input.verification === 'invalid') {
    throw new Error(
      'Lifecycle mutation failed closed because the backup is corrupted.'
    )
  }
  if (
    input.outcome === 'stale' ||
    input.outcome === 'stale_plan' ||
    input.outcome === 'wrong_key'
  ) {
    throw new Error(`Lifecycle mutation failed closed: ${input.outcome}.`)
  }
}
