export type SecretsBrokerProviderConnectionState =
  | 'healthy'
  | 'degraded'
  | 'failed'
  | 'disabled'
  | 'missing'

export type SecretsBrokerSecretMaterialState =
  | 'present'
  | 'missing'
  | 'expired'
  | 'rotation-due'
  | 'revoked'

export type SecretsBrokerProviderConnectionAction = {
  id:
    | 'reconnect'
    | 'refresh-test-now'
    | 'replace-rotate-secret-material'
    | 'clear-revoke-secret-material'
    | 'disable-enable'
    | 'delete-connection'
  label: string
  state: 'available' | 'disabled' | 'danger'
  confirmationCopy?: string
  disabledReason?: string
}

export type SecretsBrokerProviderConnectionDetail = {
  id: string
  title: string
  provider: string
  source: string
  connectionRef: string
  state: SecretsBrokerProviderConnectionState
  health: {
    label: string
    checkedAt: string
    nextAction: string
    failureReason?: string
  }
  metadata: Array<{ label: string; value: string }>
  scopes: Array<{ label: string; decision: 'allowed' | 'denied' | 'review' }>
  secretMaterial: {
    presence: SecretsBrokerSecretMaterialState
    valueAvailable: boolean
    safeDescriptor: string
    version?: string
    updatedAt?: string
    expiresAt?: string
    refreshWindow?: string
  }
  usage: {
    lastSuccessfulResolve?: string
    lastFailure?: string
    linkedServices: string[]
    linkedWorkflows: string[]
    linkedRuns: string[]
  }
  recentAuditEvents: Array<{
    id: string
    type: string
    outcome: 'success' | 'failure' | 'denied' | 'revoked'
    at: string
    actor: string
    reason: string
  }>
  actions: SecretsBrokerProviderConnectionAction[]
}

