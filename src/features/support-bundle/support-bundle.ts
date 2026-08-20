import type {
  DashboardService,
  DashboardSummary,
} from '@/lib/service-lasso-dashboard/types'

export type SupportBundleSeverity = 'info' | 'warning' | 'error'

export type SupportBundleReviewSectionId =
  | 'configuration'
  | 'runtime'
  | 'provider'
  | 'auth'
  | 'permission'
  | 'redaction'

export type SupportBundleSourceState =
  | 'available'
  | 'loading'
  | 'unavailable'
  | 'error'

export interface SupportBundleReviewSection {
  id: SupportBundleReviewSectionId
  title: string
  summary: string
  itemCount: number
  severity: SupportBundleSeverity
}

export interface SupportBundleReviewItem {
  id: string
  title: string
  source: string
  status: SupportBundleSeverity
  details: string[]
}

export interface SupportBundleReview {
  exportAvailability: {
    state: 'unavailable'
    label: string
    reason: string
  }
  sourceState: {
    state: SupportBundleSourceState
    label: string
    summary: string
  }
  sections: SupportBundleReviewSection[]
  previewItems: SupportBundleReviewItem[]
  redactionStatus: string
  approximateSizeLabel: string
}

export type SupportBundleRuntimeInput = {
  summary?: DashboardSummary
  services?: DashboardService[]
  isLoading?: boolean
  error?: unknown
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
  /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|client[_-]?secret|session[_-]?secret|secret|password|cookie|private[_-]?key|recovery[_-]?key|env[_-]?value)\s*[:=]\s*([^\s,;]+)/gi
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
      /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|client[_-]?secret|session[_-]?secret|secret|password|cookie|private[_-]?key|recovery[_-]?key|env[_-]?value)\s*[:=]\s*([^\s,;]+)/gi
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

function serviceSeverity(services: DashboardService[]): SupportBundleSeverity {
  if (
    services.some(
      (service) =>
        service.status === 'stopped' ||
        service.runtimeHealth.health === 'critical'
    )
  ) {
    return 'error'
  }

  if (
    services.some(
      (service) =>
        service.status === 'degraded' ||
        service.runtimeHealth.health === 'warning'
    )
  ) {
    return 'warning'
  }

  return 'info'
}

function sourceStateForRuntimeInput(
  input: SupportBundleRuntimeInput
): SupportBundleReview['sourceState'] {
  if (input.isLoading) {
    return {
      state: 'loading',
      label: 'Collecting live diagnostics',
      summary: 'Runtime and service metadata are still loading.',
    }
  }

  if (input.error) {
    return {
      state: 'error',
      label: 'Live diagnostics unavailable',
      summary:
        'Runtime API data could not be loaded, so no bundle preview payload is prepared.',
    }
  }

  const serviceCount = input.services?.length ?? 0

  if (!input.summary && serviceCount === 0) {
    return {
      state: 'unavailable',
      label: 'No live diagnostics loaded',
      summary:
        'No runtime dashboard data is available for support bundle review.',
    }
  }

  return {
    state: 'available',
    label: 'Live diagnostics preview',
    summary: `${serviceCount} service${serviceCount === 1 ? '' : 's'} loaded from the current runtime dashboard context.`,
  }
}

