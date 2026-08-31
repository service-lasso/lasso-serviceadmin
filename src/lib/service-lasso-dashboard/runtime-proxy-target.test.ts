import { describe, expect, it } from 'vitest'
import {
  applyOriginalClientAddressHeader,
  DEFAULT_RUNTIME_PROXY_TARGET,
  ORIGINAL_CLIENT_ADDRESS_HEADER,
  resolveRuntimeProxyTarget,
  shouldEnableStubLogMiddleware,
} from './runtime-proxy-target'

describe('Service Admin runtime API proxy target', () => {
  it('defaults same-origin /api proxying to the canonical local runtime', () => {
    expect(resolveRuntimeProxyTarget()).toBe(DEFAULT_RUNTIME_PROXY_TARGET)
  })

  it('allows an explicit runtime proxy target override', () => {
    expect(resolveRuntimeProxyTarget(' http://127.0.0.1:19999 ')).toBe(
      'http://127.0.0.1:19999'
    )
  })

  it('ignores blank runtime proxy overrides', () => {
    expect(resolveRuntimeProxyTarget('   ')).toBe(DEFAULT_RUNTIME_PROXY_TARGET)
  })

  it('keeps the Vite stub log middleware disabled by default', () => {
    expect(shouldEnableStubLogMiddleware()).toBe(false)
    expect(shouldEnableStubLogMiddleware('false')).toBe(false)
  })

  it('allows explicit Vite stub log middleware opt-in', () => {
    expect(shouldEnableStubLogMiddleware('true')).toBe(true)
  })

  it('overwrites a spoofed original-client header with the socket peer', () => {
    const headers = new Map<string, string>([
      [ORIGINAL_CLIENT_ADDRESS_HEADER, '127.0.0.1'],
    ])
    applyOriginalClientAddressHeader(
      (name, value) => {
        headers.set(name, value)
      },
      (name) => {
        headers.delete(name)
      },
      '192.168.1.41'
    )
    expect(headers.get(ORIGINAL_CLIENT_ADDRESS_HEADER)).toBe('192.168.1.41')
  })
})
