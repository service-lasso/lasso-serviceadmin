import { useQuery } from '@tanstack/react-query'
import {
  isLoopbackHostname,
  isLoopbackLoginOrigin,
  readLocalRootBreakGlass,
} from './local-operator-session'
import { fetchRuntimeJson, serviceLassoStubDataEnabled } from './stub'

export type RuntimeActorKind = 'local-root' | 'zitadel' | 'local-token'

export type RuntimeIdentityProvider = {
  id: string
  label: string
  kind: 'zitadel'
  startUrl: string | null
}

export type RuntimeIdentity = {
  contractVersion: 'service-lasso.auth-status.v1'
  authenticated: boolean
  actorKind: RuntimeActorKind | null
  actorId: string | null
  local: boolean
  remoteAuthRequired: boolean
  forceSso: boolean
  localTokenConfigured: boolean
  localOperatorConfigured: boolean
  firstRunPending: boolean
  credentialsAcknowledged: boolean
  identityProviders: RuntimeIdentityProvider[]
  workspaceId: string | null
  roles: string[]
  permissions: string[]
  blockers: string[]
}

type RuntimeAuthPayload = {
  auth?: unknown
}

const safeIdentifierPattern = /^[A-Za-z0-9@._:/-]{1,240}$/u
const safePermissionPattern =
  /^(?:\*|[a-z][a-z0-9-]{0,63}:[a-z][a-z0-9-]{0,63})$/u
const forbiddenMaterialPattern =
  /(?:access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?cookie|client[_-]?secret|password|private[_-]?key|bearer\s+[A-Za-z0-9._~+/-]{12,})/iu

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (
    !safeIdentifierPattern.test(normalized) ||
    forbiddenMaterialPattern.test(normalized)
  ) {
    return null
  }
  return normalized
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 64) return []
  const result = value.map(safeIdentifier)
  return result.every((item): item is string => item !== null) ? result : []
}

function safePermissionArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 64) return []
  const result = value.filter(
    (item): item is string =>
      typeof item === 'string' && safePermissionPattern.test(item)
  )
  return result.length === value.length ? result : []
}

export function normalizeRuntimeIdentity(payload: unknown): RuntimeIdentity {
  if (forbiddenMaterialPattern.test(JSON.stringify(payload))) {
    throw new Error(
      'Runtime identity response contained forbidden credential material.'
    )
  }

  const root = isRecord(payload) ? payload : {}
  const auth = isRecord(root.auth) ? root.auth : {}
  const request = isRecord(auth.request) ? auth.request : {}
  const policy = isRecord(auth.policy) ? auth.policy : {}
  const actor = isRecord(auth.actor) ? auth.actor : {}
  const actorKind =
    actor.kind === 'local-root' ||
    actor.kind === 'zitadel' ||
    actor.kind === 'local-token'
      ? actor.kind
      : null
  const actorId = safeIdentifier(actor.actorId)
  const authenticated = actor.authenticated === true
  const contractVersion = auth.contractVersion

  if (
    contractVersion !== 'service-lasso.auth-status.v1' ||
    typeof request.local !== 'boolean' ||
    typeof policy.remoteAuthRequired !== 'boolean' ||
    typeof actor.authenticated !== 'boolean' ||
    !Array.isArray(auth.blockers) ||
    (authenticated && (!actorKind || !actorId))
  ) {
    throw new Error(
      'Runtime identity response did not match the trusted auth contract.'
    )
  }

  const blockers = safeStringArray(auth.blockers)
  if (blockers.length !== auth.blockers.length) {
    throw new Error('Runtime identity blockers were invalid.')
  }

  const workspaceId = safeIdentifier(actor.workspaceId)
  const roles = safeStringArray(actor.roles)
  const permissions = safePermissionArray(actor.permissions)
  const identityProviders = parseIdentityProviders(policy.identityProviders)

  return {
    contractVersion,
    authenticated,
    actorKind,
    actorId,
    local: request.local,
    remoteAuthRequired: policy.remoteAuthRequired,
    forceSso: policy.forceSso === true,
    localTokenConfigured: policy.localTokenConfigured === true,
    localOperatorConfigured: policy.localOperatorConfigured === true,
    firstRunPending: policy.firstRunPending === true,
    credentialsAcknowledged: policy.credentialsAcknowledged !== false,
    identityProviders,
    workspaceId,
    roles,
    permissions,
    blockers,
  }
}

