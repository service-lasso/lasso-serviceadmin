import { describe, expect, it } from 'vitest'
import {
  buildSecretInventoryOperationPreview,
  buildLargeSecretInventoryFixture,
  countSecretInventoryByState,
  secretInventoryOperationHasPlaintextMaterial,
  secretInventoryHasPlaintextMaterial,
  secretInventoryRows,
} from './secret-inventory'

describe('secret inventory metadata fixtures', () => {
  it('counts states and keeps fixtures free of plaintext-like material', () => {
    expect(countSecretInventoryByState()).toEqual({
      present: 2,
      missing: 1,
      stale: 1,
      'rotation-due': 1,
    })
    expect(secretInventoryRows).toHaveLength(5)
    expect(secretInventoryHasPlaintextMaterial()).toBe(false)
    expect(
      secretInventoryOperationHasPlaintextMaterial(
        buildSecretInventoryOperationPreview(
          secretInventoryRows[0],
          'delete',
          'operator requested safe delete',
          'secret://local/serviceadmin/session-signing'
        )
      )
    ).toBe(false)
  })

  it('builds large deterministic fixture sets for table behavior tests', () => {
    const largeRows = buildLargeSecretInventoryFixture(125)

    expect(largeRows).toHaveLength(125)
    expect(largeRows[0].id).toBe('fixture-secret-ref-1')
    expect(largeRows[124].refId).toBe('secret://fixture/workspace-5/ref-125')
    expect(new Set(largeRows.map((row) => row.id)).size).toBe(125)
    expect(secretInventoryHasPlaintextMaterial(largeRows)).toBe(false)
  })
})
