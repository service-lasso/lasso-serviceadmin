export type SecretsBrokerSourceType =
  | 'local'
  | 'env'
  | 'file'
  | 'exec'
  | 'vault-cli'
  | 'aws-secrets-manager-cli'
  | 'onepassword-cli'
  | 'bitwarden-bws-cli'
  | 'mounted-secrets'

export type SecretsBrokerSourceState =
  | 'configured'
  | 'not-configured'
  | 'reachable'
  | 'failing'
  | 'untested'

export type SecretsBrokerSourceWarning = {
  code:
    | 'broad_env_allowlist'
    | 'symlink_command_allowed'
    | 'insecure_path_override'
    | 'untrusted_command_path'
    | 'missing_timeout_output_limits'
    | 'auth_required'
  title: string
  severity: 'info' | 'warning' | 'critical'
  description: string
}

export type SecretsBrokerProviderLifecycle =
  | 'setup-needed'
  | 'locked'
  | 'unlocked'
  | 'auth-required'
  | 'invalid'
  | 'ready'

export type SecretsBrokerSourceTestResult = {
  outcome: 'success' | 'failure' | 'not-run'
  checkedAt: string
  metadata: string[]
}

export type SecretsBrokerSourceBackend = {
  id: string
  title: string
  type: SecretsBrokerSourceType
  provider: string
  source: string
  sourceId?: string
  kind?: string
  brokerState?: string
  critical?: boolean
  capabilities?: string[]
  lifecycleDetail?: {
    state: string
    outcome: string
    nextAction: string
    retryable: boolean
  }
  connection: string
  configured: boolean
  enabled: boolean
  priority: number | null
  namespaces: string[]
  defaultRole: 'default' | 'fallback' | 'addable'
  lifecycle: SecretsBrokerProviderLifecycle
  nextAction: string
  state: SecretsBrokerSourceState
  mode: string
  lastCheckedAt: string
  summary: string
  warnings: SecretsBrokerSourceWarning[]
  testResult: SecretsBrokerSourceTestResult
  exampleRefs: string[]
  exampleConfig: string[]
  supportedActions: Array<
    'test-source' | 'view-diagnostics' | 'edit-configuration' | 'view-examples'
  >
}

