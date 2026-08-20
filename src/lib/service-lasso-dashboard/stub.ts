import { countOperatorInboxItems, unreadBadgeCount } from './inbox'
import type {
  AuditEventsFilters,
  AuditEventsResult,
  DashboardAction,
  DashboardService,
  DashboardSummary,
  FleetServiceMetrics,
  InboxCountsResult,
  InboxListResult,
  InboxQuery,
  NetworkHomeEndpoint,
  OperatorInboxItem,
  RuntimeInstanceHome,
  ServiceConfigDocument,
  ServiceConfigRevision,
  ServiceConfigSaveResult,
  ServiceLogType,
  ServiceStatus,
  ServiceTelemetryPreview,
  ServiceTelemetrySignal,
  TelemetryPreview,
} from './types'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const configuredServiceLassoApiBaseUrl =
  import.meta.env.VITE_SERVICE_LASSO_API_BASE_URL?.replace(/\/$/, '')

export const serviceLassoApiBaseUrl = configuredServiceLassoApiBaseUrl ?? ''

export const stubDashboardDataEnabled =
  import.meta.env.DEV &&
  import.meta.env.VITE_SERVICE_LASSO_ENABLE_STUB_DATA === 'true'

/**
 * Reads stub-dashboard mode at call time so Vitest `vi.stubEnv` takes effect.
 * The module-load `stubDashboardDataEnabled` const is too early for route tests.
 */
export function isServiceAdminStubModeEnabled() {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_SERVICE_LASSO_ENABLE_STUB_DATA === 'true'
  )
}

/**
 * Reads the favorites kill-switch at call time so Vitest `vi.stubEnv` takes effect.
 * Packaged and live Admin enable favorite editing unless this env is exactly `false`.
 */
export function isFavoritesFeatureEnabled() {
  return import.meta.env.VITE_SERVICE_LASSO_FAVORITES_ENABLED !== 'false'
}

type RemoteServiceMeta = {
  id: string
  name?: string
  favorite?: boolean
  imageUrl?: string
}

async function fetchRemoteServiceMeta(): Promise<RemoteServiceMeta[] | null> {
  if (!configuredServiceLassoApiBaseUrl) return null

  try {
    const response = await fetch(`${serviceLassoApiBaseUrl}/api/services/meta`)
    if (!response.ok) return null

    const payload = (await response.json()) as {
      services?: RemoteServiceMeta[]
    }

    return payload.services ?? []
  } catch {
    return null
  }
}

function applyRemoteServiceMeta(serviceMeta: RemoteServiceMeta[]) {
  if (serviceMeta.length === 0) return

  const remoteMetaById = new Map(
    serviceMeta.map((service) => [service.id, service])
  )

  setServices(
    services.map((service) => {
      const remoteMeta = remoteMetaById.get(service.id)
      if (!remoteMeta) return service

      return {
        ...service,
        favorite:
          remoteMeta.favorite === undefined
            ? service.favorite
            : Boolean(remoteMeta.favorite),
        metadata: {
          ...service.metadata,
          imageUrl: remoteMeta.imageUrl ?? service.metadata.imageUrl,
        },
      }
    })
  )
}

async function syncFavoriteStateFromApi() {
  const remoteServiceMeta = await fetchRemoteServiceMeta()
  if (remoteServiceMeta) {
    applyRemoteServiceMeta(remoteServiceMeta)
  }
}

const stubStateStorageKey = 'service-lasso-dashboard-stub-state-v1'

