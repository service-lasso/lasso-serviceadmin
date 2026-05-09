export type TrustedIdentityState =
  | 'authenticated'
  | 'unauthenticated'
  | 'expired'
  | 'forbidden'
  | 'workspace-mismatch'
  | 'invalid'

export type TrustedIdentityDecision = 'allowed' | 'denied' | 'review'

export type TrustedIdentityScenario = {
  id: string
  label: string
  state: TrustedIdentityState
  summary: string
  identityContext: {
    workspaceId: string
    appId: string
    authProvider: 'zitadel' | 'not-configured'
    deliveryBoundary: 'traefik-oidc-auth'
    sessionMode: string
    metadataUpdatedAt: string
    trustStatus:
      | 'trusted'
      | 'missing'
      | 'expired'
      | 'denied'
      | 'mismatch'
      | 'invalid'
  }
  user?: {
    displayName: string
    email: string
    subjectRef: string
    organizationRef: string
    workspaceRole: string
  }
  auditActor: {
    kind: 'user' | 'anonymous' | 'denied-user'
    id: string
    label: string
    workspaceId: string
    source: 'trusted-route-boundary' | 'none'
  }
  roles: string[]
  permissions: Array<{
    scope: string
    decision: TrustedIdentityDecision
    reason: string
  }>
  requiredAction: string
  guardrails: string[]
}

