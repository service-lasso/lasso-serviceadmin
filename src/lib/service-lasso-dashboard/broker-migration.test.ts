import { describe, expect, it } from 'vitest'
import {
  classifyMigrationRefOutcome,
  migrationApplyBlocked,
  migrationPlansMatch,
} from './broker-migration'
import type {
  BrokerMigrationItem,
  BrokerOperationCapability,
  BrokerProviderStatus,
} from './types'

function operation(
  path: string,
  maturity: BrokerOperationCapability['maturity']
): BrokerOperationCapability {
  return {
    operationId: path.replace(/[^a-z0-9]+/gi, '_'),
    method: 'POST',
    path,
    maturity,
    classification: 'mutation',
    authenticationRequired: true,
    policyRequired: true,
    auditRequired: true,
    scope: 'provider-remote',
    completionMode: 'synchronous',
    limitationCode: '',
    reasonCode: maturity,
    nextAction: 'execute_guarded_operation',
  }
}

function provider(
  providerId: string,
  operations: BrokerOperationCapability[]
): BrokerProviderStatus {
  return {
    providerId,
    providerKind: providerId === 'local' ? 'local-encrypted-store' : 'vault',
    displayName: providerId,
    state: 'ready',
    outcome: 'ready',
    namespaces: ['services'],
    capabilities: ['read'],
    operations,
    auditStatus: 'audit_available',
  }
}

function item(outcome: string, ref = 'services/app/runtime/API_KEY'): BrokerMigrationItem {
  return {
    ref,
    sourceProviderId: 'local',
    targetProviderId: 'vault-target',
    ownerServiceId: 'app',
    state: outcome,
    outcome,
    risk: 'high',
    expectedAction: 'copy_value_inside_broker',
    policyResult: 'allowed',
    auditRequirement: 'required',
    recovery: 'retry_after_fix_or_restore_from_backup',
  }
}

describe('live provider migration gates', () => {
  it('disables apply for unsupported remote writes until a validated apply operation exists', () => {
    const unsupported = provider('remote-read', [
      operation('/v1/providers/migration/apply', 'read-only'),
    ])
    const gate = migrationApplyBlocked({
      target: unsupported,
      revalidated: true,
      confirmed: true,
    })
    expect(gate.blocked).toBe(true)
    expect(gate.reason).toMatch(/does not advertise a validated migration apply/i)
  })

  it('requires fresh revalidation before confirmation can unlock apply', () => {
    const target = provider('vault-target', [
      operation('/v1/providers/migration/apply', 'validated'),
    ])
    expect(
      migrationApplyBlocked({
        target,
        revalidated: false,
        confirmed: true,
      }).blocked
    ).toBe(true)
    expect(
      migrationApplyBlocked({
        target,
        revalidated: true,
        confirmed: true,
      }).blocked
    ).toBe(false)
  })

  it('classifies skipped, denied, unsupported, failed, and stale per-ref outcomes', () => {
    expect(classifyMigrationRefOutcome('skipped')).toBe('skipped')
    expect(classifyMigrationRefOutcome('denied')).toBe('denied')
    expect(classifyMigrationRefOutcome('unsupported')).toBe('unsupported')
    expect(classifyMigrationRefOutcome('failed')).toBe('failed')
    expect(classifyMigrationRefOutcome('stale_plan')).toBe('stale')
  })

  it('treats mismatched dry-run plans as stale', () => {
    expect(migrationPlansMatch([item('dry_run_ready')], [item('denied')])).toBe(
      false
    )
    expect(
      migrationPlansMatch([item('dry_run_ready')], [item('dry_run_ready')])
    ).toBe(true)
  })
})
