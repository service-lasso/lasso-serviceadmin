import { describe, expect, it } from 'vitest'
import { isLoopbackHostname } from './local-operator-session'

describe('loopback browser origins', () => {
  it('accepts localhost and loopback IPs only', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('::1')).toBe(true)
    expect(isLoopbackHostname('192.168.1.9')).toBe(false)
    expect(isLoopbackHostname('serviceadmin.servicelasso.localhost')).toBe(
      false
    )
  })
})
