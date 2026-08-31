import type {
  BrokerMigrationItem,
  BrokerProviderStatus,
} from './types'

/**
 * True when the provider advertises a validated or executable migration apply.
 */
function targetSupportsMigrationApply(provider: BrokerProviderStatus): boolean {
  return provider.operations.some(
    (operation) =>
      operation.path === '/v1/providers/migration/apply' &&
      (operation.maturity === 'validated' || operation.maturity === 'executable')
  )
}

export const MIGRATION_REF_OUTCOMES = [
  'migrated',
  'dry_run_ready',
  'skipped',
  'denied',
  'unsupported',
  'failed',
  'stale',
] as const

export type MigrationRefOutcome = (typeof MIGRATION_REF_OUTCOMES)[number]

/**
 * True when apply must stay disabled: missing validated apply capability,
 * missing fresh revalidation, or missing explicit confirmation.
 */
export function migrationApplyBlocked(input: {
  target: BrokerProviderStatus | undefined
  revalidated: boolean
  confirmed: boolean
}): { blocked: boolean; reason: string } {
  if (!input.target) {
    return { blocked: true, reason: 'Select a live target provider.' }
  }
  if (!targetSupportsMigrationApply(input.target)) {
    return {
      blocked: true,
      reason:
        'This target does not advertise a validated migration apply operation. Apply remains disabled.',
    }
  }
  if (!input.revalidated) {
    return {
      blocked: true,
      reason: 'Revalidate this exact dry-run before apply.',
    }
  }
  if (!input.confirmed) {
    return {
      blocked: true,
      reason: 'Confirm this exact provider, reference, operation ID, and audit reason.',
    }
  }
  return { blocked: false, reason: 'Apply the revalidated Broker migration plan.' }
}

/**
 * Normalizes a per-ref Broker outcome onto the accepted result set.
 */
export function classifyMigrationRefOutcome(outcome: string): MigrationRefOutcome {
  const normalized = outcome.trim().toLowerCase().replace(/-/g, '_')
  if (normalized === 'migrated' || normalized === 'applied' || normalized === 'success') {
    return 'migrated'
  }
  if (normalized === 'dry_run_ready' || normalized === 'planned') {
    return 'dry_run_ready'
  }
  if (normalized === 'skipped' || normalized === 'skip') {
    return 'skipped'
  }
  if (normalized === 'denied' || normalized === 'policy_denied') {
    return 'denied'
  }
  if (normalized === 'unsupported') {
    return 'unsupported'
  }
  if (normalized === 'stale' || normalized === 'stale_plan') {
    return 'stale'
  }
  return 'failed'
}

/**
 * True when two dry-run plans describe the same refs and outcomes.
 */
export function migrationPlansMatch(
  left: readonly BrokerMigrationItem[],
  right: readonly BrokerMigrationItem[]
): boolean {
  if (left.length !== right.length) return false
  const sortedLeft = [...left].sort((a, b) => a.ref.localeCompare(b.ref))
  const sortedRight = [...right].sort((a, b) => a.ref.localeCompare(b.ref))
  return sortedLeft.every((item, index) => {
    const other = sortedRight[index]
    return (
      other !== undefined &&
      item.ref === other.ref &&
      item.outcome === other.outcome &&
      item.sourceProviderId === other.sourceProviderId &&
      item.targetProviderId === other.targetProviderId
    )
  })
}
