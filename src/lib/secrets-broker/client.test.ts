import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import contractFixtures from './fixtures/contract-states.json'

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

type ContractFixtureCase = {
  name: string
  expectedResponse: Record<string, unknown>
}

function contractResponse(name: string) {
  const fixture = (contractFixtures.cases as ContractFixtureCase[]).find(
    (item) => item.name === name
  )

  if (!fixture) throw new Error(`Missing Broker contract fixture: ${name}`)
  return structuredClone(fixture.expectedResponse)
}

function overviewFetch(options?: {
  sourceStatus?: number
  sourceLifecycle?: { state: string; outcome?: string }
  contractVersion?: unknown
  manifestVersion?: unknown
  omitOperations?: boolean
  sourceKind?: string
  sourceCapabilities?: string[]
  sourceOperationMaturities?: Record<string, string>
  operationMaturities?: Record<string, string>
}) {
  const capabilities = contractResponse('capabilities-operation-manifest')
  const contractVersion =
    options && Object.prototype.hasOwnProperty.call(options, 'contractVersion')
      ? options.contractVersion
      : capabilities.contractVersion
  const manifestVersion =
    options && Object.prototype.hasOwnProperty.call(options, 'manifestVersion')
      ? options.manifestVersion
      : capabilities.manifestVersion

  return vi.fn(async (url: string) => {
    if (url === 'http://runtime.test/api/dashboard/services/%40secretsbroker') {
      return jsonResponse({ service: service() })
    }

    const prefix = 'http://runtime.test/api/services/%40secretsbroker/proxy'

    if (url === `${prefix}/status`) {
      return jsonResponse({
        serviceId: '@secretsbroker',
        apiVersion: 'secretsbroker.local/v1',
        version: '0.1.0',
        state: 'ready',
        ready: true,
        checkedAt: '2026-07-18T02:00:00Z',
        description: 'Local-first secret metadata broker.',
      })
    }

    if (url === `${prefix}/state`) {
      return jsonResponse(contractResponse('state-ready'))
    }

    if (url === `${prefix}/capabilities`) {
      capabilities.contractVersion = contractVersion
      capabilities.manifestVersion = manifestVersion
      if (
        options?.operationMaturities &&
        Array.isArray(capabilities.operations)
      ) {
        capabilities.operations = (
          capabilities.operations as Record<string, unknown>[]
        ).map((operation) => ({
          ...operation,
          maturity:
            options.operationMaturities?.[operation.path as string] ??
            operation.maturity,
        }))
      }
      if (options?.omitOperations) delete capabilities.operations
      return jsonResponse(capabilities)
    }

    if (url === `${prefix}/v1/sources/status`) {
      if (options?.sourceStatus) {
        return jsonResponse(
          { detail: 'not found' },
          { status: options.sourceStatus }
        )
      }

      const payload = contractResponse('source-local-ready')
      const source = (payload.sources as Record<string, unknown>[])[0]
      if (source && options?.sourceKind) {
        source.kind = options.sourceKind
        source.capabilities = options.sourceCapabilities ?? source.capabilities
        source.operations = (
          source.operations as Record<string, unknown>[]
        ).map((operation) => ({
          ...operation,
          maturity:
            options.sourceOperationMaturities?.[operation.path as string] ??
            operation.maturity,
          providerKinds: [options.sourceKind],
        }))
      }
      if (options?.sourceLifecycle) {
        if (source) {
          source.state = options.sourceLifecycle.state
          source.outcome =
            options.sourceLifecycle.outcome ?? options.sourceLifecycle.state
          source.lifecycle = {
            state: options.sourceLifecycle.state,
            outcome:
              options.sourceLifecycle.outcome ?? options.sourceLifecycle.state,
            retryable: false,
          }
          if (options.sourceLifecycle.outcome !== 'ready') {
            source.operations = (
              source.operations as Record<string, unknown>[]
            ).map((operation) =>
              operation.maturity === 'planned' ||
              operation.maturity === 'unavailable'
                ? operation
                : {
                    ...operation,
                    maturity: 'unavailable',
                    limitationCode:
                      options.sourceLifecycle?.outcome ??
                      options.sourceLifecycle?.state,
                    reasonCode: 'source_operation_blocked',
                    nextAction: 'inspect_source_status',
                  }
            )
          }
        }
      }
      return jsonResponse(payload)
    }

    if (url === `${prefix}/v1/providers/capabilities`) {
      const source = (
        contractResponse('source-local-ready').sources as Record<
          string,
          unknown
        >[]
      )[0]
      return jsonResponse({
        serviceId: '@secretsbroker',
        apiVersion: 'secretsbroker.local/v1',
        contractVersion,
        manifestVersion,
        outcome: 'ready',
        capabilities: [
          {
            providerKind: 'local-encrypted-store',
            displayName: 'Local encrypted store',
            supported: true,
            capabilities: ['read', 'reveal', 'write/update'],
            operations: source?.operations,
            limitations: ['local-first development backend'],
          },
        ],
      })
    }

    if (url === `${prefix}/v1/providers/config/status`) {
      const provider = {
        providerId: 'local',
        providerKind: 'local-encrypted-store',
        displayName: 'Local encrypted store',
        state: 'connected',
        outcome: 'ready',
        namespaces: ['*'],
        capabilities: ['read', 'reveal', 'write/update'],
        operations: (
          contractResponse('source-local-ready').sources as Record<
            string,
            unknown
          >[]
        )[0]?.operations,
        auditStatus: 'audit_available',
      }
      return jsonResponse({
        serviceId: '@secretsbroker',
        apiVersion: 'secretsbroker.local/v1',
        contractVersion,
        manifestVersion,
        outcome: 'ready',
        currentProvider: provider,
        providers: [provider],
      })
    }

    if (url === `${prefix}/v1/telemetry`) {
      return jsonResponse({
        serviceId: '@secretsbroker',
        apiVersion: 'secretsbroker.local/v1',
        contractVersion,
        outcome: 'ready',
      })
    }

    if (url === `${prefix}/v1/events?limit=1`) {
      return jsonResponse(contractResponse('events-empty-safe'))
    }

    throw new Error(`Unexpected URL: ${url}`)
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
    const fetchMock = overviewFetch()

    vi.stubGlobal('fetch', fetchMock)

    const { fetchSecretsBrokerOverview } = await import('./client')

    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('ready')
    expect(overview.stubMode).toBe(false)
    expect(overview.sourceCount).toBe(1)
    expect(overview.sources[0]).toMatchObject({
      id: 'local',
      label: 'Local encrypted store',
      provider: 'local-encrypted-store',
      lifecycleState: 'connected',
      outcome: 'ready',
      state: 'ready',
      capabilityNames: [
        'read',
        'reveal',
        'write/update',
        'rotate/reset',
        'audit',
        'migration',
        'health',
      ],
    })
    expect(overview.capabilities).toMatchObject({
      sourcesStatus: true,
      managementSecrets: true,
      providerConfig: false,
      reveal: true,
      mutation: true,
    })
    expect(overview.contractVersion).toBe('1.1.0')
    expect(overview.manifestVersion).toBe('1.0.0')
    expect(overview.operationManifest.state).toBe('ready')
    expect(overview.operations.length).toBeGreaterThan(0)
    expect(overview.routes).toEqual(
      expect.objectContaining({
        state: 'ready',
        sources: 'ready',
        providerConfig: 'ready',
      })
    )
    expect(overview.providerCapabilities[0]?.limitations).toEqual([
      'local-first development backend',
    ])
    expect(overview.telemetryAvailable).toBe(true)
    expect(overview.auditAvailable).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(9)
  })

  it.each([
    ['1.0.0', 'compatible', ''],
    ['1.99.0', 'compatible', ''],
    ['1.2.3-beta.1+build.2', 'compatible', ''],
    [null, 'missing', 'upgrade_secrets_broker'],
    ['', 'missing', 'upgrade_secrets_broker'],
    ['v1', 'malformed', 'repair_or_upgrade_secrets_broker'],
    ['1.0', 'malformed', 'repair_or_upgrade_secrets_broker'],
    ['1.0.0-01', 'malformed', 'repair_or_upgrade_secrets_broker'],
    ['0.9.0', 'unsupported', 'upgrade_secrets_broker'],
    ['2.0.0', 'unsupported', 'upgrade_service_admin'],
  ])(
    'assesses Broker contract version %j as %s',
    async (version, expectedState, expectedNextAction) => {
      const { assessSecretsBrokerContractCompatibility } =
        await import('./client')

      expect(assessSecretsBrokerContractCompatibility(version)).toMatchObject({
        state: expectedState,
        observedVersion: typeof version === 'string' ? version : '',
        supportedRange: '>=1.0.0 <2.0.0',
        nextAction: expectedNextAction,
      })
    }
  )

  it('accepts additive compatible 1.x Broker contracts', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal('fetch', overviewFetch({ contractVersion: '1.99.0' }))

    const { fetchSecretsBrokerOverview } = await import('./client')
    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('ready')
    expect(overview.contractCompatibility.state).toBe('compatible')
    expect(overview.capabilities).toMatchObject({
      sourcesStatus: true,
      managementSecrets: true,
      providerConfig: false,
      reveal: true,
      mutation: true,
    })
  })

  it('fails closed when a manifest-bearing Broker omits operation records', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal('fetch', overviewFetch({ omitOperations: true }))

    const { fetchSecretsBrokerOverview } = await import('./client')
    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('unsupported')
    expect(overview.operationManifest.state).toBe('malformed')
    expect(overview.nextAction).toBe('repair_or_upgrade_secrets_broker')
    expect(Object.values(overview.capabilities).every((value) => !value)).toBe(
      true
    )
  })

  it('does not treat legacy remote mutation names as executable operations', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal(
      'fetch',
      overviewFetch({
        sourceKind: 'vault',
        sourceCapabilities: [
          'read',
          'reveal',
          'write/update',
          'rotate/reset',
          'policy',
        ],
        sourceOperationMaturities: {
          '/v1/management/secrets/edit/apply': 'unavailable',
          '/v1/management/secrets/reset/apply': 'unavailable',
          '/v1/management/secrets/policy/apply': 'planned',
        },
      })
    )

    const { fetchSecretsBrokerOverview } = await import('./client')
    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('ready')
    expect(overview.sources[0]?.capabilityNames).toEqual(
      expect.arrayContaining(['write/update', 'rotate/reset', 'policy'])
    )
    expect(overview.sources[0]?.capabilities).toMatchObject({
      reveal: true,
      mutation: false,
      write: false,
      reset: false,
      policy: false,
    })
    expect(overview.capabilities.mutation).toBe(false)
  })

  it('preserves an unknown operation maturity for diagnostics and blocks that action', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal(
      'fetch',
      overviewFetch({
        operationMaturities: {
          '/v1/management/secrets/edit/apply': 'future-executable-mode',
          '/v1/management/secrets/reset/apply': 'future-executable-mode',
          '/v1/management/secrets/policy/apply': 'future-executable-mode',
        },
      })
    )

    const { fetchSecretsBrokerOverview } = await import('./client')
    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('ready')
    expect(overview.operationManifest.state).toBe('ready')
    expect(overview.capabilities.mutation).toBe(false)
    expect(
      overview.operations.find(
        (operation) => operation.path === '/v1/management/secrets/edit/apply'
      )
    ).toMatchObject({
      maturity: 'unknown',
      rawMaturity: 'future-executable-mode',
      valid: false,
    })
  })

  it('fails closed and preserves diagnostics for a newer incompatible Broker contract', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal('fetch', overviewFetch({ contractVersion: '2.0.0' }))

    const { fetchSecretsBrokerOverview } = await import('./client')
    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('unsupported')
    expect(overview.outcome).toBe('unsupported')
    expect(overview.nextAction).toBe('upgrade_service_admin')
    expect(overview.brokerOutcome).toBe('ready')
    expect(overview.contractCompatibility).toMatchObject({
      state: 'unsupported',
      observedVersion: '2.0.0',
      nextAction: 'upgrade_service_admin',
    })
    expect(Object.values(overview.capabilities)).toEqual(
      expect.arrayContaining([false])
    )
    expect(Object.values(overview.capabilities).every((value) => !value)).toBe(
      true
    )
    expect(overview.sources[0]?.capabilityNames).toContain('reveal')
    expect(overview.sources[0]?.capabilities).toMatchObject({
      reveal: false,
      mutation: false,
    })
    expect(overview.telemetryAvailable).toBe(false)
    expect(overview.auditAvailable).toBe(false)
    expect(overview.routes.capabilities).toBe('ready')
    expect(overview.summary).toMatch(/not supported/i)
    expect(overview.summary).toMatch(/upgrade_service_admin/i)
  })

  it('fails closed when the Broker omits its contract version', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
    vi.stubGlobal('fetch', overviewFetch({ contractVersion: null }))

    const { fetchSecretsBrokerOverview } = await import('./client')
    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('unsupported')
    expect(overview.contractCompatibility.state).toBe('missing')
    expect(overview.nextAction).toBe('upgrade_secrets_broker')
    expect(Object.values(overview.capabilities).every((value) => !value)).toBe(
      true
    )
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

  it('reads metadata-only audit event rows from the live broker route', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (
          url ===
          'http://runtime.test/api/services/%40secretsbroker/proxy/v1/audit/events'
        ) {
          return jsonResponse({
            state: 'ready',
            summary: 'Live audit metadata available.',
            rawMaterialReturned: false,
            events: [
              {
                id: 'audit-live-1',
                eventType: 'secret_rotated',
                actorType: 'operator',
                actorId: 'serviceadmin',
                outcome: 'success',
                policyDecision: 'allow: rotation policy matched',
                chainStatus: 'verified',
                recordedAt: '2026-07-05T06:31:00Z',
                summary: 'Secret rotation metadata recorded.',
                rawValue: 'DEMO_REVEAL_VALUE_42',
                providerToken: 'provider-token-must-not-render',
              },
            ],
          })
        }

        throw new Error(`Unexpected URL: ${url}`)
      })
    )

    const { fetchSecretsBrokerAuditEvents } = await import('./client')

    const result = await fetchSecretsBrokerAuditEvents()

    expect(result).toMatchObject({
      state: 'ready',
      summary: 'Live audit metadata available.',
      rawMaterialReturned: false,
      stubMode: false,
    })
    expect(result.events[0]).toMatchObject({
      id: 'audit-live-1',
      event: 'secret_rotated',
      actorType: 'operator',
      actorId: 'serviceadmin',
      outcome: 'success',
      policyDecision: 'allow: rotation policy matched',
      tamperEvidence: 'verified',
      recordedAt: '2026-07-05T06:31:00Z',
      summary: 'Secret rotation metadata recorded.',
    })
    expect(JSON.stringify(result)).not.toContain('DEMO_REVEAL_VALUE_42')
    expect(JSON.stringify(result)).not.toContain(
      'provider-token-must-not-render'
    )
  })

  it('does not request live audit rows in explicit stub mode', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'true')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { fetchSecretsBrokerAuditEvents } = await import('./client')

    const result = await fetchSecretsBrokerAuditEvents()

    expect(result.stubMode).toBe(true)
    expect(result.events).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['locked', 'locked'],
    ['auth_required', 'auth-required'],
    ['policy_denied', 'policy-denied'],
    ['unsupported', 'unsupported'],
    ['audit_unavailable', 'audit-unavailable'],
    ['unconfigured', 'setup-needed'],
  ])(
    'maps managed secrets list outcome %s into typed state %s',
    async (outcome, expectedState) => {
      vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (
            url ===
            'http://runtime.test/api/services/%40secretsbroker/proxy/v1/management/secrets'
          ) {
            return jsonResponse({
              outcome,
              summary: 'Broker returned a typed management-list state.',
              results: [
                {
                  ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
                  rawValue: 'DEMO_REVEAL_VALUE_42',
                  providerToken: 'provider-token-must-not-render',
                },
              ],
            })
          }

          throw new Error(`Unexpected URL: ${url}`)
        })
      )

      const { fetchSecretsBrokerManagedSecrets } = await import('./client')

      const result = await fetchSecretsBrokerManagedSecrets()

      expect(result.state).toBe(expectedState)
      expect(result.summary).toBe(
        'Broker returned a typed management-list state.'
      )
      expect(JSON.stringify(result)).not.toContain('DEMO_REVEAL_VALUE_42')
      expect(JSON.stringify(result)).not.toContain(
        'provider-token-must-not-render'
      )
    }
  )

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

  it('reads metadata-only operation status by operation id and sanitizes the response', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const fetchMock = vi.fn(async (url: string) => {
      if (
        url ===
        'http://runtime.test/api/services/%40secretsbroker/proxy/v1/management/secret-operations/op-live-reset'
      ) {
        return jsonResponse({
          operationId: 'op-live-reset',
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          operation: 'reset',
          status: 'succeeded',
          outcome: 'applied',
          terminal: true,
          retrySafe: false,
          auditStatus: 'audit_recorded',
          correlationId: 'corr-live-reset',
          nextAction: 'review_audit_metadata',
          value: 'DEMO_REVEAL_VALUE_42',
          providerToken: 'provider-token-must-not-render',
          responseBody: { value: 'replacement-value-must-not-render' },
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const { fetchSecretsBrokerSecretOperationStatus } = await import('./client')

    const result =
      await fetchSecretsBrokerSecretOperationStatus('op-live-reset')

    expect(result).toMatchObject({
      state: 'ready',
      operationId: 'op-live-reset',
      operation: 'reset',
      status: 'succeeded',
      outcome: 'applied',
      terminal: true,
      retrySafe: false,
      auditStatus: 'audit_recorded',
      correlationId: 'corr-live-reset',
      nextAction: 'review_audit_metadata',
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

  it.each([
    ['locked', 'locked'],
    ['source_auth_required', 'auth-required'],
    ['policy_denied', 'policy-denied'],
    ['unsupported', 'unsupported'],
    ['audit_unavailable', 'audit-unavailable'],
  ])(
    'preserves blocked operation outcomes as typed state for %s',
    async (outcome, expectedState) => {
      vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

      const fetchMock = vi.fn(async (url: string) => {
        if (
          url ===
          'http://runtime.test/api/services/%40secretsbroker/proxy/v1/management/secret-operations/op-live-blocked'
        ) {
          return jsonResponse({
            operationId: 'op-live-blocked',
            ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
            operation: 'reset',
            status: 'failed',
            outcome,
            terminal: true,
            retrySafe: false,
            auditStatus:
              outcome === 'audit_unavailable'
                ? 'audit_unavailable'
                : 'audit_recorded',
            correlationId: 'corr-live-blocked',
            nextAction: 'inspect_safe_blocker_metadata',
            rawValue: 'DEMO_REVEAL_VALUE_42',
            providerToken: 'provider-token-must-not-render',
          })
        }

        throw new Error(`Unexpected URL: ${url}`)
      })

      vi.stubGlobal('fetch', fetchMock)

      const { fetchSecretsBrokerSecretOperationStatus } =
        await import('./client')

      const result =
        await fetchSecretsBrokerSecretOperationStatus('op-live-blocked')

      expect(result).toMatchObject({
        state: expectedState,
        operationId: 'op-live-blocked',
        status: 'failed',
        outcome,
        terminal: true,
        nextAction: 'inspect_safe_blocker_metadata',
        stubMode: false,
      })
      expect(JSON.stringify(result)).not.toContain('DEMO_REVEAL_VALUE_42')
      expect(JSON.stringify(result)).not.toContain(
        'provider-token-must-not-render'
      )
    }
  )

  it('submits metadata-only live apply requests and sanitizes the response', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (
        url ===
        'http://runtime.test/api/services/%40secretsbroker/proxy/v1/management/secrets/reset/apply'
      ) {
        expect(init?.method).toBe('POST')
        expect(init?.body).toBeTypeOf('string')
        expect(JSON.parse(init?.body as string)).toEqual({
          requestId: 'req-reset-apply',
          serviceId: '@serviceadmin',
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          operationId: 'op-live-reset',
          reason: 'operator approved reset after dry-run',
          confirm: true,
        })

        return jsonResponse({
          operationId: 'op-live-reset',
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          operation: 'reset',
          status: 'submitted',
          outcome: 'pending',
          terminal: false,
          retrySafe: false,
          auditStatus: 'audit_recorded',
          correlationId: 'corr-live-apply',
          nextAction: 'poll_operation_status',
          rawValue: 'DEMO_REVEAL_VALUE_42',
          providerToken: 'provider-token-must-not-render',
          requestBody: { value: 'replacement-value-must-not-render' },
          responseBody: { value: 'replacement-value-must-not-render' },
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const { submitSecretsBrokerSecretApply } = await import('./client')

    const result = await submitSecretsBrokerSecretApply({
      action: 'reset',
      ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
      operationId: 'op-live-reset',
      serviceId: '@serviceadmin',
      reason: 'operator approved reset after dry-run',
      requestId: 'req-reset-apply',
    })

    expect(result).toMatchObject({
      state: 'loading',
      operationId: 'op-live-reset',
      operation: 'reset',
      status: 'submitted',
      outcome: 'pending',
      terminal: false,
      retrySafe: false,
      auditStatus: 'audit_recorded',
      correlationId: 'corr-live-apply',
      nextAction: 'poll_operation_status',
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

  it('submits live controlled reveal requests and discards returned values', async () => {
    vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (
        url ===
        'http://runtime.test/api/services/%40secretsbroker/proxy/v1/management/secrets/reveal'
      ) {
        expect(init?.method).toBe('POST')
        expect(init?.body).toBeTypeOf('string')
        expect(JSON.parse(init?.body as string)).toEqual({
          requestId: 'req-live-reveal',
          serviceId: '@serviceadmin',
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          reason: 'operator troubleshooting session issue',
        })

        return jsonResponse({
          requestId: 'req-live-reveal',
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          operation: 'reveal',
          mode: 'apply',
          outcome: 'ready',
          ttlSeconds: 60,
          auditStatus: 'audit_recorded',
          nextAction: 'close_reveal_window',
          affectedRefs: ['services/@serviceadmin/runtime/SESSION_SIGNING_KEY'],
          affectedServices: ['@serviceadmin'],
          value: 'DEMO_REVEAL_VALUE_42',
          providerToken: 'provider-token-must-not-render',
          metadata: { value: 'nested-value-must-not-render' },
        })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const { submitSecretsBrokerSecretReveal } = await import('./client')

    const result = await submitSecretsBrokerSecretReveal({
      ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
      serviceId: '@serviceadmin',
      reason: 'operator troubleshooting session issue',
      requestId: 'req-live-reveal',
    })

    expect(result).toMatchObject({
      state: 'ready',
      requestId: 'req-live-reveal',
      ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
      operation: 'reveal',
      mode: 'apply',
      outcome: 'ready',
      auditStatus: 'audit_recorded',
      nextAction: 'close_reveal_window',
      ttlSeconds: 60,
      valueStatus: 'discarded_by_service_admin_after_metadata_mapping',
      affectedRefs: ['services/@serviceadmin/runtime/SESSION_SIGNING_KEY'],
      affectedServices: ['@serviceadmin'],
      stubMode: false,
    })
    expect(JSON.stringify(result)).not.toContain('DEMO_REVEAL_VALUE_42')
    expect(JSON.stringify(result)).not.toContain(
      'provider-token-must-not-render'
    )
    expect(JSON.stringify(result)).not.toContain('nested-value-must-not-render')
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
    const fetchMock = overviewFetch({ sourceStatus: 404 })

    vi.stubGlobal('fetch', fetchMock)

    const { fetchSecretsBrokerOverview } = await import('./client')

    const overview = await fetchSecretsBrokerOverview()

    expect(overview.state).toBe('unsupported')
    expect(overview.capabilities.sourcesStatus).toBe(false)
    expect(overview.routes.sources).toBe('unsupported')
    expect(overview.summary).toMatch(/sources \(unsupported\)/i)
  })

  it.each([
    ['locked', 'locked', 'locked'],
    ['auth_required', 'source_auth_required', 'auth-required'],
    ['reconnect_required', 'source_auth_required', 'auth-required'],
    ['denied', 'policy_denied', 'policy-denied'],
    ['config_error', 'source_unavailable', 'degraded'],
    ['degraded', 'source_unavailable', 'degraded'],
    ['missing', 'setup_needed', 'setup-needed'],
    ['disabled', 'disabled', 'unsupported'],
  ])(
    'maps source lifecycle %s into overview state %s',
    async (sourceState, outcome, expectedState) => {
      vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
      const fetchMock = overviewFetch({
        sourceLifecycle: { state: sourceState, outcome },
      })

      vi.stubGlobal('fetch', fetchMock)

      const { fetchSecretsBrokerOverview } = await import('./client')

      const overview = await fetchSecretsBrokerOverview()

      expect(overview.state).toBe(expectedState)
      expect(overview.sources[0]?.state).toBe(expectedState)
      expect(overview.sources[0]?.lifecycleState).toBe(sourceState)
      expect(overview.sources[0]?.outcome).toBe(outcome)
    }
  )
})
