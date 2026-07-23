import type {
  DashboardAction,
  DashboardService,
  DashboardSummary,
  FirstRunSetupActionResult,
  FirstRunSetupKeySource,
  FirstRunSetupState,
  FirstRunSetupStatus,
  ServiceRecoveryDoctorActionResult,
  ServiceRecoveryHistoryState,
  ServiceSetupRunResult,
  ServiceSetupState,
  ServiceSetupStep,
  ServiceSetupStepRun,
  ServiceUpdateAction,
  ServiceUpdateState,
} from './types'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type RuntimeApiEnvironment = {
  DEV?: boolean
  VITE_SERVICE_LASSO_API_BASE_URL?: string
  VITE_SERVICE_LASSO_ENABLE_STUB_DATA?: string
}

export type RuntimeApiMode = 'local-dev' | 'packaged-runtime'

export type RuntimeApiUnavailableDetails = {
  mode: RuntimeApiMode
  path: string
  endpoint: string | null
  status: number | null
  contentType: string | null
  packagedProxyConfigured: boolean
  reason: 'missing_api_base_url' | 'fetch_failed' | 'http_error' | 'non_json'
}

export class RuntimeApiUnavailableError extends Error {
  readonly details: RuntimeApiUnavailableDetails

  constructor(details: RuntimeApiUnavailableDetails, cause?: unknown) {
    const endpoint = details.endpoint ?? details.path
    const metadata = [
      `path ${details.path}`,
      details.status == null ? null : `status ${details.status}`,
      details.contentType ? `content-type ${details.contentType}` : null,
    ]
      .filter(Boolean)
      .join(', ')
    super(
      `Service Lasso runtime API unavailable for ${endpoint}: ${details.reason}${
        metadata ? ` (${metadata})` : ''
      }.`
    )
    this.name = 'RuntimeApiUnavailableError'
    this.details = details
    if (cause) {
      Object.defineProperty(this, 'cause', {
        value: cause,
        configurable: true,
        writable: true,
      })
    }
  }
}

export function resolveRuntimeApiMode(
  env: RuntimeApiEnvironment = import.meta.env
): RuntimeApiMode {
  return env.DEV ? 'local-dev' : 'packaged-runtime'
}

export function resolveServiceLassoApiBaseUrl(
  env: RuntimeApiEnvironment = import.meta.env
) {
  const configured = env.VITE_SERVICE_LASSO_API_BASE_URL?.replace(/\/$/, '')
  if (configured) return configured
  return resolveRuntimeApiMode(env) === 'packaged-runtime' ? '' : null
}

export function isServiceLassoStubDataEnabled(
  env: RuntimeApiEnvironment = import.meta.env
) {
  return (
    resolveRuntimeApiMode(env) === 'local-dev' &&
    env.VITE_SERVICE_LASSO_ENABLE_STUB_DATA === 'true'
  )
}

export const serviceLassoApiBaseUrl = resolveServiceLassoApiBaseUrl()

export const serviceLassoStubDataEnabled = isServiceLassoStubDataEnabled()

export const favoritesFeatureEnabled =
  import.meta.env.VITE_SERVICE_LASSO_FAVORITES_ENABLED === 'true'

export const favoritesMutationEnabled =
  favoritesFeatureEnabled && serviceLassoApiBaseUrl !== null

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

const firstRunSetupStatusAliases: Record<string, FirstRunSetupStatus> = {
  ready: 'not_required',
  vault_ready: 'not_required',
  notRequired: 'not_required',
  'not-required': 'not_required',
  not_required: 'not_required',
  required: 'required',
  setup_required: 'required',
  'setup-required': 'required',
  inProgress: 'in_progress',
  'in-progress': 'in_progress',
  in_progress: 'in_progress',
  generatedKeyPendingAck: 'generated_key_pending_ack',
  generated_key_pending_ack: 'generated_key_pending_ack',
  generated_key_pending_acknowledgement: 'generated_key_pending_ack',
  'generated-key-pending-ack': 'generated_key_pending_ack',
  complete: 'complete',
  completed: 'complete',
  setup_complete: 'complete',
  failed: 'failed',
  error: 'failed',
  setup_failed: 'failed',
}

