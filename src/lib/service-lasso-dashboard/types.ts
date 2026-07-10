export type ServiceStatus = 'running' | 'available' | 'stopped' | 'degraded'

export type ServiceLogType =
  | 'default'
  | 'stdout'
  | 'stderr'
  | 'access'
  | 'error'
  | (string & {})

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
  templateValue?: string
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
  servicesAvailable?: number
  servicesStopped: number
  servicesDegraded: number
  networkExposureCount: number
  installedCount: number
  favorites: DashboardService[]
  others: DashboardService[]
  warnings: string[]
  problemServices: DashboardService[]
}

export type DashboardAction =
  | 'reload-runtime'
  | 'start-services'
  | 'stop-services'
  | 'restart-services'
  | { kind: 'toggle-favorite'; serviceId: string }
  | {
      kind: 'service-lifecycle'
      serviceId: string
      action: 'start' | 'stop' | 'restart'
    }

export type AuditEventOutcome = 'success' | 'failure'

export type AuditEvent = {
  id: string
  timestamp: string
  source: string
  action: string
  actor: string
  subject?: string
  serviceId?: string
  method?: string
  routeTemplate?: string
  outcome: AuditEventOutcome
  statusCode: number
  summary: string
  reason: string | null
  correlationId: string
  relatedRevisionId: string | null
  chainId: string
  sequence: number
  previousHash: string | null
  eventHash: string
  chainStatus: 'valid'
}

export type AuditEventsFilters = {
  serviceId?: string
  actor?: string
  action?: string
  outcome?: AuditEventOutcome
  source?: string
  since?: string
  until?: string
  query?: string
  limit?: number
  cursor?: string
}

export type AuditEventsPagination = {
  limit: number
  nextCursor: string | null
  total: number
}

export type AuditEventsResponse = {
  events: AuditEvent[]
  pagination: AuditEventsPagination
}

export type AuditEventsResult = AuditEventsResponse & {
  status: 'available' | 'unavailable'
  stubMode: boolean
  unavailableReason: string | null
}

export type ServiceConfigRevision = {
  id: string
  createdAt: string
  actor: string
  reason: string | null
  path: string
  previousHash: string
  currentHash: string
  validationStatus: 'valid'
  content: string
}

export type ServiceConfigDocument = {
  serviceId: string
  fileName: 'server.json'
  path: string
  content: string
  hash: string
  updatedAt: string
  backupCount: number
  revisions: ServiceConfigRevision[]
  safety: {
    rawSecretValuesLoaded: false
    omittedSensitiveFields: string[]
  }
}

export type ServiceConfigSaveResult = {
  serviceId: string
  fileName: 'server.json'
  path: string
  hash: string
  savedAt: string
  backup: ServiceConfigRevision
  validationStatus: 'valid'
}

export type TelemetryCountBucket = {
  key: string
  count: number
}

export type ServiceTelemetrySignal = {
  kind: 'span' | 'metric' | 'log' | string
  name: string
  traceId?: string
  spanId?: string
  traceparent?: string
  correlationId?: string
  attributes: Record<string, string | number | boolean>
}

export type ServiceTelemetryPreview = {
  serviceId: string
  signals: ServiceTelemetrySignal[]
}

export type TelemetryPreview = {
  contractVersion: string
  exporter: {
    status: 'disabled' | 'configured' | 'error' | string
    protocol: string
    endpointConfigured: boolean
    endpointValueReturned: boolean
    headersValueReturned: boolean
    reason: string
  }
  resource: {
    serviceName: string
    serviceNamespace: string
    serviceInstanceId: string
  }
  traceContext?: {
    propagation: string
    responseHeaders: {
      correlationId: string
      traceId: string
      traceparent: string
    }
    traceparentSampled: boolean
    incomingHeadersAccepted: boolean
    incomingHeadersReturned: boolean
    rawHeadersReturned: boolean
    routeTemplateOnly: boolean
  }
  redaction: {
    mode: string
    allowedAttributes: string[]
    forbiddenFieldClasses: string[]
  }
  exportPreview: {
    mode: 'disabled' | 'dry_run' | string
    status: 'not_sent' | 'ready' | string
    signalCount: number
    serviceCount: number
    endpointConfigured: boolean
    endpointValueReturned: boolean
    headersValueReturned: boolean
    bodyValueReturned: boolean
    allowedAttributeCount: number
    reason: string
  }
  apiRequestBuffer?: {
    capacity: number
    retainedCount: number
    droppedCount: number
    routeTemplateOnly: boolean
    rawMaterialReturned: boolean
  }
  apiRequestSummary?: {
    retainedCount: number
    droppedCount: number
    totalObservedCount: number
    mutatingCount: number
    routeGroups: TelemetryCountBucket[]
    statusClasses: TelemetryCountBucket[]
    outcomes: TelemetryCountBucket[]
    routeTemplateOnly: boolean
    rawMaterialReturned: boolean
  }
}
