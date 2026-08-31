import { describe, expect, it } from 'vitest'
import {
  assertSafeTopologyRows,
  buildTopologyMappingRows,
  classifyBrokerValidationStatus,
  classifyLocalMappingStatus,
  filterTopologyMappingRows,
  topologyGraphFromRows,
  topologyNextAction,
} from './broker-topology-mapping'
import type { SecretManagementRecord } from './types'

function service(
  variables: Array<{
    key: string
    secret?: boolean
    source?: string
    value?: string
  }>
) {
  return {
    id: '@serviceadmin',
    name: 'Service Admin',
    environmentVariables: variables.map((variable) => ({
      key: variable.key,
      value: variable.value ?? 'redacted-not-used',
      scope: 'service' as const,
      secret: variable.secret,
      source: variable.source,
    })),
  }
}

function record(
  overrides: Partial<SecretManagementRecord> &
    Pick<SecretManagementRecord, 'ref' | 'name' | 'outcome'>
): SecretManagementRecord {
  return {
    sourceId: 'local',
    providerKind: 'local-encrypted-store',
    ownerServiceId: '@serviceadmin',
    state: 'present',
    capabilities: ['metadata'],
    ...overrides,
  }
}

describe('Broker topology mapping statuses', () => {
  it('keeps local mapped, unmapped, missing-source, and unknown without Broker metadata', () => {
    const rows = buildTopologyMappingRows({
      services: [
        service([
          {
            key: 'SESSION_SIGNING_KEY',
            secret: true,
            source: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          },
          { key: 'UNBOUND', secret: true },
          { key: 'PLAIN', secret: false, source: 'file' },
        ]),
      ],
      inventory: [],
      brokerMetadataAvailable: false,
    })
    expect(rows.map((row) => [row.variableKey, row.status])).toEqual([
      ['SESSION_SIGNING_KEY', 'mapped'],
      ['UNBOUND', 'missing-source'],
    ])
    expect(classifyLocalMappingStatus({ secret: false, source: 'file' })).toBe(
      'unmapped'
    )
    expect(classifyLocalMappingStatus({ secret: true, source: 'other' })).toBe(
      'unknown'
    )
  })

  it('joins Broker validation outcomes onto the same row model', () => {
    const rows = buildTopologyMappingRows({
      services: [
        service([
          {
            key: 'DENIED',
            secret: true,
            source: 'services/@serviceadmin/DENIED',
          },
          { key: 'AUTH', secret: true, source: 'services/@serviceadmin/AUTH' },
          {
            key: 'STALE',
            secret: true,
            source: 'services/@serviceadmin/STALE',
          },
          {
            key: 'FAILED',
            secret: true,
            source: 'services/@serviceadmin/FAILED',
          },
          {
            key: 'LOCKED',
            secret: true,
            source: 'services/@serviceadmin/LOCKED',
          },
          {
            key: 'AUDIT',
            secret: true,
            source: 'services/@serviceadmin/AUDIT',
          },
          {
            key: 'READY',
            secret: true,
            source: 'services/@serviceadmin/READY',
          },
          {
            key: 'ORPHAN',
            secret: true,
            source: 'services/@serviceadmin/ORPHAN',
          },
        ]),
      ],
      inventory: [
        record({
          ref: 'services/@serviceadmin/DENIED',
          name: 'DENIED',
          outcome: 'policy_denied',
        }),
        record({
          ref: 'services/@serviceadmin/AUTH',
          name: 'AUTH',
          outcome: 'source_auth_required',
        }),
        record({
          ref: 'services/@serviceadmin/STALE',
          name: 'STALE',
          outcome: 'stale',
        }),
        record({
          ref: 'services/@serviceadmin/FAILED',
          name: 'FAILED',
          outcome: 'validation_failed',
        }),
        record({
          ref: 'services/@serviceadmin/LOCKED',
          name: 'LOCKED',
          outcome: 'broker_locked',
        }),
        record({
          ref: 'services/@serviceadmin/AUDIT',
          name: 'AUDIT',
          outcome: 'ready',
          auditStatus: 'audit_unavailable',
        }),
        record({
          ref: 'services/@serviceadmin/READY',
          name: 'READY',
          outcome: 'ready',
          auditStatus: 'audit_recorded',
        }),
      ],
      brokerMetadataAvailable: true,
    })
    const byKey = Object.fromEntries(
      rows.map((row) => [row.variableKey, row.status])
    )
    expect(byKey).toMatchObject({
      DENIED: 'policy-denied',
      AUTH: 'source-auth-required',
      STALE: 'stale',
      FAILED: 'validation-failed',
      LOCKED: 'broker-locked',
      AUDIT: 'audit-unavailable',
      READY: 'mapped',
      ORPHAN: 'unmapped',
    })
    expect(rows.every((row) => row.nextAction.length > 0)).toBe(true)
  })

  it('filters statuses and returns no rows for a no-match search', () => {
    const rows = buildTopologyMappingRows({
      services: [
        service([
          {
            key: 'SESSION_SIGNING_KEY',
            secret: true,
            source: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          },
        ]),
      ],
      inventory: [
        record({
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          name: 'SESSION_SIGNING_KEY',
          outcome: 'ready',
        }),
      ],
      brokerMetadataAvailable: true,
    })
    expect(
      filterTopologyMappingRows(rows, { status: 'policy-denied' })
    ).toHaveLength(0)
    expect(filterTopologyMappingRows(rows, { query: 'no-such-ref' })).toEqual(
      []
    )
    expect(
      filterTopologyMappingRows(rows, { query: 'session_signing_key' })
    ).toHaveLength(1)
  })

  it('never keeps raw secret or provider material on mapping rows', () => {
    const rows = buildTopologyMappingRows({
      services: [
        service([
          {
            key: 'SESSION_SIGNING_KEY',
            secret: true,
            source: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
            value: 'raw-secret-value',
          },
        ]),
      ],
      inventory: [
        record({
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          name: 'SESSION_SIGNING_KEY',
          outcome: 'ready',
        }),
      ],
      brokerMetadataAvailable: true,
    })
    expect(() => assertSafeTopologyRows(rows)).not.toThrow()
    const serialized = JSON.stringify(rows)
    expect(serialized).not.toContain('raw-secret-value')
    expect(serialized).not.toContain('masterKey')
    expect(serialized).not.toContain('recoveryShare')
    expect(topologyNextAction('unknown')).toMatch(/not certain/i)
    expect(classifyBrokerValidationStatus({ outcome: 'ready' })).toBe('mapped')
  })

  it('derives graph nodes and edges from the same mapping rows as the table', () => {
    const rows = buildTopologyMappingRows({
      services: [
        service([
          {
            key: 'SESSION_SIGNING_KEY',
            secret: true,
            source: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          },
        ]),
      ],
      inventory: [
        record({
          ref: 'services/@serviceadmin/runtime/SESSION_SIGNING_KEY',
          name: 'SESSION_SIGNING_KEY',
          outcome: 'ready',
        }),
      ],
      brokerMetadataAvailable: true,
    })
    const graph = topologyGraphFromRows(rows)
    expect(graph.edges.map((edge) => edge.id)).toEqual(
      rows.map((row) => row.id)
    )
    expect(graph.nodes.some((node) => node.kind === 'service')).toBe(true)
    expect(graph.nodes.some((node) => node.kind === 'ref')).toBe(true)
  })
})
