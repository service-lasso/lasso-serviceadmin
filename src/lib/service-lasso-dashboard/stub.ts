import type {
  DashboardAction,
  DashboardService,
  DashboardSummary,
  ServiceStatus,
} from './types'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const serviceLassoApiBaseUrl =
  import.meta.env.VITE_SERVICE_LASSO_API_BASE_URL?.replace(/\/$/, '') ??
  (import.meta.env.PROD ? '' : null)

export const stubDashboardDataEnabled = serviceLassoApiBaseUrl === null

export const favoritesFeatureEnabled =
  import.meta.env.VITE_SERVICE_LASSO_FAVORITES_ENABLED === 'true'

export const favoritesMutationEnabled =
  favoritesFeatureEnabled && Boolean(serviceLassoApiBaseUrl)

type RemoteServiceMeta = {
  id: string
  name?: string
  favorite?: boolean
  imageUrl?: string
}

async function fetchRemoteServiceMeta(): Promise<RemoteServiceMeta[] | null> {
  if (serviceLassoApiBaseUrl === null) return null

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

  if (!currentServices.some((service) => service.favorite)) {
    warnings.push('No favorite services are configured for quick access.')
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
    servicesAvailable: services.filter((service) => service.status === 'available')
      .length,
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
  if (!favoritesMutationEnabled || !serviceLassoApiBaseUrl) return false

  try {
    const response = await fetch(
      `${serviceLassoApiBaseUrl}/api/services/${serviceId}/meta`,
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

export async function fetchDashboardService(serviceId: string) {
  await wait(120)
  await syncFavoriteStateFromApi()
  return (
    structuredClone(services.find((service) => service.id === serviceId)) ??
    null
  )
}

export function resolveStubServiceLogInfo(
  serviceId: string,
  type: 'default' | 'access' | 'error' = 'default'
) {
  const service = services.find((item) => item.id === serviceId)
  if (!service) return null

  const defaultPath =
    service.metadata.logPath ?? '/mock-logs/service-sample.log'
  const availableTypes: Array<'default' | 'access' | 'error'> = ['default']

  return {
    serviceId,
    type,
    path: defaultPath,
    availableTypes,
  }
}

export function buildStubServiceLogUrl(
  serviceId: string,
  options?: {
    type?: 'default' | 'access' | 'error'
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
