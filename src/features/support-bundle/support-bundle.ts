export type SupportBundleSeverity = 'info' | 'warning' | 'error'

export type SupportBundleReviewSectionId =
  | 'configuration'
  | 'runtime'
  | 'provider'
  | 'auth'
  | 'permission'
  | 'redaction'

export type SupportBundleDiagnosticInput = {
  category: 'configuration' | 'permission' | 'provider' | 'auth' | 'runtime'
  status: 'pass' | 'warning' | 'fail'
}

export interface SupportBundleReviewSection {
  id: SupportBundleReviewSectionId
  title: string
  summary: string
  itemCount: number
  severity: SupportBundleSeverity
}

export interface SupportBundleReview {
  exportAvailability: {
    state: 'unavailable'
    label: string
    reason: string
  }
  sections: SupportBundleReviewSection[]
  redactionStatus: string
  approximateSizeLabel: string
}

export const supportBundleRedactionRules = [
  'Bearer and Basic authorization values are replaced with [REDACTED_AUTHORIZATION].',
  'Token, API key, secret, password, cookie, and private-key assignments are replaced with [REDACTED_SECRET].',
  'Environment values are summarized by key/reference only; raw values are excluded.',
  'Logs must be included only after line-level redaction.',
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

const sectionCopy: Record<
  Exclude<SupportBundleReviewSectionId, 'redaction'>,
  { title: string; summary: string }
> = {
  configuration: {
    title: 'Configuration diagnostics',
    summary: 'Current broker configuration checks and safe next actions.',
  },
  runtime: {
    title: 'Runtime diagnostics',
    summary: 'Current broker runtime health and degraded dependency checks.',
  },
  provider: {
    title: 'Provider diagnostics',
    summary: 'Source/provider status codes, refs, and safe failure categories.',
  },
  auth: {
    title: 'Authentication diagnostics',
    summary: 'Auth-required and lockout states without credential values.',
  },
  permission: {
    title: 'Permission diagnostics',
    summary: 'Policy and namespace decisions using metadata only.',
  },
}

function severityForDiagnostics(
  diagnostics: SupportBundleDiagnosticInput[]
): SupportBundleSeverity {
  if (diagnostics.some((diagnostic) => diagnostic.status === 'fail')) {
    return 'error'
  }

  if (diagnostics.some((diagnostic) => diagnostic.status === 'warning')) {
    return 'warning'
  }

  return 'info'
}

export function buildSupportBundleReview(
  diagnostics: SupportBundleDiagnosticInput[]
): SupportBundleReview {
  const sections: SupportBundleReviewSection[] = Object.entries(
    sectionCopy
  ).map(([id, copy]) => {
    const matchingDiagnostics = diagnostics.filter(
      (diagnostic) => diagnostic.category === id
    )

    return {
      id: id as Exclude<SupportBundleReviewSectionId, 'redaction'>,
      title: copy.title,
      summary:
        matchingDiagnostics.length > 0
          ? copy.summary
          : `${copy.summary} No current diagnostics are available from this context.`,
      itemCount: matchingDiagnostics.length,
      severity: severityForDiagnostics(matchingDiagnostics),
    }
  })

  sections.push({
    id: 'redaction',
    title: 'Redaction policy',
    summary:
      'Raw secrets, credentials, private keys, recovery material, and env values are excluded before any future export.',
    itemCount:
      supportBundleRedactionRules.length + supportBundleExcludedMaterial.length,
    severity: 'info',
  })

  return {
    exportAvailability: {
      state: 'unavailable',
      label: 'Export endpoint unavailable',
      reason:
        'A real broker support-bundle export endpoint is not wired in Service Admin yet.',
    },
    sections,
    redactionStatus: 'Secret-safe policy preview',
    approximateSizeLabel: 'Unavailable until backend estimates export size',
  }
}

export function supportBundleReviewHasSecretMaterial(
  review: SupportBundleReview
): boolean {
  return containsSecretLikeMaterial(JSON.stringify(review))
}
