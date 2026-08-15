import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function runtimeClient() {
  vi.stubEnv('VITE_SERVICE_LASSO_ENABLE_STUB_DATA', 'false')
  vi.stubEnv('VITE_SERVICE_LASSO_API_BASE_URL', 'http://runtime.test')
  return import('./stub')
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const telemetry = {
  serviceId: '@secretsbroker',
  apiVersion: 'secretsbroker.local/v1',
  contractVersion: 'service-lasso.secretsbroker.telemetry-preview.v1',
  outcome: 'ready',
  generatedAt: '2026-08-14T00:00:00Z',
  counters: {
    operations: [
      { operation: 'management_reveal', outcome: 'ready', count: 2 },
    ],
    policyDecisions: [{ outcome: 'allowed', count: 2 }],
    localApiAuthFailures: 1,
    activeLockouts: 0,
    providerStates: [
      { id: 'vault-safe', state: 'ready', outcome: 'ready', count: 1 },
    ],
    sourceStates: [],
    auditRecords: [
      { auditStatus: 'audit_recorded', outcome: 'ready', count: 2 },
    ],
  },
  safety: { lowCardinalityLabels: true, valueMaterialIncluded: false },
}

const events = {
  serviceId: '@secretsbroker',
  apiVersion: 'secretsbroker.local/v1',
  outcome: 'ready',
  generatedAt: '2026-08-14T00:00:00Z',
  limit: 25,
  nextCursor: '25',
  events: [
    {
      id: '2026-08-14T00:00:00Z:auth_failure:local_api_auth:denied:safehash',
      ts: '2026-08-14T00:00:00Z',
      family: 'auth_failure',
      severity: 'warning',
      operation: 'local_api_auth',
      serviceId: '@secretsbroker',
      outcome: 'denied',
      requestId: 'request-safe',
    },
  ],
  safety: {
    metadataOnly: true,
    rawRefIncluded: false,
    valueMaterialIncluded: false,
  },
}

describe('Secrets Broker operational contracts', () => {
  it('loads safe telemetry and bounded event filters through canonical Core routes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(telemetry))
      .mockResolvedValueOnce(jsonResponse(events))
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()

    const telemetryResult = await client.fetchBrokerTelemetry()
    const eventResult = await client.fetchBrokerEvents({
      severity: 'warning',
      family: 'auth_failure',
      limit: 25,
      cursor: '0',
    })

    expect(telemetryResult.counters.operations[0]?.count).toBe(2)
    expect(telemetryResult.safety.valueMaterialIncluded).toBe(false)
    expect(eventResult.events[0]?.operation).toBe('local_api_auth')
    expect(eventResult.safety.rawRefIncluded).toBe(false)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://runtime.test/api/services/%40secretsbroker/operations/telemetry'
    )
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'http://runtime.test/api/services/%40secretsbroker/operations/events?severity=warning&family=auth_failure&limit=25&cursor=0'
    )
  })

  it('requires exact confirmation locally and sends only scope and audit reason to lockout clearing', async () => {
    const windowsNamedPipeScope =
      'local_api:\\\\.\\pipe\\service-lasso-secretsbroker-safe'
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        serviceId: '@secretsbroker',
        apiVersion: 'secretsbroker.local/v1',
        requestId: 'request-safe',
        operation: 'lockout_clear',
        outcome: 'cleared',
        cleared: true,
        lockoutScope: windowsNamedPipeScope,
        auditStatus: 'audit_recorded',
        nextAction: 'retry_operation',
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = await runtimeClient()

    const result = await client.clearBrokerLockout({
      scope: windowsNamedPipeScope,
      reason: 'verified operator recovery',
    })

    expect(result.cleared).toBe(true)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://runtime.test/api/services/%40secretsbroker/secrets/lockouts/clear'
    )
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(init.body))).toEqual({
      scope: windowsNamedPipeScope,
      reason: 'verified operator recovery',
      confirm: true,
    })
  })

  it('rejects secret-bearing or weakened safety metadata', async () => {
    const client = await runtimeClient()
    expect(() =>
      client.normalizeBrokerTelemetry({
        ...telemetry,
        nested: { secretValue: 'must-not-cross' },
      })
    ).toThrow(/credential-bearing/i)
    expect(() =>
      client.normalizeBrokerEvents({
        ...events,
        safety: { ...events.safety, rawRefIncluded: true },
      })
    ).toThrow(/metadata-only contract/i)
  })
})