const defaultServices: DashboardService[] = [
  {
    id: '@traefik',
    name: 'Traefik',
    status: 'running',
    favorite: true,
    role: 'Edge router and ingress controller',
    note: 'Primary edge router is healthy.',
    installed: true,
    links: [
      { label: 'Local', url: 'http://localhost:8080', kind: 'local' },
      { label: 'Route', url: 'https://traefik.localtest.me', kind: 'remote' },
    ],
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '4d 12h',
      lastCheckAt: '2026-04-11T10:18:00+10:00',
      lastRestartAt: '2026-04-07T21:54:00+10:00',
      summary: 'Ingress is serving routes and health checks are green.',
      pid: 8081,
      runId: '2026-04-07T21-54-00-000Z',
    },
    endpoints: [
      {
        label: 'Local dashboard',
        url: 'http://localhost:8080',
        bind: '127.0.0.1',
        port: 8080,
        protocol: 'http',
        exposure: 'local',
      },
      {
        label: 'LAN route',
        url: 'https://traefik.localtest.me',
        bind: '0.0.0.0',
        port: 443,
        protocol: 'https',
        exposure: 'public',
      },
    ],
    metadata: {
      serviceType: 'core-platform',
      runtime: 'docker',
      version: 'v3.1.2',
      build: 'sha256:traefik-demo',
      packageId: 'docker.io/library/traefik:3.1.2',
      installPath: 'C:\\service-lasso\\traefik',
      configPath: 'C:\\service-lasso\\traefik\\traefik.yml',
      dataPath: 'C:\\service-lasso\\traefik\\data',
      logPath: '/services/@traefik/service.log',
      workPath: 'C:\\service-lasso\\traefik',
      profile: 'default',
      imageUrl: '/services/@traefik/logo.svg',
    },
    dependencies: [],
    dependents: [
      {
        id: '@serviceadmin',
        name: 'Service Admin UI',
        status: 'running',
        relation: 'dependent',
        note: 'Admin UI is published through Traefik.',
      },
    ],
    environmentVariables: [
      {
        key: 'TRAEFIK_ENTRYPOINTS_WEB_ADDRESS',
        value: ':80',
        scope: 'service',
        source: 'service.json',
      },
      {
        key: 'TRAEFIK_ENTRYPOINTS_WEBSECURE_ADDRESS',
        value: ':443',
        scope: 'service',
        source: 'service.json',
      },
      {
        key: 'SERVICE_LASSO_ROOT',
        value: 'C:\\service-lasso',
        scope: 'global',
        source: '.env',
      },
    ],
    recentLogs: [
      {
        timestamp: '2026-04-11T10:17:44+10:00',
        level: 'info',
        source: 'healthcheck',
        message: 'All configured routers reported healthy responses.',
      },
      {
        timestamp: '2026-04-11T10:12:18+10:00',
        level: 'info',
        source: 'app',
        message: 'Route table reloaded after provider refresh.',
      },
    ],
    actions: [
      { id: 'start', label: 'Start service', kind: 'start' },
      { id: 'stop', label: 'Stop service', kind: 'stop' },
      { id: 'restart', label: 'Restart router', kind: 'restart' },
      { id: 'install', label: 'Install service', kind: 'install' },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
      { id: 'open_admin', label: 'Open dashboard', kind: 'open_admin' },
    ],
  },
  {
    id: '@serviceadmin',
    name: 'Service Admin UI',
    status: 'running',
    favorite: true,
    role: 'Operator dashboard for Service Lasso',
    note: 'Operator dashboard is reachable.',
    installed: true,
    links: [
      { label: 'Local', url: 'http://localhost:17700', kind: 'local' },
      { label: 'LAN', url: 'http://192.168.1.53:17700', kind: 'lan' },
    ],
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '2h 16m',
      lastCheckAt: '2026-04-11T10:19:00+10:00',
      lastRestartAt: '2026-04-11T08:03:00+10:00',
      summary:
        'UI responds on the required port and current stub actions are available.',
      pid: 17701,
      runId: '2026-04-11T08-03-00-000Z',
    },
    endpoints: [
      {
        label: 'Local UI',
        url: 'http://localhost:17700',
        bind: '0.0.0.0',
        port: 17700,
        protocol: 'http',
        exposure: 'local',
      },
      {
        label: 'LAN UI',
        url: 'http://192.168.1.53:17700',
        bind: '0.0.0.0',
        port: 17700,
        protocol: 'http',
        exposure: 'lan',
      },
    ],
    metadata: {
      serviceType: 'ui-admin',
      runtime: 'vite-preview',
      version: 'develop-stub',
      build: 'local-working-tree',
      packageId: 'lasso-@serviceadmin',
      installPath: 'C:\\projects\\service-lasso\\lasso-@serviceadmin',
      configPath:
        'C:\\projects\\service-lasso\\lasso-@serviceadmin\\vite.config.ts',
      dataPath: 'C:\\projects\\service-lasso\\lasso-@serviceadmin\\dist',
      logPath: '/services/@serviceadmin/service.log',
      workPath: 'C:\\projects\\service-lasso\\lasso-@serviceadmin',
      profile: 'develop',
    },
    dependencies: [
      {
        id: '@traefik',
        name: 'Traefik',
        status: 'running',
        relation: 'depends_on',
        note: 'Used for routed/public exposure patterns.',
      },
      {
        id: 'zitadel',
        name: 'ZITADEL',
        status: 'degraded',
        relation: 'depends_on',
        note: 'Future auth surface depends on stable identity provider health.',
      },
    ],
    dependents: [],
    environmentVariables: [
      {
        key: 'VITE_SERVICE_LASSO_API_BASE_URL',
        value: 'http://127.0.0.1:3001',
        templateValue: '${SERVICE_LASSO_RUNTIME_URL}',
        scope: 'service',
        source: '.env.local',
      },
      {
        key: 'VITE_SERVICE_LASSO_FAVORITES_ENABLED',
        value: 'true',
        scope: 'service',
        source: '.env.local',
      },
      {
        key: 'SESSION_SECRET',
        value: 'secret://@serviceadmin/SESSION_SECRET',
        templateValue: '${@serviceadmin.SESSION_SECRET}',
        scope: 'service',
        secret: true,
        source: '@secretsbroker/local/default',
      },
      {
        key: 'OPENCLAW_ANTHROPIC_API_KEY',
        value: 'secret://openclaw/anthropic/api_key',
        scope: 'service',
        secret: true,
        source: '@secretsbroker/openclaw/service-lasso',
      },
      {
        key: 'SERVICE_LASSO_ROOT',
        value: 'C:\\service-lasso',
        scope: 'global',
        source: '.env',
      },
      {
        key: 'SERVICE_LASSO_RUNTIME_CONFIG_PATH',
        value:
          'C:\\service-lasso\\profiles\\development\\services\\lasso-serviceadmin\\config\\runtime\\resolved\\service-lasso-runtime-config.json',
        scope: 'service',
        source:
          'C:\\service-lasso\\profiles\\development\\services\\lasso-serviceadmin\\service.json',
      },
    ],
    recentLogs: [
      {
        timestamp: '2026-04-11T10:18:11+10:00',
        level: 'info',
        source: 'stdout',
        message: 'GET /services/@serviceadmin returned 200 in 19ms.',
      },
      {
        timestamp: '2026-04-11T10:09:43+10:00',
        level: 'info',
        source: 'app',
        message: 'Dashboard stub actions mounted successfully.',
      },
    ],
    actions: [
      { id: 'start', label: 'Start service', kind: 'start' },
      { id: 'stop', label: 'Stop service', kind: 'stop' },
      { id: 'reload', label: 'Reload UI', kind: 'reload' },
      { id: 'install', label: 'Install service', kind: 'install' },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
      { id: 'open_config', label: 'Open config', kind: 'open_config' },
    ],
  },
  {
    id: 'zitadel',
    name: 'ZITADEL',
    status: 'degraded',
    favorite: false,
    role: 'Primary identity provider',
    note: 'SSO is reachable, but one upstream health check is lagging.',
    installed: true,
    links: [{ label: 'Local', url: 'http://localhost:8081', kind: 'local' }],
    runtimeHealth: {
      state: 'degraded',
      health: 'warning',
      uptime: '6d 2h',
      lastCheckAt: '2026-04-11T10:18:20+10:00',
      lastRestartAt: '2026-04-05T07:11:00+10:00',
      summary:
        'Auth service is up, but upstream checks show intermittent latency.',
    },
    endpoints: [
      {
        label: 'Local auth UI',
        url: 'http://localhost:8081',
        bind: '127.0.0.1',
        port: 8081,
        protocol: 'http',
        exposure: 'local',
      },
    ],
    metadata: {
      serviceType: 'identity',
      runtime: 'container',
      version: '2.57.0',
      build: 'zitadel-local-demo',
      packageId: 'ghcr.io/zitadel/zitadel:2.57.0',
      installPath: 'C:\\service-lasso\\zitadel',
      configPath: 'C:\\service-lasso\\zitadel\\zitadel.env',
      dataPath: 'C:\\service-lasso\\zitadel\\data',
      logPath: '/services/zitadel/service.log',
      workPath: 'C:\\service-lasso\\zitadel',
      profile: 'default',
    },
    dependencies: [],
    dependents: [
      {
        id: '@serviceadmin',
        name: 'Service Admin UI',
        status: 'running',
        relation: 'dependent',
        note: 'UI auth features eventually depend on Zitadel.',
      },
    ],
    environmentVariables: [
      {
        key: 'ZITADEL_EXTERNALDOMAIN',
        value: 'localhost',
        scope: 'service',
        source: 'zitadel.env',
      },
      {
        key: 'ZITADEL_EXTERNALPORT',
        value: '8081',
        scope: 'service',
        source: 'zitadel.env',
      },
      {
        key: 'POSTGRES_ADMIN_PASSWORD',
        value: 'secret://postgres.ADMIN_PASSWORD',
        scope: 'service',
        secret: true,
        source: '@secretsbroker/local/default',
      },
      {
        key: 'SERVICE_LASSO_ROOT',
        value: 'C:\\service-lasso',
        scope: 'global',
        source: '.env',
      },
    ],
    recentLogs: [
      {
        timestamp: '2026-04-11T10:17:01+10:00',
        level: 'warn',
        source: 'healthcheck',
        message: 'OIDC readiness probe exceeded expected latency budget.',
      },
      {
        timestamp: '2026-04-11T09:58:26+10:00',
        level: 'info',
        source: 'app',
        message: 'Auth realm configuration reloaded without restart.',
      },
    ],
    actions: [
      { id: 'start', label: 'Start identity service', kind: 'start' },
      { id: 'stop', label: 'Stop identity service', kind: 'stop' },
      { id: 'restart', label: 'Restart identity service', kind: 'restart' },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
      { id: 'open_admin', label: 'Open auth UI', kind: 'open_admin' },
    ],
  },
  {
    id: 'dagu',
    name: 'Dagu',
    status: 'stopped',
    favorite: false,
    role: 'Workflow engine',
    note: 'Workflow engine is not currently started.',
    installed: true,
    links: [{ label: 'Local', url: 'http://localhost:8082', kind: 'local' }],
    runtimeHealth: {
      state: 'stopped',
      health: 'critical',
      uptime: '0m',
      lastCheckAt: '2026-04-11T10:18:35+10:00',
      lastRestartAt: '2026-04-10T23:44:00+10:00',
      summary: 'Workflow engine is installed but currently offline.',
    },
    endpoints: [
      {
        label: 'Local workflow UI',
        url: 'http://localhost:8082',
        bind: '127.0.0.1',
        port: 8082,
        protocol: 'http',
        exposure: 'local',
      },
    ],
    metadata: {
      serviceType: 'workflow',
      runtime: 'binary-service',
      version: '0.17.1',
      build: 'dagu-demo-build',
      packageId: 'dagu@0.17.1',
      installPath: 'C:\\service-lasso\\dagu',
      configPath: 'C:\\service-lasso\\dagu\\config.yaml',
      dataPath: 'C:\\service-lasso\\dagu\\data',
      logPath: '/services/dagu/service.log',
      workPath: 'C:\\service-lasso\\dagu',
      profile: 'default',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [
      {
        key: 'DAGU_PORT',
        value: '8082',
        scope: 'service',
        source: 'config.yaml',
      },
      {
        key: 'DAGU_HOME',
        value: 'C:\\service-lasso\\dagu',
        scope: 'service',
        source: 'service.json',
      },
      {
        key: 'TELEGRAM_BOT_TOKEN',
        value: 'secret://telegram.bot_token',
        scope: 'service',
        secret: true,
        source: '@secretsbroker/external/ops',
      },
      {
        key: 'SERVICE_LASSO_ROOT',
        value: 'C:\\service-lasso',
        scope: 'global',
        source: '.env',
      },
    ],
    recentLogs: [
      {
        timestamp: '2026-04-11T09:51:05+10:00',
        level: 'error',
        source: 'supervisor',
        message: 'Service is stopped and awaiting explicit start action.',
      },
    ],
    actions: [
      { id: 'stop', label: 'Stop workflow engine', kind: 'stop' },
      { id: 'start', label: 'Start workflow engine', kind: 'start' },
      { id: 'install', label: 'Install workflow engine', kind: 'install' },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
      { id: 'open_admin', label: 'Open workflow UI', kind: 'open_admin' },
    ],
  },
]

