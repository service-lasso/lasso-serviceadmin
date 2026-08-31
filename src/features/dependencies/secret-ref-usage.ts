import type { DashboardService } from '@/lib/service-lasso-dashboard/types'

export type SecretRefOutcome = 'resolved' | 'missing' | 'denied' | 'unresolved'

export type SecretRefUsageRow = {
  id: string
  ref: string
  namespace: string
  serviceId: string
  serviceName: string
  direction: 'imports' | 'exports'
  providerConnection: string
  source: string
  lastResolvedAt: string | null
  outcome: SecretRefOutcome
  legacyGlobalEnv: boolean
}

const knownSecretRefMetadata: Record<
  string,
  Pick<
    SecretRefUsageRow,
    'providerConnection' | 'source' | 'lastResolvedAt' | 'outcome'
  >
> = {
  'openclaw/anthropic/api_key': {
    providerConnection: 'OpenClaw SecretRef adapter',
    source: '@secretsbroker/openclaw/service-lasso',
    lastResolvedAt: '2026-05-07T17:40:00Z',
    outcome: 'resolved',
  },
  'postgres.ADMIN_PASSWORD': {
    providerConnection: 'Local encrypted vault',
    source: '@secretsbroker/local/default',
    lastResolvedAt: null,
    outcome: 'denied',
  },
  'telegram.bot_token': {
    providerConnection: 'External token store',
    source: '@secretsbroker/external/ops',
    lastResolvedAt: null,
    outcome: 'missing',
  },
  '@serviceadmin/SESSION_SECRET': {
    providerConnection: 'Generated secret write-back',
    source: '@secretsbroker/local/default',
    lastResolvedAt: '2026-05-07T16:58:00Z',
    outcome: 'resolved',
  },
}

function normalizeSecretRef(value: string) {
  return value
    .replace(/^secret:\/\//, '')
    .replace(/^secretsbroker:\/\//, '')
    .replace(/^exec:\/\//, '')
    .replace(/^vault:\/\//, '')
}

function isSecretRefLike(value: string, source?: string) {
  return (
    /^(secret|secretsbroker|exec|vault):\/\//i.test(value) ||
    /@secretsbroker|Secrets Broker|SecretRef/i.test(source ?? '')
  )
}

function namespaceFor(ref: string) {
  if (ref.includes('/')) return ref.split('/').slice(0, -1).join('/')
  if (ref.includes('.')) return ref.split('.').slice(0, -1).join('.')
  return 'default'
}

export function buildSecretRefUsageRows(
  services: DashboardService[]
): SecretRefUsageRow[] {
  return services
    .flatMap((service) =>
      service.environmentVariables
        .filter((variable) => isSecretRefLike(variable.value, variable.source))
        .map((variable) => {
          const ref = normalizeSecretRef(variable.value)
          const known = knownSecretRefMetadata[ref]

          return {
            id: `${service.id}:${variable.key}:${ref}`,
            ref,
            namespace: namespaceFor(ref),
            serviceId: service.id,
            serviceName: service.name,
            direction: 'imports' as const,
            providerConnection:
              known?.providerConnection ?? 'Secrets Broker provider',
            source: known?.source ?? variable.source ?? '@secretsbroker',
            lastResolvedAt: known?.lastResolvedAt ?? null,
            outcome: known?.outcome ?? 'unresolved',
            legacyGlobalEnv: variable.source?.toLowerCase() === 'globalenv',
          }
        })
    )
    .sort((a, b) => a.ref.localeCompare(b.ref))
}

export function groupSecretRefUsageByService(rows: SecretRefUsageRow[]) {
  const map = new Map<string, SecretRefUsageRow[]>()

  rows.forEach((row) => {
    map.set(row.serviceId, [...(map.get(row.serviceId) ?? []), row])
  })

  return Array.from(map.entries()).map(([serviceId, refs]) => ({
    serviceId,
    serviceName: refs[0]?.serviceName ?? serviceId,
    refs,
  }))
}

export function groupSecretRefUsageByRef(rows: SecretRefUsageRow[]) {
  const map = new Map<string, SecretRefUsageRow[]>()

  rows.forEach((row) => {
    map.set(row.ref, [...(map.get(row.ref) ?? []), row])
  })

  return Array.from(map.entries()).map(([ref, services]) => ({
    ref,
    namespace: services[0]?.namespace ?? 'default',
    services,
  }))
}
