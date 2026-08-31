import { describe, expect, it } from 'vitest'
import {
  buildOperationalControlsExport,
  operationalSafetyFlagsAllowExport,
  summarizeActiveLockouts,
  summarizeEffectivePolicy,
} from './broker-operational-controls'
import type {
  BrokerEventsResult,
  BrokerTelemetry,
  SecretAccessPolicyGrant,
} from './types'

const telemetry: BrokerTelemetry = {
  serviceId: '@secretsbroker',
  apiVersion: 'v1',
  contractVersion: 'service-lasso.secretsbroker.telemetry-preview.v1',
  outcome: 'ready',
  generatedAt: '2026-08-14T00:00:00Z',
  counters: {
    operations: [],
    policyDecisions: [{ outcome: 'allowed', count: 2 }],
    localApiAuthFailures: 1,
    activeLockouts: 1,
    providerStates: [],
    sourceStates: [],
    auditRecords: [
      { auditStatus: 'audit_recorded', outcome: 'ready', count: 4 },
    ],
  },
  safety: { lowCardinalityLabels: true, valueMaterialIncluded: false },
}

const events: BrokerEventsResult = {
  serviceId: '@secretsbroker',
  apiVersion: 'v1',
  outcome: 'ready',
  generatedAt: '2026-08-14T00:00:00Z',
  limit: 25,
  events: [
    {
      id: 'event-lockout-1',
      ts: '2026-08-14T00:00:00Z',
      family: 'lockout_started',
      severity: 'warning',
      operation: 'local_api_auth',
      outcome: 'locked',
      lockoutScope: 'local_api:pipe-safe',
      retryAfterSeconds: 30,
    },
  ],
  safety: {
    metadataOnly: true,
    rawRefIncluded: false,
    valueMaterialIncluded: false,
  },
}

const grant: SecretAccessPolicyGrant = {
  id: 'grant-1',
  serviceId: '@serviceadmin',
  workspace: 'local',
  namespace: 'services/@serviceadmin/runtime',
  scope: 'service',
  refs: ['services/@serviceadmin/runtime/SESSION_SIGNING_KEY'],
  namespaceWide: false,
  operations: ['resolve'],
  purpose: 'runtime signing',
}

describe('Broker operational-controls helpers', () => {
  it('exports metadata-only telemetry, events, and effective policy', () => {
    const exported = buildOperationalControlsExport({
      generatedAt: '2026-08-14T00:01:00Z',
      telemetry,
      events,
      grants: [grant],
    })
    expect(exported.schema).toBe(
      'service-lasso.admin.operational-controls-export.v1'
    )
    expect(exported.telemetry.activeLockouts).toBe(1)
    expect(exported.events[0]?.lockoutScope).toBe('local_api:pipe-safe')
    expect(exported.effectivePolicy[0]?.namespace).toBe(
      'services/@serviceadmin/runtime'
    )
    expect(JSON.stringify(exported)).not.toContain('raw-secret')
  })

  it('fails closed when Broker safety flags are weakened', () => {
    expect(
      operationalSafetyFlagsAllowExport({
        valueMaterialIncluded: true,
        metadataOnly: true,
        rawRefIncluded: false,
      })
    ).toBe(false)
    expect(
      operationalSafetyFlagsAllowExport({
        valueMaterialIncluded: false,
        metadataOnly: true,
        rawRefIncluded: false,
      })
    ).toBe(true)
  })

  it('summarizes lockout scopes, retry windows, and effective policy grants', () => {
    const lockouts = summarizeActiveLockouts({
      activeLockouts: 1,
      events: events.events,
    })
    expect(lockouts.count).toBe(1)
    expect(lockouts.scopes[0]?.retryGuidance).toMatch(/30 seconds/i)
    expect(summarizeEffectivePolicy([grant])[0]?.refsLabel).toContain(
      'SESSION_SIGNING_KEY'
    )
  })
})
