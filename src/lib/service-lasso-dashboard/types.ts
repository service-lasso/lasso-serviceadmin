export type ServiceStatus = 'running' | 'stopped' | 'degraded'

export type ServiceLink = {
  label: string
  url: string
  kind?: 'local' | 'lan' | 'remote' | 'admin' | 'docs' | 'metrics'
}

export type ServiceRuntimeHealth = {
  state: ServiceStatus
  health: 'healthy' | 'warning' | 'critical'
  uptime: string
  lastCheckAt: string
  lastRestartAt?: string
  summary: string
}

export type ServiceEndpoint = {
  label: string
  url: string
  bind: string
  port: number
  protocol: 'http' | 'https' | 'tcp'
  exposure: 'local' | 'lan' | 'public'
}

export type ServiceEnvironmentVariable = {
  key: string
  value: string
  scope: 'global' | 'service'
  secret?: boolean
  source?: string
}

export type ServiceMetadata = {
  serviceType: string
  runtime: string
  version: string
  build: string
  packageId?: string
  installPath?: string
  configPath?: string
  dataPath?: string
  logPath?: string
  workPath?: string
  profile?: string
  imageUrl?: string
}

export type ServiceDependency = {
  id: string
  name: string
  status: ServiceStatus
  relation: 'depends_on' | 'dependent'
  note?: string
}

export type ServiceLogPreviewEntry = {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  source: 'supervisor' | 'healthcheck' | 'stdout' | 'stderr' | 'app'
  message: string
}

export type ServiceAction = {
  id: string
  label: string
  kind:
    | 'start'
    | 'stop'
    | 'restart'
    | 'reload'
    | 'install'
    | 'uninstall'
    | 'open_logs'
    | 'open_config'
    | 'open_admin'
}

export type ServiceUpdateStateKind =
  | 'installed'
  | 'available'
  | 'downloadedCandidate'
  | 'installDeferred'
  | 'failed'

export type ServiceUpdateState = {
  serviceId: string
  state: ServiceUpdateStateKind
  updatedAt: string
  lastCheck: {
    checkedAt: string
    status:
      | 'latest'
      | 'update_available'
      | 'pinned'
      | 'unavailable'
      | 'check_failed'
    reason: string
    sourceRepo: string | null
    track: string | null
    installedTag: string | null
    manifestTag: string | null
    latestTag: string | null
  } | null
  available: {
    tag: string | null
    version: string | null
    releaseUrl: string | null
    publishedAt: string | null
    assetName: string | null
    assetUrl: string | null
  } | null
  downloadedCandidate: {
    tag: string
    version: string | null
    assetName: string
    assetUrl: string
    archivePath: string
    extractedPath: string | null
    downloadedAt: string
  } | null
  installDeferred: {
    reason: string
    deferredAt: string
    nextEligibleAt: string | null
  } | null
  failed: {
    reason: string
    failedAt: string
    sourceStatus: string | null
  } | null
}

export type ServiceUpdateAction = 'check' | 'download' | 'install'

export type DashboardService = {
  id: string
  name: string
  status: ServiceStatus
  favorite: boolean
  note: string
  links: ServiceLink[]
  installed: boolean
  role: string
  runtimeHealth: ServiceRuntimeHealth
  endpoints: ServiceEndpoint[]
  metadata: ServiceMetadata
  dependencies: ServiceDependency[]
  dependents: ServiceDependency[]
  environmentVariables: ServiceEnvironmentVariable[]
  recentLogs: ServiceLogPreviewEntry[]
  actions: ServiceAction[]
  updates?: ServiceUpdateState
}

export type DashboardRuntime = {
  status: 'healthy' | 'warning'
  lastReloadedAt: string
  warningCount: number
}

export type DashboardSummary = {
  runtime: DashboardRuntime
  servicesTotal: number
  servicesRunning: number
  servicesStopped: number
  servicesDegraded: number
  networkExposureCount: number
  installedCount: number
  favorites: DashboardService[]
  others: DashboardService[]
  warnings: string[]
  problemServices: DashboardService[]
  updateNotifications: {
    latestCount: number
    availableCount: number
    downloadedCount: number
    deferredCount: number
    failedCount: number
    messages: string[]
  }
}

export type DashboardAction =
  | 'reload-runtime'
  | 'start-services'
  | { kind: 'toggle-favorite'; serviceId: string }