export const secretsBrokerSourceBackends: SecretsBrokerSourceBackend[] = [
  {
    id: 'local-encrypted-store',
    title: 'Local encrypted store',
    type: 'local',
    provider: 'local',
    source: 'local',
    sourceId: 'local',
    kind: 'local-encrypted-store',
    brokerState: 'setup_needed',
    critical: true,
    capabilities: [
      'read',
      'reveal',
      'write/update',
      'rotate/reset',
      'audit',
      'migration',
      'health',
    ],
    lifecycleDetail: {
      state: 'reconnect_required',
      outcome: 'locked',
      nextAction: 'unlock_or_unseal_source',
      retryable: false,
    },
    connection: 'Local encrypted vault',
    configured: true,
    enabled: true,
    priority: 0,
    namespaces: ['*'],
    defaultRole: 'default',
    lifecycle: 'locked',
    nextAction: 'unlock_or_unseal_source',
    state: 'configured',
    mode: 'local-first encrypted store',
    lastCheckedAt: '2026-06-18T13:35:00Z',
    summary:
      'Built-in local encrypted Secrets Broker store for this Service Lasso instance; currently setup-needed and locked in the demo.',
    warnings: [],
    testResult: {
      outcome: 'failure',
      checkedAt: '2026-06-18T13:35:00Z',
      metadata: [
        'broker healthy',
        'state setup_needed',
        'outcome locked',
        'next action unlock_or_unseal_source',
      ],
    },
    exampleRefs: [
      'secret://local/default/@serviceadmin/SESSION_SECRET',
      'secret://local/default/postgres/ADMIN_PASSWORD',
    ],
    exampleConfig: ['source=local', 'namespace=default', 'value=hidden'],
    supportedActions: [
      'test-source',
      'view-diagnostics',
      'edit-configuration',
      'view-examples',
    ],
  },
  {
    id: 'env-provider',
    title: 'Environment provider',
    type: 'env',
    provider: 'env',
    source: 'addable:env',
    connection: 'Add provider to choose allowlisted environment keys',
    configured: false,
    enabled: false,
    priority: null,
    namespaces: [],
    defaultRole: 'addable',
    lifecycle: 'setup-needed',
    nextAction:
      'Add provider, define an explicit allowlist, then test metadata only.',
    state: 'not-configured',
    mode: 'read-only allowlist',
    lastCheckedAt: '2026-05-07T18:31:15Z',
    summary:
      'Reads only explicitly allowlisted environment keys and reports metadata without values.',
    warnings: [
      {
        code: 'broad_env_allowlist',
        title: 'Broad env allowlist',
        severity: 'warning',
        description:
          'Allowlist includes a wildcard-like prefix; narrow it before enabling production reads.',
      },
    ],
    testResult: {
      outcome: 'success',
      checkedAt: '2026-05-07T18:31:15Z',
      metadata: [
        '3 keys matched allowlist',
        'values redacted',
        'readonly mode',
      ],
    },
    exampleRefs: ['env://service-lasso/OPENCLAW_TOKEN'],
    exampleConfig: ['allow=SERVICE_LASSO_*', 'deny=*_PASSWORD', 'value=hidden'],
    supportedActions: ['test-source', 'view-diagnostics', 'edit-configuration'],
  },
  {
    id: 'file-provider',
    title: 'File provider',
    type: 'file',
    provider: 'file',
    source: 'addable:file',
    connection: 'Add provider to choose scoped file paths',
    configured: false,
    enabled: false,
    priority: null,
    namespaces: [],
    defaultRole: 'addable',
    lifecycle: 'setup-needed',
    nextAction:
      'Add provider, restrict root paths, then run path/symlink validation.',
    state: 'not-configured',
    mode: 'read-only file path',
    lastCheckedAt: '2026-05-07T18:30:40Z',
    summary:
      'Reads refs from a scoped secrets file path after sandbox and symlink checks pass.',
    warnings: [
      {
        code: 'insecure_path_override',
        title: 'Insecure path override',
        severity: 'critical',
        description:
          'Configured override escapes the approved service-lasso secrets directory.',
      },
    ],
    testResult: {
      outcome: 'failure',
      checkedAt: '2026-05-07T18:30:40Z',
      metadata: [
        'path policy denied',
        '0 values read',
        'sandbox escape blocked',
      ],
    },
    exampleRefs: ['file://C:/service-lasso/secrets/runtime.env#SESSION_SECRET'],
    exampleConfig: [
      'path=C:/service-lasso/secrets/runtime.env',
      'followSymlinks=false',
      'value=hidden',
    ],
    supportedActions: [
      'test-source',
      'view-diagnostics',
      'edit-configuration',
      'view-examples',
    ],
  },
  {
    id: 'exec-provider',
    title: 'Exec provider',
    type: 'exec',
    provider: 'exec',
    source: 'addable:exec',
    connection: 'Add provider to choose a trusted resolver command',
    configured: false,
    enabled: false,
    priority: null,
    namespaces: [],
    defaultRole: 'addable',
    lifecycle: 'setup-needed',
    nextAction:
      'Add provider, pin trusted command paths, timeout, and output limits.',
    state: 'not-configured',
    mode: 'allowlisted command',
    lastCheckedAt: '2026-05-07T18:30:05Z',
    summary:
      'Runs an allowlisted resolver command with bounded timeout and scrubbed output metadata.',
    warnings: [
      {
        code: 'untrusted_command_path',
        title: 'Untrusted command path',
        severity: 'critical',
        description:
          'Resolver command path is outside the trusted Service Lasso tool directory.',
      },
      {
        code: 'missing_timeout_output_limits',
        title: 'Missing timeout/output limits',
        severity: 'warning',
        description:
          'Source tests must define timeout and output byte limits before execution.',
      },
    ],
    testResult: {
      outcome: 'failure',
      checkedAt: '2026-05-07T18:30:05Z',
      metadata: [
        'command not executed',
        'policy denied',
        'output scrubber ready',
      ],
    },
    exampleRefs: ['exec://openclaw/service-lasso/SESSION_TOKEN'],
    exampleConfig: [
      'command=openclaw secrets resolve',
      'timeoutMs=5000',
      'maxOutputBytes=2048',
      'value=hidden',
    ],
    supportedActions: ['test-source', 'view-diagnostics', 'edit-configuration'],
  },
  {
    id: 'vault-cli',
    title: 'HashiCorp Vault CLI',
    type: 'vault-cli',
    provider: 'vault',
    source: 'addable:vault',
    connection: 'Add provider to configure Vault/OpenBao metadata',
    configured: false,
    enabled: false,
    priority: null,
    namespaces: [],
    defaultRole: 'addable',
    lifecycle: 'setup-needed',
    nextAction:
      'Add provider, capture safe address/mount metadata, and test auth state.',
    state: 'not-configured',
    mode: 'external cli read',
    lastCheckedAt: '2026-05-07T18:29:40Z',
    summary:
      'External Vault-backed source for ops-managed refs; authentication status is shown without token values.',
    warnings: [
      {
        code: 'auth_required',
        title: 'Authentication required',
        severity: 'warning',
        description:
          'Vault CLI token is expired or missing; authenticate before testing refs.',
      },
    ],
    testResult: {
      outcome: 'failure',
      checkedAt: '2026-05-07T18:29:40Z',
      metadata: [
        'auth required',
        'provider reachable unknown',
        'values not requested',
      ],
    },
    exampleRefs: ['vault://kv/service-lasso/payments/STRIPE_KEY'],
    exampleConfig: [
      'mount=kv/service-lasso',
      'auth=operator-required',
      'value=hidden',
    ],
    supportedActions: ['test-source', 'view-diagnostics', 'edit-configuration'],
  },
  {
    id: 'aws-secrets-manager-cli',
    title: 'AWS Secrets Manager CLI',
    type: 'aws-secrets-manager-cli',
    provider: 'aws',
    source: 'addable:aws-secrets-manager',
    connection: 'Add provider to configure AWS metadata',
    configured: false,
    enabled: false,
    priority: null,
    namespaces: [],
    defaultRole: 'addable',
    lifecycle: 'setup-needed',
    nextAction:
      'Add provider, choose safe region/profile metadata, then run metadata-only tests.',
    state: 'untested',
    mode: 'external cli metadata probe',
    lastCheckedAt: 'never',
    summary:
      'Cloud source definition for AWS-managed refs; tests should fetch metadata only.',
    warnings: [],
    testResult: {
      outcome: 'not-run',
      checkedAt: 'never',
      metadata: ['not tested', 'metadata-only probe pending'],
    },
    exampleRefs: ['aws-secrets-manager://service-lasso/backup-worker'],
    exampleConfig: [
      'region=ap-southeast-2',
      'profile=service-lasso',
      'value=hidden',
    ],
    supportedActions: ['test-source', 'view-diagnostics', 'edit-configuration'],
  },
  {
    id: 'onepassword-cli',
    title: '1Password CLI',
    type: 'onepassword-cli',
    provider: 'onepassword',
    source: 'addable:onepassword',
    connection: 'Add provider to configure 1Password item mappings',
    configured: false,
    enabled: false,
    priority: null,
    namespaces: [],
    defaultRole: 'addable',
    lifecycle: 'setup-needed',
    nextAction:
      'Add provider, map vault/item metadata, and verify sign-in state.',
    state: 'not-configured',
    mode: 'external cli metadata probe',
    lastCheckedAt: '2026-05-07T18:28:30Z',
    summary:
      'Password-manager source for operator-managed service refs with item metadata only.',
    warnings: [],
    testResult: {
      outcome: 'success',
      checkedAt: '2026-05-07T18:28:30Z',
      metadata: [
        'vault reachable',
        '2 item handles matched',
        'values redacted',
      ],
    },
    exampleRefs: ['op://Service Lasso/OpenClaw/anthropic api key'],
    exampleConfig: ['vault=Service Lasso', 'field=credential', 'value=hidden'],
    supportedActions: ['test-source', 'view-diagnostics', 'view-examples'],
  },
  {
    id: 'bitwarden-bws-cli',
    title: 'Bitwarden / BWS CLI',
    type: 'bitwarden-bws-cli',
    provider: 'bitwarden',
    source: 'addable:bitwarden-bws',
    connection: 'Add provider to configure BWS project mappings',
    configured: false,
    enabled: false,
    priority: null,
    namespaces: [],
    defaultRole: 'addable',
    lifecycle: 'setup-needed',
    nextAction:
      'Add provider, map project/secret ids, and keep tokens as refs only.',
    state: 'not-configured',
    mode: 'external cli metadata probe',
    lastCheckedAt: 'never',
    summary:
      'Optional external BWS source placeholder for future Service Lasso refs.',
    warnings: [],
    testResult: {
      outcome: 'not-run',
      checkedAt: 'never',
      metadata: ['not configured', 'no values requested'],
    },
    exampleRefs: ['bws://service-lasso/project/openclaw-api-key'],
    exampleConfig: [
      'project=service-lasso',
      'auth=operator-required',
      'value=hidden',
    ],
    supportedActions: ['edit-configuration', 'view-examples'],
  },
  {
    id: 'mounted-secrets',
    title: 'Docker/Kubernetes mounted secrets',
    type: 'mounted-secrets',
    provider: 'mounted-file',
    source: 'addable:mounted-secrets',
    connection: 'Add provider to configure mounted path metadata',
    configured: false,
    enabled: false,
    priority: null,
    namespaces: [],
    defaultRole: 'addable',
    lifecycle: 'setup-needed',
    nextAction:
      'Add provider, restrict root path and symlink policy, then test metadata only.',
    state: 'not-configured',
    mode: 'read-only mounted path',
    lastCheckedAt: '2026-05-07T18:27:20Z',
    summary:
      'Container-orchestrator mounted secret files exposed as refs with path scope checks.',
    warnings: [
      {
        code: 'symlink_command_allowed',
        title: 'Symlink traversal blocked',
        severity: 'info',
        description:
          'Symlink targets are rejected unless explicitly allowed by the source policy.',
      },
    ],
    testResult: {
      outcome: 'success',
      checkedAt: '2026-05-07T18:27:20Z',
      metadata: ['path exists', 'symlink check passed', 'values redacted'],
    },
    exampleRefs: ['mounted://run-secrets/postgres-password'],
    exampleConfig: [
      'root=/run/secrets',
      'followSymlinks=false',
      'value=hidden',
    ],
    supportedActions: ['test-source', 'view-diagnostics', 'edit-configuration'],
  },
]

