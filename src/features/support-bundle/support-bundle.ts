export type SupportBundleSeverity = 'info' | 'warning' | 'error'

export type SupportBundleSectionId =
  | 'manifest'
  | 'service-inventory'
  | 'runtime-health'
  | 'secrets-broker'
  | 'recent-errors'
  | 'redaction-report'

export interface SupportBundleSection {
  id: SupportBundleSectionId
  title: string
  summary: string
  itemCount: number
  severity: SupportBundleSeverity
}

export interface SupportBundleManifest {
  bundleVersion: string
  generatedAt: string
  instanceRef: string
  sections: SupportBundleSection[]
  redactionPolicy: {
    mode: 'secret-safe-by-default'
    rules: string[]
    excludedMaterial: string[]
  }
}

export interface SupportBundlePayload {
  manifest: SupportBundleManifest
  diagnostics: {
    serviceInventory: Array<Record<string, string>>
    runtimeHealth: Array<Record<string, string>>
    secretsBroker: Array<Record<string, string>>
    recentErrors: string[]
    redactionReport: Array<Record<string, string | number>>
  }
}

export const supportBundleRedactionRules = [
  'Bearer and Basic authorization values are replaced with [REDACTED_AUTHORIZATION].',
  'Token, API key, secret, password, cookie, and private-key assignments are replaced with [REDACTED_SECRET].',
  'Environment values are summarized by key/reference only; raw values are excluded.',
  'Logs are included only after line-level redaction.',
]

export const supportBundleExcludedMaterial = [
  'raw secret values',
  'provider tokens',
  'API keys',
  'auth cookies',
  'private keys',
  'recovery material',
  'passwords',
  'unredacted environment values',
]

const assignmentPattern =
  /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret|session[_-]?secret|secret|password|cookie|private[_-]?key|recovery[_-]?key|env[_-]?value)\s*[:=]\s*([^\s,;]+)/gi
const authPattern = /\b(bearer|basic)\s+[a-z0-9._~+/=-]+/gi
const privateKeyPattern =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi

export function redactDiagnosticText(value: string): string {
  return value
    .replace(privateKeyPattern, '[REDACTED_PRIVATE_KEY]')
    .replace(authPattern, '[REDACTED_AUTHORIZATION]')
    .replace(
      assignmentPattern,
      (_match, key: string) => `${key}=[REDACTED_SECRET]`
    )
}

export function containsSecretLikeMaterial(value: string): boolean {
  const hasPrivateKey =
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/i.test(
      value
    )
  const hasAuthCredential =
    /\b(bearer|basic)\s+(?!and\b|authorization\b)[a-z0-9._~+/=-]{8,}/i.test(
      value
    )
  const hasUnredactedAssignment = [
    ...value.matchAll(
      /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|client[_-]?secret|session[_-]?secret|secret|password|cookie|private[_-]?key|recovery[_-]?key|env[_-]?value)\s*[:=]\s*([^\s,;]+)/gi
    ),
  ].some((match) => !match[2].startsWith('[REDACTED_'))

  return hasPrivateKey || hasAuthCredential || hasUnredactedAssignment
}

const rawRecentErrors = [
  '2026-05-08T12:40:01Z WARN @secretsbroker provider=vault-east status=auth-required access_token=provider-login-needed',
  '2026-05-08T12:41:14Z ERROR @serviceadmin export denied: cookie=session-cookie-placeholder',
  '2026-05-08T12:42:22Z INFO service-broker retry scheduled for service=@secretsbroker correlation=diag_9bf12',
]

export function buildSupportBundlePayload(
  generatedAt = '2026-05-08T13:10:00.000Z'
): SupportBundlePayload {
  const recentErrors = rawRecentErrors.map(redactDiagnosticText)
  const redactionReport = rawRecentErrors.map((line, index) => ({
    source: `recent-errors:${index + 1}`,
    redactions: line === recentErrors[index] ? 0 : 1,
    status: 'redacted',
  }))

  const sections: SupportBundleSection[] = [
    {
      id: 'manifest',
      title: 'Manifest and redaction policy',
      summary: 'Bundle version, generated timestamp, section list, and policy.',
      itemCount: 1,
      severity: 'info',
    },
    {
      id: 'service-inventory',
      title: 'Service inventory',
      summary: 'Installed local services, versions, and lifecycle status.',
      itemCount: 4,
      severity: 'info',
    },
    {
      id: 'runtime-health',
      title: 'Runtime and health summaries',
      summary: 'Runtime state, uptime, last check, and degraded dependencies.',
      itemCount: 3,
      severity: 'warning',
    },
    {
      id: 'secrets-broker',
      title: 'Secrets Broker source statuses',
      summary:
        'Provider/source refs, lifecycle status, and safe error codes only.',
      itemCount: 3,
      severity: 'warning',
    },
    {
      id: 'recent-errors',
      title: 'Recent redacted errors',
      summary: 'Selected log lines after authorization and secret redaction.',
      itemCount: recentErrors.length,
      severity: 'error',
    },
    {
      id: 'redaction-report',
      title: 'Redaction report',
      summary: 'Per-source redaction counts without exposing removed values.',
      itemCount: redactionReport.length,
      severity: 'info',
    },
  ]

  return {
    manifest: {
      bundleVersion: 'support-bundle.v1',
      generatedAt,
      instanceRef: 'service-lasso-local-dev',
      sections,
      redactionPolicy: {
        mode: 'secret-safe-by-default',
        rules: supportBundleRedactionRules,
        excludedMaterial: supportBundleExcludedMaterial,
      },
    },
    diagnostics: {
      serviceInventory: [
        { service: '@serviceadmin', version: '2.2.1', state: 'running' },
        { service: '@secretsbroker', version: 'local', state: 'degraded' },
        { service: '@traefik', version: 'local', state: 'running' },
        { service: 'service-broker', version: 'local', state: 'running' },
      ],
      runtimeHealth: [
        { check: 'serviceadmin-ui', status: 'healthy', ref: 'health_ui_001' },
        {
          check: 'secretsbroker-provider-auth',
          status: 'auth-required',
          ref: 'diag_provider_auth',
        },
        {
          check: 'log-redaction',
          status: 'enabled',
          ref: 'redaction_policy_v1',
        },
      ],
      secretsBroker: [
        {
          providerRef: 'vault-east',
          status: 'auth-required',
          safeErrorCode: 'PROVIDER_AUTH_REQUIRED',
        },
        {
          providerRef: 'local-encrypted-store',
          status: 'ready',
          safeErrorCode: 'NONE',
        },
        {
          providerRef: 'openclaw-exec-adapter',
          status: 'policy-denied',
          safeErrorCode: 'POLICY_NAMESPACE_DENIED',
        },
      ],
      recentErrors,
      redactionReport,
    },
  }
}

export function supportBundleHasSecretMaterial(
  payload = buildSupportBundlePayload()
): boolean {
  return containsSecretLikeMaterial(JSON.stringify(payload))
}
