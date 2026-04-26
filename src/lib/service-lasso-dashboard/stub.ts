import type {
  DashboardAction,
  DashboardService,
  DashboardSummary,
  ServiceRecoveryDoctorActionResult,
  ServiceRecoveryHistoryState,
  ServiceUpdateAction,
  ServiceUpdateState,
} from './types'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const serviceLassoApiBaseUrl =
  import.meta.env.VITE_SERVICE_LASSO_API_BASE_URL?.replace(/\/$/, '') || null

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

type RemoteServiceUpdate = {
  serviceId: string
  update: ServiceUpdateState
}

type RemoteServiceRecovery = {
  serviceId: string
  recovery: ServiceRecoveryHistoryState
}

function createEmptyUpdateState(serviceId: string): ServiceUpdateState {
  return {
    serviceId,
    state: 'installed',
    updatedAt: new Date('2026-04-11T10:00:00+10:00').toISOString(),
    lastCheck: {
      checkedAt: new Date('2026-04-11T10:00:00+10:00').toISOString(),
      status: 'latest',
      reason: 'No newer update has been reported.',
      sourceRepo: null,
      track: null,
      installedTag: null,
      manifestTag: null,
      latestTag: null,
    },
    available: null,
    downloadedCandidate: null,
    installDeferred: null,
    failed: null,
  }
}

function createEmptyRecoveryState(serviceId: string): ServiceRecoveryHistoryState {
  return {
    serviceId,
    updatedAt: new Date('2026-04-11T10:00:00+10:00').toISOString(),
    events: [],
  }
}

