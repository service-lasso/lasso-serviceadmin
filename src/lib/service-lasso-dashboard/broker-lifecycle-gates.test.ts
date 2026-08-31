import { describe, expect, it } from 'vitest'
import {
  OPERATOR_BACKUP_DESTINATION,
  assertSafeLifecycleMutation,
  lifecycleAuditIsRecorded,
  restorePlanIsStale,
} from './broker-lifecycle-gates'

describe('Broker lifecycle fail-closed gates', () => {
  it('requires a recorded audit event', () => {
    expect(lifecycleAuditIsRecorded('audit_recorded')).toBe(true)
    expect(lifecycleAuditIsRecorded('audit_unavailable')).toBe(false)
    expect(() =>
      assertSafeLifecycleMutation({ auditStatus: 'audit_unavailable' })
    ).toThrow(/audit is unavailable/i)
  })

  it('rejects corrupted backups and stale or wrong-key restore plans', () => {
    expect(() =>
      assertSafeLifecycleMutation({
        auditStatus: 'audit_recorded',
        verification: 'invalid',
      })
    ).toThrow(/corrupted/i)
    expect(() =>
      assertSafeLifecycleMutation({
        auditStatus: 'audit_recorded',
        outcome: 'stale_plan',
      })
    ).toThrow(/stale_plan/i)
    expect(() =>
      assertSafeLifecycleMutation({
        auditStatus: 'audit_recorded',
        outcome: 'wrong_key',
      })
    ).toThrow(/wrong_key/i)
    expect(restorePlanIsStale('2000-01-01T00:00:00.000Z')).toBe(true)
    expect(
      restorePlanIsStale(new Date(Date.now() + 60_000).toISOString())
    ).toBe(false)
  })

  it('names the operator-retained encrypted backup destination', () => {
    expect(OPERATOR_BACKUP_DESTINATION).toBe(
      'operator-retained-encrypted-artifact'
    )
  })
})
