import { describe, expect, it } from 'vitest'
import {
  isLoopbackHostname,
  isLoopbackLoginOrigin,
} from './local-operator-session'

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

  it('treats Core local or loopback hostname as a loopback login origin', () => {
    expect(isLoopbackLoginOrigin({ local: true }, '192.168.1.9')).toBe(true)
    expect(isLoopbackLoginOrigin({ local: false }, 'localhost')).toBe(true)
    expect(isLoopbackLoginOrigin({ local: false }, '127.0.0.1')).toBe(true)
    expect(isLoopbackLoginOrigin({ local: false }, '::1')).toBe(true)
    expect(isLoopbackLoginOrigin({ local: false }, '192.168.1.9')).toBe(false)
  })
})
