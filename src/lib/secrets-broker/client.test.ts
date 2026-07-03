import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'

function service(status: DashboardService['status'] = 'running') {
  return {
    id: '@secretsbroker',
    name: 'Secrets Broker',
    status,
    favorite: false,
    note: 'Secrets Broker runtime metadata.',
    installed: true,
    role: 'Secret metadata broker',
    links: [],
    runtimeHealth: {
      state: status,
      health: status === 'running' ? 'healthy' : 'critical',
      uptime: '3m',
      lastCheckAt: '2026-07-03T03:27:00.000Z',
      summary: 'Secrets Broker runtime health.',
    },
    endpoints: [],
    metadata: {
      serviceType: 'core',
      runtime: 'service-lasso',
      version: '2026.7.3-test',
      build: 'test-build',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [],
    recentLogs: [],
    actions: [],
  } satisfies DashboardService
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Secrets Broker live client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('reads live broker source metadata by default', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const fetchMock = vi.fn(async (url: string) => {
      if (
        url === 'http://runtime.test/api/dashboard/services/%40secretsbroker'
      ) {
        return jsonResponse({ service: service() })
      }

      if (
        url ===
        'http://runtime.test/api/services/%40secretsbroker/proxy/v1/sources/status'
      ) {
        return jsonResponse({
          state: 'ready',
          summary: 'Broker metadata available.',
          capabilities: {
            managementSecrets: true,
            providerConfig: true,
            reveal: false,
          },
          telemetry: { available: true },
          audit: { available: true },
          sources: [
            {
              id: '@secretsbroker/local/default',
              label: 'Local encrypted store',
              provider: 'local',
              state: 'ready',
              reason: 'Local encrypted store is unlocked.',
              capabilities: { dryRun: true },
            },
          ],
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const { fetchSecretsBrokerOverview } = await import('./client')

    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('ready')
    expect(overview.stubMode).toBe(false)
    expect(overview.sourceCount).toBe(1)
    expect(overview.capabilities).toMatchObject({
      sourcesStatus: true,
      managementSecrets: true,
      providerConfig: true,
      reveal: false,
    })
    expect(overview.telemetryAvailable).toBe(true)
    expect(overview.auditAvailable).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('uses deterministic fixture metadata only when explicit stub mode is enabled', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'true')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { fetchSecretsBrokerOverview } = await import('./client')

    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('ready')
    expect(overview.stubMode).toBe(true)
    expect(overview.sources[0]?.id).toBe('@secretsbroker/local/default')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports unavailable when Service Lasso cannot return @secretsbroker metadata', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'offline' }, { status: 503 }))
    )

    const { fetchSecretsBrokerOverview } = await import('./client')

    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('unavailable')
    expect(overview.summary).toMatch(/runtime service metadata/i)
    expect(overview.stubMode).toBe(false)
  })

  it('fails closed as unsupported when the broker source route is missing', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const fetchMock = vi.fn(async (url: string) => {
      if (
        url === 'http://runtime.test/api/dashboard/services/%40secretsbroker'
      ) {
        return jsonResponse({ service: service() })
      }

      if (
        url ===
        'http://runtime.test/api/services/%40secretsbroker/proxy/v1/sources/status'
      ) {
        return jsonResponse({ detail: 'not found' }, { status: 404 })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const { fetchSecretsBrokerOverview } = await import('./client')

    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('unsupported')
    expect(overview.capabilities.sourcesStatus).toBe(false)
    expect(overview.summary).toMatch(/not exposed/i)
  })

  it.each([
    ['locked', 'locked'],
    ['auth_required', 'auth-required'],
    ['policy_denied', 'policy-denied'],
    ['degraded', 'degraded'],
    ['unconfigured', 'setup-needed'],
  ])(
    'maps source state %s into overview state %s',
    async (sourceState, expectedState) => {
      vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

      const fetchMock = vi.fn(async (url: string) => {
        if (
          url === 'http://runtime.test/api/dashboard/services/%40secretsbroker'
        ) {
          return jsonResponse({ service: service() })
        }

        if (
          url ===
          'http://runtime.test/api/services/%40secretsbroker/proxy/v1/sources/status'
        ) {
          return jsonResponse({
            status: 'ready',
            sources: [
              {
                id: '@secretsbroker/external/ops',
                provider: 'vault',
                state: sourceState,
              },
            ],
          })
        }

        throw new Error(`Unexpected URL: ${url}`)
      })

      vi.stubGlobal('fetch', fetchMock)

      const { fetchSecretsBrokerOverview } = await import('./client')

      const overview = await fetchSecretsBrokerOverview()

      expect(overview.state).toBe(expectedState)
      expect(overview.sources[0]?.state).toBe(expectedState)
    }
  )
})