type StubRuntimeState = {
  status: 'warning'
  lastReloadedAt: string
}

const defaultRuntime: StubRuntimeState = {
  status: 'warning' as const,
  lastReloadedAt: new Date('2026-04-10T19:55:00+10:00').toISOString(),
}

type PersistedStubState = {
  services?: DashboardService[]
  runtime?: StubRuntimeState
}

function getBrowserStorage() {
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function cloneDefaultServices() {
  return structuredClone(defaultServices)
}

function hasCurrentServiceSet(servicesToCheck: DashboardService[]) {
  const currentIds = new Set(defaultServices.map((service) => service.id))
  if (servicesToCheck.length !== currentIds.size) return false

  return servicesToCheck.every((service) => currentIds.has(service.id))
}

function restorePersistedServices(servicesToRestore?: DashboardService[]) {
  if (!servicesToRestore || !hasCurrentServiceSet(servicesToRestore)) {
    return cloneDefaultServices()
  }

  const persistedById = new Map(
    servicesToRestore.map((service) => [service.id, service])
  )

  return defaultServices.map((defaultService) => {
    const persistedService = persistedById.get(defaultService.id)
    if (!persistedService) return structuredClone(defaultService)

    return {
      ...structuredClone(defaultService),
      favorite:
        typeof persistedService.favorite === 'boolean'
          ? persistedService.favorite
          : defaultService.favorite,
      note:
        typeof persistedService.note === 'string'
          ? persistedService.note
          : defaultService.note,
      status: persistedService.status ?? defaultService.status,
      runtimeHealth: {
        ...defaultService.runtimeHealth,
        ...persistedService.runtimeHealth,
      },
      recentLogs: Array.isArray(persistedService.recentLogs)
        ? persistedService.recentLogs.slice(0, 5)
        : defaultService.recentLogs,
    }
  })
}

function restorePersistedRuntime(runtimeToRestore?: StubRuntimeState) {
  return {
    ...defaultRuntime,
    ...runtimeToRestore,
  }
}

function readPersistedStubState(): PersistedStubState {
  const storage = getBrowserStorage()
  if (!storage) return {}

  const rawState = storage.getItem(stubStateStorageKey)
  if (!rawState) return {}

  try {
    return JSON.parse(rawState) as PersistedStubState
  } catch {
    storage.removeItem(stubStateStorageKey)
    return {}
  }
}

function syncRelationshipStatuses(servicesToSync: DashboardService[]) {
  const serviceStateById = new Map(
    servicesToSync.map((service) => [
      service.id,
      { name: service.name, status: service.status },
    ])
  )

  const syncRelation = (relation: DashboardService['dependencies'][number]) => {
    const linkedService = serviceStateById.get(relation.id)
    if (!linkedService) return relation

    return {
      ...relation,
      name: linkedService.name,
      status: linkedService.status,
    }
  }

  return servicesToSync.map((service) => ({
    ...service,
    dependencies: service.dependencies.map(syncRelation),
    dependents: service.dependents.map(syncRelation),
  }))
}

const persistedState = readPersistedStubState()

let services: DashboardService[] = syncRelationshipStatuses(
  restorePersistedServices(persistedState.services)
)

let runtime = restorePersistedRuntime(persistedState.runtime)

const stubConfigRevisions = new Map<string, ServiceConfigRevision[]>()
const stubConfigContents = new Map<string, string>()

function stableHash(content: string) {
  let hash = 0
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function buildStubConfigContent(service: DashboardService) {
  return `${JSON.stringify(
    {
      id: service.id,
      name: service.name,
      description: service.note,
      enabled: service.status !== 'stopped',
      runtime: service.metadata.runtime,
      version: service.metadata.version,
      healthcheck: { type: 'process' },
      urls: service.endpoints.map((endpoint) => ({
        label: endpoint.label,
        url: endpoint.url,
      })),
    },
    null,
    2
  )}\n`
}

function requireJsonObject(content: string) {
  const parsed = JSON.parse(content) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('server.json content must be a JSON object.')
  }
  return `${JSON.stringify(parsed, null, 2)}\n`
}

function getStubConfigContent(service: DashboardService) {
  const existing = stubConfigContents.get(service.id)
  if (existing) return existing
  const content = buildStubConfigContent(service)
  stubConfigContents.set(service.id, content)
  return content
}

function persistStubState() {
  const storage = getBrowserStorage()
  if (!storage) return

  storage.setItem(
    stubStateStorageKey,
    JSON.stringify({
      services,
      runtime,
    } satisfies PersistedStubState)
  )
}

function setServices(nextServices: DashboardService[]) {
  services = syncRelationshipStatuses(nextServices)
  persistStubState()
}

export function __setStubServicesForTest(nextServices: DashboardService[]) {
  services = syncRelationshipStatuses(structuredClone(nextServices))
}

export function __setStubConfigRevisionsForTest(
  serviceId: string,
  revisions: ServiceConfigRevision[]
) {
  stubConfigRevisions.set(serviceId, structuredClone(revisions))
}

export function __resetStubServicesForTest() {
  services = syncRelationshipStatuses(cloneDefaultServices())
  stubConfigContents.clear()
  stubConfigRevisions.clear()
}

function serviceHealthForStatus(
  status: ServiceStatus
): DashboardService['runtimeHealth']['health'] {
  if (status === 'running' || status === 'available') return 'healthy'
  if (status === 'degraded') return 'warning'
  return 'critical'
}

function buildWarnings(currentServices: DashboardService[]) {
  const warnings: string[] = []

  if (currentServices.some((service) => service.status === 'degraded')) {
    warnings.push('One or more services are degraded and need attention.')
  }

  if (currentServices.some((service) => service.status === 'stopped')) {
    warnings.push('At least one managed service is currently stopped.')
  }

  return warnings
}

function buildSummary(): DashboardSummary {
  const warnings = buildWarnings(services)
  const favorites = services.filter((service) => service.favorite)
  const others = services.filter((service) => !service.favorite)

  return {
    runtime: {
      status: warnings.length > 0 ? 'warning' : 'healthy',
      lastReloadedAt: runtime.lastReloadedAt,
      warningCount: warnings.length,
    },
    servicesTotal: services.length,
    servicesRunning: services.filter((service) => service.status === 'running')
      .length,
    servicesAvailable: services.filter(
      (service) => service.status === 'available'
    ).length,
    servicesStopped: services.filter((service) => service.status === 'stopped')
      .length,
    servicesDegraded: services.filter(
      (service) => service.status === 'degraded'
    ).length,
    networkExposureCount: services.reduce(
      (count, service) => count + service.links.length,
      0
    ),
    installedCount: services.filter((service) => service.installed).length,
    favorites,
    others,
    warnings,
    problemServices: services.filter(
      (service) => service.status === 'degraded' || service.status === 'stopped'
    ),
  }
}

function syncFavoriteState(serviceId: string, favorite?: boolean) {
  setServices(
    services.map((service) =>
      service.id === serviceId
        ? {
            ...service,
            favorite: favorite ?? !service.favorite,
          }
        : service
    )
  )
}

async function updateFavoriteViaApi(serviceId: string, favorite: boolean) {
  if (!isFavoritesFeatureEnabled() || !serviceLassoApiBaseUrl) return false
  if (isServiceAdminStubModeEnabled()) return false

  try {
    const response = await fetch(
      `${serviceLassoApiBaseUrl}/api/services/${encodeURIComponent(serviceId)}/meta`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ favorite }),
      }
    )

    if (!response.ok) return false

    syncFavoriteState(serviceId, favorite)
    return true
  } catch {
    return false
  }
}

