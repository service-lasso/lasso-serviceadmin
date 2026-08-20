import { describe, expect, it } from 'vitest'
import type {
  DashboardService,
  DashboardSummary,
} from '@/lib/service-lasso-dashboard/types'
import {
  buildSupportBundleReview,
  redactDiagnosticText,
  supportBundleReviewHasSecretMaterial,
} from './support-bundle'

function service(overrides: Partial<DashboardService> = {}): DashboardService {
  return {
    id: '@serviceadmin',
    name: 'Service Admin',
    status: 'running',
    favorite: true,
    note: 'Runtime API service metadata.',
    links: [],
    installed: true,
    role: 'vite-preview',
    runtimeHealth: {
      state: 'running',
      health: 'healthy',
      uptime: '5m',
      lastCheckAt: '2026-06-09T02:35:00.000Z',
      summary: 'Service Admin UI is reachable.',
    },
    endpoints: [
      {
        label: 'LAN',
        url: 'http://192.168.1.53:17700',
        bind: '0.0.0.0',
        port: 17700,
        protocol: 'http',
        exposure: 'lan',
      },
    ],
    metadata: {
      serviceType: 'core',
      runtime: 'vite-preview',
      version: '2026.6.9-test',
      build: 'test',
      configPath: 'C:\\service-lasso\\serviceadmin\\service.json',
    },
    dependencies: [],
    dependents: [],
    environmentVariables: [
      {
        key: 'SESSION_SECRET',
        value: 'session-secret-plaintext-canary',
        scope: 'service',
        secret: true,
        source: 'runtime env',
      },
    ],
    recentLogs: [
      {
        timestamp: '2026-06-09T02:35:00.000Z',
        level: 'info',
        source: 'app',
        message: 'started with token=runtime-token-canary',
      },
    ],
    actions: [],
    ...overrides,
  }
}

const summary: DashboardSummary = {
  runtime: {
    status: 'healthy',
    lastReloadedAt: '2026-06-09T02:35:00.000Z',
    warningCount: 0,
  },
  servicesTotal: 1,
  servicesRunning: 1,
  servicesAvailable: 0,
  servicesStopped: 0,
  servicesDegraded: 0,
  networkExposureCount: 1,
  installedCount: 1,
  favorites: [],
  others: [],
  warnings: [],
  problemServices: [],
}

describe('support bundle diagnostics action', () => {
  it('redacts common secret-like diagnostic values', () => {
    const redacted = redactDiagnosticText(
      'authorization=ok bearer abc.def.ghi api_key=sk_test_canary password=hunter2 cookie=session-canary -----BEGIN PRIVATE KEY-----abc-----END PRIVATE KEY-----'
    )

    expect(redacted).toContain('[REDACTED_AUTHORIZATION]')
    expect(redacted).toContain('api_key=[REDACTED_SECRET]')
    expect(redacted).toContain('password=[REDACTED_SECRET]')
    expect(redacted).toContain('cookie=[REDACTED_SECRET]')
    expect(redacted).toContain('[REDACTED_PRIVATE_KEY]')
    expect(redacted).not.toContain('sk_test_canary')
    expect(redacted).not.toContain('hunter2')
    expect(redacted).not.toContain('session-canary')
  })

  it('builds the review from runtime/service metadata without raw values', () => {
    const review = buildSupportBundleReview({
      summary,
      services: [service()],
    })

    expect(review.exportAvailability.state).toBe('unavailable')
    expect(review.sourceState.state).toBe('available')
    expect(review.previewItems.map((item) => item.id)).toEqual([
      'runtime-summary',
      'secret-ref-inventory',
      'route-endpoint-metadata',
      'recent-log-summaries',
    ])
    expect(review.sections.some((section) => section.id === 'redaction')).toBe(
      true
    )
    expect(supportBundleReviewHasSecretMaterial(review)).toBe(false)
    expect(JSON.stringify(review)).not.toContain(
      'session-secret-plaintext-canary'
    )
    expect(JSON.stringify(review)).not.toContain('runtime-token-canary')
  })

  it('marks the review unavailable instead of preparing fixture data without runtime metadata', () => {
    const review = buildSupportBundleReview()

    expect(review.sourceState.state).toBe('unavailable')
    expect(review.previewItems).toEqual([])
    expect(review.approximateSizeLabel).toMatch(/Unavailable/i)
  })
})