export const trustedIdentityScenarios: TrustedIdentityScenario[] = [
  {
    id: 'authenticated-admin',
    label: 'Authenticated admin',
    state: 'authenticated',
    summary:
      'Trusted route-boundary metadata reports an active ZITADEL-backed user for this workspace.',
    identityContext: {
      workspaceId: 'workspace:service-lasso/local-dev',
      appId: '@serviceadmin',
      authProvider: 'zitadel',
      deliveryBoundary: 'traefik-oidc-auth',
      sessionMode: 'protected-route-authenticated',
      metadataUpdatedAt: '2026-05-09T00:40:00Z',
      trustStatus: 'trusted',
    },
    user: {
      displayName: 'Max Barrass',
      email: 'max@example.service-lasso.test',
      subjectRef: 'zitadel-subject://service-lasso/users/max',
      organizationRef: 'zitadel-org://service-lasso',
      workspaceRole: 'workspace-admin',
    },
    auditActor: {
      kind: 'user',
      id: 'audit-actor://zitadel/max',
      label: 'Max Barrass via ZITADEL',
      workspaceId: 'workspace:service-lasso/local-dev',
      source: 'trusted-route-boundary',
    },
    roles: [
      'serviceadmin.viewer',
      'serviceadmin.operator',
      'secrets.metadata.read',
    ],
    permissions: [
      {
        scope: 'serviceadmin:services:read',
        decision: 'allowed',
        reason: 'workspace role grants service inventory visibility',
      },
      {
        scope: 'serviceadmin:secrets:metadata:read',
        decision: 'allowed',
        reason: 'metadata-only Secrets Broker access granted',
      },
      {
        scope: 'serviceadmin:secrets:values:reveal',
        decision: 'denied',
        reason: 'raw secret reveal is not enabled for this surface',
      },
    ],
    requiredAction:
      'No login action required. Continue using metadata-only protected surfaces.',
    guardrails: [
      'Identity display is derived from the protected route boundary, not browser credential storage.',
      'Subject and organization refs are stable identifiers, not bearer credentials.',
      'Denied sensitive permissions stay visible so operators know why an action is blocked.',
    ],
  },
  {
    id: 'unauthenticated',
    label: 'Unauthenticated / login required',
    state: 'unauthenticated',
    summary:
      'The protected route did not provide trusted identity metadata for a signed-in user.',
    identityContext: {
      workspaceId: 'workspace:service-lasso/local-dev',
      appId: '@serviceadmin',
      authProvider: 'zitadel',
      deliveryBoundary: 'traefik-oidc-auth',
      sessionMode: 'login-required-for-protected-surfaces',
      metadataUpdatedAt: '2026-05-09T00:41:00Z',
      trustStatus: 'missing',
    },
    auditActor: {
      kind: 'anonymous',
      id: 'anonymous',
      label: 'Unauthenticated request',
      workspaceId: 'workspace:service-lasso/local-dev',
      source: 'none',
    },
    roles: [],
    permissions: [
      {
        scope: 'serviceadmin:dashboard:read',
        decision: 'review',
        reason: 'available after the protected route login handshake completes',
      },
      {
        scope: 'serviceadmin:services:write',
        decision: 'denied',
        reason: 'no trusted identity metadata',
      },
    ],
    requiredAction:
      'Start the ZITADEL login flow through Traefik and traefik-oidc-auth, then retry the protected route.',
    guardrails: [
      'Fail closed for protected surfaces when trusted identity metadata is absent.',
      'Login prompts should redirect through the configured middleware and never collect provider credentials in Service Admin.',
    ],
  },
  {
    id: 'expired',
    label: 'Expired session',
    state: 'expired',
    summary:
      'The route boundary reported identity metadata that is no longer valid for protected actions.',
    identityContext: {
      workspaceId: 'workspace:service-lasso/local-dev',
      appId: '@serviceadmin',
      authProvider: 'zitadel',
      deliveryBoundary: 'traefik-oidc-auth',
      sessionMode: 'protected-route-expired',
      metadataUpdatedAt: '2026-05-09T00:42:00Z',
      trustStatus: 'expired',
    },
    user: {
      displayName: 'Expired Operator',
      email: 'expired@example.service-lasso.test',
      subjectRef: 'zitadel-subject://service-lasso/users/expired-operator',
      organizationRef: 'zitadel-org://service-lasso',
      workspaceRole: 'workspace-operator',
    },
    auditActor: {
      kind: 'denied-user',
      id: 'audit-actor://zitadel/expired-operator',
      label: 'Expired Operator (expired)',
      workspaceId: 'workspace:service-lasso/local-dev',
      source: 'trusted-route-boundary',
    },
    roles: ['serviceadmin.operator'],
    permissions: [
      {
        scope: 'serviceadmin:services:read',
        decision: 'denied',
        reason: 'trusted identity context is expired',
      },
    ],
    requiredAction:
      'Re-authenticate through the protected route before continuing.',
    guardrails: [
      'Expired context is visible as state metadata only; session payloads are never rendered.',
      'Protected actions remain blocked until fresh trusted metadata is supplied.',
    ],
  },
  {
    id: 'forbidden',
    label: 'Forbidden role',
    state: 'forbidden',
    summary:
      'The user is authenticated, but trusted route metadata does not grant this Service Admin surface.',
    identityContext: {
      workspaceId: 'workspace:service-lasso/local-dev',
      appId: '@serviceadmin',
      authProvider: 'zitadel',
      deliveryBoundary: 'traefik-oidc-auth',
      sessionMode: 'protected-surface-denied',
      metadataUpdatedAt: '2026-05-09T00:43:00Z',
      trustStatus: 'denied',
    },
    user: {
      displayName: 'Readonly Operator',
      email: 'readonly@example.service-lasso.test',
      subjectRef: 'zitadel-subject://service-lasso/users/readonly-operator',
      organizationRef: 'zitadel-org://service-lasso',
      workspaceRole: 'workspace-viewer',
    },
    auditActor: {
      kind: 'denied-user',
      id: 'audit-actor://zitadel/readonly-operator',
      label: 'Readonly Operator (denied)',
      workspaceId: 'workspace:service-lasso/local-dev',
      source: 'trusted-route-boundary',
    },
    roles: ['serviceadmin.viewer'],
    permissions: [
      {
        scope: 'serviceadmin:services:read',
        decision: 'allowed',
        reason: 'viewer role grants read-only inventory access',
      },
      {
        scope: 'serviceadmin:services:restart',
        decision: 'denied',
        reason: 'operator role is required for lifecycle actions',
      },
      {
        scope: 'serviceadmin:secrets:metadata:read',
        decision: 'denied',
        reason: 'Secrets Broker metadata role is not assigned',
      },
    ],
    requiredAction:
      'Ask a workspace admin to grant the least-privilege role required for this surface.',
    guardrails: [
      'Denied permissions are shown as policy metadata only.',
      'Escalation guidance avoids displaying cookies, bearer material, or session secrets.',
    ],
  },
  {
    id: 'workspace-mismatch',
    label: 'Workspace mismatch',
    state: 'workspace-mismatch',
    summary:
      'The trusted identity metadata points at a different workspace than the current Service Admin route.',
    identityContext: {
      workspaceId: 'workspace:service-lasso/other-dev',
      appId: '@serviceadmin',
      authProvider: 'zitadel',
      deliveryBoundary: 'traefik-oidc-auth',
      sessionMode: 'workspace-mismatch',
      metadataUpdatedAt: '2026-05-09T00:44:00Z',
      trustStatus: 'mismatch',
    },
    user: {
      displayName: 'Workspace Visitor',
      email: 'visitor@example.service-lasso.test',
      subjectRef: 'zitadel-subject://service-lasso/users/workspace-visitor',
      organizationRef: 'zitadel-org://service-lasso',
      workspaceRole: 'workspace-viewer',
    },
    auditActor: {
      kind: 'denied-user',
      id: 'audit-actor://zitadel/workspace-visitor',
      label: 'Workspace Visitor (workspace mismatch)',
      workspaceId: 'workspace:service-lasso/other-dev',
      source: 'trusted-route-boundary',
    },
    roles: ['serviceadmin.viewer'],
    permissions: [
      {
        scope: 'serviceadmin:dashboard:read',
        decision: 'denied',
        reason: 'identity workspace does not match the active route workspace',
      },
    ],
    requiredAction:
      'Switch to the matching workspace route or sign in with an identity assigned to this workspace.',
    guardrails: [
      'Workspace mismatches fail closed before Service Admin actions run.',
      'Audit metadata keeps only safe actor and workspace refs for investigation.',
    ],
  },
  {
    id: 'invalid',
    label: 'Invalid identity context',
    state: 'invalid',
    summary:
      'The protected route metadata is incomplete or fails the trusted context contract.',
    identityContext: {
      workspaceId: 'workspace:service-lasso/local-dev',
      appId: '@serviceadmin',
      authProvider: 'zitadel',
      deliveryBoundary: 'traefik-oidc-auth',
      sessionMode: 'invalid-context',
      metadataUpdatedAt: '2026-05-09T00:45:00Z',
      trustStatus: 'invalid',
    },
    auditActor: {
      kind: 'anonymous',
      id: 'invalid-context',
      label: 'Invalid protected-route context',
      workspaceId: 'workspace:service-lasso/local-dev',
      source: 'none',
    },
    roles: [],
    permissions: [
      {
        scope: 'serviceadmin:dashboard:read',
        decision: 'denied',
        reason: 'trusted identity context contract is incomplete',
      },
    ],
    requiredAction:
      'Check Traefik middleware and identity header mapping before retrying.',
    guardrails: [
      'Browser-supplied identity headers are not trusted by themselves.',
      'Invalid context diagnostics stay metadata-only and do not echo raw headers.',
    ],
  },
]

export function getTrustedIdentityScenario(id: string) {
  return trustedIdentityScenarios.find((scenario) => scenario.id === id)
}

export function trustedIdentityHasSecretMaterial() {
  const joined = JSON.stringify(trustedIdentityScenarios)
  return /bearer\s+[a-z0-9_-]+\.[a-z0-9._-]+|id_token|access_token|refresh_token|session_secret|client_secret|password\s*=|token\s*=|secret\s*=|cookie\s*=/i.test(
    joined
  )
}

export const zitadelSessionScenarios = trustedIdentityScenarios
export const zitadelSessionHasSecretMaterial = trustedIdentityHasSecretMaterial
export type ZitadelSessionState = TrustedIdentityState
export type ZitadelPermissionDecision = TrustedIdentityDecision
export type ZitadelSessionScenario = TrustedIdentityScenario
