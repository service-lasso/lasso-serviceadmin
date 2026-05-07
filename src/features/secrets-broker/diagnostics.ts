export type SecretsBrokerDiagnosticStatus = 'pass' | 'warning' | 'fail'

export type SecretsBrokerDiagnosticCategory =
  | 'configuration'
  | 'permission'
  | 'provider'
  | 'auth'
  | 'runtime'

export type SecretsBrokerDiagnostic = {
  id: string
  title: string
  category: SecretsBrokerDiagnosticCategory
  status: SecretsBrokerDiagnosticStatus
  lastCheckedAt: string
  code: string
  normalizedMessage: string
  suggestedFix: string
  affectedRefs: string[]
  affectedServices: string[]
  sourceLabel: string
  link: {
    label: string
    to: '/dependencies' | '/logs' | '/variables' | '/secrets-broker'
    search?: Record<string, string>
  }
}

const secretLikePatterns = [
  /secret\s*[=:]\s*[^\s,;]+/gi,
  /password\s*[=:]\s*[^\s,;]+/gi,
  /token\s*[=:]\s*[^\s,;]+/gi,
  /api[_-]?key\s*[=:]\s*[^\s,;]+/gi,
  /AKIA[0-9A-Z]{16}/g,
  /sk-[A-Za-z0-9_-]{12,}/g,
]

export function scrubSecretLikeOutput(message: string) {
  return secretLikePatterns.reduce(
    (scrubbed, pattern) => scrubbed.replace(pattern, '[redacted]'),
    message
  )
}

const diagnosticFixtures: Array<
  Omit<SecretsBrokerDiagnostic, 'normalizedMessage'> & {
    rawMessage: string
  }
> = [
  {
    id: 'broker-api-reachable',
    title: 'Broker API reachable',
    category: 'runtime',
    status: 'pass',
    lastCheckedAt: '2026-05-07T18:10:00Z',
    code: 'broker_api_reachable',
    rawMessage: 'Broker health endpoint responded with ready state.',
    suggestedFix:
      'No action required; retry refs from the affected service if needed.',
    affectedRefs: [],
    affectedServices: ['@secretsbroker'],
    sourceLabel: '@secretsbroker runtime API',
    link: {
      label: 'Open broker logs',
      to: '/logs',
      search: { service: '@secretsbroker' },
    },
  },
  {
    id: 'local-store-locked',
    title: 'Local vault readable',
    category: 'auth',
    status: 'fail',
    lastCheckedAt: '2026-05-07T18:09:30Z',
    code: 'locked',
    rawMessage:
      'Local vault is locked; password=correct-horse-battery-staple was not accepted.',
    suggestedFix:
      'Unlock the local store or import/re-wrap the portable master key for this machine.',
    affectedRefs: ['postgres.ADMIN_PASSWORD'],
    affectedServices: ['postgres'],
    sourceLabel: '@secretsbroker/local/default',
    link: { label: 'Inspect affected refs', to: '/dependencies' },
  },
  {
    id: 'external-source-auth',
    title: 'External source authentication',
    category: 'auth',
    status: 'fail',
    lastCheckedAt: '2026-05-07T18:08:58Z',
    code: 'source_auth_required',
    rawMessage:
      'Vault token expired while reading telegram.bot_token; token=ghp_examplePlaintextToken.',
    suggestedFix:
      'Re-authenticate the external source, then retry only the affected refs.',
    affectedRefs: ['telegram.bot_token'],
    affectedServices: ['@serviceadmin'],
    sourceLabel: '@secretsbroker/external/ops',
    link: {
      label: 'Open safe variables',
      to: '/variables',
      search: { service: '@serviceadmin' },
    },
  },
  {
    id: 'exec-adapter-policy',
    title: 'OpenClaw SecretRef exec adapter',
    category: 'permission',
    status: 'fail',
    lastCheckedAt: '2026-05-07T18:07:44Z',
    code: 'policy_denied',
    rawMessage:
      'Request denied for openclaw/anthropic/api_key; api_key=sk-this-value-must-not-render.',
    suggestedFix:
      'Review namespace/action allowlist and record the service or workflow identity in audit before retrying.',
    affectedRefs: ['openclaw/anthropic/api_key'],
    affectedServices: ['@serviceadmin'],
    sourceLabel: 'OpenClaw SecretRef adapter',
    link: {
      label: 'Open diagnostics logs',
      to: '/logs',
      search: { service: '@serviceadmin' },
    },
  },
  {
    id: 'workflow-runtime-integration',
    title: 'Workflow runtime integration',
    category: 'runtime',
    status: 'warning',
    lastCheckedAt: '2026-05-07T18:06:20Z',
    code: 'runtime_integration_degraded',
    rawMessage:
      'Dagu run identity is missing a secretsbroker:read grant for optional refs.',
    suggestedFix:
      'Refresh the workflow launch identity or narrow the workflow ref set before the next run.',
    affectedRefs: ['openclaw/anthropic/api_key'],
    affectedServices: ['dagu:daily-ai-summary'],
    sourceLabel: 'Dagu workflow runtime',
    link: { label: 'Open reference usage', to: '/dependencies' },
  },
]

export const secretsBrokerDiagnostics: SecretsBrokerDiagnostic[] =
  diagnosticFixtures.map(({ rawMessage, ...diagnostic }) => ({
    ...diagnostic,
    normalizedMessage: scrubSecretLikeOutput(rawMessage),
  }))

export function countDiagnosticsByStatus(
  diagnostics: SecretsBrokerDiagnostic[]
) {
  return diagnostics.reduce(
    (counts, diagnostic) => ({
      ...counts,
      [diagnostic.status]: counts[diagnostic.status] + 1,
    }),
    { pass: 0, warning: 0, fail: 0 } satisfies Record<
      SecretsBrokerDiagnosticStatus,
      number
    >
  )
}
