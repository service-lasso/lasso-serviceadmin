export type ServiceStatus =
  | 'running'
  | 'stopped'
  | 'error'
  | 'starting'
  | 'degraded'

export type ServiceAction =
  | 'start'
  | 'stop'
  | 'restart'
  | 'reload'
  | 'install'
  | 'config'
  | 'reset'
  | 'open'
  | 'logs'

export interface RuntimeSummary {
  status: 'healthy' | 'degraded' | 'error'
  version: string
  host: string
  profile: string
  uptime: string
  serviceCounts: {
    total: number
    running: number
    stopped: number
    degraded: number
    error: number
  }
  warnings: string[]
  quickActions: ServiceAction[]
}

export interface ServiceSummary {
  id: string
  name: string
  category: 'runtime' | 'infra' | 'app' | 'utility'
  status: ServiceStatus
  acquisition: 'embed' | 'package' | 'runtime'
  enabled: boolean
  ports: number[]
  urls: string[]
  actions: ServiceAction[]
  note?: string
}

export interface ServiceLogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface ServiceDetail extends ServiceSummary {
  description: string
  installedVersion: string
  selectedVersion: string
  statePath: string
  configPath: string
  dependencies: string[]
  dependents: string[]
  logs: ServiceLogEntry[]
}

export interface DependencyEdge {
  from: string
  to: string
}

export interface DependencyGraph {
  nodes: Pick<ServiceSummary, 'id' | 'name' | 'status' | 'category'>[]
  edges: DependencyEdge[]
}

export interface NetworkBinding {
  serviceId: string
  ports: number[]
  urls: string[]
  hostnames: string[]
}

export interface InstalledRecord {
  serviceId: string
  selectedVersion: string
  installedVersion: string
  acquisition: 'embed' | 'package' | 'runtime'
  statePath: string
  payloadPath: string
}

export interface OperatorSetting {
  id: string
  label: string
  value: string
  description: string
}

export interface ServiceActionResult {
  serviceId?: string
  action: ServiceAction
  ok: boolean
  message: string
}