export async function fetchDashboardSummary() {
  await wait(120)
  await syncFavoriteStateFromApi()
  return structuredClone(buildSummary())
}

export async function fetchServices() {
  await wait(120)
  await syncFavoriteStateFromApi()
  return structuredClone(services)
}

export async function fetchTelemetryPreview(): Promise<TelemetryPreview> {
  await wait(120)
  return structuredClone({
    contractVersion: 'service-lasso.telemetry-preview.v1',
    exporter: {
      status: 'disabled',
      protocol: 'otlp-http',
      endpointConfigured: false,
      endpointValueReturned: false,
      headersValueReturned: false,
      reason:
        'OTLP export is disabled until runtime exporter settings are configured.',
    },
    resource: {
      serviceName: 'service-lasso-core',
      serviceNamespace: 'service-lasso',
      serviceInstanceId: 'stub-runtime',
    },
    traceContext: {
      propagation: 'w3c-trace-context',
      responseHeaders: {
        correlationId: 'x-service-lasso-correlation-id',
        traceId: 'x-service-lasso-trace-id',
        traceparent: 'traceparent',
      },
      traceparentSampled: true,
      incomingHeadersAccepted: false,
      incomingHeadersReturned: false,
      rawHeadersReturned: false,
      routeTemplateOnly: true,
    },
    redaction: {
      mode: 'allowlist',
      allowedAttributes: [
        'api.route_group',
        'http.route',
        'http.response.status_class',
        'service.id',
        'service.health.status',
      ],
      forbiddenFieldClasses: [
        'raw secret values',
        'environment values',
        'provider tokens or credentials',
        'cookies and authorization headers',
        'raw request or response bodies',
        'raw URL paths and query strings',
      ],
    },
    exportPreview: {
      mode: 'disabled',
      status: 'not_sent',
      signalCount: 42,
      serviceCount: services.length,
      endpointConfigured: false,
      endpointValueReturned: false,
      headersValueReturned: false,
      bodyValueReturned: false,
      allowedAttributeCount: 5,
      reason:
        'The Service Admin stub mirrors runtime telemetry status without exporter endpoints, headers, or payload bodies.',
    },
    apiRequestBuffer: {
      capacity: 50,
      retainedCount: 18,
      droppedCount: 3,
      routeTemplateOnly: true,
      rawMaterialReturned: false,
    },
    apiRequestSummary: {
      retainedCount: 18,
      droppedCount: 3,
      totalObservedCount: 21,
      mutatingCount: 2,
      routeGroups: [
        { key: 'health', count: 8 },
        { key: 'services', count: 6 },
        { key: 'telemetry', count: 4 },
      ],
      statusClasses: [
        { key: '2xx', count: 17 },
        { key: '4xx', count: 1 },
      ],
      outcomes: [
        { key: 'success', count: 17 },
        { key: 'failure', count: 1 },
      ],
      routeTemplateOnly: true,
      rawMaterialReturned: false,
    },
  } satisfies TelemetryPreview)
}

