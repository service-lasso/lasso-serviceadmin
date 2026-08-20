import { describe, expect, it } from 'vitest'
import {
  identityUnlocksUi,
  normalizeRuntimeIdentity,
  resolveIdentityGateSurface,
  runtimeIdentityAuditContext,
} from './runtime-auth'

type TestAuthPayload = {
  auth: {
    contractVersion: string
    request: { clientAddress: string; local: boolean }
    policy: {
      remoteAuthRequired: boolean
      firstRunPending?: boolean
      credentialsAcknowledged?: boolean
    }
    actor: {
      authenticated: boolean
      kind: string | null
      actorId: string | null
      workspaceId: string | null
      roles: string[]
      permissions: string[]
    }
    mode: string
    blockers: string[]
  }
}

function authenticatedPayload(): TestAuthPayload {
  return {
    auth: {
      contractVersion: 'service-lasso.auth-status.v1',
      request: { clientAddress: '127.0.0.1', local: true },
      policy: { remoteAuthRequired: false },
      actor: {
        authenticated: true,
        kind: 'local-root',
        actorId: 'local-root',
        workspaceId: 'local',
        roles: ['serviceadmin.owner'],
        permissions: ['*'],
      },
      mode: 'local-root',
      blockers: [],
    },
  }
}

describe('trusted runtime identity contract', () => {
  it('normalizes only safe authenticated actor metadata', () => {
    const identity = normalizeRuntimeIdentity(authenticatedPayload())

    expect(identity).toMatchObject({
      authenticated: true,
      actorKind: 'local-root',
      actorId: 'local-root',
      workspaceId: 'local',
      roles: ['serviceadmin.owner'],
      permissions: ['*'],
      firstRunPending: false,
      credentialsAcknowledged: true,
    })
    expect(runtimeIdentityAuditContext(identity)).toEqual({
      actorId: 'local-root',
      actorKind: 'local-root',
      workspaceId: 'local',
    })
    expect(identityUnlocksUi(identity, '127.0.0.1')).toBe(false)
    expect(
      identityUnlocksUi(identity, '127.0.0.1', {
        allowLocalRootBreakGlass: true,
      })
    ).toBe(true)
    expect(
      identityUnlocksUi(identity, '192.168.1.9', {
        allowLocalRootBreakGlass: true,
      })
    ).toBe(false)
  })

  it('does not auto-unlock loopback local-root after first-run is acknowledged', () => {
    const payload = authenticatedPayload()
    payload.auth.policy = {
      remoteAuthRequired: false,
      firstRunPending: false,
      credentialsAcknowledged: true,
    }
    const identity = normalizeRuntimeIdentity(payload)
    expect(identity.firstRunPending).toBe(false)
    expect(identity.credentialsAcknowledged).toBe(true)
    expect(resolveIdentityGateSurface(identity, '127.0.0.1')).toBe('login')
    expect(
      resolveIdentityGateSurface(identity, '127.0.0.1', {
        allowLocalRootBreakGlass: true,
      })
    ).toBe('unlocked')
  })

  it('keeps first-run pending on the first-run surface even with break-glass', () => {
    const payload = authenticatedPayload()
    payload.auth.policy = {
      remoteAuthRequired: false,
      firstRunPending: true,
      credentialsAcknowledged: false,
    }
    const identity = normalizeRuntimeIdentity(payload)
    expect(identity.firstRunPending).toBe(true)
    expect(
      identityUnlocksUi(identity, '127.0.0.1', {
        allowLocalRootBreakGlass: true,
      })
    ).toBe(false)
    expect(
      resolveIdentityGateSurface(identity, '127.0.0.1', {
        allowLocalRootBreakGlass: true,
      })
    ).toBe('first-run')
  })

  it('unlocks token login without local-root break-glass', () => {
    const payload = authenticatedPayload()
    payload.auth.actor.kind = 'local-token'
    payload.auth.actor.actorId = 'local-admin-token'
    payload.auth.mode = 'local-token'
    const identity = normalizeRuntimeIdentity(payload)
    expect(identityUnlocksUi(identity, '192.168.1.9')).toBe(true)
    expect(resolveIdentityGateSurface(identity, '192.168.1.9')).toBe('unlocked')
  })

  it('preserves a typed unauthenticated state without inventing identity', () => {
    const payload = authenticatedPayload()
    payload.auth.actor = {
      authenticated: false,
      kind: null,
      actorId: null,
      workspaceId: null,
      roles: [],
      permissions: [],
    }
    payload.auth.mode = 'blocked'
    payload.auth.blockers = ['remote_auth_required']

    const identity = normalizeRuntimeIdentity(payload)
    expect(identity.authenticated).toBe(false)
    expect(identity.actorId).toBeNull()
    expect(() => runtimeIdentityAuditContext(identity)).toThrow(
      /trusted runtime identity/i
    )
  })

  it('rejects incomplete, spoofed, and credential-bearing identity payloads', () => {
    expect(() => normalizeRuntimeIdentity({ auth: {} })).toThrow(
      /trusted auth contract/i
    )
    expect(() =>
      normalizeRuntimeIdentity({
        ...authenticatedPayload(),
        debug: { authorization: 'Bearer raw-token-material-1234567890' },
      })
    ).toThrow(/forbidden credential material/i)

    const payload = authenticatedPayload()
    payload.auth.actor.actorId = 'user@example.test?access_token=raw'
    expect(() => normalizeRuntimeIdentity(payload)).toThrow(
      /forbidden credential material|trusted auth contract/i
    )
  })

  it('rejects first-run secrets if they appear on the security payload', () => {
    expect(() =>
      normalizeRuntimeIdentity({
        ...authenticatedPayload(),
        firstRun: {
          token: 'test-local-admin-token',
          password: 'test-local-operator-password',
        },
      })
    ).toThrow(/forbidden credential material/i)
  })
})