export function countSourceBackendsByState(
  sources: SecretsBrokerSourceBackend[]
) {
  return sources.reduce<Record<SecretsBrokerSourceState, number>>(
    (counts, source) => {
      counts[source.state] += 1
      return counts
    },
    {
      configured: 0,
      'not-configured': 0,
      reachable: 0,
      failing: 0,
      untested: 0,
    }
  )
}

export function getConfiguredSecretsBrokerProviders(
  sources: SecretsBrokerSourceBackend[] = secretsBrokerSourceBackends
) {
  return sources
    .filter((source) => source.configured)
    .sort((left, right) => (left.priority ?? 999) - (right.priority ?? 999))
}

export function getLocalEncryptedStoreProvider(
  sources: SecretsBrokerSourceBackend[] = secretsBrokerSourceBackends
) {
  return sources.find((source) => source.id === 'local-encrypted-store')
}

export function getAddableSecretsBrokerProviders(
  sources: SecretsBrokerSourceBackend[] = secretsBrokerSourceBackends
) {
  return sources
    .filter((source) => !source.configured)
    .sort((left, right) => left.title.localeCompare(right.title))
}

export function buildProvidersManagementSummary(
  sources: SecretsBrokerSourceBackend[] = secretsBrokerSourceBackends
) {
  const configured = getConfiguredSecretsBrokerProviders(sources)
  const addable = getAddableSecretsBrokerProviders(sources)
  const ready = configured.filter(
    (source) =>
      source.enabled &&
      ['reachable', 'configured'].includes(source.state) &&
      ['ready', 'unlocked'].includes(source.lifecycle)
  )
  const needsAction = configured.filter(
    (source) =>
      !source.enabled ||
      ['failing', 'untested'].includes(source.state) ||
      !['ready', 'unlocked'].includes(source.lifecycle)
  )
  const defaultProvider =
    configured.find((source) => source.defaultRole === 'default') ??
    configured[0]

  return {
    configuredCount: configured.length,
    addableCount: addable.length,
    readyCount: ready.length,
    needsActionCount: needsAction.length,
    defaultProvider: defaultProvider?.title ?? 'None',
  }
}

export function filterProviderManagementRows(
  sources: SecretsBrokerSourceBackend[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) return sources

  return sources.filter((source) =>
    [
      source.title,
      source.type,
      source.provider,
      source.source,
      source.connection,
      source.state,
      source.lifecycle,
      source.namespaces.join(' '),
      source.defaultRole,
      source.nextAction,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery)
  )
}

export function sourceBackendHasSecretValue(
  source: SecretsBrokerSourceBackend
) {
  const joined = [
    source.summary,
    ...source.testResult.metadata,
    ...source.exampleRefs,
    ...source.exampleConfig,
  ].join(' ')

  return /hunter2|correct-horse|plain\s*text\s*secret|sk-[a-z0-9_-]{12,}|ghp_[a-z0-9_]{12,}|AKIA[0-9A-Z]{16}/i.test(
    joined
  )
}
