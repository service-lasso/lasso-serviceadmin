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

  it('reads metadata-only managed secret rows from the live broker route', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const fetchMock = vi.fn(async (url: string) => {
      if (
        url ===
        'http://runtime.test/api/services/%40secretsbroker/proxy/v1/management/secrets?search=session'
      ) {
        return jsonResponse({
          query: 'session',
          valueSearch: false,
          outcome: 'ready',
          results: [
            {
              ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
              name: 'SESSION_SIGNING_KEY',
              sourceId: 'local',
              providerKind: 'local-encrypted-store',
              ownerServiceId: '@serviceadmin',
              workspaceId: 'local',
              state: 'present',
              outcome: 'ready',
              capabilities: ['metadata', 'reveal', 'reset'],
              policy: 'local-writeback-policy',
              auditStatus: 'audit_available',
              valueSearch: 'supported',
              rawValue: 'DEMO_REVEAL_VALUE_42',
              providerToken: 'provider-token-must-not-render',
            },
          ],
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const { fetchSecretsBrokerManagedSecrets } = await import('./client')

    const result = await fetchSecretsBrokerManagedSecrets('session')

    expect(result).toMatchObject({
      state: 'ready',
      query: 'session',
      valueSearch: false,
      stubMode: false,
    })
    expect(result.results[0]).toMatchObject({
      ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
      name: 'SESSION_SIGNING_KEY',
      sourceId: 'local',
      providerKind: 'local-encrypted-store',
      ownerServiceId: '@serviceadmin',
      state: 'present',
      auditStatus: 'audit_available',
      valueSearch: 'supported',
    })
    expect(JSON.stringify(result)).not.toContain('DEMO_REVEAL_VALUE_42')
    expect(JSON.stringify(result)).not.toContain(
      'provider-token-must-not-render'
    )
  })

  it('does not request live managed secret rows in explicit stub mode', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'true')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { fetchSecretsBrokerManagedSecrets } = await import('./client')

    const result = await fetchSecretsBrokerManagedSecrets()

    expect(result.stubMode).toBe(true)
    expect(result.results).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits metadata-only live dry-run requests and sanitizes the response', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (
        url ===
        'http://runtime.test/api/services/%40secretsbroker/proxy/v1/management/secrets/reset/dry-run'
      ) {
        expect(init?.method).toBe('POST')
        expect(init?.body).toBeTypeOf('string')
        expect(JSON.parse(init?.body as string)).toEqual({
          requestId: 'req-reset-preview',
          serviceId: '@serviceadmin',
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          reason: 'operator requested reset preview',
          confirm: false,
        })

        return jsonResponse({
          requestId: 'req-reset-preview',
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          operation: 'reset',
          mode: 'dry-run',
          outcome: 'dry_run_ready',
          applied: false,
          requiresConfirmation: true,
          auditStatus: 'audit_ready',
          nextAction: 'confirm_and_apply_with_audit_reason',
          affectedRefs: ['services/@serviceadmin/runtime/SESSION_SIGNING_KEY'],
          affectedServices: ['@serviceadmin'],
          value: 'DEMO_REVEAL_VALUE_42',
          providerToken: 'provider-token-must-not-render',
          requestBody: { value: 'replacement-value-must-not-render' },
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const { fetchSecretsBrokerSecretDryRun } = await import('./client')

    const result = await fetchSecretsBrokerSecretDryRun({
      action: 'reset',
      ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
      serviceId: '@serviceadmin',
      reason: 'operator requested reset preview',
      requestId: 'req-reset-preview',
    })

    expect(result).toMatchObject({
      state: 'ready',
      requestId: 'req-reset-preview',
      operation: 'reset',
      mode: 'dry-run',
      outcome: 'dry_run_ready',
      applied: false,
      requiresConfirmation: true,
      auditStatus: 'audit_ready',
      nextAction: 'confirm_and_apply_with_audit_reason',
      stubMode: false,
    })
    expect(JSON.stringify(result)).not.toContain('DEMO_REVEAL_VALUE_42')
    expect(JSON.stringify(result)).not.toContain(
      'provider-token-must-not-render'
    )
    expect(JSON.stringify(result)).not.toContain(
      'replacement-value-must-not-render'
    )
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