const firstRunSetupKeySourceAliases: Record<string, FirstRunSetupKeySource> = {
  generated: 'generated',
  interactive: 'generated',
  supplied: 'supplied',
  external: 'supplied',
  os_keychain: 'os_keychain',
  keychain: 'os_keychain',
  secret_file: 'secret_file',
  file: 'secret_file',
  environment: 'environment',
  env: 'environment',
  cli: 'cli',
}

function createDefaultFirstRunSetupState(): FirstRunSetupState {
  return {
    status: 'not_required',
    required: false,
    localOnly: true,
    remoteAllowed: false,
    vault: {
      id: 'service-lasso-default',
      name: 'Service Lasso Vault',
      keySource: 'unknown',
      keyFingerprint: null,
      keyReveal: null,
    },
    rootOwner: {
      id: null,
      displayName: null,
      createdAt: null,
    },
    machine: {
      hostname: null,
      osUser: null,
      platform: null,
    },
    warnings: [],
    nextActions: [],
    failure: null,
  }
}

let firstRunSetupFixture = createDefaultFirstRunSetupState()

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

function createEmptyRecoveryState(
  serviceId: string
): ServiceRecoveryHistoryState {
  return {
    serviceId,
    updatedAt: new Date('2026-04-11T10:00:00+10:00').toISOString(),
    events: [],
  }
}

async function fetchRemoteServiceMeta(): Promise<RemoteServiceMeta[] | null> {
  if (serviceLassoApiBaseUrl === null) return null

  try {
    const payload = await fetchRuntimeJson<{
      services?: RemoteServiceMeta[]
    }>('/api/services/meta')

    return payload.services ?? []
  } catch {
    return null
  }
}

async function fetchRemoteUpdateStates(): Promise<
  RemoteServiceUpdate[] | null
> {
  if (serviceLassoApiBaseUrl === null) return null

  try {
    const payload = await fetchRuntimeJson<{
      services?: RemoteServiceUpdate[]
    }>('/api/updates')

    return payload.services ?? []
  } catch {
    return null
  }
}

async function fetchRemoteRecoveryStates(): Promise<
  RemoteServiceRecovery[] | null
> {
  if (serviceLassoApiBaseUrl === null) return null

  try {
    const payload = await fetchRuntimeJson<{
      services?: RemoteServiceRecovery[]
    }>('/api/recovery')

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
        id: 'dashboard',
        kind: 'network',
        label: 'Local dashboard',
        url: 'http://localhost:8080',
        bind: '127.0.0.1',
        port: 8080,
        protocol: 'http',
        transport: 'tcp',
        exposure: 'local',
        primary: true,
        source: 'manifest.endpoints',
        readiness: 'ready',
      },
      {
        id: 'route',
        kind: 'url',
        label: 'LAN route',
        url: 'https://traefik.localtest.me',
        bind: '0.0.0.0',
        port: 443,
        protocol: 'https',
        transport: 'tcp',
        exposure: 'public',
        target: 'dashboard',
        source: 'manifest.endpoints',
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
        id: 'web',
        kind: 'network',
        label: 'Local UI',
        url: 'http://localhost:17700',
        bind: '0.0.0.0',
        port: 17700,
        protocol: 'http',
        transport: 'tcp',
        exposure: 'local',
        primary: true,
        source: 'manifest.endpoints',
        readiness: 'ready',
      },
      {
        id: 'lan',
        kind: 'url',
        label: 'LAN UI',
        url: 'http://192.168.1.53:17700',
        bind: '0.0.0.0',
        port: 17700,
        protocol: 'http',
        transport: 'tcp',
        exposure: 'lan',
        target: 'web',
        source: 'manifest.endpoints',
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
        id: 'web',
        kind: 'network',
        label: 'Local auth UI',
        url: 'http://localhost:8081',
        bind: '127.0.0.1',
        port: 8081,
        protocol: 'http',
        transport: 'tcp',
        exposure: 'local',
        primary: true,
        source: 'manifest.endpoints',
        readiness: 'blocked',
      },
      {
        id: 'oidc',
        kind: 'url',
        label: 'OIDC discovery',
        protocol: 'https',
        target: 'web',
        exposure: 'local',
        required: true,
        source: 'manifest.endpoints',
        health: 'warning',
        readiness: 'blocked',
        resolution: {
          status: 'failed',
          message:
            'Endpoint selector ${endpoint.web.port} resolved, but readiness probe exceeded the latency budget.',
        },
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

function createDemoRecoveryState(
  serviceId: string
): ServiceRecoveryHistoryState {
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
        message:
          serviceId === 'service-admin' ? undefined : 'Service is healthy.',
        steps: serviceId === 'service-admin' ? [] : undefined,
        at,
      },
    ],
  }
}

