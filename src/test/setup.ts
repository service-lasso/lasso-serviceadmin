import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverMock {
  root = null
  rootMargin = ''
  thresholds = []
  disconnect() {}
  observe() {}
  takeRecords() {
    return []
  }
  unobserve() {}
}

const originalConsoleError = console.error

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverMock,
  })

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: IntersectionObserverMock,
  })

  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverMock,
  })

  Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    value: IntersectionObserverMock,
  })

  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  window.scrollTo = vi.fn()
})

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    const first = args[0]
    if (
      typeof first === 'string' &&
      first.includes('not wrapped in act')
    ) {
      return
    }

    originalConsoleError(...args)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
  window.localStorage?.clear?.()
  window.sessionStorage?.clear?.()
  document.cookie = ''
  document.title = ''
  useAuthStore.getState().auth.reset()
})
