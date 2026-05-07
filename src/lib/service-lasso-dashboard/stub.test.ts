import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadStub() {
  vi.resetModules()
  return import('./stub')
}

describe('service lasso dashboard stub', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('builds a summary from the current service inventory', async () => {
    const { fetchDashboardSummary } = await loadStub()

    const summary = await fetchDashboardSummary()

    expect(summary.servicesTotal).toBe(4)
    expect(summary.servicesRunning).toBe(2)
    expect(summary.servicesStopped).toBe(1)
    expect(summary.servicesDegraded).toBe(1)
    expect(summary.installedCount).toBe(4)
    expect(summary.networkExposureCount).toBe(6)
    expect(summary.runtime.status).toBe('warning')
    expect(summary.warnings).toEqual([
      'One or more services are degraded and need attention.',
      'At least one managed service is currently stopped.',
    ])
    expect(summary.favorites.map((service) => service.id)).toEqual([
      '@traefik',
      '@serviceadmin',
    ])
    expect(summary.problemServices.map((service) => service.id)).toEqual([
      'zitadel',
      'dagu',
    ])
  })

  it('starts stopped services and refreshes runtime health metadata', async () => {
    const { fetchDashboardService, runDashboardAction } = await loadStub()

    const before = await fetchDashboardService('dagu')
    expect(before?.status).toBe('stopped')
    expect(before?.runtimeHealth.health).toBe('critical')

    const summary = await runDashboardAction('start-services')
    const after = await fetchDashboardService('dagu')

    expect(after?.status).toBe('running')
    expect(after?.runtimeHealth.state).toBe('running')
    expect(after?.runtimeHealth.health).toBe('healthy')
    expect(after?.runtimeHealth.summary).toBe(
      'Service was started from the dashboard action.'
    )
    expect(after?.recentLogs[0]).toMatchObject({
      level: 'info',
      source: 'supervisor',
      message: 'Service started from dashboard bulk action.',
    })
    expect(summary.servicesStopped).toBe(0)
    expect(summary.problemServices.map((service) => service.id)).toEqual([
      'zitadel',
    ])
  })

  it('stops and restarts services from dashboard actions', async () => {
    const { fetchDashboardService, runDashboardAction } = await loadStub()

    const stoppedSummary = await runDashboardAction('stop-services')

    expect(stoppedSummary.servicesStopped).toBe(4)
    expect((await fetchDashboardService('@traefik'))?.status).toBe('stopped')

    const restartedSummary = await runDashboardAction('restart-services')

    expect(restartedSummary.servicesRunning).toBe(4)
    expect((await fetchDashboardService('@traefik'))?.status).toBe('running')
  })

  it('runs per-service lifecycle actions from services table controls', async () => {
    const { fetchDashboardService, runDashboardAction } = await loadStub()

    await runDashboardAction({
      kind: 'service-lifecycle',
      serviceId: '@serviceadmin',
      action: 'stop',
    })

    expect((await fetchDashboardService('@serviceadmin'))?.status).toBe(
      'stopped'
    )

    await runDashboardAction({
      kind: 'service-lifecycle',
      serviceId: '@serviceadmin',
      action: 'restart',
    })

    expect((await fetchDashboardService('@serviceadmin'))?.status).toBe(
      'running'
    )
  })

  it('persists service state and syncs relationship statuses for dev preview', async () => {
    const firstStub = await loadStub()

    await firstStub.runDashboardAction({
      kind: 'service-lifecycle',
      serviceId: '@traefik',
      action: 'stop',
    })

    expect((await firstStub.fetchDashboardService('@traefik'))?.status).toBe(
      'stopped'
    )

    const serviceAdmin = await firstStub.fetchDashboardService('@serviceadmin')
    expect(serviceAdmin?.dependencies).toEqual([
      expect.objectContaining({
        id: '@traefik',
        status: 'stopped',
      }),
      expect.objectContaining({
        id: 'zitadel',
        status: 'degraded',
      }),
    ])

    const reloadedStub = await loadStub()

    expect((await reloadedStub.fetchDashboardService('@traefik'))?.status).toBe(
      'stopped'
    )
    expect((await reloadedStub.fetchDashboardSummary()).servicesStopped).toBe(2)
  })

  it('toggles favorite state and returns cloned service data', async () => {
    const { fetchDashboardService, fetchServices, runDashboardAction } =
      await loadStub()

    const services = await fetchServices()
    services[0].name = 'mutated by test'

    expect((await fetchDashboardService('@traefik'))?.name).toBe('Traefik')

    const summary = await runDashboardAction({
      kind: 'toggle-favorite',
      serviceId: 'dagu',
    })

    expect((await fetchDashboardService('dagu'))?.favorite).toBe(true)
    expect(summary.favorites.map((service) => service.id)).toContain('dagu')
  })

  it('resolves stub log metadata for known services only', async () => {
    const { buildStubServiceLogUrl, resolveStubServiceLogInfo } =
      await loadStub()

    expect(resolveStubServiceLogInfo('@serviceadmin')).toMatchObject({
      serviceId: '@serviceadmin',
      type: 'default',
      availableTypes: ['default'],
    })
    expect(resolveStubServiceLogInfo('missing-service')).toBeNull()
    expect(buildStubServiceLogUrl('@serviceadmin')).toBe(
      '/api/logs/content?service=%40serviceadmin&type=default'
    )
  })
})