export async function fetchServiceTelemetryPreview(
  serviceId: string
): Promise<ServiceTelemetryPreview> {
  await wait(120)

  const service = services.find((item) => item.id === serviceId)
  const serviceVersion = service?.metadata.version ?? 'unknown'
  const running =
    service?.status === 'running' || service?.status === 'available'
  const signals: ServiceTelemetrySignal[] = [
    {
      kind: 'span',
      name: 'service_lasso.service.lifecycle',
      traceId: 'f2d1412190c7ec276ca474894c82eb27',
      spanId: '5a2ae73908a7986d',
      traceparent: '00-f2d1412190c7ec276ca474894c82eb27-5a2ae73908a7986d-01',
      correlationId: 'sl-85a59ffe07646ec3',
      attributes: {
        'service.id': serviceId,
        'service.role': 'service',
        'service.version': serviceVersion,
        'service.artifact.tag': serviceVersion,
        'service.artifact.asset':
          serviceId === '@secretsbroker'
            ? 'secretsbroker-win32.zip'
            : 'service-package.zip',
        'service.lifecycle.installed': Boolean(service?.installed),
        'service.lifecycle.running': running,
        'service.operation.phase': 'lifecycle',
        'service.operation.outcome': running ? 'healthy' : 'unavailable',
      },
    },
    {
      kind: 'span',
      name: 'service_lasso.service.health_check',
      traceId: 'f2d1412190c7ec276ca474894c82eb27',
      spanId: '771b717f65a3d595',
      traceparent: '00-f2d1412190c7ec276ca474894c82eb27-771b717f65a3d595-01',
      correlationId: 'sl-85a59ffe07646ec3',
      attributes: {
        'service.id': serviceId,
        'service.role': 'service',
        'service.version': serviceVersion,
        'service.health.status': running ? 'healthy' : 'critical',
        'service.health.readiness': running ? 'ready' : 'blocked',
        'service.operation.phase': 'health_check',
        'service.operation.outcome': running ? 'healthy' : 'unavailable',
      },
    },
    {
      kind: 'metric',
      name: 'service_lasso.service.runtime.launches',
      traceId: 'f2d1412190c7ec276ca474894c82eb27',
      spanId: '3df4003721bde212',
      traceparent: '00-f2d1412190c7ec276ca474894c82eb27-3df4003721bde212-01',
      correlationId: 'sl-85a59ffe07646ec3',
      attributes: {
        'service.id': serviceId,
        'service.role': 'service',
        'service.version': serviceVersion,
        'service.operation.phase': 'runtime_metrics',
        'service.operation.outcome': running ? 'healthy' : 'unavailable',
        'service.operation.duration_ms': 0,
      },
    },
  ]

  return structuredClone({
    serviceId,
    signals,
  } satisfies ServiceTelemetryPreview)
}

const stubAuditEvents = [
  {
    id: 'stub-audit-runtime-reload',
    timestamp: '2026-06-28T04:15:00.000Z',
    source: 'service-admin',
    action: 'runtime.reload',
    actor: 'operator-ui',
    outcome: 'success',
    statusCode: 200,
    summary: 'Runtime reload accepted from explicit Service Admin stub mode.',
    reason: 'stub audit fixture',
    correlationId: 'stub-correlation-runtime-reload',
    relatedRevisionId: null,
    chainId: 'runtime',
    sequence: 1,
    previousHash: null,
    eventHash: 'stub-runtime-reload-hash',
    chainStatus: 'valid',
  },
  {
    id: 'stub-audit-service-start',
    timestamp: '2026-06-28T04:10:00.000Z',
    source: 'runtime',
    action: 'service.lifecycle.start',
    actor: 'operator-ui',
    subject: 'start',
    serviceId: '@serviceadmin',
    method: 'POST',
    routeTemplate: '/api/services/:serviceId/start',
    outcome: 'success',
    statusCode: 200,
    summary: 'Service lifecycle start recorded in explicit stub mode.',
    reason: 'stub audit fixture',
    correlationId: 'stub-correlation-service-start',
    relatedRevisionId: null,
    chainId: 'service:@serviceadmin',
    sequence: 1,
    previousHash: null,
    eventHash: 'stub-service-start-hash',
    chainStatus: 'valid',
  },
  {
    id: 'stub-audit-config-save',
    timestamp: '2026-06-28T04:05:00.000Z',
    source: 'runtime',
    action: 'service.config.save',
    actor: 'operator-ui',
    subject: 'server.json',
    serviceId: '@serviceadmin',
    method: 'PUT',
    routeTemplate: '/api/services/:serviceId/config',
    outcome: 'failure',
    statusCode: 409,
    summary: 'Stub config save rejected by validation guard.',
    reason: 'stub audit fixture',
    correlationId: 'stub-correlation-config-save',
    relatedRevisionId: 'stub-revision-config-save',
    chainId: 'service:@serviceadmin',
    sequence: 2,
    previousHash: 'stub-service-start-hash',
    eventHash: 'stub-config-save-hash',
    chainStatus: 'valid',
  },
] satisfies AuditEventsResult['events']

function filterStubAuditEvents(filters: AuditEventsFilters = {}) {
  const query = filters.query?.trim().toLowerCase()

  return stubAuditEvents.filter((event) => {
    if (filters.serviceId && event.serviceId !== filters.serviceId) return false
    if (filters.actor && event.actor !== filters.actor) return false
    if (filters.action && event.action !== filters.action) return false
    if (filters.outcome && event.outcome !== filters.outcome) return false
    if (filters.source && event.source !== filters.source) return false
    if (filters.since && event.timestamp < filters.since) return false
    if (filters.until && event.timestamp > filters.until) return false

    if (query) {
      const haystack = [
        event.id,
        event.source,
        event.action,
        event.actor,
        event.subject,
        event.serviceId,
        event.method,
        event.routeTemplate,
        event.summary,
        event.reason,
        event.relatedRevisionId,
      ]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    }

    return true
  })
}

