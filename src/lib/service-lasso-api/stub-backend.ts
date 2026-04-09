import type {
  DependencyGraph,
  InstalledRecord,
  NetworkBinding,
  OperatorSetting,
  RuntimeSummary,
  ServiceAction,
  ServiceActionResult,
  ServiceDetail,
  ServiceLogEntry,
  ServiceStatus,
  ServiceSummary,
} from './types'

type RuntimeHealth = RuntimeSummary['status']

type StubState = {
  runtimeSummary: RuntimeSummary
  services: ServiceDetail[]
  operatorSettings: OperatorSetting[]
  bootTimeMs: number
  runtimeEvents: ServiceLogEntry[]
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const initialRuntimeSummary: RuntimeSummary = {
  status: 'healthy',
  version: '0.1.0-draft',
  host: 'localhost',
  profile: 'default',
  uptime: '0m',
  serviceCounts: {
    total: 5,
    running: 3,
    stopped: 1,
    degraded: 1,
    error: 0,
  },
  warnings: [],
  quickActions: ['start', 'stop', 'reload'],
}

const initialServices: ServiceDetail[] = [
  {
    id: 'service-lasso',
    name: 'Service Lasso Core',
    category: 'runtime',
    status: 'running',
    acquisition: 'runtime',
    enabled: true,
    ports: [3000],
    urls: ['http://admin.servicelasso.localhost'],
    actions: ['reload', 'logs'],
    description: 'Core runtime, orchestration, API, and control-plane host.',
    installedVersion: '0.1.0-draft',
    selectedVersion: '0.1.0-draft',
    statePath: '.state/service-lasso.json',
    configPath: 'config/service-lasso.json',
    dependencies: [],
    dependents: ['lasso-@serviceadmin', 'traefik', 'openobserve'],
    note: 'Runtime is serving the local stub API.',
    logs: [
      {
        timestamp: stampFrom(Date.now() - 240000),
        level: 'info',
        message: 'Runtime heartbeat healthy.',
      },
      {
        timestamp: stampFrom(Date.now() - 180000),
        level: 'info',
        message: 'Service registry loaded 5 services.',
      },
      {
        timestamp: stampFrom(Date.now() - 90000),
        level: 'info',
        message: 'Stub API transport enabled for operator testing.',
      },
    ],
  },
  {
    id: 'lasso-@serviceadmin',
    name: 'Service Admin UI',
    category: 'app',
    status: 'running',
    acquisition: 'package',
    enabled: true,
    ports: [4173],
    urls: ['http://localhost:4173'],
    actions: ['start', 'stop', 'restart', 'open', 'logs'],
    description:
      'Optional operator UI built around the intended Service Lasso admin contract.',
    installedVersion: '0.1.0-draft',
    selectedVersion: '0.1.0-draft',
    statePath: '.state/lasso-serviceadmin.json',
    configPath: 'config/ui.json',
    dependencies: ['service-lasso', 'traefik'],
    dependents: [],
    note: 'Currently backed by the served local stub API over HTTP.',
    logs: [
      {
        timestamp: stampFrom(Date.now() - 210000),
        level: 'info',
        message: 'UI bootstrapped against the local stub API.',
      },
      {
        timestamp: stampFrom(Date.now() - 120000),
        level: 'info',
        message: 'HTTP client bound to /api runtime surface.',
      },
    ],
  },
  {
    id: 'traefik',
    name: 'Traefik Router',
    category: 'infra',
    status: 'degraded',
    acquisition: 'package',
    enabled: true,
    ports: [80, 443],
    urls: ['https://admin.servicelasso.localhost'],
    actions: ['start', 'stop', 'restart', 'config', 'logs'],
    description:
      'Edge routing and hostname exposure for browser-facing services.',
    installedVersion: '2.11.0',
    selectedVersion: '2.11.0',
    statePath: '.state/traefik.json',
    configPath: 'services/traefik/config/traefik.yml',
    dependencies: ['service-lasso', 'localcert'],
    dependents: ['lasso-@serviceadmin'],
    note: 'Certificate material is stale, so HTTPS routing is degraded.',
    logs: [
      {
        timestamp: stampFrom(Date.now() - 300000),
        level: 'warn',
        message: 'Route admin.servicelasso.localhost pending certificate sync.',
      },
      {
        timestamp: stampFrom(Date.now() - 110000),
        level: 'warn',
        message: 'Falling back to old certificate bundle.',
      },
    ],
  },
  {
    id: 'openobserve',
    name: 'OpenObserve',
    category: 'infra',
    status: 'running',
    acquisition: 'package',
    enabled: true,
    ports: [5080],
    urls: ['http://localhost:5080'],
    actions: ['start', 'stop', 'restart', 'open', 'logs'],
    description: 'Observability and aggregated logs target.',
    installedVersion: '0.10.0',
    selectedVersion: '0.10.0',
    statePath: '.state/openobserve.json',
    configPath: 'services/openobserve/service.json',
    dependencies: ['service-lasso'],
    dependents: [],
    note: 'Ingest is healthy and collecting runtime events.',
    logs: [
      {
        timestamp: stampFrom(Date.now() - 260000),
        level: 'info',
        message: 'Collector healthy.',
      },
      {
        timestamp: stampFrom(Date.now() - 70000),
        level: 'info',
        message: 'Indexed 128 stub runtime events.',
      },
    ],
  },
  {
    id: 'localcert',
    name: 'Local Certificate Helper',
    category: 'utility',
    status: 'stopped',
    acquisition: 'embed',
    enabled: false,
    ports: [],
    urls: [],
    actions: ['install', 'config', 'logs'],
    description: 'Utility/setup helper for local certificate material.',
    installedVersion: 'bundled',
    selectedVersion: 'bundled',
    statePath: '.state/localcert.json',
    configPath: 'services/_localcert/service.json',
    dependencies: [],
    dependents: ['traefik'],
    note: 'Idle until operator requests certificate refresh.',
    logs: [
      {
        timestamp: stampFrom(Date.now() - 360000),
        level: 'info',
        message: 'Waiting for certificate generation request.',
      },
    ],
  },
]

const initialSettings: OperatorSetting[] = [
  {
    id: 'refresh-interval',
    label: 'Refresh interval',
    value: '15s',
    description:
      'How often the UI should poll the runtime once live APIs exist.',
  },
  {
    id: 'log-tail',
    label: 'Log tail default',
    value: '200 lines',
    description: 'Baseline tail depth for runtime and service log views.',
  },
  {
    id: 'dependency-layout',
    label: 'Dependency graph layout',
    value: 'left-to-right',
    description:
      'Preferred first-pass graph direction before React Flow integration lands.',
  },
]

const state: StubState = {
  runtimeSummary: clone(initialRuntimeSummary),
  services: clone(initialServices),
  operatorSettings: clone(initialSettings),
  bootTimeMs: Date.now() - 18 * 60 * 1000,
  runtimeEvents: [
    {
      timestamp: stampFrom(Date.now() - 180000),
      level: 'info',
      message: 'Stub runtime started.',
    },
    {
      timestamp: stampFrom(Date.now() - 90000),
      level: 'info',
      message: 'Service registry warmed.',
    },
  ],
}

function stampFrom(ms: number) {
  return new Date(ms).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function nowStamp() {
  return stampFrom(Date.now())
}

function findService(serviceId: string) {
  return state.services.find((service) => service.id === serviceId)
}

function appendServiceLog(
  service: ServiceDetail,
  level: ServiceLogEntry['level'],
  message: string
) {
  service.logs.unshift({ timestamp: nowStamp(), level, message })
  service.logs = service.logs.slice(0, 30)
}

function appendRuntimeEvent(level: ServiceLogEntry['level'], message: string) {
  state.runtimeEvents.unshift({ timestamp: nowStamp(), level, message })
  state.runtimeEvents = state.runtimeEvents.slice(0, 40)
  const runtime = findService('service-lasso')
  if (runtime) {
    appendServiceLog(runtime, level, message)
  }
}

function computeUptime() {
  const elapsedMs = Date.now() - state.bootTimeMs
  const totalMinutes = Math.floor(elapsedMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function serviceSummaries(): ServiceSummary[] {
  return state.services.map(
    ({
      description,
      installedVersion,
      selectedVersion,
      statePath,
      configPath,
      dependencies,
      dependents,
      logs,
      ...summary
    }) => summary
  )
}

function dependencyGraph(): DependencyGraph {
  return {
    nodes: state.services.map(({ id, name, status, category }) => ({
      id,
      name,
      status,
      category,
    })),
    edges: [
      { from: 'lasso-@serviceadmin', to: 'service-lasso' },
      { from: 'lasso-@serviceadmin', to: 'traefik' },
      { from: 'traefik', to: 'service-lasso' },
      { from: 'traefik', to: 'localcert' },
      { from: 'openobserve', to: 'service-lasso' },
    ],
  }
}

function networkBindings(): NetworkBinding[] {
  return state.services.map((service) => ({
    serviceId: service.id,
    ports: clone(service.ports),
    urls: clone(service.urls),
    hostnames: service.urls
      .map((url) => {
        try {
          return new URL(url).hostname
        } catch {
          return null
        }
      })
      .filter(Boolean) as string[],
  }))
}

function installedRecords(): InstalledRecord[] {
  return state.services.map((service) => ({
    serviceId: service.id,
    selectedVersion: service.selectedVersion,
    installedVersion: service.installedVersion,
    acquisition: service.acquisition,
    statePath: service.statePath,
    payloadPath: `services/${service.id}`,
  }))
}

function setServiceStatus(
  service: ServiceDetail,
  status: ServiceStatus,
  note?: string
) {
  service.status = status
  if (note) {
    service.note = note
  }
}

function refreshDerivedState() {
  const localcert = findService('localcert')
  const traefik = findService('traefik')
  const ui = findService('lasso-@serviceadmin')
  const openobserve = findService('openobserve')

  if (traefik && localcert) {
    if (localcert.status !== 'running') {
      setServiceStatus(
        traefik,
        traefik.status === 'stopped' ? 'stopped' : 'degraded',
        'Certificate helper is not running, so HTTPS routing remains degraded.'
      )
    } else if (traefik.status === 'degraded') {
      setServiceStatus(
        traefik,
        'running',
        'Certificates are fresh and routing is healthy.'
      )
    }
  }

  if (ui && traefik) {
    if (ui.status === 'running' && traefik.status === 'stopped') {
      ui.note =
        'UI is reachable locally, but routed hostname exposure is unavailable while Traefik is stopped.'
    } else if (ui.status === 'running' && traefik.status === 'degraded') {
      ui.note =
        'UI is running, but routed HTTPS exposure is degraded by Traefik/cert state.'
    } else if (ui.status === 'running') {
      ui.note = 'UI is running and routed network exposure is healthy.'
    }
  }

  if (openobserve) {
    openobserve.note =
      openobserve.status === 'running'
        ? 'Ingest is healthy and collecting runtime events.'
        : 'Observability pipeline is offline.'
  }

  const summaries = serviceSummaries()
  state.runtimeSummary.uptime = computeUptime()
  state.runtimeSummary.serviceCounts = {
    total: summaries.length,
    running: summaries.filter((service) => service.status === 'running').length,
    stopped: summaries.filter((service) => service.status === 'stopped').length,
    degraded: summaries.filter((service) => service.status === 'degraded')
      .length,
    error: summaries.filter((service) => service.status === 'error').length,
  }

  state.runtimeSummary.status = deriveRuntimeHealth(
    state.runtimeSummary.serviceCounts
  )
  state.runtimeSummary.warnings = runtimeWarnings(state.runtimeSummary.status)
}

function deriveRuntimeHealth(
  counts: RuntimeSummary['serviceCounts']
): RuntimeHealth {
  if (counts.error > 0) {
    return 'error'
  }
  if (counts.degraded > 0) {
    return 'degraded'
  }
  return 'healthy'
}

function runtimeWarnings(health: RuntimeHealth) {
  const warnings = [
    'Responses are currently served by the local Service Lasso stub API.',
    'Swap these endpoints to the real runtime once the backend contract is ready.',
  ]

  const traefik = findService('traefik')
  const localcert = findService('localcert')
  const openobserve = findService('openobserve')

  if (health !== 'healthy') {
    warnings.push(
      'Runtime is not fully healthy, so operator views should show degraded state handling.'
    )
  }
  if (traefik?.status === 'degraded') {
    warnings.push(
      'Traefik routing is degraded while certificate state is stale or helper is offline.'
    )
  }
  if (localcert?.status !== 'running') {
    warnings.push('Local certificate helper is currently not running.')
  }
  if (openobserve?.status !== 'running') {
    warnings.push('Observability ingest is offline, so logs may lag.')
  }

  return warnings
}

function actionResult(
  action: ServiceAction,
  serviceId?: string
): ServiceActionResult {
  return {
    serviceId,
    action,
    ok: true,
    message: serviceId
      ? `Stubbed ${action} request applied for ${serviceId}.`
      : `Stubbed runtime ${action} request applied.`,
  }
}

function runRuntimeAction(action: ServiceAction) {
  if (action === 'start') {
    state.services.forEach((service) => {
      if (!service.enabled && service.id !== 'service-lasso') {
        appendServiceLog(
          service,
          'warn',
          'Skipped start because service is disabled.'
        )
        return
      }
      if (service.id === 'localcert') {
        setServiceStatus(
          service,
          'running',
          'Certificate refresh helper is active.'
        )
      } else {
        setServiceStatus(service, 'running')
      }
      appendServiceLog(service, 'info', 'Runtime start-all stub executed.')
    })
    appendRuntimeEvent(
      'info',
      'Runtime start-all executed against stub services.'
    )
  }

  if (action === 'stop') {
    state.services.forEach((service) => {
      if (service.id === 'service-lasso') {
        appendServiceLog(
          service,
          'warn',
          'Core runtime stays up to continue serving the stub API.'
        )
        return
      }
      setServiceStatus(
        service,
        'stopped',
        'Stopped by runtime stop-all action.'
      )
      appendServiceLog(service, 'warn', 'Runtime stop-all stub executed.')
    })
    appendRuntimeEvent(
      'warn',
      'Runtime stop-all executed against stub services.'
    )
  }

  if (action === 'reload') {
    appendRuntimeEvent(
      'info',
      'Runtime reload executed. Metadata and warnings recalculated.'
    )
    const localcert = findService('localcert')
    if (localcert?.status === 'running') {
      appendServiceLog(
        localcert,
        'info',
        'Reload confirmed certificate bundle availability.'
      )
    }
  }

  refreshDerivedState()
  return actionResult(action)
}

function runServiceAction(serviceId: string, action: ServiceAction) {
  const service = findService(serviceId)
  if (!service) {
    return null
  }

  switch (action) {
    case 'start':
      service.enabled = true
      setServiceStatus(
        service,
        'running',
        'Service started successfully through stub backend.'
      )
      appendServiceLog(service, 'info', 'Start action completed.')
      break

    case 'stop':
      if (service.id === 'service-lasso') {
        appendServiceLog(
          service,
          'error',
          'Refused to stop stub API host because the test backend would disappear.'
        )
        return {
          serviceId,
          action,
          ok: false,
          message:
            'Stub runtime refuses to stop the core host while serving the API.',
        }
      }
      setServiceStatus(
        service,
        'stopped',
        'Service was stopped through stub backend.'
      )
      appendServiceLog(service, 'warn', 'Stop action completed.')
      break

    case 'restart':
      setServiceStatus(
        service,
        'starting',
        'Restart requested, waiting for process readiness.'
      )
      appendServiceLog(service, 'warn', 'Restart action entered warmup state.')
      setServiceStatus(service, 'running', 'Restart completed successfully.')
      appendServiceLog(service, 'info', 'Restart action completed.')
      break

    case 'reload':
      if (service.id === 'traefik') {
        setServiceStatus(
          service,
          'degraded',
          'Reload completed, but certificate bundle is still stale.'
        )
        appendServiceLog(
          service,
          'warn',
          'Reload picked up config but TLS state is still degraded.'
        )
      } else {
        appendServiceLog(service, 'info', 'Reload action completed.')
      }
      break

    case 'install':
      service.enabled = true
      setServiceStatus(
        service,
        'starting',
        'Install staged and unpacking payload.'
      )
      appendServiceLog(
        service,
        'info',
        'Install action downloaded package and staged files.'
      )
      service.installedVersion = service.selectedVersion
      if (service.id === 'localcert') {
        setServiceStatus(
          service,
          'running',
          'Certificate helper installed and executed successfully.'
        )
        appendServiceLog(
          service,
          'info',
          'Generated fresh local certificate bundle.'
        )
      } else {
        setServiceStatus(
          service,
          'running',
          'Install completed and service is ready.'
        )
      }
      break

    case 'config':
      if (service.id === 'traefik') {
        const localcert = findService('localcert')
        if (localcert?.status === 'running') {
          setServiceStatus(
            service,
            'running',
            'Config regenerated successfully with fresh certificate bundle.'
          )
          appendServiceLog(
            service,
            'info',
            'Config action refreshed routes and TLS material.'
          )
        } else {
          setServiceStatus(
            service,
            'degraded',
            'Config regenerated, but certificate material is still missing.'
          )
          appendServiceLog(
            service,
            'warn',
            'Config action completed without fresh certificates.'
          )
        }
      } else {
        appendServiceLog(service, 'info', 'Config action completed.')
      }
      break

    case 'reset':
      setServiceStatus(
        service,
        'stopped',
        'State reset and service returned to a stopped baseline.'
      )
      appendServiceLog(
        service,
        'warn',
        'Reset cleared runtime state and returned service to baseline.'
      )
      break

    case 'open':
      appendServiceLog(
        service,
        'info',
        'Open action requested browser launch or deep-link navigation.'
      )
      break

    case 'logs':
      appendServiceLog(
        service,
        'info',
        'Logs action requested a fresh tail snapshot.'
      )
      break
  }

  appendRuntimeEvent('info', `Action ${action} applied to ${serviceId}.`)
  refreshDerivedState()
  return actionResult(action, serviceId)
}

export const stubBackend = {
  getHealth() {
    refreshDerivedState()
    return {
      ok: true,
      source: 'service-lasso-stub-api',
      runtimeStatus: state.runtimeSummary.status,
      services: state.runtimeSummary.serviceCounts,
    }
  },

  getRuntimeSummary() {
    refreshDerivedState()
    return clone(state.runtimeSummary)
  },

  runRuntimeAction(action: ServiceAction) {
    return clone(runRuntimeAction(action))
  },

  getServices() {
    refreshDerivedState()
    return clone(serviceSummaries())
  },

  getService(serviceId: string) {
    refreshDerivedState()
    const service = findService(serviceId)
    return service ? clone(service) : null
  },

  runServiceAction(serviceId: string, action: ServiceAction) {
    const result = runServiceAction(serviceId, action)
    return result ? clone(result) : null
  },

  getDependencyGraph() {
    refreshDerivedState()
    return clone(dependencyGraph())
  },

  getNetworkBindings() {
    refreshDerivedState()
    return clone(networkBindings())
  },

  getInstalledRecords() {
    refreshDerivedState()
    return clone(installedRecords())
  },

  getOperatorSettings() {
    return clone(state.operatorSettings)
  },
}
