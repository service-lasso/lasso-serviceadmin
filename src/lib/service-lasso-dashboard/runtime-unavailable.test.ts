import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RuntimeApiUnavailableError,
  fetchRuntimeJson,
  getRuntimeApiUnavailableCopy,
  isServiceLassoStubDataEnabled,
} from './stub'

describe('runtime API unavailable handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses packaged runtime guidance without Vite env variables', () => {
    const copy = getRuntimeApiUnavailableCopy(
      new RuntimeApiUnavailableError({
        mode: 'packaged-runtime',
        path: '/api/dashboard',
        endpoint: '/api/dashboard',
        status: 502,
        contentType: 'text/html; charset=utf-8',
        packagedProxyConfigured: true,
        reason: 'non_json',
      }),
      {
        DEV: false,
        VITE_SERVICE_LASSO_API_BASE_URL: undefined,
        VITE_SERVICE_LASSO_ENABLE_STUB_DATA: undefined,
      }
    )

    expect(copy.description).toContain(
      'Service Admin cannot reach or parse the Service Lasso runtime API'
    )
    expect(copy.guidance).toContain('packaged Service Admin runtime API proxy')
    expect(copy.guidance).not.toContain('VITE_SERVICE_LASSO_API_BASE_URL')
    expect(copy.guidance).not.toContain('VITE_SERVICE_LASSO_ENABLE_STUB_DATA')
  })

  it('keeps Vite setup guidance available for local development', () => {
    const copy = getRuntimeApiUnavailableCopy(
      new RuntimeApiUnavailableError({
        mode: 'local-dev',
        path: '/api/dashboard',
        endpoint: null,
        status: null,
        contentType: null,
        packagedProxyConfigured: false,
        reason: 'missing_api_base_url',
      }),
      {
        DEV: true,
        VITE_SERVICE_LASSO_API_BASE_URL: undefined,
        VITE_SERVICE_LASSO_ENABLE_STUB_DATA: undefined,
      }
    )

    expect(copy.guidance).toContain('VITE_SERVICE_LASSO_API_BASE_URL')
    expect(copy.guidance).toContain('VITE_SERVICE_LASSO_ENABLE_STUB_DATA=true')
  })

  it('reports non-JSON responses with safe diagnostics', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response('<html><body>not json</body></html>', {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
        })
      })
    )

    await expect(
      fetchRuntimeJson('/api/dashboard', {
        apiBaseUrl: '',
        mode: 'packaged-runtime',
      })
    ).rejects.toMatchObject({
      details: {
        path: '/api/dashboard',
        endpoint: '/api/dashboard',
        status: 200,
        contentType: 'text/html; charset=utf-8',
        reason: 'non_json',
      },
    })
  })

  it('allows stub data only when explicitly enabled in local development', () => {
    expect(
      isServiceLassoStubDataEnabled({
        DEV: true,
        VITE_SERVICE_LASSO_API_BASE_URL: undefined,
        VITE_SERVICE_LASSO_ENABLE_STUB_DATA: 'true',
      })
    ).toBe(true)
    expect(
      isServiceLassoStubDataEnabled({
        DEV: true,
        VITE_SERVICE_LASSO_API_BASE_URL: undefined,
        VITE_SERVICE_LASSO_ENABLE_STUB_DATA: undefined,
      })
    ).toBe(false)
    expect(
      isServiceLassoStubDataEnabled({
        DEV: false,
        VITE_SERVICE_LASSO_API_BASE_URL: undefined,
        VITE_SERVICE_LASSO_ENABLE_STUB_DATA: 'true',
      })
    ).toBe(false)
  })
})
