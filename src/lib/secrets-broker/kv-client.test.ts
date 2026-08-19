import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SecretsBrokerOverview } from './client'
import {
  KvRequestError,
  kvSourceOptions,
  listKvKeys,
  readKvData,
  writeKvData,
} from './kv-client'

afterEach(() => {
  vi.unstubAllGlobals()
})

function overviewWithOpenBao(): SecretsBrokerOverview {
  return {
    state: 'ready',
    summary: 'ready',
    service: null,
    checkedAt: '2026-08-18T00:00:00.000Z',
    sourceCount: 2,
    sources: [
      {
        id: 'local',
        label: 'Local encrypted store',
        provider: 'local',
        state: 'ready',
        reason: '',
        lifecycleState: 'connected',
        outcome: 'ready',
        nextAction: '',
        enabled: true,
        critical: true,
        priority: 0,
        namespaces: ['*'],
        capabilityNames: [],
        capabilities: {},
        operations: [],
      },
      {
        id: 'openbao-dev',
        label: 'OpenBao dev',
        provider: 'openbao',
        state: 'ready',
        reason: '',
        lifecycleState: 'connected',
        outcome: 'ready',
        nextAction: '',
        enabled: true,
        critical: false,
        priority: 50,
        namespaces: ['*'],
        capabilityNames: [],
        capabilities: {},
        operations: [],
      },
    ],
    capabilities: {},
    telemetryAvailable: false,
    auditAvailable: true,
    apiVersion: '',
    contractVersion: '',
    brokerVersion: '',
    brokerState: 'ready',
    outcome: 'ready',
    nextAction: '',
    brokerOutcome: 'ready',
    brokerNextAction: '',
    contractCompatibility: {
      state: 'compatible',
      observedVersion: '1.0.0',
      supportedRange: '>=1.0.0 <2.0.0',
      reason: '',
      nextAction: '',
    },
    manifestVersion: '',
    operationManifest: {
      state: 'ready',
      observedVersion: '1.0.0',
      reason: '',
      nextAction: '',
    },
    operations: [],
    endpointCapabilities: [],
    featureCapabilities: [],
    providerCapabilities: [],
    providers: [],
    routes: {
      status: 'ready',
      state: 'ready',
      capabilities: 'ready',
      sources: 'ready',
      providerCapabilities: 'ready',
      providerConfig: 'ready',
      telemetry: 'unavailable',
      events: 'unavailable',
    },
    stubMode: false,
  }
}

describe('KV client', () => {
  it('lists OpenBao sources next to the local store', () => {
    const sources = kvSourceOptions(overviewWithOpenBao())
    expect(sources.map((source) => source.id)).toEqual(['local', 'openbao-dev'])
    expect(sources[1]?.kind).toBe('openbao')
  })

  it('lists keys without leaking values and treats 404 as empty', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain('/proxy/v1/kv/metadata/?source=local&list=true')
      return new Response(
        JSON.stringify({
          data: { keys: ['apps/', 'other'] },
          password: 'kv-sentinel-alpha',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const listed = await listKvKeys('')
    expect(listed.keys).toEqual(['apps/', 'other'])
    expect(listed.keys.join(' ')).not.toContain('kv-sentinel-alpha')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(JSON.stringify({ errors: ['no keys found'] }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      })
    )
    const empty = await listKvKeys('missing')
    expect(empty).toEqual({ keys: [], missing: true })
  })

  it('reads and writes OpenBao KV v2 envelopes', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (
        url.includes('/kv/data/apps/db') &&
        (!init?.method || init.method === 'GET')
      ) {
        return new Response(
          JSON.stringify({
            data: {
              data: { password: 'kv-sentinel-alpha' },
              metadata: {
                version: 2,
                created_time: '2026-08-18T00:00:00Z',
                deletion_time: '',
                destroyed: false,
              },
            },
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }
      expect(init?.method).toBe('POST')
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        data: Record<string, string>
        options?: { cas: number }
      }
      expect(body.data.password).toBe('kv-sentinel-alpha')
      expect(body.options).toEqual({ cas: 1 })
      return new Response(
        JSON.stringify({
          data: {
            version: 2,
            created_time: '2026-08-18T00:00:00Z',
            deletion_time: '',
            destroyed: false,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const current = await readKvData('apps/db', {
      source: 'openbao-dev',
      reason: 'incident review for db credentials',
    })
    expect(current.fields.password).toBe('kv-sentinel-alpha')
    expect(current.version).toBe(2)
    const readInit = fetchMock.mock.calls[0]?.[1]
    expect(readInit?.headers).toEqual({
      'X-Secretsbroker-Audit-Reason': 'incident review for db credentials',
    })

    const written = await writeKvData(
      'apps/db',
      { password: 'kv-sentinel-alpha' },
      1,
      { source: 'openbao-dev' }
    )
    expect(written.version).toBe(2)
  })

  it('surfaces OpenBao CAS errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            errors: [
              'check-and-set parameter did not match the current version',
            ],
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      })
    )
    await expect(
      writeKvData('apps/db', { password: 'x' }, 0)
    ).rejects.toBeInstanceOf(KvRequestError)
  })
})
