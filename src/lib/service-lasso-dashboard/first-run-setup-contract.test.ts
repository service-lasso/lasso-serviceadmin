import { describe, expect, it } from 'vitest'
import {
  normalizeFirstRunSetupBootstrapPayload,
  normalizeFirstRunSetupPayload,
} from './stub'

function setupEnvelope() {
  return {
    setup: {
      contractVersion: 'service-lasso.setup-status.v1',
      state: 'setup_required',
      setupMode: true,
      vault: {
        required: true,
        ready: false,
        path: 'C:\\sensitive\\workspace\\store.json',
      },
      operator: { osUsername: 'operator', identitySource: 'vault' },
      trustBoundary: {
        bindHost: '127.0.0.1',
        localOnly: true,
        localhostBootstrapAllowed: true,
        remoteBootstrapAllowed: false,
        setupTokenConfigured: false,
        blockers: [],
      },
      auth: {
        actor: {
          authenticated: true,
          kind: 'local-root',
          actorId: 'local-root',
        },
        mode: 'local-root',
        blockers: [],
      },
    },
  }
}

describe('first-run setup runtime contract', () => {
  it('accepts only the current contract and drops undeclared sensitive fields', () => {
    const setup = normalizeFirstRunSetupPayload(setupEnvelope())
    expect(setup.state).toBe('setup_required')
    expect(setup.vault).toEqual({ required: true, ready: false })
    expect(JSON.stringify(setup)).not.toContain('sensitive')
    expect(JSON.stringify(setup)).not.toContain('store.json')
  })

  it('rejects legacy key-reveal and incomplete setup payloads', () => {
    expect(() =>
      normalizeFirstRunSetupPayload({
        ...setupEnvelope(),
        keyReveal: { value: 'fixture-secret' },
      })
    ).toThrow(/forbiddenMaterial/i)
    expect(() =>
      normalizeFirstRunSetupPayload({ setup: { contractVersion: 'v0' } })
    ).toThrow(/setup\.contractVersion/i)
  })

  it('validates the bootstrap result and provisioned count', () => {
    const response = {
      ...setupEnvelope(),
      bootstrap: {
        ok: true,
        state: 'setup_complete',
        provisionedSecretCount: 4,
      },
    }
    expect(
      normalizeFirstRunSetupBootstrapPayload(response).bootstrap
        .provisionedSecretCount
    ).toBe(4)
    expect(() =>
      normalizeFirstRunSetupBootstrapPayload({
        ...response,
        bootstrap: { ...response.bootstrap, provisionedSecretCount: -1 },
      })
    ).toThrow(/provisionedSecretCount/i)
  })
})