function buildPreviewItems({
  summary,
  services = [],
}: SupportBundleRuntimeInput): SupportBundleReviewItem[] {
  const items: SupportBundleReviewItem[] = []

  if (summary) {
    items.push({
      id: 'runtime-summary',
      title: 'Runtime health summary',
      source: 'Service Lasso runtime API',
      status: summary.runtime.status === 'warning' ? 'warning' : 'info',
      details: [
        `${summary.servicesRunning} running`,
        `${summary.servicesAvailable ?? 0} available`,
        `${summary.servicesDegraded} degraded`,
        `${summary.servicesStopped} stopped`,
        `${summary.runtime.warningCount} runtime warnings`,
      ],
    })
  }

  const problemServices = services.filter(
    (service) =>
      service.status === 'degraded' ||
      service.status === 'stopped' ||
      service.runtimeHealth.health !== 'healthy'
  )

  if (problemServices.length) {
    items.push({
      id: 'service-health-problems',
      title: 'Service health exceptions',
      source: 'Service Lasso runtime API',
      status: serviceSeverity(problemServices),
      details: problemServices.map((service) =>
        redactDiagnosticText(
          `${service.id}: ${service.status}; ${service.runtimeHealth.summary}`
        )
      ),
    })
  }

  const secretRefs = services.flatMap((service) =>
    service.environmentVariables
      .filter(
        (variable) => variable.secret || variable.value.startsWith('secret://')
      )
      .map(
        (variable) =>
          `${service.id}: ${variable.key} from ${variable.source ?? 'runtime metadata'} (value excluded)`
      )
  )

  if (secretRefs.length) {
    items.push({
      id: 'secret-ref-inventory',
      title: 'Secret reference inventory',
      source: 'Service metadata',
      status: 'info',
      details: secretRefs,
    })
  }

  const endpointDetails = services.flatMap((service) =>
    service.endpoints.map(
      (endpoint) =>
        `${service.id}: ${endpoint.label} ${endpoint.protocol}/${endpoint.exposure} ${endpoint.bind}:${endpoint.port}`
    )
  )

  if (endpointDetails.length) {
    items.push({
      id: 'route-endpoint-metadata',
      title: 'Route and endpoint metadata',
      source: 'Service metadata',
      status: 'info',
      details: endpointDetails,
    })
  }

  const logDetails = services.flatMap((service) =>
    service.recentLogs
      .slice(0, 3)
      .map((entry) =>
        redactDiagnosticText(
          `${service.id}: ${entry.timestamp} ${entry.level}/${entry.source} ${entry.message}`
        )
      )
  )

  if (logDetails.length) {
    items.push({
      id: 'recent-log-summaries',
      title: 'Recent log summaries',
      source: 'Runtime log preview',
      status: logDetails.some((line) => line.includes(' error/'))
        ? 'warning'
        : 'info',
      details: logDetails,
    })
  }

  return items
}

export function buildSupportBundleReview(
  input: SupportBundleRuntimeInput = {}
): SupportBundleReview {
  const services = input.services ?? []
  const previewItems = buildPreviewItems(input)
  const sectionCounts: Record<
    Exclude<SupportBundleReviewSectionId, 'redaction'>,
    number
  > = {
    configuration: services.filter(
      (service) =>
        service.metadata.configPath ||
        service.metadata.dataPath ||
        service.metadata.installPath
    ).length,
    runtime: input.summary ? 1 + services.length : services.length,
    provider: services.filter(
      (service) =>
        service.id.toLowerCase().includes('secretsbroker') ||
        service.name.toLowerCase().includes('secrets broker')
    ).length,
    auth: services.reduce(
      (count, service) =>
        count +
        service.environmentVariables.filter(
          (variable) =>
            variable.secret || variable.value.startsWith('secret://')
        ).length,
      0
    ),
    permission: services.reduce(
      (count, service) => count + service.dependencies.length,
      0
    ),
  }
  const overallSeverity = serviceSeverity(services)

  const sections: SupportBundleReviewSection[] = Object.entries(
    sectionCopy
  ).map(([id, copy]) => {
    const sectionId = id as Exclude<SupportBundleReviewSectionId, 'redaction'>
    const itemCount = sectionCounts[sectionId]

    return {
      id: sectionId,
      title: copy.title,
      summary:
        itemCount > 0
          ? copy.summary
          : `${copy.summary} No live records are currently available for this category.`,
      itemCount,
      severity:
        sectionId === 'runtime' || sectionId === 'provider'
          ? overallSeverity
          : 'info',
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
        'A real redacted support-bundle export endpoint is not wired in Service Admin yet.',
    },
    sourceState: sourceStateForRuntimeInput(input),
    sections,
    previewItems,
    redactionStatus: 'Secret-safe policy preview',
    approximateSizeLabel:
      previewItems.length > 0
        ? `${previewItems.length} metadata group${previewItems.length === 1 ? '' : 's'} in review`
        : 'Unavailable until live metadata is loaded',
  }
}

export function supportBundleReviewHasSecretMaterial(
  review: SupportBundleReview
): boolean {
  return containsSecretLikeMaterial(JSON.stringify(review))
}
