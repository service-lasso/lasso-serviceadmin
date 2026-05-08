export type ZitadelSessionState =
  | 'signed-in'
  | 'signed-out'
  | 'setup-needed'
  | 'permission-denied'

export type ZitadelPermissionDecision = 'allowed' | 'denied' | 'review'

export type ZitadelSessionScenario = {
  id: string
  label: string
  state: ZitadelSessionState
  summary: string
  facade: {
    workspaceId: string
    appId: string
    authProvider: 'zitadel' | 'not-configured'
    sessionMode: string
    metadataUpdatedAt: string
  }
  user?: {
    displayName: string
    email: string
    subjectRef: string
    organizationRef: string
    workspaceRole: string
  }
  roles: string[]
  permissions: Array<{
    scope: string
    decision: ZitadelPermissionDecision
    reason: string
  }>
  requiredAction: string
  guardrails: string[]
}

export const zitadelSessionScenarios: ZitadelSessionScenario[] = [
  {
    id: 'signed-in-admin',
    label: 'Signed-in admin',
    state: 'signed-in',
    summary:
      'Facade metadata reports an active ZITADEL-backed local session for this workspace.',
    facade: {
      workspaceId: 'workspace:service-lasso/local-dev',
      appId: '@serviceadmin',
      authProvider: 'zitadel',
      sessionMode: 'optional-auth-enabled',
      metadataUpdatedAt: '2026-05-08T12:48:00Z',
    },
    user: {
      displayName: 'Max Barrass',
      email: 'max@service-lasso.local',
      subjectRef: 'zitadel-subject://service-lasso/users/max',
      organizationRef: 'zitadel-org://service-lasso',
      workspaceRole: 'workspace-admin',
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
      'Session display is derived from facade metadata, not browser credential storage.',
      'Subject and organization refs are stable identifiers, not bearer credentials.',
      'Denied sensitive permissions stay visible so operators know why an action is blocked.',
    ],
  },
  {
    id: 'signed-out',
    label: 'Signed out / login required',
    state: 'signed-out',
    summary:
      'ZITADEL is configured for this app, but no active local session metadata is available.',
    facade: {
      workspaceId: 'workspace:service-lasso/local-dev',
      appId: '@serviceadmin',
      authProvider: 'zitadel',
      sessionMode: 'login-required-for-protected-surfaces',
      metadataUpdatedAt: '2026-05-08T12:49:00Z',
    },
    roles: [],
    permissions: [
      {
        scope: 'serviceadmin:dashboard:read',
        decision: 'review',
        reason: 'available after login handshake completes',
      },
      {
        scope: 'serviceadmin:services:write',
        decision: 'denied',
        reason: 'no active session metadata',
      },
    ],
    requiredAction:
      'Start the ZITADEL login flow from the consumer app, then refresh session metadata.',
    guardrails: [
      'Local development may continue without auth unless the app explicitly enables protected mode.',
      'Login prompts should redirect through the consumer app facade, not store provider credentials in Service Admin.',
    ],
  },
  {
    id: 'setup-needed',
    label: 'Setup needed',
    state: 'setup-needed',
    summary:
      'The consumer app has not enabled ZITADEL integration, so protected auth surfaces stay optional.',
    facade: {
      workspaceId: 'workspace:service-lasso/local-dev',
      appId: '@serviceadmin',
      authProvider: 'not-configured',
      sessionMode: 'local-dev-open',
      metadataUpdatedAt: '2026-05-08T12:50:00Z',
    },
    roles: ['local-dev-fallback'],
    permissions: [
      {
        scope: 'serviceadmin:local-dev:read',
        decision: 'allowed',
        reason: 'auth integration is optional for local preview',
      },
      {
        scope: 'serviceadmin:protected:write',
        decision: 'review',
        reason: 'requires consumer app/facade ZITADEL configuration',
      },
    ],
    requiredAction:
      'Configure the consumer app facade with ZITADEL issuer, client, and workspace mapping before enforcing auth.',
    guardrails: [
      'Do not force ZITADEL on existing local development flows without explicit app config.',
      'Setup guidance references configuration metadata only and never asks operators to paste secrets into the UI.',
    ],
  },
  {
    id: 'permission-denied',
    label: 'Permission denied',
    state: 'permission-denied',
    summary:
      'The user is signed in, but the facade reports insufficient role grants for this protected surface.',
    facade: {
      workspaceId: 'workspace:service-lasso/local-dev',
      appId: '@serviceadmin',
      authProvider: 'zitadel',
      sessionMode: 'protected-surface-denied',
      metadataUpdatedAt: '2026-05-08T12:51:00Z',
    },
    user: {
      displayName: 'Readonly Operator',
      email: 'readonly@service-lasso.local',
      subjectRef: 'zitadel-subject://service-lasso/users/readonly-operator',
      organizationRef: 'zitadel-org://service-lasso',
      workspaceRole: 'workspace-viewer',
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
      'Escalation guidance avoids displaying auth cookies, bearer material, or session secrets.',
    ],
  },
]

export function getZitadelSessionScenario(id: string) {
  return zitadelSessionScenarios.find((scenario) => scenario.id === id)
}

export function zitadelSessionHasSecretMaterial() {
  const joined = JSON.stringify(zitadelSessionScenarios)
  return /bearer\s+[a-z0-9_-]+\.[a-z0-9._-]+|id_token|access_token|refresh_token|session_secret|client_secret|password\s*=|token\s*=|secret\s*=/i.test(
    joined
  )
}
