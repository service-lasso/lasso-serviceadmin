import { describe, expect, it } from 'vitest'
import {
  actionResultFromRuntimeError,
  buildProviderActionResult,
  evaluateProviderRowAction,
  gatedProviderActionResult,
  LOCAL_FALLBACK_BLOCK_REASON,
  mapBrokerOutcomeToUiState,
  mapRuntimeErrorToActionState,
} from './broker-provider-actions'
import type { BrokerOperationCapability, BrokerProviderStatus } from './types'

function operation(
  path: string,
  maturity: BrokerOperationCapability['maturity'],
  extras: Partial<BrokerOperationCapability> = {}
): BrokerOperationCapability {
  return {
    operationId: 'op',
    method: path.includes('config/') ? 'POST' : 'GET',
    path,
    maturity,
    classification: maturity === 'read-only' ? 'read' : 'mutation',
    authenticationRequired: true,
    policyRequired: true,
    auditRequired: true,
    scope: 'mixed',
    completionMode: 'synchronous',
    limitationCode: extras.limitationCode ?? '',
    reasonCode: extras.reasonCode ?? maturity,
    nextAction: extras.nextAction ?? 'inspect_source_or_provider_status',
  }
}

function provider(
  providerId: string,
  kind: string,
  operations: BrokerOperationCapability[],
  extras: Partial<BrokerProviderStatus> = {}
): BrokerProviderStatus {
  return {
    providerId,
    providerKind: kind,
    displayName: providerId,
    state: extras.state ?? 'ready',
    outcome: extras.outcome ?? 'ready',
    namespaces: ['services'],
    capabilities: extras.capabilities ?? ['read'],
    operations,
    auditStatus: 'audit_available',
    nextAction: extras.nextAction,
  }
}

describe('provider row action mapping', () => {
  it('maps broker outcomes onto typed UI states', () => {
    expect(mapBrokerOutcomeToUiState('ready')).toBe('ready')
    expect(mapBrokerOutcomeToUiState('source_auth_required')).toBe(
      'auth-required'
    )
    expect(mapBrokerOutcomeToUiState('locked')).toBe('locked')
    expect(mapBrokerOutcomeToUiState('policy_denied')).toBe('policy-denied')
    expect(mapBrokerOutcomeToUiState('unsupported')).toBe('unsupported')
    expect(mapBrokerOutcomeToUiState('audit_unavailable')).toBe(
      'audit-unavailable'
    )
    expect(mapBrokerOutcomeToUiState('degraded')).toBe('degraded')
    expect(mapBrokerOutcomeToUiState('setup-needed')).toBe('setup-needed')
  })

  it('blocks disable and remove for the local encrypted fallback store', () => {
    const local = provider('local', 'local-encrypted-store', [])
    const disable = evaluateProviderRowAction({
      action: 'disable',
      provider: local,
    })
    const remove = evaluateProviderRowAction({
      action: 'remove',
      provider: local,
    })
    expect(disable).toMatchObject({
      enabled: false,
      state: 'policy-denied',
      summary: LOCAL_FALLBACK_BLOCK_REASON,
    })
    expect(remove.enabled).toBe(false)
    const blocked = gatedProviderActionResult(
      { action: 'disable', provider: local },
      false
    )
    expect(blocked?.phase).toBe('blocked')
    expect(blocked?.summary).toContain(LOCAL_FALLBACK_BLOCK_REASON)
  })

  it('does not enable validate from a family capability string', () => {
    const remote = provider(
      'vault-family-only',
      'vault',
      [operation('/v1/providers/config/status', 'read-only')],
      { capabilities: ['read', 'write', 'reconnect'] }
    )
    const gate = evaluateProviderRowAction({
      action: 'validate',
      provider: remote,
    })
    expect(gate.enabled).toBe(false)
    expect(gate.state).toBe('unsupported')
  })

  it('enables validate only when the exact source operation is dry-run or better', () => {
    const ready = provider('vault-target', 'vault', [
      operation('/v1/providers/config/validate', 'dry-run'),
    ])
    const planned = provider('vault-planned', 'vault', [
      operation('/v1/providers/config/validate', 'planned'),
    ])
    expect(
      evaluateProviderRowAction({ action: 'validate', provider: ready }).enabled
    ).toBe(true)
    expect(
      evaluateProviderRowAction({ action: 'validate', provider: planned })
        .enabled
    ).toBe(false)
  })

  it('maps missing routes and 501 responses to unavailable or unsupported', () => {
    expect(
      mapRuntimeErrorToActionState({
        details: { status: 404, errorCode: 'not_found' },
      }).state
    ).toBe('unavailable')
    expect(
      mapRuntimeErrorToActionState({
        details: { status: 501, errorCode: 'unsupported' },
      }).state
    ).toBe('unsupported')
    const result = actionResultFromRuntimeError(
      {
        action: 'validate',
        provider: provider('vault-target', 'vault', []),
      },
      { details: { status: 404, errorCode: 'not_found' } },
      false
    )
    expect(result.phase).toBe('failure')
    expect(result.state).toBe('unavailable')
  })

  it('drops unsafe fields by constructing safe metadata only', () => {
    const result = buildProviderActionResult({
      providerId: 'vault-target',
      operation: 'validate',
      state: 'ready',
      summary: 'Provider validate ready.',
      nextAction: 'inspect_provider_status',
      correlationId: 'req-safe',
      fixtureDemo: false,
    })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toMatch(/token|password|credentialValue|Bearer /i)
    expect(result).toEqual({
      providerId: 'vault-target',
      sourceId: 'vault-target',
      operation: 'validate',
      phase: 'success',
      state: 'ready',
      summary: 'Provider validate ready.',
      nextAction: 'inspect_provider_status',
      correlationId: 'req-safe',
      checkedAt: result.checkedAt,
      fixtureDemo: false,
    })
  })

  it('labels stub results as fixture/demo', () => {
    const result = buildProviderActionResult({
      providerId: 'local',
      operation: 'status',
      state: 'ready',
      summary: 'Provider status ready.',
      nextAction: 'inspect_provider_status',
      fixtureDemo: true,
    })
    expect(result.fixtureDemo).toBe(true)
    expect(result.summary).toContain('fixture/demo')
  })
})