export async function fetchAuditEvents(
  filters: AuditEventsFilters = {}
): Promise<AuditEventsResult> {
  await wait(120)

  const limit = Math.max(1, Math.trunc(filters.limit ?? 100))
  const cursor = Math.max(0, Number.parseInt(filters.cursor ?? '0', 10) || 0)
  const events = filterStubAuditEvents(filters)
  const page = events.slice(cursor, cursor + limit)
  const nextCursor =
    cursor + page.length < events.length ? String(cursor + page.length) : null

  return structuredClone({
    status: 'available',
    stubMode: true,
    unavailableReason: null,
    events: page,
    pagination: {
      limit,
      nextCursor,
      total: events.length,
    },
  } satisfies AuditEventsResult)
}

function createDefaultInboxItems(): OperatorInboxItem[] {
  return [
    {
      id: 'inbox-update-available-traefik',
      dedupeKey: 'update:available:@traefik:current',
      title: 'Update available: @traefik',
      summary: 'Traefik has a newer package ready for review.',
      details:
        'Current version v3.1.2. Newer artifact is waiting in the update channel.',
      type: 'update',
      severity: 'info',
      source: 'updater',
      state: 'unread',
      visibility: 'visible',
      createdAt: '2026-08-20T01:10:00.000Z',
      updatedAt: '2026-08-20T01:10:00.000Z',
      readAt: null,
      hiddenAt: null,
      relatedTarget: {
        serviceId: '@traefik',
        route: '/services/%40traefik/updates',
      },
      action: {
        label: 'Open service',
        target: '/services/%40traefik/updates',
        kind: 'link',
        availability: 'available',
      },
    },
    {
      id: 'inbox-service-health-dagu',
      dedupeKey: 'service:health.degraded:dagu:current',
      title: 'Service health degraded: dagu',
      summary:
        'Dagu reported a degraded health check and needs operator review.',
      details: null,
      type: 'error',
      severity: 'warning',
      source: 'service',
      state: 'unread',
      visibility: 'visible',
      createdAt: '2026-08-20T01:12:00.000Z',
      updatedAt: '2026-08-20T01:12:00.000Z',
      readAt: null,
      hiddenAt: null,
      relatedTarget: {
        serviceId: 'dagu',
        route: '/services/dagu',
      },
      action: {
        label: 'Open service',
        target: '/services/dagu',
        kind: 'link',
        availability: 'available',
      },
    },
    {
      id: 'inbox-workflow-failed-serviceadmin',
      dedupeKey: 'workflow:serviceadmin-backup:run-22',
      title: 'Workflow needs attention: serviceadmin-backup',
      summary: 'Scheduled backup workflow failed before writing an archive.',
      details:
        'Inspect the service log for the failed run without opening secret material.',
      type: 'error',
      severity: 'error',
      source: 'workflow',
      state: 'unread',
      visibility: 'visible',
      createdAt: '2026-08-20T01:14:00.000Z',
      updatedAt: '2026-08-20T01:14:00.000Z',
      readAt: null,
      hiddenAt: null,
      relatedTarget: {
        serviceId: '@serviceadmin',
        workflowId: 'serviceadmin-backup',
        route: '/logs?service=%40serviceadmin',
      },
      action: {
        label: 'Open logs',
        target: '/logs?service=%40serviceadmin',
        kind: 'link',
        availability: 'available',
      },
    },
    {
      id: 'inbox-system-startup',
      dedupeKey: 'system:runtime.startup:current',
      title: 'Runtime startup',
      summary:
        'Service Lasso runtime finished startup and is accepting operator API traffic.',
      details: null,
      type: 'system',
      severity: 'info',
      source: 'system',
      state: 'unread',
      visibility: 'visible',
      createdAt: '2026-08-20T01:00:00.000Z',
      updatedAt: '2026-08-20T01:00:00.000Z',
      readAt: null,
      hiddenAt: null,
      relatedTarget: {
        route: '/runtime',
      },
      action: {
        label: 'Review',
        target: '/runtime',
        kind: 'link',
        availability: 'available',
      },
    },
    {
      id: 'inbox-diagnostics-archive',
      dedupeKey: 'diagnostics:archive.completed:@serviceadmin',
      title: 'Diagnostics archive completed',
      summary: 'A metadata-only diagnostics archive is ready for local review.',
      details:
        'The archive path is recorded by the runtime. Secret values are not included.',
      type: 'help',
      severity: 'success',
      source: 'runtime',
      state: 'read',
      visibility: 'visible',
      createdAt: '2026-08-19T22:40:00.000Z',
      updatedAt: '2026-08-19T22:45:00.000Z',
      readAt: '2026-08-19T22:45:00.000Z',
      hiddenAt: null,
      relatedTarget: {
        serviceId: '@serviceadmin',
        route: '/logs?service=%40serviceadmin',
      },
      action: {
        label: 'Open logs',
        target: '/logs?service=%40serviceadmin',
        kind: 'link',
        availability: 'available',
      },
    },
    {
      id: 'inbox-update-installed-serviceadmin',
      dedupeKey: 'update:installed:@serviceadmin:current',
      title: 'Update installed: @serviceadmin',
      summary:
        'Service Admin installed the selected artifact and remains healthy.',
      details: null,
      type: 'update',
      severity: 'success',
      source: 'updater',
      state: 'read',
      visibility: 'visible',
      createdAt: '2026-08-19T21:15:00.000Z',
      updatedAt: '2026-08-19T21:20:00.000Z',
      readAt: '2026-08-19T21:20:00.000Z',
      hiddenAt: null,
      relatedTarget: {
        serviceId: '@serviceadmin',
        route: '/services/%40serviceadmin',
      },
      action: {
        label: 'Open service',
        target: '/services/%40serviceadmin',
        kind: 'link',
        availability: 'available',
      },
    },
  ]
}

let stubInboxItems = createDefaultInboxItems()

/**
 * Restores fixture Inbox items so unit tests do not leak mark-read mutations.
 */
export function resetStubInbox() {
  stubInboxItems = createDefaultInboxItems()
}

function matchesInboxFilter(
  item: OperatorInboxItem,
  filter: NonNullable<InboxQuery['filter']>
) {
  if (filter === 'all') {
    return item.visibility === 'visible'
  }
  if (filter === 'unread') {
    return item.state === 'unread' && item.visibility === 'visible'
  }
  if (filter === 'updates') {
    return item.type === 'update' && item.visibility === 'visible'
  }
  if (filter === 'system') {
    return item.type === 'system' && item.visibility === 'visible'
  }
  if (filter === 'workflow') {
    return item.type === 'workflow' && item.visibility === 'visible'
  }
  if (filter === 'service') {
    return item.type === 'service' && item.visibility === 'visible'
  }
  if (filter === 'errors') {
    return (
      (item.type === 'error' ||
        item.severity === 'error' ||
        item.severity === 'critical') &&
      item.visibility === 'visible'
    )
  }
  return item.visibility === 'hidden'
}

