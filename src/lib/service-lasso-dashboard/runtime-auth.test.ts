import { describe, expect, it } from 'vitest'
import {
  normalizeRuntimeIdentity,
  runtimeIdentityAuditContext,
} from './runtime-auth'

type TestAuthPayload = {
  auth: {
    contractVersion: string
    request: { clientAddress: string; local: boolean }
    policy: { remoteAuthRequired: boolean }
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
    })
    expect(runtimeIdentityAuditContext(identity)).toEqual({
      actorId: 'local-root',
      actorKind: 'local-root',
      workspaceId: 'local',
    })
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
})