async function fetchRemoteServiceMeta(): Promise<RemoteServiceMeta[] | null> {
  if (!serviceLassoApiBaseUrl) return null

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

async function fetchRemoteUpdateStates(): Promise<
  RemoteServiceUpdate[] | null
> {
  if (!serviceLassoApiBaseUrl) return null

  try {
    const response = await fetch(`${serviceLassoApiBaseUrl}/api/updates`)
    if (!response.ok) return null

    const payload = (await response.json()) as {
      services?: RemoteServiceUpdate[]
    }

    return payload.services ?? []
  } catch {
    return null
  }
}

async function fetchRemoteRecoveryStates(): Promise<
  RemoteServiceRecovery[] | null
> {
  if (!serviceLassoApiBaseUrl) return null

  try {
    const response = await fetch(`${serviceLassoApiBaseUrl}/api/recovery`)
    if (!response.ok) return null

    const payload = (await response.json()) as {
      services?: RemoteServiceRecovery[]
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

  services = services.map((service) => {
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
}

export function applyRemoteUpdateStates(updateStates: RemoteServiceUpdate[]) {
  if (updateStates.length === 0) return

  const updateById = new Map(
    updateStates.map((service) => [service.serviceId, service.update])
  )

  services = services.map((service) => ({
    ...service,
    updates: updateById.get(service.id) ?? service.updates,
  }))
}

export function applyRemoteRecoveryStates(
  recoveryStates: RemoteServiceRecovery[]
) {
  if (recoveryStates.length === 0) return

  const recoveryById = new Map(
    recoveryStates.map((service) => [service.serviceId, service.recovery])
  )

  services = services.map((service) => ({
    ...service,
    recovery: recoveryById.get(service.id) ?? service.recovery,
  }))
}

async function syncRemoteStateFromApi() {
  const [remoteServiceMeta, remoteUpdateStates, remoteRecoveryStates] =
    await Promise.all([
      fetchRemoteServiceMeta(),
      fetchRemoteUpdateStates(),
      fetchRemoteRecoveryStates(),
    ])
  if (remoteServiceMeta) {
    applyRemoteServiceMeta(remoteServiceMeta)
  }
  if (remoteUpdateStates) {
    applyRemoteUpdateStates(remoteUpdateStates)
  }
  if (remoteRecoveryStates) {
    applyRemoteRecoveryStates(remoteRecoveryStates)
  }
}

let services: DashboardService[] = [
  {
    id: 'traefik',
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
      logPath: '/services/traefik/service.log',
      workPath: 'C:\\service-lasso\\traefik',
      profile: 'default',
      imageUrl: '/services/traefik/logo.svg',
    },
    dependencies: [
      {
        id: 'secrets-broker',
        name: 'Secrets Broker',
        status: 'running',
        relation: 'depends_on',
        note: 'Uses broker-managed certificates and route secrets.',
      },
    ],
    dependents: [
      {
        id: 'service-admin',
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
    updates: createEmptyUpdateState('traefik'),
  },
  {
    id: 'service-admin',
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
      logPath: '/services/service-admin/service.log',
      workPath: 'C:\\projects\\service-lasso\\lasso-@serviceadmin',
      profile: 'develop',
    },
    dependencies: [
      {
        id: 'traefik',
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
        message: 'GET /services/service-admin returned 200 in 19ms.',
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
    updates: {
      ...createEmptyUpdateState('service-admin'),
      state: 'available',
      updatedAt: new Date('2026-04-11T10:12:00+10:00').toISOString(),
      lastCheck: {
        checkedAt: new Date('2026-04-11T10:12:00+10:00').toISOString(),
        status: 'update_available',
        reason: 'A newer Service Admin release is available.',
        sourceRepo: 'service-lasso/lasso-serviceadmin',
        track: 'latest',
        installedTag: '2026.4.18-170a1af',
        manifestTag: '2026.4.18-170a1af',
        latestTag: '2026.4.26-demo',
      },
      available: {
        tag: '2026.4.26-demo',
        version: '2026.4.26-demo',
        releaseUrl:
          'https://github.com/service-lasso/lasso-serviceadmin/releases/tag/2026.4.26-demo',
        publishedAt: new Date('2026-04-26T00:00:00Z').toISOString(),
        assetName: '@serviceadmin-win32.zip',
        assetUrl:
          'https://github.com/service-lasso/lasso-serviceadmin/releases/download/2026.4.26-demo/@serviceadmin-win32.zip',
      },
    },
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
    dependencies: [
      {
        id: 'secrets-broker',
        name: 'Secrets Broker',
        status: 'running',
        relation: 'depends_on',
      },
    ],
    dependents: [
      {
        id: 'service-admin',
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
    updates: {
      ...createEmptyUpdateState('zitadel'),
      state: 'failed',
      updatedAt: new Date('2026-04-11T10:14:00+10:00').toISOString(),
      lastCheck: {
        checkedAt: new Date('2026-04-11T10:14:00+10:00').toISOString(),
        status: 'check_failed',
        reason: 'Release source returned an error.',
        sourceRepo: 'service-lasso/zitadel',
        track: 'latest',
        installedTag: '2.57.0',
        manifestTag: '2.57.0',
        latestTag: null,
      },
      failed: {
        reason: 'Release source returned an error.',
        failedAt: new Date('2026-04-11T10:14:00+10:00').toISOString(),
        sourceStatus: 'check_failed',
      },
    },
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
    dependencies: [
      {
        id: 'secrets-broker',
        name: 'Secrets Broker',
        status: 'running',
        relation: 'depends_on',
      },
    ],
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
    updates: {
      ...createEmptyUpdateState('dagu'),
      state: 'downloadedCandidate',
      updatedAt: new Date('2026-04-11T10:15:00+10:00').toISOString(),
      lastCheck: {
        checkedAt: new Date('2026-04-11T10:15:00+10:00').toISOString(),
        status: 'update_available',
        reason: 'Update candidate has been downloaded.',
        sourceRepo: 'service-lasso/dagu',
        track: 'latest',
        installedTag: '0.17.1',
        manifestTag: '0.17.1',
        latestTag: '0.18.0',
      },
      downloadedCandidate: {
        tag: '0.18.0',
        version: '0.18.0',
        assetName: 'dagu-win32.zip',
        assetUrl: 'https://example.invalid/dagu-win32.zip',
        archivePath:
          'C:\\service-lasso\\dagu\\.state\\update-candidates\\0.18.0\\dagu-win32.zip',
        extractedPath: null,
        downloadedAt: new Date('2026-04-11T10:15:00+10:00').toISOString(),
      },
    },
  },
  {
    id: 'secrets-broker',
    name: 'Secrets Broker',
    status: 'running',
    favorite: false,
    role: 'Token and secret resolution layer',
    note: 'Secrets broker stub is healthy.',
    installed: true,
    links: [{ label: 'Local', url: 'http://localhost:8083', kind: 'local' }],
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '3d 7h',
      lastCheckAt: '2026-04-11T10:18:48+10:00',
      lastRestartAt: '2026-04-08T02:19:00+10:00',
      summary: 'Secrets and provider tokens are resolving normally.',
    },
    endpoints: [
      {
        label: 'Local broker API',
        url: 'http://localhost:8083',
        bind: '127.0.0.1',
        port: 8083,
        protocol: 'http',
        exposure: 'local',
      },
    ],
    metadata: {
      serviceType: 'security-core',
      runtime: 'go-service',
      version: 'v0.4.0-dev',
      build: 'broker-demo-build',
      packageId: 'service-lasso/secrets-broker',
      installPath: 'C:\\service-lasso\\secrets-broker',
      configPath: 'C:\\service-lasso\\secrets-broker\\config.json',
      dataPath: 'C:\\service-lasso\\secrets-broker\\vault',
      logPath: '/services/secrets-broker/service.log',
      workPath: 'C:\\service-lasso\\secrets-broker',
      profile: 'default',
    },
    dependencies: [],
    dependents: [
      {
        id: 'traefik',
        name: 'Traefik',
        status: 'running',
        relation: 'dependent',
      },
      {
        id: 'zitadel',
        name: 'ZITADEL',
        status: 'degraded',
        relation: 'dependent',
      },
      {
        id: 'dagu',
        name: 'Dagu',
        status: 'stopped',
        relation: 'dependent',
      },
    ],
    environmentVariables: [
      {
        key: 'SECRETS_BROKER_PORT',
        value: '8083',
        scope: 'service',
        source: 'config.json',
      },
      {
        key: 'SECRETS_BROKER_VAULT_PATH',
        value: 'C:\\service-lasso\\secrets-broker\\vault',
        scope: 'service',
        source: 'config.json',
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
        timestamp: '2026-04-11T10:18:52+10:00',
        level: 'info',
        source: 'app',
        message: 'Resolved provider token refs for 3 dependent services.',
      },
      {
        timestamp: '2026-04-11T10:01:12+10:00',
        level: 'info',
        source: 'healthcheck',
        message: 'Vault integrity check passed.',
      },
    ],
    actions: [
      { id: 'restart', label: 'Restart broker', kind: 'restart' },
      { id: 'open_logs', label: 'Open logs', kind: 'open_logs' },
      { id: 'open_config', label: 'Open config', kind: 'open_config' },
      { id: 'uninstall', label: 'Uninstall service', kind: 'uninstall' },
    ],
    updates: {
      ...createEmptyUpdateState('secrets-broker'),
      state: 'installDeferred',
      updatedAt: new Date('2026-04-11T10:16:00+10:00').toISOString(),
      lastCheck: {
        checkedAt: new Date('2026-04-11T10:16:00+10:00').toISOString(),
        status: 'update_available',
        reason: 'Install is waiting for the maintenance window.',
        sourceRepo: 'service-lasso/secrets-broker',
        track: 'latest',
        installedTag: 'v0.4.0-dev',
        manifestTag: 'v0.4.0-dev',
        latestTag: 'v0.4.1',
      },
      installDeferred: {
        reason: 'Current time is outside updates.installWindow.',
        deferredAt: new Date('2026-04-11T10:16:00+10:00').toISOString(),
        nextEligibleAt: new Date('2026-04-12T02:00:00+10:00').toISOString(),
      },
    },
  },
]

function createDemoRecoveryState(serviceId: string): ServiceRecoveryHistoryState {
  const base = createEmptyRecoveryState(serviceId)
  const at = new Date('2026-04-11T10:18:00+10:00').toISOString()

  if (serviceId === 'zitadel') {
    return {
      ...base,
      updatedAt: at,
      events: [
        {
          kind: 'monitor',
          serviceId,
          action: 'skip',
          reason: 'unhealthy_threshold',
          message: 'Service is unhealthy but has not reached threshold.',
          at,
        },
      ],
    }
  }

  if (serviceId === 'dagu') {
    return {
      ...base,
      updatedAt: at,
      events: [
        {
          kind: 'restart',
          serviceId,
          ok: false,
          message: 'Restart readiness check failed.',
          at,
        },
      ],
    }
  }

  if (serviceId === 'secrets-broker') {
    return {
      ...base,
      updatedAt: at,
      events: [
        {
          kind: 'hook',
          serviceId,
          phase: 'postUpgrade',
          ok: false,
          blocked: true,
          steps: [
            {
              phase: 'postUpgrade',
              name: 'reload-secrets',
              command: 'node ./hooks/reload-secrets.mjs',
              ok: false,
              exitCode: 7,
              timedOut: false,
              failurePolicy: 'block',
              stdout: '',
              stderr: 'reload failed',
              startedAt: new Date('2026-04-11T10:17:50+10:00').toISOString(),
              finishedAt: new Date('2026-04-11T10:17:51+10:00').toISOString(),
            },
          ],
          at,
        },
      ],
    }
  }

  return {
    ...base,
    updatedAt: at,
    events: [
      {
        kind: serviceId === 'service-admin' ? 'doctor' : 'monitor',
        serviceId,
        action: serviceId === 'service-admin' ? undefined : 'healthy',
        reason: serviceId === 'service-admin' ? undefined : 'healthy',
        ok: serviceId === 'service-admin' ? true : undefined,
        blocked: serviceId === 'service-admin' ? false : undefined,
        message: serviceId === 'service-admin' ? undefined : 'Service is healthy.',
        steps: serviceId === 'service-admin' ? [] : undefined,
        at,
      },
    ],
  }
}

services = services.map((service) => ({
  ...service,
  recovery: service.recovery ?? createDemoRecoveryState(service.id),
}))

let runtime = {
  status: 'warning' as const,
  lastReloadedAt: new Date('2026-04-10T19:55:00+10:00').toISOString(),
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

  const updateNotifications = buildUpdateNotifications(currentServices)
  warnings.push(...updateNotifications.messages)
  warnings.push(...buildRecoveryNotifications(currentServices).messages)

  return warnings
}

export function buildUpdateNotifications(currentServices: DashboardService[]) {
  const latestCount = currentServices.filter(
    (service) => service.updates?.state === 'installed'
  ).length
  const availableCount = currentServices.filter(
    (service) => service.updates?.state === 'available'
  ).length
  const downloadedCount = currentServices.filter(
    (service) => service.updates?.state === 'downloadedCandidate'
  ).length
  const deferredCount = currentServices.filter(
    (service) => service.updates?.state === 'installDeferred'
  ).length
  const failedCount = currentServices.filter(
    (service) => service.updates?.state === 'failed'
  ).length
  const messages: string[] = []

  if (availableCount > 0) {
    messages.push(`${availableCount} service update(s) are available.`)
  }
  if (downloadedCount > 0) {
    messages.push(
      `${downloadedCount} downloaded update candidate(s) are ready.`
    )
  }
  if (deferredCount > 0) {
    messages.push(
      `${deferredCount} update install(s) are waiting for a window.`
    )
  }
  if (failedCount > 0) {
    messages.push(`${failedCount} update check(s) need attention.`)
  }

  return {
    latestCount,
    availableCount,
    downloadedCount,
    deferredCount,
    failedCount,
    messages,
  }
}

export function buildRecoveryNotifications(currentServices: DashboardService[]) {
  const latestEvents = currentServices.flatMap((service) => {
    const event = service.recovery?.events[
      service.recovery.events.length - 1
    ]
    return event ? [{ service, event }] : []
  })
  const monitorAttentionCount = latestEvents.filter(
    ({ event }) =>
      event.kind === 'monitor' &&
      event.action !== 'healthy' &&
      event.reason !== 'healthy'
  ).length
  const doctorBlockedCount = latestEvents.filter(
    ({ event }) => event.kind === 'doctor' && event.blocked === true
  ).length
  const hookBlockedCount = latestEvents.filter(
    ({ event }) => event.kind === 'hook' && event.blocked === true
  ).length
  const restartFailureCount = latestEvents.filter(
    ({ event }) => event.kind === 'restart' && event.ok === false
  ).length
  const messages: string[] = []

  if (monitorAttentionCount > 0) {
    messages.push(
      `${monitorAttentionCount} service monitor event(s) need review.`
    )
  }
  if (doctorBlockedCount > 0) {
    messages.push(`${doctorBlockedCount} doctor/preflight check(s) are blocked.`)
  }
  if (hookBlockedCount > 0) {
    messages.push(`${hookBlockedCount} lifecycle hook run(s) are blocked.`)
  }
  if (restartFailureCount > 0) {
    messages.push(`${restartFailureCount} restart attempt(s) failed readiness.`)
  }

  return {
    monitorAttentionCount,
    doctorBlockedCount,
    hookBlockedCount,
    restartFailureCount,
    messages,
  }
}

function buildSummary(): DashboardSummary {
  const warnings = buildWarnings(services)
  const updateNotifications = buildUpdateNotifications(services)
  const recoveryNotifications = buildRecoveryNotifications(services)
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
    updateNotifications,
    recoveryNotifications,
  }
}

function syncFavoriteState(serviceId: string, favorite?: boolean) {
  services = services.map((service) =>
    service.id === serviceId
      ? {
          ...service,
          favorite: favorite ?? !service.favorite,
        }
      : service
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
  await syncRemoteStateFromApi()
  return structuredClone(buildSummary())
}

export async function fetchServices() {
  await wait(120)
  await syncRemoteStateFromApi()
  return structuredClone(services)
}

export async function fetchDashboardService(serviceId: string) {
  await wait(120)
  await syncRemoteStateFromApi()
  return (
    structuredClone(services.find((service) => service.id === serviceId)) ??
    null
  )
}

function applyServiceUpdateState(
  serviceId: string,
  update: ServiceUpdateState
) {
  services = services.map((service) =>
    service.id === serviceId ? { ...service, updates: update } : service
  )
}

export async function runServiceUpdateAction(options: {
  action: ServiceUpdateAction
  serviceId: string
  force?: boolean
}) {
  await wait(120)

  if (!serviceLassoApiBaseUrl) {
    return structuredClone(buildSummary())
  }

  const endpoint =
    options.action === 'check'
      ? `${serviceLassoApiBaseUrl}/api/updates/check`
      : `${serviceLassoApiBaseUrl}/api/services/${options.serviceId}/update/${options.action}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body:
      options.action === 'check'
        ? JSON.stringify({ serviceId: options.serviceId })
        : JSON.stringify({ force: options.force === true }),
  })

  if (!response.ok) {
    throw new Error(`Update ${options.action} failed for ${options.serviceId}`)
  }

  const payload = (await response.json()) as {
    update?: ServiceUpdateState
    services?: Array<{ serviceId: string; update: ServiceUpdateState }>
  }
  const update =
    payload.update ??
    payload.services?.find((service) => service.serviceId === options.serviceId)
      ?.update

  if (update) {
    applyServiceUpdateState(options.serviceId, update)
  }

  return structuredClone(buildSummary())
}

function applyServiceRecoveryState(
  serviceId: string,
  recovery: ServiceRecoveryHistoryState
) {
  services = services.map((service) =>
    service.id === serviceId ? { ...service, recovery } : service
  )
}

export async function runServiceRecoveryDoctorAction(serviceId: string) {
  await wait(120)

  if (!serviceLassoApiBaseUrl) {
    const recovery =
      services.find((service) => service.id === serviceId)?.recovery ??
      createEmptyRecoveryState(serviceId)
    const event = {
      kind: 'doctor' as const,
      serviceId,
      ok: true,
      blocked: false,
      steps: [],
      at: new Date().toISOString(),
    }
    const nextRecovery = {
      ...recovery,
      updatedAt: event.at,
      events: [...recovery.events, event],
    }
    applyServiceRecoveryState(serviceId, nextRecovery)
    return structuredClone({
      serviceId,
      doctor: { ok: true, blocked: false, steps: [] },
      recovery: nextRecovery,
    } satisfies ServiceRecoveryDoctorActionResult)
  }

  const response = await fetch(
    `${serviceLassoApiBaseUrl}/api/services/${serviceId}/recovery/doctor`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  )

  if (!response.ok) {
    throw new Error(`Doctor check failed for ${serviceId}`)
  }

  const payload = (await response.json()) as ServiceRecoveryDoctorActionResult
  applyServiceRecoveryState(serviceId, payload.recovery)
  return structuredClone(payload)
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

export async function runDashboardAction(action: DashboardAction) {
  await wait(180)

  if (action === 'reload-runtime') {
    runtime = {
      ...runtime,
      lastReloadedAt: new Date().toISOString(),
    }
  } else if (action === 'start-services') {
    services = services.map((service) => {
      if (service.status === 'stopped') {
        return {
          ...service,
          status: 'running',
          note: 'Service was started from the dashboard action.',
          runtimeHealth: {
            ...service.runtimeHealth,
            state: 'running',
            health: 'healthy',
            uptime: '0m',
            lastCheckAt: new Date().toISOString(),
            lastRestartAt: new Date().toISOString(),
            summary: 'Service was started from the dashboard action.',
          },
          recentLogs: [
            {
              timestamp: new Date().toISOString(),
              level: 'info' as const,
              source: 'supervisor' as const,
              message: 'Service started from dashboard bulk action.',
            },
            ...service.recentLogs,
          ].slice(0, 5),
        }
      }

      return service
    })
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