function createSetupRun(
  serviceId: string,
  stepId: string,
  status: ServiceSetupStepRun['status'],
  options: {
    startedAt: string
    durationMs: number
    exitCode: number | null
    signal?: string | null
    message?: string
  }
): ServiceSetupStepRun {
  const startedAt = new Date(options.startedAt).toISOString()
  const finishedAt = new Date(
    Date.parse(startedAt) + options.durationMs
  ).toISOString()
  const runId = `${startedAt.replace(/[:.]/g, '-')}-${stepId}`

  return {
    runId,
    serviceId,
    stepId,
    status,
    startedAt,
    finishedAt,
    durationMs: options.durationMs,
    command: `service-lasso setup run ${serviceId} ${stepId}`,
    exitCode: options.exitCode,
    signal: options.signal ?? null,
    message: options.message,
    logs: {
      logPath: `/services/${serviceId}/logs/setup/${stepId}/${runId}/setup.log`,
      stdoutPath: `/services/${serviceId}/logs/setup/${stepId}/${runId}/stdout.log`,
      stderrPath: `/services/${serviceId}/logs/setup/${stepId}/${runId}/stderr.log`,
    },
  }
}

function createSetupStep(
  serviceId: string,
  step: Omit<ServiceSetupStep, 'lastRun' | 'history' | 'status'> & {
    lastRun?: ServiceSetupStepRun
    status?: ServiceSetupStep['status']
  }
): ServiceSetupStep {
  return {
    ...step,
    id: step.id,
    description: step.description ?? `Setup step ${step.id} for ${serviceId}.`,
    status: step.status ?? step.lastRun?.status ?? 'pending',
    lastRun: step.lastRun ?? null,
    history: step.lastRun ? [step.lastRun] : [],
  }
}

function createDemoSetupState(serviceId: string): ServiceSetupState {
  if (serviceId === 'service-admin') {
    return { serviceId, updatedAt: null, steps: [] }
  }

  if (serviceId === 'zitadel') {
    const lastRun = createSetupRun(serviceId, 'seed-admin', 'failed', {
      startedAt: '2026-04-11T09:59:00+10:00',
      durationMs: 1421,
      exitCode: 1,
      message: 'Setup step "seed-admin" failed with exit code 1.',
    })

    return {
      serviceId,
      updatedAt: lastRun.finishedAt,
      steps: [
        createSetupStep(serviceId, {
          id: 'seed-admin',
          description: 'Create the initial administrator realm user.',
          rerun: 'manual',
          dependOn: ['zitadel-db'],
          lastRun,
        }),
      ],
    }
  }

  const certificateRun = createSetupRun(
    serviceId,
    'generate-certificate',
    'succeeded',
    {
      startedAt: '2026-04-11T08:31:00+10:00',
      durationMs: 814,
      exitCode: 0,
      message: 'Setup step "generate-certificate" completed.',
    }
  )
  const cacheRun = createSetupRun(serviceId, 'prepare-cache', 'skipped', {
    startedAt: '2026-04-11T08:32:00+10:00',
    durationMs: 0,
    exitCode: null,
    message: 'setup step already succeeded',
  })

  return {
    serviceId,
    updatedAt: certificateRun.finishedAt,
    steps: [
      createSetupStep(serviceId, {
        id: 'generate-certificate',
        description: 'Generate local TLS material required by the service.',
        rerun: 'ifMissing',
        lastRun: certificateRun,
      }),
      createSetupStep(serviceId, {
        id: 'prepare-cache',
        description: 'Prepare runtime cache directories.',
        rerun: 'ifMissing',
        lastRun: cacheRun,
        skipReason: cacheRun.message,
      }),
    ],
  }
}

