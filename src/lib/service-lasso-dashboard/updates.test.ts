import { describe, expect, it } from 'vitest'
import { applyRemoteUpdateStates, buildUpdateNotifications } from './stub'
import type { DashboardService, ServiceUpdateState } from './types'

function updateState(
  serviceId: string,
  state: ServiceUpdateState['state']
): ServiceUpdateState {
  return {
    serviceId,
    state,
    updatedAt: '2026-04-26T00:00:00.000Z',
    lastCheck: null,
    available:
      state === 'available'
        ? {
            tag: '2026.4.26-new',
            version: '2026.4.26-new',
            releaseUrl: null,
            publishedAt: null,
            assetName: 'service.zip',
            assetUrl: 'https://example.invalid/service.zip',
          }
        : null,
    downloadedCandidate:
      state === 'downloadedCandidate'
        ? {
            tag: '2026.4.26-new',
            version: '2026.4.26-new',
            assetName: 'service.zip',
            assetUrl: 'https://example.invalid/service.zip',
            archivePath: '/tmp/service.zip',
            extractedPath: null,
            downloadedAt: '2026-04-26T00:00:00.000Z',
          }
        : null,
    installDeferred:
      state === 'installDeferred'
        ? {
            reason: 'Current time is outside updates.installWindow.',
            deferredAt: '2026-04-26T00:00:00.000Z',
            nextEligibleAt: '2026-04-26T02:00:00.000Z',
          }
        : null,
    failed:
      state === 'failed'
        ? {
            reason: 'Release source failed.',
            failedAt: '2026-04-26T00:00:00.000Z',
            sourceStatus: 'check_failed',
          }
        : null,
  }
}

function service(
  id: string,
  state: ServiceUpdateState['state']
): DashboardService {
  return {
    id,
    name: id,
    status: 'running',
    favorite: false,
    note: '',
    links: [],
    installed: true,
    role: '',
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '1m',
      lastCheckAt: '2026-04-26T00:00:00.000Z',
      summary: 'Healthy',
    },
    endpoints: [],
    metadata: {
      serviceType: 'test',
      runtime: 'test',
      version: '1.0.0',
      build: 'test',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [],
    recentLogs: [],
    actions: [],
    updates: updateState(id, state),
  }
}

describe('service update notifications', () => {
  it('summarizes available, downloaded, deferred, failed, and latest update states', () => {
    const summary = buildUpdateNotifications([
      service('latest', 'installed'),
      service('available', 'available'),
      service('downloaded', 'downloadedCandidate'),
      service('deferred', 'installDeferred'),
      service('failed', 'failed'),
    ])

    expect(summary.latestCount).toBe(1)
    expect(summary.availableCount).toBe(1)
    expect(summary.downloadedCount).toBe(1)
    expect(summary.deferredCount).toBe(1)
    expect(summary.failedCount).toBe(1)
    expect(summary.messages).toContain('1 service update(s) are available.')
    expect(summary.messages).toContain(
      '1 downloaded update candidate(s) are ready.'
    )
    expect(summary.messages).toContain(
      '1 update install(s) are waiting for a window.'
    )
    expect(summary.messages).toContain('1 update check(s) need attention.')
  })

  it('accepts remote update state payloads from the Service Lasso API shape', () => {
    expect(() =>
      applyRemoteUpdateStates([
        {
          serviceId: 'service-admin',
          update: updateState('service-admin', 'available'),
        },
      ])
    ).not.toThrow()
  })
})