export const secretsBrokerProviderConnections: SecretsBrokerProviderConnectionDetail[] =
  [
    {
      id: 'local-default',
      title: 'Local default encrypted store',
      provider: 'local',
      source: '@secretsbroker/local/default',
      connectionRef: 'secret://local/default',
      state: 'healthy',
      health: {
        label: 'Ready for resolves',
        checkedAt: '2026-05-07T19:04:00Z',
        nextAction: 'No action required; continue monitoring audit events.',
      },
      metadata: [
        { label: 'Mode', value: 'local-first encrypted store' },
        { label: 'Namespace', value: 'default' },
        { label: 'Storage', value: 'encrypted metadata index' },
        { label: 'Values', value: 'hidden / never rendered' },
      ],
      scopes: [
        { label: '@serviceadmin read runtime refs', decision: 'allowed' },
        { label: 'write generated SESSION_SECRET', decision: 'review' },
        { label: 'export plaintext values', decision: 'denied' },
      ],
      secretMaterial: {
        presence: 'present',
        valueAvailable: false,
        safeDescriptor:
          'Encrypted payload present; raw value is not loaded in the UI.',
        version: 'key-v4',
        updatedAt: '2026-05-07T18:55:00Z',
        expiresAt: '2026-06-07T18:55:00Z',
        refreshWindow: 'Rotate during next maintenance window.',
      },
      usage: {
        lastSuccessfulResolve: '2026-05-07T19:01:44Z',
        linkedServices: ['@serviceadmin', '@secretsbroker', 'postgres'],
        linkedWorkflows: ['service-start', 'secret-rotation-preview'],
        linkedRuns: ['run-20260507-190144', 'run-20260507-185500'],
      },
      recentAuditEvents: [
        {
          id: 'evt-connection-001',
          type: 'resolve granted',
          outcome: 'success',
          at: '2026-05-07T19:01:44Z',
          actor: 'service:@serviceadmin',
          reason: 'policy granted metadata-safe resolve',
        },
        {
          id: 'evt-connection-002',
          type: 'rotation preview',
          outcome: 'success',
          at: '2026-05-07T18:55:00Z',
          actor: 'operator:max',
          reason: 'version metadata recorded without value access',
        },
      ],
      actions: [
        {
          id: 'reconnect',
          label: 'Reconnect',
          state: 'disabled',
          disabledReason: 'Connection is already healthy.',
        },
        {
          id: 'refresh-test-now',
          label: 'Refresh/test now',
          state: 'available',
        },
        {
          id: 'replace-rotate-secret-material',
          label: 'Replace/rotate secret material',
          state: 'danger',
          confirmationCopy:
            'Rotate local-default material. Existing services may need restart; raw values will remain hidden.',
        },
        {
          id: 'clear-revoke-secret-material',
          label: 'Clear/revoke secret material',
          state: 'danger',
          confirmationCopy:
            'Revoke local-default material. Dependent resolves will fail until replacement material is present.',
        },
        {
          id: 'disable-enable',
          label: 'Disable connection',
          state: 'available',
        },
        {
          id: 'delete-connection',
          label: 'Delete connection',
          state: 'danger',
          confirmationCopy:
            'Delete local-default connection metadata. This does not print or export secret values.',
        },
      ],
    },
    {
      id: 'vault-ops',
      title: 'Vault ops connection',
      provider: 'vault',
      source: '@secretsbroker/external/ops',
      connectionRef: 'vault://kv/service-lasso',
      state: 'degraded',
      health: {
        label: 'Authentication required',
        checkedAt: '2026-05-07T18:58:12Z',
        nextAction:
          'Reconnect the Vault CLI session, then refresh/test this connection.',
        failureReason: 'source_auth_required',
      },
      metadata: [
        { label: 'Mount', value: 'kv/service-lasso' },
        { label: 'Auth mode', value: 'operator session token required' },
        { label: 'Values', value: 'hidden / never requested' },
      ],
      scopes: [
        { label: 'payments-api read STRIPE_KEY ref', decision: 'review' },
        { label: 'backup-worker read AWS refs', decision: 'review' },
        { label: 'list all Vault mounts', decision: 'denied' },
      ],
      secretMaterial: {
        presence: 'expired',
        valueAvailable: false,
        safeDescriptor:
          'Credential handle exists, but the operator session is expired.',
        version: 'vault-metadata-v2',
        updatedAt: '2026-05-07T17:30:00Z',
        expiresAt: '2026-05-07T18:30:00Z',
        refreshWindow: 'Reconnect before starting dependent services.',
      },
      usage: {
        lastSuccessfulResolve: '2026-05-07T18:12:20Z',
        lastFailure: '2026-05-07T18:58:12Z — source_auth_required',
        linkedServices: ['payments-api', 'backup-worker'],
        linkedWorkflows: ['deploy-payments-api'],
        linkedRuns: ['run-20260507-185812'],
      },
      recentAuditEvents: [
        {
          id: 'evt-connection-003',
          type: 'refresh failure',
          outcome: 'failure',
          at: '2026-05-07T18:58:12Z',
          actor: 'operator:max',
          reason: 'source_auth_required',
        },
        {
          id: 'evt-connection-004',
          type: 'resolve denied',
          outcome: 'denied',
          at: '2026-05-07T18:57:34Z',
          actor: 'service:payments-api',
          reason: 'auth expired before resolve',
        },
      ],
      actions: [
        { id: 'reconnect', label: 'Reconnect', state: 'available' },
        {
          id: 'refresh-test-now',
          label: 'Refresh/test now',
          state: 'available',
        },
        {
          id: 'replace-rotate-secret-material',
          label: 'Replace/rotate secret material',
          state: 'disabled',
          disabledReason: 'Reconnect before rotating external material.',
        },
        {
          id: 'clear-revoke-secret-material',
          label: 'Clear/revoke secret material',
          state: 'danger',
          confirmationCopy:
            'Revoke the Vault ops credential handle. Dependent services will lose access until reconnected.',
        },
        {
          id: 'disable-enable',
          label: 'Disable connection',
          state: 'available',
        },
        {
          id: 'delete-connection',
          label: 'Delete connection',
          state: 'danger',
          confirmationCopy:
            'Delete the Vault ops connection metadata. This removes metadata only and never displays secret values.',
        },
      ],
    },
    {
      id: 'aws-backup-worker',
      title: 'AWS backup worker connection',
      provider: 'aws-secrets-manager',
      source: '@secretsbroker/external/aws',
      connectionRef: 'aws-secrets-manager://service-lasso/backup-worker',
      state: 'missing',
      health: {
        label: 'Missing credentials',
        checkedAt: '2026-05-07T18:45:00Z',
        nextAction:
          'Add a scoped AWS profile or disable this connection until configured.',
        failureReason: 'credential_handle_missing',
      },
      metadata: [
        { label: 'Region', value: 'ap-southeast-2' },
        { label: 'Profile', value: 'service-lasso' },
        { label: 'Values', value: 'hidden / unavailable' },
      ],
      scopes: [
        { label: 'backup-worker read backup refs', decision: 'review' },
        { label: 'delete AWS secret versions', decision: 'denied' },
      ],
      secretMaterial: {
        presence: 'missing',
        valueAvailable: false,
        safeDescriptor:
          'No credential handle is configured for this provider connection.',
      },
      usage: {
        lastFailure: '2026-05-07T18:45:00Z — credential_handle_missing',
        linkedServices: ['backup-worker'],
        linkedWorkflows: ['nightly-backup'],
        linkedRuns: ['run-20260507-184500'],
      },
      recentAuditEvents: [
        {
          id: 'evt-connection-005',
          type: 'test failure',
          outcome: 'failure',
          at: '2026-05-07T18:45:00Z',
          actor: 'operator:max',
          reason: 'credential_handle_missing',
        },
      ],
      actions: [
        { id: 'reconnect', label: 'Reconnect', state: 'available' },
        {
          id: 'refresh-test-now',
          label: 'Refresh/test now',
          state: 'disabled',
          disabledReason: 'Credential handle is missing.',
        },
        {
          id: 'replace-rotate-secret-material',
          label: 'Replace/rotate secret material',
          state: 'available',
        },
        {
          id: 'clear-revoke-secret-material',
          label: 'Clear/revoke secret material',
          state: 'disabled',
          disabledReason: 'No material is present.',
        },
        {
          id: 'disable-enable',
          label: 'Enable connection',
          state: 'available',
        },
        {
          id: 'delete-connection',
          label: 'Delete connection',
          state: 'danger',
          confirmationCopy:
            'Delete the AWS backup worker connection metadata. No secret values will be shown or copied.',
        },
      ],
    },
  ]

export function getSecretsBrokerProviderConnectionDetail(id: string) {
  return secretsBrokerProviderConnections.find(
    (connection) => connection.id === id
  )
}

export function providerConnectionHasSecretValue(
  connection: SecretsBrokerProviderConnectionDetail
) {
  const joined = JSON.stringify(connection)
  return /hunter2|correct-horse|plain\s*text\s*secret|supersecret|sk-[a-z0-9_-]{12,}|ghp_[a-z0-9_]{12,}|AKIA[0-9A-Z]{16}|password\s*=|token\s*=/i.test(
    joined
  )
}
