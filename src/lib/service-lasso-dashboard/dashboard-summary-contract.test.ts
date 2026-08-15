import { describe, expect, it } from 'vitest'
import { normalizeRuntimeDashboardSummary } from './stub'

describe('runtime dashboard summary contract', () => {
  it('supplies safe empty notification groups when the current core omits them', () => {
    const summary = normalizeRuntimeDashboardSummary({
      runtime: {
        status: 'healthy',
        lastReloadedAt: '2026-08-14T00:00:00.000Z',
        warningCount: 0,
      },
      servicesTotal: 0,
      servicesRunning: 0,
      servicesStopped: 0,
      servicesDegraded: 0,
      networkExposureCount: 0,
      installedCount: 0,
      favorites: [],
      others: [],
      warnings: [],
      problemServices: [],
    })

    expect(summary.updateNotifications).toEqual({
      latestCount: 0,
      availableCount: 0,
      downloadedCount: 0,
      deferredCount: 0,
      failedCount: 0,
      messages: [],
    })
    expect(summary.recoveryNotifications).toEqual({
      monitorAttentionCount: 0,
      doctorBlockedCount: 0,
      hookBlockedCount: 0,
      restartFailureCount: 0,
      messages: [],
    })
  })
})