function listStubInboxItems(query: InboxQuery = {}): InboxListResult {
  const filter = query.filter ?? 'all'
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200)
  const offset = query.cursor
    ? Math.max(Number.parseInt(query.cursor, 10) || 0, 0)
    : 0
  const filtered = stubInboxItems.filter((item) =>
    matchesInboxFilter(item, filter)
  )
  const page = filtered.slice(offset, offset + limit)
  const nextOffset = offset + page.length

  return structuredClone({
    status: 'available',
    stubMode: true,
    unavailableReason: null,
    items: page,
    pagination: {
      limit,
      nextCursor: nextOffset < filtered.length ? String(nextOffset) : null,
      total: filtered.length,
    },
  } satisfies InboxListResult)
}

/**
 * Returns fixture Inbox messages used by Playwright and local stub mode.
 */
export async function fetchInbox(
  query: InboxQuery = {}
): Promise<InboxListResult> {
  await wait(40)
  return listStubInboxItems(query)
}

/**
 * Returns fixture Inbox unread counts for header and sidebar badges.
 */
export async function fetchInboxCounts(): Promise<InboxCountsResult> {
  await wait(40)
  const counts = countOperatorInboxItems(stubInboxItems)
  return structuredClone({
    status: 'available',
    stubMode: true,
    unavailableReason: null,
    unread: unreadBadgeCount(counts),
    counts,
  } satisfies InboxCountsResult)
}

/**
 * Fixture fleet metrics so home crash/log chips work in Playwright stub mode.
 */
export async function fetchFleetMetrics(): Promise<FleetServiceMetrics[]> {
  await wait(40)
  return services.map((service) => ({
    serviceId: service.id,
    running: service.status === 'running',
    crashCount: 0,
    lastTermination: service.status === 'stopped' ? 'stopped' : null,
    stdoutLines: service.recentLogs.filter((entry) => entry.source === 'stdout')
      .length,
    stderrLines: service.recentLogs.filter((entry) => entry.source === 'stderr')
      .length,
  }))
}

/**
 * Fixture generation lane for Dashboard home in stub mode.
 */
export async function fetchRuntimeInstanceHome(): Promise<RuntimeInstanceHome> {
  await wait(40)
  return {
    phase: 'running',
    activeGenerationId: 'stub-gen-01',
    classification: 'selected',
    staleCount: 0,
  }
}

/**
 * Fixture network endpoints for Traefik reserved-route counting in stub mode.
 */
export async function fetchNetworkHome(): Promise<NetworkHomeEndpoint[]> {
  await wait(40)
  return services.flatMap((service) =>
    service.endpoints.map((endpoint) => ({
      serviceId: service.id,
      label: endpoint.label,
      port: endpoint.port,
      bind: endpoint.bind,
      kind: endpoint.exposure,
    }))
  )
}

/**
 * Marks one fixture Inbox item read while preserving other records.
 */
export async function markInboxRead(itemId: string): Promise<InboxListResult> {
  await wait(40)
  const now = '2026-08-20T02:00:00.000Z'
  stubInboxItems = stubInboxItems.map((item) => {
    if (item.id !== itemId) {
      return item
    }
    return {
      ...item,
      state: 'read',
      updatedAt: now,
      readAt: now,
    }
  })
  return listStubInboxItems({ filter: 'all', limit: 200 })
}

/**
 * Marks many fixture Inbox items read in one operator action.
 */
export async function markInboxItemsRead(
  itemIds: string[]
): Promise<InboxListResult> {
  await wait(40)
  const selected = new Set(itemIds)
  const now = '2026-08-20T02:00:00.000Z'
  stubInboxItems = stubInboxItems.map((item) => {
    if (!selected.has(item.id)) {
      return item
    }
    return {
      ...item,
      state: 'read',
      updatedAt: now,
      readAt: now,
    }
  })
  return listStubInboxItems({ filter: 'all', limit: 200 })
}

/**
 * Hides one fixture Inbox item while keeping it restorable.
 */
export async function hideInboxItem(itemId: string): Promise<InboxListResult> {
  await wait(40)
  const now = '2026-08-20T02:00:00.000Z'
  stubInboxItems = stubInboxItems.map((item) => {
    if (item.id !== itemId) {
      return item
    }
    return {
      ...item,
      visibility: 'hidden',
      updatedAt: now,
      hiddenAt: now,
    }
  })
  return listStubInboxItems({ filter: 'all', limit: 200 })
}

/**
 * Restores one hidden fixture Inbox item to the visible list.
 */
export async function unhideInboxItem(
  itemId: string
): Promise<InboxListResult> {
  await wait(40)
  const now = '2026-08-20T02:00:00.000Z'
  stubInboxItems = stubInboxItems.map((item) => {
    if (item.id !== itemId) {
      return item
    }
    return {
      ...item,
      visibility: 'visible',
      updatedAt: now,
      hiddenAt: null,
    }
  })
  return listStubInboxItems({ filter: 'all', limit: 200 })
}

export async function fetchDashboardService(serviceId: string) {
  await wait(120)
  await syncFavoriteStateFromApi()
  return (
    structuredClone(services.find((service) => service.id === serviceId)) ??
    null
  )
}

export async function fetchServiceConfigDocument(
  serviceId: string
): Promise<ServiceConfigDocument> {
  await wait(120)
  const service = services.find((item) => item.id === serviceId)
  if (!service) {
    throw new Error(`Service ${serviceId} was not found by the stub runtime.`)
  }
  const content = getStubConfigContent(service)
  const revisions = stubConfigRevisions.get(serviceId) ?? []

  return structuredClone({
    serviceId,
    fileName: 'server.json',
    path:
      service.metadata.configPath ??
      `C:\\service-lasso\\services\\${serviceId}\\service.json`,
    content,
    hash: stableHash(content),
    updatedAt: new Date('2026-06-23T02:00:00+10:00').toISOString(),
    backupCount: revisions.length,
    revisions,
    safety: {
      rawSecretValuesLoaded: false,
      omittedSensitiveFields: [
        'resolved environment values',
        'provider credentials',
        'authorization headers',
        'runtime-only process state',
      ],
    },
  } satisfies ServiceConfigDocument)
}