services = services.map((service) => ({
  ...service,
  recovery: service.recovery ?? createDemoRecoveryState(service.id),
  setup: service.setup ?? createDemoSetupState(service.id),
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

export function buildRecoveryNotifications(
  currentServices: DashboardService[]
) {
  const latestEvents = currentServices.flatMap((service) => {
    const event = service.recovery?.events[service.recovery.events.length - 1]
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
    messages.push(
      `${doctorBlockedCount} doctor/preflight check(s) are blocked.`
    )
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

function buildRuntimeEndpoint(path: string, apiBaseUrl: string) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export async function fetchRuntimeJson<T>(
  path: string,
  options?: {
    apiBaseUrl?: string | null
    mode?: RuntimeApiMode
    method?: string
    headers?: HeadersInit
    body?: BodyInit | null
  }
) {
  const apiBaseUrl =
    options?.apiBaseUrl === undefined
      ? serviceLassoApiBaseUrl
      : options.apiBaseUrl
  const mode = options?.mode ?? resolveRuntimeApiMode()
  const detailsBase = {
    mode,
    path,
    endpoint:
      apiBaseUrl == null ? null : buildRuntimeEndpoint(path, apiBaseUrl),
    status: null,
    contentType: null,
    packagedProxyConfigured: mode === 'packaged-runtime' && apiBaseUrl === '',
  } satisfies Omit<RuntimeApiUnavailableDetails, 'reason'>

  if (apiBaseUrl == null) {
    throw new RuntimeApiUnavailableError({
      ...detailsBase,
      reason: 'missing_api_base_url',
    })
  }

  let response: Response
  const endpoint = buildRuntimeEndpoint(path, apiBaseUrl)
  const requestDetails = {
    ...detailsBase,
    endpoint,
  }
  const requestInit: RequestInit = {
    method: options?.method,
    headers: options?.headers,
    body: options?.body,
  }

  try {
    response = await fetch(endpoint, requestInit)
  } catch (error) {
    throw new RuntimeApiUnavailableError(
      {
        ...requestDetails,
        reason: 'fetch_failed',
      },
      error
    )
  }

  const contentType = response.headers.get('content-type')
  const responseDetails = {
    ...requestDetails,
    status: response.status,
    contentType,
  }

  if (!response.ok) {
    throw new RuntimeApiUnavailableError({
      ...responseDetails,
      reason: 'http_error',
    })
  }

  if (!contentType?.toLowerCase().includes('application/json')) {
    throw new RuntimeApiUnavailableError({
      ...responseDetails,
      reason: 'non_json',
    })
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new RuntimeApiUnavailableError(
      {
        ...responseDetails,
        reason: 'non_json',
      },
      error
    )
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}

function readString(input: unknown) {
  return typeof input === 'string' ? input : undefined
}

function readStringArray(input: unknown) {
  return Array.isArray(input)
    ? input.filter((item): item is string => typeof item === 'string')
    : undefined
}

function readBoolean(input: unknown) {
  return typeof input === 'boolean' ? input : undefined
}

function normalizeFirstRunSetupStatus(input: unknown): FirstRunSetupStatus {
  if (typeof input !== 'string') return 'not_required'
  return firstRunSetupStatusAliases[input] ?? 'not_required'
}

function normalizeFirstRunSetupKeySource(
  input: unknown
): FirstRunSetupKeySource {
  if (typeof input !== 'string') return 'unknown'
  return firstRunSetupKeySourceAliases[input] ?? 'unknown'
}

function readNestedRecord(
  input: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> {
  for (const key of keys) {
    if (isRecord(input[key])) return input[key]
  }
  return {}
}

export function normalizeFirstRunSetupPayload(
  payload: unknown
): FirstRunSetupState {
  const input = isRecord(payload) ? payload : {}
  const rawSetup = isRecord(input.setup) ? input.setup : input
  const vault = readNestedRecord(rawSetup, 'vault', 'vaultContext')
  const key = readNestedRecord(rawSetup, 'key', 'vaultKey', 'keyContext')
  const reveal = readNestedRecord(key, 'reveal', 'keyReveal')
  const rootOwner = readNestedRecord(rawSetup, 'rootOwner', 'owner', 'root')
  const machine = readNestedRecord(rawSetup, 'machine', 'machineContext')
  const failure = readNestedRecord(rawSetup, 'failure', 'error')
  const status = normalizeFirstRunSetupStatus(rawSetup.status)
  const keySource = normalizeFirstRunSetupKeySource(
    key.source ?? key.keySource ?? rawSetup.keySource ?? rawSetup.key_source
  )
  const revealValue = readString(reveal.value ?? reveal.secret ?? reveal.key)
  const hasReveal =
    keySource === 'generated' &&
    revealValue !== undefined &&
    (readBoolean(reveal.acknowledged) ?? false) !== true

  return {
    status,
    required: readBoolean(rawSetup.required) ?? status !== 'not_required',
    localOnly:
      readBoolean(rawSetup.localOnly ?? rawSetup.local_only) ??
      readBoolean(rawSetup.local) ??
      true,
    remoteAllowed:
      readBoolean(rawSetup.remoteAllowed ?? rawSetup.remote_allowed) ?? false,
    vault: {
      id: readString(vault.id ?? vault.vaultId ?? rawSetup.vaultId) ?? null,
      name:
        readString(vault.name ?? vault.vaultName ?? rawSetup.vaultName) ?? null,
      keySource,
      keyFingerprint:
        readString(
          key.fingerprint ??
            key.keyFingerprint ??
            rawSetup.keyFingerprint ??
            rawSetup.key_fingerprint
        ) ?? null,
      keyReveal: hasReveal
        ? {
            value: revealValue,
            generatedAt:
              readString(reveal.generatedAt ?? reveal.generated_at) ?? null,
            acknowledged: false,
          }
        : null,
    },
    rootOwner: {
      id:
        readString(
          rootOwner.id ?? rootOwner.actorId ?? rootOwner.rootActorId
        ) ?? null,
      displayName:
        readString(
          rootOwner.displayName ??
            rootOwner.name ??
            rootOwner.ownerDisplayName ??
            rawSetup.ownerDisplayName
        ) ?? null,
      createdAt:
        readString(rootOwner.createdAt ?? rootOwner.created_at) ?? null,
    },
    machine: {
      hostname:
        readString(machine.hostname ?? machine.host ?? rawSetup.hostname) ??
        null,
      osUser:
        readString(
          machine.osUser ??
            machine.os_user ??
            machine.currentOsUser ??
            rawSetup.osUser
        ) ?? null,
      platform:
        readString(machine.platform ?? machine.os ?? rawSetup.platform) ?? null,
    },
    warnings: readStringArray(rawSetup.warnings) ?? [],
    nextActions:
      readStringArray(rawSetup.nextActions ?? rawSetup.next_actions) ?? [],
    failure:
      status === 'failed'
        ? {
            message:
              readString(failure.message ?? rawSetup.message) ??
              'First-run setup failed.',
            at: readString(failure.at ?? failure.failedAt) ?? null,
          }
        : null,
  }
}

function normalizeSetupRun(input: unknown): ServiceSetupStepRun | null {
  if (!isRecord(input)) return null

  const stepId = readString(input.stepId)
  const serviceId = readString(input.serviceId)
  const runId = readString(input.runId)
  const startedAt = readString(input.startedAt)
  const finishedAt = readString(input.finishedAt)
  const status = readString(input.status)

  if (!stepId || !serviceId || !runId || !startedAt || !finishedAt || !status) {
    return null
  }

  const logs = isRecord(input.logs) ? input.logs : undefined

  return {
    runId,
    serviceId,
    stepId,
    status:
      status === 'succeeded' ||
      status === 'failed' ||
      status === 'timeout' ||
      status === 'skipped'
        ? status
        : 'pending',
    startedAt,
    finishedAt,
    durationMs:
      typeof input.durationMs === 'number' && Number.isFinite(input.durationMs)
        ? input.durationMs
        : Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
    command: readString(input.command),
    exitCode: typeof input.exitCode === 'number' ? input.exitCode : null,
    signal: readString(input.signal) ?? null,
    message: readString(input.message),
    logs: logs
      ? {
          logPath: readString(logs.logPath),
          stdoutPath: readString(logs.stdoutPath),
          stderrPath: readString(logs.stderrPath),
        }
      : undefined,
  }
}

export function normalizeServiceSetupPayload(
  serviceId: string,
  payload: unknown
): ServiceSetupState {
  const input = isRecord(payload) ? payload : {}
  const rawSetup = isRecord(input.setup) ? input.setup : input
  const stateSteps = isRecord(rawSetup.steps) ? rawSetup.steps : {}
  const rawSteps = Array.isArray(input.steps) ? input.steps : []

  const stepIds = new Set<string>()
  for (const rawStep of rawSteps) {
    if (typeof rawStep === 'string') {
      stepIds.add(rawStep)
    } else if (isRecord(rawStep) && typeof rawStep.id === 'string') {
      stepIds.add(rawStep.id)
    }
  }
  for (const stepId of Object.keys(stateSteps)) {
    stepIds.add(stepId)
  }

  const steps = Array.from(stepIds)
    .sort((left, right) => left.localeCompare(right))
    .map((stepId) => {
      const stepDetails = rawSteps.find(
        (item) => isRecord(item) && item.id === stepId
      )
      const declared = isRecord(stepDetails) ? stepDetails : {}
      const state = isRecord(stateSteps[stepId]) ? stateSteps[stepId] : {}
      const lastRun = normalizeSetupRun(state.lastRun)
      const history = Array.isArray(state.history)
        ? state.history
            .map((entry) => normalizeSetupRun(entry))
            .filter((entry): entry is ServiceSetupStepRun => entry !== null)
        : []

      return {
        id: stepId,
        description: readString(declared.description),
        rerun:
          declared.rerun === 'ifMissing' ||
          declared.rerun === 'manual' ||
          declared.rerun === 'always'
            ? declared.rerun
            : undefined,
        dependOn:
          readStringArray(declared.dependOn) ??
          readStringArray(declared.depend_on),
        status:
          state.status === 'succeeded' ||
          state.status === 'failed' ||
          state.status === 'timeout' ||
          state.status === 'skipped'
            ? state.status
            : (lastRun?.status ?? 'pending'),
        lastRun,
        history,
        skipReason:
          state.status === 'skipped'
            ? (lastRun?.message ?? readString(state.reason))
            : undefined,
      } satisfies ServiceSetupStep
    })

  return {
    serviceId: readString(input.serviceId) ?? serviceId,
    updatedAt: readString(rawSetup.updatedAt) ?? null,
    steps,
  }
}

export function isRuntimeApiUnavailableError(
  error: unknown
): error is RuntimeApiUnavailableError {
  return error instanceof RuntimeApiUnavailableError
}

export function getRuntimeApiUnavailableCopy(
  error: unknown,
  env: RuntimeApiEnvironment = import.meta.env
) {
  const mode = resolveRuntimeApiMode(env)
  const details = isRuntimeApiUnavailableError(error)
    ? error.details
    : ({
        mode,
        path: '/api/dashboard',
        endpoint: null,
        status: null,
        contentType: null,
        packagedProxyConfigured: mode === 'packaged-runtime',
        reason: 'fetch_failed',
      } satisfies RuntimeApiUnavailableDetails)

  return {
    title: 'Runtime API unavailable',
    description:
      'Service Admin cannot reach or parse the Service Lasso runtime API.',
    guidance:
      mode === 'local-dev'
        ? 'Set VITE_SERVICE_LASSO_API_BASE_URL for a separate runtime API, or set VITE_SERVICE_LASSO_ENABLE_STUB_DATA=true for local fixture development.'
        : 'Check that the packaged Service Admin runtime API proxy is configured and returning JSON.',
    details,
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
  if (!favoritesMutationEnabled || serviceLassoApiBaseUrl === null) return false

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

export function setFirstRunSetupFixtureForTests(
  fixture: Partial<FirstRunSetupState> | null
) {
  firstRunSetupFixture = fixture
    ? {
        ...createDefaultFirstRunSetupState(),
        ...fixture,
        vault: {
          ...createDefaultFirstRunSetupState().vault,
          ...fixture.vault,
        },
        rootOwner: {
          ...createDefaultFirstRunSetupState().rootOwner,
          ...fixture.rootOwner,
        },
        machine: {
          ...createDefaultFirstRunSetupState().machine,
          ...fixture.machine,
        },
      }
    : createDefaultFirstRunSetupState()
}

export async function fetchFirstRunSetupState() {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>('/api/setup')
    return normalizeFirstRunSetupPayload(payload)
  }

  return structuredClone(firstRunSetupFixture)
}

export async function acknowledgeFirstRunVaultKey() {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const response = await fetchRuntimeJson<unknown>(
      '/api/setup/vault-key/acknowledge',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ acknowledged: true }),
      }
    )
    return {
      ok: true,
      setup: normalizeFirstRunSetupPayload(response),
      message: 'Vault key save confirmation recorded.',
    } satisfies FirstRunSetupActionResult
  }

  firstRunSetupFixture = {
    ...firstRunSetupFixture,
    status: 'complete',
    required: false,
    vault: {
      ...firstRunSetupFixture.vault,
      keyReveal: null,
    },
    nextActions: ['Continue to Service Admin.'],
  }

  return structuredClone({
    ok: true,
    setup: firstRunSetupFixture,
    message: 'Vault key save confirmation recorded.',
  } satisfies FirstRunSetupActionResult)
}

export async function fetchDashboardSummary() {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<{ summary?: DashboardSummary }>(
      '/api/dashboard'
    )
    if (!payload.summary) {
      throw new RuntimeApiUnavailableError({
        mode: resolveRuntimeApiMode(),
        path: '/api/dashboard',
        endpoint:
          serviceLassoApiBaseUrl == null
            ? null
            : buildRuntimeEndpoint('/api/dashboard', serviceLassoApiBaseUrl),
        status: 200,
        contentType: 'application/json',
        packagedProxyConfigured:
          resolveRuntimeApiMode() === 'packaged-runtime' &&
          serviceLassoApiBaseUrl === '',
        reason: 'non_json',
      })
    }

    return structuredClone(payload.summary)
  }

  await syncRemoteStateFromApi()
  return structuredClone(buildSummary())
}

export async function fetchServices() {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<{ services?: DashboardService[] }>(
      '/api/dashboard/services'
    )
    return structuredClone(payload.services ?? [])
  }

  await syncRemoteStateFromApi()
  return structuredClone(services)
}

export async function fetchDashboardService(serviceId: string) {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<{ service?: DashboardService }>(
      `/api/dashboard/services/${encodeURIComponent(serviceId)}`
    )
    return structuredClone(payload.service ?? null)
  }

  await syncRemoteStateFromApi()
  return (
    structuredClone(services.find((service) => service.id === serviceId)) ??
    null
  )
}

export async function fetchServiceSetup(serviceId: string) {
  await wait(120)

  if (!serviceLassoStubDataEnabled) {
    const payload = await fetchRuntimeJson<unknown>(
      `/api/services/${encodeURIComponent(serviceId)}/setup`
    )
    return normalizeServiceSetupPayload(serviceId, payload)
  }

  await syncRemoteStateFromApi()
  return structuredClone(
    services.find((service) => service.id === serviceId)?.setup ??
      createDemoSetupState(serviceId)
  )
}

function applyServiceSetupState(serviceId: string, setup: ServiceSetupState) {
  services = services.map((service) =>
    service.id === serviceId ? { ...service, setup } : service
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

  if (serviceLassoApiBaseUrl === null) {
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

export async function runServiceSetupAction(options: {
  serviceId: string
  stepId?: string
  force?: boolean
}) {
  await wait(120)
  const existingSetup =
    services.find((service) => service.id === options.serviceId)?.setup ??
    createDemoSetupState(options.serviceId)

  if (serviceLassoApiBaseUrl === null) {
    const selectedSteps = options.stepId
      ? existingSetup.steps.filter((step) => step.id === options.stepId)
      : existingSetup.steps.filter((step) => step.rerun !== 'manual')
    const now = new Date().toISOString()
    const runs = selectedSteps.map((step) => {
      const status =
        step.status === 'succeeded' && options.force !== true
          ? 'skipped'
          : 'succeeded'
      return {
        runId: `${now.replace(/[:.]/g, '-')}-${step.id}`,
        serviceId: options.serviceId,
        stepId: step.id,
        status,
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        command: `service-lasso setup run ${options.serviceId} ${step.id}`,
        exitCode: status === 'succeeded' ? 0 : null,
        signal: null,
        message:
          status === 'succeeded'
            ? `Setup step "${step.id}" completed.`
            : 'setup step already succeeded',
        logs: step.lastRun?.logs,
      } satisfies ServiceSetupStepRun
    })
    const nextSetup = {
      ...existingSetup,
      updatedAt: now,
      steps: existingSetup.steps.map((step) => {
        const run = runs.find((item) => item.stepId === step.id)
        if (!run) return step
        return {
          ...step,
          status: run.status,
          lastRun: run,
          history: [...step.history, run].slice(-20),
          skipReason: run.status === 'skipped' ? run.message : undefined,
        }
      }),
    } satisfies ServiceSetupState
    applyServiceSetupState(options.serviceId, nextSetup)

    return structuredClone({
      action: 'setup',
      serviceId: options.serviceId,
      ok: true,
      setup: nextSetup,
      runs,
      skipped: runs
        .filter((run) => run.status === 'skipped')
        .map((run) => ({
          stepId: run.stepId,
          reason: run.message ?? 'setup step skipped',
        })),
      message: runs.length
        ? `Setup completed for "${options.serviceId}".`
        : `No setup steps ran for "${options.serviceId}".`,
    } satisfies ServiceSetupRunResult)
  }

  const endpoint = `${serviceLassoApiBaseUrl}/api/services/${options.serviceId}/setup/run${
    options.stepId ? `/${encodeURIComponent(options.stepId)}` : ''
  }`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ force: options.force === true }),
  })

  if (!response.ok) {
    throw new Error(`Setup run failed for ${options.serviceId}`)
  }

  const payload = (await response.json()) as Record<string, unknown>
  const setup = normalizeServiceSetupPayload(options.serviceId, {
    serviceId: options.serviceId,
    steps: existingSetup.steps,
    setup:
      payload.setup ??
      (isRecord(payload.state) && isRecord(payload.state.setup)
        ? payload.state.setup
        : undefined),
  })
  applyServiceSetupState(options.serviceId, setup)

  return structuredClone({
    action: 'setup',
    serviceId: options.serviceId,
    ok: payload.ok === true,
    setup,
    runs: Array.isArray(payload.runs)
      ? payload.runs
          .map((entry) => normalizeSetupRun(entry))
          .filter((entry): entry is ServiceSetupStepRun => entry !== null)
      : [],
    skipped: Array.isArray(payload.skipped)
      ? payload.skipped.filter(
          (item): item is { stepId: string; reason: string } =>
            isRecord(item) &&
            typeof item.stepId === 'string' &&
            typeof item.reason === 'string'
        )
      : [],
    message:
      typeof payload.message === 'string'
        ? payload.message
        : `Setup completed for "${options.serviceId}".`,
  } satisfies ServiceSetupRunResult)
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

  if (serviceLassoApiBaseUrl === null) {
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
