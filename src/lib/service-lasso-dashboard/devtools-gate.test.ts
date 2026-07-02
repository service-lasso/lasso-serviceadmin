import { describe, expect, it } from 'vitest'
import { shouldShowTanStackDevtools } from './devtools-gate'

describe('Service Admin root devtools gate', () => {
  it('keeps TanStack devtools hidden unless explicitly opted in during development', () => {
    expect(
      shouldShowTanStackDevtools({
        MODE: 'development',
        VITE_SERVICE_ADMIN_DEVTOOLS: undefined,
      })
    ).toBe(false)
    expect(
      shouldShowTanStackDevtools({
        MODE: 'development',
        VITE_SERVICE_ADMIN_DEVTOOLS: 'false',
      })
    ).toBe(false)
    expect(
      shouldShowTanStackDevtools({
        MODE: 'test',
        VITE_SERVICE_ADMIN_DEVTOOLS: 'true',
      })
    ).toBe(false)
    expect(
      shouldShowTanStackDevtools({
        MODE: 'production',
        VITE_SERVICE_ADMIN_DEVTOOLS: 'true',
      })
    ).toBe(false)
  })

  it('shows TanStack devtools only for explicit development opt-in', () => {
    expect(
      shouldShowTanStackDevtools({
        MODE: 'development',
        VITE_SERVICE_ADMIN_DEVTOOLS: 'true',
      })
    ).toBe(true)
  })
})