function parseIdentityProviders(value: unknown): RuntimeIdentityProvider[] {
  if (!Array.isArray(value) || value.length > 16) {
    return []
  }
  const providers: RuntimeIdentityProvider[] = []
  for (const entry of value) {
    if (!isRecord(entry) || entry.kind !== 'zitadel') {
      continue
    }
    const id = safeIdentifier(entry.id)
    const label = safeIdentifier(entry.label)
    if (!id || !label) {
      continue
    }
    const startUrl =
      typeof entry.startUrl === 'string' && /^https?:\/\//u.test(entry.startUrl)
        ? entry.startUrl
        : null
    providers.push({ id, label, kind: 'zitadel', startUrl })
  }
  return providers
}

/**
 * Token/SSO unlock the UI. local-root on loopback is break-glass only.
 * First-run pending always stays locked until the operator copies and
 * acknowledges the token.
 */
export function identityUnlocksUi(
  identity: RuntimeIdentity,
  hostname: string,
  options?: { allowLocalRootBreakGlass?: boolean }
): boolean {
  if (identity.firstRunPending) {
    return false
  }
  if (!identity.authenticated || !identity.actorKind || !identity.actorId) {
    return false
  }
  if (
    identity.actorKind === 'local-token' ||
    identity.actorKind === 'zitadel'
  ) {
    return true
  }
  return (
    identity.actorKind === 'local-root' &&
    isLoopbackHostname(hostname) &&
    options?.allowLocalRootBreakGlass === true
  )
}

export type IdentityGateSurface = 'first-run' | 'login' | 'unlocked'

/**
 * Choose the identity-gate surface. First-run is loopback-only and wins over
 * local-root break-glass so the copy/save screen cannot be skipped.
 */
export function resolveIdentityGateSurface(
  identity: RuntimeIdentity,
  hostname: string,
  options?: { allowLocalRootBreakGlass?: boolean }
): IdentityGateSurface {
  if (identity.firstRunPending && isLoopbackLoginOrigin(identity, hostname)) {
    return 'first-run'
  }
  if (identityUnlocksUi(identity, hostname, options)) {
    return 'unlocked'
  }
  return 'login'
}

/** True when stub dashboards or Vitest may use fixture local-root unlock. */
export function shouldUseFixtureIdentity() {
  return serviceLassoStubDataEnabled || import.meta.env.MODE === 'test'
}

/**
 * Session break-glass, or fixture identity used by Vitest screens.
 */
export function allowLocalRootBreakGlass(): boolean {
  return readLocalRootBreakGlass() || shouldUseFixtureIdentity()
}

/** Trusted local-root identity used by stub dashboards and Vitest screens. */
const fixtureRuntimeIdentity: RuntimeIdentity = {
  contractVersion: 'service-lasso.auth-status.v1',
  authenticated: true,
  actorKind: 'local-root',
  actorId: 'local-root',
  local: true,
  remoteAuthRequired: false,
  forceSso: false,
  localTokenConfigured: true,
  localOperatorConfigured: true,
  firstRunPending: false,
  credentialsAcknowledged: true,
  identityProviders: [],
  workspaceId: 'local',
  roles: ['serviceadmin.owner'],
  permissions: ['*'],
  blockers: [],
}

export async function fetchRuntimeIdentity(): Promise<RuntimeIdentity> {
  if (shouldUseFixtureIdentity()) {
    return fixtureRuntimeIdentity
  }

  return normalizeRuntimeIdentity(
    await fetchRuntimeJson<RuntimeAuthPayload>('/api/runtime/security')
  )
}

export function runtimeIdentityAuditContext(identity: RuntimeIdentity) {
  if (!identity.authenticated || !identity.actorKind || !identity.actorId) {
    throw new Error('A trusted runtime identity is required for this action.')
  }

  return {
    actorId: identity.actorId,
    actorKind: identity.actorKind,
    ...(identity.workspaceId ? { workspaceId: identity.workspaceId } : {}),
  }
}

export const runtimeIdentityQueryKey = ['service-lasso-runtime-identity']

/**
 * Loads the trusted Service Lasso runtime identity for gated UI.
 * Lives outside the dashboard hooks barrel so tests can mock that barrel
 * without disabling the identity gate.
 */
export function useRuntimeIdentity() {
  const useFixture = shouldUseFixtureIdentity()
  return useQuery({
    queryKey: runtimeIdentityQueryKey,
    queryFn: fetchRuntimeIdentity,
    retry: false,
    staleTime: 5_000,
    ...(useFixture ? { initialData: fixtureRuntimeIdentity } : {}),
  })
}