export async function saveServiceConfigDocument({
  serviceId,
  content,
  reason,
}: {
  serviceId: string
  content: string
  reason?: string | null
}): Promise<ServiceConfigSaveResult> {
  await wait(180)
  const service = services.find((item) => item.id === serviceId)
  if (!service) {
    throw new Error(`Service ${serviceId} was not found by the stub runtime.`)
  }

  const previousContent = getStubConfigContent(service)
  const normalizedContent = requireJsonObject(content)
  const savedAt = new Date().toISOString()
  const revision: ServiceConfigRevision = {
    id: `stub-revision-${Date.now()}`,
    createdAt: savedAt,
    actor: 'service-admin-web',
    reason: reason?.trim() || null,
    path: `${service.metadata.workPath ?? serviceId}\\.state\\config-backups\\server.json`,
    previousHash: stableHash(previousContent),
    currentHash: stableHash(normalizedContent),
    validationStatus: 'valid',
    content: previousContent,
  }
  const revisions = [revision, ...(stubConfigRevisions.get(serviceId) ?? [])]
  stubConfigRevisions.set(serviceId, revisions)
  stubConfigContents.set(serviceId, normalizedContent)

  return structuredClone({
    serviceId,
    fileName: 'server.json',
    path:
      service.metadata.configPath ??
      `C:\\service-lasso\\services\\${serviceId}\\service.json`,
    hash: stableHash(normalizedContent),
    savedAt,
    backup: revision,
    validationStatus: 'valid',
  } satisfies ServiceConfigSaveResult)
}

export function resolveStubServiceLogInfo(
  serviceId: string,
  type: ServiceLogType = 'default'
) {
  const service = services.find((item) => item.id === serviceId)
  if (!service) return null

  const defaultPath =
    service.metadata.logPath ?? '/mock-logs/service-sample.log'
  const availableTypes: ServiceLogType[] = ['default', 'stdout', 'stderr']

  return {
    serviceId,
    type,
    path:
      type === 'stdout'
        ? defaultPath.replace(/\.log$/i, '.stdout.log')
        : type === 'stderr'
          ? defaultPath.replace(/\.log$/i, '.stderr.log')
          : defaultPath,
    availableTypes,
  }
}

export function buildStubServiceLogUrl(
  serviceId: string,
  options?: {
    type?: ServiceLogType
  }
) {
  const params = new URLSearchParams({
    service: serviceId,
    type: options?.type ?? 'default',
  })

  return `/api/logs/content?${params.toString()}`
}

function updateServiceLifecycleState({
  service,
  nextStatus,
  note,
  logMessage,
  now,
  restartRecorded,
}: {
  service: DashboardService
  nextStatus: ServiceStatus
  note: string
  logMessage: string
  now: string
  restartRecorded: boolean
}) {
  return {
    ...service,
    status: nextStatus,
    note,
    runtimeHealth: {
      ...service.runtimeHealth,
      state: nextStatus,
      health: serviceHealthForStatus(nextStatus),
      uptime: nextStatus === 'running' ? '0m' : '0m',
      lastCheckAt: now,
      lastRestartAt: restartRecorded
        ? now
        : service.runtimeHealth.lastRestartAt,
      summary: note,
    },
    recentLogs: [
      {
        timestamp: now,
        level: 'info' as const,
        source: 'supervisor' as const,
        message: logMessage,
      },
      ...service.recentLogs,
    ].slice(0, 5),
  }
}

export async function runDashboardAction(action: DashboardAction) {
  await wait(180)
  const now = new Date().toISOString()

  if (action === 'reload-runtime') {
    runtime = {
      ...runtime,
      lastReloadedAt: now,
    }
    persistStubState()
  } else if (action === 'start-services') {
    setServices(
      services.map((service) => {
        if (service.status !== 'stopped') return service

        return updateServiceLifecycleState({
          service,
          nextStatus: 'running',
          note: 'Service was started from the dashboard action.',
          logMessage: 'Service started from dashboard bulk action.',
          now,
          restartRecorded: true,
        })
      })
    )
  } else if (action === 'stop-services') {
    setServices(
      services.map((service) =>
        updateServiceLifecycleState({
          service,
          nextStatus: 'stopped',
          note: 'Service was stopped from the dashboard action.',
          logMessage: 'Service stopped from dashboard bulk action.',
          now,
          restartRecorded: false,
        })
      )
    )
  } else if (action === 'restart-services') {
    setServices(
      services.map((service) =>
        updateServiceLifecycleState({
          service,
          nextStatus: 'running',
          note: 'Service was restarted from the dashboard action.',
          logMessage: 'Service restarted from dashboard bulk action.',
          now,
          restartRecorded: true,
        })
      )
    )
  } else if (action.kind === 'service-lifecycle') {
    const nextStatus = action.action === 'stop' ? 'stopped' : 'running'
    const actionLabel = {
      restart: 'restarted',
      start: 'started',
      stop: 'stopped',
    }[action.action]

    setServices(
      services.map((service) => {
        if (service.id !== action.serviceId) return service

        return updateServiceLifecycleState({
          service,
          nextStatus,
          note: `Service was ${actionLabel} from the Service Admin UI.`,
          logMessage: `Service ${action.action} requested from Service Admin UI.`,
          now,
          restartRecorded: action.action !== 'stop',
        })
      })
    )
  } else {
    const service = services.find((item) => item.id === action.serviceId)
    const nextFavorite = service ? !service.favorite : true
    const updated = await updateFavoriteViaApi(action.serviceId, nextFavorite)

    if (!updated) {
      syncFavoriteState(action.serviceId, nextFavorite)
    }
  }

  return structuredClone(buildSummary())
}

export {
  applyBrokerBulkCampaign,
  applyBrokerLifecycleRestore,
  applyBrokerMigration,
  applyManagedSecretCreate,
  applyManagedSecretMutation,
  applySecretDecommission,
  clearBrokerLockout,
  createBrokerBulkCampaign,
  createBrokerLifecycleBackup,
  executeCoreSecretRotation,
  fetchBrokerEvents,
  fetchBrokerLifecycleBackups,
  fetchBrokerLifecycleStatus,
  fetchBrokerProviderStatus,
  fetchBrokerTelemetry,
  fetchBrokerBulkCampaignStatus,
  fetchCoreSecretRotationImpactPlan,
  fetchRuntimeJson,
  fetchSecretsManagementState,
  normalizeBrokerEvents,
  normalizeBrokerTelemetry,
  previewBrokerLifecycleRestore,
  previewBrokerMigration,
  previewManagedSecretCreate,
  previewManagedSecretMutation,
  previewManagedSecretPolicy,
  previewSecretDecommission,
  previewSecretRotation,
  providerSupportsMigrationApply,
  restoreSecretDecommission,
  revealManagedSecret,
  revalidateBrokerBulkCampaign,
  rotateBrokerLifecycleKey,
  runSecretRotationVersionAction,
  serviceLassoStubDataEnabled,
  validateBrokerProviderConfiguration,
  verifyBrokerLifecycleBackup,
} from './broker-operator-client'
