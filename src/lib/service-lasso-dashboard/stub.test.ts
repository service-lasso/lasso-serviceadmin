import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadStub() {
  vi.resetModules()
  return import('./stub')
}

describe('service lasso dashboard stub', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('builds a summary from the current service inventory', async () => {
    const { fetchDashboardSummary } = await loadStub()

    const summary = await fetchDashboardSummary()

    expect(summary.servicesTotal).toBe(5)
    expect(summary.servicesRunning).toBe(3)
    expect(summary.servicesStopped).toBe(1)
    expect(summary.servicesDegraded).toBe(1)
    expect(summary.installedCount).toBe(5)
    expect(summary.networkExposureCount).toBe(7)
    expect(summary.runtime.status).toBe('warning')
    expect(summary.warnings).toEqual([
      'One or more services are degraded and need attention.',
      'At least one managed service is currently stopped.',
    ])
    expect(summary.favorites.map((service) => service.id)).toEqual([
      'traefik',
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

  it('toggles favorite state and returns cloned service data', async () => {
    const { fetchDashboardService, fetchServices, runDashboardAction } =
      await loadStub()

    const services = await fetchServices()
    services[0].name = 'mutated by test'

    expect((await fetchDashboardService('traefik'))?.name).toBe('Traefik')

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
