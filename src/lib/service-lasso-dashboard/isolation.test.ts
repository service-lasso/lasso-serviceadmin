import { describe, expect, it } from 'vitest'
import { parseServiceIsolation } from './isolation'

describe('parseServiceIsolation', () => {
  it('returns undefined when Core omitted isolation', () => {
    expect(parseServiceIsolation(undefined)).toBeUndefined()
  })

  it('returns undefined for a Docker provider mode', () => {
    expect(
      parseServiceIsolation({
        declaredMode: 'provider',
        effectiveMode: 'provider',
        require: 'none',
        workspace: [],
        limitsEnforced: false,
        degradeReasons: [],
        startBlocked: false,
      })
    ).toBeUndefined()
  })

  it('keeps degrade and start-blocked fields from Core', () => {
    const status = parseServiceIsolation({
      declaredMode: 'direct',
      effectiveMode: 'direct',
      require: 'limits',
      workspace: ['runtime/data'],
      limits: { memoryMb: 512 },
      limitsEnforced: false,
      degradeReasons: ['limits_not_applied'],
      startBlocked: true,
      startBlockedReason:
        'CPU/memory/pid limits are declared but Core does not apply cgroup or Job caps yet',
    })
    expect(status?.startBlocked).toBe(true)
    expect(status?.degradeReasons).toEqual(['limits_not_applied'])
    expect(status?.workspace).toEqual(['runtime/data'])
    expect(status?.limits?.memoryMb).toBe(512)
  })
})
